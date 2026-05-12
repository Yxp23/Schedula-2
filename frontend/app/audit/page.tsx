'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useStudentContext, type AuditRule, type AuditCategory } from '@/components/StudentProvider';

// ── Types ──────────────────────────────────────────────────────────
// Rule and Category are imported from StudentProvider as AuditRule and AuditCategory

interface SearchResult {
  id: number;
  code: string;
  title: string;
}

interface RecommendedSection {
  id: number;
  days: string;
  start_time: string;
  end_time: string;
  seats_open: number;
  seats_total: number;
  professor: { name: string; rating: number; difficulty: number } | null;
}

interface Recommendation {
  course: { id: number; code: string; title: string; credits: number; gen_ed: string; description: string };
  requirement: string;
  requirement_type: string;
  reason: string;
  best_section: RecommendedSection | null;
  has_open_sections: boolean;
  score: number;
}

// ── Animation Wrapper ──────────────────────────────────────────────
const FadeUp = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div ref={ref} className={className} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://schedula-2-production.up.railway.app';

export default function AuditPage() {
  // ── Shared context (replaces local state + fetch hooks) ──
  const {
    audit,
    auditLoading: loading,
    completedCourses,
    recommendations,
    recsLoading,
    addCourse,
    removeCourse,
  } = useStudentContext();

  // ── Local page state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'recommendations'>('audit');

  // Debounced Search for adding courses
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setSearchLoading(true);
      fetch(`${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setSearchResults(data.results || []);
          setSearchLoading(false);
        })
        .catch(() => setSearchLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddCourse = (course: SearchResult) => {
    addCourse({ id: course.id, code: course.code });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveCourse = (idToRemove: number) => {
    removeCourse(idToRemove);
  };

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-white font-sans selection:bg-black/10 dark:selection:bg-white/20 overflow-x-hidden">
      {/* Background Noise & Gradient */}
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
      <main className="relative z-10 pt-32 pb-20 px-6 md:px-10">
        <div className="max-w-6xl mx-auto">

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 mb-10 bg-black/5 dark:bg-white/[0.04] p-1 rounded-full border border-black/10 dark:border-white/[0.06] w-fit">
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.15em] font-medium transition-all duration-300 ${
                activeTab === 'audit'
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                  : 'text-neutral-500 dark:text-white/40 hover:text-black dark:hover:text-white/70'
              }`}
            >
              Degree Audit
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.15em] font-medium transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'recommendations'
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                  : 'text-neutral-500 dark:text-white/40 hover:text-black dark:hover:text-white/70'
              }`}
            >
              Recommendations
              {recommendations.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === 'recommendations' ? 'bg-white/20 text-white dark:text-black' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {recommendations.length}
                </span>
              )}
            </button>
          </div>
          
          {!audit || (audit as any).error ? (
             <div className="flex flex-col items-center justify-center py-32 text-center">
               <span className="text-6xl mb-6 opacity-20">⚠</span>
               <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/30 font-medium">No Degree Track Found</span>
               <p className="text-sm text-neutral-400 dark:text-white/20 mt-2 font-light">We need to seed the database with a major (like Computer Science) first.</p>
             </div>
          ) : (
            <>
              {/* ── RECOMMENDATIONS TAB ────────────────────── */}
              {activeTab === 'recommendations' && (
                <div className="space-y-6">
                  <FadeUp>
                    <div className="mb-8">
                      <h1 className="text-4xl md:text-5xl font-light tracking-tight text-black dark:text-white/90 mb-3">
                        What to take next
                      </h1>
                      <p className="text-neutral-500 dark:text-white/40 font-light">
                        Courses that fill your remaining requirements, ranked by professor quality and availability.
                      </p>
                    </div>
                  </FadeUp>

                  {recsLoading ? (
                    <div className="flex flex-col items-center justify-center py-32">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="w-8 h-8 border-2 border-black/10 dark:border-white/10 border-t-black/50 dark:border-t-white/50 rounded-full mb-4" />
                      <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/30 font-medium">Analyzing your requirements</span>
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                      <span className="text-5xl mb-6">🎓</span>
                      <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/30 font-medium">All requirements satisfied!</span>
                      <p className="text-sm text-neutral-400 dark:text-white/20 mt-2 font-light">You&apos;re on track for graduation.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {recommendations.map((rec, i) => (
                        <FadeUp key={rec.course.id} delay={i * 0.07}>
                          <div className="group relative p-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-black/20 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/[0.05] transition-all duration-300 shadow-sm dark:shadow-none h-full flex flex-col">

                            {/* Requirement Badge */}
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-[9px] uppercase tracking-[0.18em] font-medium px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20">
                                {rec.requirement}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {rec.has_open_sections ? (
                                  <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                                    Open
                                  </span>
                                ) : (
                                  <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-400 dark:text-white/30 font-medium">No sections</span>
                                )}
                              </div>
                            </div>

                            {/* Course Info */}
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                  <h3 className="text-lg font-medium text-black dark:text-white/90 leading-tight mb-0.5">{rec.course.title}</h3>
                                  <span className="text-[10px] font-mono text-neutral-500 dark:text-white/40 uppercase tracking-wider">{rec.course.code}</span>
                                </div>
                                <span className="shrink-0 text-xs font-medium text-neutral-500 dark:text-white/40 mt-1">
                                  {rec.course.credits} cr
                                </span>
                              </div>

                              {rec.course.description && (
                                <p className="text-sm text-neutral-500 dark:text-white/40 font-light leading-relaxed mt-2 line-clamp-2">
                                  {rec.course.description}
                                </p>
                              )}

                              {/* Why this course */}
                              <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-3 italic">{rec.reason}</p>
                            </div>

                            {/* Best Section */}
                            {rec.best_section && (
                              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/[0.06]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-white/50">
                                    <span className="font-medium">{rec.best_section.days}</span>
                                    <span className="text-neutral-400 dark:text-white/30">{rec.best_section.start_time}–{rec.best_section.end_time}</span>
                                    {rec.best_section.professor && (
                                      <span className="hidden sm:inline text-neutral-400 dark:text-white/30">
                                        {rec.best_section.professor.name.split(' ').pop()}
                                        {' '}
                                        <span className="text-amber-500 dark:text-amber-400/80">★{rec.best_section.professor.rating?.toFixed(1)}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-neutral-400 dark:text-white/30">
                                      {rec.best_section.seats_open}/{rec.best_section.seats_total} seats
                                    </span>
                                    <Link
                                      href={`/schedule?add=${rec.course.code}`}
                                      onClick={e => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px] uppercase tracking-[0.12em] font-medium hover:scale-105 transition-transform"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                                      Add
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </FadeUp>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── AUDIT TAB ────────────────────────────── */}
              {activeTab === 'audit' && (
              <div>

              {/* Header section */}
              <div className="mb-10">
                <FadeUp>
                  <span className="text-[10px] uppercase tracking-[0.25em] font-medium text-emerald-600 dark:text-emerald-400/60 mb-4 block">
                    Active Plan
                  </span>
                </FadeUp>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <FadeUp delay={0.1}>
                    <h1 className="text-4xl md:text-6xl font-light tracking-tight leading-[1.1] text-black dark:text-white/90">
                      {audit.track_name}
                    </h1>
                  </FadeUp>
                  <FadeUp delay={0.15}>
                    <Link
                      href={`/schedule?completed_ids=${completedCourses.map(c => c.id).join(',')}`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs uppercase tracking-[0.15em] font-medium hover:scale-105 transition-transform shadow-lg dark:shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      Auto-Generate Schedule
                    </Link>
                  </FadeUp>
                </div>
                
                {/* Master Progress Bar */}
                <FadeUp delay={0.2}>
                  <div className="bg-white dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.08] lg:shadow-sm dark:shadow-none rounded-2xl p-6 mt-12 transition-opacity duration-300" style={{ opacity: loading ? 0.5 : 1 }}>
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40 block mb-1">
                          Overall Progress
                        </span>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-light text-black dark:text-white/90">{audit.progress_percentage}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40 block mb-1">
                          Credits
                        </span>
                        <span className="text-lg font-light text-neutral-800 dark:text-white/80">
                          {audit.total_credits_earned} <span className="text-sm text-neutral-400 dark:text-white/30">/ {audit.total_credits_required}</span>
                        </span>
                      </div>
                    </div>
                    
                    {/* Progress Bar Track */}
                    <div className="h-2 w-full bg-black/5 dark:bg-black/40 rounded-full overflow-hidden border border-black/5 dark:border-white/[0.05]">
                      <motion.div 
                        initial={false}
                        animate={{ width: `${audit.progress_percentage}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/80 rounded-full"
                      />
                    </div>
                  </div>
                </FadeUp>
              </div>

              {/* Course Adder */}
              <FadeUp delay={0.25}>
                <div className="bg-white dark:bg-white/[0.02] border border-black/10 dark:border-white/[0.06] shadow-sm dark:shadow-none rounded-2xl p-6 mb-12">
                  <h3 className="text-sm uppercase tracking-[0.15em] text-neutral-600 dark:text-white/50 mb-4 font-medium">Add Completed Courses</h3>
                  <div className="relative">
                    <div className="relative">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/20" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for a course you've taken..."
                        className="w-full bg-zinc-50 dark:bg-black/50 border border-black/10 dark:border-white/[0.08] rounded-xl py-3 pl-12 pr-4 text-sm font-light text-black dark:text-white/90 placeholder:text-neutral-400 focus:outline-none focus:border-black/30 dark:focus:border-white/20 transition-colors"
                      />
                      {searchLoading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-black/20 dark:border-white/20 border-t-black/60 dark:border-t-white/60 rounded-full" />
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {searchResults.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-[#0c0c0c] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden shadow-2xl"
                        >
                          {searchResults.map(result => (
                            <button
                              key={result.id}
                              onClick={() => handleAddCourse(result)}
                              className="w-full text-left px-4 py-3 border-b border-black/5 dark:border-white/[0.05] last:border-0 hover:bg-black/5 dark:hover:bg-white/[0.05] transition-colors flex justify-between items-center group"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-black dark:text-white/90">{result.code}</span>
                                <span className="text-xs text-neutral-500 dark:text-white/40 truncate">{result.title}</span>
                              </div>
                              <div className="w-5 h-5 rounded-full border border-black/20 dark:border-white/20 flex items-center justify-center group-hover:border-emerald-500 dark:group-hover:border-emerald-400/50 transition-colors">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/0 dark:group-hover:text-emerald-400 group-hover:text-emerald-600 transition-colors"><path d="M12 5v14M5 12h14"/></svg>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Visualizing loosely added courses that map to rules */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-xs text-neutral-500 dark:text-white/30 mr-2 mt-1">Completed:</span>
                    {completedCourses.length === 0 && <span className="text-xs text-neutral-400 dark:text-white/20 mt-1 italic">None selected</span>}
                    {completedCourses.map((course, idx) => {
                      return (
                        <div key={`${course.id}-${idx}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-xs text-neutral-900 dark:text-white/90 shadow-sm dark:shadow-none">
                          {course.code || `Course #${course.id}`}
                          <button onClick={() => handleRemoveCourse(course.id)} className="text-neutral-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </FadeUp>

              {/* Requirement Categories Grid */}
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                {(audit.categories || []).map((category, idx) => (
                  <FadeUp key={idx} delay={0.3 + (idx * 0.1)}>
                    <div className="p-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.04] backdrop-blur-md h-full flex flex-col transition-all hover:border-black/20 dark:hover:bg-white/[0.06] shadow-sm dark:shadow-none">
                      
                      {/* Category Header */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="pr-4">
                          <h3 className="text-lg font-medium text-black dark:text-white/90 mb-1">{category.name}</h3>
                          <span className="text-xs text-neutral-500 dark:text-white/40">{category.credits_earned} of {category.credits_required} Credits</span>
                        </div>
                        {category.is_complete ? (
                           <div className="w-6 h-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-600 dark:text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                           </div>
                        ) : (
                           <div className="w-6 h-6 rounded-full border border-black/10 dark:border-white/20 shrink-0 flex items-center justify-center">
                             <div className="w-1.5 h-1.5 bg-black/20 dark:bg-white/20 rounded-full" />
                           </div>
                        )}
                      </div>

                      {/* Rules Breakdown */}
                      <div className="mt-auto space-y-3 pt-4 border-t border-black/5 dark:border-white/[0.06]">
                        {category.rules.map((rule, ruleIdx) => (
                          <div key={ruleIdx} className="flex gap-3 items-start">
                             <div className="mt-0.5 shrink-0">
                               {rule.met ? (
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600 dark:text-emerald-400"><path d="M20 6L9 17l-5-5"/></svg>
                               ) : (
                                 <button 
                                   onClick={() => rule.course_id && handleAddCourse({ id: rule.course_id, code: '', title: '' })}
                                   className="w-[14px] h-[14px] rounded-full border-2 border-black/20 dark:border-white/20 hover:border-emerald-500 dark:hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-all flex items-center justify-center"
                                   title="Click to mark as completed"
                                 />
                               )}
                             </div>
                             <p className={`text-sm tracking-wide ${rule.met ? 'text-neutral-400 dark:text-white/40 line-through decoration-black/20 dark:decoration-white/20' : 'text-neutral-800 dark:text-white/90'}`}>
                               {rule.details}
                             </p>
                          </div>
                        ))}
                      </div>
                      
                    </div>
                  </FadeUp>
                ))}
              </div>
              </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-black/10 dark:border-white/[0.05] px-6 md:px-10 py-8 mt-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-400 dark:text-white/25">
          <span>© 2026 Schedula</span>
          <div className="flex gap-8">
            <Link href="/" className="hover:text-neutral-600 dark:hover:text-white/50 transition-colors">Home</Link>
            <Link href="/courses" className="hover:text-neutral-600 dark:hover:text-white/50 transition-colors">Courses</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}