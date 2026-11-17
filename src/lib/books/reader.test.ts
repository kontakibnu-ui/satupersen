import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIZE_INDEX,
  isFixedFormat,
  parseFlow,
  parseSizeIndex,
  positionLabel,
  positionToSave,
  readerStyles,
  restoreTarget,
  tapAction,
} from "./reader";

const colors = { text: "rgb(232, 230, 225)", background: "rgb(20, 22, 27)", link: "rgb(169, 189, 230)" };

describe("pilihan yang diingat di perangkat (READ-3, READ-4)", () => {
  it("cara baca bawaannya Geser, dan nilai aneh kembali ke bawaan", () => {
    expect(parseFlow("scrolled")).toBe("scrolled");
    expect(parseFlow("paginated")).toBe("paginated");
    expect(parseFlow(null)).toBe("paginated");
    expect(parseFlow("lainnya")).toBe("paginated");
  });

  it("ukuran huruf hanya menerima indeks yang ada", () => {
    expect(parseSizeIndex("3")).toBe(3);
    expect(parseSizeIndex("9")).toBe(DEFAULT_SIZE_INDEX);
    expect(parseSizeIndex("1.5")).toBe(DEFAULT_SIZE_INDEX);
    expect(parseSizeIndex(null)).toBe(DEFAULT_SIZE_INDEX);
  });

  it("hanya PDF yang dibaca per halaman", () => {
    expect(isFixedFormat("pdf")).toBe(true);
    expect(["epub", "docx", "txt"].map((format) => isFixedFormat(format as "epub"))).toEqual([false, false, false]);
  });
});

describe("posisi baca (READ-6)", () => {
  it("menyimpan CFI dan persen empat desimal untuk buku yang mengalir", () => {
    expect(positionToSave({ cfi: "epubcfi(/6/4!/4/2:10)", fraction: 0.343456 }, false)).toEqual({
      location: "epubcfi(/6/4!/4/2:10)",
      progress: 0.3435,
    });
  });

  it("menyimpan nomor halaman untuk PDF", () => {
    expect(positionToSave({ section: { current: 22, total: 212 }, fraction: 0.1 }, true)).toEqual({
      location: "22",
      progress: 0.1,
    });
  });

  it("tidak menyimpan posisi yang tidak masuk akal", () => {
    expect(positionToSave({ cfi: "javascript:alert(1)", fraction: 2 }, false)).toEqual({ location: null, progress: 1 });
    expect(positionToSave({ cfi: `epubcfi(${"/4".repeat(1000)})` }, false)).toEqual({ location: null, progress: null });
    expect(positionToSave({ fraction: Number.NaN }, true)).toEqual({ location: null, progress: null });
  });

  it("membuka lagi di posisi yang tersimpan, sesuai jenis buku", () => {
    expect(restoreTarget("epubcfi(/6/4)", false)).toBe("epubcfi(/6/4)");
    expect(restoreTarget("22", true)).toBe(22);
    expect(restoreTarget("22", false)).toBeUndefined();
    expect(restoreTarget("epubcfi(/6/4)", true)).toBeUndefined();
    expect(restoreTarget(null, false)).toBeUndefined();
  });

  it("menulis posisi sebagai halaman untuk PDF dan persen untuk yang lain", () => {
    expect(positionLabel({ section: { current: 22, total: 212 }, fraction: 0.1 }, true)).toBe("Hlm 23 dari 212");
    expect(positionLabel({ fraction: 0.344 }, false)).toBe("34%");
    expect(positionLabel({}, false)).toBe("");
  });
});

describe("ketukan (READ-4)", () => {
  it("sepertiga kiri dan kanan membalik halaman di mode Geser, tengah memunculkan kontrol", () => {
    expect(tapAction(0.1, true)).toBe("left");
    expect(tapAction(0.9, true)).toBe("right");
    expect(tapAction(0.5, true)).toBe("menu");
  });

  it("di mode Gulir semua ketukan memunculkan kontrol", () => {
    expect(tapAction(0.1, false)).toBe("menu");
    expect(tapAction(0.9, false)).toBe("menu");
  });
});

describe("gaya yang disuntikkan ke buku (READ-5)", () => {
  it("mode siang tidak mengubah warna EPUB, hanya ukuran huruf", () => {
    const css = readerStyles({ format: "epub", dark: false, sizePercent: 115, colors });
    expect(css).toContain("font-size: 115%");
    expect(css).not.toContain("color:");
    expect(css).not.toContain("font-family");
  });

  it("mode malam menimpa warna dengan token malam, tanpa mengganti huruf EPUB", () => {
    const css = readerStyles({ format: "epub", dark: true, sizePercent: 100, colors });
    expect(css).toContain(`color: ${colors.text} !important`);
    expect(css).toContain(`background: ${colors.background} !important`);
    expect(css).toContain(`a, a * { color: ${colors.link} !important; }`);
    expect(css).not.toContain("font-family");
  });

  it("DOCX dan TXT memakai Lora dan warna kertas Satu Persen di mode siang", () => {
    const css = readerStyles({ format: "txt", dark: false, sizePercent: 100, colors });
    expect(css).toContain('font-family: "Lora"');
    expect(css).toContain(`background: ${colors.background};`);
  });
});
