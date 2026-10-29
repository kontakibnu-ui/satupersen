import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

/**
 * Test users for the signed in pages, made through the Supabase Admin API in
 * the test setup (AGENTS.md §4). Nothing here exists in the app itself, so no
 * new way to sign in reaches production.
 *
 * The session cookies are produced by @supabase/ssr's own server client, the
 * same library the app reads them with, so the cookie format is never guessed.
 * Only the local stack is ever touched: the URL must be 127.0.0.1.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = "RahasiaUji123!";

export const BASE_URL = "http://127.0.0.1:3000";

const isLocal = /^http:\/\/127\.0\.0\.1:\d+$/.test(url);

export async function localStackIsRunning(): Promise<boolean> {
  if (!isLocal || !anonKey || !serviceKey) {
    return false;
  }

  try {
    const response = await fetch(`${url}/auth/v1/health`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    // Unreachable means the stack is off; the tests that need it skip themselves.
    return false;
  }
}

const serviceHeaders = () => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
});

async function rest(path: string, method: string, payload?: unknown): Promise<void> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: serviceHeaders(),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Seeding ${method} ${path} failed with ${response.status}`);
  }
}

export type TestUser = { id: string; email: string };

/** A confirmed user; `consented` also records the onboarding consent (AUTH-4). */
export async function createTestUser(label: string, consented: boolean): Promise<TestUser> {
  const email = `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });

  if (!response.ok) {
    throw new Error(`Creating the test user failed with ${response.status}`);
  }

  const { id } = (await response.json()) as { id: string };

  if (consented) {
    await rest(`profiles?id=eq.${id}`, "PATCH", { consented_at: new Date().toISOString() });
  }

  return { id, email };
}

export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (!user) {
    return;
  }

  await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: serviceHeaders() });
}

/** Signs the user in through @supabase/ssr and hands its cookies to the browser. */
export async function signIn(context: BrowserContext, user: TestUser): Promise<void> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => jar.set(name, value));
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: PASSWORD });

  if (error) {
    throw new Error(`Signing the test user in failed: ${error.message}`);
  }

  if (jar.size === 0) {
    throw new Error("@supabase/ssr produced no session cookie");
  }

  await context.addCookies(
    Array.from(jar, ([name, value]) => ({ name, value, url: BASE_URL, sameSite: "Lax" as const })),
  );
}

/** Today in Asia/Jakarta, the default profile zone, as a "yyyy-MM-dd" key. */
export function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function seedEntry(user: TestUser, date: string, content: string): Promise<void> {
  await rest("entries", "POST", { user_id: user.id, date, content });
}

/** A finished summary row, written the way the server writes it (service role). */
export async function seedSummary(
  user: TestUser,
  date: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await rest("daily_summaries", "POST", { user_id: user.id, date, status: "done", ...fields });
}
