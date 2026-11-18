import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  applyColorScheme,
  colorSchemes,
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  expectTouchTargetsAtLeast44,
  viewports,
} from "./support/layout-checks";
import { BASE_URL, createTestUser, deleteTestUser, localStackIsRunning, type TestUser } from "./support/test-users";

/**
 * A forgotten password (AUTH-5): /login links to /forgot-password, which emails
 * a reset link; the link comes back through /auth/callback to /reset-password,
 * where the new password is saved and the user goes into the app.
 *
 * The full flow reads the email from Mailpit, the inbox of the local Supabase
 * stack, so it only runs against that stack. Its port is read from
 * supabase/config.toml ([local_smtp] port), so moving the stack's ports does
 * not break the test.
 */

const MAILPIT_PORT =
  /\[local_smtp\][^[]*?\nport = (\d+)/.exec(readFileSync("supabase/config.toml", "utf8"))?.[1] ?? "54324";
const MAILPIT = `http://127.0.0.1:${MAILPIT_PORT}`;
const NEW_PASSWORD = "PasswordBaru456!";

const pages = [
  { name: "lupa-password", path: "/forgot-password" },
  { name: "password-baru-tanpa-sesi", path: "/reset-password" },
];

for (const screen of pages) {
  for (const viewport of viewports) {
    test(`${screen.name} ${viewport.name}: fits and passes axe in light and dark`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(screen.path);

      for (const scheme of colorSchemes) {
        await applyColorScheme(page, scheme);
        await expectNoHorizontalScroll(page);
        await expectNoSeriousAxeViolations(page);
      }
    });
  }

  test(`${screen.name} hp-360: interactive targets are at least 44x44`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(screen.path);
    await expectTouchTargetsAtLeast44(page);
  });
}

test("login: tautan Lupa password membuka halaman permintaan tautan", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Lupa password?" }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { level: 1, name: "Lupa password" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kembali ke halaman masuk" })).toHaveAttribute("href", "/login");
});

test("daftar tidak menampilkan Lupa password", async ({ page }) => {
  await page.goto("/login?mode=daftar");
  await expect(page.getByRole("link", { name: "Lupa password?" })).toHaveCount(0);
});

test("lupa password: email kosong ditolak sebelum dikirim", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByRole("button", { name: "Kirim tautan" }).click();
  await expect(page.getByRole("status")).toHaveText("Isi alamat emailmu dulu.");
});

test("/reset-password tanpa sesi menjelaskan tautannya tidak berlaku dan menawarkan tautan baru", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByRole("heading", { level: 1, name: "Tautannya sudah tidak berlaku" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Minta tautan baru" })).toHaveAttribute("href", "/forgot-password");
});

test("callback tanpa kode untuk reset kembali ke /reset-password, bukan ke form masuk", async ({ page }) => {
  await page.goto("/auth/callback?next=%2Freset-password&error=access_denied&error_code=otp_expired");
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tautannya sudah tidak berlaku" })).toBeVisible();
});

/** The reset link in the newest email to `email`, read from Mailpit. */
async function resetLinkFor(email: string): Promise<string> {
  let messageId: string | undefined;

  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
        const body = (await response.json()) as { messages: { ID: string }[] };
        messageId = body.messages[0]?.ID;
        return messageId;
      },
      { message: "reset email in Mailpit", timeout: 15_000 },
    )
    .toBeTruthy();

  const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messageId}`)).json()) as { HTML: string };
  const href = /href="([^"]*type=recovery[^"]*)"/.exec(message.HTML)?.[1];

  if (!href) {
    throw new Error("The reset email has no recovery link");
  }

  // The link points at the stack's API address; follow it through the same
  // Supabase URL the app uses, which is the address known to reach the stack.
  const link = new URL(href.replaceAll("&amp;", "&"));
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  link.protocol = api.protocol;
  link.host = api.host;

  return link.toString();
}

/**
 * Opened with goto, which waits for the page to load, like the other form tests: typing into a
 * page the router is still swapping in can land before React hydrates and be cleared.
 * The link from /login has its own test above.
 */
async function requestReset(page: Page, email: string): Promise<void> {
  await page.goto("/forgot-password");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByRole("button", { name: "Kirim tautan" }).click();
  await expect(page.getByRole("status")).toContainText(`Kalau ${email} terdaftar`);
}

test.describe("alur penuh dengan Supabase lokal", () => {
  let user: TestUser | undefined;

  test.beforeEach(async () => {
    test.skip(!(await localStackIsRunning()), "Supabase lokal belum jalan (npx supabase start)");
    user = await createTestUser("reset", true);
  });

  test.afterEach(async () => {
    await deleteTestUser(user);
    user = undefined;
  });

  test("AUTH-5: minta tautan, buat password baru, lalu masuk dengan password itu", async ({ page, browser }) => {
    const email = user!.email;

    await requestReset(page, email);
    const link = await resetLinkFor(email);

    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByRole("heading", { level: 1, name: "Buat password baru" })).toBeVisible();

    await page.getByLabel("Password baru").fill("pendek");
    await page.getByRole("button", { name: "Simpan password baru" }).click();
    await expect(page.getByRole("status")).toHaveText("Password minimal 8 karakter.");

    await page.getByLabel("Password baru").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Simpan password baru" }).click();
    await expect(page).toHaveURL(/\/today/);

    // A fresh browser: the new password opens the account, the old one no longer does.
    const fresh = await browser.newContext({ baseURL: BASE_URL });

    try {
      const other = await fresh.newPage();
      await other.goto("/login");
      await other.getByLabel("Alamat email").fill(email);
      await other.getByLabel("Password").fill("RahasiaUji123!");
      await other.getByRole("button", { name: "Masuk", exact: true }).click();
      await expect(other.getByRole("status")).toContainText("Email atau passwordnya belum cocok");

      await other.getByLabel("Password").fill(NEW_PASSWORD);
      await other.getByRole("button", { name: "Masuk", exact: true }).click();
      await expect(other).toHaveURL(/\/today/);

      // The link was used once; opening it again lands on the explanation, not on a form.
      // Supabase reports the spent link in the fragment (#error=access_denied&error_code=otp_expired…),
      // which the browser keeps through the redirect.
      await other.context().clearCookies();
      await other.goto(link);
      await expect(other).toHaveURL(/\/reset-password(#error=.*otp_expired.*)?$/);
      await expect(other.getByRole("heading", { level: 1, name: "Tautannya sudah tidak berlaku" })).toBeVisible();
    } finally {
      await fresh.close();
    }
  });
});
