import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  endOfMonthKey,
  endOfWeekKey,
  formatDayLabel,
  formatMonthLabel,
  isDateKey,
  isValidTimeZone,
  lastNDays,
  monthGrid,
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

describe("formatMonthLabel", () => {
  it("menulis bulan dan tahun dalam Bahasa Indonesia", () => {
    expect(formatMonthLabel("2026-10-28")).toBe("Oktober 2026");
    expect(formatMonthLabel("2027-01-01")).toBe("Januari 2027");
  });
});

describe("isDateKey", () => {
  it.each(["2026-10-28", "2028-02-29", "2026-01-01"])("accepts %s", (value) => {
    expect(isDateKey(value)).toBe(true);
  });

  it.each(["", "2026-02-29", "2026-13-01", "2026-10-28T00:00", "28-10-2026", "2026-1-01"])(
    "rejects %s without throwing",
    (value) => {
      expect(isDateKey(value)).toBe(false);
    },
  );
});

describe("isValidTimeZone", () => {
  it.each(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "UTC", "America/New_York"])(
    "accepts %s",
    (zone) => {
      expect(isValidTimeZone(zone)).toBe(true);
    },
  );

  it.each(["", "   ", "Foo/Bar", "Asia/Bandung", "GMT+99"])("rejects %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});

describe("monthGrid", () => {
  it("lays October 2026 out Monday first, with empty cells outside the month", () => {
    const grid = monthGrid("2026-10-15");

    // 1 October 2026 is a Thursday, so Monday to Wednesday of that week are empty.
    expect(grid[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    // 31 October 2026 is a Saturday, so only Sunday is empty in the last week.
    expect(grid[grid.length - 1]).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      null,
    ]);
    expect(grid).toHaveLength(5);
  });

  it("contains every day of the month exactly once", () => {
    const days = monthGrid("2028-02-10").flat().filter((day) => day !== null);

    expect(days).toHaveLength(29);
    expect(days[0]).toBe("2028-02-01");
    expect(days[28]).toBe("2028-02-29");
  });

  it("always has seven columns", () => {
    for (const week of monthGrid("2026-03-01")) {
      expect(week).toHaveLength(7);
    }
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
