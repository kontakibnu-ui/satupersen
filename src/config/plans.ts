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
