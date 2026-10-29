import { expect, test, type Page } from "@playwright/test";
import {
  colorSchemes,
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  expectTouchTargetsAtLeast44,
  viewports,
} from "./support/layout-checks";
import {
  createTestUser,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  seedEntry,
  seedSummary,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * DESIGN.md §13 checks for every signed in screen and state that exists, plus
 * the behaviour DESIGN.md §7 and DIARY-4 describe. Each state has its own test
 * user, seeded through the service role exactly as the server would write it,
 * so no AI call is made and no result is faked inside the app.
 */

type Scenario = { name: string; path: string; user: () => TestUser | undefined };

let writer: TestUser | undefined;
let summarised: TestUser | undefined;
let crisis: TestUser | undefined;
let newcomer: TestUser | undefined;
let stackUp = false;

const today = jakartaToday();
const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();

  if (!stackUp) {
    return;
  }

  writer = await createTestUser("writer", true);

  summarised = await createTestUser("summarised", true);
  await seedEntry(summarised, today, "Hari ini aku kelarin laporan dan jalan sore 20 menit.");
  await seedEntry(summarised, yesterday, "Kemarin aku belajar masak nasi goreng.");
  await seedSummary(summarised, today, {
    summary: "Kamu menyelesaikan laporan dan tetap meluangkan waktu untuk jalan sore.",
    strengths: ["Laporan yang tertunda akhirnya selesai", "Tetap bergerak walau sibuk"],
    improvements: ["Mulai kerja lebih pagi", "Catat target kecil sebelum mulai"],
    tomorrow_tip: "Tulis satu target kecil sebelum membuka laptop.",
    ai_dimension_score: 7,
    score: 78,
    delta_pct: null,
    score_reason: "Laporan selesai dan kamu tetap jalan sore 20 menit.",
    risk_flag: false,
    regen_count: 0,
  });

  crisis = await createTestUser("crisis", true);
  await seedEntry(crisis, today, "Hari yang berat.");
  await seedSummary(crisis, today, { risk_flag: true, regen_count: 0 });

  newcomer = await createTestUser("newcomer", false);
});

test.afterAll(async () => {
  await Promise.all([writer, summarised, crisis, newcomer].map(deleteTestUser));
});

const scenarios: Scenario[] = [
  { name: "today-writing", path: "/today", user: () => writer },
  { name: "today-result", path: "/today", user: () => summarised },
  { name: "today-crisis", path: "/today", user: () => crisis },
  { name: "settings", path: "/settings", user: () => writer },
  { name: "history", path: "/history", user: () => summarised },
  { name: "onboarding", path: "/onboarding", user: () => newcomer },
];

async function open(page: Page, scenario: Scenario): Promise<void> {
  const user = scenario.user();

  if (!user) {
    throw new Error(`No test user for ${scenario.name}`);
  }

  await signIn(page.context(), user);
  await page.goto(scenario.path);
  await expect(page).toHaveURL(new RegExp(scenario.path));

  // A layout check on the error screen would pass for the wrong page, so the
  // real screen must be the one that rendered.
  await expect(page.getByRole("heading", { name: "Halaman ini belum bisa ditampilkan" })).toHaveCount(0);
  await expect(page.getByRole("main")).toBeVisible();
}

for (const scenario of scenarios) {
  for (const viewport of viewports) {
    test(`${scenario.name} ${viewport.name}: fits and passes axe in light and dark`, async ({ page }) => {
      test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await open(page, scenario);

      for (const colorScheme of colorSchemes) {
        await page.emulateMedia({ colorScheme });
        await expectNoHorizontalScroll(page);
        await expectNoSeriousAxeViolations(page);
      }
    });
  }

  test(`${scenario.name} hp-360: interactive targets are at least 44x44`, async ({ page }) => {
    test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

    await page.setViewportSize({ width: 360, height: 640 });
    await open(page, scenario);
    await expectTouchTargetsAtLeast44(page);
  });
}

test("Hari Ini kosong: tombol tetap hidup dan menjelaskan, tanpa memanggil AI (AI-1, DESIGN §7)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  let aiCalls = 0;
  await page.route("**/api/ai/summarize", (route) => {
    aiCalls += 1;
    return route.abort();
  });

  await open(page, scenarios[0]);

  const button = page.getByRole("button", { name: "Rangkum hari ini" });
  await expect(button).toBeEnabled();
  await button.click();

  await expect(page.getByText("Tulis minimal satu kalimat dulu")).toBeVisible();
  expect(aiCalls).toBe(0);
});

test("Hari Ini hasil: skor di atas, tulisan dilipat, tanpa tombol primary (DESIGN §2, §7)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarios[1]);

  await expect(page.getByRole("img", { name: "Skor hari ini 78 dari 100" })).toBeVisible();
  await expect(page.getByText("Persen muncul setelah 3 hari menulis (0/3)")).toBeVisible();
  await expect(page.getByText("Laporan selesai dan kamu tetap jalan sore 20 menit.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rangkum hari ini" })).toHaveCount(0);

  await page.getByRole("button", { name: "Ubah tulisan" }).click();
  await expect(page.getByLabel("Tulisan hari ini")).toBeVisible();
});

test("Hari Ini krisis: teks tetap, tanpa skor, tombol telepon (DESIGN §9)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarios[2]);

  await expect(page.getByRole("img", { name: /Skor hari ini/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Telepon 119" })).toHaveAttribute("href", "tel:119");
  await expect(page.getByRole("link", { name: "Lanjut menulis" })).toBeVisible();
});

test("Riwayat: hari dengan entri bertanda dan entri lampau hanya bisa dibaca (DIARY-4)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarios[4]);

  // Today is selected by default and carries the entry mark.
  await expect(page.getByRole("link", { name: /hari ini, ada entri/ })).toHaveAttribute(
    "aria-current",
    "date",
  );

  // Yesterday is opened by URL, because on the 1st it sits in the previous month.
  await page.goto(`/history?month=${yesterday.slice(0, 7)}&day=${yesterday}`);
  await expect(page.getByText("Kemarin aku belajar masak nasi goreng.")).toBeVisible();
  await expect(page.getByText("Entri hari lampau hanya bisa dibaca.")).toBeVisible();
  await expect(page.getByLabel("Tulisan hari ini")).toHaveCount(0);

  // A day after today cannot be opened, even through the URL.
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/history?month=${tomorrow.slice(0, 7)}&day=${tomorrow}`);
  await expect(page.getByRole("link", { name: /hari ini, ada entri/ })).toBeVisible();
});
