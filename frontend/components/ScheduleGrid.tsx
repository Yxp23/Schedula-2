'use client';

import { motion } from 'framer-motion';

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
  };
}

const parseTime = (timeStr: string) => {
  // Parses "09:05" to 9.0833 (hours)
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
};

const DAYS = [
  { key: 'M', label: 'Mon' },
  { key: 'T', label: 'Tue' },
  { key: 'W', label: 'Wed' },
  { key: 'R', label: 'Thu' },
  { key: 'F', label: 'Fri' }
];

const COLORS = [
  'bg-emerald-500/40 border-emerald-500/50',
  'bg-blue-500/40 border-blue-500/50',
  'bg-purple-500/40 border-purple-500/50',
  'bg-amber-500/40 border-amber-500/50',
  'bg-rose-500/40 border-rose-500/50',
  'bg-indigo-500/40 border-indigo-500/50',
];

export default function ScheduleGrid({ schedule }: { schedule: ScheduledSection[] }) {
  const earliestHour = 8; // 8:00 AM
  const latestHour = 20; // 8:00 PM
  const totalHours = latestHour - earliestHour;
  
  // Create an array of hour labels [8, 9, 10...]
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => earliestHour + i);

  return (
    <div className="w-full bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header (Days) */}
        <div className="flex ml-16 mb-4 border-b border-white/[0.05] pb-2">
          {DAYS.map(day => (
            <div key={day.key} className="flex-1 text-center">
              <span className="text-[11px] uppercase tracking-[0.2em] font-medium text-white/40">{day.label}</span>
            </div>
          ))}
        </div>

        {/* Grid Container */}
        <div className="relative flex">
          {/* Time Sidebar */}
          <div className="w-16 flex flex-col pt-1 border-r border-white/[0.05]">
            {hours.map(hour => (
              <div key={hour} className="h-[60px] relative">
                <span className="absolute -top-3 right-4 text-[10px] text-white/30 tracking-wider">
                  {hour > 12 ? `${hour-12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Grid Columns for Days */}
          <div className="flex-1 flex relative h-[720px]">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              {hours.map(hour => (
                <div key={hour} className="h-[60px] border-b border-white/[0.02] w-full" />
              ))}
            </div>

            {/* Day Columns */}
            {DAYS.map((day, dIdx) => (
              <div key={day.key} className="flex-1 relative border-r border-white/[0.02] last:border-0">
                {schedule.map((section, sIdx) => {
                  if (!section.days.includes(day.key)) return null;

                  const colorClass = COLORS[sIdx % COLORS.length];
                  
                  const startHour = parseTime(section.start_time);
                  const endHour = parseTime(section.end_time);
                  
                  // Calculate pixels based on 60px per hour
                  const top = (startHour - earliestHour) * 60;
                  const height = (endHour - startHour) * 60;

                  return (
                    <motion.div
                      key={`${section.section_id}-${day.key}`}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: dIdx * 0.1 + sIdx * 0.05, duration: 0.4 }}
                      className={`absolute left-0.5 right-0.5 rounded-lg p-1.5 border backdrop-blur-md shadow-2xl overflow-hidden group cursor-pointer text-white z-10 hover:z-20 hover:h-auto hover:min-h-full ${colorClass}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="font-bold text-[10px] leading-tight drop-shadow-md truncate">{section.course_code}</div>
                      <div className="text-[9px] opacity-90 leading-snug drop-shadow-md truncate">{section.start_time}-{section.end_time}</div>
                      <div className="text-[8px] opacity-75 uppercase tracking-wide truncate drop-shadow-md mt-0.5">{section.location}</div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
