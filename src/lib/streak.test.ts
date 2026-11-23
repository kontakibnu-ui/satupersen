import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { streakAtRisk, streakLength } from "@/lib/streak";

const TODAY = "2026-10-29";

/** Days counted back from today: 0 is today, 1 is yesterday. */
const done = (...offsets: number[]) => offsets.map((offset) => addDays(TODAY, -offset));

describe("streakLength: don't miss twice (PRD.md §5)", () => {
  it("is 0 when nothing was ever done", () => {
    expect(streakLength([], TODAY)).toBe(0);
  });

  it("counts consecutive days including today", () => {
    expect(streakLength(done(0, 1, 2, 3), TODAY)).toBe(4);
  });

  it("does not count today as a miss while it is still in progress", () => {
    expect(streakLength(done(1, 2, 3), TODAY)).toBe(3);
  });

  it("is not broken by one missed day, and the missed day is not counted", () => {
    // Done today, missed yesterday, done the three days before.
    expect(streakLength(done(0, 2, 3, 4), TODAY)).toBe(4);
  });

  it("is not broken by one missed day that is yesterday while today is open", () => {
    expect(streakLength(done(2, 3, 4), TODAY)).toBe(3);
  });

  it("is broken by two missed days in a row", () => {
    // Done today, missed yesterday and the day before, done earlier.
    expect(streakLength(done(0, 3, 4, 5), TODAY)).toBe(1);
  });

  it("is 0 when yesterday and the day before were both missed and today is open", () => {
    expect(streakLength(done(3, 4, 5), TODAY)).toBe(0);
  });

  it("survives several single misses spread out", () => {
    // Pattern: done, miss, done, miss, done, miss, done.
    expect(streakLength(done(0, 2, 4, 6), TODAY)).toBe(4);
  });

  it("stops at the first double miss even when older days were done", () => {
    expect(streakLength(done(0, 1, 4, 5, 6, 7), TODAY)).toBe(2);
  });

  it("ignores days after today", () => {
    expect(streakLength([addDays(TODAY, 1), addDays(TODAY, 2)], TODAY)).toBe(0);
    expect(streakLength([...done(0, 1), addDays(TODAY, 1)], TODAY)).toBe(2);
  });

  it("counts a duplicated day once", () => {
    expect(streakLength([TODAY, TODAY, addDays(TODAY, -1)], TODAY)).toBe(2);
  });

  it("works across a month and year boundary", () => {
    expect(streakLength(["2026-12-30", "2026-12-31", "2027-01-01"], "2027-01-01")).toBe(3);
    expect(streakLength(["2026-02-27", "2026-03-01"], "2026-03-01")).toBe(2);
  });

  it("handles a long run without recursion or large loops outside the done range", () => {
    const longRun = Array.from({ length: 400 }, (_, index) => addDays(TODAY, -index));
    expect(streakLength(longRun, TODAY)).toBe(400);
  });
});

describe("streakAtRisk: the 'Kemarin terlewat' note (DESIGN.md §15.7)", () => {
  it("is true when yesterday was missed, today is open, and the streak is alive", () => {
    expect(streakAtRisk(done(2, 3, 4), TODAY)).toBe(true);
  });

  it("is false once today is checked", () => {
    expect(streakAtRisk(done(0, 2, 3), TODAY)).toBe(false);
  });

  it("is false when yesterday was done", () => {
    expect(streakAtRisk(done(1, 2), TODAY)).toBe(false);
  });

  it("is false after two missed days, when the streak has already ended", () => {
    expect(streakAtRisk(done(3, 4, 5), TODAY)).toBe(false);
  });

  it("is false for a habit that was never checked", () => {
    expect(streakAtRisk([], TODAY)).toBe(false);
  });
});
