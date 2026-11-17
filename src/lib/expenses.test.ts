import { describe, expect, it } from "vitest";
import {
  categoriesFor,
  categoryLabel,
  compareMonths,
  earliestEntryDate,
  EXPENSE_CATEGORIES,
  isAllowedEntryDate,
  isCategoryOf,
  MAX_AMOUNT,
  MAX_BACKDATE_DAYS,
  monthsEndingAt,
  monthTotals,
  netOf,
  parseAmount,
  savingsRatio,
  spentOnDay,
  type MoneyRow,
} from "@/lib/expenses";

describe("parseAmount", () => {
  it("reads digits through the thousands dots and a Rp prefix", () => {
    expect(parseAmount("25.000")).toBe(25000);
    expect(parseAmount("Rp 1.245.000")).toBe(1245000);
    expect(parseAmount("7500")).toBe(7500);
  });

  it("rejects empty, zero, and anything with no digits", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("000")).toBeNull();
  });

  it("rejects an amount above the limit, and an absurdly long number", () => {
    expect(parseAmount(String(MAX_AMOUNT))).toBe(MAX_AMOUNT);
    expect(parseAmount(String(MAX_AMOUNT + 1))).toBeNull();
    expect(parseAmount("99999999999999999999")).toBeNull();
  });
});

describe("categories (EXP-3)", () => {
  it("has the six built-in categories", () => {
    expect(EXPENSE_CATEGORIES.map((category) => category.label)).toEqual([
      "Makan",
      "Transport",
      "Kuliah atau kerja",
      "Hiburan",
      "Tagihan",
      "Lainnya",
    ]);
  });

  it("falls back to Lainnya for a value it does not know", () => {
    expect(categoryLabel("makan")).toBe("Makan");
    expect(categoryLabel("entah")).toBe("Lainnya");
  });
});

describe("income categories (EXP-5)", () => {
  it("has its own list, and a category belongs only to its own type", () => {
    expect(categoriesFor("income").map((category) => category.value)).toEqual([
      "gaji",
      "uang_saku",
      "usaha",
      "bonus",
      "lainnya",
    ]);
    expect(isCategoryOf("income", "gaji")).toBe(true);
    expect(isCategoryOf("expense", "gaji")).toBe(false);
    expect(isCategoryOf("income", "makan")).toBe(false);
    expect(isCategoryOf("expense", "lainnya")).toBe(true);
    expect(categoryLabel("gaji", "income")).toBe("Gaji");
    expect(categoryLabel("gaji")).toBe("Lainnya");
  });
});

const rows: MoneyRow[] = [
  { date: "2026-09-02", amount: 3_000_000, type: "income" },
  { date: "2026-09-03", amount: 500_000, type: "expense" },
  { date: "2026-09-20", amount: 700_000, type: "expense" },
  { date: "2026-10-01", amount: 3_500_000, type: "income" },
  { date: "2026-10-04", amount: 200_000, type: "expense" },
  { date: "2026-10-10", amount: 100_000, type: "expense" },
];

describe("monthly totals and comparison (EXP-5, EXP-6)", () => {
  it("adds income and expense apart, per month", () => {
    expect(monthTotals(rows, "2026-09")).toEqual({ income: 3_000_000, expense: 1_200_000 });
    expect(monthTotals(rows, "2026-10")).toEqual({ income: 3_500_000, expense: 300_000 });
    expect(monthTotals(rows, "2026-08")).toEqual({ income: 0, expense: 0 });
  });

  it("can stop at a day of the month", () => {
    expect(monthTotals(rows, "2026-09", 10)).toEqual({ income: 3_000_000, expense: 500_000 });
  });

  it("works out what is left and the share kept", () => {
    expect(netOf({ income: 3_000_000, expense: 1_200_000 })).toBe(1_800_000);
    expect(netOf({ income: 0, expense: 50_000 })).toBe(-50_000);
    expect(savingsRatio({ income: 4_000_000, expense: 1_000_000 })).toBe(0.75);
    expect(savingsRatio({ income: 0, expense: 1_000_000 })).toBeNull();
  });

  it("counts the spending of one day, never the income", () => {
    expect(spentOnDay(rows, "2026-10-04")).toBe(200_000);
    expect(spentOnDay(rows, "2026-10-01")).toBe(0);
  });

  it("compares a month with the one before it", () => {
    const comparison = compareMonths(rows, "2026-10", "2026-09");

    expect(comparison.previousEmpty).toBe(false);
    expect(comparison.expenseChange).toBe(300_000 - 1_200_000);
    expect(comparison.incomeChange).toBe(500_000);
    expect(comparison.netChange).toBe(3_200_000 - 1_800_000);
  });

  it("sets a running month against the same days of the month before", () => {
    // Up to the 10th, September had only the 500.000 spent on the 3rd.
    const comparison = compareMonths(rows, "2026-10", "2026-09", 10);

    expect(comparison.previous).toEqual({ income: 3_000_000, expense: 500_000 });
    expect(comparison.expenseChange).toBe(-200_000);
  });

  it("says so when the month before has nothing to compare to", () => {
    expect(compareMonths(rows, "2026-09", "2026-08").previousEmpty).toBe(true);
  });

  it("lists the months ending at a month, across a year change", () => {
    expect(monthsEndingAt("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsEndingAt("2026-10", 1)).toEqual(["2026-10"]);
  });
});

describe("entry date (EXP-8)", () => {
  const today = "2026-11-16";

  it("allows today and earlier days up to the limit", () => {
    expect(isAllowedEntryDate(today, today)).toBe(true);
    expect(isAllowedEntryDate("2026-11-15", today)).toBe(true);
    expect(isAllowedEntryDate("2026-10-31", today)).toBe(true);
    expect(isAllowedEntryDate(earliestEntryDate(today), today)).toBe(true);
  });

  it("refuses the future, days past the limit, and anything that is not a day", () => {
    expect(isAllowedEntryDate("2026-11-17", today)).toBe(false);
    expect(isAllowedEntryDate("2027-01-01", today)).toBe(false);
    expect(isAllowedEntryDate("2025-11-15", today)).toBe(false);
    expect(isAllowedEntryDate("2026-02-30", today)).toBe(false);
    expect(isAllowedEntryDate("16/11/2026", today)).toBe(false);
    expect(isAllowedEntryDate("", today)).toBe(false);
  });

  it("counts the limit in calendar days, across a leap year", () => {
    expect(earliestEntryDate("2026-11-16")).toBe("2025-11-16");
    expect(earliestEntryDate("2028-03-01")).toBe("2027-03-02");
    expect(MAX_BACKDATE_DAYS).toBe(365);
  });
});
