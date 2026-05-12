import requests
from bs4 import BeautifulSoup
import time
from typing import List, Dict

class PSUCourseScraper:
    def __init__(self):
        # Updated URL structure
        self.base_url = "https://bulletin.psu.edu/undergraduate/courses"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    
    def scrape_department(self, dept_code: str) -> List[Dict]:
        """
        Scrape courses for a specific department
        dept_code examples: 'C S', 'MATH', 'ENGL'
        """
        # Penn State uses different format: /C%20S/ for Computer Science
        url_code = dept_code.replace(' ', '%20')
        url = f"{self.base_url}/{url_code}/"
        
        print(f"Scraping {dept_code} courses from {url}")
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error fetching {url}: {e}")
            return []
        
        soup = BeautifulSoup(response.content, 'html.parser')
        courses = []
        
        # Find all course blocks
        course_blocks = soup.find_all('div', class_='courseblock')
        
        if not course_blocks:
            print(f"  No course blocks found. Checking page structure...")
            # Try alternative selectors
            course_blocks = soup.find_all('div', {'class': lambda x: x and 'course' in x.lower()})
        
        for block in course_blocks:
            try:
                # Look for course title - try multiple selectors
                title_elem = (block.find('p', class_='courseblocktitle') or 
                            block.find('span', class_='courseblockcode') or
                            block.find('strong'))
                
                if not title_elem:
                    continue
                
                title_text = title_elem.get_text(strip=True)
                
                # Parse course code and title
                # Format could be: "CMPSC 132: Programming..." or "C S 132 Programming..."
                if ':' in title_text:
                    parts = title_text.split(':', 1)
                    code = parts[0].strip()
                    title = parts[1].strip() if len(parts) > 1 else "No title"
                else:
                    # Try to extract code from first few words
                    words = title_text.split()
                    if len(words) >= 2:
                        code = f"{words[0]} {words[1]}"
                        title = ' '.join(words[2:]) if len(words) > 2 else "No title"
                    else:
                        continue
                
                # Extract credits
                credits = 3  # default
                credits_elem = block.find('span', class_='courseblockcredits')
                if credits_elem:
                    credits_text = credits_elem.get_text(strip=True)
                    try:
                        # Parse "3 Credits" or "1-3 Credits"
                        credit_num = credits_text.split()[0]
                        if '-' in credit_num:
                            credit_num = credit_num.split('-')[-1]
                        credits = int(credit_num)
                    except:
                        credits = 3
                
                # Extract description
                desc_elem = block.find('p', class_='courseblockdesc')
                description = desc_elem.get_text(strip=True) if desc_elem else ""
                
                course_data = {
                    'code': code,
                    'title': title[:200],  # Limit title length
                    'description': description,
                    'credits': credits,
                    'department': dept_code
                }
                
                courses.append(course_data)
                print(f"  ✓ Found: {code} - {title[:50]}")
                
            except Exception as e:
                print(f"  ✗ Error parsing course block: {e}")
                continue
        
        print(f"Scraped {len(courses)} courses from {dept_code}")
        time.sleep(1)  # Be nice to the server
        
        return courses
    
    def scrape_multiple_departments(self, dept_codes: List[str]) -> List[Dict]:
        """Scrape courses from multiple departments"""
        all_courses = []
        
        for dept in dept_codes:
            courses = self.scrape_department(dept)
            all_courses.extend(courses)
        
        return all_courses


# Test function
def test_scraper():
    scraper = PSUCourseScraper()
    
    # Test with Computer Science (C S format)
    print("Testing scraper with C S department...")
    courses = scraper.scrape_department('C S')
    
    if courses:
        print(f"\n✅ Successfully scraped {len(courses)} courses!")
        print("\nFirst 3 courses:")
        for course in courses[:3]:
            print(f"  {course['code']}: {course['title']}")
    else:
        print("\n❌ No courses found. Trying alternative URL...")
        # Try the web address directly
        test_url = "https://bulletin.psu.edu/undergraduate/courses/C%20S/"
        print(f"Visit this URL in browser: {test_url}")

if __name__ == "__main__":
    test_scraper()