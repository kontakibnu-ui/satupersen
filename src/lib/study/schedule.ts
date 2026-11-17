import { addDays, formatDayLabel, type DateKey } from "@/lib/dates";
import type { Rating } from "@/lib/study/rules";

/**
 * The review schedule of Belajar (PRD.md LEARN-3). Computed here, in code, and
 * never by the model: the user's own rating moves a question along.
 *
 * Gaps in days between reviews. A question starts at step 0 (due the day after
 * the material is checked) and climbs one step each time it is remembered.
 * After the 30 day gap it is finished and has no due date.
 */
export const REVIEW_GAPS = [1, 3, 7, 14, 30] as const;

/** The step of a finished question. */
export const FINISHED_STEP = REVIEW_GAPS.length;

export type QuestionSchedule = { step: number; dueDate: DateKey | null };

/** Every question of a material that has just been checked for the first time. */
export function firstSchedule(activatedOn: DateKey): QuestionSchedule {
  return { step: 0, dueDate: addDays(activatedOn, REVIEW_GAPS[0]) };
}

/**
 * Where a question goes after a review on `reviewedOn` (the user's local day):
 * - remembered: the next gap, or finished after the last one;
 * - unsure: the same gap again;
 * - forgot: back to the first gap.
 * Counted from the day of the review, so a late review never schedules into the past.
 */
export function nextSchedule(currentStep: number, rating: Rating, reviewedOn: DateKey): QuestionSchedule {
  if (!Number.isInteger(currentStep) || currentStep < 0 || currentStep >= FINISHED_STEP) {
    throw new Error(`A question at step ${currentStep} cannot be reviewed`);
  }

  if (rating === "forgot") {
    return { step: 0, dueDate: addDays(reviewedOn, REVIEW_GAPS[0]) };
  }

  if (rating === "unsure") {
    return { step: currentStep, dueDate: addDays(reviewedOn, REVIEW_GAPS[currentStep]) };
  }

  const step = currentStep + 1;

  return step >= FINISHED_STEP
    ? { step: FINISHED_STEP, dueDate: null }
    : { step, dueDate: addDays(reviewedOn, REVIEW_GAPS[step]) };
}

export function isDue(dueDate: DateKey | null, today: DateKey): boolean {
  return dueDate !== null && dueDate <= today;
}

export type MaterialState =
  | { kind: "draft" }
  | { kind: "due"; dueCount: number }
  | { kind: "waiting"; nextDue: DateKey }
  | { kind: "finished" };

/**
 * What a material asks of the user today, from its status and the due dates of
 * its questions. An active material without questions cannot happen through the
 * app; it reads as a draft so the user can check it again.
 */
export function materialState(
  status: "draft" | "active",
  dueDates: (DateKey | null)[],
  today: DateKey,
): MaterialState {
  if (status === "draft" || dueDates.length === 0) {
    return { kind: "draft" };
  }

  const dueCount = dueDates.filter((dueDate) => isDue(dueDate, today)).length;

  if (dueCount > 0) {
    return { kind: "due", dueCount };
  }

  const upcoming = dueDates.filter((dueDate): dueDate is DateKey => dueDate !== null).sort();

  return upcoming.length > 0 ? { kind: "waiting", nextDue: upcoming[0] } : { kind: "finished" };
}

/** "hari ini", "besok", or "Kamis, 19 November", for the line under a material or a question. */
export function reviewDayLabel(dueDate: DateKey, today: DateKey): string {
  if (dueDate <= today) {
    return "hari ini";
  }

  if (dueDate === addDays(today, 1)) {
    return "besok";
  }

  return formatDayLabel(dueDate);
}
