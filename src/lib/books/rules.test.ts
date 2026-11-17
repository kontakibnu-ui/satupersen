import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOK_HEAD_BYTES,
  bookRoom,
  detectBookFormat,
  formatBytes,
  MAX_BOOK_BYTES,
  MAX_SELECTION_LENGTH,
  normalizeSelection,
  progressPercent,
  suggestMaterialTitle,
  textToHtml,
  titleFromFileName,
} from "./rules";

const bytes = (...parts: (string | number[])[]): Uint8Array =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? Array.from(new TextEncoder().encode(part)) : part)));

const zipHeader = [0x50, 0x4b, 0x03, 0x04];
// A local file header is 30 bytes before the entry name.
const epubHead = bytes(zipHeader, new Array(26).fill(0), "mimetypeapplication/epub+zip", "META-INF/");

describe("detectBookFormat (READ-1)", () => {
  it("mengenali PDF dari tanda %PDF- tepat di awal file, seperti syarat foliate-js", () => {
    expect(detectBookFormat("modul.pdf", bytes("%PDF-1.7\n%âãÏÓ"))).toBe("pdf");
    expect(detectBookFormat("MODUL.PDF", bytes("%PDF-1.4"))).toBe("pdf");
    expect(detectBookFormat("bergeser.pdf", bytes("\n\n%PDF-1.4"))).toBeNull();
  });

  it("mengenali EPUB dari berkas mimetype pertama di dalam ZIP", () => {
    expect(detectBookFormat("buku.epub", epubHead)).toBe("epub");
  });

  it("mengenali DOCX sebagai ZIP berekstensi .docx", () => {
    expect(detectBookFormat("tugas.docx", bytes(zipHeader, "[Content_Types].xml"))).toBe("docx");
  });

  it("mengenali TXT sebagai UTF-8, termasuk huruf yang terpotong di ujung", () => {
    expect(detectBookFormat("catatan.txt", bytes("Halo, apa kabar?"))).toBe("txt");
    const cut = new TextEncoder().encode("Kopi ☕").subarray(0, -1);
    expect(detectBookFormat("catatan.txt", cut)).toBe("txt");
  });

  it("menolak file yang isinya tidak cocok dengan ekstensinya", () => {
    expect(detectBookFormat("palsu.pdf", bytes("<html><script>"))).toBeNull();
    expect(detectBookFormat("palsu.epub", bytes(zipHeader, "[Content_Types].xml"))).toBeNull();
    expect(detectBookFormat("palsu.docx", bytes("%PDF-1.7"))).toBeNull();
    expect(detectBookFormat("biner.txt", bytes([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))).toBeNull();
    expect(detectBookFormat("kosong.txt", new Uint8Array())).toBeNull();
  });

  it("mengenali file contoh sungguhan yang dipakai tes ujung ke ujung", () => {
    const head = (name: string) =>
      new Uint8Array(readFileSync(join(process.cwd(), "e2e", "fixtures", "books", name)).subarray(0, BOOK_HEAD_BYTES));

    expect(detectBookFormat("catatan-kecil.epub", head("catatan-kecil.epub"))).toBe("epub");
    expect(detectBookFormat("buku-berskrip.epub", head("buku-berskrip.epub"))).toBe("epub");
    expect(detectBookFormat("dua-halaman.pdf", head("dua-halaman.pdf"))).toBe("pdf");
    expect(detectBookFormat("modul.docx", head("modul.docx"))).toBe("docx");
    expect(detectBookFormat("catatan.txt", head("catatan.txt"))).toBe("txt");
  });

  it("menolak format di luar empat yang diputuskan", () => {
    expect(detectBookFormat("novel.mobi", bytes("BOOKMOBI"))).toBeNull();
    expect(detectBookFormat("komik.cbz", bytes(zipHeader))).toBeNull();
    expect(detectBookFormat("tanpa-ekstensi", bytes("%PDF-1.7"))).toBeNull();
  });
});

describe("titleFromFileName", () => {
  it("membuang ekstensi, folder, dan garis bawah", () => {
    expect(titleFromFileName("Catatan_Kecil_tentang_Ingatan.epub")).toBe("Catatan Kecil tentang Ingatan");
    expect(titleFromFileName("C:\\Unduhan\\modul  bab 2.pdf")).toBe("modul bab 2");
  });

  it("memotong judul sampai 120 karakter dan tidak pernah kosong", () => {
    expect(Array.from(titleFromFileName(`${"a".repeat(200)}.txt`))).toHaveLength(120);
    expect(titleFromFileName(".pdf")).toBe(".pdf");
    expect(titleFromFileName("___.txt")).toBe("Tanpa judul");
  });
});

describe("formatBytes dan progressPercent", () => {
  it("menulis ukuran dengan notasi Indonesia", () => {
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2,4 MB");
    expect(formatBytes(820 * 1024)).toBe("820 KB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2 GB");
    expect(formatBytes(12)).toBe("12 B");
  });

  it("membulatkan posisi baca ke persen utuh dan kosong bila belum pernah dibuka", () => {
    expect(progressPercent(0.344)).toBe(34);
    expect(progressPercent(1.2)).toBe(100);
    expect(progressPercent(null)).toBeNull();
    expect(progressPercent(Number.NaN)).toBeNull();
  });
});

describe("bookRoom (READ-2)", () => {
  const megabyte = 1024 * 1024;

  it("free: satu buku per akun, menghapus tidak membuka slot", () => {
    expect(bookRoom({ plan: "free", booksCreated: 0, usedBytes: 0, size: megabyte })).toEqual({ ok: true });
    expect(bookRoom({ plan: "free", booksCreated: 1, usedBytes: 0, size: megabyte })).toMatchObject({
      ok: false,
      reason: "limit",
    });
  });

  it("premium: jumlah bebas, total 2 GB", () => {
    const twoGigabytes = 2 * 1024 * megabyte;
    expect(bookRoom({ plan: "premium", booksCreated: 40, usedBytes: twoGigabytes - megabyte, size: megabyte })).toEqual({
      ok: true,
    });
    const full = bookRoom({ plan: "premium", booksCreated: 40, usedBytes: twoGigabytes - megabyte, size: megabyte + 1 });
    expect(full).toMatchObject({ ok: false, reason: "storage_full" });
    expect(full.ok ? "" : full.message).toContain("1 MB dari 2 GB");
  });

  it("menolak file kosong dan file di atas 50 MB untuk semua paket", () => {
    expect(bookRoom({ plan: "premium", booksCreated: 0, usedBytes: 0, size: MAX_BOOK_BYTES + 1 })).toMatchObject({
      reason: "too_large",
    });
    expect(bookRoom({ plan: "free", booksCreated: 0, usedBytes: 0, size: 0 })).toMatchObject({ reason: "too_large" });
    expect(bookRoom({ plan: "free", booksCreated: 0, usedBytes: 0, size: MAX_BOOK_BYTES })).toEqual({ ok: true });
  });
});

describe("Jadikan materi (READ-7)", () => {
  it("merapikan spasi dan baris pada teks yang diblok", () => {
    expect(normalizeSelection("  Rasa akrab\n\nitu   menipu.  ")).toBe("Rasa akrab itu menipu.");
  });

  it("batas teks sama dengan batas bahan materi", () => {
    expect(MAX_SELECTION_LENGTH).toBe(5000);
  });

  it("mengusulkan judul dari kalimat pertama dan judul buku, maksimal 120 karakter", () => {
    expect(suggestMaterialTitle("Rasa akrab itu menipu. Kita mengira sudah paham.", "Catatan Kecil")).toBe(
      "Rasa akrab itu menipu. · Catatan Kecil",
    );

    const long = suggestMaterialTitle(`${"kata ".repeat(80)}`, "Judul buku yang sangat panjang ".repeat(5));
    expect(Array.from(long).length).toBeLessThanOrEqual(120);
    expect(long).toContain("…");
    expect(suggestMaterialTitle("   ", "Catatan")).toBe("Catatan");
    expect(suggestMaterialTitle("Isi saja.", "")).toBe("Isi saja.");
  });
});

describe("textToHtml (READ-3)", () => {
  it("membuat paragraf dari baris kosong dan mempertahankan pindah baris", () => {
    const html = textToHtml("Baris satu\nbaris dua\r\n\r\nParagraf dua", "Catatan");
    expect(html).toContain("<p>Baris satu<br>baris dua</p>");
    expect(html).toContain("<p>Paragraf dua</p>");
    expect(html).toContain("<title>Catatan</title>");
  });

  it("tidak pernah mengubah isi file menjadi markup", () => {
    const html = textToHtml('<script>alert("x")</script> & <img src=x onerror=alert(1)>', '<b>"judul"</b>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;img");
    expect(html).toContain("<title>&lt;b&gt;&quot;judul&quot;&lt;/b&gt;</title>");
  });
});
