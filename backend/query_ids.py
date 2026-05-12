from app.database import SessionLocal
from app.models import Course

db = SessionLocal()
courses = db.query(Course).filter(Course.code.in_(["CMPSC 131", "CMPSC 132", "MATH 140"])).all()
for c in courses:
    print(f"{c.code}: {c.id}")
