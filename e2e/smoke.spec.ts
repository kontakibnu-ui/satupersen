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
    test(`${viewport.name} ${colorScheme}: layout fits and passes axe`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ colorScheme });
      await page.goto("/");

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

test("hp-360: interactive targets are at least 44x44", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");

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
