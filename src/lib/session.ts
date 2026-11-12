import { isValidTimeZone } from "@/lib/dates";
import { createSupabaseActionClient } from "@/lib/supabase/server";

type ActionClient = Awaited<ReturnType<typeof createSupabaseActionClient>>;

export type ActionContext = {
  /** Runs with the user's session, so row level security applies. */
  supabase: ActionClient;
  userId: string;
  /** The profile's zone, or Asia/Jakarta when the stored value is not one Intl knows. */
  timeZone: string;
  plan: "free" | "premium";
};

/**
 * Who is calling a server action or route handler, read on the server (PRD.md
 * §7: the plan and the user id are never taken from the client). Null means the
 * session ended or the profile cannot be read, and the caller answers with a
 * plain message.
 */
export async function getActionContext(): Promise<ActionContext | null> {
  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("timezone, plan")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return {
    supabase,
    userId,
    timeZone: isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta",
    plan: profile.plan === "premium" ? "premium" : "free",
  };
}
