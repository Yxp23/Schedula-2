"""
Penn State Bulletin Scraper
Scrapes ALL undergraduate courses from bulletins.psu.edu
"""

import requests
from bs4 import BeautifulSoup
import re
import time
from typing import List, Dict, Optional


class PSUBulletinScraper:
    """Scrape course data from the official Penn State University Bulletin."""

    BASE_URL = "https://bulletins.psu.edu/university-course-descriptions/undergraduate"
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }

    # ── public ──────────────────────────────────────────────────────

    def get_all_department_slugs(self) -> List[Dict[str, str]]:
        """
        Fetch the master index page and return a list of
        { 'name': 'Computer Science', 'code': 'CMPSC', 'slug': 'cmpsc' }
        """
        url = f"{self.BASE_URL}/cmpsc/"  # any dept page has the full sidebar
        print("📋 Fetching department list …")

        resp = self._get(url)
        if resp is None:
            return []

        soup = BeautifulSoup(resp.content, "html.parser")
        departments: List[Dict[str, str]] = []

        # The sidebar <a> tags look like:
        #   /university-course-descriptions/undergraduate/cmpsc/
        # with text like "Computer Science (CMPSC)"
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if "/university-course-descriptions/undergraduate/" not in href:
                continue
            # extract slug
            parts = href.rstrip("/").split("/")
            if len(parts) < 2:
                continue
            slug = parts[-1]
            if slug in ("undergraduate", ""):
                continue

            text = link.get_text(strip=True)
            # parse "Computer Science (CMPSC)"
            m = re.match(r"(.+?)\s*\(([^)]+)\)", text)
            if m:
                name = m.group(1).strip()
                code = m.group(2).strip()
            else:
                name = text
                code = slug.upper()

            # deduplicate
            if not any(d["slug"] == slug for d in departments):
                departments.append({"name": name, "code": code, "slug": slug})

        print(f"   Found {len(departments)} departments")
        return departments

    def scrape_department(self, slug: str, dept_code: str) -> List[Dict]:
        """Scrape every course from one department page."""
        url = f"{self.BASE_URL}/{slug}/"
        print(f"🔍 Scraping {dept_code} ({slug}) …")

        resp = self._get(url)
        if resp is None:
            return []

        soup = BeautifulSoup(resp.content, "html.parser")
        courses: List[Dict] = []

        # Each course lives in a <div class="courseblock">
        blocks = soup.find_all("div", class_="courseblock")

        for block in blocks:
            course = self._parse_course_block(block, dept_code)
            if course:
                courses.append(course)

        print(f"   ✓ {len(courses)} courses from {dept_code}")
        return courses

    def scrape_all(
        self,
        slugs: Optional[List[Dict[str, str]]] = None,
        delay: float = 0.5,
    ) -> List[Dict]:
        """
        Scrape courses from every department.
        Pass *slugs* to limit to a subset; otherwise fetches all.
        """
        if slugs is None:
            slugs = self.get_all_department_slugs()

        all_courses: List[Dict] = []
        for i, dept in enumerate(slugs, 1):
            print(f"\n[{i}/{len(slugs)}]", end=" ")
            courses = self.scrape_department(dept["slug"], dept["code"])
            all_courses.extend(courses)
            time.sleep(delay)  # be polite

        print(f"\n🎉 Total courses scraped: {len(all_courses)}")
        return all_courses

    # ── private helpers ─────────────────────────────────────────────

    def _get(self, url: str) -> Optional[requests.Response]:
        try:
            resp = requests.get(url, headers=self.HEADERS, timeout=15)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            print(f"   ✗ Error fetching {url}: {exc}")
            return None

    def _parse_course_block(self, block, dept_code: str) -> Optional[Dict]:
        """Extract structured data from a single courseblock <div>."""
        try:
            # ── title line ──────────────────────────────────────
            # The title lives in:  <div class="courseblocktitle clearfix">
            #   <div class="course_title clearfix">
            #     <div class="course_codetitle">CMPSC 131: Programming and Computation I: Fundamentals</div>
            #   </div>
            #   <div class="course_credits">3 Credits</div>
            # </div>
            title_div = block.find("div", class_="courseblocktitle")
            if not title_div:
                return None

            # Get the full code:title string
            codetitle_el = title_div.find("div", class_="course_codetitle")
            if not codetitle_el:
                return None
            codetitle_text = codetitle_el.get_text(strip=True)

            # Parse "CMPSC 131: Programming and Computation I: Fundamentals"
            code, title = self._parse_codetitle(codetitle_text)
            if not code:
                return None

            # Get credits
            credits = 3  # default
            credits_el = title_div.find("div", class_="course_credits")
            if credits_el:
                credits_text = credits_el.get_text(strip=True)
                credits = self._parse_credits(credits_text)

            # ── description ─────────────────────────────────────
            # Lives in:  <div class="courseblockmeta">
            #              <div class="courseblockdesc"><p>...</p></div>
            #            </div>
            desc_el = block.find("div", class_="courseblockdesc")
            description = desc_el.get_text(" ", strip=True) if desc_el else ""

            # ── extra lines (prereqs, gen-ed, etc.) ─────────────
            # Lives in: <div class="noindent courseblockextra">
            extra_els = block.find_all("div", class_="courseblockextra")
            prereqs = ""
            gen_ed = ""
            for el in extra_els:
                txt = el.get_text(" ", strip=True)
                if "prerequisite" in txt.lower() or "enforced" in txt.lower():
                    prereqs = txt
                elif "general education" in txt.lower() or "gened" in txt.lower().replace(" ", ""):
                    gen_ed = (gen_ed + " | " + txt).strip(" | ")
                elif "bachelor of arts" in txt.lower():
                    gen_ed = (gen_ed + " | " + txt).strip(" | ")

            return {
                "code": code,
                "title": title[:300],
                "description": description,
                "credits": credits,
                "department": dept_code,
                "prerequisites": prereqs,
                "gen_ed": gen_ed,
            }

        except Exception as exc:
            print(f"   ✗ Parse error: {exc}")
            return None

    @staticmethod
    def _parse_codetitle(text: str):
        """Parse 'CMPSC 131: Programming and Computation I' → ('CMPSC 131', 'Programming and Computation I')."""
        # Clean up unicode
        text = re.sub(r"[\u200b\u00a0\u200e]+", " ", text).strip()
        text = re.sub(r"\u00ad", "-", text)  # soft hyphen → hyphen
        text = re.sub(r"[\u2013\u2014]", "-", text)  # en/em dashes

        # Pattern: "DEPT 123: Title" or "DEPT 123A: Title"
        m = re.match(r"([A-Z][A-Z0-9\-/ ]*?\s*\d+[A-Z]?)\s*:\s*(.+)", text)
        if m:
            code = re.sub(r"\s+", " ", m.group(1).strip())
            title = m.group(2).strip()
            return code, title

        return None, None

    @staticmethod
    def _parse_credits(text: str) -> int:
        """Parse '3 Credits' or '1-9 Credits/Maximum of 9' → int."""
        # Match patterns like "3 Credits", "1-3 Credits", "1-9 Credits/Maximum of 9"
        m = re.search(r"(\d+)(?:\s*-\s*(\d+))?\s*credits?", text, re.IGNORECASE)
        if m:
            if m.group(2):
                return int(m.group(2))  # take max of range
            return int(m.group(1))
        return 3  # default


# ── standalone runner ───────────────────────────────────────────────

def run_scraper(departments: Optional[List[str]] = None):
    """
    Convenience wrapper.
    Pass a list of department slugs, or None for all.
    Returns list of course dicts.
    """
    scraper = PSUBulletinScraper()

    if departments:
        slugs = [{"slug": s, "code": s.upper(), "name": s} for s in departments]
    else:
        slugs = None

    return scraper.scrape_all(slugs)


if __name__ == "__main__":
    # Quick test with 3 departments
    courses = run_scraper(["cmpsc", "math", "engl"])
    print(f"\nSample courses:")
    for c in courses[:5]:
        print(f"  {c['code']}: {c['title']} ({c['credits']}cr)")
