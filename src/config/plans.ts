/**
 * Prices and AI token caps of the plans (PRD.md §8). One file, so a price or a
 * cap changes in one place and every screen and server check follows.
 *
 * How the numbers were reached (2026-11-01, written down in PRD.md §8):
 * - Model cost from OpenRouter's public price list for the DeepSeek model in
 *   AI_MODEL_*, at the price of a mid-range provider that accepts
 *   data_collection "deny": about USD 0.30 per million input tokens and USD 1.20
 *   per million output tokens, roughly USD 0.44 per million tokens at the 85/15
 *   input/output mix of this app. Exchange rate assumed Rp 16.500 per USD.
 * - A normal premium month is about 360 thousand tokens (about Rp 2.500).
 * - The premium soft cap keeps the worst month under half of the cheapest
 *   effective monthly price (the yearly package).
 */

export type Plan = "free" | "premium";

/**
 * What each plan may do (PRD.md §8). Every screen and every server check reads
 * these numbers, so a limit changes here and nowhere else. `null` means no limit.
 *
 * The database repeats the counted limits in its triggers (habits 3 in
 * 20261029000000_habit_rules.sql; wallets 3, goals 1, recurring rules 3 in
 * 20261112000000_money.sql), so a request that skips the server actions still
 * cannot pass them. plans.test.ts checks that both sides say the same number.
 *
 * Free money limits decided by the user on 2026-11-12: 3 active wallets, 1
 * active savings goal, 3 recurring rules; custom categories and category
 * budgets are premium (PRD §8 already listed them as premium).
 *
 * Belajar limits decided by the user on 2026-11-15: free makes 1 material per
 * account and gets 1 AI check a day; premium makes as many as it likes and gets
 * 10 AI checks per material a day. The material cap is repeated in
 * 20261115000000_study_and_rate_limits.sql.
 *
 * Ruang baca limits decided by the user on 2026-11-17, the same pattern as
 * Belajar: free uploads 1 book per account (deleting frees nothing); premium
 * keeps up to 2 GB of books. Both are repeated in 20261117000000_reading_room.sql.
 */
export type PlanLimits = {
  activeHabits: number | null;
  activeWallets: number | null;
  activeGoals: number | null;
  recurringRules: number | null;
  customCategories: boolean;
  categoryBudgets: boolean;
  monthlyBudget: boolean;
  /** Analyses after the first one of a local day (AI-4). */
  reanalysesPerDay: number;
  whatsappRepliesPerDay: number;
  chartDays: number;
  askPerDay: number;
  /** How far back Tanya diary-mu searches, in days; null searches the whole history. */
  askHistoryDays: number | null;
  /**
   * Belajar materials the account may ever make (LEARN-5). Counted from the
   * materials made, not the ones that still exist, so deleting one frees nothing.
   */
  studyMaterials: number | null;
  /**
   * AI checks in Belajar per local day (LEARN-5). One check is one explanation,
   * or one review session whose answers are checked together. `account` counts
   * every check of the user; `material` counts per material.
   */
  studyChecks: { scope: "account" | "material"; perDay: number };
  /**
   * Books the account may ever finish uploading to Ruang baca (READ-2). Counted
   * from the uploads finished, not the books that still exist.
   */
  books: number | null;
  /** Bytes all of the account's books may take together; null means no total cap. */
  bookStorageBytes: number | null;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    activeHabits: 3,
    activeWallets: 3,
    activeGoals: 1,
    recurringRules: 3,
    customCategories: false,
    categoryBudgets: false,
    monthlyBudget: false,
    reanalysesPerDay: 1,
    whatsappRepliesPerDay: 1,
    chartDays: 30,
    askPerDay: 3,
    askHistoryDays: 30,
    studyMaterials: 1,
    studyChecks: { scope: "account", perDay: 1 },
    books: 1,
    bookStorageBytes: null,
  },
  premium: {
    activeHabits: null,
    activeWallets: null,
    activeGoals: null,
    recurringRules: null,
    customCategories: true,
    categoryBudgets: true,
    monthlyBudget: true,
    reanalysesPerDay: 3,
    whatsappRepliesPerDay: 30,
    chartDays: 365,
    askPerDay: 20,
    askHistoryDays: null,
    studyMaterials: null,
    studyChecks: { scope: "material", perDay: 10 },
    books: null,
    bookStorageBytes: 2 * 1024 * 1024 * 1024,
  },
};

/** True when `current` items already fill a counted limit; a null limit is never reached. */
export function limitReached(limit: number | null, current: number): boolean {
  return limit !== null && current >= limit;
}

/**
 * Tokens per local calendar month. Past the cap the account is slowed, not cut
 * off (decided by the user, 2026-11-01): the first analysis of each day keeps
 * working, while a second analysis of the same day and AI chat on WhatsApp stop
 * until the month turns.
 */
export const MONTHLY_TOKEN_SOFT_CAP: Record<Plan, number> = {
  free: 150_000,
  premium: 1_200_000,
};

export type PremiumPackage = {
  id: "1m" | "3m" | "6m" | "12m";
  months: number;
  /** Rupiah, paid once for the whole period. */
  price: number;
  label: string;
  /** Why someone would pick this one; shown under the price. */
  note: string;
};

/**
 * Longer is cheaper per month, with a clear step at 3 months (worth it for a
 * first try) and the biggest one at 12 months (the best deal on purpose).
 */
export const PREMIUM_PACKAGES: readonly PremiumPackage[] = [
  { id: "1m", months: 1, price: 29_000, label: "1 bulan", note: "Bebas berhenti kapan saja." },
  { id: "3m", months: 3, price: 74_000, label: "3 bulan", note: "Pas untuk mencoba, sudah lebih hemat." },
  { id: "6m", months: 6, price: 129_000, label: "6 bulan", note: "Cukup lama untuk melihat kebiasaan berubah." },
  { id: "12m", months: 12, price: 199_000, label: "12 bulan", note: "Paling hemat, kurang dari Rp 17 ribu sebulan." },
];

const BASE_MONTHLY_PRICE = PREMIUM_PACKAGES[0].price;

export type PackageValue = {
  /** Rounded down to the rupiah, so the per-month figure is never overstated. */
  perMonth: number;
  /** Whole percent saved against paying the 1 month price every month. */
  savingsPercent: number;
  /** Rupiah saved against paying the 1 month price every month. */
  savedRupiah: number;
};

export function packageValue(pkg: Pick<PremiumPackage, "months" | "price">): PackageValue {
  const fullPrice = BASE_MONTHLY_PRICE * pkg.months;
  const saved = Math.max(0, fullPrice - pkg.price);

  return {
    perMonth: Math.floor(pkg.price / pkg.months),
    savingsPercent: Math.round((saved / fullPrice) * 100),
    savedRupiah: saved,
  };
}

export type TokenStanding = {
  used: number;
  cap: number;
  /** 0 to 100; can reach 100 before `overCap` because of rounding. */
  percent: number;
  overCap: boolean;
};

export function tokenStanding(plan: Plan, used: number): TokenStanding {
  const cap = MONTHLY_TOKEN_SOFT_CAP[plan];
  const safeUsed = Math.max(0, Math.floor(used));

  return {
    used: safeUsed,
    cap,
    percent: Math.min(100, Math.round((safeUsed / cap) * 100)),
    overCap: safeUsed >= cap,
  };
}
