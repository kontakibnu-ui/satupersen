import { describe, expect, it } from "vitest";
import { comparedToLabel, deltaFigure, deltaSentence, deltaSentenceParts } from "@/lib/score-delta";

describe("comparedToLabel", () => {
  it("says kemarin for the day before", () => {
    expect(comparedToLabel("2026-11-01", "2026-10-31")).toBe("kemarin");
  });

  it("names the weekday within the last week", () => {
    // 2026-10-29 is a Thursday.
    expect(comparedToLabel("2026-11-01", "2026-10-29")).toBe("hari Kamis");
    expect(comparedToLabel("2026-11-01", "2026-10-26")).toBe("hari Senin");
  });

  it("gives the date from a week back, across a month and a year", () => {
    expect(comparedToLabel("2026-11-01", "2026-10-25")).toBe("25 Oktober");
    expect(comparedToLabel("2027-01-03", "2026-12-20")).toBe("20 Desember");
  });

  it("rejects a previous day that is not before today", () => {
    expect(() => comparedToLabel("2026-11-01", "2026-11-01")).toThrow(/before today/);
    expect(() => comparedToLabel("2026-11-01", "2026-11-02")).toThrow(/before today/);
  });
});

describe("deltaSentence", () => {
  it("reads as better, lower, or the same", () => {
    expect(deltaSentence(2, "kemarin")).toBe("Kamu 2% lebih baik dibanding kemarin");
    expect(deltaSentence(-3, "hari Kamis")).toBe("Turun 3% dibanding hari Kamis");
    expect(deltaSentence(0, "kemarin")).toBe("Stabil, sama seperti kemarin");
  });

  it("explains the first analysis instead of showing a number", () => {
    expect(deltaSentence(null, null)).toBe("Ini analisa pertamamu. Mulai besok kamu bisa lihat perbandingannya.");
  });

  it("never shows the score itself", () => {
    expect(deltaSentence(30, "kemarin")).not.toMatch(/\/100|dari 100|skor/i);
  });
});

describe("deltaSentenceParts", () => {
  it("puts the figure in the key phrase, which is what gets underlined", () => {
    expect(deltaSentenceParts(4, "kemarin")).toEqual({
      before: "Kamu ",
      key: "4% lebih baik",
      after: " dibanding kemarin",
    });
    expect(deltaSentenceParts(-3, "hari Kamis")).toEqual({ before: "", key: "Turun 3%", after: " dibanding hari Kamis" });
    expect(deltaSentenceParts(0, "kemarin")).toEqual({ before: "", key: "Stabil", after: ", sama seperti kemarin" });
  });

  it("has no key phrase for the first analysis", () => {
    expect(deltaSentenceParts(null, null).key).toBeNull();
  });

  it("joins back into exactly the sentence", () => {
    for (const [delta, compared] of [
      [7, "kemarin"],
      [-1, "12 Oktober"],
      [0, "hari Senin"],
      [null, null],
    ] as const) {
      const { before, key, after } = deltaSentenceParts(delta, compared);
      expect(`${before}${key ?? ""}${after}`).toBe(deltaSentence(delta, compared));
    }
  });
});

describe("deltaFigure", () => {
  it("signs the figure inside the stamp", () => {
    expect(deltaFigure(2)).toBe("+2%");
    expect(deltaFigure(-3)).toBe("−3%");
    expect(deltaFigure(0)).toBe("0%");
  });
});
