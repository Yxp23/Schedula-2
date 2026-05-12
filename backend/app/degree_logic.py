from sqlalchemy.orm import Session
from app.models import DegreeTrack, RequirementType, Course

def generate_audit(db: Session, track_id: int, completed_course_ids: list[int]):
    """
    Calculates degree progress by checking completed courses against track rules.
    Supports SPECIFIC_COURSE, COURSE_GROUP, and CREDIT_POOL rule types.
    """
    track = db.query(DegreeTrack).filter(DegreeTrack.id == track_id).first()
    if not track: 
        return {"error": "Track not found"}

    # Pre-fetch completed courses for efficiency
    completed_courses = []
    for cid in completed_course_ids:
        course = db.query(Course).filter(Course.id == cid).first()
        if course:
            completed_courses.append(course)

    audit = {
        "track_name": track.title,
        "total_credits_required": track.total_credits,
        "total_credits_earned": 0,
        "categories": []
    }

    total_earned = 0
    
    for category in track.categories:
        cat_data = {
            "name": category.name,
            "credits_required": category.credits_required,
            "credits_earned": 0,
            "is_complete": False,
            "rules": []
        }
        
        for rule in category.rules:
            met = False
            details = ""
            course_id = None
            
            # ── SPECIFIC_COURSE: must take this exact course ──
            if rule.rule_type == RequirementType.SPECIFIC_COURSE:
                target = db.query(Course).filter(Course.id == rule.target_course_id).first()
                if target:
                    course_id = target.id
                    details = f"{target.code}: {target.title}"
                    if target.id in completed_course_ids:
                        met = True
                        cat_data["credits_earned"] += target.credits or 3
            
            # ── COURSE_GROUP: must take ONE of these courses ──
            elif rule.rule_type == RequirementType.COURSE_GROUP:
                if rule.alternative_course_ids:
                    alt_ids = [int(x.strip()) for x in rule.alternative_course_ids.split(",") if x.strip()]
                    alt_courses = [db.query(Course).filter(Course.id == aid).first() for aid in alt_ids]
                    alt_courses = [c for c in alt_courses if c is not None]
                    
                    # Build the label: "ENGL 15 or ENGL 30H"
                    details = " or ".join([f"{c.code}: {c.title}" for c in alt_courses])
                    
                    # Check if student took ANY of the alternatives
                    for alt in alt_courses:
                        if alt.id in completed_course_ids:
                            met = True
                            course_id = alt.id
                            cat_data["credits_earned"] += alt.credits or 3
                            break
                    
                    # Provide the first alternative's ID as a suggestion
                    if not met and alt_courses:
                        course_id = alt_courses[0].id

            # ── CREDIT_POOL: take N credits from a department/gen_ed ──
            elif rule.rule_type == RequirementType.CREDIT_POOL:
                pool_dept = rule.pool_department
                pool_min = rule.pool_min_level
                
                # Determine pool label
                gen_ed_codes = ["GA", "GH", "GS", "GN", "GHW", "GQ", "GWS"]
                is_gen_ed_pool = pool_dept in gen_ed_codes
                
                if is_gen_ed_pool:
                    label_map = {
                        "GA": "Arts", "GH": "Humanities", "GS": "Social Sciences",
                        "GN": "Natural Sciences", "GHW": "Health & Wellness",
                        "GQ": "Quantification", "GWS": "Writing/Speaking"
                    }
                    details = f"Any course satisfying {pool_dept} ({label_map.get(pool_dept, '')})"
                    
                    # Check if any completed course has this gen_ed tag
                    pool_credits = 0
                    for cc in completed_courses:
                        if cc.gen_ed and f"({pool_dept})" in cc.gen_ed:
                            pool_credits += cc.credits or 3
                    
                    if pool_credits >= (category.credits_required or 3):
                        met = True
                    cat_data["credits_earned"] += pool_credits
                    
                else:
                    # Department + level pool (e.g., CMPSC 400+)
                    details = f"Any {pool_dept} {pool_min}+ level course"
                    
                    pool_credits = 0
                    for cc in completed_courses:
                        if cc.department == pool_dept:
                            # Extract numeric part from course code
                            try:
                                num = int(''.join(filter(str.isdigit, cc.code.split()[-1])))
                                if pool_min is None or num >= pool_min:
                                    pool_credits += cc.credits or 3
                            except (ValueError, IndexError):
                                pass
                    
                    if pool_credits >= (category.credits_required or 3):
                        met = True
                    cat_data["credits_earned"] += pool_credits

            cat_data["rules"].append({
                "rule_id": rule.id,
                "course_id": course_id,
                "type": rule.rule_type.value,
                "met": met,
                "details": details
            })
        
        # Cap credits earned at credits required
        cat_data["credits_earned"] = min(cat_data["credits_earned"], category.credits_required)
        
        # Check if category is complete
        cat_data["is_complete"] = cat_data["credits_earned"] >= category.credits_required
        
        total_earned += cat_data["credits_earned"]
        audit["categories"].append(cat_data)

    audit["total_credits_earned"] = total_earned
    
    if track.total_credits > 0:
        audit["progress_percentage"] = int((total_earned / track.total_credits) * 100)
    else:
        audit["progress_percentage"] = 0
        
    return audit