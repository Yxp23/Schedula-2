"""
Smart Search Engine for Schedula
Combines fuzzy matching with natural-language query parsing.
"""

import re
from typing import List, Dict, Optional, Tuple
from fuzzywuzzy import fuzz, process


# ── Query Intent Parser ─────────────────────────────────────────────

# Maps natural language keywords → filter actions
KEYWORD_MAP = {
    # Difficulty / ease
    "easy": {"difficulty_max": 2.5, "rating_min": 3.5},
    "hard": {"difficulty_min": 3.5},
    "challenging": {"difficulty_min": 4.0},
    "chill": {"difficulty_max": 2.0, "rating_min": 3.5},
    # Course level
    "intro": {"level_max": 200},
    "introductory": {"level_max": 200},
    "beginner": {"level_max": 200},
    "advanced": {"level_min": 400},
    "upper level": {"level_min": 300},
    # Schedule preferences
    "morning": {"time_before": "12:00"},
    "afternoon": {"time_after": "12:00", "time_before": "17:00"},
    "evening": {"time_after": "17:00"},
    "mwf": {"days": "MWF"},
    "tr": {"days": "TR"},
    "tuesday thursday": {"days": "TR"},
    "monday wednesday friday": {"days": "MWF"},
    # Credits
    "1 credit": {"credits": 1},
    "2 credits": {"credits": 2},
    "3 credits": {"credits": 3},
    "4 credits": {"credits": 4},
    # Gen-ed
    "gen ed": {"gen_ed": True},
    "general education": {"gen_ed": True},
    "gened": {"gen_ed": True},
    "quantification": {"gen_ed_cat": "quantification"},
    "humanities": {"gen_ed_cat": "humanities"},
    "social science": {"gen_ed_cat": "social"},
    "natural science": {"gen_ed_cat": "natural"},
    "arts": {"gen_ed_cat": "arts"},
    "writing": {"gen_ed_cat": "writing"},
    # Department shortcuts
    "cs": {"department": "CMPSC"},
    "computer science": {"department": "CMPSC"},
    "compsci": {"department": "CMPSC"},
    "math": {"department": "MATH"},
    "english": {"department": "ENGL"},
    "physics": {"department": "PHYS"},
    "chemistry": {"department": "CHEM"},
    "chem": {"department": "CHEM"},
    "bio": {"department": "BIOL"},
    "biology": {"department": "BIOL"},
    "econ": {"department": "ECON"},
    "economics": {"department": "ECON"},
    "psych": {"department": "PSYCH"},
    "psychology": {"department": "PSYCH"},
    "stats": {"department": "STAT"},
    "statistics": {"department": "STAT"},
    "polisci": {"department": "PLSC"},
    "political science": {"department": "PLSC"},
    "engineering": {"department": "ENGR"},
    "accounting": {"department": "ACCTG"},
}


def parse_query(query: str) -> Tuple[str, Dict]:
    """
    Parse a natural-language query into a cleaned search term and filters.

    Examples:
        "easy intro CS" → ("", {department: CMPSC, level_max: 200, difficulty_max: 2.5})
        "CMPSC 132"    → ("CMPSC 132", {})
        "morning MWF"  → ("", {time_before: 12:00, days: MWF})
    """
    query_lower = query.lower().strip()
    filters: Dict = {}
    remaining_words: List[str] = []

    # Check for exact course code (e.g. "CMPSC 132")
    code_match = re.match(r"^([A-Za-z]{2,6})\s*(\d{3}[A-Z]?)$", query.strip())
    if code_match:
        return f"{code_match.group(1).upper()} {code_match.group(2)}", {}

    # Check multi-word keywords first (sorted by length, longest first)
    matched_keywords = set()
    for keyword in sorted(KEYWORD_MAP.keys(), key=len, reverse=True):
        if keyword in query_lower and keyword not in matched_keywords:
            filters.update(KEYWORD_MAP[keyword])
            matched_keywords.add(keyword)
            # Remove the keyword from the query
            query_lower = query_lower.replace(keyword, " ")

    # Whatever remains is a free-text search term
    remaining = re.sub(r"\s+", " ", query_lower).strip()

    return remaining, filters


# ── Fuzzy Search ─────────────────────────────────────────────────────

def fuzzy_search_courses(
    query: str,
    courses: List[Dict],
    filters: Optional[Dict] = None,
    limit: int = 50,
    threshold: int = 35,
) -> List[Dict]:
    """
    Search courses using fuzzy matching + filters.

    Parameters
    ----------
    query : str
        Free-text search query (after keyword parsing).
    courses : list[dict]
        Each dict should have: code, title, description, department, credits, etc.
    filters : dict or None
        Parsed filter constraints from parse_query().
    limit : int
        Max results to return.
    threshold : int
        Minimum score (0-100) for fuzzy matches.

    Returns
    -------
    list[dict]
        Courses sorted by relevance score.
    """
    filters = filters or {}
    results: List[Dict] = []

    for course in courses:
        # ── Apply hard filters ──────────────────────────────
        if not _apply_filters(course, filters):
            continue

        # ── Calculate relevance score ──────────────────────
        score = _score_course(query, course) if query else 70  # no query = browsing with filters

        if score >= threshold:
            results.append({**course, "_score": score})

    # Sort by score descending
    results.sort(key=lambda x: x["_score"], reverse=True)
    return results[:limit]


def _apply_filters(course: Dict, filters: Dict) -> bool:
    """Return False if the course should be excluded by filters."""

    # Department filter
    if "department" in filters:
        if course.get("department", "").upper() != filters["department"]:
            return False

    # Course level filter
    course_num = _extract_course_number(course.get("code", ""))
    if "level_min" in filters and course_num < filters["level_min"]:
        return False
    if "level_max" in filters and course_num >= filters["level_max"]:
        return False

    # Credits filter
    if "credits" in filters:
        if course.get("credits") != filters["credits"]:
            return False

    # Gen-ed filter
    if "gen_ed" in filters and filters["gen_ed"]:
        if not course.get("gen_ed"):
            return False

    return True


def _score_course(query: str, course: Dict) -> int:
    """
    Score a course's relevance to the query.
    Uses weighted combination of code match, title match, and description match.
    """
    if not query:
        return 70

    code = course.get("code", "")
    title = course.get("title", "")
    description = course.get("description", "")[:300]

    # Exact code match is the highest signal
    code_score = fuzz.ratio(query.upper(), code.upper())

    # Partial ratio is good for substring matches in titles
    title_score = fuzz.partial_ratio(query.lower(), title.lower())

    # Token sort handles word-order differences
    title_token_score = fuzz.token_sort_ratio(query.lower(), title.lower())

    # Description is a weaker signal
    desc_score = fuzz.partial_ratio(query.lower(), description.lower())

    # Weighted combination
    final = (
        code_score * 0.40
        + max(title_score, title_token_score) * 0.40
        + desc_score * 0.20
    )

    # Bonus for exact code prefix match (e.g., "CMPSC 1" matches "CMPSC 131")
    if code.upper().startswith(query.upper()):
        final = min(final + 25, 100)

    return int(final)


def _extract_course_number(code: str) -> int:
    """Extract the numeric part from a course code like 'CMPSC 132' → 132."""
    m = re.search(r"(\d+)", code)
    return int(m.group(1)) if m else 0
