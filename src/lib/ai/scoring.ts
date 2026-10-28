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

/**
 * Spending is compared to the daily share of the monthly budget (PRD.md §5).
 * At or under budget the dimension is full; it falls linearly to zero at twice
 * the daily budget. PRD.md §11 has not fixed this curve yet.
 */
function financeValue(input: DailyScoreInput): number | null {
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
  assertIntegerInRange("activeHabitCount", input.activeHabitCount, 0, 50);
  assertIntegerInRange("completedHabitCount", input.completedHabitCount, 0, 50);
  assertNullableIntegerInRange("aiDimensionScore", input.aiDimensionScore, 0, 10);
  assertNullableIntegerInRange("mood", input.mood, 1, 5);
  assertNullableIntegerInRange("energy", input.energy, 1, 5);
  assertIntegerInRange("spentToday", input.spentToday, 0, 2_000_000_000);
  assertIntegerInRange("daysInMonth", input.daysInMonth, 1, 31);

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
 * SCORE-2: comparison against the average of the previous 7 days, not against
 * yesterday, so a single bad day does not make the number jump. Returns null
 * when fewer than 3 scored days are available, or when that average is below 1
 * where a percentage would be meaningless.
 */
export function dailyDeltaPct(todayScore: number, previousScores: number[]): number | null {
  assertIntegerInRange("todayScore", todayScore, 0, 100);

  for (const previousScore of previousScores) {
    assertIntegerInRange("previousScores entry", previousScore, 0, 100);
  }

  if (previousScores.length < 3) {
    return null;
  }

  const average =
    previousScores.reduce((total, score) => total + score, 0) / previousScores.length;

  if (average < 1) {
    return null;
  }

  return roundTo1(((todayScore - average) / average) * 100);
}
