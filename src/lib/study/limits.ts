import { limitReached, PLAN_LIMITS, type Plan } from "@/config/plans";

/**
 * Plan rules of Belajar (PRD.md LEARN-5), read from src/config/plans.ts so a
 * number changes in one place. The server decides with these; screens only
 * show the result.
 */

/** Whether the account may make another material, given how many it has ever made. */
export function canAddMaterial(plan: Plan, materialsEverMade: number): boolean {
  return !limitReached(PLAN_LIMITS[plan].studyMaterials, materialsEverMade);
}

/**
 * AI checks still open today. `accountToday` counts every check the user made
 * today; `materialToday` counts the ones on this material. Free counts the
 * first, premium the second.
 */
export function checksLeftToday(
  plan: Plan,
  used: { accountToday: number; materialToday: number },
): number {
  const { scope, perDay } = PLAN_LIMITS[plan].studyChecks;
  const spent = scope === "account" ? used.accountToday : used.materialToday;

  return Math.max(0, perDay - spent);
}

/** The sentence shown when no check is left today; free and premium hit different limits. */
export function checksUsedUpMessage(plan: Plan): string {
  return plan === "premium"
    ? `Pemeriksaan AI untuk materi ini sudah ${PLAN_LIMITS.premium.studyChecks.perDay}x hari ini. Besok bisa lagi.`
    : "Pemeriksaan AI hari ini sudah terpakai. Paket gratis mendapat 1x sehari, besok bisa lagi.";
}
