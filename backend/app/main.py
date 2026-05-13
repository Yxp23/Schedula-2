"""
Schedula API — FastAPI Backend
All endpoints for courses, professors, search, sections, and degree intelligence.
"""

from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os

from app.database import get_db, create_tables
from app.models import Course, Professor, CourseSection, Review, DegreeTrack
from app.search import parse_query, fuzzy_search_courses
from app.degree_logic import generate_audit  # Import our new logic engine
from app.schedule_generator import generate_schedule_csp
from app.recommendations import get_recommendations
# ── App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Schedula API",
    description="AI-powered course planning for Penn State students",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ──────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    create_tables()


# ── Health ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "app": "Schedula API",
        "version": "2.1.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Degree Intelligence ──────────────────────────────────────────────

@app.get("/api/audit/{track_id}")
def get_degree_audit(
    track_id: int, 
    completed_ids: str = Query("", description="Comma separated list of completed course IDs"),
    db: Session = Depends(get_db)
):
    """
    Analyzes student progress against a degree track.
    Example: /api/audit/1?completed_ids=5,12,45
    """
    # Parse the comma-separated string into a list of integers
    if completed_ids:
        try:
            course_ids = [int(cid.strip()) for cid in completed_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="completed_ids must be a comma-separated list of integers")
    else:
        course_ids = []

    audit_result = generate_audit(db, track_id, course_ids)
    
    if "error" in audit_result:
        raise HTTPException(status_code=404, detail=audit_result["error"])
        
    return audit_result


@app.get("/api/recommendations/{track_id}")
def get_course_recommendations(
    track_id: int,
    completed_ids: str = Query("", description="Comma separated list of completed course IDs"),
    limit: int = Query(8, le=50),
    db: Session = Depends(get_db),
):
    """
    Returns smart course recommendations based on unfulfilled degree requirements.
    Scored by professor rating, seat availability, and requirement priority.
    Example: /api/recommendations/1?completed_ids=5,12,45
    """
    if completed_ids:
        try:
            course_ids = [int(cid.strip()) for cid in completed_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="completed_ids must be a comma-separated list of integers")
    else:
        course_ids = []

    result = get_recommendations(db, track_id, course_ids, limit=limit)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@app.get("/api/generate-schedule")
def generate_schedule(
    track_id: int = Query(1),
    completed_ids: str = Query("", description="Comma separated list of completed course IDs"),
    max_credits: int = Query(16, le=18),
    avoid_mornings: bool = Query(False, description="Filter out classes before 9:00 AM"),
    db: Session = Depends(get_db)
):
    """Generates an optimal, non-conflicting schedule using ML analysis."""
    if completed_ids:
        try:
            course_ids = [int(cid.strip()) for cid in completed_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="completed_ids must be a comma-separated list of integers")
    else:
        course_ids = []

    result = generate_schedule_csp(db, track_id, course_ids, max_credits, avoid_mornings)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result


@app.get("/api/tracks")
def get_degree_tracks(db: Session = Depends(get_db)):
    """Get all available degree tracks (majors)."""
    tracks = db.query(DegreeTrack).all()
    return [{"id": t.id, "title": t.title, "total_credits": t.total_credits} for t in tracks]


# ── Courses ──────────────────────────────────────────────────────────

@app.get("/api/courses")
def get_courses(
    department: Optional[str] = None,
    credits: Optional[int] = None,
    level: Optional[str] = None,      # "100", "200", "300", "400"
    gen_ed: Optional[str] = None,     # "GA", "GH", "GS", etc.
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Get courses with optional filters."""
    query = db.query(Course)

    if department:
        query = query.filter(Course.department == department.upper())
    if credits:
        query = query.filter(Course.credits == credits)
    if gen_ed:
        # e.g., filter by "(GH)"
        query = query.filter(Course.gen_ed.contains(f"({gen_ed.upper()})"))
    if level:
        query = query.filter(Course.code.op("~")(f"\\d{level[0]}\\d{{2}}"))

    total = query.count()
    courses = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "courses": [_course_to_dict(c) for c in courses],
    }


@app.get("/api/courses/{course_id}")
def get_course(course_id: int, db: Session = Depends(get_db)):
    """Get a single course with its sections and professor info."""
    course = (
        db.query(Course)
        .options(
            joinedload(Course.sections).joinedload(CourseSection.professor)
        )
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = _course_to_dict(course)
    result["sections"] = [
        {
            "id": s.id,
            "section_number": s.section_number,
            "semester": s.semester,
            "days": s.days,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "location": s.location,
            "enrollment_current": s.enrollment_current,
            "enrollment_cap": s.enrollment_cap,
            "professor": {
                "id": s.professor.id,
                "name": s.professor.name,
                "rating": s.professor.rmp_rating,
                "difficulty": s.professor.rmp_difficulty,
                "would_take_again": s.professor.rmp_would_take_again,
            } if s.professor else None,
        }
        for s in course.sections
    ]
    return result


# ── Departments ──────────────────────────────────────────────────────

@app.get("/api/departments")
def get_departments(db: Session = Depends(get_db)):
    """Get all departments with course counts."""
    from sqlalchemy import func
    results = (
        db.query(Course.department, func.count(Course.id))
        .group_by(Course.department)
        .order_by(Course.department)
        .all()
    )

    return [
        {"code": dept, "course_count": count}
        for dept, count in results
    ]


# ── Smart Search ─────────────────────────────────────────────────────

@app.get("/api/search")
def search_courses(
    q: str = Query(..., description="Search query"),
    limit: int = Query(default=30, le=100),
    db: Session = Depends(get_db),
):
    """Smart course search with natural language understanding."""
    search_term, filters = parse_query(q)
    all_courses = db.query(Course).all()
    course_dicts = [_course_to_dict(c) for c in all_courses]

    results = fuzzy_search_courses(
        query=search_term,
        courses=course_dicts,
        filters=filters,
        limit=limit,
    )

    for r in results:
        r.pop("_score", None)

    return {
        "query": q,
        "parsed": {"search_term": search_term, "filters": filters},
        "total": len(results),
        "results": results,
    }


# ── Professors ───────────────────────────────────────────────────────

@app.get("/api/professors")
def get_professors(
    department: Optional[str] = None,
    min_rating: Optional[float] = None,
    limit: int = Query(default=150, le=500),
    db: Session = Depends(get_db),
):
    """Get professors with optional filters. Sorted by popularity first."""
    query = db.query(Professor)

    if department:
        query = query.filter(Professor.department == department.upper())
    if min_rating:
        query = query.filter(Professor.rmp_rating >= min_rating)

    # Sort by number of ratings (popularity) so recognizable, real names appear first
    professors = query.order_by(
        Professor.rmp_num_ratings.desc(), 
        Professor.rmp_rating.desc()
    ).limit(limit).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "department": p.department,
            "rating": p.rmp_rating,
            "difficulty": p.rmp_difficulty,
            "would_take_again": p.rmp_would_take_again,
            "num_ratings": p.rmp_num_ratings,
        }
        for p in professors
    ]


@app.get("/api/professors/{professor_id}")
def get_professor(professor_id: int, db: Session = Depends(get_db)):
    """Get a single professor with their sections and reviews."""
    professor = db.query(Professor).filter(Professor.id == professor_id).first()
    if not professor:
        raise HTTPException(status_code=404, detail="Professor not found")

    sections = (
        db.query(CourseSection)
        .options(joinedload(CourseSection.course))
        .filter(CourseSection.professor_id == professor_id)
        .all()
    )

    return {
        "id": professor.id,
        "name": professor.name,
        "department": professor.department,
        "rating": professor.rmp_rating,
        "difficulty": professor.rmp_difficulty,
        "would_take_again": professor.rmp_would_take_again,
        "num_ratings": professor.rmp_num_ratings,
        "courses": list({
            s.course.code for s in sections if s.course
        }),
    }


# ── Sections ─────────────────────────────────────────────────────────

@app.get("/api/courses/{course_id}/sections")
def get_course_sections(course_id: int, db: Session = Depends(get_db)):
    """Get all sections for a specific course."""
    sections = (
        db.query(CourseSection)
        .options(joinedload(CourseSection.professor))
        .filter(CourseSection.course_id == course_id)
        .all()
    )

    return [
        {
            "id": s.id,
            "section_number": s.section_number,
            "semester": s.semester,
            "days": s.days,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "location": s.location,
            "enrollment_current": s.enrollment_current,
            "enrollment_cap": s.enrollment_cap,
            "professor": {
                "id": s.professor.id,
                "name": s.professor.name,
                "rating": s.professor.rmp_rating,
            } if s.professor else None,
        }
        for s in sections
    ]


# ── Stats ────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get platform statistics."""
    return {
        "total_courses": db.query(Course).count(),
        "total_professors": db.query(Professor).count(),
        "total_sections": db.query(CourseSection).count(),
        "total_departments": db.query(Course.department).distinct().count(),
    }


# ── Helpers ──────────────────────────────────────────────────────────

def _course_to_dict(course: Course) -> dict:
    return {
        "id": course.id,
        "code": course.code,
        "title": course.title,
        "description": course.description,
        "credits": course.credits,
        "department": course.department,
        "prerequisites": course.prerequisites,
        "gen_ed": course.gen_ed,
    }