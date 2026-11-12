import { expect, test, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  readRows,
  seedBudget,
  seedEntry,
  seedExpense,
  seedHabit,
  seedHabitLog,
  seedReport,
  seedSummary,
  seedWhatsAppLink,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Export and delete (TASKS.md 6.3, PRD.md §7): every plan, no condition. The
 * tests use real rows in every table the user owns and check both what leaves in
 * the file and what is left behind after deleting.
 */

const today = jakartaToday();
let stackUp = false;
const created: TestUser[] = [];

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();
});

test.afterAll(async () => {
  await Promise.all(created.map(deleteTestUser));
});

async function fullUser(page: Page, label: string): Promise<TestUser> {
  const user = await createTestUser(label, true);
  created.push(user);

  await seedEntry(user, today, `Catatan rahasia ${label}`);
  const habit = await seedHabit(user, `Kebiasaan ${label}`, "Aku orang yang konsisten");
  await seedHabitLog(user, habit, today);
  await seedExpense(user, today, 25000, "makan", `catatan ${label}`);
  await setPlan(user, "premium");
  await seedBudget(user, `${today.slice(0, 7)}-01`, 1000000);
  await seedSummary(user, today, { summary: `Ringkasan ${label}`, score: 70, score_reason: "alasan" });
  await seedReport(user, "weekly", "2026-10-26", "2026-11-01", { status: "done", trend: `Tren ${label}` });
  await seedWhatsAppLink(user, `628${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`);

  await signIn(page.context(), user);
  return user;
}

const OWNED_TABLES: [string, string][] = [
  ["profiles", "id"],
  ["entries", "user_id"],
  ["habits", "user_id"],
  ["habit_logs", "user_id"],
  ["expenses", "user_id"],
  ["budgets", "user_id"],
  ["daily_summaries", "user_id"],
  ["reports", "user_id"],
  ["whatsapp_links", "user_id"],
  ["ai_usage", "user_id"],
];

test("export: semua data milik sendiri dalam satu berkas JSON, tanpa data orang lain (PRD §7)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const mine = await fullUser(page, "pemilik");
  const other = await createTestUser("orang-lain", true);
  created.push(other);
  await seedEntry(other, today, "Catatan rahasia orang lain");

  const response = await page.request.get("/api/account/export");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="satupersen-data-\d{4}-\d{2}-\d{2}\.json"/);
  expect(response.headers()["cache-control"]).toBe("no-store");

  const raw = await response.text();
  const data = JSON.parse(raw);

  expect(data.entries).toEqual([expect.objectContaining({ date: today, content: "Catatan rahasia pemilik" })]);
  expect(data.habits).toEqual([expect.objectContaining({ name: "Kebiasaan pemilik", identity: "Aku orang yang konsisten" })]);
  expect(data.habit_logs).toEqual([expect.objectContaining({ date: today })]);
  expect(data.expenses).toEqual([expect.objectContaining({ amount: 25000, category: "makan" })]);
  expect(data.budgets).toEqual([expect.objectContaining({ amount: 1000000 })]);
  expect(data.daily_summaries).toEqual([expect.objectContaining({ summary: "Ringkasan pemilik", score: 70 })]);
  expect(data.reports).toEqual([expect.objectContaining({ type: "weekly" })]);
  expect(data.whatsapp).toEqual(expect.objectContaining({ opted_in: true }));
  expect(data.profile).toEqual(expect.objectContaining({ plan: "premium" }));

  // Another user's words, and the ids that point into the database, are not in the file.
  expect(raw).not.toContain("orang lain");
  expect(raw).not.toContain(mine.id);
  expect(raw).not.toContain("provider_ref");
});

test("export tanpa sesi ditolak 401 dan tidak mengembalikan data", async ({ request }) => {
  const response = await request.get("/api/account/export");

  expect(response.status()).toBe(401);
  expect(await response.text()).not.toContain("entries");
});

test("hapus akun: kata konfirmasi wajib, lalu seluruh data hilang dan tidak bisa masuk lagi (PRD §7)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await fullUser(page, "hapus");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/settings");

  await page.getByRole("button", { name: "Hapus akun" }).click();

  // A wrong or empty word leaves everything as it was.
  await page.getByLabel("Ketik HAPUS untuk memastikan").fill("hapus saja");
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  await expect(page.getByText("Ketik HAPUS untuk memastikan.")).toBeVisible();
  expect(await readRows("profiles", `id=eq.${user.id}`)).toHaveLength(1);

  await page.getByLabel("Ketik HAPUS untuk memastikan").fill("hapus");
  await page.getByRole("button", { name: "Hapus akun saya" }).click();

  // The session is closed and the user is sent away from the signed in pages.
  await expect(page).not.toHaveURL(/\/settings/, { timeout: 20_000 });

  for (const [table, column] of OWNED_TABLES) {
    expect(await readRows(table, `${column}=eq.${user.id}`), `${table} harus kosong`).toEqual([]);
  }

  const reached = await page.goto("/settings");
  expect(reached?.url()).toMatch(/\/login/);

  // Signing in again with the old credentials is no longer possible.
  await expect(signIn(page.context(), user)).rejects.toThrow(/Signing the test user in failed/);
});

test("hapus akun tidak menyentuh akun lain", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const bystander = await createTestUser("saksi", true);
  created.push(bystander);
  await seedEntry(bystander, today, "Catatan saksi yang harus tetap ada");

  await fullUser(page, "korban");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Hapus akun" }).click();
  await page.getByLabel("Ketik HAPUS untuk memastikan").fill("HAPUS");
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  await expect(page).not.toHaveURL(/\/settings/, { timeout: 20_000 });

  expect(await readRows("entries", `user_id=eq.${bystander.id}&select=content`)).toEqual([
    { content: "Catatan saksi yang harus tetap ada" },
  ]);
});
