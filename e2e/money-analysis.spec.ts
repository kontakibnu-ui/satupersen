import { expect, test, type Page } from "@playwright/test";
import {
  createTestUser,
  daysBefore,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  readRows,
  seedAiUsage,
  seedExpense,
  seedMoneyAnalysis,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Analisa uang (PRD.md EXP-10, DESIGN.md §16.2) through the real screens. The
 * charts are counted on the server for every plan; the AI reading is premium,
 * stored per month, and refreshed at most once a day. No test here reaches the
 * model: the premium account that asks is past its monthly token cap.
 */

const today = jakartaToday();
const month = today.slice(0, 7);
const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" }).format(
  new Date(`${month}-01T00:00:00Z`),
);
let stackUp = false;
const created: TestUser[] = [];

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();
});

test.afterAll(async () => {
  await Promise.all(created.map(deleteTestUser));
});

async function newUser(page: Page, label: string, plan: "free" | "premium"): Promise<TestUser> {
  const user = await createTestUser(label, true);
  created.push(user);
  await setPlan(user, plan);
  await signIn(page.context(), user);
  await page.setViewportSize({ width: 360, height: 740 });
  return user;
}

/** Two days of the month with money out, so the pace chart and the categories have content. */
async function seedMonth(user: TestUser): Promise<void> {
  await seedExpense(user, today, 75_000, "makan", "makan siang");
  await seedExpense(user, today === `${month}-01` ? today : daysBefore(today, 1), 25_000, "transport", "ojek");
}

test("analisa uang: akun gratis membuka grafik dari Uang, analisa AI diarahkan ke Premium (EXP-10, SUB-1)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "analisa-gratis", "free");
  await seedMonth(user);
  await page.goto("/expenses");

  const row = page.getByRole("link", { name: new RegExp(`Analisa ${monthName}`) });
  await expect(row).toContainText("Makan paling besar, 75%");
  await row.click();

  await expect(page.getByRole("heading", { name: "Analisa uang" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Laju pengeluaran" })).toBeVisible();
  await expect(page.getByText("Rp 100.000", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ke mana uangmu pergi" })).toBeVisible();
  await expect(page.getByText("75%")).toBeVisible();
  await expect(page.getByText("Analisa AI ada di Premium.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lihat Premium" })).toHaveAttribute("href", "/settings/plan");
  await expect(page.getByRole("button", { name: "Analisa bulan ini" })).toHaveCount(0);

  await page.getByRole("main").getByRole("link", { name: "Uang" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
});

test("analisa uang: premium lewat batas token tidak memanggil AI dan tidak menyimpan apa pun (EXP-10, PRD §8)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "analisa-kuota", "premium");
  await seedMonth(user);
  await seedAiUsage(user, 2_000_000);
  await page.goto("/expenses/analysis");

  await page.getByRole("button", { name: "Analisa bulan ini" }).click();
  await expect(page.getByText("Kuota AI bulan ini sudah habis.", { exact: false })).toBeVisible({ timeout: 30_000 });

  expect(await readRows("money_analyses", `select=id&user_id=eq.${user.id}`)).toHaveLength(0);
  expect(await readRows("ai_usage", `select=id&user_id=eq.${user.id}&feature=eq.money`)).toHaveLength(0);
});

test("analisa uang: yang tersimpan tampil tanpa memanggil AI, dan hanya bisa diperbarui sekali sehari (EXP-10)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "analisa-tersimpan", "premium");
  await seedMonth(user);
  await seedMoneyAnalysis(user, month, today, ["Makan paling besar bulan ini."], "Coba bawa bekal dua kali seminggu.");
  await page.goto("/expenses/analysis");

  await expect(page.getByText("Makan paling besar bulan ini.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Untuk bulan depan" })).toBeVisible();
  await expect(page.getByText("Coba bawa bekal dua kali seminggu.")).toBeVisible();
  await expect(page.getByText("Dibaca AI dari catatanmu", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bisa diperbarui lagi besok" })).toBeDisabled();
  expect(await readRows("ai_usage", `select=id&user_id=eq.${user.id}`)).toHaveLength(0);
});

test("analisa uang: setelah kembali gratis, analisa lama tetap terbaca tanpa tombol perbarui (EXP-10, SUB-3)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "analisa-turun", "free");
  await seedMonth(user);
  await seedMoneyAnalysis(user, month, daysBefore(today, 3), ["Transport turun dari bulan lalu."]);
  await page.goto("/expenses/analysis");

  await expect(page.getByText("Transport turun dari bulan lalu.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Perbarui analisa|Bisa diperbarui/ })).toHaveCount(0);
  await expect(page.getByText("Analisa AI ada di Premium.", { exact: false })).toHaveCount(0);
});

test("analisa uang: bulan tanpa pengeluaran tidak punya baris di Uang dan layarnya kosong dengan jalan kembali (EXP-10)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "analisa-kosong", "premium");
  await page.goto("/expenses");
  await expect(page.getByRole("link", { name: new RegExp(`Analisa ${monthName}`) })).toHaveCount(0);

  await page.goto("/expenses/analysis");
  await expect(page.getByText("Belum ada pengeluaran di", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analisa bulan ini" })).toHaveCount(0);
  await page.getByRole("link", { name: "Kembali ke Uang" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
});
