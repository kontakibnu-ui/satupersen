import { describe, expect, it } from "vitest";
import {
  clearEntryDraft,
  draftKey,
  forgetAllEntryDrafts,
  forgetOtherEntryDrafts,
  readEntryDraft,
  resolveEntryDraft,
  writeEntryDraft,
  type DraftStorage,
} from "./entry-draft";

/** A small stand-in for window.localStorage, which vitest's node environment has not got. */
class MemoryStorage implements DraftStorage {
  private items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  keys() {
    return [...this.items.keys()].sort();
  }
}

/** Storage that refuses every write, like a full disk or a blocked site. */
class RefusingStorage extends MemoryStorage {
  setItem(): void {
    throw new DOMException("full", "QuotaExceededError");
  }
}

describe("resolveEntryDraft", () => {
  it("tanpa draf, tulisan server yang dipakai", () => {
    expect(resolveEntryDraft("Pagi", null)).toEqual({ kind: "none" });
  });

  it("draf yang sudah sama dengan server dibuang", () => {
    expect(resolveEntryDraft("Pagi tadi", { content: "Pagi tadi", base: "Pagi" })).toEqual({ kind: "discard" });
  });

  it("server belum berubah sejak draf ditulis: draf dilanjutkan", () => {
    expect(resolveEntryDraft("Pagi", { content: "Pagi tadi hujan", base: "Pagi" })).toEqual({
      kind: "restore",
      content: "Pagi tadi hujan",
    });
    // Deleting everything is also a change worth keeping.
    expect(resolveEntryDraft("Pagi", { content: "", base: "Pagi" })).toEqual({ kind: "restore", content: "" });
  });

  it("server diubah dari tempat lain setelah draf ditulis: user yang memilih", () => {
    expect(resolveEntryDraft("Ditulis di laptop", { content: "Ditulis di HP", base: "" })).toEqual({
      kind: "conflict",
      content: "Ditulis di HP",
    });
  });
});

describe("penyimpanan draf", () => {
  it("menulis, membaca, dan menghapus satu draf per user dan tanggal", () => {
    const storage = new MemoryStorage();

    expect(writeEntryDraft("user-a", "2026-11-18", { content: "Halo", base: "" }, storage)).toBe(true);
    expect(readEntryDraft("user-a", "2026-11-18", storage)).toEqual({ content: "Halo", base: "" });
    expect(readEntryDraft("user-b", "2026-11-18", storage)).toBeNull();
    expect(readEntryDraft("user-a", "2026-11-17", storage)).toBeNull();

    clearEntryDraft("user-a", "2026-11-18", storage);
    expect(readEntryDraft("user-a", "2026-11-18", storage)).toBeNull();
  });

  it("nilai yang bukan buatan kode ini diabaikan", () => {
    const storage = new MemoryStorage();

    storage.setItem(draftKey("user-a", "2026-11-18"), "bukan json");
    expect(readEntryDraft("user-a", "2026-11-18", storage)).toBeNull();

    storage.setItem(draftKey("user-a", "2026-11-18"), JSON.stringify({ content: 5 }));
    expect(readEntryDraft("user-a", "2026-11-18", storage)).toBeNull();
  });

  it("melapor false saat browser menolak, dan aman tanpa storage", () => {
    expect(writeEntryDraft("user-a", "2026-11-18", { content: "Halo", base: "" }, new RefusingStorage())).toBe(false);
    expect(writeEntryDraft("user-a", "2026-11-18", { content: "Halo", base: "" }, null)).toBe(false);
    expect(readEntryDraft("user-a", "2026-11-18", null)).toBeNull();
    expect(() => forgetAllEntryDrafts(null)).not.toThrow();
  });

  it("membuang draf hari lain dan akun lain, tanpa menyentuh data lain di browser", () => {
    const storage = new MemoryStorage();

    writeEntryDraft("user-a", "2026-11-18", { content: "hari ini", base: "" }, storage);
    writeEntryDraft("user-a", "2026-11-17", { content: "kemarin", base: "" }, storage);
    writeEntryDraft("user-b", "2026-11-18", { content: "akun lain", base: "" }, storage);
    storage.setItem("satupersen-theme", "dark");

    forgetOtherEntryDrafts("user-a", "2026-11-18", storage);

    expect(storage.keys()).toEqual([draftKey("user-a", "2026-11-18"), "satupersen-theme"].sort());
  });

  it("keluar akun membuang semua draf", () => {
    const storage = new MemoryStorage();

    writeEntryDraft("user-a", "2026-11-18", { content: "hari ini", base: "" }, storage);
    writeEntryDraft("user-b", "2026-11-18", { content: "akun lain", base: "" }, storage);
    storage.setItem("satupersen-theme", "dark");

    forgetAllEntryDrafts(storage);

    expect(storage.keys()).toEqual(["satupersen-theme"]);
  });
});
