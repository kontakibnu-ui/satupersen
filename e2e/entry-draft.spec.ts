import { expect, test, type Page } from "@playwright/test";
import {
  applyColorScheme,
  colorSchemes,
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  expectTouchTargetsAtLeast44,
  viewports,
} from "./support/layout-checks";
import {
  createTestUser,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  readEntryContent,
  seedEntry,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Diary text that has not reached the server is kept in the browser
 * (src/lib/entry-draft.ts, user decision 2026-11-18), and a server action that
 * cannot be reached ends in a message instead of a screen stuck busy
 * (src/lib/call-action.ts). Every test has its own user, so the drafts and
 * entries of one test never meet another's.
 */

const KEPT_HERE = "Belum terkirim, aman di perangkat ini";
const today = jakartaToday();
const users: TestUser[] = [];
let stackUp = false;

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();
});

test.afterAll(async () => {
  await Promise.all(users.map(deleteTestUser));
});

async function newUser(label: string): Promise<TestUser> {
  const user = await createTestUser(label, true);
  users.push(user);
  return user;
}

const keyFor = (user: TestUser, date = today) => `satupersen-entry-draft:${user.id}:${date}`;

async function draftKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("satupersen-entry-draft:"))
      .sort(),
  );
}

async function openToday(page: Page, user: TestUser): Promise<void> {
  await signIn(page.context(), user);
  await page.goto("/today");
  await expect(page.getByLabel("Tulisan hari ini")).toBeVisible();
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
  await waitForHydration(page);
}

/** The cue only changes once React runs in the page, so typing after this reaches the editor's handlers. */
async function waitForHydration(page: Page): Promise<void> {
  const cue = page.locator("#entry-cue");
  const before = (await cue.textContent()) ?? "";

  await expect(async () => {
    await page.getByRole("button", { name: "Pertanyaan lain" }).click();
    await expect(cue).not.toHaveText(before, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

/** The status line under the sheet; the writing bar copy is aria-hidden. */
const statusLine = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).first();

test("Koneksi putus saat menulis: tulisan aman di perangkat, lalu terkirim begitu tersambung lagi", async ({
  page,
  context,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser("draft-offline");

  await openToday(page, user);
  await context.setOffline(true);
  await page.getByLabel("Tulisan hari ini").fill("Hari ini hujan, tapi aku tetap jalan kaki.");

  await expect(statusLine(page)).toHaveText(KEPT_HERE, { timeout: 15_000 });
  expect(await draftKeys(page)).toEqual([keyFor(user)]);
  expect(await readEntryContent(user, today)).toBeNull();

  await context.setOffline(false);

  await expect
    .poll(() => readEntryContent(user, today), { timeout: 20_000 })
    .toBe("Hari ini hujan, tapi aku tetap jalan kaki.");
  await expect(statusLine(page)).toHaveText("Tersimpan", { timeout: 15_000 });
  expect(await draftKeys(page)).toEqual([]);
});

test("Halaman ditutup sebelum terkirim: tulisan kembali saat Hari Ini dibuka lagi, lalu tersimpan", async ({
  browser,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser("draft-reopen");
  const context = await browser.newContext();
  const first = await context.newPage();

  await openToday(first, user);
  await context.setOffline(true);
  await first.getByLabel("Tulisan hari ini").fill("Ditulis di kereta tanpa sinyal.");
  await expect(statusLine(first)).toHaveText(KEPT_HERE, { timeout: 15_000 });
  await first.close();

  await context.setOffline(false);
  const second = await context.newPage();
  await second.goto("/today");

  await expect(second.getByLabel("Tulisan hari ini")).toHaveValue("Ditulis di kereta tanpa sinyal.", {
    timeout: 30_000,
  });
  await expect.poll(() => readEntryContent(user, today), { timeout: 20_000 }).toBe("Ditulis di kereta tanpa sinyal.");
  await expect.poll(() => draftKeys(second), { timeout: 10_000 }).toEqual([]);
  await context.close();
});

test("Pindah layar dalam dua detik setelah mengetik: kata terakhir tetap terkirim", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser("draft-leave");

  await openToday(page, user);
  await page.getByLabel("Tulisan hari ini").fill("Langsung pindah ke Kebiasaan.");
  // Straight away, before the two second auto-save would have run.
  await page.getByRole("link", { name: "Kebiasaan" }).first().click();
  await expect(page).toHaveURL(/\/habits/);

  await expect.poll(() => readEntryContent(user, today), { timeout: 20_000 }).toBe("Langsung pindah ke Kebiasaan.");
});

test("Tulisan bentrok (diubah di tempat lain): user memilih, dan draf hari lain serta akun lain dibuang", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser("draft-conflict");
  await seedEntry(user, today, "Ditulis di laptop.");

  await page.addInitScript(
    ({ own, older, other }) => {
      if (window.sessionStorage.getItem("seeded")) {
        return;
      }

      window.sessionStorage.setItem("seeded", "1");
      // Written on this device while the server still had nothing.
      window.localStorage.setItem(own, JSON.stringify({ content: "Ditulis di HP.", base: "" }));
      window.localStorage.setItem(older, JSON.stringify({ content: "Kemarin.", base: "" }));
      window.localStorage.setItem(other, JSON.stringify({ content: "Punya akun lain.", base: "" }));
    },
    {
      own: keyFor(user),
      older: keyFor(user, "2020-01-01"),
      other: `satupersen-entry-draft:00000000-0000-0000-0000-000000000000:${today}`,
    },
  );

  await page.setViewportSize({ width: 360, height: 640 });
  await openToday(page, user);

  const card = page.getByRole("region", { name: "Ada tulisan yang belum terkirim" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Ditulis di HP.")).toBeVisible();
  await expect(page.getByLabel("Tulisan hari ini")).toHaveValue("Ditulis di laptop.");
  expect(await draftKeys(page)).toEqual([keyFor(user)]);

  // The new card follows DESIGN.md §13 like every other state.
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const colorScheme of colorSchemes) {
      await applyColorScheme(page, colorScheme);
      await expectNoHorizontalScroll(page);
      await expectNoSeriousAxeViolations(page);
    }
  }

  await page.setViewportSize({ width: 360, height: 640 });
  await expectTouchTargetsAtLeast44(page);

  await card.getByRole("button", { name: "Pakai tulisan ini" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByLabel("Tulisan hari ini")).toHaveValue("Ditulis di HP.");
  await expect.poll(() => readEntryContent(user, today), { timeout: 20_000 }).toBe("Ditulis di HP.");
  await expect.poll(() => draftKeys(page), { timeout: 10_000 }).toEqual([]);
});

test("Tulisan bentrok: \"Tetap pakai yang tersimpan\" membuang draf tanpa mengubah tulisan di server", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser("draft-keep");
  await seedEntry(user, today, "Versi di server.");

  await page.addInitScript(
    ({ own }) => {
      if (window.sessionStorage.getItem("seeded")) {
        return;
      }

      window.sessionStorage.setItem("seeded", "1");
      window.localStorage.setItem(own, JSON.stringify({ content: "Versi lama di HP.", base: "Awal." }));
    },
    { own: keyFor(user) },
  );

  await openToday(page, user);
  const card = page.getByRole("region", { name: "Ada tulisan yang belum terkirim" });
  await card.getByRole("button", { name: "Tetap pakai yang tersimpan" }).click();

  await expect(card).toHaveCount(0);
  expect(await draftKeys(page)).toEqual([]);
  await expect(page.getByLabel("Tulisan hari ini")).toHaveValue("Versi di server.");
  expect(await readEntryContent(user, today)).toBe("Versi di server.");
});

test("Keluar akun membuang semua draf di browser", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser("draft-signout");

  await signIn(page.context(), user);
  await page.goto("/settings");
  await page.evaluate((key) => window.localStorage.setItem(key, JSON.stringify({ content: "x", base: "" })), keyFor(user));

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await draftKeys(page)).toEqual([]);
});

test("Koneksi putus saat memilih mood: pesan jelas dan pilihan kembali, tidak macet", async ({ page, context }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser("draft-mood");

  await openToday(page, user);
  await context.setOffline(true);

  // A tap on the visible word, as a person does (habits-mood.spec.ts does the same).
  const word = page.getByRole("radiogroup", { name: "Mood" }).getByText("Baik", { exact: true });
  const mood = page.getByRole("radio", { name: "Mood 4, Baik" });
  await word.click();

  await expect(page.getByText("Koneksi terputus. Coba lagi.")).toBeVisible({ timeout: 15_000 });
  await expect(mood).not.toBeChecked();

  // Not stuck: back online, the same tap saves.
  await context.setOffline(false);
  await word.click();
  await expect(mood).toBeChecked();
  await expect(page.getByText("Koneksi terputus. Coba lagi.")).toHaveCount(0);
});
