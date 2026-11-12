import { z } from "zod";
import { addDays, type DateKey } from "@/lib/dates";

/**
 * The numbers on the Progres screen (DASH-1, PRD.md §5). Pure functions over
 * scored days, so they are tested without a database and the screen only draws
 * what they return.
 */

export type ScoredDay = { date: DateKey; score: number };

export type WindowStats = {
  /** Mean score of the scored days in the window, or null when there are none. */
  average: number | null;
  scoredDays: number;
};

/**
 * A comparison needs enough days on both sides to mean anything. Three is the
 * same floor SCORE-2 uses for the daily percentage.
 */
export const MIN_SCORED_DAYS_FOR_DELTA = 3;

/** PRD.md §5: "sejak mulai" appears after at least 14 scored days. */
export const MIN_SCORED_DAYS_SINCE_START = 14;

const roundTo1 = (value: number): number => Math.round(value * 10) / 10;

/** Scored days from `length` days ending at `endKey` (inclusive), oldest first. */
function inWindow(days: ScoredDay[], endKey: DateKey, length: number): ScoredDay[] {
  const startKey = addDays(endKey, -(length - 1));

  return days
    .filter((day) => day.date >= startKey && day.date <= endKey)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Average score over the `length` days that end at `endKey`. */
export function windowAverage(days: ScoredDay[], endKey: DateKey, length: number): WindowStats {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error(`length must be a positive integer, received: ${length}`);
  }

  const scored = inWindow(days, endKey, length);

  if (scored.length === 0) {
    return { average: null, scoredDays: 0 };
  }

  const total = scored.reduce((sum, day) => sum + day.score, 0);

  return { average: total / scored.length, scoredDays: scored.length };
}

/**
 * Percent change from the previous period to this one. Null when either side has
 * fewer than three scored days, or when the previous average is below 1, where a
 * percentage would divide by almost nothing (the same guard as SCORE-2).
 */
export function periodDeltaPct(current: WindowStats, previous: WindowStats): number | null {
  if (
    current.average === null ||
    previous.average === null ||
    current.scoredDays < MIN_SCORED_DAYS_FOR_DELTA ||
    previous.scoredDays < MIN_SCORED_DAYS_FOR_DELTA ||
    previous.average < 1
  ) {
    return null;
  }

  return roundTo1(((current.average - previous.average) / previous.average) * 100);
}

/**
 * PRD.md §5 "Sejak mulai": the average of the latest 7 scored days against the
 * average of the first 7 scored days. `firstScores` and `lastScores` are those
 * two groups of up to 7 scores each; `totalScoredDays` is how many scored days
 * the user has in all. Null before 14 scored days, so the two groups never
 * overlap, and null when the first average is below 1.
 */
export function sinceStartPct(input: {
  totalScoredDays: number;
  firstScores: number[];
  lastScores: number[];
}): number | null {
  if (
    input.totalScoredDays < MIN_SCORED_DAYS_SINCE_START ||
    input.firstScores.length < 7 ||
    input.lastScores.length < 7
  ) {
    return null;
  }

  const mean = (scores: number[]) => scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const first = mean(input.firstScores.slice(0, 7));
  const last = mean(input.lastScores.slice(0, 7));

  if (first < 1) {
    return null;
  }

  return roundTo1(((last - first) / first) * 100);
}

export type MonthlyAverage = {
  /** "yyyy-MM". */
  month: string;
  average: number | null;
  scoredDays: number;
};

/** The `months` calendar months ending with the month of `endKey`, oldest first. */
export function monthlyAverages(days: ScoredDay[], endKey: DateKey, months: number): MonthlyAverage[] {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error(`months must be a positive integer, received: ${months}`);
  }

  const endYear = Number(endKey.slice(0, 4));
  const endMonth = Number(endKey.slice(5, 7));
  const result: MonthlyAverage[] = [];

  for (let back = months - 1; back >= 0; back -= 1) {
    const index = endYear * 12 + (endMonth - 1) - back;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const scored = days.filter((day) => day.date.startsWith(key));

    result.push({
      month: key,
      average:
        scored.length === 0 ? null : scored.reduce((sum, day) => sum + day.score, 0) / scored.length,
      scoredDays: scored.length,
    });
  }

  return result;
}

const dimensionRowSchema = z.array(
  z.object({
    name: z.enum(["habits", "productivity", "mood", "finance"]),
    value: z.number().min(0).max(100),
  }),
);

export type DimensionName = "habits" | "productivity" | "mood" | "finance";

export type DimensionAverage = { name: DimensionName; average: number; days: number };

/** Display order on the screen, which follows the weights in PRD.md §5. */
const DIMENSION_ORDER: DimensionName[] = ["habits", "productivity", "mood", "finance"];

/**
 * Mean value of each dimension over the days that had it. Each row is the
 * `score_dimensions` JSON of one day; a row that is not in the expected shape is
 * skipped, so one odd row cannot take the screen down.
 */
export function dimensionAverages(rows: unknown[]): DimensionAverage[] {
  const totals = new Map<DimensionName, { sum: number; days: number }>();

  for (const row of rows) {
    const parsed = dimensionRowSchema.safeParse(row);

    if (!parsed.success) {
      continue;
    }

    for (const dimension of parsed.data) {
      const current = totals.get(dimension.name) ?? { sum: 0, days: 0 };
      totals.set(dimension.name, { sum: current.sum + dimension.value, days: current.days + 1 });
    }
  }

  return DIMENSION_ORDER.filter((name) => totals.has(name)).map((name) => {
    const { sum, days } = totals.get(name) as { sum: number; days: number };

    return { name, average: sum / days, days };
  });
}
