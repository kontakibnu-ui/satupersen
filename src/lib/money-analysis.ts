import type { MoneyAnalysisPromptInput } from "@/lib/ai/prompts";
import { endOfMonthKey, formatMonthLabel } from "@/lib/dates";
import { categoryLabel, monthsEndingAt, type EntryType } from "@/lib/expenses";
import { redactLongNumbers } from "@/lib/receipt";

/**
 * "Analisa uang" (PRD.md EXP-10): the numbers behind the charts every account
 * sees, and the numbers the model is given for a premium analysis. Everything
 * is counted here, never by the model (AGENTS.md §6: the AI does not compute).
 * Months are "yyyy-MM"; days of the month are 1 to 31.
 */

/** One entry as the analysis reads it. */
export type AnalysisEntry = {
  date: string;
  type: EntryType;
  amount: number;
  category: string;
  note: string | null;
};

/** How many of the month's entries the model gets to read, newest first. */
export const MAX_ANALYSIS_TRANSACTIONS = 300;

/** How long a note may be in the model's list. */
export const MAX_ANALYSIS_NOTE_LENGTH = 80;

/** A running month is projected to its end only after this many days; earlier is mostly noise. */
export const MIN_DAYS_FOR_ESTIMATE = 7;

export function daysInMonth(month: string): number {
  return Number(endOfMonthKey(`${month}-01`).slice(8));
}

function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}

function inMonth(entry: AnalysisEntry, month: string): boolean {
  return entry.date.slice(0, 7) === month;
}

/** One day on the pace chart: money spent so far that month, or null past the days shown. */
export type PacePoint = { day: number; current: number | null; previous: number | null };

/**
 * Spending summed up day by day (the "Laju pengeluaran" chart): the month on
 * screen through `throughDay`, and the whole month before it as the line to
 * read against. The days run as long as the longer of the two months.
 */
export function spendingPace(
  entries: readonly AnalysisEntry[],
  month: string,
  previousMonth: string,
  throughDay: number,
): PacePoint[] {
  const currentDays = Math.min(daysInMonth(month), throughDay);
  const previousDays = daysInMonth(previousMonth);
  const length = Math.max(daysInMonth(month), previousDays);
  const current = new Array<number>(length + 1).fill(0);
  const previous = new Array<number>(length + 1).fill(0);

  for (const entry of entries) {
    if (entry.type !== "expense") {
      continue;
    }

    if (inMonth(entry, month)) {
      current[dayOf(entry.date)] += entry.amount;
    } else if (inMonth(entry, previousMonth)) {
      previous[dayOf(entry.date)] += entry.amount;
    }
  }

  const points: PacePoint[] = [];
  let currentSum = 0;
  let previousSum = 0;

  for (let day = 1; day <= length; day += 1) {
    currentSum += current[day];
    previousSum += previous[day];
    points.push({
      day,
      current: day <= currentDays ? currentSum : null,
      previous: day <= previousDays ? previousSum : null,
    });
  }

  return points;
}

/** Money out of one month through `upToDay` (31 for the whole month). */
export function spentThrough(entries: readonly AnalysisEntry[], month: string, upToDay: number): number {
  return entries.reduce(
    (sum, entry) =>
      entry.type === "expense" && inMonth(entry, month) && dayOf(entry.date) <= upToDay ? sum + entry.amount : sum,
    0,
  );
}

/** Money in of one month through `upToDay`. */
export function earnedThrough(entries: readonly AnalysisEntry[], month: string, upToDay: number): number {
  return entries.reduce(
    (sum, entry) =>
      entry.type === "income" && inMonth(entry, month) && dayOf(entry.date) <= upToDay ? sum + entry.amount : sum,
    0,
  );
}

export type CategoryShare = {
  category: string;
  label: string;
  amount: number;
  /** Of all money out that month, 0 to 1. */
  share: number;
  /** The same category over the same days of the month before. */
  previous: number;
};

/**
 * Money out per category (the "Ke mana uangmu pergi" rows), biggest first, with
 * the same category over the same days of the month before. Both months count
 * up to `upToDay`, like the totals beside them.
 */
export function categoryShares(
  entries: readonly AnalysisEntry[],
  month: string,
  previousMonth: string,
  upToDay: number,
): CategoryShare[] {
  const current = new Map<string, number>();
  const previous = new Map<string, number>();

  for (const entry of entries) {
    if (entry.type !== "expense") {
      continue;
    }

    if (dayOf(entry.date) > upToDay) {
      continue;
    }

    if (inMonth(entry, month)) {
      current.set(entry.category, (current.get(entry.category) ?? 0) + entry.amount);
    } else if (inMonth(entry, previousMonth)) {
      previous.set(entry.category, (previous.get(entry.category) ?? 0) + entry.amount);
    }
  }

  const total = [...current.values()].reduce((sum, amount) => sum + amount, 0);

  return [...current.entries()]
    .map(([category, amount]) => ({
      category,
      label: categoryLabel(category, "expense"),
      amount,
      share: total > 0 ? amount / total : 0,
      previous: previous.get(category) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, "id"));
}

/** A whole percent for a share; never shows 0% for a category that has money in it. */
export function percentOf(share: number): number {
  return share > 0 ? Math.max(1, Math.round(share * 100)) : 0;
}

export type WeekTotal = { from: number; to: number; amount: number };

/** Money out per stretch of seven days (1–7, 8–14, …, 29 to the end), up to `throughDay`. */
export function weekTotals(entries: readonly AnalysisEntry[], month: string, throughDay: number): WeekTotal[] {
  const days = Math.min(daysInMonth(month), throughDay);
  const weeks: WeekTotal[] = [];

  for (let from = 1; from <= days; from += 7) {
    const to = Math.min(from + 6, days);
    const amount = entries.reduce(
      (sum, entry) =>
        entry.type === "expense" && inMonth(entry, month) && dayOf(entry.date) >= from && dayOf(entry.date) <= to
          ? sum + entry.amount
          : sum,
      0,
    );
    weeks.push({ from, to, amount });
  }

  return weeks;
}

const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

/** Money out per day of the week in the month, Monday first. */
export function weekdayTotals(entries: readonly AnalysisEntry[], month: string): { weekday: string; amount: number }[] {
  const sums = new Array<number>(7).fill(0);

  for (const entry of entries) {
    if (entry.type === "expense" && inMonth(entry, month)) {
      sums[new Date(`${entry.date}T00:00:00Z`).getUTCDay()] += entry.amount;
    }
  }

  return [1, 2, 3, 4, 5, 6, 0].map((index) => ({ weekday: WEEKDAYS[index], amount: sums[index] }));
}

/**
 * Where a running month lands at this pace: what went out so far, spread over
 * the whole month. Null for a finished month and for the first days of one.
 */
export function monthEndEstimate(spent: number, throughDay: number, days: number): number | null {
  if (throughDay >= days || throughDay < MIN_DAYS_FOR_ESTIMATE) {
    return null;
  }

  return Math.round((spent / throughDay) * days);
}

/** The line under "Analisa {bulan}" on Uang: the biggest category and its share. */
export function topCategoryFact(shares: readonly CategoryShare[]): string | null {
  const [top] = shares;

  return top ? `${top.label} paling besar, ${percentOf(top.share)}%` : null;
}

/** A note as the model reads it: one line, long numbers hidden, short. */
export function analysisNote(note: string | null): string {
  return redactLongNumbers((note ?? "").replace(/\s+/g, " ").trim()).slice(0, MAX_ANALYSIS_NOTE_LENGTH).trim();
}

/** The month before "yyyy-MM". */
export function previousMonthOf(month: string): string {
  return monthsEndingAt(month, 2)[0];
}

/** The last day of `month` the analysis reads: today in a running month, the month's end otherwise. */
export function readThroughDay(month: string, today: string): number {
  return month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth(month);
}

/** "22 November" for day 22 of "2026-11". */
export function dayAndMonthLabel(month: string, day: number): string {
  return `${day} ${formatMonthLabel(`${month}-01`).split(" ")[0]}`;
}

/**
 * Everything the model is given for one month's analysis (EXP-10), counted
 * here: totals, the same days of the month before, categories, stretches of
 * days, days of the week, the budget, the estimate, and up to
 * MAX_ANALYSIS_TRANSACTIONS entries with their notes, newest first.
 */
export function analysisPromptInput(input: {
  entries: readonly AnalysisEntry[];
  month: string;
  today: string;
  budget: number | null;
}): MoneyAnalysisPromptInput {
  const { entries, month, today, budget } = input;
  const previousMonth = previousMonthOf(month);
  const throughDay = readThroughDay(month, today);
  const running = throughDay < daysInMonth(month);
  const expense = spentThrough(entries, month, throughDay);
  const transactions = entries
    .filter((entry) => entry.date.slice(0, 7) === month && Number(entry.date.slice(8, 10)) <= throughDay)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .slice(0, MAX_ANALYSIS_TRANSACTIONS)
    .map((entry) => ({
      date: entry.date,
      type: entry.type,
      category: categoryLabel(entry.category, entry.type),
      amount: entry.amount,
      note: analysisNote(entry.note),
    }));

  return {
    monthLabel: formatMonthLabel(`${month}-01`),
    previousLabel: formatMonthLabel(`${previousMonth}-01`),
    running,
    throughLabel: dayAndMonthLabel(month, throughDay),
    income: earnedThrough(entries, month, throughDay),
    expense,
    previousIncome: earnedThrough(entries, previousMonth, throughDay),
    previousExpense: spentThrough(entries, previousMonth, throughDay),
    categories: categoryShares(entries, month, previousMonth, throughDay).map((share) => ({
      label: share.label,
      amount: share.amount,
      percent: percentOf(share.share),
      previous: share.previous,
    })),
    weeks: weekTotals(entries, month, throughDay),
    weekdays: weekdayTotals(entries, month),
    budget,
    estimate: running ? monthEndEstimate(expense, throughDay, daysInMonth(month)) : null,
    transactions,
  };
}
