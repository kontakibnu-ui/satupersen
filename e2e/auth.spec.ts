import { expect, test } from "@playwright/test";
import {
  applyColorScheme,
  colorSchemes,
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  expectTouchTargetsAtLeast44,
  viewports,
} from "./support/layout-checks";

// "/" sends signed out visitors to /login until the landing page (TASKS.md
// 6.4) exists, so the login page is also what "/" shows today.

for (const viewport of viewports) {
  for (const colorScheme of colorSchemes) {
    test(`login ${viewport.name} ${colorScheme}: layout fits and passes axe`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/login");
      await applyColorScheme(page, colorScheme);

      await expectNoHorizontalScroll(page);
      await expectNoSeriousAxeViolations(page);
    });
  }
}

test("login hp-360: interactive targets are at least 44x44", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/login");

  await expectTouchTargetsAtLeast44(page);
});

test("/ menampilkan landing page untuk pengunjung yang belum masuk, dengan jalan ke /login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jadi 1% lebih baik tiap hari");
  await page.getByRole("link", { name: "Mulai gratis" }).first().click();
  await expect(page).toHaveURL(/\/login/);
});

test("login menampilkan dua cara masuk dari AUTH-1: email dengan password, dan Google", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Alamat email")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Masuk", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim tautan masuk" })).toHaveCount(0);
});

test("login memberi pesan jelas kalau email atau password kosong", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Isi alamat emailmu dulu.");

  await page.getByLabel("Alamat email").fill("nama@example.com");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Isi passwordmu dulu.");
});

test("daftar: halamannya sendiri, dan password pendek ditolak sebelum dikirim", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Belum punya akun? Daftar" }).click();

  await expect(page).toHaveURL(/\/login\?mode=daftar/);
  await expect(page.getByRole("heading", { name: "Buat akun Satu Persen" })).toBeVisible();

  await page.getByLabel("Alamat email").fill("nama@example.com");
  await page.getByLabel("Password").fill("pendek");
  await page.getByRole("button", { name: "Daftar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Password minimal 8 karakter.");

  await page.getByRole("link", { name: "Sudah punya akun? Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Masuk ke Satu Persen" })).toBeVisible();
});

test("AUTH-2: /settings mengarahkan ke /login saat belum masuk", async ({ page }) => {
  await page.goto("/settings");

  await expect(page).toHaveURL(/\/login/);
  await expect(page).toHaveURL(/next=%2Fsettings/);
});

test("AUTH-2: /onboarding juga butuh login dulu", async ({ page }) => {
  await page.goto("/onboarding");

  await expect(page).toHaveURL(/\/login/);
});
