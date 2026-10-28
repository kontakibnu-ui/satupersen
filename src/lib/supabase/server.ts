import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server side Supabase clients (AGENTS.md §5). Nothing here may be imported
 * from a Client Component: the anon key is public, but these helpers read the
 * request cookies, which only exist on the server.
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is empty, so Supabase cannot be reached`);
  }

  return value;
}

export function requireSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function requireSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * For Server Components, Route Handlers, and Server Actions.
 *
 * `setAll` is deliberately left out: pages and components cannot write cookies
 * in Next.js, and @supabase/ssr documents that the middleware must handle token
 * refreshes in that case. src/middleware.ts does exactly that, which also keeps
 * us clear of an empty catch block (AGENTS.md §3).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
    },
  });
}

/**
 * For Server Actions and Route Handlers, where writing cookies is allowed.
 * Signing in, signing out, and exchanging a login code all change the session,
 * so those flows must use this client; a Server Component cannot write cookies
 * and would silently lose the new session.
 */
export async function createSupabaseActionClient() {
  const cookieStore = await cookies();

  return createServerClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

/** The signed in user, or null. Used by pages that need to know who is asking. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}
