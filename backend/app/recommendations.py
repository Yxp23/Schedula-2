"""
Schedula Recommendation Engine
Analyzes unfulfilled degree requirements and surfaces best-matched open courses.
Scoring factors: RMP professor rating, seat availability, gen-ed match, course level.
"""

from sqlalchemy.orm import Session
from app.models import DegreeTrack, RequirementType, Course, CourseSection, Professor
from typing import Optional
import json


def get_recommendations(
    db: Session,
    track_id: int,
    completed_course_ids: list[int],
    max_credits: int = 18,
    limit: int = 8,
) -> dict:
    """
    Returns a prioritized list of course recommendations based on unfulfilled requirements.
    Each recommendation includes:
    - The requirement it satisfies
    - Course details
    - Best available section + professor rating
    - A relevance score
    """
    track = db.query(DegreeTrack).filter(DegreeTrack.id == track_id).first()
    if not track:
        return {"error": "Track not found"}

    # Pre-fetch completed courses
    completed_courses = []
    for cid in completed_course_ids:
        course = db.query(Course).filter(Course.id == cid).first()
        if course:
            completed_courses.append(course)
    completed_ids_set = set(completed_course_ids)
    completed_codes = {c.code for c in completed_courses}

    recommendations = []

    for category in track.categories:
        # Skip already-complete categories
        cat_credits_earned = 0

        for rule in category.rules:
            # ── SPECIFIC_COURSE ──────────────────────────────────────────
            if rule.rule_type == RequirementType.SPECIFIC_COURSE:
                if rule.target_course_id in completed_ids_set:
                    target = db.query(Course).filter(Course.id == rule.target_course_id).first()
                    if target:
                        cat_credits_earned += target.credits or 3
                    continue

                target = db.query(Course).filter(Course.id == rule.target_course_id).first()
                if not target or not _meets_prereqs(target, completed_codes):
                    continue

                rec = _build_recommendation(
                    db=db,
                    course=target,
                    requirement_name=category.name,
                    requirement_type="required",
                    reason=f"Required for {category.name}",
                )
                if rec:
                    recommendations.append(rec)

            # ── COURSE_GROUP ─────────────────────────────────────────────
            elif rule.rule_type == RequirementType.COURSE_GROUP:
                if not rule.alternative_course_ids:
                    continue
                alt_ids = [int(x.strip()) for x in rule.alternative_course_ids.split(",") if x.strip()]

                # Check if any alt is already completed
                already_done = any(aid in completed_ids_set for aid in alt_ids)
                if already_done:
                    # Count credits for any completed alt
                    for aid in alt_ids:
                        if aid in completed_ids_set:
                            c = db.query(Course).filter(Course.id == aid).first()
                            if c:
                                cat_credits_earned += c.credits or 3
                    continue

                # Score each alternative and pick the best
                best_rec = None
                best_score = -1.0
                for aid in alt_ids:
                    alt = db.query(Course).filter(Course.id == aid).first()
                    if not alt or not _meets_prereqs(alt, completed_codes):
                        continue
                    rec = _build_recommendation(
                        db=db,
                        course=alt,
                        requirement_name=category.name,
                        requirement_type="choose_one",
                        reason=f"One of several options for {category.name}",
                    )
                    if rec and rec["score"] > best_score:
                        best_score = rec["score"]
                        best_rec = rec
                if best_rec:
                    recommendations.append(best_rec)

            # ── CREDIT_POOL ──────────────────────────────────────────────
            elif rule.rule_type == RequirementType.CREDIT_POOL:
                pool_dept = rule.pool_department
                pool_min = rule.pool_min_level
                gen_ed_codes = {"GA", "GH", "GS", "GN", "GHW", "GQ", "GWS"}
                is_gen_ed = pool_dept in gen_ed_codes

                # Calculate already-earned pool credits
                pool_earned = 0
                for cc in completed_courses:
                    if is_gen_ed:
                        if cc.gen_ed and f"({pool_dept})" in cc.gen_ed:
                            pool_earned += cc.credits or 3
                    else:
                        if cc.department == pool_dept:
                            try:
                                num = int("".join(filter(str.isdigit, cc.code.split()[-1])))
                                if pool_min is None or num >= pool_min:
                                    pool_earned += cc.credits or 3
                            except (ValueError, IndexError):
                                pass

                credits_needed = max(0, (category.credits_required or 3) - pool_earned)
                if credits_needed <= 0:
                    cat_credits_earned += category.credits_required
                    continue

                # Find the best-scoring open course that fills this pool
                if is_gen_ed:
                    pool_courses = (
                        db.query(Course)
                        .filter(Course.gen_ed.contains(f"({pool_dept})"))
                        .filter(Course.id.notin_(completed_ids_set))
                        .limit(50)
                        .all()
                    )
                    label_map = {
                        "GA": "Arts", "GH": "Humanities", "GS": "Social Sciences",
                        "GN": "Natural Sciences", "GHW": "Health & Wellness",
                        "GQ": "Quantification", "GWS": "Writing/Speaking"
                    }
                    reason = f"Satisfies {pool_dept} ({label_map.get(pool_dept, '')}) requirement"
                else:
                    pool_courses = (
                        db.query(Course)
                        .filter(Course.department == pool_dept)
                        .filter(Course.id.notin_(completed_ids_set))
                        .limit(50)
                        .all()
                    )
                    if pool_min:
                        pool_courses = [
                            c for c in pool_courses
                            if _course_level(c) >= pool_min
                        ]
                    reason = f"Counts toward {pool_dept} {pool_min or ''}+ credits"

                best_rec = None
                best_score = -1.0
                for pc in pool_courses:
                    if not _meets_prereqs(pc, completed_codes):
                        continue
                    rec = _build_recommendation(
                        db=db,
                        course=pc,
                        requirement_name=category.name,
                        requirement_type="pool",
                        reason=reason,
                    )
                    if rec and rec["score"] > best_score:
                        best_score = rec["score"]
                        best_rec = rec
                if best_rec:
                    recommendations.append(best_rec)

    # Deduplicate by course_id (keep highest score)
    seen: dict[int, dict] = {}
    for rec in recommendations:
        cid = rec["course"]["id"]
        if cid not in seen or rec["score"] > seen[cid]["score"]:
            seen[cid] = rec

    # Sort by score descending and return top N
    sorted_recs = sorted(seen.values(), key=lambda r: r["score"], reverse=True)[:limit]

    return {
        "track": track.title,
        "recommendations": sorted_recs,
        "total": len(sorted_recs),
    }


# ── Helpers ────────────────────────────────────────────────────────────────


def _course_level(course: Course) -> int:
    """Extract numeric level from course code (e.g. CMPSC 132 → 132)."""
    try:
        return int("".join(filter(str.isdigit, course.code.split()[-1])))
    except (ValueError, IndexError):
        return 0


def _meets_prereqs(course: Course, completed_codes: set) -> bool:
    """Checks if a student has completed all required prereqs for a course."""
    if not course.prerequisites:
        return True
    try:
        reqs = json.loads(course.prerequisites)
        for req in reqs:
            if req not in completed_codes:
                return False
        return True
    except Exception:
        return True


def _build_recommendation(
    db: Session,
    course: Course,
    requirement_name: str,
    requirement_type: str,
    reason: str,
) -> Optional[dict]:
    """
    Builds a recommendation dict for a course.
    Score = 0.5 * prof_rating_norm + 0.3 * seat_availability + 0.2 * has_open_section
    Returns None if course has no open sections.
    """
    sections = (
        db.query(CourseSection)
        .filter(CourseSection.course_id == course.id)
        .all()
    )

    open_sections = [
        s for s in sections if s.enrollment_current < s.enrollment_cap
    ]

    # No sections at all is still ok — recommend it, just flag no sections
    best_section = None
    best_prof_rating = 0.0
    seat_pct = 0.0

    if sections:
        # Pick the section with the best professor rating that still has seats
        ranked = sorted(
            open_sections or sections,
            key=lambda s: (
                s.professor.rmp_rating if s.professor and s.professor.rmp_rating else 0
            ),
            reverse=True,
        )
        best_section = ranked[0] if ranked else None

        if best_section:
            if best_section.professor and best_section.professor.rmp_rating:
                best_prof_rating = best_section.professor.rmp_rating / 5.0
            if best_section.enrollment_cap and best_section.enrollment_cap > 0:
                seat_pct = max(
                    0,
                    (best_section.enrollment_cap - best_section.enrollment_current)
                    / best_section.enrollment_cap,
                )

    # Composite score
    has_open = 1.0 if open_sections else 0.0
    score = round(
        0.5 * best_prof_rating + 0.3 * seat_pct + 0.2 * has_open,
        4,
    )

    section_summary = None
    if best_section:
        prof = best_section.professor
        section_summary = {
            "id": best_section.id,
            "days": best_section.days,
            "start_time": best_section.start_time,
            "end_time": best_section.end_time,
            "seats_open": max(0, best_section.enrollment_cap - best_section.enrollment_current),
            "seats_total": best_section.enrollment_cap,
            "professor": {
                "name": prof.name,
                "rating": prof.rmp_rating,
                "difficulty": prof.rmp_difficulty,
            } if prof else None,
        }

    return {
        "course": {
            "id": course.id,
            "code": course.code,
            "title": course.title,
            "credits": course.credits,
            "gen_ed": course.gen_ed,
            "description": (course.description or "")[:200],
        },
        "requirement": requirement_name,
        "requirement_type": requirement_type,
        "reason": reason,
        "best_section": section_summary,
        "has_open_sections": bool(open_sections),
        "score": score,
    }
