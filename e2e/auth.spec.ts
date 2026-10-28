import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "hp-360", width: 360, height: 640 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1280", width: 1280, height: 800 },
];

const colorSchemes = ["light", "dark"] as const;

for (const viewport of viewports) {
  for (const colorScheme of colorSchemes) {
    test(`login ${viewport.name} ${colorScheme}: layout fits and passes axe`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ colorScheme });
      await page.goto("/login");

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(horizontalOverflow, "no horizontal scroll").toBeLessThanOrEqual(0);

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map((violation) => `${violation.id} (${violation.nodes.length})`);
      expect(blocking, "axe violations with serious or critical impact").toEqual([]);
    });
  }
}

test("login hp-360: interactive targets are at least 44x44", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/login");

  // Inline links inside running text are exempt, as in WCAG 2.5.8.
  const tooSmall = await page.evaluate(() => {
    const selector = "button, input, select, textarea, a[href]";
    return Array.from(document.querySelectorAll(selector))
      .filter((element) => window.getComputedStyle(element).display !== "inline")
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = (element.textContent ?? "").trim().slice(0, 40);
        return { tag: element.tagName.toLowerCase(), label, width: rect.width, height: rect.height };
      })
      .filter((box) => box.width < 44 || box.height < 44)
      .map((box) => `${box.tag} "${box.label}" ${Math.round(box.width)}x${Math.round(box.height)}`);
  });

  expect(tooSmall, "interactive targets smaller than 44x44").toEqual([]);
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
