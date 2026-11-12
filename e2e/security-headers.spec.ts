import { expect, test } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  seedHabit,
  seedScoreHistory,
  signIn,
} from "./support/test-users";

/**
 * The security headers (TASKS.md 6.5, PRD.md §7 point 6) and proof that the
 * policy does not break a single screen: every page is opened with a listener
 * for policy violations, and any blocked script, style, font, image, or request
 * fails the test. Against `next dev` the policy also allows eval and a websocket
 * for hot reload; Strict-Transport-Security appears only in production.
 */

const PUBLIC_PATHS = ["/", "/login", "/privacy", "/terms"];
const APP_PATHS = [
  "/today",
  "/habits",
  "/expenses",
  "/dashboard?periode=30",
  "/reports",
  "/history",
  "/settings",
  "/settings/whatsapp",
];

test("header keamanan ada di setiap jawaban halaman dan API (PRD §7)", async ({ request }) => {
  for (const path of [...PUBLIC_PATHS, "/api/cron/tick"]) {
    const response = path.startsWith("/api") ? await request.post(path) : await request.get(path);
    const headers = response.headers();

    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toContain("camera=()");

    const policy = headers["content-security-policy"];
    expect(policy, path).toContain("default-src 'self'");
    expect(policy, path).toContain("frame-ancestors 'none'");
    expect(policy, path).toContain("object-src 'none'");
    expect(policy, path).toContain("base-uri 'self'");
    // Nothing outside this app and the Supabase project may serve a script.
    expect(policy.match(/script-src[^;]*/)?.[0], path).not.toMatch(/https?:/);
  }
});

test("source map tidak disajikan untuk bundel klien (hanya build produksi)", async ({ request, page }) => {
  // `next dev` ships development bundles, which carry source map references by
  // design; its policy is the one that allows eval, so that tells the two apart.
  const policy = (await request.get("/")).headers()["content-security-policy"] ?? "";
  test.skip(policy.includes("'unsafe-eval'"), "Server dev: bundel pengembangan memang memuat referensi source map");

  await page.goto("/");

  const scripts = await page.locator("script[src]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("src")).filter((src): src is string => Boolean(src)),
  );

  expect(scripts.length).toBeGreaterThan(0);

  for (const src of scripts.slice(0, 5)) {
    const body = await (await request.get(src)).text();
    expect(body, src).not.toMatch(/sourceMappingURL=/);
  }
});

test("kebijakan tidak memblokir satu pun halaman: tanpa pelanggaran CSP", async ({ page }) => {
  test.skip(!(await localStackIsRunning()), "Supabase lokal belum jalan (npx supabase start)");
  test.setTimeout(180_000);

  const violations: string[] = [];

  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __violations: string[] }).__violations = [
        ...((window as unknown as { __violations?: string[] }).__violations ?? []),
        `${event.violatedDirective} ${event.blockedURI}`,
      ];
    });
  });
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) {
      violations.push(message.text().slice(0, 160));
    }
  });

  const visit = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const found = await page.evaluate(() => (window as unknown as { __violations?: string[] }).__violations ?? []);
    violations.push(...found.map((entry) => `${path}: ${entry}`));
  };

  for (const path of PUBLIC_PATHS) {
    await visit(path);
  }

  const user = await createTestUser("csp", true);

  try {
    const today = jakartaToday();
    await seedHabit(user, "Olahraga");
    await seedScoreHistory(user, today, (offset) => 70 - offset, 20);
    await signIn(page.context(), user);

    for (const path of APP_PATHS) {
      await visit(path);
    }

    // The chart, the sheet, and a server action all run under the policy too.
    await page.goto("/dashboard?periode=30");
    await expect(page.locator(".recharts-line-curve")).toBeVisible();
    await page.goto("/habits");
    await page.getByRole("button", { name: "Tambah kebiasaan" }).click();
    await expect(page.getByLabel("Nama kebiasaan")).toBeVisible();
  } finally {
    await deleteTestUser(user);
  }

  expect(violations).toEqual([]);
});
