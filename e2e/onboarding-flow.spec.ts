import { expect, test, type Page } from "@playwright/test";
import { deleteUserByEmail } from "./support/test-users";

/**
 * End to end run of the signed in flow against the local Supabase stack:
 * sign up with an email and a password, pass the onboarding gate, and land on
 * Akun with the navigation in place. The local stack has email confirmation
 * off (supabase/config.toml), so signing up signs the user in.
 *
 * It skips itself when the local stack is not running, so `npm run test:ui`
 * stays useful without Docker. Start it with `npx supabase start` (and
 * `npm run dev` picks the local values up from .env.local).
 */

const MAILPIT_URL = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";
/** Mailpit answers only when `npx supabase start` is up, so it doubles as the "is the stack running" probe. */
async function localStackIsRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`);

    return response.ok;
  } catch {
    return false;
  }
}

test("alur lengkap: daftar dengan password, onboarding, lalu Akun", async ({ page }) => {
  test.skip(!(await localStackIsRunning()), "Supabase lokal belum jalan (npx supabase start)");

  const email = `e2e-${Date.now()}@example.com`;

  try {
    await runFlow(page, email);
  } finally {
    // The sign-up flow made a real user; leaving it behind piles up in the local database.
    await deleteUserByEmail(email);
  }
});

async function runFlow(page: Page, email: string): Promise<void> {
  await page.goto("/login?mode=daftar");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Password").fill("RahasiaUji123!");
  await page.getByRole("button", { name: "Daftar", exact: true }).click();

  // AUTH-4: a brand new account cannot skip the consent screen.
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("checkbox", { name: /kebijakan privasi/i }).check();
  await page.getByRole("button", { name: "Mulai" }).click();

  // DIARY-1 plus 1.6d: the diary is the home screen, with the navigation around it.
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByRole("heading", { level: 1, name: /^Gimana harimu/ })).toBeVisible();
  await expect(page.getByLabel("Tulisan hari ini")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Hari Ini" }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );

  // DIARY-2: the text survives a reload, so it really reached the database.
  const text = "Hari ini aku akhirnya kelarin laporan yang tertunda.";
  await page.getByLabel("Tulisan hari ini").fill(text);
  // Hari Ini has several status lines (mood, habits, saving); this is the one that says "Tersimpan".
  await expect(page.getByRole("status").filter({ hasText: "Tersimpan" })).toHaveText("Tersimpan", { timeout: 15_000 });
  await page.reload();
  await expect(page.getByLabel("Tulisan hari ini")).toHaveValue(text, { timeout: 15_000 });

  // The navigation reaches the other page and marks it as current.
  await page.getByRole("link", { name: "Akun" }).first().click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Akun" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
}
