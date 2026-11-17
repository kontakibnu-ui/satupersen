import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  limitReached,
  MONTHLY_TOKEN_SOFT_CAP,
  PLAN_LIMITS,
  PREMIUM_PACKAGES,
  packageValue,
  tokenStanding,
} from "./plans";

const migration = (name: string) => readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

describe("PLAN_LIMITS (PRD §8)", () => {
  it("gratis berbatas, premium tanpa batas untuk hal yang dihitung", () => {
    expect(PLAN_LIMITS.free).toMatchObject({ activeHabits: 3, activeWallets: 3, activeGoals: 1, recurringRules: 3 });
    expect(PLAN_LIMITS.premium).toMatchObject({
      activeHabits: null,
      activeWallets: null,
      activeGoals: null,
      recurringRules: null,
    });
  });

  it("kategori kustom, budget kategori, dan budget bulanan hanya untuk premium", () => {
    for (const key of ["customCategories", "categoryBudgets", "monthlyBudget"] as const) {
      expect(PLAN_LIMITS.free[key]).toBe(false);
      expect(PLAN_LIMITS.premium[key]).toBe(true);
    }
  });

  it("premium selalu memberi lebih banyak, tidak pernah lebih sedikit", () => {
    expect(PLAN_LIMITS.premium.reanalysesPerDay).toBeGreaterThan(PLAN_LIMITS.free.reanalysesPerDay);
    expect(PLAN_LIMITS.premium.whatsappRepliesPerDay).toBeGreaterThan(PLAN_LIMITS.free.whatsappRepliesPerDay);
    expect(PLAN_LIMITS.premium.chartDays).toBeGreaterThan(PLAN_LIMITS.free.chartDays);
    expect(PLAN_LIMITS.premium.askPerDay).toBeGreaterThan(PLAN_LIMITS.free.askPerDay);
    expect(PLAN_LIMITS.premium.askHistoryDays).toBeNull();
  });

  it("angka di trigger database sama dengan angka di sini", () => {
    expect(migration("20261029000000_habit_rules.sql")).toMatch(
      new RegExp(`active_count >= ${PLAN_LIMITS.free.activeHabits}\\b`),
    );
    expect(migration("20261115000000_study_and_rate_limits.sql")).toMatch(
      new RegExp(`coalesce\\(created_count, 0\\) >= ${PLAN_LIMITS.free.studyMaterials}\\b`),
    );
  });

  it("Belajar: free 1 materi dan 1 pemeriksaan per akun per hari, premium 10 per materi (LEARN-5)", () => {
    expect(PLAN_LIMITS.free.studyMaterials).toBe(1);
    expect(PLAN_LIMITS.premium.studyMaterials).toBeNull();
    expect(PLAN_LIMITS.free.studyChecks).toEqual({ scope: "account", perDay: 1 });
    expect(PLAN_LIMITS.premium.studyChecks).toEqual({ scope: "material", perDay: 10 });
  });

  it("Ruang baca: free 1 buku per akun, premium total 2 GB, dan SQL memakai angka yang sama (READ-2)", () => {
    expect(PLAN_LIMITS.free).toMatchObject({ books: 1, bookStorageBytes: null });
    expect(PLAN_LIMITS.premium).toMatchObject({ books: null, bookStorageBytes: 2_147_483_648 });

    const sql = migration("20261117000000_reading_room.sql");
    expect(sql).toMatch(new RegExp(`in_flight >= ${PLAN_LIMITS.free.books}\\b`));
    expect(sql).toMatch(new RegExp(`coalesce\\(created_count, 0\\) >= ${PLAN_LIMITS.free.books}\\b`));
    expect(sql.match(new RegExp(`> ${PLAN_LIMITS.premium.bookStorageBytes}\\b`, "g"))).toHaveLength(2);
  });
});

describe("limitReached", () => {
  it("batas null tidak pernah tercapai", () => {
    expect(limitReached(null, 1_000)).toBe(false);
  });

  it("tercapai tepat saat jumlahnya sama dengan batas", () => {
    expect(limitReached(3, 2)).toBe(false);
    expect(limitReached(3, 3)).toBe(true);
    expect(limitReached(1, 4)).toBe(true);
  });
});

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
