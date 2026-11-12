import { addDays, daysBetween, type DateKey } from "@/lib/dates";

/**
 * The "don't miss twice" streak from PRD.md §5 (Atomic Habits), used for habits
 * and for writing.
 *
 * - One missed day does not break the streak; two missed days in a row do.
 * - A missed day is bridged, not counted: the number is how many days were done.
 * - Today is still in progress. Not having done it yet is not a miss, so the
 *   streak a user sees in the morning is the one they had last night.
 *
 * Pure on purpose: it takes the done days and today's key, so tests can pin
 * both and the screen can recompute right after a tap without asking the server.
 */
export function streakLength(doneDays: Iterable<DateKey>, today: DateKey): number {
  const done = new Set(doneDays);

  let earliest: DateKey | null = null;
  for (const day of done) {
    // Days after today cannot be done yet; ignoring them keeps a bad row from
    // inflating the number.
    if (day > today) {
      done.delete(day);
      continue;
    }

    if (earliest === null || day < earliest) {
      earliest = day;
    }
  }

  if (earliest === null) {
    return 0;
  }

  const span = daysBetween(earliest, today);
  let count = 0;
  let missesInARow = 0;

  for (let offset = 0; offset <= span; offset += 1) {
    const day = addDays(today, -offset);

    if (done.has(day)) {
      count += 1;
      missesInARow = 0;
      continue;
    }

    if (offset === 0) {
      continue;
    }

    missesInARow += 1;

    if (missesInARow >= 2) {
      break;
    }
  }

  return count;
}
