import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  localStackIsRunning,
  readRows,
  seedAiUsage,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * "Dari e-statement" (PRD.md EXP-9) through the real screen: the file is read
 * in the browser (PDF.js from /reader, SheetJS from vendor/sheetjs, under the
 * production CSP when run against `next start`). The account is past its
 * monthly token cap, so the server stops before the model and nothing is paid
 * for; the reading itself is proven by reaching that answer. The fixtures are a
 * fictional bank and fictional people (e2e/fixtures/statements).
 */

const fixtures = path.join(__dirname, "fixtures", "statements");
const fixture = (name: string) => path.join(fixtures, name);

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

async function openSheet(page: Page): Promise<void> {
  await page.goto("/expenses");
  await page.getByRole("button", { name: "Catat uang" }).click();
  await expect(page.getByRole("heading", { name: "Catat uang" })).toBeVisible();
}

test("e-statement: akun gratis diarahkan ke Premium tanpa membuka pemilih file (EXP-9, SUB-1)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "statement-gratis", "free");
  await openSheet(page);

  await page.getByRole("button", { name: "Dari e-statement" }).click();
  await expect(page.getByRole("heading", { name: "Dari e-statement" })).toBeVisible();
  await expect(page.getByText("Baca e-statement ada di Premium.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lihat Premium" })).toHaveAttribute("href", "/settings/plan");

  await page.getByRole("button", { name: "Isi manual" }).click();
  await expect(page.getByRole("heading", { name: "Catat uang" })).toBeVisible();
});

test("e-statement: PDF berpassword dibuka di perangkat, password salah diberi tahu, lewat batas token AI tidak dipanggil (EXP-9, PRD §8)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  test.setTimeout(90_000);
  const user = await newUser(page, "statement-pdf", "premium");
  await seedAiUsage(user, 2_000_000);
  await openSheet(page);

  await page.getByLabel("Dari e-statement").setInputFiles(fixture("statement-locked.pdf"));
  await expect(page.getByRole("heading", { name: "Dari e-statement" })).toBeVisible();
  await expect(page.getByText("PDF ini dikunci password.")).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Password PDF").fill("salah");
  await page.getByRole("button", { name: "Buka" }).click();
  await expect(page.getByText("Password-nya belum cocok.")).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Password PDF").fill("uji12345");
  await page.getByRole("button", { name: "Buka" }).click();
  await expect(page.getByText("Kuota AI bulan ini sudah habis.", { exact: false })).toBeVisible({ timeout: 60_000 });

  expect(await readRows("ai_usage", `select=id&user_id=eq.${user.id}&feature=eq.statement`)).toHaveLength(0);
  expect(await readRows("expenses", `select=id&user_id=eq.${user.id}`)).toHaveLength(0);
});

test("e-statement: CSV dan Excel dibaca di perangkat sampai ke server (EXP-9)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  test.setTimeout(90_000);
  const user = await newUser(page, "statement-csv", "premium");
  await seedAiUsage(user, 2_000_000);
  await openSheet(page);

  await page.getByLabel("Dari e-statement").setInputFiles(fixture("statement.csv"));
  await expect(page.getByText("Kuota AI bulan ini sudah habis.", { exact: false })).toBeVisible({ timeout: 60_000 });

  await page.getByLabel("Pilih file lain").setInputFiles(fixture("statement.xlsx"));
  await expect(page.getByText("Kuota AI bulan ini sudah habis.", { exact: false })).toBeVisible({ timeout: 60_000 });

  expect(await readRows("ai_usage", `select=id&user_id=eq.${user.id}&feature=eq.statement`)).toHaveLength(0);
  expect(await readRows("expenses", `select=id&user_id=eq.${user.id}`)).toHaveLength(0);
});

test("e-statement: PDF tanpa tulisan dan file lain dijawab tanpa memanggil server (EXP-9)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  test.setTimeout(60_000);
  const user = await newUser(page, "statement-scan", "premium");
  await openSheet(page);

  await page.getByLabel("Dari e-statement").setInputFiles(fixture("statement-scan.pdf"));
  await expect(page.getByText("Tulisan di file ini tidak terbaca", { exact: false })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Pilih file lain").setInputFiles({ name: "catatan.txt", mimeType: "text/plain", buffer: Buffer.from("halo") });
  await expect(page.getByText("Pilih file PDF, CSV, atau Excel dari bankmu.")).toBeVisible();

  expect(await readRows("ai_usage", `select=id&user_id=eq.${user.id}`)).toHaveLength(0);
  expect(await readRows("rate_limits", `select=count&user_id=eq.${user.id}`)).toHaveLength(0);
});
