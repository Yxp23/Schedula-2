import datetime
from sqlalchemy.orm import Session
from typing import List, Dict, Optional

from app.models import Course, CourseSection
from app.degree_logic import generate_audit
from app.ml.workload_predictor import predict_burnout

def convert_time(time_str: str) -> int:
    """Converts '09:05' to minutes since midnight for easy comparison."""
    if not time_str or ":" not in time_str:
        return 0
    try:
        parts = time_str.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except:
        return 0

def check_conflict(section1: CourseSection, section2: CourseSection) -> bool:
    """Returns True if there is a time conflict between the two sections."""
    if not section1.days or not section2.days:
        return False
        
    days1 = set(section1.days)
    days2 = set(section2.days)
    if not days1.intersection(days2):
        return False 
        
    s1_start = convert_time(section1.start_time)
    s1_end = convert_time(section1.end_time)
    s2_start = convert_time(section2.start_time)
    s2_end = convert_time(section2.end_time)
    
    return s1_start < s2_end and s2_start < s1_end

def serialize_schedule(db: Session, optimal_schedule: List[CourseSection], workload_prediction: Dict = None) -> Dict:
    serialized = []
    total_credits = 0
    
    for section in optimal_schedule:
        course = db.query(Course).filter(Course.id == section.course_id).first()
        total_credits += course.credits
        
        serialized.append({
            "section_id": section.id,
            "section_number": section.section_number,
            "course_id": course.id,
            "course_code": course.code,
            "course_title": course.title,
            "credits": course.credits,
            "days": section.days,
            "start_time": section.start_time,
            "end_time": section.end_time,
            "location": section.location,
            "professor": {
                "name": section.professor.name if section.professor else "Staff",
                "rating": section.professor.rmp_rating if section.professor else None,
                "difficulty": section.professor.rmp_difficulty if section.professor else 2.5,
            }
        })
        
    # If no prediction injected, generate it
    if not workload_prediction:
        workload_prediction = predict_burnout(serialized)
        
    return {
        "status": "success",
        "total_credits": total_credits,
        "schedule": serialized,
        "workload": workload_prediction
    }

def generate_schedule_csp(
    db: Session, 
    track_id: int, 
    completed_course_ids: List[int], 
    max_credits: int = 16,
    avoid_mornings: bool = False
) -> Dict:
    """
    Generates top conflict-free schedules prioritizing unmet degree rules,
    filtering constraints, and predicting burnout via ML.
    """
    audit = generate_audit(db, track_id, completed_course_ids)
    if "error" in audit:
        return {"error": audit["error"]}
        
    missing_course_ids = []
    for cat in audit.get("categories", []):
        for rule in cat.get("rules", []):
            if not rule["met"] and rule.get("course_id"):
                missing_course_ids.append(rule["course_id"])
                
    if not missing_course_ids:
        return {"error": "No missing courses found. Degree might be complete!"}

    courses_to_schedule = []
    total_credits_targeted = 0
    
    for cid in missing_course_ids:
        course = db.query(Course).filter(Course.id == cid).first()
        if not course: continue
            
        if total_credits_targeted + (course.credits or 3) > max_credits:
            continue
            
        sections = db.query(CourseSection).filter(
            CourseSection.course_id == course.id,
            CourseSection.enrollment_current < CourseSection.enrollment_cap,
            CourseSection.start_time != None,
            CourseSection.end_time != None
        ).all()
        
        # Constraint Filtering
        valid_sections = []
        for s in sections:
            # 8 AMs are defined as starting before 9:00 AM (540 minutes)
            if avoid_mornings and convert_time(s.start_time) < 540:
                continue
            valid_sections.append(s)
        
        # Heuristic sort: Prefer better professors so backtracking branches them first
        valid_sections.sort(key=lambda s: s.professor.rmp_rating if s.professor and s.professor.rmp_rating else 0, reverse=True)
        
        if valid_sections:
            courses_to_schedule.append({
                "course": course,
                "sections": valid_sections
            })
            total_credits_targeted += (course.credits or 3)
            
    if not courses_to_schedule:
        return {"error": "No open sections available that match your constraints (e.g. avoided mornings)."}

    valid_schedules = []
    MAX_SCHEDULES_TO_FIND = 5 # Prevent infinite combinatorial explosion
    
    def backtrack(idx: int, current_schedule: List[CourseSection]):
        if len(valid_schedules) >= MAX_SCHEDULES_TO_FIND:
            return
            
        if idx == len(courses_to_schedule):
            valid_schedules.append(list(current_schedule))
            return
            
        course_data = courses_to_schedule[idx]
        for section in course_data["sections"]:
            conflict = False
            for scheduled in current_schedule:
                if check_conflict(section, scheduled):
                    conflict = True
                    break
            
            if not conflict:
                current_schedule.append(section)
                backtrack(idx + 1, current_schedule)
                current_schedule.pop()
                
    backtrack(0, [])
    
    if not valid_schedules:
        return {"error": "Could not generate any conflict-free schedules under these constraints."}
        
    # ML Optimization Scoring
    # Serialize all schedules and compute ML burnout predictor
    scored_payloads = []
    for sched in valid_schedules:
        payload = serialize_schedule(db, sched)
        # Score fitness: Lower burnout is better. Add a penalty if credits are less than target.
        fitness = 100 - payload["workload"]["score"]
        # Light penalty if the schedule randomly dropped classes
        if payload["total_credits"] < total_credits_targeted:
            fitness -= 30
            
        payload["fitness_score"] = float(fitness)
        scored_payloads.append(payload)
        
    # Return the schedules sorted by best fitness
    scored_payloads.sort(key=lambda x: x["fitness_score"], reverse=True)
    
    # We return heavily nested data: status, multiple schedules
    return {
        "status": "success",
        "results": scored_payloads
    }
