from app.database import SessionLocal
from app.models import Course

def add_sample_courses():
    """Add some sample courses to test with"""
    
    sample_courses = [
        {
            'code': 'CMPSC 131',
            'title': 'Programming and Computation I: Fundamentals',
            'description': 'Introduction to programming using Python. Variables, expressions, statements, functions, recursion, objects, and classes.',
            'credits': 3,
            'department': 'CMPSC'
        },
        {
            'code': 'CMPSC 132',
            'title': 'Programming and Computation II: Data Structures',
            'description': 'Object-oriented programming and data structures in Java. Arrays, linked lists, stacks, queues, trees, and graphs.',
            'credits': 3,
            'department': 'CMPSC'
        },
        {
            'code': 'CMPSC 311',
            'title': 'Introduction to Systems Programming',
            'description': 'Systems programming in C and Unix. File I/O, processes, signals, and inter-process communication.',
            'credits': 3,
            'department': 'CMPSC'
        },
        {
            'code': 'MATH 140',
            'title': 'Calculus with Analytic Geometry I',
            'description': 'Functions, limits, analytic geometry, derivatives, applications of derivatives, integrals.',
            'credits': 4,
            'department': 'MATH'
        },
        {
            'code': 'MATH 141',
            'title': 'Calculus with Analytic Geometry II',
            'description': 'Techniques of integration, applications of the integral, parametric equations, polar coordinates.',
            'credits': 4,
            'department': 'MATH'
        },
        {
            'code': 'ENGL 15',
            'title': 'Rhetoric and Composition',
            'description': 'Instruction and practice in writing clear, coherent, well-organized essays.',
            'credits': 3,
            'department': 'ENGL'
        },
        {
            'code': 'PHYS 211',
            'title': 'General Physics: Mechanics',
            'description': 'Mechanics, wave motion, and sound. Calculus-based physics for science and engineering students.',
            'credits': 4,
            'department': 'PHYS'
        },
        {
            'code': 'CHEM 110',
            'title': 'Chemical Principles I',
            'description': 'Atomic structure, bonding, stoichiometry, solutions, and thermochemistry.',
            'credits': 3,
            'department': 'CHEM'
        },
    ]
    
    db = SessionLocal()
    
    try:
        added = 0
        for course_data in sample_courses:
            # Check if exists
            existing = db.query(Course).filter(Course.code == course_data['code']).first()
            if existing:
                print(f"  ⏭️  {course_data['code']} already exists")
                continue
            
            course = Course(**course_data)
            db.add(course)
            added += 1
            print(f"  ✅ Added: {course_data['code']} - {course_data['title']}")
        
        db.commit()
        print(f"\n🎉 Added {added} sample courses!")
        
        # Show stats
        total = db.query(Course).count()
        print(f"📊 Total courses in database: {total}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("📚 Adding sample courses...\n")
    add_sample_courses()