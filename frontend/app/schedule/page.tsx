'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import CalendarGrid from '@/components/CalendarGrid';
import { useStudentContext } from '@/components/StudentProvider';

interface ScheduledSection {
  section_id: number;
  section_number: string;
  course_id: number;
  course_code: string;
  course_title: string;
  credits: number;
  days: string;
  start_time: string;
  end_time: string;
  location: string;
  professor: {
    name: string;
    rating: number | null;
    difficulty: number | null;
  };
}

interface ScheduleOption {
  status: string;
  total_credits: number;
  schedule: ScheduledSection[];
  fitness_score: number;
  workload?: {
    score: number;
    level: string;
    color: string;
    message: string;
    metrics: { avg_difficulty: number; complexity_index: number; total_credits: number };
  }
}

interface ResponsePayload {
  status?: string;
  results?: ScheduleOption[];
  error?: string;
}

const FadeUp = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <motion.div className={className} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </motion.div>
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://schedula-2-production.up.railway.app';

export default function SchedulePage() {
  const { completedCourses, recommendations, audit } = useStudentContext();
  const [data, setData] = useState<ResponsePayload | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Conf state
  const [avoidMornings, setAvoidMornings] = useState(false);
  const [maxCredits, setMaxCredits] = useState(16);
  const [activeOpt, setActiveOpt] = useState(0); // Which generated schedule we view

  const generate = () => {
    setLoading(true);
    const params = new URLSearchParams(window.location.search);
    // Prefer shared context, fall back to URL params
    const contextIds = completedCourses.map(c => c.id).join(',');
    const completedIds = contextIds || params.get('completed_ids') || "";

    fetch(`${API_BASE}/api/generate-schedule?track_id=3&completed_ids=${completedIds}&max_credits=${maxCredits}&avoid_mornings=${avoidMornings}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setActiveOpt(0);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  // Initial load
  useEffect(() => {
    generate();
  }, []);

  const activeSchedule = data?.results ? data.results[activeOpt] : null;

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-[#020202] text-neutral-900 dark:text-white font-sans selection:bg-black/10 dark:selection:bg-white/20 overflow-x-hidden">
      {/* Background Noise & Gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.02)_0%,transparent_60%)]" />
      </div>

      {/* Navigation */}
      <Navbar />

      <main className="relative z-10 pt-32 pb-20 px-6 md:px-10 max-w-[1400px] mx-auto">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* LEFT SIDEBAR CONTROLS */}
          <div className="lg:col-span-3 space-y-8">
            <FadeUp>
              <h2 className="text-2xl font-light tracking-tight mb-6">Constraints</h2>
              
              <div className="space-y-6">
                <div className="bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] shadow-sm dark:shadow-none p-5 rounded-2xl">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <span className="text-sm font-medium text-neutral-800 dark:text-white/80 block">Avoid 8:00 AMs</span>
                      <span className="text-[10px] text-neutral-500 dark:text-white/40 mt-1 block">Filter classes before 9 AM</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${avoidMornings ? 'bg-emerald-500' : 'bg-black/10 dark:bg-white/10'}`}>
                       <motion.div 
                          className="w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm"
                          animate={{ left: avoidMornings ? "22px" : "2px" }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                       />
                       <input type="checkbox" className="hidden" checked={avoidMornings} onChange={() => setAvoidMornings(!avoidMornings)} />
                    </div>
                  </label>
                </div>

                <div className="bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] shadow-sm dark:shadow-none p-5 rounded-2xl">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-medium text-neutral-800 dark:text-white/80">Max Credits</span>
                      <span className="text-xs font-mono text-neutral-500 dark:text-white/50">{maxCredits}</span>
                   </div>
                   <input type="range" min="12" max="18" step="1" value={maxCredits} onChange={e => setMaxCredits(parseInt(e.target.value))} className="w-full grayscale opacity-70 cursor-wait"/>
                </div>

                <button 
                   onClick={generate}
                   className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl text-xs uppercase tracking-[0.15em] font-semibold hover:bg-black/80 dark:hover:bg-white/90 transition-colors shadow-lg"
                >
                  Regenerate Matches
                </button>
              </div>
            </FadeUp>

            {/* Degree Progress Summary */}
            {audit && (
              <FadeUp delay={0.1}>
                <div className="bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] shadow-sm dark:shadow-none p-5 rounded-2xl">
                  <span className="text-[9px] uppercase tracking-[0.18em] font-medium text-neutral-500 dark:text-white/40 block mb-3">Degree Progress</span>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-3xl font-light text-black dark:text-white">{audit.progress_percentage}%</span>
                    <span className="text-xs text-neutral-400 dark:text-white/30 pb-1">{audit.total_credits_earned}/{audit.total_credits_required} cr</span>
                  </div>
                  <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${audit.progress_percentage}%` }} className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full" />
                  </div>
                  <Link href="/audit" className="mt-3 block text-[10px] text-emerald-600 dark:text-emerald-400/70 uppercase tracking-[0.12em] font-medium hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                    View Full Audit →
                  </Link>
                </div>
              </FadeUp>
            )}

            {/* Compact Recommendations */}
            {recommendations.length > 0 && (
              <FadeUp delay={0.15}>
                <div className="bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] shadow-sm dark:shadow-none p-5 rounded-2xl">
                  <span className="text-[9px] uppercase tracking-[0.18em] font-medium text-neutral-500 dark:text-white/40 block mb-4">Suggested Next</span>
                  <div className="space-y-3">
                    {recommendations.slice(0, 3).map(rec => (
                      <div key={rec.course.id} className="flex items-start justify-between gap-2 py-2 border-b border-black/5 dark:border-white/[0.04] last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-black dark:text-white/90 truncate">{rec.course.title}</p>
                          <p className="text-[10px] text-neutral-500 dark:text-white/40 font-mono">{rec.course.code} · {rec.course.credits} cr</p>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400/70 uppercase tracking-wider">{rec.requirement}</span>
                        </div>
                        {rec.best_section?.professor && (
                          <span className="shrink-0 text-[10px] text-amber-500 dark:text-amber-400/80 font-medium">★{rec.best_section.professor.rating?.toFixed(1)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Link href="/audit?tab=recommendations" className="mt-3 block text-[10px] text-emerald-600 dark:text-emerald-400/70 uppercase tracking-[0.12em] font-medium hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                    View All Recommendations →
                  </Link>
                </div>
              </FadeUp>
            )}
          </div>

          {/* RIGHT CANVAS */}
          <div className="lg:col-span-9 min-h-[600px]">
             {loading ? (
                 <div className="flex flex-col items-center justify-center py-40 h-full border border-black/5 dark:border-white/[0.02] rounded-3xl bg-white dark:bg-white/[0.01] shadow-sm dark:shadow-none">
                   <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-black/10 dark:border-white/10 border-t-black/50 dark:border-t-white/50 rounded-full mb-4" />
                   <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-white/30 font-medium text-center">
                     AI Solving Constraints<br/>
                     <span className="opacity-50 text-[9px] lowercase mt-1 block text-neutral-500 dark:text-white/40">Predicting professor workloads</span>
                   </span>
                 </div>
             ) : data?.error ? (
                  <div className="flex flex-col items-center justify-center h-full border border-rose-500/10 rounded-3xl bg-rose-500/[0.02]">
                   <span className="text-[11px] uppercase tracking-[0.2em] text-rose-400 font-medium pb-4">No Schedules Found</span>
                   <p className="text-sm text-white/40 max-w-sm text-center">{data.error}</p>
                 </div>
             ) : data?.results && activeSchedule ? (
                 <div>
                    {/* ML Predictive Dashboard Header */}
                    <FadeUp>
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-black/5 dark:divide-white/[0.05] bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] shadow-sm dark:shadow-none rounded-3xl overflow-hidden mb-8">
                            <div className="p-6 md:w-1/2 relative group">
                                <div className="absolute inset-0 bg-gradient-to-br from-black/[0.01] dark:from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40 mb-2 block relative z-10">AI Workload Predictor</span>
                                <div className="flex items-end gap-3 mb-2 relative z-10">
                                    <h3 
                                        className="text-3xl font-light text-black dark:text-white" 
                                    >
                                        {activeSchedule.workload?.level || 'Analyzing'}
                                    </h3>
                                    <span className="text-sm font-mono text-neutral-400 dark:text-white/30 pb-1">
                                        [{activeSchedule.workload?.score}% Burnout Risk]
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-white/50 bg-zinc-100 dark:bg-black/20 p-3 rounded-lg border border-black/5 dark:border-white/[0.02] relative z-10 hover:text-black dark:group-hover:text-white/70 transition-colors">
                                    {activeSchedule.workload?.message}
                                </p>
                            </div>
                            <div className="p-6 md:w-1/2 flex flex-col justify-center space-y-4 relative group">
                                <div className="absolute inset-0 bg-gradient-to-br from-black/[0.01] dark:from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                {/* Credits Bar */}
                                <div className="relative z-10">
                                    <div className="flex justify-between text-[10px] uppercase tracking-[0.1em] text-neutral-500 dark:text-white/30 mb-1">
                                        <span>Target Total</span>
                                        <span>{activeSchedule.total_credits} / 18</span>
                                    </div>
                                    <div className="h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }} 
                                            animate={{ width: `${(activeSchedule.total_credits / 18) * 100}%` }} 
                                            className="h-full bg-black/40 dark:bg-white/40" 
                                        />
                                    </div>
                                </div>

                                {/* Difficulty Bar */}
                                <div className="relative z-10">
                                    <div className="flex justify-between text-[10px] uppercase tracking-[0.1em] text-neutral-500 dark:text-white/30 mb-1">
                                        <span>Avg Prof Difficulty</span>
                                        <span>{activeSchedule.workload?.metrics.avg_difficulty.toFixed(1)} / 5.0</span>
                                    </div>
                                    <div className="h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }} 
                                            animate={{ width: `${((activeSchedule.workload?.metrics.avg_difficulty || 1) / 5) * 100}%` }} 
                                            className="h-full bg-amber-500/50 dark:bg-amber-400/50" 
                                        />
                                    </div>
                                </div>

                                {/* STEM Complexity Bar */}
                                <div className="relative z-10">
                                    <div className="flex justify-between text-[10px] uppercase tracking-[0.1em] text-neutral-500 dark:text-white/30 mb-1">
                                        <span>STEM Complexity</span>
                                        <span>Level {activeSchedule.workload?.metrics.complexity_index.toFixed(1)}</span>
                                    </div>
                                    <div className="h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }} 
                                            animate={{ width: `${Math.min(((activeSchedule.workload?.metrics.complexity_index || 1) / 10) * 100, 100)}%` }} 
                                            className="h-full bg-rose-500/50 dark:bg-rose-400/50" 
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </FadeUp>

                    {/* Multi-Schedule Tabs */}
                    <FadeUp delay={0.1}>
                        <div className="flex gap-2">
                            {data.results.map((opt, i) => (
                                <button 
                                  key={i} 
                                  onClick={() => setActiveOpt(i)}
                                  className={`px-4 py-2 text-[10px] uppercase tracking-[0.15em] rounded-full border transition-all ${
                                      activeOpt === i 
                                      ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white font-semibold shadow-md' 
                                      : 'bg-transparent text-neutral-500 dark:text-white/40 border-black/10 dark:border-white/[0.05] hover:border-black/30 dark:hover:border-white/20'
                                  }`}
                                >
                                    Option {i + 1}
                                </button>
                            ))}
                        </div>
                    </FadeUp>

                    {/* Timeline Grid */}
                    <FadeUp delay={0.2}>
                       <CalendarGrid schedule={activeSchedule.schedule} />
                    </FadeUp>
                 </div>
             ) : null}
          </div>

        </div>
      </main>

    </div>
  );
}
