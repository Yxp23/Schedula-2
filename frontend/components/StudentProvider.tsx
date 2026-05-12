'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────────────

interface CompletedCourse {
  id: number;
  code: string;
}

interface Recommendation {
  course: { id: number; code: string; title: string; credits: number; gen_ed: string; description: string };
  requirement: string;
  requirement_type: string;
  reason: string;
  best_section: any;
  has_open_sections: boolean;
  score: number;
}

export interface AuditRule {
  rule_id: number;
  course_id?: number | null;
  type: string;
  met: boolean;
  details: string;
}

export interface AuditCategory {
  name: string;
  credits_required: number;
  credits_earned: number;
  is_complete: boolean;
  rules: AuditRule[];
}

export interface AuditData {
  track_name: string;
  total_credits_required: number;
  total_credits_earned: number;
  progress_percentage: number;
  categories: AuditCategory[];
}

interface StudentContextType {
  // State
  trackId: number;
  completedCourses: CompletedCourse[];
  audit: AuditData | null;
  recommendations: Recommendation[];
  auditLoading: boolean;
  recsLoading: boolean;

  // Actions
  addCourse: (course: CompletedCourse) => void;
  removeCourse: (courseId: number) => void;
  isCompleted: (courseId: number) => boolean;
  getRequirementForCourse: (courseId: number) => string | null;
}

const StudentContext = createContext<StudentContextType | null>(null);

// ── Hook ─────────────────────────────────────────────────────────────

export function useStudentContext() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudentContext must be used inside <StudentProvider>');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://schedula-2-production.up.railway.app';
const STORAGE_KEY = 'schedula_completed_courses';
const TRACK_ID = 3; // Computer Science, B.S.

// Default courses (seeded for demo)
const DEFAULT_COMPLETED: CompletedCourse[] = [
  { id: 9, code: 'CMPSC 131' },
  { id: 10, code: 'CMPSC 132' },
  { id: 117, code: 'MATH 140' },
];

export function StudentProvider({ children }: { children: ReactNode }) {
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // ── Hydrate from localStorage on mount ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out corrupted entries (missing id or code)
          const valid = parsed.filter((c: any) => c && c.id && c.code);
          setCompletedCourses(valid.length > 0 ? valid : DEFAULT_COMPLETED);
        } else {
          setCompletedCourses(DEFAULT_COMPLETED);
        }
      } else {
        setCompletedCourses(DEFAULT_COMPLETED);
      }
    } catch {
      setCompletedCourses(DEFAULT_COMPLETED);
    }
    setHydrated(true);
  }, []);

  // ── Persist to localStorage whenever completed courses change ──
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedCourses));
  }, [completedCourses, hydrated]);

  // ── Fetch audit data whenever completed courses change ──
  useEffect(() => {
    if (!hydrated) return;
    setAuditLoading(true);
    const idsStr = completedCourses.map(c => c.id).filter(Boolean).join(',');
    const url = `${API_BASE}/api/audit/${TRACK_ID}?completed_ids=${idsStr}`;
    console.log('[StudentProvider] Fetching audit:', url);
    fetch(url)
      .then(r => {
        console.log('[StudentProvider] Audit response status:', r.status);
        return r.json();
      })
      .then(data => {
        console.log('[StudentProvider] Audit data:', data?.track_name, 'categories:', data?.categories?.length);
        if (!data.error && data.categories) setAudit(data);
        else console.warn('[StudentProvider] Audit rejected:', data);
        setAuditLoading(false);
      })
      .catch(err => {
        console.error('[StudentProvider] Audit fetch FAILED:', err);
        setAuditLoading(false);
      });
  }, [completedCourses, hydrated]);

  // ── Fetch recommendations whenever completed courses change ──
  useEffect(() => {
    if (!hydrated) return;
    setRecsLoading(true);
    const idsStr = completedCourses.map(c => c.id).join(',');
    fetch(`${API_BASE}/api/recommendations/${TRACK_ID}?completed_ids=${idsStr}&limit=30`)
      .then(r => r.json())
      .then(data => {
        setRecommendations(data.recommendations || []);
        setRecsLoading(false);
      })
      .catch(() => setRecsLoading(false));
  }, [completedCourses, hydrated]);

  // ── Actions ──

  const addCourse = useCallback((course: CompletedCourse) => {
    setCompletedCourses(prev => {
      if (prev.find(c => c.id === course.id)) return prev;
      return [...prev, course];
    });
  }, []);

  const removeCourse = useCallback((courseId: number) => {
    setCompletedCourses(prev => prev.filter(c => c.id !== courseId));
  }, []);

  const isCompleted = useCallback((courseId: number) => {
    return completedCourses.some(c => c.id === courseId);
  }, [completedCourses]);

  const getRequirementForCourse = useCallback((courseId: number) => {
    const rec = recommendations.find(r => r.course.id === courseId);
    return rec ? rec.requirement : null;
  }, [recommendations]);

  return (
    <StudentContext.Provider value={{
      trackId: TRACK_ID,
      completedCourses,
      audit,
      recommendations,
      auditLoading,
      recsLoading,
      addCourse,
      removeCourse,
      isCompleted,
      getRequirementForCourse,
    }}>
      {children}
    </StudentContext.Provider>
  );
}
