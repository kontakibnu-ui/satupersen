import type { BookFormat } from "@/lib/books/rules";

/**
 * Pure rules of the Ruang baca reader (PRD.md READ-3 to READ-6), tested in
 * reader.test.ts. The component in src/app/read/[id]/reader.tsx only wires them
 * to the browser and to foliate-js.
 */

export type Flow = "scrolled" | "paginated";

/** Font sizes offered in the Aa panel, as a percentage of the book's own size. */
export const READER_SIZES = [90, 100, 115, 130, 150] as const;
export const DEFAULT_SIZE_INDEX = 1;

/** foliate-js lays PDF pages out as fixed pages, which it can only show one by one (READ-3). */
export function isFixedFormat(format: BookFormat): boolean {
  return format === "pdf";
}

export function parseFlow(value: string | null): Flow {
  return value === "scrolled" ? "scrolled" : "paginated";
}

export function parseSizeIndex(value: string | null): number {
  if (value === null || value.trim() === "") {
    return DEFAULT_SIZE_INDEX;
  }

  const index = Number(value);

  return Number.isInteger(index) && index >= 0 && index < READER_SIZES.length ? index : DEFAULT_SIZE_INDEX;
}

/** foliate-js's relocate detail, the parts the reader uses. */
export type RelocateDetail = {
  fraction?: number;
  section?: { current: number; total: number };
  cfi?: string;
};

/**
 * What to store as the reading position (READ-6): foliate-js's CFI for
 * reflowable books, the page index for fixed pages, and how far in as 0 to 1
 * with four decimals (the column is numeric(5, 4)).
 */
export function positionToSave(
  detail: RelocateDetail,
  isFixed: boolean,
): { location: string | null; progress: number | null } {
  const progress =
    typeof detail.fraction === "number" && Number.isFinite(detail.fraction)
      ? Math.round(Math.min(1, Math.max(0, detail.fraction)) * 10_000) / 10_000
      : null;

  if (isFixed) {
    const page = detail.section?.current;
    return { location: typeof page === "number" && page >= 0 ? String(page) : null, progress };
  }

  const cfi = typeof detail.cfi === "string" && detail.cfi.startsWith("epubcfi(") ? detail.cfi : null;

  return { location: cfi && cfi.length <= 2000 ? cfi : null, progress };
}

/** Where to open the book again: a page index for fixed pages, otherwise the stored CFI. */
export function restoreTarget(location: string | null, isFixed: boolean): string | number | undefined {
  if (!location) {
    return undefined;
  }

  if (isFixed) {
    return /^\d{1,6}$/.test(location) ? Number(location) : undefined;
  }

  return location.startsWith("epubcfi(") ? location : undefined;
}

/** "Hlm 23 dari 212" for fixed pages, "34%" otherwise, or empty before the first move. */
export function positionLabel(detail: RelocateDetail, isFixed: boolean): string {
  if (isFixed && detail.section && detail.section.total > 0) {
    return `Hlm ${detail.section.current + 1} dari ${detail.section.total}`;
  }

  if (typeof detail.fraction === "number" && Number.isFinite(detail.fraction)) {
    return `${Math.round(Math.min(1, Math.max(0, detail.fraction)) * 100)}%`;
  }

  return "";
}

/**
 * What a tap does, from where it lands across the book (0 = left edge, 1 =
 * right edge): the outer thirds turn the page in paged reading (READ-4), the
 * middle shows the controls. In scrolled reading every tap is the middle.
 */
export function tapAction(share: number, paged: boolean): "left" | "right" | "menu" {
  if (paged && share < 1 / 3) {
    return "left";
  }

  if (paged && share > 2 / 3) {
    return "right";
  }

  return "menu";
}

export type ReaderColors = { text: string; background: string; link: string };

/**
 * The CSS put into the book (READ-5). Day: the file's own colours, except DOCX
 * and TXT, which have none and take Satu Persen's paper. Night: the app's
 * night text and background replace the book's colours; type and layout stay.
 * The font size scales the book's root size. Colours come from the page's
 * tokens at run time, never written here.
 */
export function readerStyles(input: {
  format: BookFormat;
  dark: boolean;
  sizePercent: number;
  colors: ReaderColors;
}): string {
  const { format, dark, sizePercent, colors } = input;
  const ownDocument = format === "docx" || format === "txt";
  const rules = [`html { font-size: ${sizePercent}% !important; }`];

  if (ownDocument) {
    rules.push(
      'body { font-family: "Lora", Georgia, "Times New Roman", serif; line-height: 1.7; }',
      "p { margin: 0 0 1em; } img { max-width: 100%; height: auto; }",
    );
  }

  if (dark) {
    rules.push(
      `html, body { color: ${colors.text} !important; background: ${colors.background} !important; color-scheme: dark; }`,
      "body * { color: inherit !important; background-color: transparent !important; border-color: currentColor !important; }",
      `a, a * { color: ${colors.link} !important; }`,
    );
  } else if (ownDocument) {
    rules.push(`html, body { color: ${colors.text}; background: ${colors.background}; }`);
  }

  return rules.join("\n");
}
