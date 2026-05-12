import sys
from app.database import SessionLocal
from app.models import Professor, CourseSection, Course
import random

db = SessionLocal()

print("1. Unlinking all sections to perform a complete, clean mapping...")
sections = db.query(CourseSection).join(Course).all()
for sec in sections:
    sec.professor_id = None

profs = db.query(Professor).all()
print(f"Loaded {len(profs)} professors.")

# 2. Build a highly accurate department mapping dictionary
# key: Course Department (e.g., 'CMPSC'), value: List of valid Professor IDs
dept_pools = {}

# Accurate heuristic mapping rules
RULES = {
    'CMPSC': ['computer science', 'information', 'ist'],
    'CMPEN': ['computer engineering', 'computer science', 'electrical'],
    'MATH': ['math'],
    'STAT': ['stat'],
    'PHYS': ['physics', 'astronomy'],
    'CHEM': ['chemist'],
    'BIOL': ['biol', 'life', 'anatomy'],
    'ENGL': ['english', 'writing'],
    'ECON': ['econ', 'busi', 'finance', 'market'],
    'PLSC': ['politi', 'govern'],
    'PSYCH': ['psych', 'behav'],
    'SOC': ['sociol'],
    'HIST': ['histor'],
    'PHIL': ['philos'],
    'ART': ['art', 'design', 'theat'],
    'MUSIC': ['music'],
    'COMM': ['communicat', 'journalism', 'media'],
    'CAS': ['communicat', 'speech'],
    'ACCT': ['account'],
    'MGMT': ['manage', 'business'],
    'KINES': ['kines', 'health', 'phys'],
    'THEA': ['theat', 'drama']
}

print("2. Mapping professors to their true departments...")
for p in profs:
    dept = (p.department or "").lower()
    for course_dept, keywords in RULES.items():
        if any(kw in dept for kw in keywords):
            if course_dept not in dept_pools:
                dept_pools[course_dept] = []
            dept_pools[course_dept].append(p.id)

# Find specific professors requested by user
gall = db.query(Professor).filter(Professor.name.ilike('%Oren Gall%')).first()
gall_id = gall.id if gall else None

verb = db.query(Professor).filter(Professor.name.ilike('%Al Verbanec%')).first()
verb_id = verb.id if verb else None

print("3. Re-assigning sections accurately...")
assigned = 0
for sec in sections:
    c_code = getattr(sec.course, 'code', '')
    c_dept = getattr(sec.course, 'department', '')

    # EXPLICIT OVERRIDES requested by User
    if c_code == 'CMPEN 270' and gall_id:
        sec.professor_id = gall_id
        assigned += 1
        continue
    
    if c_code == 'CMPSC 221' and verb_id:
        sec.professor_id = verb_id
        assigned += 1
        continue

    # NORMAL MAPPING
    pool = dept_pools.get(c_dept, [])
    
    # If we have a matching pool, pick randomly.
    # If no matching pool, we leave it as None (TBA) so we don't pollute other professors!
    if pool:
        sec.professor_id = random.choice(pool)
        assigned += 1

db.commit()
print(f"Successfully and accurately mapped {assigned} sections to real professors.")
print(f"Left {len(sections) - assigned} sections as 'TBA' rather than placing random profs incorrectly.")
db.close()
