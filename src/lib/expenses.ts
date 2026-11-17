import { addDays, daysBetween, isDateKey } from "@/lib/dates";

/**
 * Money entry rules shared by the screen and the server (EXP-1, EXP-3, EXP-5,
 * EXP-8). The server checks them again, because the browser can be edited.
 */

/** EXP-5: an entry is money going out or money coming in. */
export const ENTRY_TYPES = ["expense", "income"] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

/** EXP-3: the built-in categories. The stored value never changes; the label can. */
export const EXPENSE_CATEGORIES = [
  { value: "makan", label: "Makan" },
  { value: "transport", label: "Transport" },
  { value: "kuliah_kerja", label: "Kuliah atau kerja" },
  { value: "hiburan", label: "Hiburan" },
  { value: "tagihan", label: "Tagihan" },
  { value: "lainnya", label: "Lainnya" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

/** EXP-5: the built-in categories of money coming in. */
export const INCOME_CATEGORIES = [
  { value: "gaji", label: "Gaji" },
  { value: "uang_saku", label: "Uang saku" },
  { value: "usaha", label: "Usaha atau freelance" },
  { value: "bonus", label: "Bonus atau hadiah" },
  { value: "lainnya", label: "Lainnya" },
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]["value"];

export function categoriesFor(type: EntryType): readonly { value: string; label: string }[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isCategoryOf(type: EntryType, category: string): boolean {
  return categoriesFor(type).some((entry) => entry.value === category);
}

export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((category) => category.value) as [
  ExpenseCategory,
  ...ExpenseCategory[],
];

/** One billion rupiah, far below the column's integer limit and above any real purchase. */
export const MAX_AMOUNT = 1_000_000_000;

export const MAX_NOTE_LENGTH = 200;

/**
 * EXP-8: how far back a new entry may be dated, so a bank screenshot from last
 * week or last month can still go on its own day. Never in the future.
 */
export const MAX_BACKDATE_DAYS = 365;

/** The earliest day a new entry may carry, counted from the user's today. */
export function earliestEntryDate(today: string): string {
  return addDays(today, -MAX_BACKDATE_DAYS);
}

/** EXP-8: a real calendar day, not after today and at most MAX_BACKDATE_DAYS back. */
export function isAllowedEntryDate(date: string, today: string): boolean {
  if (!isDateKey(date) || !isDateKey(today)) {
    return false;
  }

  const back = daysBetween(date, today);

  return back >= 0 && back <= MAX_BACKDATE_DAYS;
}

export function categoryLabel(value: string, type: EntryType = "expense"): string {
  return categoriesFor(type).find((category) => category.value === value)?.label ?? "Lainnya";
}

/** Digits only: "25.000" and "Rp 25000" both become 25000; nothing usable gives null. */
export function parseAmount(text: string): number | null {
  const digits = text.replace(/\D/g, "");

  if (digits === "" || digits.length > 10) {
    return null;
  }

  const amount = Number(digits);

  return amount >= 1 && amount <= MAX_AMOUNT ? amount : null;
}

/** One entry as the totals read it: the day, the rupiah, and which way it went. */
export type MoneyRow = { date: string; amount: number; type: EntryType };

export type MoneyTotals = { income: number; expense: number };

/**
 * Income and expense of one month ("yyyy-MM"). `upToDay` keeps only the first
 * days of the month, so a month still running can be set against the same
 * stretch of the month before it (EXP-6).
 */
export function monthTotals(rows: readonly MoneyRow[], month: string, upToDay = 31): MoneyTotals {
  const totals: MoneyTotals = { income: 0, expense: 0 };

  for (const row of rows) {
    if (row.date.slice(0, 7) !== month || Number(row.date.slice(8)) > upToDay) {
      continue;
    }

    totals[row.type] += row.amount;
  }

  return totals;
}

/** Rupiah spent on one day (money in does not count). */
export function spentOnDay(rows: readonly MoneyRow[], date: string): number {
  return rows.reduce(
    (sum, row) => (row.type === "expense" && row.date === date ? sum + row.amount : sum),
    0,
  );
}

/** What is left of the month: money in minus money out, negative when more went out. */
export function netOf(totals: MoneyTotals): number {
  return totals.income - totals.expense;
}

/**
 * The share of income that was not spent, 0.2 meaning a fifth was kept. Null
 * when there is no income to take a share of.
 */
export function savingsRatio(totals: MoneyTotals): number | null {
  return totals.income > 0 ? netOf(totals) / totals.income : null;
}

/** The `count` months ending at `endMonth` ("yyyy-MM"), oldest first. */
export function monthsEndingAt(endMonth: string, count: number): string[] {
  const [year, month] = endMonth.split("-").map(Number);
  const months: string[] = [];

  for (let back = count - 1; back >= 0; back -= 1) {
    const index = year * 12 + (month - 1) - back;
    months.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
  }

  return months;
}

export type MonthComparison = {
  /** The month before, over the same stretch when the month shown is still running. */
  previous: MoneyTotals;
  /** True when the month before has no entry at all, so there is nothing to compare to. */
  previousEmpty: boolean;
  /** This month minus the month before. Positive means more. */
  expenseChange: number;
  incomeChange: number;
  netChange: number;
};

/**
 * EXP-6: this month against the month before. A running month is set against the
 * same days of the previous one (`upToDay`), so the fifth day of a month is not
 * compared with a whole one.
 */
export function compareMonths(
  rows: readonly MoneyRow[],
  month: string,
  previousMonth: string,
  upToDay = 31,
): MonthComparison {
  const current = monthTotals(rows, month);
  const previous = monthTotals(rows, previousMonth, upToDay);

  return {
    previous,
    previousEmpty: previous.income === 0 && previous.expense === 0,
    expenseChange: current.expense - previous.expense,
    incomeChange: current.income - previous.income,
    netChange: netOf(current) - netOf(previous),
  };
}
