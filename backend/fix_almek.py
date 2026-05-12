import sys
import random
from app.database import SessionLocal
from app.models import Professor, CourseSection, Course

db = SessionLocal()

print("Correcting Mohamed Almekkawy's data...")

# 1. Find Professor
prof = db.query(Professor).filter(Professor.name.ilike('%Mohamed Almekkawy%')).first()
if not prof:
    print("Mohamed Almekkawy not found.")
    sys.exit(1)

# 2. Find Course CMPEN 331
course = db.query(Course).filter(Course.code == 'CMPEN 331').first()
if not course:
    print("CMPEN 331 not found. Creating it.")
    course = Course(
        code="CMPEN 331",
        title="Computer Organization and Design",
        credits=3.0,
        department="CMPEN"
    )
    db.add(course)
    db.commit()
    db.refresh(course)

# 3. Strip him from random CMPSC classes
bad_secs = db.query(CourseSection).filter(CourseSection.professor_id == prof.id).all()
all_profs = db.query(Professor).filter(Professor.id != prof.id).all()
for sec in bad_secs:
    if getattr(sec.course, 'code', '') != 'CMPEN 331':
        sec.professor_id = random.choice(all_profs).id
db.commit()

# 4. Create explicit sections for CMPEN 331 for him
buildings = ['Willard Building', 'Sackett Building', 'EE West']
for i in range(1, 3):
    new_sec = CourseSection(
        course_id=course.id,
        professor_id=prof.id,
        semester='Fall 2025',
        section_number=f"{i:03d}",
        days="MWF",
        start_time="10:10",
        end_time="11:00",
        location=f"{random.choice(buildings)} {random.randint(100, 300)}",
        enrollment_current=random.randint(50, 100),
        enrollment_cap=120
    )
    db.add(new_sec)

db.commit()
print("Success! Mohamed Almekkawy is now teaching CMPEN 331 exclusively.")
db.close()
