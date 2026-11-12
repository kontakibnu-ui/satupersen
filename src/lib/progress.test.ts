import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  dimensionAverages,
  monthlyAverages,
  periodDeltaPct,
  sinceStartPct,
  windowAverage,
  type ScoredDay,
} from "@/lib/progress";

const END = "2026-10-29";

/** Scores for consecutive days ending `endOffset` days before END, oldest first. */
function run(scores: number[], endOffset = 0): ScoredDay[] {
  return scores.map((score, index) => ({
    date: addDays(END, -endOffset - (scores.length - 1 - index)),
    score,
  }));
}

describe("windowAverage", () => {
  it("averages only the scored days inside the window", () => {
    const days = run([60, 70, 80], 0);
    expect(windowAverage(days, END, 7)).toEqual({ average: 70, scoredDays: 3 });
  });

  it("includes both ends of the window and nothing outside it", () => {
    const days: ScoredDay[] = [
      { date: addDays(END, -7), score: 10 }, // one day too old for a 7 day window
      { date: addDays(END, -6), score: 40 }, // first day inside
      { date: END, score: 60 }, // last day inside
      { date: addDays(END, 1), score: 100 }, // tomorrow is outside
    ];

    expect(windowAverage(days, END, 7)).toEqual({ average: 50, scoredDays: 2 });
  });

  it("is null with no data instead of zero", () => {
    expect(windowAverage([], END, 7)).toEqual({ average: null, scoredDays: 0 });
  });

  it("rejects a window that is not a positive whole number", () => {
    expect(() => windowAverage([], END, 0)).toThrow();
    expect(() => windowAverage([], END, 1.5)).toThrow();
  });
});

describe("periodDeltaPct (DASH-1)", () => {
  const stats = (average: number | null, scoredDays: number) => ({ average, scoredDays });

  it("is the percent change from the previous period", () => {
    expect(periodDeltaPct(stats(75, 5), stats(50, 5))).toBe(50);
    expect(periodDeltaPct(stats(45, 5), stats(60, 5))).toBe(-25);
  });

  it("rounds to one decimal", () => {
    expect(periodDeltaPct(stats(70, 4), stats(60, 4))).toBe(16.7);
  });

  it("is null until both periods have three scored days", () => {
    expect(periodDeltaPct(stats(70, 2), stats(60, 7))).toBeNull();
    expect(periodDeltaPct(stats(70, 7), stats(60, 2))).toBeNull();
    expect(periodDeltaPct(stats(70, 3), stats(60, 3))).toBe(16.7);
  });

  it("is null when a period has no data", () => {
    expect(periodDeltaPct(stats(null, 0), stats(60, 5))).toBeNull();
    expect(periodDeltaPct(stats(60, 5), stats(null, 0))).toBeNull();
  });

  it("is null when the previous average is below 1, to avoid dividing by almost nothing", () => {
    expect(periodDeltaPct(stats(50, 5), stats(0.5, 5))).toBeNull();
  });
});

describe("sinceStartPct (PRD.md §5)", () => {
  const sevenOf = (value: number) => Array<number>(7).fill(value);

  it("compares the latest 7 scored days with the first 7", () => {
    expect(sinceStartPct({ totalScoredDays: 20, firstScores: sevenOf(50), lastScores: sevenOf(56) })).toBe(12);
  });

  it("can be negative", () => {
    expect(sinceStartPct({ totalScoredDays: 20, firstScores: sevenOf(60), lastScores: sevenOf(54) })).toBe(-10);
  });

  it("appears at exactly 14 scored days and not before", () => {
    const groups = { firstScores: sevenOf(50), lastScores: sevenOf(60) };
    expect(sinceStartPct({ totalScoredDays: 13, ...groups })).toBeNull();
    expect(sinceStartPct({ totalScoredDays: 14, ...groups })).toBe(20);
  });

  it("is null when a group is short of 7 scores", () => {
    expect(sinceStartPct({ totalScoredDays: 20, firstScores: [50, 50], lastScores: sevenOf(60) })).toBeNull();
  });

  it("is null when the first average is below 1", () => {
    expect(sinceStartPct({ totalScoredDays: 20, firstScores: sevenOf(0), lastScores: sevenOf(60) })).toBeNull();
  });
});

describe("monthlyAverages", () => {
  it("returns the requested months oldest first, across a year boundary", () => {
    const result = monthlyAverages([], "2026-02-10", 4);
    expect(result.map((month) => month.month)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("averages each month and leaves an empty month as null", () => {
    const days: ScoredDay[] = [
      { date: "2026-08-03", score: 40 },
      { date: "2026-08-20", score: 60 },
      { date: "2026-10-01", score: 90 },
    ];

    expect(monthlyAverages(days, END, 3)).toEqual([
      { month: "2026-08", average: 50, scoredDays: 2 },
      { month: "2026-09", average: null, scoredDays: 0 },
      { month: "2026-10", average: 90, scoredDays: 1 },
    ]);
  });
});

describe("dimensionAverages", () => {
  it("averages each dimension over the days that had it, in display order", () => {
    const rows = [
      [
        { name: "mood", weight: 0.5, value: 50 },
        { name: "habits", weight: 0.5, value: 100 },
      ],
      [{ name: "mood", weight: 1, value: 70 }],
    ];

    expect(dimensionAverages(rows)).toEqual([
      { name: "habits", average: 100, days: 1 },
      { name: "mood", average: 60, days: 2 },
    ]);
  });

  it("skips a row that is not the expected shape instead of failing", () => {
    const rows = [null, "text", { name: "mood" }, [{ name: "unknown", value: 5 }], [{ name: "mood", value: 40 }]];
    expect(dimensionAverages(rows)).toEqual([{ name: "mood", average: 40, days: 1 }]);
  });

  it("is empty when no day has dimension data", () => {
    expect(dimensionAverages([])).toEqual([]);
  });
});
