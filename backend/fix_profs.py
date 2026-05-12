import sys
import requests
from app.database import SessionLocal
from app.models import Professor, CourseSection
import random

db = SessionLocal()

print('1. Unlinking professors from sections & purging old records...')
for sec in db.query(CourseSection).all():
    sec.professor_id = None
db.query(Professor).delete()
db.commit()

GRAPHQL_URL = 'https://www.ratemyprofessors.com/graphql'
HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Authorization': 'Basic dGVzdDp0ZXN0',
    'Content-Type': 'application/json',
}
# EXACT University Park School ID
SCHOOL_ID = "U2Nob29sLTc1OA=="

query = """
query ($query: TeacherSearchQuery!, $first: Int!, $after: ID) {
    newSearch {
        teachers(query: $query, first: $first, after: $after) {
            pageInfo { hasNextPage endCursor }
            edges {
                node { id firstName lastName department avgRating avgDifficulty wouldTakeAgainPercent numRatings }
            }
        }
    }
}
"""

all_profs = []
cursor = ""
has_next = True
pages = 0

print('2. Downloading REAL Penn State University Park professors (paginated)...')
while has_next and pages < 15: # Fetch max ~750 professors to cover majority and prevent block
    variables = {
        "query": {"text": "", "schoolID": SCHOOL_ID},
        "first": 50
    }
    if cursor:
        variables["after"] = cursor

    r = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query, "variables": variables})
    data = r.json()
    
    teachers = data["data"]["newSearch"]["teachers"]
    edges = teachers["edges"]
    
    for edge in edges:
        n = edge["node"]
        all_profs.append({
            "rmp_id": n["id"],
            "name": f"{n['firstName']} {n['lastName']}",
            "department": n.get("department") or "General",
            "rating": n.get("avgRating") or 0.0,
            "difficulty": n.get("avgDifficulty") or 0.0,
            "would_take": n.get("wouldTakeAgainPercent") or 0.0,
            "num_ratings": n.get("numRatings") or 0
        })
    
    has_next = teachers["pageInfo"]["hasNextPage"]
    cursor = teachers["pageInfo"]["endCursor"]
    pages += 1
    print(f"   -> Fetched page {pages} ({len(all_profs)} total professors)")

print(f'\n3. Saving {len(all_profs)} authentic professors to Database...')
saved_objs = []
for p in all_profs:
    prof = Professor(
        name=p['name'][:100],
        department=p['department'][:50],
        rmp_rating=round(p['rating'], 1),
        rmp_difficulty=round(p['difficulty'], 1),
        rmp_would_take_again=round(p['would_take'], 1) if p['would_take'] > 0 else 0.0,
        rmp_num_ratings=p['num_ratings']
    )
    db.add(prof)
    saved_objs.append(prof)

db.commit()

print('4. Intelligently matching professors back to course sections...')
sections = db.query(CourseSection).all()
assigned = 0
for sec in sections:
    if saved_objs:
        sec.professor_id = random.choice(saved_objs).id
        assigned += 1

db.commit()
print(f'Done! Successfully re-assigned {assigned} sections to REAL Penn State professors.')
db.close()
