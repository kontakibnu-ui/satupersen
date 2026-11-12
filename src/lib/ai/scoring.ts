/**
 * Daily score for Satu Persen, from PRD.md §5. SCORE-1: the score is computed
 * here in code, never by the model. The AI only supplies `aiDimensionScore`
 * between 0 and 10, and this module turns every dimension into 0 to 100.
 */

/** Provisional weights. PRD.md §11 keeps the final weights open. */
export const DIMENSION_WEIGHTS = {
  habits: 0.3,
  productivity: 0.3,
  mood: 0.25,
  finance: 0.15,
} as const;

export type DimensionName = keyof typeof DIMENSION_WEIGHTS;

export type ScoredDimension = {
  name: DimensionName;
  /** Share of the score this dimension ended up with, after redistribution. */
  weight: number;
  /** Dimension value, 0 to 100. */
  value: number;
};

export type DailyScoreInput = {
  /** Habits that are not archived. */
  activeHabitCount: number;
  /** Habits checked for that day. */
  completedHabitCount: number;
  /** 0 to 10 from the model, or null when the day has no summary yet. */
  aiDimensionScore: number | null;
  /** 1 to 5 each, or null when the user did not answer. */
  mood: number | null;
  energy: number | null;
  /** Rupiah spent that day. Zero is a real value, not missing data. */
  spentToday: number;
  /** Monthly budget in rupiah, or null for plans without a budget. */
  monthlyBudget: number | null;
  /** Income and spending from the 1st of the month through that day (EXP-5). */
  monthIncomeToDate: number;
  monthSpentToDate: number;
  /** Days in the month of that date, from the helpers in dates.ts. */
  daysInMonth: number;
};

export type DailyScore = {
  /** Null when no dimension has data, so no score can be shown. */
  score: number | null;
  dimensions: ScoredDimension[];
};

const clampTo100 = (value: number): number => Math.min(100, Math.max(0, value));

const roundTo1 = (value: number): number => Math.round(value * 10) / 10;

function assertIntegerInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, received: ${value}`);
  }
}

function assertNullableIntegerInRange(
  name: string,
  value: number | null,
  min: number,
  max: number,
): void {
  if (value === null) {
    return;
  }

  assertIntegerInRange(name, value, min, max);
}

function habitsValue(input: DailyScoreInput): number | null {
  if (input.activeHabitCount === 0) {
    return null;
  }

  return (input.completedHabitCount / input.activeHabitCount) * 100;
}

function moodValue(input: DailyScoreInput): number | null {
  const answers = [input.mood, input.energy].filter((answer): answer is number => answer !== null);

  if (answers.length === 0) {
    return null;
  }

  const average = answers.reduce((total, answer) => total + answer, 0) / answers.length;

  return ((average - 1) / 4) * 100;
}

function productivityValue(input: DailyScoreInput): number | null {
  return input.aiDimensionScore === null ? null : input.aiDimensionScore * 10;
}

/** Keeping a fifth of the month's income counts as a full finance dimension. */
export const SAVINGS_TARGET = 0.2;

/**
 * With income logged this month, the dimension is the share of it still unspent
 * so far, 0 at nothing kept (or less) and full at the savings target (PRD.md §5,
 * EXP-5). Without income it falls back to the budget: spending is compared to
 * the daily share of the monthly budget, full at or under it and linearly down
 * to zero at twice the daily budget. PRD.md §11 has not fixed these curves yet.
 */
function financeValue(input: DailyScoreInput): number | null {
  if (input.monthIncomeToDate > 0) {
    const kept = (input.monthIncomeToDate - input.monthSpentToDate) / input.monthIncomeToDate;

    return clampTo100((kept / SAVINGS_TARGET) * 100);
  }

  if (input.monthlyBudget === null) {
    return null;
  }

  const dailyBudget = input.monthlyBudget / input.daysInMonth;

  if (input.spentToday <= dailyBudget) {
    return 100;
  }

  return clampTo100((100 * (2 * dailyBudget - input.spentToday)) / dailyBudget);
}

export function computeDailyScore(input: DailyScoreInput): DailyScore {
  assertIntegerInRange("activeHabitCount", input.activeHabitCount, 0, 1000);
  assertIntegerInRange("completedHabitCount", input.completedHabitCount, 0, 1000);
  assertNullableIntegerInRange("aiDimensionScore", input.aiDimensionScore, 0, 10);
  assertNullableIntegerInRange("mood", input.mood, 1, 5);
  assertNullableIntegerInRange("energy", input.energy, 1, 5);
  assertIntegerInRange("spentToday", input.spentToday, 0, 2_000_000_000);
  assertIntegerInRange("daysInMonth", input.daysInMonth, 1, 31);
  assertIntegerInRange("monthIncomeToDate", input.monthIncomeToDate, 0, Number.MAX_SAFE_INTEGER);
  assertIntegerInRange("monthSpentToDate", input.monthSpentToDate, 0, Number.MAX_SAFE_INTEGER);

  if (input.monthlyBudget !== null) {
    assertIntegerInRange("monthlyBudget", input.monthlyBudget, 1, 2_000_000_000);
  }

  if (input.completedHabitCount > input.activeHabitCount) {
    throw new Error(
      `completedHabitCount (${input.completedHabitCount}) cannot exceed activeHabitCount (${input.activeHabitCount})`,
    );
  }

  const candidates: { name: DimensionName; value: number | null }[] = [
    { name: "habits", value: habitsValue(input) },
    { name: "productivity", value: productivityValue(input) },
    { name: "mood", value: moodValue(input) },
    { name: "finance", value: financeValue(input) },
  ];

  const present = candidates.filter(
    (dimension): dimension is { name: DimensionName; value: number } => dimension.value !== null,
  );

  if (present.length === 0) {
    return { score: null, dimensions: [] };
  }

  const usedWeight = present.reduce(
    (total, dimension) => total + DIMENSION_WEIGHTS[dimension.name],
    0,
  );

  const dimensions = present.map((dimension) => ({
    name: dimension.name,
    weight: DIMENSION_WEIGHTS[dimension.name] / usedWeight,
    value: roundTo1(clampTo100(dimension.value)),
  }));

  const weighted = dimensions.reduce(
    (total, dimension) => total + dimension.value * dimension.weight,
    0,
  );

  return { score: Math.round(weighted), dimensions };
}

/**
 * SCORE-2 (user decision 2026-11-01): today against the last scored day
 * before it, as a difference in points on the 0 to 100 scale, shown as "2%
 * lebih baik". Points rather than a ratio keep the number modest: 30 to 60 is
 * 30%, not 100%. Null when there is no earlier scored day.
 */
export function dailyDeltaPoints(todayScore: number, previousScore: number | null): number | null {
  assertIntegerInRange("todayScore", todayScore, 0, 100);

  if (previousScore === null) {
    return null;
  }

  assertIntegerInRange("previousScore", previousScore, 0, 100);

  return todayScore - previousScore;
}
