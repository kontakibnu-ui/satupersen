/**
 * The arithmetic behind the name: 1% better every day, compounded. It is an
 * illustration of how small habits add up, shown on the landing page with that
 * label, never a promise about a user's results (DESIGN.md §11).
 */

export const MAX_DAYS = 365;

/** (1 + rate) to the power of days; rate 0.01 is "1% better", -0.01 is "1% worse". */
export function compound(days: number, rate: number): number {
  const safeDays = Math.min(MAX_DAYS, Math.max(0, Math.round(days)));

  return (1 + rate) ** safeDays;
}

/**
 * "37,8" or "2,45" or "0,03": Indonesian decimal comma, with fewer decimals as
 * the number grows so the figure stays short.
 */
export function formatMultiple(value: number): string {
  const digits = value >= 10 ? 1 : 2;

  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/**
 * How full the dial is, 0 to 1. Growth is exponential, so the arc follows the
 * logarithm: day 0 is empty and day 365 is full, and the middle of the year
 * fills the middle of the ring instead of a sliver.
 */
export function dialFraction(days: number): number {
  const full = Math.log(compound(MAX_DAYS, 0.01));

  return Math.min(1, Math.max(0, Math.log(compound(days, 0.01)) / full));
}
