import { createClient } from "@supabase/supabase-js";
import { requireSupabaseUrl } from "@/lib/supabase/server";

/**
 * Service role client. Server only, and only for work that cannot be done with
 * the user's own session: creating test users, deleting an account and all of
 * its rows, and the scheduled tick (AGENTS.md §6).
 *
 * It bypasses row level security, so it must never be imported from a Client
 * Component and its key must never reach the browser.
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is empty, so admin operations are unavailable");
  }

  return createClient(requireSupabaseUrl(), serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
