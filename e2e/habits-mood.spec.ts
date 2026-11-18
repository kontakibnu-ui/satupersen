import { expect, test, type Page } from "@playwright/test";
import {
  createTestUser,
  daysBefore,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  seedHabit,
  seedHabitLog,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Habits and mood (HABIT-1 to HABIT-3, MOOD-1) through the real screens and the
 * real server actions. Each test makes its own user, so tests can run side by
 * side and leave nothing behind.
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

/** Clicks and waits for the server action it triggers, so a reload cannot cut the save short. */
async function tapAndSave(page: Page, target: ReturnType<Page["locator"]>): Promise<void> {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    target.click(),
  ]);
}

async function newUser(page: Page, label: string): Promise<TestUser> {
  const user = await createTestUser(label, true);
  created.push(user);
  await signIn(page.context(), user);
  await page.setViewportSize({ width: 360, height: 740 });
  return user;
}

test("mood dan energi: satu ketukan tersimpan, bisa diubah, dan bertahan setelah reload (MOOD-1)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "mood");
  await page.goto("/today");

  const mood = page.getByRole("radiogroup", { name: "Mood" });
  await tapAndSave(page, mood.getByText("Baik", { exact: true }));
  await expect(page.getByRole("radio", { name: "Mood 4, Baik" })).toBeChecked();
  // The chosen word also shows at the end of the question line.
  await expect(mood.locator("xpath=preceding-sibling::div")).toContainText("Baik");

  await tapAndSave(page, page.getByRole("radiogroup", { name: "Energi" }).getByText("Lelah", { exact: true }));
  await tapAndSave(page, mood.getByText("Berat", { exact: true }));
  await expect(page.getByRole("radio", { name: "Mood 1, Berat" })).toBeChecked();

  // The toggle saved to the database, so a fresh load shows the same choices.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("radio", { name: "Mood 1, Berat" })).toBeChecked({ timeout: 2000 });
    await expect(page.getByRole("radio", { name: "Energi 2, Lelah" })).toBeChecked({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
});

test("kebiasaan: tambah, centang, streak, dan bertahan setelah reload (HABIT-1, HABIT-2)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "habit");
  await page.goto("/habits");

  await expect(page.getByText("Belum ada kebiasaan")).toBeVisible();
  await page.getByRole("button", { name: "Tambah kebiasaan" }).click();
  await page.getByLabel("Nama kebiasaan").fill("Olahraga 15 menit");
  await page.getByLabel("Identitas (opsional)").fill("Aku orang yang rutin bergerak");
  await page.getByRole("button", { name: "Simpan" }).click();

  const box = page.getByRole("checkbox", { name: /Olahraga 15 menit/ });
  await expect(box).toBeVisible();
  await expect(page.getByText("Aku orang yang rutin bergerak")).toBeVisible();
  await expect(box).not.toBeChecked();

  await box.check();
  await expect(box).toBeChecked();
  await expect(page.getByText("1 hari")).toBeVisible();

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /Olahraga 15 menit/ })).toBeChecked({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole("checkbox", { name: /Olahraga 15 menit/ }).uncheck();
  await expect(page.getByText("1 hari")).toHaveCount(0);
});

test("streak jangan bolos dua kali: satu hari terlewat tidak memutus, dua hari memutus (HABIT-2)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "streak");

  const bridged = await seedHabit(user, "Baca buku");
  // Done 3 and 2 days ago, missed yesterday, not yet done today.
  await seedHabitLog(user, bridged, daysBefore(today, 3));
  await seedHabitLog(user, bridged, daysBefore(today, 2));

  const broken = await seedHabit(user, "Meditasi");
  // Done 4 days ago, then two days in a row missed (3 and 2 ago... and yesterday).
  await seedHabitLog(user, broken, daysBefore(today, 4));

  await page.goto("/habits");

  const bridgedRow = page.getByRole("checkbox", { name: /Baca buku/ }).locator("xpath=ancestor::label");
  const brokenRow = page.getByRole("checkbox", { name: /Meditasi/ }).locator("xpath=ancestor::label");

  await expect(bridgedRow).toContainText("2 hari");
  await expect(brokenRow).not.toContainText("hari");

  // Checking today bridges yesterday's gap: 3 and 2 days ago plus today.
  await page.getByRole("checkbox", { name: /Baca buku/ }).check();
  await expect(bridgedRow).toContainText("3 hari");
});

test("batas 3 kebiasaan untuk paket gratis, arsip membuka slot, premium tanpa batas (HABIT-1, HABIT-3)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "limit");
  await seedHabit(user, "Satu");
  await seedHabit(user, "Dua");
  await seedHabit(user, "Tiga");

  await page.goto("/habits");
  await page.getByRole("button", { name: "Tambah kebiasaan" }).click();
  await expect(page.getByText("Paket gratis memuat 3 kebiasaan aktif")).toBeVisible();
  await expect(page.getByLabel("Nama kebiasaan")).toHaveCount(0);

  // Archive one from "Kelola": the habit leaves the list and a new one fits.
  await page.getByRole("button", { name: "Arsipkan" }).first().click();
  await page.getByRole("button", { name: "Ya, arsipkan" }).click();
  await expect(page.getByRole("checkbox", { name: /Satu/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Tambah kebiasaan" }).click();
  await page.getByLabel("Nama kebiasaan").fill("Empat");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("checkbox", { name: "Empat" })).toBeVisible();

  // The page was told it is full; the database is what really refuses. A premium
  // account passes the same trigger (the payment webhook sets the plan).
  await setPlan(user, "premium");
  await page.reload();
  await page.getByRole("button", { name: "Tambah kebiasaan" }).click();
  await page.getByLabel("Nama kebiasaan").fill("Lima");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("checkbox", { name: "Lima" })).toBeVisible();
});

test("nama kosong ditolak dengan pesan jelas dan tidak membuat kebiasaan", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "kosong");
  await page.goto("/habits");

  await page.getByRole("button", { name: "Tambah kebiasaan" }).click();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Beri nama kebiasaannya dulu.")).toBeVisible();
});
