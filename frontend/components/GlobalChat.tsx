'use client';

import { useStudentContext } from './StudentProvider';
import AIChatWidget from './AIChatWidget';
import { usePathname } from 'next/navigation';

/**
 * Global AI Chat wrapper that lives in the root layout.
 * Provides full student context (audit, recommendations, schedule) to the chat widget.
 * Skips rendering on the landing page for a cleaner look.
 */
export default function GlobalChat() {
  const { audit, recommendations, completedCourses } = useStudentContext();
  const pathname = usePathname();

  // Don't show the chat fab on the landing page
  if (pathname === '/') return null;

  // Build rich context for the AI
  const fullContext = {
    currentPage: pathname,
    degreeProgress: audit ? {
      track: audit.track_name,
      progress: `${audit.progress_percentage}%`,
      creditsEarned: audit.total_credits_earned,
      creditsRequired: audit.total_credits_required,
      categories: (audit.categories || []).map(c => ({
        name: c.name,
        complete: c.is_complete,
        earned: c.credits_earned,
        required: c.credits_required,
      })),
    } : null,
    completedCourses: completedCourses.map(c => c.code),
    topRecommendations: recommendations.slice(0, 30).map(r => ({
      code: r.course.code,
      title: r.course.title,
      credits: r.course.credits,
      requirement: r.requirement,
      reason: r.reason,
      professorName: r.best_section?.professor?.name || 'TBA',
      professorRating: r.best_section?.professor?.rating,
      days: r.best_section?.days || 'TBA',
      time: r.best_section ? `${r.best_section.start_time}–${r.best_section.end_time}` : 'TBA',
      seatsOpen: r.best_section?.seats_open,
      seatsTotal: r.best_section?.seats_total,
      hasOpenSeats: r.has_open_sections,
    })),
  };

  return <AIChatWidget activeSchedule={fullContext} />;
}
