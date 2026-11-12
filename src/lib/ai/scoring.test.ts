import { describe, expect, it } from "vitest";
import { computeDailyScore, dailyDeltaPoints, DIMENSION_WEIGHTS } from "@/lib/ai/scoring";

const baseInput = {
  activeHabitCount: 0,
  completedHabitCount: 0,
  aiDimensionScore: null,
  mood: null,
  energy: null,
  spentToday: 0,
  monthlyBudget: null,
  monthIncomeToDate: 0,
  monthSpentToDate: 0,
  daysInMonth: 30,
};

describe("computeDailyScore", () => {
  it("uses the published weights when every dimension has data", () => {
    // habits 1/2 = 50; productivity 7 * 10 = 70; mood (4 + 3) / 2 = 3.5 -> 62.5;
    // finance 45.000 of a 100.000 daily budget -> 100.
    // 50*0.30 + 70*0.30 + 62.5*0.25 + 100*0.15 = 66.625 -> 67
    const result = computeDailyScore({
      ...baseInput,
      activeHabitCount: 2,
      completedHabitCount: 1,
      aiDimensionScore: 7,
      mood: 4,
      energy: 3,
      spentToday: 45_000,
      monthlyBudget: 3_000_000,
    });

    expect(result.score).toBe(67);
    expect(result.dimensions).toEqual([
      { name: "habits", weight: DIMENSION_WEIGHTS.habits, value: 50 },
      { name: "productivity", weight: DIMENSION_WEIGHTS.productivity, value: 70 },
      { name: "mood", weight: DIMENSION_WEIGHTS.mood, value: 62.5 },
      { name: "finance", weight: DIMENSION_WEIGHTS.finance, value: 100 },
    ]);
  });

  it("drops missing dimensions and shares their weight out again", () => {
    // No budget, so the remaining weights are 0.30 + 0.30 + 0.25 = 0.85.
    // (50*0.30 + 70*0.30 + 62.5*0.25) / 0.85 = 51.625 / 0.85 = 60.73... -> 61
    const result = computeDailyScore({
      ...baseInput,
      activeHabitCount: 2,
      completedHabitCount: 1,
      aiDimensionScore: 7,
      mood: 4,
      energy: 3,
    });

    expect(result.score).toBe(61);
    expect(result.dimensions.map((dimension) => dimension.name)).toEqual([
      "habits",
      "productivity",
      "mood",
    ]);

    const weightTotal = result.dimensions.reduce((total, dimension) => total + dimension.weight, 0);
    expect(weightTotal).toBeCloseTo(1, 10);
    expect(result.dimensions[0].weight).toBeCloseTo(0.3 / 0.85, 10);
  });

  it("scores a single dimension at full weight", () => {
    const result = computeDailyScore({ ...baseInput, mood: 5, energy: 5 });

    expect(result.score).toBe(100);
    expect(result.dimensions).toEqual([{ name: "mood", weight: 1, value: 100 }]);
  });

  it("scores the lowest mood and energy at zero", () => {
    const result = computeDailyScore({ ...baseInput, mood: 1, energy: 1 });

    expect(result.score).toBe(0);
  });

  it("uses the single mood answer when energy is missing", () => {
    // mood 3 -> (3 - 1) / 4 * 100 = 50
    const result = computeDailyScore({ ...baseInput, mood: 3 });

    expect(result.dimensions).toEqual([{ name: "mood", weight: 1, value: 50 }]);
  });

  it("returns no score when nothing has data", () => {
    const result = computeDailyScore(baseInput);

    expect(result.score).toBeNull();
    expect(result.dimensions).toEqual([]);
  });

  it("counts a day with no habits created as missing habit data", () => {
    const result = computeDailyScore({ ...baseInput, aiDimensionScore: 10 });

    expect(result.dimensions).toEqual([{ name: "productivity", weight: 1, value: 100 }]);
    expect(result.score).toBe(100);
  });

  it.each([
    { spent: 0, expected: 100 },
    { spent: 50_000, expected: 100 },
    { spent: 75_000, expected: 50 },
    { spent: 100_000, expected: 0 },
    { spent: 250_000, expected: 0 },
  ])("finance score for spending $spent with a 50.000 daily budget", ({ spent, expected }) => {
    // monthlyBudget 1.500.000 over 30 days -> 50.000 per day.
    const result = computeDailyScore({
      ...baseInput,
      spentToday: spent,
      monthlyBudget: 1_500_000,
    });

    expect(result.dimensions).toEqual([{ name: "finance", weight: 1, value: expected }]);
  });

  it.each([
    { income: 5_000_000, spent: 0, expected: 100 },
    { income: 5_000_000, spent: 4_000_000, expected: 100 },
    { income: 5_000_000, spent: 4_500_000, expected: 50 },
    { income: 5_000_000, spent: 5_000_000, expected: 0 },
    { income: 5_000_000, spent: 7_000_000, expected: 0 },
  ])(
    "finance score keeps a fifth of $income as the full mark: spent $spent -> $expected (EXP-5)",
    ({ income, spent, expected }) => {
      const result = computeDailyScore({
        ...baseInput,
        monthIncomeToDate: income,
        monthSpentToDate: spent,
      });

      expect(result.dimensions).toEqual([{ name: "finance", weight: 1, value: expected }]);
    },
  );

  it("income logged this month wins over the budget; no income falls back to the budget (EXP-4, EXP-5)", () => {
    const withBudget = { ...baseInput, spentToday: 250_000, monthlyBudget: 1_500_000 };

    expect(computeDailyScore(withBudget).dimensions).toEqual([{ name: "finance", weight: 1, value: 0 }]);
    expect(
      computeDailyScore({ ...withBudget, monthIncomeToDate: 5_000_000, monthSpentToDate: 250_000 })
        .dimensions,
    ).toEqual([{ name: "finance", weight: 1, value: 100 }]);
  });

  it("income alone, with no budget, gives a finance dimension for a free account", () => {
    const result = computeDailyScore({ ...baseInput, monthIncomeToDate: 1_000_000 });

    expect(result.dimensions).toEqual([{ name: "finance", weight: 1, value: 100 }]);
  });

  it("rejects input that cannot come from the database", () => {
    expect(() => computeDailyScore({ ...baseInput, mood: 6 })).toThrow(/mood/);
    expect(() => computeDailyScore({ ...baseInput, mood: 0 })).toThrow(/mood/);
    expect(() => computeDailyScore({ ...baseInput, energy: 2.5 })).toThrow(/energy/);
    expect(() => computeDailyScore({ ...baseInput, aiDimensionScore: 11 })).toThrow(
      /aiDimensionScore/,
    );
    expect(() => computeDailyScore({ ...baseInput, activeHabitCount: 2, completedHabitCount: 3 })).toThrow(
      /completedHabitCount/,
    );
    expect(() => computeDailyScore({ ...baseInput, spentToday: -1 })).toThrow(/spentToday/);
    expect(() => computeDailyScore({ ...baseInput, monthlyBudget: 0 })).toThrow(/monthlyBudget/);
    expect(() => computeDailyScore({ ...baseInput, monthIncomeToDate: -1 })).toThrow(/monthIncomeToDate/);
    expect(() => computeDailyScore({ ...baseInput, monthSpentToDate: 1.5 })).toThrow(/monthSpentToDate/);
    expect(() => computeDailyScore({ ...baseInput, daysInMonth: 0 })).toThrow(/daysInMonth/);
    expect(() => computeDailyScore({ ...baseInput, daysInMonth: 32 })).toThrow(/daysInMonth/);
  });
});

describe("dailyDeltaPoints", () => {
  it("is the difference in points from the previous scored day (SCORE-2)", () => {
    expect(dailyDeltaPoints(78, 76)).toBe(2);
    expect(dailyDeltaPoints(77, 80)).toBe(-3);
    expect(dailyDeltaPoints(70, 70)).toBe(0);
  });

  it("stays modest where a ratio would not: 30 to 60 is 30, not 100", () => {
    expect(dailyDeltaPoints(60, 30)).toBe(30);
    expect(dailyDeltaPoints(60, 1)).toBe(59);
    expect(dailyDeltaPoints(60, 0)).toBe(60);
  });

  it("returns null when there is no earlier scored day", () => {
    expect(dailyDeltaPoints(74, null)).toBeNull();
  });

  it("rejects scores outside 0 to 100", () => {
    expect(() => dailyDeltaPoints(101, 70)).toThrow(/todayScore/);
    expect(() => dailyDeltaPoints(-1, 70)).toThrow(/todayScore/);
    expect(() => dailyDeltaPoints(74, 120)).toThrow(/previousScore/);
  });
});

describe("habit counts beyond the free plan", () => {
  it("scores an account with more than 50 active habits instead of throwing (HABIT-3 is free only)", () => {
    const result = computeDailyScore({
      activeHabitCount: 60,
      completedHabitCount: 30,
      aiDimensionScore: null,
      mood: null,
      energy: null,
      spentToday: 0,
      monthlyBudget: null,
      monthIncomeToDate: 0,
      monthSpentToDate: 0,
      daysInMonth: 30,
    });

    expect(result.score).toBe(50);
    expect(result.dimensions).toEqual([{ name: "habits", weight: 1, value: 50 }]);
  });
});
