import sys
from app.database import SessionLocal
from app.models import Professor, CourseSection, Course
import random

db = SessionLocal()

print("Re-mapping course sections intelligently to real professors...")

sections = db.query(CourseSection).join(Course).all()
profs = db.query(Professor).all()

# Create a mapping of department -> list of professors
dept_to_profs = {}
for p in profs:
    # RMP departments can be messy ("Mathematics", "Math", "Computer Science", etc.)
    # We will normalize them.
    d_raw = (p.department or "").lower()
    
    # Map RMP department strings back to PSU codes heuristically
    code = "GEN"
    if "comput" in d_raw or "info" in d_raw: code = "CMPSC"
    elif "math" in d_raw: code = "MATH"
    elif "phys" in d_raw: code = "PHYS"
    elif "chem" in d_raw: code = "CHEM"
    elif "eng" in d_raw and "sci" not in d_raw: code = "ENGL"
    elif "econ" in d_raw or "busi" in d_raw: code = "ECON"
    elif "stat" in d_raw: code = "STAT"
    elif "hist" in d_raw: code = "HIST"
    elif "music" in d_raw: code = "MUSIC"
    elif "poli" in d_raw: code = "PLSC"
    elif "psych" in d_raw: code = "PSYCH"
    elif "thea" in d_raw: code = "THEA"
    elif "soc" in d_raw: code = "SOC"
    elif "kines" in d_raw: code = "KINES"
    elif "art" in d_raw: code = "ART"
    
    if code not in dept_to_profs:
        dept_to_profs[code] = []
    dept_to_profs[code].append(p)

    # Let's catch Oren Gall explicitly
    if "Oren Gall" in p.name:
        oren_gall_id = p.id
        print("Found Oren Gall! ID:", oren_gall_id)

gall = db.query(Professor).filter(Professor.name.ilike('%Oren Gall%')).first()
gall_id = gall.id if gall else profs[0].id

assigned = 0
for sec in sections:
    course_dept = getattr(sec.course, 'department', 'GEN').upper()
    
    # If the user specifically mentioned Oren Gall teaching CMPEN 270:
    if getattr(sec.course, 'code', '') == 'CMPEN 270':
        sec.professor_id = gall_id
        assigned += 1
        continue
        
    pool = dept_to_profs.get(course_dept, [])
    
    # If no exact match pool, fall back to a generic pool, or random
    if not pool:
        pool = dept_to_profs.get("CMPSC") or profs
        
    sec.professor_id = random.choice(pool).id
    assigned += 1

db.commit()
print(f"Intelligently mapped {assigned} sections!")
db.close()
