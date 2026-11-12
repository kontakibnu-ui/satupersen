import { describe, expect, it } from "vitest";
import { firstName, greetingFor, localHour } from "@/lib/greeting";

describe("greetingFor", () => {
  it.each([
    [4, "Selamat pagi"],
    [10, "Selamat pagi"],
    [11, "Selamat siang"],
    [14, "Selamat siang"],
    [15, "Selamat sore"],
    [17, "Selamat sore"],
    [18, "Selamat malam"],
    [23, "Selamat malam"],
    [0, "Selamat malam"],
    [3, "Selamat malam"],
  ])("hour %i is %s", (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});

describe("localHour", () => {
  it("uses the user's zone, not the server's", () => {
    const instant = new Date("2026-10-29T01:30:00Z");
    expect(localHour(instant, "Asia/Jakarta")).toBe(8);
    expect(localHour(instant, "Asia/Makassar")).toBe(9);
    expect(localHour(instant, "Asia/Jayapura")).toBe(10);
  });
});

describe("firstName", () => {
  it("takes the first word and ignores empty names", () => {
    expect(firstName("Dev Lokal")).toBe("Dev");
    expect(firstName("  Ibnu  ")).toBe("Ibnu");
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});
