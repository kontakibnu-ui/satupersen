import { expect, test } from "@playwright/test";
import {
  applyColorScheme,
  colorSchemes,
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  expectTouchTargetsAtLeast44,
  viewports,
} from "./support/layout-checks";
import { BASE_URL, createTestUser, deleteTestUser, localStackIsRunning, signIn } from "./support/test-users";

/**
 * The public pages (TASKS.md 6.4, DESIGN.md §10, §13): landing, privacy, terms,
 * and the manifest that makes the app installable. None of them needs a login.
 */

const pages = [
  { name: "landing", path: "/" },
  { name: "privasi", path: "/privacy" },
  { name: "syarat", path: "/terms" },
];

for (const page of pages) {
  for (const viewport of viewports) {
    test(`${page.name} ${viewport.name}: fits and passes axe in light and dark`, async ({ page: browser }) => {
      await browser.setViewportSize({ width: viewport.width, height: viewport.height });
      await browser.goto(page.path);
      await expect(browser.getByRole("main")).toBeVisible();

      for (const colorScheme of colorSchemes) {
        await applyColorScheme(browser, colorScheme);
        await expectNoHorizontalScroll(browser);
        await expectNoSeriousAxeViolations(browser);
      }
    });
  }

  test(`${page.name} hp-360: interactive targets are at least 44x44`, async ({ page: browser }) => {
    await browser.setViewportSize({ width: 360, height: 640 });
    await browser.goto(page.path);
    await expect(browser.getByRole("main")).toBeVisible();
    await expectTouchTargetsAtLeast44(browser);
  });
}

test("landing: judul, ajakan mulai ke /login, contoh berlabel, dan tanpa pernyataan usia", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Jadi 1% lebih baik tiap hari" })).toBeVisible();

  // Hero and closing band, plus the secondary one in the free plan field (DESIGN.md §10).
  const start = page.getByRole("link", { name: "Mulai gratis" });
  await expect(start).toHaveCount(3);

  for (const link of await start.all()) {
    await expect(link).toHaveAttribute("href", "/login");
  }

  await expect(page.getByText("Contoh", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Privasi" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "Syarat layanan" })).toHaveAttribute("href", "/terms");

  // The age statement was removed by the user's decision of 2026-11-01.
  await expect(page.getByText(/18 tahun/)).toHaveCount(0);
});

test("landing: harga dari src/config/plans.ts, dan tombol mengikuti catatan paket yang tampil", async ({ page }) => {
  await page.goto("/");

  const pricing = page.locator("#harga");
  await pricing.scrollIntoViewIfNeeded();
  // The free card has a phone and a laptop layout; only one of them is shown at a time.
  await expect(pricing.getByText("Rp 0", { exact: true }).filter({ visible: true })).toBeVisible();

  // DESIGN §14.3: sticky notes, longest first, prices and savings from plans.ts.
  const notes = pricing.getByRole("radiogroup", { name: "Lama paket premium" });
  await expect(notes.getByRole("radio", { name: "12 bulan" })).toBeChecked();
  await expect(notes).toContainText("Rp 199.000");
  await expect(notes.getByText("Rp 24.666 sebulan, hemat 15%")).toBeVisible();
  await expect(pricing.getByRole("link", { name: "Pilih 12 bulan" })).toHaveAttribute("href", "/login");

  // Tapped again until the page has hydrated and follows the choice.
  await expect(async () => {
    await notes.getByText("3 bulan", { exact: true }).click();
    await expect(pricing.getByRole("link", { name: "Pilih 3 bulan" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
});

test("landing: dial 1% per hari bisa digeser dan diberi label ilustrasi", async ({ page }) => {
  await page.goto("/");

  const output = page.locator("output");
  await expect(output).toContainText("37,8 kali");

  // One slider, as in the wireframe; the stamp and the sentence follow it.
  const slider = page.getByLabel(/Jumlah hari/);
  // Moved again until the page has hydrated and the stamp follows the slider.
  await expect(async () => {
    await slider.fill("29");
    await slider.fill("30");
    await expect(output).toContainText("1,35 kali", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(output).toContainText("0,74 kali");

  await slider.fill("90");
  await expect(output).toContainText("selama 90 hari");
  await expect(page.getByText("bukan janji hasil", { exact: false })).toBeVisible();
});

test("landing: pertanyaan yang sering muncul bisa dibuka lewat keyboard", async ({ page }) => {
  await page.goto("/");

  const question = page.locator("summary", { hasText: "Apa itu kuota AI bulanan?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Setiap analisa dan balasan AI memakai token", { exact: false })).toBeVisible();
});

test("landing: pengguna yang sudah masuk langsung dibawa ke aplikasi", async ({ page }) => {
  test.skip(!(await localStackIsRunning()), "Supabase lokal belum jalan (npx supabase start)");

  const user = await createTestUser("landing", true);

  try {
    await signIn(page.context(), user);
    await page.goto("/");
    await expect(page).toHaveURL(/\/today/);
  } finally {
    await deleteTestUser(user);
  }
});

test("privasi dan syarat: berlabel draf, menyebut penyedia model AI, dan celah yang menunggu pengelola terlihat", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Kebijakan privasi" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("draf");
  await expect(page.getByText("OpenRouter dan penyedia model AI di baliknya")).toBeVisible();
  // The contact email is decided (user, 2026-11-18); the operator's name and address are not yet.
  await expect(page.getByText("kirim email ke satupersendev@gmail.com")).toBeVisible();
  await expect(page.getByText("[Nama pengelola dan alamat")).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Syarat layanan" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("draf");
  await expect(page.getByText("Laporan pelanggaran hak cipta bisa dikirim ke satupersendev@gmail.com.")).toBeVisible();
});

test("manifest: bisa dipasang di layar utama, tanpa login, dengan ikon yang benar-benar ada (DESIGN §5)", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Satu Persen", display: "standalone", lang: "id" });

  const sizes = (manifest.icons as { sizes: string; purpose?: string }[]).map((icon) => `${icon.sizes}:${icon.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));

  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  }
});

test("warna bilah browser mengikuti mode siang dan malam", async ({ page }) => {
  // Day is the default even on a dark system (DESIGN.md §3).
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#F6F4EE");

  await page.context().addCookies([{ name: "satupersen-theme", value: "dark", url: BASE_URL }]);
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#14161B");
});
