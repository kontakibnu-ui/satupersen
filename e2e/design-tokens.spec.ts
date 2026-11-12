import { expect, test, type Page } from "@playwright/test";
import { BASE_URL } from "./support/test-users";

// Expected values are the DESIGN.md §3 (version 4) hex values converted to rgb by hand.
const DAY = {
  background: "rgb(246, 244, 238)",
  text: "rgb(31, 35, 48)",
  primary: "rgb(34, 53, 94)",
  textMuted: "rgb(94, 99, 114)",
  control: "rgb(138, 133, 119)",
};

const NIGHT = {
  background: "rgb(20, 22, 27)",
  text: "rgb(232, 230, 225)",
  primary: "rgb(169, 189, 230)",
  textMuted: "rgb(163, 168, 181)",
  control: "rgb(127, 135, 150)",
};

async function readTokens(page: Page) {
  return page.evaluate(() => {
    const body = window.getComputedStyle(document.body);
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--primary)";
    probe.style.color = "var(--text-muted)";
    probe.style.borderColor = "var(--control)";
    document.body.append(probe);

    const styles = window.getComputedStyle(probe);
    const tokens = {
      background: body.backgroundColor,
      text: body.color,
      primary: styles.backgroundColor,
      textMuted: styles.color,
      control: styles.borderColor,
    };
    probe.remove();
    return tokens;
  });
}

test("mode siang adalah bawaan, juga saat sistem memilih gelap", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  expect(await readTokens(page)).toEqual(DAY);
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});

test("cookie mode malam melukis halaman malam sejak byte pertama", async ({ page }) => {
  await page.context().addCookies([{ name: "satupersen-theme", value: "dark", url: BASE_URL }]);
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  expect(await readTokens(page)).toEqual(NIGHT);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#14161B");
});

test("nilai cookie yang tidak dikenal tetap memberi mode siang", async ({ page }) => {
  await page.context().addCookies([{ name: "satupersen-theme", value: "gelap-banget", url: BASE_URL }]);
  await page.goto("/");

  expect(await readTokens(page)).toEqual(DAY);
});

test("tombol mode malam bisa dinyalakan dan dimatikan, dan pilihannya diingat", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Mode malam" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#14161B");

  await page.reload();
  await expect(page.getByRole("switch", { name: "Mode malam" })).toHaveAttribute("aria-checked", "true");
  expect(await readTokens(page)).toEqual(NIGHT);

  await page.getByRole("switch", { name: "Mode malam" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(page.getByRole("switch", { name: "Mode malam" })).toHaveAttribute("aria-checked", "false");
  expect(await readTokens(page)).toEqual(DAY);
});

test("layout uses the locked fonts and language", async ({ page }) => {
  await page.goto("/");

  const fonts = await page.evaluate(() => {
    const html = window.getComputedStyle(document.documentElement);
    return {
      sans: html.fontFamily,
      serifVariable: html.getPropertyValue("--font-lora").trim(),
    };
  });

  expect(fonts.sans).toContain("Plus Jakarta Sans");
  expect(fonts.serifVariable).toContain("Lora");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
});
