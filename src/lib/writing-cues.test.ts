import { describe, expect, it } from "vitest";
import { cueForDay, WRITING_CUES } from "@/lib/writing-cues";

describe("cueForDay", () => {
  it("gives the same day the same cue every time", () => {
    expect(cueForDay("2026-10-31")).toBe(cueForDay("2026-10-31"));
    expect(cueForDay("2026-10-31", 3)).toBe(cueForDay("2026-10-31", 3));
  });

  it("starts the next day on the next cue", () => {
    const index = WRITING_CUES.indexOf(cueForDay("2026-10-31") as (typeof WRITING_CUES)[number]);
    expect(cueForDay("2026-11-01")).toBe(WRITING_CUES[(index + 1) % WRITING_CUES.length]);
  });

  it("walks through every cue once before repeating", () => {
    const seen = new Set(WRITING_CUES.map((_, step) => cueForDay("2026-10-31", step)));
    expect(seen.size).toBe(WRITING_CUES.length);
    expect(cueForDay("2026-10-31", WRITING_CUES.length)).toBe(cueForDay("2026-10-31"));
  });

  it("stays inside the list for days before the anchor", () => {
    expect(WRITING_CUES).toContain(cueForDay("2025-03-02"));
    expect(WRITING_CUES).toContain(cueForDay("1999-12-31", 7));
  });

  it("refuses a date that is not a real day", () => {
    expect(() => cueForDay("2026-02-31")).toThrow();
  });
});
