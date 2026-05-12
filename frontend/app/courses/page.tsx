'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ProfessorList from '@/components/ProfessorList';
import { useStudentContext } from '@/components/StudentProvider';

// ── Types ──────────────────────────────────────────────────────────

interface Course {
  id: number;
  code: string;
  title: string;
  description: string;
  credits: number;
  department: string;
  prerequisites: string;
  gen_ed: string;
}

interface Department {
  code: string;
  course_count: number;
}

// ── Animation Wrappers ─────────────────────────────────────────────

const FadeUp = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div ref={ref} className={className} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
};

// ── Types for sections ─────────────────────────────────────────────

interface Section {
  id: number;
  section_number: string;
  semester: string;
  days: string;
  start_time: string;
  end_time: string;
  location: string;
  enrollment_current: number;
  enrollment_cap: number;
  professor: {
    id: number;
    name: string;
    rating: number;
  } | null;
}

// ── Star Rating ────────────────────────────────────────────────────

const StarRating = ({ rating }: { rating: number }) => {
  const color = rating >= 4.0 ? 'text-emerald-400/70' : rating >= 3.0 ? 'text-amber-400/70' : 'text-red-400/70';
  return (
    <span className={`text-xs font-medium ${color}`}>
      ★ {rating?.toFixed(1) || '—'}
    </span>
  );
};

// ── Course Card ────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const CourseCard = ({ course, index }: { course: Course; index: number }) => {
  const { isCompleted, getRequirementForCourse, addCourse } = useStudentContext();
  const [expanded, setExpanded] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadedSections, setLoadedSections] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  const completed = isCompleted(course.id);
  const fillsRequirement = getRequirementForCourse(course.id);

  // Fetch sections + professor data on first expand
  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loadedSections) {
      fetch(`${API_BASE}/api/courses/${course.id}/sections`)
        .then(r => r.json())
        .then(data => { setSections(data || []); setLoadedSections(true); })
        .catch(() => setLoadedSections(true));
    }
  };

  // Get unique professors from sections
  const professors = loadedSections
    ? Array.from(new Map(
      sections.filter(s => s.professor).map(s => [s.professor!.id, s.professor!])
    ).values())
    : [];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
      onClick={handleExpand}
      className={`group cursor-pointer border-b border-black/5 dark:border-white/[0.06] hover:border-black/20 dark:hover:border-white/[0.15] transition-all duration-500 ${completed ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-6 md:py-8 gap-4">
        {/* Left: Code & Title */}
        <div className="flex items-start gap-5 md:gap-8 flex-1 min-w-0">
          <span className="text-[11px] font-mono text-neutral-400 dark:text-white/25 mt-1.5 tabular-nums whitespace-nowrap shrink-0">
            {course.code.split(' ')[1] || '—'}
          </span>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`text-xl md:text-2xl font-light tracking-tight group-hover:text-black dark:group-hover:text-white transition-colors duration-500 truncate ${completed ? 'line-through text-neutral-400 dark:text-white/40' : 'text-black dark:text-white/85'}`}>
                {course.title}
              </h3>
              {completed && (
                <span className="shrink-0 text-[9px] uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-600/30 dark:border-emerald-400/20 bg-emerald-500/10 dark:bg-emerald-400/10">
                  ✓ Completed
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 dark:text-white/30 font-medium">
                {course.code}
              </span>
              {course.gen_ed && (
                <span className="text-[9px] uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400/60 font-medium px-2 py-0.5 rounded-full border border-emerald-600/30 dark:border-emerald-400/20">
                  Gen Ed
                </span>
              )}
              {fillsRequirement && !completed && (
                <span className="text-[9px] uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded-full border border-amber-500/30 dark:border-amber-400/20 bg-amber-500/10 dark:bg-amber-400/10">
                  ✦ Fills {fillsRequirement}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Credits & Arrow */}
        <div className="flex items-center gap-6 shrink-0">
          <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-600 dark:text-white/35 font-medium">
            {course.credits} {course.credits === 1 ? 'credit' : 'credits'}
          </span>
          <motion.svg
            animate={{ rotate: expanded ? 45 : 0 }}
            transition={{ duration: 0.3 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            className="text-neutral-400 dark:text-white/20 group-hover:text-black dark:group-hover:text-white/50 transition-colors"
          >
            <path d="M12 5v14M5 12h14" />
          </motion.svg>
        </div>
      </div>

      {/* Expandable Detail Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-8 pl-12 md:pl-20 pr-4 space-y-5">
              {/* Description */}
              {course.description && (
                <p className="text-sm text-neutral-600 dark:text-white/45 leading-relaxed max-w-2xl font-light">
                  {course.description.slice(0, 300)}{course.description.length > 300 ? '…' : ''}
                </p>
              )}

              {/* Prerequisites */}
              {course.prerequisites && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400/50 font-medium mt-0.5 shrink-0">Prereqs</span>
                  <span className="text-xs text-neutral-500 dark:text-white/35 font-light leading-relaxed">
                    {course.prerequisites.slice(0, 200)}
                  </span>
                </div>
              )}

              {/* Professors */}
              {professors.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 dark:text-white/30 font-medium block">Professors</span>
                  <div className="flex flex-wrap gap-3">
                    {professors.map(prof => (
                      <div key={prof.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                        <span className="text-sm text-neutral-800 dark:text-white/70 font-light">{prof.name}</span>
                        <StarRating rating={prof.rating} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sections */}
              {sections.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 dark:text-white/30 font-medium block">Sections — {sections[0]?.semester}</span>
                  <div className="grid gap-2">
                    {sections.slice(0, 5).map(sec => (
                      <div key={sec.id} className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/[0.03] border border-black/5 dark:border-white/[0.05] text-xs">
                        <div className="flex items-center gap-4">
                          <span className="text-neutral-500 dark:text-white/50 font-mono w-8">#{sec.section_number}</span>
                          <span className="text-neutral-600 dark:text-white/60 font-medium w-10">{sec.days}</span>
                          <span className="text-neutral-400 dark:text-white/40">{sec.start_time}–{sec.end_time}</span>
                          {sec.professor && <span className="text-neutral-500 dark:text-white/50">{sec.professor.name}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-neutral-400 dark:text-white/30">{sec.enrollment_current}/{sec.enrollment_cap}</span>
                          <span className={`text-[9px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${sec.enrollment_current >= sec.enrollment_cap
                              ? 'text-red-500 dark:text-red-400/70 bg-red-500/10 border border-red-500/20'
                              : 'text-emerald-600 dark:text-emerald-400/60 bg-emerald-500/10 border border-emerald-500/15'
                            }`}>
                            {sec.enrollment_current >= sec.enrollment_cap ? 'Full' : 'Open'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <Link
                  href={`/schedule?add=${course.code}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/[0.08] text-[11px] uppercase tracking-[0.15em] text-neutral-600 dark:text-white/60 font-medium hover:bg-black/10 dark:hover:bg-white/[0.12] hover:text-black dark:hover:text-white/90 transition-all duration-300"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                  Add to Schedule
                </Link>
                {!completed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); addCourse({ id: course.id, code: course.code }); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20 text-[11px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400 font-medium hover:bg-emerald-500/20 dark:hover:bg-emerald-400/20 transition-all duration-300"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    Mark Completed
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedGenEd, setSelectedGenEd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [stats, setStats] = useState({ total_courses: 0, total_professors: 0, total_departments: 0 });
  const [viewMode, setViewMode] = useState<'courses' | 'professors'>('courses'); // Toggle state

  const GEN_ED_CATEGORIES = [
    { code: 'GA', name: 'Arts' },
    { code: 'GH', name: 'Humanities' },
    { code: 'GS', name: 'Social Sciences' },
    { code: 'GN', name: 'Natural Sciences' },
    { code: 'GHW', name: 'Health & Wellness' },
    { code: 'GQ', name: 'Quantification' },
    { code: 'GWS', name: 'Writing/Speaking' }
  ];

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/courses?limit=100`).then(r => r.json()).catch(() => ({ courses: [] })),
      fetch(`${API_BASE}/api/departments`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/stats`).then(r => r.json()).catch(() => ({})),
    ]).then(([coursesData, deptsData, statsData]) => {
      setCourses(coursesData.courses || []);
      setDepartments(deptsData || []);
      setStats(statsData);
      setLoading(false);
    });
  }, []);

  // Fetch Filtered Courses
  const fetchFilteredCourses = useCallback((dept: string | null, genEd: string | null) => {
    setLoading(true);
    let url = `${API_BASE}/api/courses?limit=200`;
    if (dept) url += `&department=${dept}`;
    if (genEd) url += `&gen_ed=${genEd}`;
    
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setCourses(data.courses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Debounced smart search
  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchFilteredCourses(selectedDept, selectedGenEd);
      return;
    }

    const timer = setTimeout(() => {
      setSearchLoading(true);
      fetch(`${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}&limit=50`)
        .then(r => r.json())
        .then(data => {
          setCourses(data.results || []);
          setSearchLoading(false);
        })
        .catch(() => setSearchLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedDept, selectedGenEd, fetchFilteredCourses]);

  // Filters
  const handleDeptFilter = (dept: string | null) => {
    setSelectedDept(dept);
    setSearchQuery('');
  };

  const handleGenEdFilter = (genEd: string | null) => {
    setSelectedGenEd(genEd);
    setSearchQuery('');
  };

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-white font-sans selection:bg-black/10 dark:selection:bg-white/20 overflow-x-hidden">
      {/* Subtle background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.02)_0%,transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px',
          }}
        />
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Main Content */}
      <main className="relative z-10 pt-28 pb-20 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-12">
            <FadeUp>
              <span className="text-[10px] uppercase tracking-[0.25em] font-medium text-neutral-500 dark:text-white/30 mb-4 block">
                Catalog
              </span>
            </FadeUp>
            <FadeUp delay={0.1}>
              <h1 className="text-5xl md:text-7xl font-light tracking-tight leading-[1] text-black dark:text-white/90 mb-6">
                Every course,<br />
                <span className="italic font-extralight text-neutral-600 dark:text-white/60">one search away</span>
              </h1>
            </FadeUp>
            <FadeUp delay={0.15}>
              <p className="text-lg text-neutral-500 dark:text-white/40 font-light max-w-xl">
                Search by name, code, or try natural language — "easy science elective" or "intro CS morning MWF"
              </p>
            </FadeUp>

            {/* View Toggle */}
            <FadeUp delay={0.2}>
              <div className="mt-8 flex items-center bg-white dark:bg-white/[0.04] p-1 rounded-full border border-black/10 dark:border-white/[0.08] w-fit shadow-sm dark:shadow-none">
                <button
                  onClick={() => setViewMode('courses')}
                  className={`px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.15em] font-medium transition-all duration-300 ${viewMode === 'courses' ? 'bg-black dark:bg-white/10 text-white shadow-lg' : 'text-neutral-500 dark:text-white/40 hover:text-black dark:hover:text-white/70'
                    }`}
                >
                  Courses
                </button>
                <button
                  onClick={() => setViewMode('professors')}
                  className={`px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.15em] font-medium transition-all duration-300 ${viewMode === 'professors' ? 'bg-black dark:bg-white/10 text-white shadow-lg' : 'text-neutral-500 dark:text-white/40 hover:text-black dark:hover:text-white/70'
                    }`}
                >
                  Professors
                </button>
              </div>
            </FadeUp>
          </div>

          {/* Conditional Content Rendering */}
          {viewMode === 'courses' ? (
            <>
              {/* Search Bar */}
              <FadeUp delay={0.25}>
                <div className="relative mb-12">
                  <div className="relative">
                    <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/25" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search courses… try 'CMPSC 132' or 'easy intro math'"
                      className="w-full bg-white dark:bg-white/[0.04] border border-black/10 dark:border-white/[0.08] rounded-2xl py-5 pl-14 pr-6 text-black dark:text-white/90 text-base font-light placeholder:text-neutral-400 dark:placeholder:text-white/20 focus:outline-none focus:border-black/30 dark:focus:border-white/20 focus:bg-white dark:focus:bg-white/[0.06] transition-all duration-300 shadow-sm dark:shadow-none"
                      id="course-search"
                    />
                    {searchLoading && (
                      <div className="absolute right-5 top-1/2 -translate-y-1/2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-black/20 dark:border-white/20 border-t-black/60 dark:border-t-white/60 rounded-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </FadeUp>

              {/* Filters */}
              <FadeUp delay={0.3}>
                <div className="flex flex-col gap-4 mb-12">
                  {/* Gen Ed Filter */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-white/30 mr-2 mt-2">Gen Ed:</span>
                    <button
                      onClick={() => handleGenEdFilter(null)}
                      className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.12em] font-medium border transition-all duration-300 ${selectedGenEd === null
                          ? 'bg-emerald-500/10 dark:bg-emerald-400/20 border-emerald-500/30 dark:border-emerald-400/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-transparent border-black/10 dark:border-white/[0.06] text-neutral-500 dark:text-white/30 hover:text-black dark:hover:text-white/50 hover:border-black/30 dark:hover:border-white/15'
                        }`}
                    >
                      Any
                    </button>
                    {GEN_ED_CATEGORIES.map((genEd) => (
                      <button
                        key={genEd.code}
                        onClick={() => handleGenEdFilter(genEd.code)}
                        className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.12em] font-medium border transition-all duration-300 ${selectedGenEd === genEd.code
                            ? 'bg-emerald-500/10 dark:bg-emerald-400/20 border-emerald-500/30 dark:border-emerald-400/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-transparent border-black/10 dark:border-white/[0.06] text-neutral-500 dark:text-white/30 hover:text-black dark:hover:text-white/50 hover:border-black/30 dark:hover:border-white/15'
                          }`}
                      >
                        {genEd.code}
                      </button>
                    ))}
                  </div>

                  {/* Department Filter Pills */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-white/30 mr-2 mt-2">Depts:</span>
                    <button
                      onClick={() => handleDeptFilter(null)}
                      className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.12em] font-medium border transition-all duration-300 ${selectedDept === null
                          ? 'bg-black/5 dark:bg-white/10 border-black/20 dark:border-white/20 text-black dark:text-white/80'
                          : 'bg-transparent border-black/10 dark:border-white/[0.06] text-neutral-500 dark:text-white/30 hover:text-black dark:hover:text-white/50 hover:border-black/30 dark:hover:border-white/15'
                        }`}
                    >
                      All
                    </button>
                    {departments.map((dept) => (
                      <button
                        key={dept.code}
                        onClick={() => handleDeptFilter(dept.code)}
                        className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.12em] font-medium border transition-all duration-300 ${selectedDept === dept.code
                            ? 'bg-black/5 dark:bg-white/10 border-black/20 dark:border-white/20 text-black dark:text-white/80'
                            : 'bg-transparent border-black/10 dark:border-white/[0.06] text-neutral-500 dark:text-white/30 hover:text-black dark:hover:text-white/50 hover:border-black/30 dark:hover:border-white/15'
                          }`}
                      >
                        {dept.code}
                        <span className="ml-1.5 text-neutral-400 dark:text-white/20">{dept.course_count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </FadeUp>

              {/* Results Header */}
              <div className="flex justify-between items-end border-b border-black/10 dark:border-white/[0.08] pb-3 mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-white/30">
                  {selectedDept ? selectedDept : 'All Departments'}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-white/30">
                  {courses.length} {courses.length === 1 ? 'Result' : 'Results'}
                </span>
              </div>

              {/* Course List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border-2 border-black/10 dark:border-white/10 border-t-black/50 dark:border-t-white/50 rounded-full mb-4"
                  />
                  <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/30 font-medium">
                    Loading courses
                  </span>
                </div>
              ) : courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32">
                  <span className="text-6xl mb-6 opacity-20">∅</span>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/30 font-medium">
                    No courses found
                  </span>
                  <p className="text-sm text-neutral-400 dark:text-white/20 mt-2 font-light">
                    Try a different search or clear your filters
                  </p>
                </div>
              ) : (
                <div>
                  {courses.map((course, i) => (
                    <CourseCard key={course.id} course={course} index={i} />
                  ))}
                </div>
              )}

              {/* Load More */}
              {courses.length >= 100 && (
                <FadeUp delay={0}>
                  <div className="flex justify-center mt-12">
                    <button className="px-8 py-3 rounded-full border border-white/[0.08] text-[11px] uppercase tracking-[0.15em] text-white/40 font-medium hover:border-white/20 hover:text-white/60 transition-all duration-300">
                      Load more courses
                    </button>
                  </div>
                </FadeUp>
              )}
            </>
          ) : (
            <FadeUp delay={0.25}>
              <div className="pt-8">
                <ProfessorList />
              </div>
            </FadeUp>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] px-6 md:px-10 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-white/25">
            © 2026 Schedula
          </span>
          <div className="flex gap-8 text-[10px] uppercase tracking-[0.2em] font-medium text-white/25">
            <Link href="/" className="hover:text-white/50 transition-colors">Home</Link>
            <Link href="/schedule" className="hover:text-white/50 transition-colors">Schedule</Link>
            <a href="mailto:team@schedula.app" className="hover:text-white/50 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}