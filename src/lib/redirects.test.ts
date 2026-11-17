import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/redirects";

describe("safeNextPath", () => {
  it("keeps a path inside the app, with its query", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/history?date=2026-11-14")).toBe("/history?date=2026-11-14");
  });

  it("falls back when there is no value", () => {
    expect(safeNextPath(undefined)).toBe("/today");
    expect(safeNextPath(null)).toBe("/today");
    expect(safeNextPath("")).toBe("/today");
  });

  it("refuses anything a browser could read as another host", () => {
    expect(safeNextPath("//evil.com")).toBe("/today");
    expect(safeNextPath("/\\evil.com")).toBe("/today");
    expect(safeNextPath("@evil.com")).toBe("/today");
    expect(safeNextPath("https://evil.com")).toBe("/today");
    expect(safeNextPath("evil.com/today")).toBe("/today");
  });

  it("uses the fallback it is given", () => {
    expect(safeNextPath("//evil.com", "/login")).toBe("/login");
  });
});
