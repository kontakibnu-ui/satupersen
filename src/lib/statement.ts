import { isDateKey } from "@/lib/dates";
import { isAllowedEntryDate, isCategoryOf, MAX_AMOUNT, type EntryType } from "@/lib/expenses";
import { redactLongNumbers } from "@/lib/receipt";

/**
 * "Dari e-statement" on the Uang screen (PRD.md EXP-9). The file is read on the
 * phone; only its text, cut down by `prepareStatementText`, reaches the server,
 * which reads it part by part with the model and checks every transaction here.
 * Nothing is stored until the user ticks the rows and saves them.
 *
 * Shared by the browser (so long numbers and email addresses never leave the
 * phone) and the server (which applies the same cut again, plus the profile name,
 * because the browser can be edited).
 */

/** What the file picker offers. Extensions first, because phones often report no MIME type for CSV. */
export const STATEMENT_ACCEPT =
  ".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const MAX_STATEMENT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_STATEMENT_PAGES = 40;

/** A long month of a busy account fits; anything longer is asked to be split. */
export const MAX_STATEMENT_TEXT_LENGTH = 60_000;

/** One model call reads at most this much, so its answer comes back well inside the 30 second timeout. */
export const STATEMENT_PART_LENGTH = 4_000;

/** How many rows one save may carry. */
export const MAX_STATEMENT_ENTRIES = 400;

/** Fewer letters or digits than this is not a statement worth sending. */
export const MIN_STATEMENT_TEXT_LENGTH = 20;

/** A short note keeps the list readable; the user can still edit it after saving. */
export const MAX_STATEMENT_NOTE_LENGTH = 100;

export const REDACTED_EMAIL = "[email disamarkan]";
export const REDACTED_NAME = "[nama disamarkan]";

export type StatementFormat = "pdf" | "csv" | "excel";

/** The kind of file by its name first, then its MIME type; null for anything else. */
export function statementFormatOf(name: string, mimeType: string): StatementFormat | null {
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    return "pdf";
  }

  if (lower.endsWith(".csv") || mimeType === "text/csv") {
    return "csv";
  }

  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "excel";
  }

  return null;
}

/** One run of text on a PDF page, as PDF.js reports it: position in points, y counted up from the bottom. */
export type PositionedText = { str: string; x: number; y: number; width: number; height: number };

/** Items closer together vertically than this share of their height sit on one line. */
const SAME_LINE_SHARE = 0.5;

/**
 * Rebuilds the lines of one PDF page from its text runs: runs on the same
 * height form a line, read left to right. A wide gap between two runs is a
 * column break and becomes " | ", so the amount and balance columns stay apart
 * (and two amounts are never joined into one long number that gets hidden).
 */
export function linesFromTextItems(items: readonly PositionedText[]): string[] {
  const runs = items.filter((item) => item.str.trim() !== "" && Number.isFinite(item.x) && Number.isFinite(item.y));
  const lines: { y: number; height: number; runs: PositionedText[] }[] = [];

  for (const run of [...runs].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const height = run.height > 0 ? run.height : 10;
    const line = lines.find((candidate) => Math.abs(candidate.y - run.y) <= Math.max(candidate.height, height) * SAME_LINE_SHARE);

    if (line) {
      line.runs.push(run);
      line.height = Math.max(line.height, height);
    } else {
      lines.push({ y: run.y, height, runs: [run] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const ordered = [...line.runs].sort((a, b) => a.x - b.x);
      let text = "";
      let end = Number.NEGATIVE_INFINITY;

      for (const run of ordered) {
        const gap = run.x - end;

        if (text !== "") {
          if (gap > line.height * 1.2) {
            text += " | ";
          } else if (gap > line.height * 0.15 && !text.endsWith(" ") && !run.str.startsWith(" ")) {
            text += " ";
          }
        }

        text += run.str;
        end = Math.max(end, run.x + run.width);
      }

      return text.replace(/\s+/g, " ").trim();
    })
    .filter((line) => line !== "");
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The words of the user's own name worth hiding: the whole name and each word
 * of at least three letters, longest first so the whole name wins.
 */
function namePatterns(names: readonly string[]): RegExp[] {
  const words = new Set<string>();

  for (const name of names) {
    const clean = name.replace(/\s+/g, " ").trim();

    if (clean.length >= 3) {
      words.add(clean);
    }

    for (const word of clean.split(" ")) {
      if (word.replace(/[^\p{L}]/gu, "").length >= 3) {
        words.add(word);
      }
    }
  }

  return [...words]
    .sort((a, b) => b.length - a.length)
    .map((word) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeForPattern(word).replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "giu"));
}

/**
 * The text of a statement as it is sent: spaces squeezed, empty lines and lines
 * of nothing but column breaks dropped, long numbers and email addresses
 * hidden, and, when given, the user's own name hidden. Not cut: a text over
 * MAX_STATEMENT_TEXT_LENGTH is refused, so no transaction is silently lost.
 */
export function prepareStatementText(raw: string, names: readonly string[] = []): string {
  let text = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .filter((line) => line.replace(/[|,;\s]/g, "") !== "")
    .join("\n");

  text = redactLongNumbers(text).replace(EMAIL, REDACTED_EMAIL);

  for (const pattern of namePatterns(names)) {
    text = text.replace(pattern, REDACTED_NAME);
  }

  return text;
}

/** True when the text has enough letters or digits to be worth reading. */
export function hasStatementText(text: string): boolean {
  return text.replace(/[^\p{L}\p{N}]/gu, "").length >= MIN_STATEMENT_TEXT_LENGTH;
}

/**
 * Splits a prepared text into parts of at most `maxLength` characters on line
 * breaks, so a transaction row is not cut in half. A single line longer than
 * that (rare: a spreadsheet row with every column) is cut on its own.
 */
export function splitStatementParts(text: string, maxLength = STATEMENT_PART_LENGTH): string[] {
  const parts: string[] = [];
  let current = "";

  for (const line of text.split("\n")) {
    const pieces: string[] = [];

    for (let start = 0; start < line.length; start += maxLength) {
      pieces.push(line.slice(start, start + maxLength));
    }

    for (const piece of pieces) {
      if (current !== "" && current.length + 1 + piece.length > maxLength) {
        parts.push(current);
        current = "";
      }

      current = current === "" ? piece : `${current}\n${piece}`;
    }
  }

  if (current !== "") {
    parts.push(current);
  }

  return parts;
}

/**
 * The day of a transaction from the model's "YYYY-MM-DD", or "MM-DD" when the
 * statement did not show the year: then the latest year that does not put the
 * day after today, because a statement only lists what already happened.
 */
export function resolveStatementDate(raw: string | null, today: string): string | null {
  if (raw === null) {
    return null;
  }

  const value = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isDateKey(value) ? value : null;
  }

  const monthDay = value.match(/^(\d{2})-(\d{2})$/);

  if (!monthDay) {
    return null;
  }

  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${monthDay[1]}-${monthDay[2]}`;
  const candidate = thisYear > today ? `${year - 1}-${monthDay[1]}-${monthDay[2]}` : thisYear;

  return isDateKey(candidate) ? candidate : null;
}

/** One transaction as the model read it, before the checks below. */
export type StatementReadingItem = {
  date: string | null;
  type: EntryType;
  amount: number | null;
  category: string | null;
  note: string | null;
};

/** One transaction the screen offers to save. */
export type StatementEntry = {
  date: string;
  type: EntryType;
  amount: number;
  category: string;
  note: string;
};

export type StatementCheck = {
  entries: StatementEntry[];
  /** Days outside EXP-8: more than a year back, or after today. */
  outOfRange: number;
  /** Rows without a usable amount or day. */
  unusable: number;
};

/**
 * The model's reading made safe to offer: an amount the app accepts, a category
 * of the right type ("lainnya" otherwise), a day an entry may carry (EXP-8),
 * and a short note without long numbers. Ordered by day; rows of the same day
 * keep the statement's order.
 */
export function checkStatementItems(items: readonly StatementReadingItem[], today: string): StatementCheck {
  const kept: (StatementEntry & { index: number })[] = [];
  let outOfRange = 0;
  let unusable = 0;

  items.forEach((item, index) => {
    const { amount } = item;
    const date = resolveStatementDate(item.date, today);

    if (amount === null || !Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT || date === null) {
      unusable += 1;
      return;
    }

    if (!isAllowedEntryDate(date, today)) {
      outOfRange += 1;
      return;
    }

    const category = item.category !== null && isCategoryOf(item.type, item.category) ? item.category : "lainnya";
    const note = redactLongNumbers((item.note ?? "").replace(/\s+/g, " ").trim())
      .slice(0, MAX_STATEMENT_NOTE_LENGTH)
      .trim();

    kept.push({ date, type: item.type, amount, category, note, index });
  });

  const entries = kept
    .sort((a, b) => (a.date === b.date ? a.index - b.index : a.date < b.date ? -1 : 1))
    .map(({ date, type, amount, category, note }) => ({ date, type, amount, category, note }));

  return { entries, outOfRange, unusable };
}

/** An entry already in the cash book, as far as matching needs. */
export type RecordedEntry = { date: string; type: EntryType; amount: number };

/**
 * Which rows look already written down: the same day, direction, and amount as
 * an entry in the cash book. Each existing entry matches one row at most, so
 * two coffees of the same price on one day, with one already logged, leave the
 * second one new.
 */
export function markRecorded(entries: readonly StatementEntry[], recorded: readonly RecordedEntry[]): boolean[] {
  const counts = new Map<string, number>();

  for (const entry of recorded) {
    const key = `${entry.date}|${entry.type}|${entry.amount}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return entries.map((entry) => {
    const key = `${entry.date}|${entry.type}|${entry.amount}`;
    const left = counts.get(key) ?? 0;

    if (left > 0) {
      counts.set(key, left - 1);
      return true;
    }

    return false;
  });
}
