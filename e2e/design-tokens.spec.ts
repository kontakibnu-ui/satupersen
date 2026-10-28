import { expect, test } from "@playwright/test";

// Expected values are the DESIGN.md §3 hex values converted to rgb by hand.
const themes = [
  {
    name: "light",
    colorScheme: "light" as const,
    background: "rgb(251, 248, 243)",
    text: "rgb(34, 30, 26)",
    primary: "rgb(46, 107, 79)",
    textMuted: "rgb(107, 99, 90)",
    control: "rgb(143, 133, 121)",
  },
  {
    name: "dark",
    colorScheme: "dark" as const,
    background: "rgb(22, 19, 15)",
    text: "rgb(241, 235, 226)",
    primary: "rgb(111, 191, 149)",
    textMuted: "rgb(168, 159, 146)",
    control: "rgb(122, 112, 100)",
  },
];

for (const theme of themes) {
  test(`system ${theme.name}: DESIGN.md tokens reach the page`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme.colorScheme });
    await page.goto("/");

    const body = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.body);
      return { background: styles.backgroundColor, text: styles.color };
    });

    expect(body.background).toBe(theme.background);
    expect(body.text).toBe(theme.text);

    const tokens = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--primary)";
      probe.style.color = "var(--text-muted)";
      probe.style.borderColor = "var(--control)";
      document.body.append(probe);

      const styles = window.getComputedStyle(probe);
      return {
        primary: styles.backgroundColor,
        textMuted: styles.color,
        control: styles.borderColor,
      };
    });

    expect(tokens.primary).toBe(theme.primary);
    expect(tokens.textMuted).toBe(theme.textMuted);
    expect(tokens.control).toBe(theme.control);
  });
}

test("manual light choice wins over a dark system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.evaluate(() => document.documentElement.classList.add("light"));

  const background = await page.evaluate(
    () => window.getComputedStyle(document.body).backgroundColor,
  );

  expect(background).toBe("rgb(251, 248, 243)");
});

test("manual dark choice wins over a light system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => document.documentElement.classList.add("dark"));

  const background = await page.evaluate(
    () => window.getComputedStyle(document.body).backgroundColor,
  );

  expect(background).toBe("rgb(22, 19, 15)");
});

test("layout uses the locked fonts and language", async ({ page }) => {
  await page.goto("/");

  const fonts = await page.evaluate(() => {
    const html = window.getComputedStyle(document.documentElement);
    return {
      sans: html.fontFamily,
      headingVariable: html.getPropertyValue("--font-newsreader").trim(),
    };
  });

  expect(fonts.sans).toContain("Plus Jakarta Sans");
  expect(fonts.headingVariable.length).toBeGreaterThan(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
});
