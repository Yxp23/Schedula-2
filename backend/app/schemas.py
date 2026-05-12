from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ProfessorBase(BaseModel):
    name: str
    department: Optional[str] = None
    rmp_rating: Optional[float] = None
    rmp_difficulty: Optional[float] = None
    rmp_would_take_again: Optional[float] = None
    rmp_num_ratings: Optional[int] = 0
    rmp_id: Optional[str] = None

class ProfessorCreate(ProfessorBase):
    pass

class Professor(ProfessorBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True # Allows Pydantic to work with SQLAlchemy models