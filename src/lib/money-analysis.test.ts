import { describe, expect, it } from "vitest";
import { REDACTED_NUMBER } from "@/lib/receipt";
import {
  analysisNote,
  analysisPromptInput,
  categoryShares,
  daysInMonth,
  earnedThrough,
  MAX_ANALYSIS_NOTE_LENGTH,
  monthEndEstimate,
  percentOf,
  previousMonthOf,
  readThroughDay,
  spendingPace,
  spentThrough,
  topCategoryFact,
  weekdayTotals,
  weekTotals,
  type AnalysisEntry,
} from "@/lib/money-analysis";

const out = (date: string, amount: number, category = "makan"): AnalysisEntry => ({
  date,
  type: "expense",
  amount,
  category,
  note: null,
});
const income = (date: string, amount: number): AnalysisEntry => ({ date, type: "income", amount, category: "gaji", note: null });

describe("daysInMonth", () => {
  it("knows short months and leap years", () => {
    expect(daysInMonth("2026-11")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("spendingPace (Laju pengeluaran, EXP-10)", () => {
  const entries = [
    out("2026-11-01", 100),
    out("2026-11-03", 50),
    out("2026-11-05", 999),
    income("2026-11-02", 5000),
    out("2026-10-01", 80),
    out("2026-10-31", 20),
    out("2026-09-30", 7),
  ];

  it("sums money out day by day and stops the running month at its day", () => {
    const pace = spendingPace(entries, "2026-11", "2026-10", 4);

    expect(pace).toHaveLength(31);
    expect(pace.slice(0, 5).map((point) => point.current)).toEqual([100, 100, 150, 150, null]);
    expect(pace[0].previous).toBe(80);
    expect(pace[30]).toEqual({ day: 31, current: null, previous: 100 });
  });

  it("shows a finished month to its last day, and a shorter month before it ends early", () => {
    const pace = spendingPace([out("2026-03-31", 10), out("2026-02-28", 5)], "2026-03", "2026-02", 31);

    expect(pace).toHaveLength(31);
    expect(pace[30].current).toBe(10);
    expect(pace[27].previous).toBe(5);
    expect(pace[28].previous).toBeNull();
  });
});

describe("spentThrough and earnedThrough", () => {
  it("count one direction of one month up to a day", () => {
    const entries = [out("2026-11-01", 100), out("2026-11-20", 50), income("2026-11-02", 7), out("2026-10-01", 9)];

    expect(spentThrough(entries, "2026-11", 31)).toBe(150);
    expect(spentThrough(entries, "2026-11", 10)).toBe(100);
    expect(earnedThrough(entries, "2026-11", 31)).toBe(7);
  });
});

describe("categoryShares (Ke mana uangmu pergi)", () => {
  it("orders money out by category, biggest first, with the same days of the month before", () => {
    const shares = categoryShares(
      [
        out("2026-11-02", 300, "makan"),
        out("2026-11-04", 100, "transport"),
        out("2026-11-05", 100, "makan"),
        income("2026-11-01", 9999),
        out("2026-10-03", 80, "makan"),
        out("2026-10-25", 500, "makan"),
      ],
      "2026-11",
      "2026-10",
      22,
    );

    expect(shares).toEqual([
      { category: "makan", label: "Makan", amount: 400, share: 0.8, previous: 80 },
      { category: "transport", label: "Transport", amount: 100, share: 0.2, previous: 0 },
    ]);
  });

  it("is empty without money out", () => {
    expect(categoryShares([income("2026-11-01", 5)], "2026-11", "2026-10", 31)).toEqual([]);
  });
});

describe("percentOf", () => {
  it("rounds, and never shows 0% for money that is there", () => {
    expect(percentOf(0.374)).toBe(37);
    expect(percentOf(0.001)).toBe(1);
    expect(percentOf(0)).toBe(0);
  });
});

describe("weekTotals", () => {
  it("splits the month into stretches of seven days up to the day read", () => {
    const weeks = weekTotals([out("2026-11-01", 10), out("2026-11-08", 20), out("2026-11-16", 30)], "2026-11", 16);

    expect(weeks).toEqual([
      { from: 1, to: 7, amount: 10 },
      { from: 8, to: 14, amount: 20 },
      { from: 15, to: 16, amount: 30 },
    ]);
  });

  it("ends the last stretch at the month's end", () => {
    expect(weekTotals([], "2026-11", 31).at(-1)).toEqual({ from: 29, to: 30, amount: 0 });
  });
});

describe("weekdayTotals", () => {
  it("adds money out per day of the week, Monday first", () => {
    // 2026-11-02 is a Monday, 2026-11-08 a Sunday.
    const days = weekdayTotals([out("2026-11-02", 10), out("2026-11-09", 5), out("2026-11-08", 7)], "2026-11");

    expect(days[0]).toEqual({ weekday: "Senin", amount: 15 });
    expect(days[6]).toEqual({ weekday: "Minggu", amount: 7 });
  });
});

describe("monthEndEstimate", () => {
  it("spreads the pace so far over the whole month", () => {
    expect(monthEndEstimate(4_120_000, 22, 30)).toBe(5_618_182);
  });

  it("says nothing for a finished month or the first days", () => {
    expect(monthEndEstimate(1000, 30, 30)).toBeNull();
    expect(monthEndEstimate(1000, 6, 30)).toBeNull();
  });
});

describe("topCategoryFact (baris Analisa di Uang)", () => {
  it("names the biggest category and its share", () => {
    expect(
      topCategoryFact([{ category: "makan", label: "Makan", amount: 1_540_000, share: 0.374, previous: 0 }]),
    ).toBe("Makan paling besar, 37%");
  });

  it("is null without money out", () => {
    expect(topCategoryFact([])).toBeNull();
  });
});

describe("analysisPromptInput (yang dikirim ke AI, EXP-10)", () => {
  const entries: AnalysisEntry[] = [
    { ...out("2026-11-03", 52_500), note: "Transfer ke Andi 1234567890" },
    out("2026-11-20", 30_000, "transport"),
    out("2026-11-25", 999_999),
    income("2026-11-07", 6_500_000),
    out("2026-10-05", 40_000),
    out("2026-10-28", 777_777),
  ];

  it("counts a running month and the month before through today, newest entries first", () => {
    const input = analysisPromptInput({ entries, month: "2026-11", today: "2026-11-22", budget: 1_000_000 });

    expect(input).toMatchObject({
      monthLabel: "November 2026",
      previousLabel: "Oktober 2026",
      running: true,
      throughLabel: "22 November",
      income: 6_500_000,
      expense: 82_500,
      previousExpense: 40_000,
      budget: 1_000_000,
      estimate: 112_500,
    });
    expect(input.categories[0]).toEqual({ label: "Makan", amount: 52_500, percent: 64, previous: 40_000 });
    expect(input.transactions.map((entry) => entry.date)).toEqual(["2026-11-20", "2026-11-07", "2026-11-03"]);
    expect(input.transactions[2].note).toBe(`Transfer ke Andi ${REDACTED_NUMBER}`);
  });

  it("reads a finished month whole, without an estimate", () => {
    const input = analysisPromptInput({ entries, month: "2026-10", today: "2026-11-22", budget: null });

    expect(input).toMatchObject({ running: false, throughLabel: "31 Oktober", expense: 817_777, estimate: null });
  });
});

describe("previousMonthOf and readThroughDay", () => {
  it("cross the year and stop a running month at today", () => {
    expect(previousMonthOf("2027-01")).toBe("2026-12");
    expect(readThroughDay("2026-11", "2026-11-22")).toBe(22);
    expect(readThroughDay("2026-10", "2026-11-22")).toBe(31);
  });
});

describe("analysisNote", () => {
  it("keeps a note on one line, hides long numbers, and cuts it short", () => {
    expect(analysisNote("Transfer   ke\nAndi 1234567890")).toBe(`Transfer ke Andi ${REDACTED_NUMBER}`);
    expect(analysisNote("x".repeat(200))).toHaveLength(MAX_ANALYSIS_NOTE_LENGTH);
    expect(analysisNote(null)).toBe("");
  });
});
