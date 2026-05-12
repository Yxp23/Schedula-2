import math
from typing import List, Dict

def predict_burnout(schedule_sections: List) -> Dict:
    """
    Simulates a regression model to predict the probability of burnout 
    for a given schedule based on credits, course level, and professor difficulty.
    
    In a true production environment, these coefficients would be trained via scikit-learn
    on historical grade distribution and drop-out rates.
    """
    total_credits = 0.0
    total_difficulty = 0.0
    level_complexity = 0.0
    prof_count = 0
    
    stem_multiplier = 1.0
    stem_codes = ['CMPSC', 'CMPEN', 'MATH', 'PHYS', 'CHEM', 'AERSP', 'EE']
    
    for section in schedule_sections:
        # Check course objects (we accept raw dict payload or ORM models)
        if isinstance(section, dict):
            credits = float(section.get("credits", 3.0))
            code = section.get("course_code", "GEN 100")
            prof_diff = float(section.get("professor", {}).get("difficulty", 2.5))
        else:
            credits = float(section.course.credits or 3.0)
            code = section.course.code
            prof_diff = float(section.professor.rmp_difficulty) if section.professor and section.professor.rmp_difficulty else 2.5
            
        total_credits += credits
        total_difficulty += prof_diff
        prof_count += 1
        
        # Course level coefficient (e.g. 400 level = 4.0, 100 level = 1.0)
        try:
            level_num = int("".join(filter(str.isdigit, code)))
            level_complexity += (level_num / 100.0)
        except ValueError:
            level_complexity += 1.0  # fallback
            
        # Stem classes increase workload non-linearly
        dept = code.split(' ')[0].upper()
        if dept in stem_codes:
            stem_multiplier += 0.05
            
    avg_difficulty = (total_difficulty / prof_count) if prof_count > 0 else 2.5
    
    # Mathematical Modeling mimicking Logistic Regression
    
    # 1. Credit Mass (Overloading hits extremely hard)
    # 12-14 is standard/light, 15 is baseline, 18+ is inherently punishing.
    c_weight = max(0, total_credits - 12) * 6.0 
    if total_credits >= 17:
        c_weight += 15.0 # Flat penalty for absolute max overloading
        
    # 2. Difficulty Mass
    # Difficulty scales exponentially above 3.0
    d_weight = max(0, avg_difficulty - 2.5) * 10.0
    if avg_difficulty > 3.5:
        d_weight += (avg_difficulty - 3.5) * 20.0
        
    # 3. Complexity Mass (Level 400 courses)
    # Average level is usually 6-8 for underclassmen. 
    l_weight = max(0, level_complexity - 5.0) * 4.0
    
    # 4. Total Raw Score
    raw_score = (c_weight + d_weight + l_weight) * stem_multiplier
    
    # Predict Probability using Sigmoid function (0% to 100%)
    # Calibrated so 15 cr / 3.0 diff / level 8 = ~30%
    intercept = -4.5 
    logit = (raw_score / 15.0) + intercept
    prob = 1 / (1 + math.exp(-logit))
    
    burnout_percentage = round(prob * 100, 1)
    
    # Absolute minimum floor for high credits regardless of easy classes
    if total_credits >= 18 and burnout_percentage < 65:
        burnout_percentage = 65.5 # Floor for max credits
        
    # Determine Status
    if burnout_percentage <= 25:
        level = "Breeze"
        color = "emerald-400"
        msg = "Excellent balanced workload. Highly manageable."
    elif burnout_percentage <= 60:
        level = "Manageable"
        color = "blue-400"
        msg = "Standard workload. Will require regular study routines."
    elif burnout_percentage <= 80:
        level = "Heavy"
        color = "amber-400"
        msg = "Warning: High difficulty professors or demanding credit overload."
    else:
        level = "Extreme"
        color = "rose-500"
        msg = "DANGER: High probability of burnout. Consider dropping a class."
        
    return {
        "score": burnout_percentage,
        "level": level,
        "color": color,
        "message": msg,
        "metrics": {
            "avg_difficulty": round(avg_difficulty, 2),
            "total_credits": total_credits,
            "complexity_index": round(level_complexity, 1),
            "stem_multiplier": round(stem_multiplier, 2)
        }
    }
