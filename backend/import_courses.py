from app.database import SessionLocal
from app.models import Course
from app.scrapers.psu_scraper import PSUCourseScraper

def import_courses_from_departments(dept_codes):
    """
    Scrape courses from Penn State and save to database
    """
    # Create scraper
    scraper = PSUCourseScraper()
    
    # Scrape courses
    print(f"\n🔍 Scraping courses from {len(dept_codes)} departments...")
    all_courses = scraper.scrape_multiple_departments(dept_codes)
    
    if not all_courses:
        print("❌ No courses found!")
        return
    
    print(f"\n💾 Saving {len(all_courses)} courses to database...")
    
    # Open database session
    db = SessionLocal()
    
    saved_count = 0
    skipped_count = 0
    
    try:
        for course_data in all_courses:
            # Check if course already exists
            existing = db.query(Course).filter(Course.code == course_data['code']).first()
            
            if existing:
                print(f"  ⏭️  Skipping {course_data['code']} (already exists)")
                skipped_count += 1
                continue
            
            # Create new course
            course = Course(
                code=course_data['code'],
                title=course_data['title'],
                description=course_data['description'],
                credits=course_data['credits'],
                department=course_data['department']
            )
            
            db.add(course)
            saved_count += 1
            print(f"  ✅ Saved: {course_data['code']} - {course_data['title']}")
        
        # Commit all changes
        db.commit()
        
        print(f"\n🎉 Success!")
        print(f"  Saved: {saved_count} courses")
        print(f"  Skipped: {skipped_count} courses (already existed)")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

def show_database_stats():
    """Show what's in the database"""
    db = SessionLocal()
    
    try:
        total_courses = db.query(Course).count()
        departments = db.query(Course.department).distinct().all()
        
        print(f"\n📊 Database Stats:")
        print(f"  Total courses: {total_courses}")
        print(f"  Departments: {len(departments)}")
        
        if total_courses > 0:
            print(f"\n📚 Sample courses:")
            sample = db.query(Course).limit(5).all()
            for course in sample:
                print(f"  • {course.code}: {course.title} ({course.credits} credits)")
    
    finally:
        db.close()

if __name__ == "__main__":
    # Departments to scrape (start with a few)
    departments = [
        'C S',     # Computer Science (note the space!)
        'MATH',    # Mathematics
        'ENGL',    # English
    ]
    
    print("🚀 Starting course import...")
    import_courses_from_departments(departments)
    show_database_stats()