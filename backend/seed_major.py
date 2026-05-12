"""
Comprehensive CS B.S. Degree Seed
Seeds the FULL Computer Science, B.S. degree requirements at Penn State University Park.
Based on: https://bulletins.psu.edu/undergraduate/colleges/engineering/computer-science-bs/

Categories:
  1. Entrance to Major (ETM)
  2. Core Computer Science
  3. Mathematics Foundation
  4. Science Requirements
  5. Writing & Communication
  6. Statistics Requirement
  7. Gen Ed: Arts (GA)
  8. Gen Ed: Humanities (GH)
  9. Gen Ed: Social & Behavioral Sciences (GS)
  10. Gen Ed: Health & Wellness (GHW)
  11. Gen Ed: Natural Sciences (GN) - Exploration
  12. Gen Ed: Quantification (GQ)
"""

from app.database import SessionLocal
from app.models import DegreeTrack, RequirementCategory, DegreeRule, RequirementType, Course

def seed_full_cs():
    db = SessionLocal()
    
    # ── Clean old data ────────────────────────────────────────
    db.query(DegreeRule).delete()
    db.query(RequirementCategory).delete()
    db.query(DegreeTrack).delete()
    db.commit()
    
    # ── Create Track ──────────────────────────────────────────
    track = DegreeTrack(title="Computer Science, B.S.", total_credits=127)
    db.add(track)
    db.commit()
    db.refresh(track)
    print(f"✅ Track created: {track.title} (id={track.id})")

    def add_category(name, credits, is_etm=False):
        cat = RequirementCategory(
            track_id=track.id, name=name,
            credits_required=credits, is_entrance_to_major=is_etm
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return cat

    def add_specific(cat, code):
        course = db.query(Course).filter(Course.code == code).first()
        if course:
            rule = DegreeRule(
                category_id=cat.id, 
                rule_type=RequirementType.SPECIFIC_COURSE,
                target_course_id=course.id
            )
            db.add(rule)
            print(f"    ✅ {code} (id={course.id})")
        else:
            print(f"    ❌ {code} NOT FOUND")

    def add_group(cat, codes):
        """One of these courses must be taken."""
        ids = []
        labels = []
        for code in codes:
            course = db.query(Course).filter(Course.code == code).first()
            if course:
                ids.append(str(course.id))
                labels.append(code)
        if ids:
            rule = DegreeRule(
                category_id=cat.id,
                rule_type=RequirementType.COURSE_GROUP,
                alternative_course_ids=",".join(ids)
            )
            db.add(rule)
            print(f"    ✅ Group: {' or '.join(labels)}")

    def add_pool(cat, dept, min_level=None):
        rule = DegreeRule(
            category_id=cat.id,
            rule_type=RequirementType.CREDIT_POOL,
            pool_department=dept,
            pool_min_level=min_level
        )
        db.add(rule)
        print(f"    ✅ Pool: {dept} {min_level or ''}+ level")

    # ── 1. ENTRANCE TO MAJOR ─────────────────────────────────
    print("\n📋 Entrance to Major:")
    etm = add_category("Entrance to Major", 18, is_etm=True)
    add_specific(etm, "CMPSC 131")
    add_specific(etm, "CMPSC 132")
    add_specific(etm, "MATH 140")
    add_specific(etm, "MATH 141")
    add_specific(etm, "PHYS 211")

    # ── 2. CORE COMPUTER SCIENCE ──────────────────────────────
    print("\n📋 Core Computer Science:")
    core = add_category("Core Computer Science", 24) # Updated to 24 credits
    add_specific(core, "CMPSC 221")
    add_specific(core, "CMPSC 311")
    add_specific(core, "CMPSC 360")
    add_specific(core, "CMPSC 461")
    add_specific(core, "CMPSC 464")
    add_specific(core, "CMPSC 473")
    add_specific(core, "CMPEN 270")
    add_specific(core, "CMPEN 331")

    # ── 3. MATHEMATICS FOUNDATION ─────────────────────────────
    print("\n📋 Mathematics Foundation:")
    math = add_category("Mathematics Foundation", 7)
    add_specific(math, "MATH 220")
    add_specific(math, "MATH 230")

    # ── 4. SCIENCE REQUIREMENTS ───────────────────────────────
    print("\n📋 Science Requirements:")
    science = add_category("Science Requirements", 8)
    add_specific(science, "PHYS 211")
    add_specific(science, "PHYS 212")

    # ── 5. STATISTICS ─────────────────────────────────────────
    print("\n📋 Statistics Requirement:")
    stats = add_category("Statistics", 3)
    add_group(stats, ["STAT 318", "STAT 319"])

    # ── 6. WRITING & COMMUNICATION ────────────────────────────
    print("\n📋 Writing & Communication:")
    writing = add_category("Writing & Communication", 9)
    add_group(writing, ["ENGL 15", "ENGL 30H"])
    add_group(writing, ["CAS 100A", "CAS 100B"])
    add_specific(writing, "ENGL 202C")

    # ── 7. GEN ED: ARTS (GA) ──────────────────────────────────
    print("\n📋 Gen Ed: Arts (GA):")
    ga = add_category("Gen Ed: Arts (GA)", 3)
    add_pool(ga, "GA")

    # ── 8. GEN ED: HUMANITIES (GH) ────────────────────────────
    print("\n📋 Gen Ed: Humanities (GH):")
    gh = add_category("Gen Ed: Humanities (GH)", 3)
    add_pool(gh, "GH")

    # ── 9. GEN ED: SOCIAL & BEHAVIORAL (GS) ──────────────────
    print("\n📋 Gen Ed: Social & Behavioral Sciences (GS):")
    gs = add_category("Gen Ed: Social & Behavioral Sciences (GS)", 3)
    add_pool(gs, "GS")

    # ── 10. GEN ED: HEALTH & WELLNESS (GHW) ───────────────────
    print("\n📋 Gen Ed: Health & Wellness (GHW):")
    ghw = add_category("Gen Ed: Health & Wellness (GHW)", 3)
    add_pool(ghw, "GHW")

    # ── 11. GEN ED: NATURAL SCIENCES (GN) - Exploration ───────
    print("\n📋 Gen Ed: Natural Sciences (GN) - Exploration:")
    gn = add_category("Gen Ed: Natural Sciences (GN)", 3)
    add_pool(gn, "GN")

    # ── 12. GEN ED: QUANTIFICATION (GQ) ──────────────────────
    print("\n📋 Gen Ed: Quantification (GQ):")
    gq = add_category("Gen Ed: Quantification (GQ)", 6)
    add_pool(gq, "GQ")

    # ── 13. CS ELECTIVES (400-level) ──────────────────────────
    print("\n📋 CS Electives (400+):")
    electives = add_category("CS Electives (400+ level)", 9)
    add_pool(electives, "CMPSC", 400)

    # ── 14. FREE ELECTIVES ────────────────────────────────────
    print("\n📋 Free Electives:")
    free = add_category("Free Electives", 19)
    # No specific rules — any course counts

    # ── 15. INJECT PREREQUISITES FROM FLOWCHART ───────────────
    print("\n📋 Injecting Prerequisites...")
    prereqs = {
        "CMPSC 132": ["CMPSC 131", "MATH 140"],
        "CMPSC 221": ["CMPSC 132"],
        "CMPSC 311": ["CMPSC 221"],
        "CMPSC 360": ["CMPSC 132", "MATH 141"],
        "CMPSC 465": ["CMPSC 311", "CMPSC 360"],
        "CMPSC 473": ["CMPSC 311", "CMPSC 465"],
        "CMPSC 461": ["CMPSC 360"],
        "CMPSC 464": ["CMPSC 461"],
        "CMPEN 270": ["PHYS 211", "MATH 141"],
        "CMPEN 331": ["CMPEN 270", "CMPSC 132"],
        "MATH 141": ["MATH 140"],
        "MATH 220": ["MATH 140"],
        "MATH 230": ["MATH 141"],
        "PHYS 211": ["MATH 140"],
        "PHYS 212": ["MATH 141", "PHYS 211"],
        "STAT 318": ["MATH 141"],
        "STAT 319": ["STAT 318"],
        "ENGL 202C": ["ENGL 15"]
    }
    
    import json
    for code, reqs in prereqs.items():
        course = db.query(Course).filter(Course.code == code).first()
        if course:
            course.prerequisites = json.dumps(reqs)
            db.add(course)

    db.commit()
    
    # ── Summary ───────────────────────────────────────────────
    cat_count = db.query(RequirementCategory).filter(RequirementCategory.track_id == track.id).count()
    rule_count = db.query(DegreeRule).count()
    print(f"\n{'='*50}")
    print(f"🎉 CS B.S. DEGREE FULLY SEEDED")
    print(f"{'='*50}")
    print(f"  📋 Categories: {cat_count}")
    print(f"  📏 Rules:     {rule_count}")
    print(f"  📚 Total Credits: {track.total_credits}")
    print(f"{'='*50}")
    
    db.close()

if __name__ == "__main__":
    seed_full_cs()