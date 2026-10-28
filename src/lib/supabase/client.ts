import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client for Client Components: only the two NEXT_PUBLIC_* values are
 * used, and the anon key is safe to ship because row level security decides
 * what the user can actually read (PRD.md §7 "Klien tidak dipercaya").
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }

  return createBrowserClient(url, anonKey);
}
