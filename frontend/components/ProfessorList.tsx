'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Professor {
    id: number;
    name: string;
    department: string;
    rating: number;
    difficulty: number;
    would_take_again: number;
    num_ratings: number;
}

interface ProfessorDetail extends Professor {
    courses: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ProfessorList() {
    const [professors, setProfessors] = useState<Professor[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProfId, setSelectedProfId] = useState<number | null>(null);
    const [profDetail, setProfDetail] = useState<ProfessorDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/api/professors?limit=150`)
            .then((res) => res.json())
            .then((data) => {
                setProfessors(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Fetch detail when selected
    useEffect(() => {
        if (!selectedProfId) {
            setProfDetail(null);
            return;
        }
        setDetailLoading(true);
        fetch(`${API_BASE}/api/professors/${selectedProfId}`)
            .then(res => res.json())
            .then(data => {
                setProfDetail(data);
                setDetailLoading(false);
            })
            .catch(() => setDetailLoading(false));
    }, [selectedProfId]);

    const filteredProfessors = professors.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border-2 border-black/10 dark:border-white/10 border-t-black/50 dark:border-t-white/50 rounded-full mb-4"
                />
                <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-white/30 font-medium">
                    Loading faculty
                </span>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Search Bar */}
            <div className="mb-10 relative">
                <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/25" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search professors by name or department (e.g. 'CS', 'Smith')..."
                    className="w-full bg-white dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.08] rounded-2xl py-4 pl-14 pr-6 text-black dark:text-white/90 text-sm font-light placeholder:text-neutral-400 dark:placeholder:text-white/20 focus:outline-none focus:border-black/30 dark:focus:border-white/20 focus:bg-black/5 dark:focus:bg-white/[0.05] shadow-sm dark:shadow-none transition-all duration-300"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProfessors.map((prof, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        key={prof.id}
                        onClick={() => setSelectedProfId(prof.id)}
                        className="group relative cursor-pointer overflow-hidden p-6 rounded-2xl border border-black/10 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/[0.04] transition-all duration-500 hover:border-black/20 dark:hover:border-white/[0.15] shadow-sm dark:shadow-none"
                    >
                        {/* Subtle background glow effect on hover */}
                        <div className="absolute -inset-24 bg-gradient-to-r from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/10 dark:group-hover:from-emerald-500/5 transition-all duration-700 opacity-0 group-hover:opacity-100 blur-2xl" />

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-light tracking-tight text-black dark:text-white/90 group-hover:text-black dark:group-hover:text-white transition-colors">
                                        {prof.name}
                                    </h3>
                                    <span className="inline-block mt-2 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-white/40 bg-black/5 dark:bg-white/[0.05] rounded-sm border border-black/5 dark:border-white/[0.05]">
                                        {prof.department}
                                    </span>
                                </div>
                                <div className="w-8 h-8 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-500">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-neutral-500 dark:text-white/40"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                            </div>

                            <div className="flex justify-between items-end pt-4 border-t border-black/10 dark:border-white/[0.05]">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-white/30 mb-1.5 font-medium">Quality</p>
                                    <p className="text-3xl font-light tracking-tighter text-black dark:text-white">
                                        {prof.rating ? prof.rating.toFixed(1) : '–'}
                                        <span className="text-base text-neutral-400 dark:text-white/20 font-normal">/5</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-white/30 mb-1.5 font-medium">Difficulty</p>
                                    <p className="text-xl font-light tracking-tighter text-neutral-600 dark:text-white/60">
                                        {prof.difficulty ? prof.difficulty.toFixed(1) : '–'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Profile Drawer */}
            <AnimatePresence>
                {selectedProfId && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedProfId(null)}
                            className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-[150]"
                        />
                        
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 bottom-0 w-full md:w-[450px] bg-white dark:bg-[#050505] border-l border-black/10 dark:border-white/[0.06] z-[160] overflow-y-auto no-scrollbar shadow-2xl flex flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="sticky top-0 bg-white/90 dark:bg-[#050505]/90 backdrop-blur-xl border-b border-black/10 dark:border-white/[0.05] p-6 flex justify-between items-center z-10">
                                <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-white/30">Faculty Profile</span>
                                <button onClick={() => setSelectedProfId(null)} className="p-2 bg-black/5 dark:bg-white/[0.03] hover:bg-black/10 dark:hover:bg-white/[0.1] rounded-full transition-colors text-black dark:text-white/40">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>

                            {/* Drawer Content */}
                            <div className="p-8 flex-1">
                                {detailLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border border-black/20 dark:border-white/20 border-t-black/80 dark:border-t-white/80 rounded-full" />
                                    </div>
                                ) : profDetail ? (
                                    <div className="space-y-10">
                                        <div>
                                            <h2 className="text-4xl font-light tracking-tight text-black dark:text-white mb-3">
                                                {profDetail.name}
                                            </h2>
                                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/[0.08] text-[10px] uppercase tracking-[0.15em] text-neutral-600 dark:text-white/60 font-medium">
                                                {profDetail.department} Department
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.05]">
                                                <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 dark:text-white/40 font-medium mb-2">Overall Rating</p>
                                                <p className="text-5xl font-light tracking-tighter text-emerald-600 dark:text-emerald-400">
                                                    {profDetail.rating.toFixed(1)}
                                                </p>
                                                <p className="text-xs text-neutral-400 dark:text-white/30 mt-2 font-light">Based on {profDetail.num_ratings} ratings</p>
                                            </div>
                                            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.05]">
                                                <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 dark:text-white/40 font-medium mb-2">Level of Difficulty</p>
                                                <p className="text-5xl font-light tracking-tighter text-amber-500">
                                                    {profDetail.difficulty.toFixed(1)}
                                                </p>
                                                <p className="text-xs text-neutral-400 dark:text-white/30 mt-2 font-light">From RMP</p>
                                            </div>
                                        </div>

                                        {profDetail.would_take_again > 0 && (
                                            <div className="w-full h-1.5 bg-black/10 dark:bg-white/[0.05] rounded-full overflow-hidden">
                                                <motion.div 
                                                    initial={{ width: 0 }} 
                                                    animate={{ width: `${profDetail.would_take_again}%` }}
                                                    transition={{ duration: 1, delay: 0.2 }}
                                                    className="h-full bg-emerald-500 dark:bg-emerald-400" 
                                                />
                                            </div>
                                        )}
                                        {profDetail.would_take_again > 0 && (
                                            <p className="text-xs text-neutral-500 dark:text-white/50 text-right mt-2 font-light tracking-wide">
                                                <span className="text-black dark:text-white font-medium">{Math.round(profDetail.would_take_again)}%</span> would take again
                                            </p>
                                        )}

                                        <div className="pt-8 border-t border-black/10 dark:border-white/[0.05]">
                                            <h4 className="text-[11px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-white/30 mb-5">Courses Taught</h4>
                                            {profDetail.courses.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {profDetail.courses.map(code => (
                                                        <span key={code} className="px-3 py-1.5 text-xs font-mono text-neutral-700 dark:text-white/70 bg-black/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.08] hover:bg-black/10 dark:hover:bg-white/[0.08] hover:border-black/30 dark:hover:border-white/20 transition-all rounded cursor-default">
                                                            {code}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-neutral-400 dark:text-white/30 font-light italic">No known courses for upcoming semester.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}