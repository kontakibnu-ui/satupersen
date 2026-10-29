import { createClient } from "@supabase/supabase-js";
import { requireSupabaseUrl } from "@/lib/supabase/server";

/**
 * Service role client. Server only, and only for work that cannot be done with
 * the user's own session: writing server-owned rows (daily summaries, reports,
 * WhatsApp links, subscriptions) after the server has checked the session and
 * the limits, deleting an account and all of its rows, the scheduled tick, and
 * creating test users (AGENTS.md §6). Users cannot write those rows themselves
 * (supabase/migrations/20261028230000_restrict_client_writes.sql).
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
