'use client';

import { motion } from 'framer-motion';

interface ScheduledSection {
  section_id: number;
  section_number: string;
  course_code: string;
  course_title: string;
  days: string;
  start_time: string;
  end_time: string;
  location: string;
  professor: {
    name: string;
    rating: number | null;
  };
}

export default function CalendarGrid({ schedule }: { schedule: ScheduledSection[] }) {
  const START_MINUTES = 8 * 60; // 8:00 AM
  const END_MINUTES = 18 * 60; // 6:00 PM
  const TOTAL_MINUTES = END_MINUTES - START_MINUTES;

  const daysOfWeek = [
    { label: 'Monday', id: 'M' },
    { label: 'Tuesday', id: 'T' },
    { label: 'Wednesday', id: 'W' },
    { label: 'Thursday', id: 'R' },
    { label: 'Friday', id: 'F' }
  ];

  // Helper to convert 'HH:MM' to minutes since midnight
  const timeToMins = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const hours = Array.from({ length: 10 }, (_, i) => i + 8); // 8, 9, 10... 17

  return (
    <div className="bg-white dark:bg-[#050505] border border-black/10 dark:border-white/[0.05] rounded-3xl overflow-hidden mt-8 shadow-2xl">
      {/* Header */}
      <div className="grid grid-cols-6 border-b border-black/10 dark:border-white/[0.05] bg-zinc-50 dark:bg-white/[0.01]">
        <div className="py-4 text-center border-r border-black/5 dark:border-white/[0.02]">
          <span className="text-[9px] uppercase tracking-[0.2em] font-medium text-neutral-400 dark:text-white/30">Time</span>
        </div>
        {daysOfWeek.map(day => (
          <div key={day.id} className="py-4 text-center border-r border-black/5 dark:border-white/[0.02] last:border-r-0">
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-600 dark:text-white/60">{day.label}</span>
          </div>
        ))}
      </div>

      {/* Grid Canvas */}
      <div className="relative grid grid-cols-6" style={{ height: '700px' }}>
        {/* Background Hour Lines */}
        <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between">
            {hours.map(h => (
                <div key={h} className="w-full h-px bg-black/5 dark:bg-white/[0.03] relative">
                    <span className="absolute -top-3 left-4 text-[10px] font-mono text-neutral-400 dark:text-white/20">
                        {h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}
                    </span>
                </div>
            ))}
        </div>

        {/* Time Column Placeholder */}
        <div className="border-r border-black/5 dark:border-white/[0.02] relative z-10 bg-zinc-50 dark:bg-black/20" />

        {/* Day Columns */}
        {daysOfWeek.map((day, colIdx) => {
          // Find sections that occur on this day
          const daySections = schedule.filter(s => s.days && s.days.includes(day.id));
          
          return (
            <div key={day.id} className="border-r border-black/5 dark:border-white/[0.02] last:border-r-0 relative pt-0">
              {daySections.map(sec => {
                const sMins = timeToMins(sec.start_time);
                const eMins = timeToMins(sec.end_time);
                if (sMins < START_MINUTES || eMins > END_MINUTES) return null; // Outside bounds
                
                const topPcnt = ((sMins - START_MINUTES) / TOTAL_MINUTES) * 100;
                const heightPcnt = ((eMins - sMins) / TOTAL_MINUTES) * 100;

                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 * colIdx }}
                    key={sec.section_id}
                    className="absolute left-2 right-2 rounded-xl p-3 border border-black/10 dark:border-white/10 backdrop-blur-md overflow-hidden group cursor-pointer bg-white dark:bg-white/5 shadow-sm dark:shadow-none"
                    style={{
                      top: `${topPcnt}%`,
                      height: `${heightPcnt}%`
                    }}
                  >
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <span className="text-[9px] font-mono tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 block">
                                {sec.course_code}
                            </span>
                            <h4 className="text-xs font-medium text-neutral-900 dark:text-white/90 leading-tight">
                                {sec.course_title}
                            </h4>
                        </div>
                        <div className="text-[9px] text-neutral-500 dark:text-white/40 mt-1">
                            <div className="truncate mb-0.5">{sec.location}</div>
                            <div className="font-medium text-neutral-800 dark:text-white/60">{sec.professor.name}</div>
                        </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
