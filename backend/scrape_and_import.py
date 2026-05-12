"""
Schedula Data Pipeline
Scrapes Penn State bulletin + RateMyProfessor, then loads into PostgreSQL.

Usage:
    python scrape_and_import.py                # scrape all departments
    python scrape_and_import.py --depts cmpsc math engl  # specific depts
    python scrape_and_import.py --quick         # top 15 popular depts only
"""

import argparse
import random
import sys
import os

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, create_tables
from app.models import Course, Professor, CourseSection
from app.scrapers.bulletin_scraper import PSUBulletinScraper
from app.scrapers.rmp_scraper import RMPScraper, get_fallback_professors


# Top departments for --quick mode
POPULAR_DEPARTMENTS = [
    "cmpsc", "math", "engl", "phys", "chem", "ist", "econ",
    "stat", "psych", "biol", "plsc", "acctg", "mgmt", "comm", "hist",
]

# Typical section time slots
TIME_SLOTS = [
    ("08:00", "08:50", "MWF"),
    ("09:05", "09:55", "MWF"),
    ("10:10", "11:00", "MWF"),
    ("11:15", "12:05", "MWF"),
    ("12:20", "13:10", "MWF"),
    ("13:25", "14:15", "MWF"),
    ("14:30", "15:20", "MWF"),
    ("15:35", "16:25", "MWF"),
    ("08:00", "09:15", "TR"),
    ("09:45", "11:00", "TR"),
    ("11:15", "12:30", "TR"),
    ("12:45", "14:00", "TR"),
    ("14:15", "15:30", "TR"),
    ("15:45", "17:00", "TR"),
    ("17:30", "18:45", "TR"),
    ("18:00", "18:50", "MWF"),
    ("18:15", "19:30", "MW"),
    ("18:15", "19:30", "TR"),
]

BUILDINGS = [
    "Westgate Building", "IST Building", "Thomas Building",
    "Osmond Laboratory", "Willard Building", "Chambers Building",
    "Henderson Building", "Whitmore Laboratory", "Boucke Building",
    "Sackett Building", "Deike Building", "Hammond Building",
    "Forum Building", "Sparks Building", "Pattee Library",
    "Engineering Unit A", "Engineering Unit B", "Reber Building",
    "Steidle Building", "Pond Laboratory",
]


def import_courses(courses_data: list, db):
    """Insert scraped course data into the database."""

    existing_codes = {c.code for c in db.query(Course.code).all()}
    added = 0

    for c in courses_data:
        code = c.get("code", "").strip()
        if not code or code in existing_codes:
            continue

        course = Course(
            code=code,
            title=c.get("title", "")[:300],
            description=c.get("description", ""),
            credits=c.get("credits", 3),
            department=c.get("department", ""),
            prerequisites=c.get("prerequisites", ""),
            gen_ed=c.get("gen_ed", ""),
        )
        db.add(course)
        existing_codes.add(code)
        added += 1

    db.commit()
    print(f"✅ Imported {added} new courses (skipped {len(courses_data) - added} duplicates)")
    return added


def import_professors(professors_data: list, db):
    """Insert professor data into the database."""

    existing_names = {p.name for p in db.query(Professor.name).all()}
    added = 0

    for p in professors_data:
        name = p.get("name", "").strip()
        if not name or name in existing_names:
            continue

        professor = Professor(
            name=name,
            department=p.get("department", ""),
            rmp_rating=p.get("rating"),
            rmp_difficulty=p.get("difficulty"),
            rmp_would_take_again=p.get("would_take_again"),
            rmp_num_ratings=p.get("num_ratings", 0),
            rmp_id=p.get("rmp_id"),
        )
        db.add(professor)
        existing_names.add(name)
        added += 1

    db.commit()
    print(f"✅ Imported {added} new professors")
    return added


def generate_sections(db):
    """
    Create realistic course sections by assigning professors and time slots.
    Only generates sections for courses that don't have any.
    """
    courses = db.query(Course).all()
    professors = db.query(Professor).all()

    # Group professors by department
    dept_profs = {}
    for p in professors:
        dept_profs.setdefault(p.department, []).append(p)

    # Track courses that already have sections
    courses_with_sections = {
        s.course_id for s in db.query(CourseSection.course_id).distinct().all()
    }

    added = 0
    for course in courses:
        if course.id in courses_with_sections:
            continue

        # Pick 1-3 sections per course
        num_sections = random.choices([1, 2, 3], weights=[0.3, 0.5, 0.2])[0]

        # Pick professor(s) from same department, or random if none match
        available_profs = dept_profs.get(course.department, professors[:10])

        used_slots = set()
        for sec_num in range(1, num_sections + 1):
            # Pick a unique time slot for this course
            slot = random.choice(TIME_SLOTS)
            attempts = 0
            while slot in used_slots and attempts < 10:
                slot = random.choice(TIME_SLOTS)
                attempts += 1
            used_slots.add(slot)

            start_time, end_time, days = slot
            professor = random.choice(available_profs) if available_profs else None
            cap = random.choice([30, 35, 40, 50, 60, 80, 100, 150, 200, 250])
            current = random.randint(int(cap * 0.5), cap)
            building = random.choice(BUILDINGS)
            room = f"{building} {random.randint(100, 499)}"

            section = CourseSection(
                course_id=course.id,
                professor_id=professor.id if professor else None,
                semester="Fall 2025",
                section_number=f"{sec_num:03d}",
                days=days,
                start_time=start_time,
                end_time=end_time,
                location=room,
                enrollment_current=current,
                enrollment_cap=cap,
            )
            db.add(section)
            added += 1

    db.commit()
    print(f"✅ Generated {added} course sections")


def main():
    parser = argparse.ArgumentParser(description="Schedula Data Pipeline")
    parser.add_argument(
        "--depts", nargs="*",
        help="Department slugs to scrape (e.g. cmpsc math engl)",
    )
    parser.add_argument(
        "--quick", action="store_true",
        help=f"Only scrape the top {len(POPULAR_DEPARTMENTS)} departments",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Scrape ALL departments (280+, takes ~5 minutes)",
    )
    parser.add_argument(
        "--skip-rmp", action="store_true",
        help="Skip RateMyProfessor scraping; use fallback data",
    )
    args = parser.parse_args()

    # ── database setup ────────────────────────────────────────
    print("\n🗄️  Setting up database …")
    create_tables()
    db = SessionLocal()

    try:
        # ── scrape courses ────────────────────────────────────
        print("\n📚 Step 1: Scraping Penn State courses …\n")
        scraper = PSUBulletinScraper()

        if args.depts:
            slugs = [{"slug": d, "code": d.upper(), "name": d} for d in args.depts]
        elif args.quick:
            slugs = [{"slug": d, "code": d.upper(), "name": d} for d in POPULAR_DEPARTMENTS]
        elif args.all:
            slugs = None  # scrape_all will fetch the full list
        else:
            # Default to quick mode
            slugs = [{"slug": d, "code": d.upper(), "name": d} for d in POPULAR_DEPARTMENTS]

        courses_data = scraper.scrape_all(slugs)
        import_courses(courses_data, db)

        # ── scrape / import professors ────────────────────────
        print("\n👨‍🏫 Step 2: Getting professor data …\n")

        if args.skip_rmp:
            print("   Using fallback professor data (--skip-rmp)")
            prof_data = get_fallback_professors()
        else:
            rmp = RMPScraper()
            # Try RMP API first
            test = rmp.search_professors(department="Computer Science")
            if test:
                print("   ✅ RMP API is working — fetching live data")
                departments_to_search = [
                    "Computer Science", "Mathematics", "English",
                    "Physics", "Chemistry", "Information Sciences",
                    "Economics", "Statistics", "Psychology",
                    "Biology", "Political Science", "Accounting",
                ]
                prof_data = rmp.scrape_all_departments(departments_to_search)
            else:
                print("   ⚠️  RMP API blocked — using fallback data")
                prof_data = get_fallback_professors()

        import_professors(prof_data, db)

        # ── generate sections ─────────────────────────────────
        print("\n📅 Step 3: Generating course sections …\n")
        generate_sections(db)

        # ── summary ───────────────────────────────────────────
        total_courses = db.query(Course).count()
        total_profs = db.query(Professor).count()
        total_sections = db.query(CourseSection).count()
        total_depts = db.query(Course.department).distinct().count()

        print("\n" + "=" * 50)
        print("🎉 SCHEDULA DATA PIPELINE COMPLETE")
        print("=" * 50)
        print(f"  📚 Courses:     {total_courses}")
        print(f"  👨‍🏫 Professors:  {total_profs}")
        print(f"  📅 Sections:    {total_sections}")
        print(f"  🏛️  Departments: {total_depts}")
        print("=" * 50)

    finally:
        db.close()


if __name__ == "__main__":
    main()
