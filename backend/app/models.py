from sqlalchemy import Column, Integer, String, Float, Text, Boolean, ForeignKey, DateTime, Time, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


# ─── EXISTING MODELS ─────────────────────────────────────────────

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)       # e.g. "CMPSC 132"
    title = Column(String(300), nullable=False)
    description = Column(Text)
    credits = Column(Integer)
    department = Column(String(20), index=True)
    prerequisites = Column(Text)                                              # raw prerequisite string from bulletin
    gen_ed = Column(Text)                                                     # gen-ed categories
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sections = relationship("CourseSection", back_populates="course", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="course", cascade="all, delete-orphan")


class Professor(Base):
    __tablename__ = "professors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    department = Column(String(100))
    rmp_rating = Column(Float)              # RateMyProfessor overall quality (0-5)
    rmp_difficulty = Column(Float)          # Difficulty rating (0-5)
    rmp_would_take_again = Column(Float)    # Percentage
    rmp_num_ratings = Column(Integer, default=0)
    rmp_id = Column(String(50))             # RMP internal ID for linking
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sections = relationship("CourseSection", back_populates="professor")
    reviews = relationship("Review", back_populates="professor")


class CourseSection(Base):
    __tablename__ = "course_sections"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    professor_id = Column(Integer, ForeignKey("professors.id"))
    semester = Column(String(20))           # e.g. "Fall 2025"
    section_number = Column(String(10))
    days = Column(String(10))               # e.g. "MWF", "TR"
    start_time = Column(String(10))         # e.g. "09:05"
    end_time = Column(String(10))           # e.g. "09:55"
    location = Column(String(200))
    enrollment_current = Column(Integer, default=0)
    enrollment_cap = Column(Integer)
    waitlist_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="sections")
    professor = relationship("Professor", back_populates="sections")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    professor_id = Column(Integer, ForeignKey("professors.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    rating = Column(Float)                  # 1-5
    difficulty = Column(Float)              # 1-5
    would_take_again = Column(Boolean)
    review_text = Column(Text)
    grade_received = Column(String(5))
    sentiment = Column(String(20))          # 'positive', 'negative', 'neutral'
    sentiment_confidence = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    professor = relationship("Professor", back_populates="reviews")
    course = relationship("Course", back_populates="reviews")


# ─── NEW DEGREE INTELLIGENCE MODELS ────────────────────────────────

class RequirementType(enum.Enum):
    SPECIFIC_COURSE = "specific_course"     # Must take CMPSC 473
    COURSE_GROUP = "course_group"           # Must take 1 of [STAT 318, STAT 319]
    CREDIT_POOL = "credit_pool"             # Must take 6 credits of CMPSC 400+ level

class DegreeTrack(Base):
    __tablename__ = "degree_tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), unique=True, index=True) # e.g., "Computer Science, B.S. (University Park)"
    total_credits = Column(Integer, default=127)
    
    categories = relationship("RequirementCategory", back_populates="track", cascade="all, delete-orphan")

class RequirementCategory(Base):
    """
    Groups requirements logically. 
    Examples: "Entrance to Major", "Core CMPSC Courses", "Gen Ed: Arts (GA)"
    """
    __tablename__ = "requirement_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("degree_tracks.id"))
    name = Column(String(200))
    credits_required = Column(Integer)
    is_entrance_to_major = Column(Boolean, default=False)
    
    track = relationship("DegreeTrack", back_populates="categories")
    rules = relationship("DegreeRule", back_populates="category", cascade="all, delete-orphan")

class DegreeRule(Base):
    """
    The actual logic node. 
    """
    __tablename__ = "degree_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("requirement_categories.id"))
    rule_type = Column(Enum(RequirementType))
    
    # For SPECIFIC_COURSE
    target_course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    
    # For COURSE_GROUP (comma separated IDs of alternatives, e.g., "12, 14")
    alternative_course_ids = Column(String(200), nullable=True) 
    
    # For CREDIT_POOL (e.g., department="CMPSC", min_level=400)
    pool_department = Column(String(20), nullable=True)
    pool_min_level = Column(Integer, nullable=True)
    
    category = relationship("RequirementCategory", back_populates="rules")
    target_course = relationship("Course", foreign_keys=[target_course_id])