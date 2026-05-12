import sys
import random
from app.database import SessionLocal
from app.models import Professor, CourseSection, Course

db = SessionLocal()

print("Correcting Oren Gall data...")

# 1. Clear out Oren Gall's incorrect classes
gall = db.query(Professor).filter(Professor.name.ilike('%Oren Gall%')).first()
if not gall:
    print("Oren Gall not found.")
    sys.exit(1)

# Re-assign his current classes to someone else randomly (someone who is not him)
profs = db.query(Professor).filter(Professor.id != gall.id).all()
bad_secs = db.query(CourseSection).filter(CourseSection.professor_id == gall.id).all()

for sec in bad_secs:
    sec.professor_id = random.choice(profs).id
db.commit()
print(f"Removed Oren Gall from {len(bad_secs)} unrelated classes.")


# 2. Ensure CMPEN 270 exists and has sections taught by him
cmpen_course = db.query(Course).filter(Course.code == 'CMPEN 270').first()
if not cmpen_course:
    print("CMPEN 270 not found. Creating it.")
    cmpen_course = Course(
        code="CMPEN 270",
        title="Digital Design: Theory and Practice",
        credits=4.0,
        department="CMPEN"
    )
    db.add(cmpen_course)
    db.commit()
    db.refresh(cmpen_course)

# Create some sections for CMPEN 270 taught by Oren Gall!
buildings = ['Willard Building', 'Sackett Building', 'EE West']
for i in range(1, 4):
    new_sec = CourseSection(
        course_id=cmpen_course.id,
        professor_id=gall.id,
        semester='Fall 2025',
        section_number=f"{i:03d}",
        days="TR",
        start_time="09:05",
        end_time="10:20",
        location=f"{random.choice(buildings)} {random.randint(100, 300)}",
        enrollment_current=random.randint(50, 200),
        enrollment_cap=250
    )
    db.add(new_sec)

db.commit()
print(f"Added 3 specific sections of CMPEN 270 for Oren Gall.")
db.close()
