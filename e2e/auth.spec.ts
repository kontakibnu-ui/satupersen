import { expect, test } from "@playwright/test";
import {
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
      await page.emulateMedia({ colorScheme });
      await page.goto("/login");

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

test("/ mengarahkan pengunjung yang belum masuk ke /login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login/);
});

test("login menampilkan dua cara masuk dari AUTH-1", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
  await expect(page.getByLabel("Alamat email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim tautan masuk" })).toBeVisible();
});

test("login memberi pesan jelas kalau email dikirim kosong", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Kirim tautan masuk" }).click();

  await expect(page.getByRole("status")).toHaveText("Isi alamat emailmu dulu.");
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
