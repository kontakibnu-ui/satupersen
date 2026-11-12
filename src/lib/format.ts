/**
 * "8,3" for 8.3: percentages use the Indonesian decimal comma, like the rupiah
 * and dates elsewhere (DESIGN.md §4). One decimal at most, because the scoring
 * code already rounds a percentage to one.
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
}

/** "Rp 25.000": rupiah with the Indonesian thousands dot, no decimals (DESIGN.md §4). */
export function formatRupiah(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount)}`;
}
