import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

/**
 * Test users for the signed in pages, made through the Supabase Admin API in
 * the test setup (AGENTS.md §4). Nothing here exists in the app itself, so no
 * new way to sign in reaches production.
 *
 * The session cookies are produced by @supabase/ssr's own server client, the
 * same library the app reads them with, so the cookie format is never guessed.
 * Only the local stack is ever touched: the URL must be 127.0.0.1 or localhost.
 * localhost is accepted because another program on a machine can hold
 * 127.0.0.1:54321 while Docker's Supabase still answers on ::1 (seen 2026-11-14).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = "RahasiaUji123!";

export const BASE_URL = "http://127.0.0.1:3000";

const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url);

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

/** The stored text of one day, read with the service role; null when that day has no row. */
export async function readEntryContent(user: TestUser, date: string): Promise<string | null> {
  const response = await fetch(`${url}/rest/v1/entries?select=content&user_id=eq.${user.id}&date=eq.${date}`, {
    headers: serviceHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Reading the entry failed with ${response.status}`);
  }

  const rows = (await response.json()) as { content: string }[];
  return rows[0]?.content ?? null;
}

/** A finished summary row, written the way the server writes it (service role). */
export async function seedSummary(
  user: TestUser,
  date: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await rest("daily_summaries", "POST", { user_id: user.id, date, status: "done", ...fields });
}

/** A habit made the way the server would, so a test can start from a known list. */
export async function seedHabit(
  user: TestUser,
  name: string,
  identity?: string,
): Promise<string> {
  const response = await fetch(`${url}/rest/v1/habits`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ user_id: user.id, name, identity: identity ?? null }),
  });

  if (!response.ok) {
    throw new Error(`Seeding a habit failed with ${response.status}`);
  }

  const rows = (await response.json()) as { id: string }[];
  return rows[0].id;
}

export async function seedHabitLog(user: TestUser, habitId: string, date: string): Promise<void> {
  await rest("habit_logs", "POST", { habit_id: habitId, user_id: user.id, date });
}

/** Plan changes belong to the payment webhook in production; tests set it directly. */
export async function setPlan(user: TestUser, plan: "free" | "premium"): Promise<void> {
  await rest(`profiles?id=eq.${user.id}`, "PATCH", { plan });
}

/** Onboarding stores the browser's zone; tests set one directly to stage a mismatch. */
export async function setTimezone(user: TestUser, timezone: string): Promise<void> {
  await rest(`profiles?id=eq.${user.id}`, "PATCH", { timezone });
}

/** A day with a finished score, for the Progres screen. */
export async function seedScoredDay(
  user: TestUser,
  date: string,
  score: number,
  dimensions: { name: string; value: number; weight: number }[] = [],
): Promise<void> {
  await rest("daily_summaries", "POST", {
    user_id: user.id,
    date,
    status: "done",
    score,
    score_dimensions: dimensions,
    summary: "ringkasan uji",
    strengths: [],
    improvements: [],
    tomorrow_tip: "tip uji",
    ai_dimension_score: Math.round(score / 10),
    score_reason: "alasan uji",
    risk_flag: false,
    regen_count: 0,
  });
}

export async function seedExpense(
  user: TestUser,
  date: string,
  amount: number,
  category: string,
  note?: string,
): Promise<void> {
  await rest("expenses", "POST", { user_id: user.id, date, amount, category, note: note ?? null });
}

/** An income entry: the same table as an expense, with `type` set to income (EXP-5). */
export async function seedIncome(
  user: TestUser,
  date: string,
  amount: number,
  category: string,
  note?: string,
): Promise<void> {
  await rest("expenses", "POST", {
    user_id: user.id,
    date,
    type: "income",
    amount,
    category,
    note: note ?? null,
  });
}

/** A budget row, written the way the server writes it (service role). */
export async function seedBudget(user: TestUser, month: string, amount: number): Promise<void> {
  await rest("budgets", "POST", { user_id: user.id, month, amount });
}

/** A report row, written the way the tick writes it (service role). */
export async function seedReport(
  user: TestUser,
  type: "weekly" | "monthly",
  periodStart: string,
  periodEnd: string,
  content: Record<string, unknown>,
): Promise<void> {
  await rest("reports", "POST", {
    user_id: user.id,
    type,
    period_start: periodStart,
    period_end: periodEnd,
    content,
  });
}

/** Mood and energy for a day, without any diary text. */
export async function seedMood(
  user: TestUser,
  date: string,
  mood: number | null,
  energy: number | null,
): Promise<void> {
  await rest("entries", "POST", { user_id: user.id, date, mood, energy });
}

/** Whole days before `date`, as a "yyyy-MM-dd" key. */
export function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/** Many scored days in one request, newest first by offset: offset 0 is `endDate`. */
export async function seedScoreHistory(
  user: TestUser,
  endDate: string,
  scoreForOffset: (offset: number) => number,
  days: number,
  dimensions: { name: string; value: number; weight: number }[] = [],
): Promise<void> {
  const rows = Array.from({ length: days }, (_, offset) => ({
    user_id: user.id,
    date: daysBefore(endDate, offset),
    status: "done",
    score: scoreForOffset(offset),
    score_dimensions: dimensions,
    summary: "ringkasan uji",
    strengths: [],
    improvements: [],
    tomorrow_tip: "tip uji",
    ai_dimension_score: 5,
    score_reason: "alasan uji",
    risk_flag: false,
    regen_count: 0,
  }));

  await rest("daily_summaries", "POST", rows);
}

/** A verified WhatsApp link, written the way the webhook writes it (service role). */
export async function seedWhatsAppLink(
  user: TestUser,
  phone: string,
  options: { optedIn?: boolean } = {},
): Promise<void> {
  await rest("whatsapp_links", "POST", {
    user_id: user.id,
    phone,
    verified_at: new Date().toISOString(),
    opted_in: options.optedIn ?? true,
  });
}

/** Rows of a table filtered the PostgREST way, read with the service role. */
export async function readRows<T>(table: string, filter: string): Promise<T[]> {
  const response = await fetch(`${url}/rest/v1/${table}?${filter}`, { headers: serviceHeaders() });

  if (!response.ok) {
    throw new Error(`Reading ${table} failed with ${response.status}`);
  }

  return (await response.json()) as T[];
}

/** Removes a user made through the real sign-in flow, found by the email it used. */
export async function deleteUserByEmail(email: string): Promise<void> {
  const response = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers: serviceHeaders() });

  if (!response.ok) {
    throw new Error(`Listing users failed with ${response.status}`);
  }

  const { users } = (await response.json()) as { users: { id: string; email?: string }[] };
  const match = users.find((candidate) => candidate.email === email);

  if (match) {
    await deleteTestUser({ id: match.id, email });
  }
}

/** One metered AI call, written the way src/lib/ai/usage.ts writes it (service role). */
/** A stored "Analisa uang" (EXP-10), as the server writes it after the model answered. */
export async function seedMoneyAnalysis(
  user: TestUser,
  month: string,
  generatedOn: string,
  paragraphs: string[] = ["Makan paling besar bulan ini, dan kebanyakan di akhir pekan."],
  nextMonth = "Coba jatah makan di luar per minggu.",
): Promise<void> {
  await rest("money_analyses", "POST", {
    user_id: user.id,
    month: `${month}-01`,
    paragraphs,
    next_month: nextMonth,
    through_date: generatedOn,
    generated_on: generatedOn,
    model: "uji",
  });
}

export async function seedAiUsage(user: TestUser, promptTokens: number, completionTokens = 0): Promise<void> {
  await rest("ai_usage", "POST", {
    user_id: user.id,
    feature: "daily",
    model: "uji",
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  });
}

async function restReturning<T>(path: string, payload: unknown): Promise<T[]> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Seeding POST ${path} failed with ${response.status}`);
  }

  return (await response.json()) as T[];
}

/**
 * A Belajar material (LEARN-1). The insert trigger always starts it as a draft
 * and counts it against the free limit, exactly as for a real user; an active
 * material is then set the way the server sets it after the first check.
 */
export async function seedStudyMaterial(
  user: TestUser,
  fields: { title: string; source: string; active?: boolean; explanation?: string; feedback?: Record<string, unknown> },
): Promise<string> {
  const [row] = await restReturning<{ id: string }>("study_materials", {
    user_id: user.id,
    title: fields.title,
    source: fields.source,
  });

  if (fields.active || fields.explanation !== undefined || fields.feedback !== undefined) {
    await rest(`study_materials?id=eq.${row.id}`, "PATCH", {
      ...(fields.active ? { status: "active", activated_at: new Date().toISOString() } : {}),
      ...(fields.explanation !== undefined ? { explanation: fields.explanation } : {}),
      ...(fields.feedback !== undefined ? { feedback: fields.feedback } : {}),
    });
  }

  return row.id;
}

/** A review question, written the way the server writes it after a check (LEARN-2, LEARN-3). */
export async function seedStudyQuestion(
  user: TestUser,
  materialId: string,
  fields: {
    position: number;
    prompt: string;
    answer: string;
    kind?: "recall" | "elaboration";
    step?: number;
    dueDate: string | null;
  },
): Promise<string> {
  const [row] = await restReturning<{ id: string }>("study_questions", {
    material_id: materialId,
    user_id: user.id,
    position: fields.position,
    prompt: fields.prompt,
    answer: fields.answer,
    kind: fields.kind ?? "recall",
    step: fields.step ?? 0,
    due_date: fields.dueDate,
  });

  return row.id;
}

/** A stored review of one question on one day (LEARN-4). */
export async function seedStudyReview(
  user: TestUser,
  materialId: string,
  questionId: string,
  fields: { reviewedOn: string; answer: string; rating: "forgot" | "unsure" | "remembered"; feedback?: string },
): Promise<void> {
  await rest("study_reviews", "POST", {
    user_id: user.id,
    material_id: materialId,
    question_id: questionId,
    reviewed_on: fields.reviewedOn,
    answer: fields.answer,
    rating: fields.rating,
    feedback: fields.feedback ?? null,
  });
}

/** An AI check already used on `date`, so a test can stand at the quota without calling the model (LEARN-5). */
export async function seedStudyCheck(
  user: TestUser,
  materialId: string,
  date: string,
  kind: "explanation" | "review" = "review",
): Promise<void> {
  await rest("study_checks", "POST", { user_id: user.id, material_id: materialId, date, kind });
}
