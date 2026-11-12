import { describe, expect, it } from "vitest";
import { compound, dialFraction, formatMultiple, MAX_DAYS } from "./compound";

describe("compound (ilustrasi 1% per hari di landing)", () => {
  it("1% lebih baik selama setahun kira-kira 37,8 kali", () => {
    expect(compound(365, 0.01)).toBeCloseTo(37.78, 2);
  });

  it("1% lebih buruk selama setahun tinggal sekitar 0,03", () => {
    expect(compound(365, -0.01)).toBeCloseTo(0.0255, 4);
  });

  it("hari ke-0 sama dengan titik awal", () => {
    expect(compound(0, 0.01)).toBe(1);
  });

  it("hari di luar 0 sampai 365 dirapikan, dan pecahan hari dibulatkan", () => {
    expect(compound(-5, 0.01)).toBe(1);
    expect(compound(10_000, 0.01)).toBe(compound(MAX_DAYS, 0.01));
    expect(compound(29.6, 0.01)).toBe(compound(30, 0.01));
  });
});

describe("formatMultiple", () => {
  it.each([
    [37.78, "37,8"],
    [2.4486, "2,45"],
    [0.0255, "0,03"],
    [1, "1,00"],
  ])("%d -> %s", (value, expected) => {
    expect(formatMultiple(value)).toBe(expected);
  });
});

describe("dialFraction", () => {
  it("kosong di hari 0, penuh di hari 365, setengah di tengah tahun", () => {
    expect(dialFraction(0)).toBe(0);
    expect(dialFraction(365)).toBe(1);
    expect(dialFraction(182.5)).toBeCloseTo(0.5, 2);
  });
});
