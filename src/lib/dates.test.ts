import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  endOfMonthKey,
  endOfWeekKey,
  formatDayLabel,
  lastNDays,
  startOfMonthKey,
  startOfWeekKey,
  toDateKey,
  todayKey,
} from "@/lib/dates";

describe("toDateKey", () => {
  // Expected values come from Intl.DateTimeFormat (ICU), not from this module.
  it.each([
    ["2026-10-28T15:30:00Z", "Asia/Jakarta", "2026-10-28"],
    ["2026-10-28T15:30:00Z", "Asia/Makassar", "2026-10-28"],
    ["2026-10-28T15:30:00Z", "Asia/Jayapura", "2026-10-29"],
    ["2026-10-28T16:30:00Z", "Asia/Jakarta", "2026-10-28"],
    ["2026-10-28T16:30:00Z", "Asia/Makassar", "2026-10-29"],
    ["2026-10-28T16:30:00Z", "Asia/Jayapura", "2026-10-29"],
    ["2026-10-28T17:30:00Z", "Asia/Jakarta", "2026-10-29"],
    ["2026-10-28T17:30:00Z", "America/New_York", "2026-10-28"],
  ])("%s in %s is %s", (instant, timeZone, expected) => {
    expect(toDateKey(new Date(instant), timeZone)).toBe(expected);
  });

  it("crosses the day boundary per zone, not per UTC", () => {
    const instant = new Date("2026-10-28T15:30:00Z");

    expect(toDateKey(instant, "UTC")).toBe("2026-10-28");
    expect(toDateKey(instant, "Asia/Jakarta")).toBe("2026-10-28");
    expect(toDateKey(instant, "Asia/Jayapura")).toBe("2026-10-29");
  });

  it("follows the zone offset even when the zone has DST", () => {
    // 01:30 in New York on the day the clocks fall back, still the same calendar day.
    expect(toDateKey(new Date("2026-11-01T05:30:00Z"), "America/New_York")).toBe("2026-11-01");
  });
});

describe("todayKey", () => {
  it("uses the injected instant and the profile time zone", () => {
    const now = new Date("2026-10-28T17:30:00Z");

    expect(todayKey("Asia/Jakarta", now)).toBe("2026-10-29");
    expect(todayKey("Asia/Makassar", now)).toBe("2026-10-29");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-10-28", 1, "2026-10-29"],
    ["2026-10-28", -1, "2026-10-27"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2027-01-01", -1, "2026-12-31"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2028-03-01", -1, "2028-02-29"],
    ["2026-10-28", 0, "2026-10-28"],
  ])("%s plus %i days is %s", (key, days, expected) => {
    expect(addDays(key, days)).toBe(expected);
  });
});

describe("daysBetween", () => {
  it("counts whole days and keeps the sign", () => {
    expect(daysBetween("2026-10-01", "2026-10-28")).toBe(27);
    expect(daysBetween("2026-10-28", "2026-10-01")).toBe(-27);
    expect(daysBetween("2026-10-28", "2026-10-28")).toBe(0);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("lastNDays", () => {
  it("returns consecutive days ending today, oldest first", () => {
    expect(lastNDays("2026-10-28", 3)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
    expect(lastNDays("2026-11-02", 7)).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(lastNDays("2026-10-28", 1)).toEqual(["2026-10-28"]);
  });

  it("rejects a count that cannot produce a window", () => {
    expect(() => lastNDays("2026-10-28", 0)).toThrow();
    expect(() => lastNDays("2026-10-28", -7)).toThrow();
    expect(() => lastNDays("2026-10-28", 2.5)).toThrow();
  });
});

describe("weeks", () => {
  it("runs Monday to Sunday", () => {
    expect(startOfWeekKey("2026-10-28")).toBe("2026-10-26");
    expect(endOfWeekKey("2026-10-28")).toBe("2026-11-01");
  });

  it("keeps Monday and Sunday inside their own week", () => {
    expect(startOfWeekKey("2026-10-26")).toBe("2026-10-26");
    expect(endOfWeekKey("2026-10-26")).toBe("2026-11-01");
    expect(startOfWeekKey("2026-11-01")).toBe("2026-10-26");
    expect(endOfWeekKey("2026-11-01")).toBe("2026-11-01");
  });

  it("spans a month boundary without losing a day", () => {
    expect(daysBetween(startOfWeekKey("2026-11-01"), endOfWeekKey("2026-11-01"))).toBe(6);
  });
});

describe("months", () => {
  it("finds the first and last day of the month", () => {
    expect(startOfMonthKey("2026-10-28")).toBe("2026-10-01");
    expect(endOfMonthKey("2026-10-28")).toBe("2026-10-31");
    expect(endOfMonthKey("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonthKey("2028-02-10")).toBe("2028-02-29");
  });

  it("covers the whole month when combined", () => {
    expect(daysBetween(startOfMonthKey("2026-10-28"), endOfMonthKey("2026-10-28")) + 1).toBe(31);
    expect(daysBetween(startOfMonthKey("2028-02-10"), endOfMonthKey("2028-02-10")) + 1).toBe(29);
  });
});

describe("formatDayLabel", () => {
  it("menulis tanggal dalam Bahasa Indonesia sesuai DESIGN.md §4", () => {
    expect(formatDayLabel("2026-10-28")).toBe("Rabu, 28 Oktober");
    expect(formatDayLabel("2026-01-01")).toBe("Kamis, 1 Januari");
    expect(formatDayLabel("2026-11-01")).toBe("Minggu, 1 November");
  });

  it("menolak kunci yang tidak valid", () => {
    expect(() => formatDayLabel("2026-02-31")).toThrow(/Invalid date key/);
  });
});

describe("invalid keys", () => {
  it.each(["", "bukan-tanggal", "2026-2-01", "28-10-2026", "2026-02-31", "2026-13-01"])(
    "rejects %s",
    (key) => {
      expect(() => addDays(key, 1)).toThrow(/Invalid date key/);
      expect(() => startOfMonthKey(key)).toThrow(/Invalid date key/);
      expect(() => endOfMonthKey(key)).toThrow(/Invalid date key/);
      expect(() => daysBetween(key, "2026-10-28")).toThrow(/Invalid date key/);
      expect(() => lastNDays(key, 2)).toThrow(/Invalid date key/);
      expect(() => startOfWeekKey(key)).toThrow(/Invalid date key/);
    },
  );
});
