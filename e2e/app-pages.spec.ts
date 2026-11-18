import { expect, test, type Page } from "@playwright/test";
import {
  applyColorScheme,
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
  seedBudget,
  seedEntry,
  seedExpense,
  seedHabit,
  seedHabitLog,
  seedMood,
  seedReport,
  seedScoreHistory,
  seedScoredDay,
  seedSummary,
  seedWhatsAppLink,
  setPlan,
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
let tracker: TestUser | undefined;
let progress: TestUser | undefined;
let progressPremium: TestUser | undefined;
let spender: TestUser | undefined;
let reporter: TestUser | undefined;
let chatter: TestUser | undefined;
// Each worker seeds its own number: a phone number is unique across all users.
const chatterPhone = `628${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}117890`;
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

  // A user with habits and mood, so Hari Ini and Kebiasaan are checked with content.
  tracker = await createTestUser("tracker", true);
  const exercise = await seedHabit(tracker, "Olahraga 15 menit", "Aku orang yang rutin bergerak");
  await seedHabit(tracker, "Baca sepuluh halaman");
  await seedHabitLog(tracker, exercise, today);
  await seedHabitLog(tracker, exercise, yesterday);
  await seedMood(tracker, today, 4, 3);

  // Forty scored days that rise by one point a day (offset 0 = today = 79), so the
  // averages, the percentages, and "sejak mulai" have known values.
  const dimensions = [
    { name: "habits", weight: 0.5, value: 80 },
    { name: "mood", weight: 0.5, value: 60 },
  ];
  progress = await createTestUser("progress", true);
  await seedScoreHistory(progress, today, (offset) => 79 - offset, 40, dimensions);
  progressPremium = await createTestUser("progress-premium", true);
  await seedScoreHistory(progressPremium, today, (offset) => 79 - offset, 40, dimensions);
  await setPlan(progressPremium, "premium");

  // Premium with a budget that today's spending already passes, so the
  // "Lewat ... dari budget" wording and a neutral bar are both on screen.
  spender = await createTestUser("spender", true);
  await setPlan(spender, "premium");
  await seedBudget(spender, `${today.slice(0, 7)}-01`, 100000);
  await seedExpense(spender, today, 85000, "makan", "makan siang bersama tim kantor di restoran");
  await seedExpense(spender, today, 40000, "transport");
  await seedExpense(spender, yesterday, 75000, "hiburan", "nonton");

  // Reports in every state the tick can leave a row in; only the finished ones may be drawn.
  reporter = await createTestUser("reporter", true);
  const finished = {
    status: "done",
    average_score: 74.4,
    scored_days: 7,
    period_days: 7,
    model: "disembunyikan-dari-layar",
  };
  await seedReport(reporter, "weekly", "2026-10-26", "2026-11-01", {
    ...finished,
    variant: "full",
    previous_average_score: 70,
    delta_pct: 6.3,
    trend: "Skormu naik pelan sepanjang minggu dan paling tinggi di akhir pekan.",
    patterns: ["Hari dengan olahraga pagi skornya lebih tinggi", "Malam yang cepat tidur diikuti pagi yang lebih fokus"],
    insights: ["Pengeluaran yang lebih besar muncul di hari mood rendah"],
    focus: "Pertahankan olahraga pagi sedikitnya tiga kali.",
  });
  await seedReport(reporter, "monthly", "2026-10-01", "2026-10-31", {
    ...finished,
    scored_days: 24,
    period_days: 31,
    variant: "full",
    previous_average_score: null,
    delta_pct: null,
    trend: "Oktober terasa lebih stabil daripada awalnya.",
    patterns: ["Minggu kedua paling berat", "Akhir bulan paling ringan"],
    insights: [],
    focus: "Mulai bulan dengan satu kebiasaan yang sama tiap pagi.",
  });
  await seedReport(reporter, "weekly", "2026-10-19", "2026-10-25", { status: "pending", attempts: 0 });
  await seedReport(reporter, "weekly", "2026-10-12", "2026-10-18", { status: "failed", attempts: 3 });
  await seedReport(reporter, "weekly", "2026-10-05", "2026-10-11", { status: "skipped", reason: "too_few_scored_days" });

  chatter = await createTestUser("chatter", true);
  await seedWhatsAppLink(chatter, chatterPhone);
});

test.afterAll(async () => {
  await Promise.all([writer, summarised, crisis, newcomer, tracker, progress, progressPremium, spender, reporter, chatter].map(deleteTestUser));
});

const scenarios: Scenario[] = [
  { name: "today-writing", path: "/today", user: () => writer },
  { name: "today-result", path: "/today", user: () => summarised },
  { name: "today-crisis", path: "/today", user: () => crisis },
  { name: "today-tracker", path: "/today", user: () => tracker },
  { name: "habits", path: "/habits", user: () => tracker },
  { name: "habits-empty", path: "/habits", user: () => writer },
  { name: "expenses", path: "/expenses", user: () => spender },
  { name: "expenses-empty", path: "/expenses", user: () => writer },
  { name: "reports", path: "/reports", user: () => reporter },
  { name: "reports-empty", path: "/reports", user: () => writer },
  { name: "dashboard-7", path: "/dashboard", user: () => progress },
  { name: "dashboard-30", path: "/dashboard?periode=30", user: () => progress },
  { name: "dashboard-1-tahun-terkunci", path: "/dashboard?periode=365", user: () => progress },
  { name: "dashboard-1-tahun-premium", path: "/dashboard?periode=365", user: () => progressPremium },
  { name: "dashboard-kosong", path: "/dashboard", user: () => writer },
  { name: "settings", path: "/settings", user: () => writer },
  { name: "whatsapp-terhubung", path: "/settings/whatsapp", user: () => chatter },
  { name: "whatsapp-belum-dikonfigurasi", path: "/settings/whatsapp", user: () => writer },
  { name: "history", path: "/history", user: () => summarised },
  { name: "onboarding", path: "/onboarding", user: () => newcomer },
];

function scenarioNamed(name: string): Scenario {
  const found = scenarios.find((scenario) => scenario.name === name);

  if (!found) {
    throw new Error(`No scenario named ${name}`);
  }

  return found;
}

async function open(page: Page, scenario: Scenario): Promise<void> {
  const user = scenario.user();

  if (!user) {
    throw new Error(`No test user for ${scenario.name}`);
  }

  await signIn(page.context(), user);
  await page.goto(scenario.path);
  // The path may hold a query string, whose "?" is not a regex operator here.
  await expect(page).toHaveURL(new RegExp(scenario.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  // A layout check on the error screen would pass for the wrong page, so the
  // real screen must be the one that rendered.
  await expect(page.getByRole("heading", { name: "Halaman ini belum bisa ditampilkan" })).toHaveCount(0);
  await expect(page.getByRole("main")).toBeVisible();
  // The loading skeleton is a <main> too, and the real screen streams in after
  // it; checks run on the screen itself, not on the skeleton.
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
}

for (const scenario of scenarios) {
  for (const viewport of viewports) {
    test(`${scenario.name} ${viewport.name}: fits and passes axe in light and dark`, async ({ page }) => {
      test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await open(page, scenario);

      for (const colorScheme of colorSchemes) {
        await applyColorScheme(page, colorScheme);
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

  const button = page.getByRole("button", { name: "Analisa hari ini" });
  await expect(button).toBeEnabled();
  await button.click();

  await expect(page.getByText("Tulis minimal satu kalimat dulu")).toBeVisible();
  expect(aiCalls).toBe(0);
});

test("Analisa hari ini: ketukan keenam dalam semenit ditahan rate limit dengan pesan menunggu (RATE-1, RATE-3)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await createTestUser("rate-limit", true);

  try {
    await signIn(page.context(), user);
    await page.goto("/today");

    // The diary is empty, so the allowed taps stop with 400 before any model
    // call. Eleven taps span at most two one minute windows, so one window
    // holds a sixth tap whatever the clock does.
    const statuses: number[] = [];
    let limited: { retryAfter: string | undefined; message: string | undefined } | null = null;

    for (let tap = 0; tap < 11 && limited === null; tap += 1) {
      const response = await page.request.post("/api/ai/summarize", { data: { date: today } });
      statuses.push(response.status());

      if (response.status() === 429) {
        limited = { retryAfter: response.headers()["retry-after"], message: ((await response.json()) as { message?: string }).message };
      }
    }

    // Normal use is untouched: at least five taps go through first.
    expect(statuses.indexOf(429)).toBeGreaterThanOrEqual(5);
    expect(statuses.filter((status) => status !== 429).every((status) => status === 400)).toBe(true);
    expect(limited?.retryAfter).toMatch(/^\d+$/);
    expect(limited?.message).toMatch(/^Tunggu sebentar ya, kamu bisa coba lagi dalam \d+ detik\.$/);
  } finally {
    await deleteTestUser(user);
  }
});

test("Hari Ini menulis: tulisan di layar pertama, pemantik bisa diganti, bar menulis di HP (DIARY-1, DESIGN §5, §6)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, scenarios[0]);

  // The writing sheet comes first: before mood and energy, and on the first screen.
  const editor = page.getByLabel("Tulisan hari ini");
  const editorBox = await editor.boundingBox();
  const moodBox = await page.getByRole("radiogroup", { name: "Mood" }).boundingBox();
  expect(editorBox && moodBox, "editor and mood are laid out").toBeTruthy();
  expect(editorBox!.y, "editor before mood").toBeLessThan(moodBox!.y);
  expect(editorBox!.y, "editor starts on the first screen").toBeLessThan(640 - 120);

  // The cue describes the editor and moves on without touching the text.
  const cue = page.locator("#entry-cue");
  await expect(editor).toHaveAttribute("aria-describedby", "entry-cue");
  const firstCue = (await cue.textContent()) ?? "";
  await page.getByRole("button", { name: "Pertanyaan lain" }).click();
  await expect(cue).not.toHaveText(firstCue);
  await expect(editor).toHaveValue("");

  // Writing mode: the bottom navigation hides, the bar shows "Selesai", and leaving brings it back.
  await editor.click();
  await expect(page.locator("[data-app-nav]")).toBeHidden();
  const done = page.getByRole("button", { name: "Selesai" });
  await expect(done).toBeVisible();
  await expect(page.getByText("Tersimpan otomatis")).toBeVisible();
  await done.click();
  await expect(done).toHaveCount(0);
  await expect(page.locator("[data-app-nav]")).toBeVisible();
});

test("Hari Ini hasil: skor di atas, tulisan dilipat, tanpa tombol primary (DESIGN §2, §7)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarios[1]);

  // DESIGN §6 "Judul hasil": the analysis says plainly that it is one.
  await expect(page.getByRole("region", { name: "Analisa hari ini" })).toBeVisible();
  // SCORE-2: no earlier scored day, so the first analysis is explained and the score never shows as "78".
  await expect(page.getByText("Ini analisa pertamamu. Mulai besok kamu bisa lihat perbandingannya.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Analisa hari ini" })).not.toContainText("78");
  await expect(page.getByRole("region", { name: "Analisa hari ini" })).not.toContainText("dari 100");
  await expect(page.getByText("Laporan selesai dan kamu tetap jalan sore 20 menit.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analisa hari ini" })).toHaveCount(0);

  await page.getByRole("button", { name: "Ubah tulisan" }).click();
  await expect(page.getByLabel("Tulisan hari ini")).toBeVisible();
});

test("Hari Ini hasil: dibanding hari berskor terakhir dalam poin, tanpa angka skor (SCORE-2)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await createTestUser("compared", true);

  try {
    // Yesterday 76, today 78: 2 points, not the 2.6% a ratio would give.
    await seedScoredDay(user, yesterday, 76);
    await seedEntry(user, today, "Hari ini aku kelarin laporan.");
    await seedScoredDay(user, today, 78);

    await signIn(page.context(), user);
    await page.goto("/today");

    const analysis = page.getByRole("region", { name: "Analisa hari ini" });
    await expect(analysis).toContainText("Kamu 2% lebih baik dibanding kemarin");
    await expect(analysis).not.toContainText("78");
    await expect(analysis).not.toContainText("dari 100");
  } finally {
    await deleteTestUser(user);
  }
});

test("Hari Ini krisis: teks tetap, tanpa skor, tombol telepon (DESIGN §9)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarios[2]);

  await expect(page.getByText(/lebih baik dibanding|analisa pertamamu/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Telepon 119" })).toHaveAttribute("href", "tel:119");
  await expect(page.getByRole("link", { name: "Lanjut menulis" })).toBeVisible();
});

test("Riwayat: hari dengan entri bertanda dan entri lampau hanya bisa dibaca (DIARY-4)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("history"));

  // Today is selected by default and carries the entry mark.
  await expect(page.getByRole("link", { name: /hari ini, ada entri/ })).toHaveAttribute(
    "aria-current",
    "date",
  );
  // Choosing a day jumps to the reading sheet under the calendar (DESIGN §6).
  await expect(page.getByRole("link", { name: /hari ini, ada entri/ })).toHaveAttribute("href", /#entri$/);
  await expect(page.locator("#entri")).toBeVisible();

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

test("Progres: rata-rata, persen, sejak mulai, grafik, dan batang dimensi dari data sungguhan (DASH-1, DASH-2)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("dashboard-7"));

  // Last 7 days score 73 to 79 (mean 76); the 7 before score 66 to 72 (mean 69).
  await expect(page.getByRole("region", { name: "Ringkasan progres" }).locator("p").first()).toHaveText("76");
  await expect(page.getByText("rata-rata 7 hari, 10,1% di atas 7 hari sebelumnya")).toBeVisible();
  // First 7 scored days average 43, the latest 7 average 76.
  await expect(page.getByText("Sejak mulai: 76,7% lebih baik")).toBeVisible();

  const dimensions = page.getByRole("list", { name: "Skor per bagian" });
  await expect(dimensions).toContainText("Kebiasaan");
  await expect(dimensions).toContainText("80");
  await expect(dimensions).toContainText("Mood dan energi");

  // The chart is drawn, and its line uses the primary token, not a colour of its own.
  const line = page.locator(".recharts-line-curve");
  await expect(line).toBeVisible();
  const stroke = await line.evaluate((element) => getComputedStyle(element).stroke);
  const primary = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect(stroke).toBe(primary);

  await expect(page.getByRole("main").getByRole("link", { name: /Riwayat/ })).toHaveAttribute("href", "/history");
  await expect(page.getByRole("link", { name: "7 hari" })).toHaveAttribute("aria-current", "page");
});

test("Progres: 1 tahun terkunci untuk paket gratis dan tidak membaca datanya, terbuka untuk premium (DASH-2, SUB-1)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("dashboard-1-tahun-terkunci"));
  await expect(page.getByText("Riwayat 1 tahun ada di Premium.")).toBeVisible();
  await expect(page.locator(".recharts-surface")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Skor per bagian" })).toHaveCount(0);

  await open(page, scenarioNamed("dashboard-1-tahun-premium"));
  await expect(page.locator(".recharts-line-curve")).toBeVisible();
  await expect(page.getByText("rata-rata 1 tahun")).toBeVisible();
  await expect(page.getByRole("table", { name: /Grafik skor 1 tahun/ })).toBeAttached();
});

test("Progres kosong: pesan yang mengajak menulis, tanpa angka palsu (DASH-3)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("dashboard-kosong"));
  await expect(page.getByText("Belum ada skor di 7 hari terakhir.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mulai menulis" })).toHaveAttribute("href", "/today");
  await expect(page.locator(".recharts-surface")).toHaveCount(0);
});

test("Laporan: hanya laporan yang selesai tampil, lengkap dengan pola dan fokus, tanpa detail internal (REPORT-3)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("reports"));

  const weekly = page.getByRole("region", { name: "Laporan mingguan 26 Okt – 1 Nov 2026" });
  await expect(weekly).toBeVisible();
  await expect(weekly).toContainText("rata-rata 74, 6,3% di atas minggu sebelumnya");
  await expect(weekly).toContainText("Skormu naik pelan sepanjang minggu");
  await expect(weekly).toContainText("Hari dengan olahraga pagi skornya lebih tinggi");
  await expect(weekly).toContainText("Kaitan antar bagian");
  await expect(weekly).toContainText("Pertahankan olahraga pagi sedikitnya tiga kali.");

  // The newest report is open on its sheet; an older one opens from its row (DESIGN §14).
  await page.getByText("Oktober 2026", { exact: true }).click();
  const monthly = page.getByRole("region", { name: "Laporan bulanan Oktober 2026" });
  await expect(monthly).toContainText("Oktober terasa lebih stabil");
  // No insights were written for the month, so the heading for them is not drawn either.
  await expect(monthly).not.toContainText("Kaitan antar bagian");

  // Pending, failed, and skipped rows are not reports yet.
  await expect(page.getByRole("region")).toHaveCount(2);
  await expect(page.getByText("disembunyikan-dari-layar")).toHaveCount(0);
});

test("Laporan kosong: pesan yang menjelaskan kapan laporan muncul, tanpa data palsu (REPORT-1)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("reports-empty"));
  await expect(page.getByText("Belum ada laporan. Laporan mingguan muncul tiap Senin pagi")).toBeVisible();
  await expect(page.getByRole("region")).toHaveCount(0);
});

test("Progres bertab Grafik, Riwayat, dan Laporan (DESIGN §5, §6)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("dashboard-7"));
  const tabs = page.getByRole("navigation", { name: "Bagian Progres" });
  await expect(tabs.getByRole("link", { name: "Grafik" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Laporan" })).toHaveAttribute("href", "/reports");
  await expect(tabs.getByRole("link", { name: "Riwayat" })).toHaveAttribute("href", "/history");
});

test("Header: profil di pojok kanan atas membuka Akun, dan Belajar ada di navigasi (DESIGN §5)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page, scenarioNamed("dashboard-7"));

    const profile = page.getByRole("banner").getByRole("link", { name: "Akun" });
    await expect(profile).toHaveAttribute("href", "/settings");
    // The header is centred at 1120 px on wide screens, so "right" means the
    // right end of the header, after the day and night switch.
    const box = await profile.boundingBox();
    const header = await page.getByRole("banner").boundingBox();
    const toggle = await page.getByRole("banner").getByRole("switch", { name: "Mode malam" }).boundingBox();
    expect(box && header && toggle, "header parts are laid out").toBeTruthy();
    expect(header!.x + header!.width - (box!.x + box!.width), "profile ends the header row").toBeLessThanOrEqual(24);
    expect(box!.x, "profile comes after the switch").toBeGreaterThan(toggle!.x);
    expect(box!.y, "profile sits at the top").toBeLessThan(80);

    await expect(page.getByRole("banner").getByRole("switch", { name: "Mode malam" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigasi utama" }).filter({ visible: true }).getByRole("link", { name: "Belajar" }),
    ).toHaveAttribute("href", "/learn");
  }
});

test("WhatsApp terhubung: hanya empat digit terakhir tampil, dan pilihan balasan otomatis tersimpan (PRD §6)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("whatsapp-terhubung"));
  await expect(page.getByText("Terhubung ke nomor berakhiran 7890.")).toBeVisible();
  await expect(page.getByText(chatterPhone)).toHaveCount(0);

  const toggle = page.getByRole("switch", { name: "Balas ceritaku secara otomatis" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("switch", { name: "Balas ceritaku secara otomatis" })).not.toBeChecked({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
});

test("WhatsApp belum dikonfigurasi: user diberi tahu dengan jelas, tanpa tombol yang tidak bisa jalan", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("whatsapp-belum-dikonfigurasi"));
  await expect(page.getByText("WhatsApp belum dikonfigurasi di server ini")).toBeVisible();
  await expect(page.getByRole("button", { name: "Buat kode" })).toHaveCount(0);
});

test("Akun menautkan ke pengaturan WhatsApp", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("settings"));
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "/settings/whatsapp");
});

test("Akun: pilihan timezone menampilkan zona yang tersimpan, bukan zona pertama di daftar (AUTH-3)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("settings"));
  // The full list arrives after hydration; the saved zone must still be the one selected.
  await expect(page.getByLabel("Timezone")).toHaveValue("Asia/Jakarta");
  await expect(page.locator("#timezone option")).not.toHaveCount(1);
  await expect(page.getByLabel("Timezone")).toHaveValue("Asia/Jakarta");
});
