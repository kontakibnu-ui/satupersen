import { expect, test } from "@playwright/test";

/**
 * End to end run of the signed in flow against the local Supabase stack:
 * ask for a magic link, open it from Mailpit, pass the onboarding gate, and
 * land on Akun with the navigation in place.
 *
 * It skips itself when the local stack is not running, so `npm run test:ui`
 * stays useful without Docker. Start it with `npx supabase start` (and
 * `npm run dev` picks the local values up from .env.local).
 */

const MAILPIT_URL = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";
const MAILPIT_TIMEOUT_MS = 30_000;

type MailpitMessage = { ID: string; To?: { Address: string }[] };

async function localStackIsRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`);

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForMagicLink(email: string): Promise<string> {
  const deadline = Date.now() + MAILPIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/messages?limit=25`)).json()) as {
      messages?: MailpitMessage[];
    };

    const mine = (list.messages ?? []).find((message) =>
      (message.To ?? []).some((to) => to.Address.toLowerCase() === email.toLowerCase()),
    );

    if (mine) {
      const detail = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${mine.ID}`)
      ).json()) as { Text?: string; HTML?: string };
      const body = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;
      const match = /http:\/\/127\.0\.0\.1:\d+\/auth\/v1\/verify\?[^\s"'<>]+/.exec(body);

      if (match) {
        return match[0].replace(/&amp;/g, "&");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Tautan masuk untuk ${email} tidak muncul di Mailpit dalam batas waktu`);
}

test("alur lengkap: tautan email, onboarding, lalu Akun", async ({ page }) => {
  test.skip(!(await localStackIsRunning()), "Supabase lokal belum jalan (npx supabase start)");

  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByRole("button", { name: "Kirim tautan masuk" }).click();
  await expect(page.getByRole("status")).toContainText("Tautan sudah dikirim");

  const magicLink = await waitForMagicLink(email);
  await page.goto(magicLink);

  // AUTH-4: a brand new account cannot skip the consent screen.
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("checkbox", { name: /kebijakan privasi/i }).check();
  await page.getByRole("checkbox", { name: /18 tahun/i }).check();
  await page.getByRole("button", { name: "Mulai" }).click();

  // 1.7 plus 1.6d: the first (app) page, with the navigation around it.
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Akun" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Akun" }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );
});
