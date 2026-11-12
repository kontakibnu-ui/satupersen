import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SUB-3: when a paid period ends the account goes back to free and keeps every
 * row; only the premium features lock. Run by the scheduled tick, so it is safe
 * to call any number of times: it only touches rows whose end has passed.
 *
 * `premium_until` is null for an account made premium without an end date
 * (by hand, before the payment gateway exists); those are left alone.
 */
export async function expireEndedPremiums(admin: SupabaseClient, now: Date): Promise<number> {
  const { data, error } = await admin
    .from("profiles")
    .update({ plan: "free" })
    .eq("plan", "premium")
    .not("premium_until", "is", null)
    .lt("premium_until", now.toISOString())
    .select("id");

  if (error) {
    console.error("expiring ended premium plans failed");
    return 0;
  }

  return data?.length ?? 0;
}
