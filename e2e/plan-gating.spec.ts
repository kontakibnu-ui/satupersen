import { expect, test } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  seedAiUsage,
  seedEntry,
  seedSummary,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Plan limits are checked on the server (TASKS.md 6.1, PRD.md §8, SUB-1): the
 * tests call the API directly, the way an edited client would, and claim things
 * the server must not believe. The other limits are proven where they live:
 * habits and budgets in the database tests (rls.test.ts), WhatsApp replies in
 * handlers.test.ts, the 1 year chart in app-pages.spec.ts, and weekly and
 * monthly reports in run.test.ts.
 */

const today = jakartaToday();
const created: TestUser[] = [];
let stackUp = false;

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();
});

test.afterAll(async () => {
  await Promise.all(created.map(deleteTestUser));
});

async function userAtRegenLimit(plan: "free" | "premium", used: number): Promise<TestUser> {
  const user = await createTestUser(`gating-${plan}`, true);
  created.push(user);
  await setPlan(user, plan);
  await seedEntry(user, today, "Hari ini aku menyelesaikan laporan dan jalan sore dua puluh menit.");
  await seedSummary(user, today, {
    summary: "sudah ada",
    score: 70,
    score_reason: "alasan",
    risk_flag: false,
    regen_count: used,
  });

  return user;
}

test("free: analisa ulang di atas batas 1x ditolak 429 walau klien mengaku premium (AI-4, SUB-1)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await userAtRegenLimit("free", 1);
  await signIn(page.context(), user);

  for (const body of [
    { date: today },
    { date: today, plan: "premium", regen_count: 0, limit: 99 },
  ]) {
    const response = await page.request.post("/api/ai/summarize", { data: body });

    expect(response.status()).toBe(429);
    expect(await response.json()).toEqual({
      kind: "error",
      message: "Analisa ulang hari ini sudah terpakai. Ini batas paket gratis.",
    });
  }
});

test("premium: batas analisa ulang 3x juga ditegakkan di server (AI-4)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await userAtRegenLimit("premium", 3);
  await signIn(page.context(), user);

  const response = await page.request.post("/api/ai/summarize", { data: { date: today } });

  expect(response.status()).toBe(429);
  expect((await response.json()).message).toBe("Analisa ulang hari ini sudah terpakai. Besok bisa lagi.");
});

test("tanggal selain hari ini, badan yang salah, dan tanpa sesi semuanya ditolak sebelum AI dipanggil", async ({
  page,
  request,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const noSession = await request.post("/api/ai/summarize", { data: { date: today } });
  expect(noSession.status()).toBe(401);

  const user = await userAtRegenLimit("free", 0);
  await signIn(page.context(), user);

  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  expect((await page.request.post("/api/ai/summarize", { data: { date: yesterday } })).status()).toBe(409);
  expect((await page.request.post("/api/ai/summarize", { data: { date: "kemarin" } })).status()).toBe(400);
  expect((await page.request.post("/api/ai/summarize", { data: {} })).status()).toBe(400);
});

test("ringkasan hanya menjawab dengan field yang dipakai layar: tanpa model, prompt, atau detail internal", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await userAtRegenLimit("free", 1);
  await signIn(page.context(), user);

  const response = await page.request.post("/api/ai/summarize", { data: { date: today } });
  const text = await response.text();

  expect(text).not.toMatch(/deepseek|openrouter|prompt|stack|at \w+ \(|supabase|SELECT |daily_summaries/i);
});

test("batas token lunak: lewat kuota bulan ini, analisa ulang ditolak 429 sebelum AI dipanggil (PRD §8)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  // Regen quota still free (0 of 1 used), but the month's tokens are past the free soft cap.
  const user = await userAtRegenLimit("free", 0);
  await seedAiUsage(user, 150_000);
  await signIn(page.context(), user);

  const response = await page.request.post("/api/ai/summarize", { data: { date: today } });

  expect(response.status()).toBe(429);
  expect((await response.json()).message).toMatch(/^Kuota AI bulan ini sudah habis untuk analisa ulang/);
});

test("Paket: kuota bulan ini terbaca dari ai_usage, empat paket, dan tombol bayar belum aktif", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await userAtRegenLimit("free", 0);
  await seedAiUsage(user, 30_000);
  await signIn(page.context(), user);

  await page.goto("/settings/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Paket" })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Kuota AI bulan ini" })).toHaveAttribute("aria-valuenow", "20");
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /^Bayar / })).toBeDisabled();
});
