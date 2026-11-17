import { describe, expect, it } from "vitest";
import { canAddMaterial, checksLeftToday, checksUsedUpMessage } from "./limits";

describe("batas materi (LEARN-5)", () => {
  it("free hanya bisa membuat 1 materi seumur akun", () => {
    expect(canAddMaterial("free", 0)).toBe(true);
    expect(canAddMaterial("free", 1)).toBe(false);
    expect(canAddMaterial("free", 7)).toBe(false);
  });

  it("premium tanpa batas", () => {
    expect(canAddMaterial("premium", 0)).toBe(true);
    expect(canAddMaterial("premium", 250)).toBe(true);
  });
});

describe("pemeriksaan AI per hari (LEARN-5)", () => {
  it("free: 1x per hari untuk seluruh akun", () => {
    expect(checksLeftToday("free", { accountToday: 0, materialToday: 0 })).toBe(1);
    expect(checksLeftToday("free", { accountToday: 1, materialToday: 0 })).toBe(0);
  });

  it("premium: 10x per materi per hari, materi lain tidak mengurangi", () => {
    expect(checksLeftToday("premium", { accountToday: 25, materialToday: 0 })).toBe(10);
    expect(checksLeftToday("premium", { accountToday: 25, materialToday: 9 })).toBe(1);
    expect(checksLeftToday("premium", { accountToday: 25, materialToday: 10 })).toBe(0);
  });

  it("tidak pernah negatif", () => {
    expect(checksLeftToday("free", { accountToday: 3, materialToday: 3 })).toBe(0);
    expect(checksLeftToday("premium", { accountToday: 12, materialToday: 12 })).toBe(0);
  });

  it("pesan habis berbeda untuk free dan premium", () => {
    expect(checksUsedUpMessage("free")).toContain("1x sehari");
    expect(checksUsedUpMessage("premium")).toContain("10x");
  });
});
