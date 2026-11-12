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

test("landing: harga dari src/config/plans.ts, dan pemilih paket mengganti harganya", async ({ page }) => {
  await page.goto("/");

  const pricing = page.locator("#harga");
  await pricing.scrollIntoViewIfNeeded();
  await expect(pricing.getByText("Rp 0", { exact: true })).toBeVisible();
  await expect(pricing.locator("[aria-live]")).toContainText("Rp 199.000");

  await pricing.getByText("3 bulan", { exact: true }).click();
  await expect(pricing.locator("[aria-live]")).toContainText("Rp 74.000");
  await expect(pricing).toContainText("Sama dengan Rp 24.666 sebulan");
});

test("landing: dial 1% per hari bisa digeser dan diberi label ilustrasi", async ({ page }) => {
  await page.goto("/");

  const output = page.locator("output");
  await expect(output).toContainText("37,8 kali");

  await page.getByRole("button", { name: "30 hari" }).click();
  await expect(output).toContainText("1,35 kali");
  await expect(output).toContainText("0,74 kali");

  await page.getByLabel("Geser jumlah hari").fill("90");
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
  await expect(page.getByText("[Nama pengelola, alamat, dan email untuk pertanyaan soal data")).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Syarat layanan" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("draf");
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
