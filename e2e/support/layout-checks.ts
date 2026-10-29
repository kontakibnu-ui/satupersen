import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** The three sizes and two modes DESIGN.md §13 asks every UI task to pass. */
export const viewports = [
  { name: "hp-360", width: 360, height: 640 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1280", width: 1280, height: 800 },
] as const;

export const colorSchemes = ["light", "dark"] as const;

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);
}

export async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  // Switching the colour scheme starts the 200 ms colour transitions DESIGN.md
  // §13 allows, and axe would otherwise measure a colour halfway between the
  // two modes. Only transitions are awaited: they always end, unlike a looping
  // animation. A cancelled transition settles too, so allSettled is used.
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished),
    ),
  );

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id} (${violation.nodes.length})`);
  expect(blocking, "axe violations with serious or critical impact").toEqual([]);
}

/**
 * Inline links inside running text are exempt, as in WCAG 2.5.8. A checkbox or
 * radio is measured by its <label>, because DESIGN.md §6 draws the box at 24 px
 * inside a 44 px label that is the real touch area.
 */
export async function expectTouchTargetsAtLeast44(page: Page): Promise<void> {
  const tooSmall = await page.evaluate(() => {
    const selector = "button, input, select, textarea, a[href]";
    return Array.from(document.querySelectorAll(selector))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "inline" && style.display !== "none" && style.visibility !== "hidden";
      })
      .filter((element) => !element.classList.contains("sr-only"))
      .map((element) => {
        const isToggle =
          element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio");
        const target = (isToggle ? element.closest("label") : null) ?? element;
        const rect = target.getBoundingClientRect();
        const label = (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40);
        return { tag: element.tagName.toLowerCase(), label, width: rect.width, height: rect.height };
      })
      .filter((box) => box.width > 0 && box.height > 0)
      .filter((box) => box.width < 44 || box.height < 44)
      .map((box) => `${box.tag} "${box.label}" ${Math.round(box.width)}x${Math.round(box.height)}`);
  });

  expect(tooSmall, "interactive targets smaller than 44x44").toEqual([]);
}
