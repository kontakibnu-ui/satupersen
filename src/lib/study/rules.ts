/**
 * Input rules of Belajar (PRD.md LEARN-1, LEARN-2, LEARN-4) that the forms and
 * the server actions both need. Kept apart from the "use server" file, which may
 * only export async functions. The database repeats the same caps in its check
 * constraints (supabase/migrations/20261115000000_study_and_rate_limits.sql).
 */
export const MAX_TITLE_LENGTH = 120;
export const MAX_SOURCE_LENGTH = 5000;
export const MAX_EXPLANATION_LENGTH = 3000;
export const MAX_ANSWER_LENGTH = 1000;

/** The user's own rating after seeing the answer; it alone moves the schedule (LEARN-3). */
export const RATINGS = ["forgot", "unsure", "remembered"] as const;

export type Rating = (typeof RATINGS)[number];

export const RATING_LABELS: Record<Rating, string> = {
  forgot: "Lupa",
  unsure: "Ragu",
  remembered: "Ingat",
};
