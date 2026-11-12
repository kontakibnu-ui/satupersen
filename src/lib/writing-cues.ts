import { daysBetween, type DateKey } from "@/lib/dates";

/**
 * The writing cues above the diary editor (DESIGN.md §6 "Pemantik"). A blank
 * page is the hardest part of writing, so the editor always offers one small
 * question to answer, and "Pertanyaan lain" moves to the next one.
 *
 * The cue is only a hint shown next to the editor: it is never written into the
 * entry, so it never reaches the analysis either.
 */
export const WRITING_CUES = [
  "Apa satu hal yang terjadi hari ini?",
  "Apa yang bikin harimu terasa lebih ringan?",
  "Apa yang paling banyak kamu pikirkan hari ini?",
  "Apa satu hal kecil yang berhasil kamu selesaikan?",
  "Siapa yang kamu temui hari ini, dan gimana rasanya?",
  "Kapan kamu merasa paling fokus hari ini?",
  "Apa yang bikin kamu capek hari ini?",
  "Apa yang kamu syukuri dari hari ini?",
  "Apa yang ingin kamu lakukan beda besok?",
  "Kalau hari ini jadi satu judul, apa judulnya?",
] as const;

/** Any fixed day works as the start; the count of days since it picks the cue. */
const ANCHOR: DateKey = "2026-01-01";

/**
 * The cue for a day, `step` cues further along the list. The same day always
 * starts on the same cue, so the server render and the browser agree, and the
 * next day starts on a different one.
 */
export function cueForDay(date: DateKey, step = 0): string {
  const count = WRITING_CUES.length;
  const index = (((daysBetween(ANCHOR, date) + step) % count) + count) % count;

  return WRITING_CUES[index];
}
