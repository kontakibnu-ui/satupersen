/**
 * Crisis handling, from PRD.md §7.
 *
 * The keyword filter runs before any AI call on web and WhatsApp input, so a
 * message that clearly points at self harm never waits for a model answer.
 * Softer signals are left to the model's `risk_flag`, because a keyword list
 * cannot judge context.
 *
 * STATUS OF THE TEXTS BELOW: this is the draft written in PRD.md §7 and it is
 * still waiting for the user's approval (TASKS.md 0.7). The phone numbers and
 * opening hours must be verified on healing119.id by a human before launch.
 * Never add a number that a human has not verified (AGENTS.md §3).
 */

export type CrisisLanguage = "id" | "en" | "mixed";

const CRISIS_PHRASES: readonly string[] = [
  // Indonesian
  "bunuh diri",
  "mengakhiri hidup",
  "akhiri hidup",
  "nyakitin diri",
  "menyakiti diri",
  "sakitin diri",
  "pengen mati",
  "ingin mati",
  "mau mati",
  "pengen ngakhirin",
  "gak pengen hidup",
  "nggak pengen hidup",
  "gak mau hidup",
  "nggak mau hidup",
  "udah gak kuat hidup",
  "overdosis",
  // English
  "suicide",
  "suicidal",
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "self harm",
  "self-harm",
  "hurt myself",
  "hurting myself",
  "cut myself",
  "want to die",
  "wanna die",
  "no reason to live",
  "better off dead",
];

/**
 * Lowercases and collapses everything that is not a letter or a digit into a
 * single space, so "gak mau hidup!!" and "gak   mau hidup" both match.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when the text contains a phrase that must stop the AI path. */
export function detectCrisis(text: string): boolean {
  const normalised = ` ${normalise(text)} `;

  return CRISIS_PHRASES.some((phrase) => normalised.includes(` ${normalise(phrase)} `));
}

/** Draft text from PRD.md §7, pending human approval (TASKS.md 0.7). */
export const CRISIS_RESPONSE_ID = `Terima kasih sudah cerita. Yang kamu rasakan terdengar sangat berat, dan kamu tidak harus menghadapinya sendirian.
Kalau kamu sedang berpikir untuk menyakiti diri sendiri, tolong hubungi orang yang kamu percaya sekarang, atau layanan ini: Healing119 Kemenkes (telepon 119 ext. 8, atau healing119.id). Kalau kamu dalam bahaya langsung, hubungi 119 atau datang ke IGD terdekat.
Aku bukan pengganti tenaga profesional, tapi aku di sini kalau kamu mau lanjut cerita.`;

/** Draft text from PRD.md §7, pending human approval (TASKS.md 0.7). */
export const CRISIS_RESPONSE_EN = `Thank you for telling me. What you're feeling sounds really heavy, and you don't have to face it alone.
If you're thinking about hurting yourself, please reach out to someone you trust right now, or to this service: Healing119 by the Indonesian Ministry of Health (call 119 ext. 8, or healing119.id). If you're in immediate danger, call 119 or go to the nearest emergency room.
I'm not a replacement for a professional, but I'm here if you want to keep talking.`;

/**
 * The entry's dominant language decides which fixed text is shown (PRD.md §7).
 * Mixed entries get the Indonesian text, because the product is Indonesian and
 * the audience reads Indonesian.
 */
export function crisisResponseFor(language: CrisisLanguage): string {
  return language === "en" ? CRISIS_RESPONSE_EN : CRISIS_RESPONSE_ID;
}

/** Shown as a link under the text; the human verifies it before launch. */
export const CRISIS_SERVICE = {
  name: "Healing119 (Kemenkes)",
  phone: "119",
  phoneExtension: "8",
  website: "https://healing119.id",
} as const;
