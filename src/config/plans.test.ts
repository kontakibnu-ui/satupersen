import { describe, expect, it } from "vitest";
import { MONTHLY_TOKEN_SOFT_CAP, PREMIUM_PACKAGES, packageValue, tokenStanding } from "./plans";

describe("PREMIUM_PACKAGES (PRD §8)", () => {
  it("menawarkan 1, 3, 6, dan 12 bulan, berurutan", () => {
    expect(PREMIUM_PACKAGES.map((pkg) => pkg.months)).toEqual([1, 3, 6, 12]);
  });

  it("makin lama makin murah per bulan, dan 12 bulan paling hemat", () => {
    const perMonth = PREMIUM_PACKAGES.map((pkg) => packageValue(pkg).perMonth);

    for (let index = 1; index < perMonth.length; index += 1) {
      expect(perMonth[index]).toBeLessThan(perMonth[index - 1]);
    }

    const savings = PREMIUM_PACKAGES.map((pkg) => packageValue(pkg).savingsPercent);
    expect(Math.max(...savings)).toBe(packageValue(PREMIUM_PACKAGES[3]).savingsPercent);
  });

  it("3 bulan sudah terasa hemat (minimal 10%)", () => {
    expect(packageValue(PREMIUM_PACKAGES[1]).savingsPercent).toBeGreaterThanOrEqual(10);
  });
});

describe("packageValue", () => {
  it("1 bulan tidak punya potongan", () => {
    expect(packageValue({ months: 1, price: 29_000 })).toEqual({ perMonth: 29_000, savingsPercent: 0, savedRupiah: 0 });
  });

  it("menghitung harga per bulan (dibulatkan ke bawah) dan hematnya terhadap harga bulanan", () => {
    expect(packageValue({ months: 3, price: 74_000 })).toEqual({ perMonth: 24_666, savingsPercent: 15, savedRupiah: 13_000 });
    expect(packageValue({ months: 12, price: 199_000 })).toEqual({ perMonth: 16_583, savingsPercent: 43, savedRupiah: 149_000 });
  });

  it("tidak pernah melaporkan hemat negatif", () => {
    expect(packageValue({ months: 2, price: 99_000 }).savedRupiah).toBe(0);
  });
});

describe("tokenStanding", () => {
  it("di bawah batas: belum lewat, persen dibulatkan", () => {
    expect(tokenStanding("free", 30_000)).toEqual({ used: 30_000, cap: MONTHLY_TOKEN_SOFT_CAP.free, percent: 20, overCap: false });
  });

  it("tepat di batas sudah dihitung lewat", () => {
    expect(tokenStanding("premium", MONTHLY_TOKEN_SOFT_CAP.premium).overCap).toBe(true);
  });

  it("persen tidak lewat 100, dan nilai aneh dari database dirapikan", () => {
    expect(tokenStanding("free", 999_999).percent).toBe(100);
    expect(tokenStanding("free", -5)).toMatchObject({ used: 0, percent: 0, overCap: false });
  });

  it("batas premium jauh di atas batas gratis", () => {
    expect(MONTHLY_TOKEN_SOFT_CAP.premium).toBeGreaterThan(MONTHLY_TOKEN_SOFT_CAP.free * 5);
  });
});
