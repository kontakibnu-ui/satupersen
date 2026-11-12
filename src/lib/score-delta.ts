import { id as indonesianLocale } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { daysBetween, type DateKey } from "@/lib/dates";

/**
 * How a day's score is put into words (SCORE-2, user decision 2026-11-01): not
 * "78/100" but "Kamu 2% lebih baik dibanding kemarin", against the last scored
 * day before it. The number is the difference in points (scoring.ts).
 */

/**
 * The day the score is compared with, as it reads after "dibanding":
 * "kemarin", "hari Kamis" within the last week, "12 Oktober" further back.
 */
export function comparedToLabel(today: DateKey, previous: DateKey): string {
  const gap = daysBetween(previous, today);

  if (gap < 1) {
    throw new Error(`previous (${previous}) must be before today (${today})`);
  }

  if (gap === 1) {
    return "kemarin";
  }

  const instant = new Date(`${previous}T00:00:00Z`);
  const format = (pattern: string) => formatInTimeZone(instant, "UTC", pattern, { locale: indonesianLocale });

  return gap < 7 ? `hari ${format("EEEE")}` : format("d MMMM");
}

/** The line under the stamp and the first line of the WhatsApp summary. */
export function deltaSentence(delta: number | null, comparedTo: string | null): string {
  if (delta === null || comparedTo === null) {
    return "Ini analisa pertamamu. Mulai besok kamu bisa lihat perbandingannya.";
  }

  if (delta > 0) {
    return `Kamu ${delta}% lebih baik dibanding ${comparedTo}`;
  }

  // A lower day reads as calmly as a better one (DESIGN.md §6: never red).
  if (delta < 0) {
    return `Turun ${Math.abs(delta)}% dibanding ${comparedTo}`;
  }

  return `Stabil, sama seperti ${comparedTo}`;
}

/** The short figure inside the stamp: "+2%", "−3%", "0%". */
export function deltaFigure(delta: number): string {
  if (delta > 0) {
    return `+${delta}%`;
  }

  return delta < 0 ? `−${Math.abs(delta)}%` : "0%";
}
