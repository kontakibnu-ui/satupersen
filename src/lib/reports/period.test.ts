import { describe, expect, it } from "vitest";
import {
  formatPeriodLabel,
  isReportWindowOpen,
  localMoment,
  periodBefore,
  periodFor,
  periodLength,
  previousMonth,
  previousWeek,
} from "@/lib/reports/period";

describe("previousWeek (REPORT-1)", () => {
  it("is Monday to Sunday of the week before, from any day of this week", () => {
    // 2026-11-02 is a Monday. The week before is 2026-10-26 to 2026-11-01.
    for (const day of ["2026-11-02", "2026-11-04", "2026-11-08"]) {
      expect(previousWeek(day)).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    }
  });

  it("crosses a year boundary", () => {
    expect(previousWeek("2027-01-04")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });
});

describe("previousMonth (REPORT-1)", () => {
  it("is the whole month before, from any day of this month", () => {
    expect(previousMonth("2026-11-01")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(previousMonth("2026-11-20")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });

  it("handles a short February and a year boundary", () => {
    expect(previousMonth("2027-03-01")).toEqual({ start: "2027-02-01", end: "2027-02-28" });
    expect(previousMonth("2028-03-01")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(previousMonth("2027-01-02")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});

describe("periodBefore", () => {
  it("is the period of the same kind right before", () => {
    const week = periodFor("weekly", "2026-11-02");
    expect(periodBefore("weekly", week)).toEqual({ start: "2026-10-19", end: "2026-10-25" });

    const month = periodFor("monthly", "2026-11-01");
    expect(periodBefore("monthly", month)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });
});

describe("periodLength", () => {
  it("counts both ends", () => {
    expect(periodLength({ start: "2026-10-26", end: "2026-11-01" })).toBe(7);
    expect(periodLength({ start: "2026-10-01", end: "2026-10-31" })).toBe(31);
  });
});

describe("localMoment", () => {
  it("is the user's own day and minute, not the server's", () => {
    // 2026-11-01 23:30 UTC is already Monday 06:30 in WIB (UTC+7) and 07:30 in WITA (UTC+8).
    const instant = new Date("2026-11-01T23:30:00Z");
    expect(localMoment(instant, "Asia/Jakarta")).toEqual({ day: "2026-11-02", minuteOfDay: 6 * 60 + 30 });
    expect(localMoment(instant, "Asia/Makassar")).toEqual({ day: "2026-11-02", minuteOfDay: 7 * 60 + 30 });
    expect(localMoment(instant, "UTC")).toEqual({ day: "2026-11-01", minuteOfDay: 23 * 60 + 30 });
  });
});

describe("isReportWindowOpen (REPORT-1)", () => {
  const monday = "2026-11-02";

  it("weekly: closed before 07:00 on Monday, open from 07:00", () => {
    expect(isReportWindowOpen("weekly", { day: monday, minuteOfDay: 6 * 60 + 59 })).toBe(false);
    expect(isReportWindowOpen("weekly", { day: monday, minuteOfDay: 7 * 60 })).toBe(true);
    expect(isReportWindowOpen("weekly", { day: monday, minuteOfDay: 23 * 60 + 59 })).toBe(true);
  });

  it("weekly: stays open for two catch-up days, then closes", () => {
    expect(isReportWindowOpen("weekly", { day: "2026-11-03", minuteOfDay: 60 })).toBe(true);
    expect(isReportWindowOpen("weekly", { day: "2026-11-04", minuteOfDay: 60 })).toBe(true);
    expect(isReportWindowOpen("weekly", { day: "2026-11-05", minuteOfDay: 8 * 60 })).toBe(false);
    expect(isReportWindowOpen("weekly", { day: "2026-11-08", minuteOfDay: 8 * 60 })).toBe(false);
  });

  it("weekly: Sunday night before is closed, so the new week never starts early", () => {
    expect(isReportWindowOpen("weekly", { day: "2026-11-01", minuteOfDay: 23 * 60 })).toBe(false);
  });

  it("monthly: due on the 1st at 07:00 with two catch-up days", () => {
    expect(isReportWindowOpen("monthly", { day: "2026-11-01", minuteOfDay: 6 * 60 })).toBe(false);
    expect(isReportWindowOpen("monthly", { day: "2026-11-01", minuteOfDay: 7 * 60 })).toBe(true);
    expect(isReportWindowOpen("monthly", { day: "2026-11-03", minuteOfDay: 10 * 60 })).toBe(true);
    expect(isReportWindowOpen("monthly", { day: "2026-11-04", minuteOfDay: 10 * 60 })).toBe(false);
    expect(isReportWindowOpen("monthly", { day: "2026-10-31", minuteOfDay: 23 * 60 })).toBe(false);
  });
});

describe("formatPeriodLabel", () => {
  it("writes a week inside one month with one month name", () => {
    expect(formatPeriodLabel("weekly", { start: "2026-10-12", end: "2026-10-18" })).toBe("12–18 Oktober 2026");
  });

  it("writes a week across two months, and across a year", () => {
    expect(formatPeriodLabel("weekly", { start: "2026-10-26", end: "2026-11-01" })).toBe("26 Okt – 1 Nov 2026");
    expect(formatPeriodLabel("weekly", { start: "2026-12-28", end: "2027-01-03" })).toBe("28 Des 2026 – 3 Jan 2027");
  });

  it("writes a month by its name", () => {
    expect(formatPeriodLabel("monthly", { start: "2026-10-01", end: "2026-10-31" })).toBe("Oktober 2026");
  });
});
