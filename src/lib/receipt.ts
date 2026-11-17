import type { ReceiptReading } from "@/lib/ai/schemas";
import { isAllowedEntryDate, isCategoryOf, MAX_AMOUNT, MAX_NOTE_LENGTH, type EntryType } from "@/lib/expenses";

/**
 * "Isi dari screenshot" on the Uang screen (PRD.md EXP-7). The picture is read
 * on the phone; only its text, cut down by `prepareReceiptText`, reaches the
 * server, and the model only fills the form. Nothing here is stored: the user
 * checks the form and saves it like any other entry.
 *
 * Shared by the browser (so long numbers never leave the phone) and the server
 * (which applies the same cut again, because the browser can be edited).
 */

/** Enough for the longest bank receipt; anything after it is cut off. */
export const MAX_RECEIPT_TEXT_LENGTH = 3000;

/** Fewer than this many letters or digits is not a receipt worth sending to the model. */
export const MIN_RECEIPT_TEXT_LENGTH = 8;

export const REDACTED_NUMBER = "[angka disamarkan]";

/**
 * A run of 10 or more digits, written in one piece or in groups of 3 or more
 * joined by a space or a dash: account numbers, phone numbers, card and
 * reference numbers. An amount never qualifies, because it is written with dots
 * or commas, and one of 10 digits would already be above MAX_AMOUNT. Dates and
 * times do not either: their groups are shorter than 3 digits.
 */
const NUMBER_RUN = /\d{10,}|\d{3,}(?:[ -]\d{3,})+/g;

export function redactLongNumbers(text: string): string {
  return text.replace(NUMBER_RUN, (match) => (match.replace(/\D/g, "").length >= 10 ? REDACTED_NUMBER : match));
}

/**
 * The text of a screenshot as it is sent: long numbers hidden, spaces squeezed,
 * empty lines dropped, and cut to MAX_RECEIPT_TEXT_LENGTH.
 */
export function prepareReceiptText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .filter((line) => line !== "");

  return redactLongNumbers(lines.join("\n")).slice(0, MAX_RECEIPT_TEXT_LENGTH);
}

/** True when the text has enough letters or digits to be worth reading. */
export function hasReadableText(text: string): boolean {
  return text.replace(/[^\p{L}\p{N}]/gu, "").length >= MIN_RECEIPT_TEXT_LENGTH;
}

/** What the form is filled with. Null fields are left for the user. */
export type ReceiptDraft = {
  type: EntryType;
  amount: number;
  category: string | null;
  date: string | null;
  note: string;
};

/**
 * The model's reading made safe for the form: an amount the app accepts, a
 * category that belongs to the type, a day an entry may carry (EXP-8), and a
 * short note without long numbers. Without a usable amount there is nothing to
 * fill, so the answer is null and the screen says the picture could not be read.
 */
export function toReceiptDraft(reading: ReceiptReading, today: string): ReceiptDraft | null {
  if (!reading.found || reading.amount === null) {
    return null;
  }

  const { amount } = reading;

  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    return null;
  }

  const type: EntryType = reading.type ?? "expense";
  const category = reading.category !== null && isCategoryOf(type, reading.category) ? reading.category : null;
  const date = reading.date !== null && isAllowedEntryDate(reading.date, today) ? reading.date : null;
  const note = redactLongNumbers((reading.note ?? "").replace(/\s+/g, " ").trim()).slice(0, MAX_NOTE_LENGTH).trim();

  return { type, amount, category, date, note };
}
