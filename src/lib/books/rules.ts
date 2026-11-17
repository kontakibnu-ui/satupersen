import { PLAN_LIMITS, type Plan } from "@/config/plans";
import { MAX_SOURCE_LENGTH, MAX_TITLE_LENGTH } from "@/lib/study/rules";

/**
 * Rules of Ruang baca (PRD.md READ-1, READ-2, READ-7) that the screens, the
 * server actions, and the reader share. Pure functions, tested in rules.test.ts.
 * The database repeats the size cap and the plan limits
 * (supabase/migrations/20261117000000_reading_room.sql).
 */

export const BOOK_FORMATS = ["pdf", "epub", "docx", "txt"] as const;

export type BookFormat = (typeof BOOK_FORMATS)[number];

/** 50 MB per file, the same in the bucket, the table check, and here. */
export const MAX_BOOK_BYTES = 50 * 1024 * 1024;

/** How many bytes from the start of a file `detectBookFormat` needs. */
export const BOOK_HEAD_BYTES = 4096;

/** "Jadikan materi" carries at most what a material may hold (LEARN-1). */
export const MAX_SELECTION_LENGTH = MAX_SOURCE_LENGTH;

export const FORMAT_LABELS: Record<BookFormat, string> = {
  pdf: "PDF",
  epub: "EPUB",
  docx: "DOCX",
  txt: "TXT",
};

/** The type each format is stored with; the bucket accepts only these four. */
export const CONTENT_TYPES: Record<BookFormat, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

/** What the file picker offers; the content is checked afterwards anyway. */
export const ACCEPT_ATTRIBUTE = [".pdf", ".epub", ".docx", ".txt", ...Object.values(CONTENT_TYPES)].join(",");

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const isZip = (head: Uint8Array): boolean =>
  head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");

  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** True when the bytes are UTF-8 text without NUL bytes, allowing a character cut at the end. */
function looksLikeText(head: Uint8Array): boolean {
  if (head.includes(0)) {
    return false;
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });

  // The head may end in the middle of a multi-byte character; try dropping up to 3 bytes.
  for (let cut = 0; cut <= Math.min(3, head.length); cut += 1) {
    try {
      decoder.decode(head.subarray(0, head.length - cut));
      return true;
    } catch {
      // Not valid with this cut; the next one drops one more byte.
    }
  }

  return false;
}

/**
 * The format of a file, from its extension confirmed by its first bytes
 * (READ-1). Returns null when the extension is not one of the four, or when the
 * content does not match it (a renamed file, a DRM container with another
 * signature, or text that is not UTF-8).
 *
 * - PDF: "%PDF-" at the very start, which foliate-js requires to open it.
 * - EPUB: a ZIP whose first entry is the uncompressed "mimetype" file holding
 *   "application/epub+zip", which the EPUB standard requires.
 * - DOCX: a ZIP. Its parts can come in any order, so the extension decides;
 *   the converter refuses a ZIP that is not a Word document when it is opened.
 * - TXT: UTF-8 text without NUL bytes.
 */
export function detectBookFormat(fileName: string, head: Uint8Array): BookFormat | null {
  switch (extensionOf(fileName)) {
    case "pdf":
      return ascii(head, 0, 5) === "%PDF-" ? "pdf" : null;
    case "epub":
      return isZip(head) && ascii(head, 30, 28) === "mimetypeapplication/epub+zip" ? "epub" : null;
    case "docx":
      return isZip(head) ? "docx" : null;
    case "txt":
      return head.length > 0 && looksLikeText(head) ? "txt" : null;
    default:
      return null;
  }
}

/** The book's title from its file name: no extension, no underscores, at most 120 characters. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "");
  const dot = base.lastIndexOf(".");
  const withoutExtension = dot > 0 ? base.slice(0, dot) : base;
  const cleaned = withoutExtension.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

  return cleaned === "" ? "Tanpa judul" : Array.from(cleaned).slice(0, MAX_TITLE_LENGTH).join("").trim();
}

/** "2,4 MB", "820 KB", or "12 B" in Indonesian notation. */
export function formatBytes(bytes: number): string {
  const format = (value: number, digits: number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(value);

  if (bytes >= 1024 * 1024 * 1024) {
    return `${format(bytes / (1024 * 1024 * 1024), 1)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${format(bytes / (1024 * 1024), 1)} MB`;
  }

  if (bytes >= 1024) {
    return `${format(bytes / 1024, 0)} KB`;
  }

  return `${format(bytes, 0)} B`;
}

/** Whole percent read, or null when the book was never opened. */
export function progressPercent(progress: number | null | undefined): number | null {
  if (progress === null || progress === undefined || !Number.isFinite(progress)) {
    return null;
  }

  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

export type BookRoom =
  | { ok: true }
  | { ok: false; reason: "too_large" | "limit" | "storage_full"; message: string };

/**
 * Whether one more book of `size` bytes fits (READ-2). The server decides again
 * inside the database under a lock; this gives the screen the same answer
 * before anything is uploaded.
 */
export function bookRoom(input: {
  plan: Plan;
  booksCreated: number;
  usedBytes: number;
  size: number;
}): BookRoom {
  if (input.size < 1 || input.size > MAX_BOOK_BYTES) {
    return { ok: false, reason: "too_large", message: "Ukuran file maksimal 50 MB." };
  }

  const limits = PLAN_LIMITS[input.plan];

  if (limits.books !== null && input.booksCreated >= limits.books) {
    return {
      ok: false,
      reason: "limit",
      message: "Paket gratis memuat 1 buku. Buku lebih banyak ada di Premium.",
    };
  }

  if (limits.bookStorageBytes !== null && input.usedBytes + input.size > limits.bookStorageBytes) {
    const left = Math.max(0, limits.bookStorageBytes - input.usedBytes);

    return {
      ok: false,
      reason: "storage_full",
      message: `Ruang bukumu tinggal ${formatBytes(left)} dari ${formatBytes(limits.bookStorageBytes)}. Hapus buku yang sudah selesai dulu.`,
    };
  }

  return { ok: true };
}

/** Selected text as it goes into a material: whitespace collapsed, ends trimmed. */
export function normalizeSelection(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cutAtWord(text: string, max: number): string {
  const characters = Array.from(text);

  if (characters.length <= max) {
    return text;
  }

  const cut = characters.slice(0, max).join("");
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * A title for the material made from a selection (READ-7): the start of the
 * text up to its first sentence end, then the book's title, within the 120
 * characters a material title may have. The user can change it in the form.
 */
export function suggestMaterialTitle(selection: string, bookTitle: string): string {
  const text = normalizeSelection(selection);
  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
  const book = cutAtWord(normalizeSelection(bookTitle), 50);
  const room = MAX_TITLE_LENGTH - Array.from(book).length - 3;
  const start = cutAtWord(sentence, Math.min(60, room));

  if (start === "") {
    return book === "" ? "Tanpa judul" : book;
  }

  return book === "" ? start : `${start} · ${book}`;
}

/** Escapes text so it can only ever be text inside HTML. */
export const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A plain text book as one HTML document for the reader (READ-3). Every
 * character is escaped, so nothing in the file can become markup; blank lines
 * start a new paragraph and single line breaks stay line breaks.
 */
export function textToHtml(text: string, title: string): string {
  const paragraphs = text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "")
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`);

  return [
    "<!DOCTYPE html>",
    '<html lang="id"><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    "</head><body>",
    paragraphs.join("\n"),
    "</body></html>",
  ].join("\n");
}
