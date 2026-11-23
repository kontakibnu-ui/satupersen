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
  daysBefore,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  readRows,
  seedStudyCheck,
  seedStudyMaterial,
  seedStudyQuestion,
  seedStudyReview,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Belajar (PRD.md LEARN-1 to LEARN-9) and the new navigation (DESIGN.md §5).
 * Every state is seeded through the service role the way the server writes it.
 * No test here reaches the model: where a check could run, the day's quota is
 * already used, so the path is the one a user at the limit takes. The full flow
 * with the real model is run separately and recorded in TASKS.md.
 */

const today = jakartaToday();
const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

const SOURCE =
  "Fotosintesis adalah proses tumbuhan membuat makanan. Tumbuhan memakai cahaya matahari, air, dan karbon dioksida. Hasilnya glukosa dan oksigen. Proses ini terjadi di kloroplas yang berisi klorofil, zat hijau daun.";
const FEEDBACK = {
  summary: "Kamu sudah menangkap bahwa tumbuhan memakai cahaya untuk membuat makanan.",
  correct: ["Tumbuhan memakai cahaya matahari"],
  missing: ["Air dan karbon dioksida sebagai bahan", "Hasilnya glukosa dan oksigen"],
  wrong: [],
  not_in_material: ["Fotosintesis terjadi di akar"],
  language: "id",
};

let empty: TestUser | undefined;
let lister: TestUser | undefined;
let drafter: TestUser | undefined;
let reviewer: TestUser | undefined;
let reviewed: TestUser | undefined;
let waiter: TestUser | undefined;
let stackUp = false;

const ids: Record<string, string> = {};

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();

  if (!stackUp) {
    return;
  }

  empty = await createTestUser("learn-empty", true);

  // Premium with three materials: one due today, one waiting, one draft.
  lister = await createTestUser("learn-list", true);
  await setPlan(lister, "premium");
  const dueMaterial = await seedStudyMaterial(lister, { title: "Fotosintesis", source: SOURCE, active: true, feedback: FEEDBACK });
  await seedStudyQuestion(lister, dueMaterial, { position: 1, prompt: "Apa hasil fotosintesis?", answer: "Glukosa dan oksigen.", dueDate: today });
  const waitingMaterial = await seedStudyMaterial(lister, { title: "Hukum Newton", source: "Benda diam tetap diam.", active: true });
  await seedStudyQuestion(lister, waitingMaterial, { position: 1, prompt: "Apa hukum pertama?", answer: "Benda diam tetap diam.", dueDate: tomorrow });
  await seedStudyMaterial(lister, { title: "Sel hewan", source: "Sel hewan tidak punya dinding sel." });

  // Free, with its one material still a draft and today's one check already used.
  drafter = await createTestUser("learn-draft", true);
  ids.draft = await seedStudyMaterial(drafter, { title: "Fotosintesis", source: SOURCE });
  await seedStudyCheck(drafter, ids.draft, today, "explanation");

  // Free, two questions due today, the day's check already used.
  reviewer = await createTestUser("learn-review", true);
  ids.review = await seedStudyMaterial(reviewer, { title: "Fotosintesis", source: SOURCE, active: true, feedback: FEEDBACK });
  ids.reviewQ1 = await seedStudyQuestion(reviewer, ids.review, {
    position: 1,
    prompt: "Apa bahan yang dipakai tumbuhan untuk fotosintesis?",
    answer: "Cahaya matahari, air, dan karbon dioksida.",
    step: 1,
    dueDate: today,
  });
  ids.reviewQ2 = await seedStudyQuestion(reviewer, ids.review, {
    position: 2,
    prompt: "Kenapa daun berwarna hijau?",
    answer: "Karena kloroplas berisi klorofil, zat hijau daun.",
    kind: "elaboration",
    step: 0,
    dueDate: daysBefore(today, 2),
  });
  await seedStudyCheck(reviewer, ids.review, today);

  // Reviewed today, one answer with AI feedback and one without.
  reviewed = await createTestUser("learn-reviewed", true);
  ids.reviewed = await seedStudyMaterial(reviewed, { title: "Fotosintesis", source: SOURCE, active: true, feedback: FEEDBACK });
  const doneQ1 = await seedStudyQuestion(reviewed, ids.reviewed, { position: 1, prompt: "Apa hasil fotosintesis?", answer: "Glukosa dan oksigen.", step: 2, dueDate: daysBefore(today, -7) });
  const doneQ2 = await seedStudyQuestion(reviewed, ids.reviewed, { position: 2, prompt: "Di mana fotosintesis terjadi?", answer: "Di kloroplas.", step: 0, dueDate: tomorrow });
  await seedStudyReview(reviewed, ids.reviewed, doneQ1, { reviewedOn: today, answer: "Glukosa dan oksigen", rating: "remembered", feedback: "Tepat, kedua hasilnya sudah kamu sebut." });
  await seedStudyReview(reviewed, ids.reviewed, doneQ2, { reviewedOn: today, answer: "", rating: "forgot" });
  await seedStudyCheck(reviewed, ids.reviewed, today);

  // Waiting for the next review, with the explanation feedback on screen.
  waiter = await createTestUser("learn-waiting", true);
  ids.waiting = await seedStudyMaterial(waiter, { title: "Fotosintesis", source: SOURCE, active: true, explanation: "Tumbuhan bikin makanan dari cahaya.", feedback: FEEDBACK });
  await seedStudyQuestion(waiter, ids.waiting, { position: 1, prompt: "Apa hasil fotosintesis?", answer: "Glukosa dan oksigen.", dueDate: tomorrow });
  await seedStudyQuestion(waiter, ids.waiting, { position: 2, prompt: "Kenapa tumbuhan butuh cahaya?", answer: "Cahaya dipakai untuk membuat glukosa.", kind: "elaboration", dueDate: daysBefore(today, -3) });
});

test.afterAll(async () => {
  await Promise.all([empty, lister, drafter, reviewer, reviewed, waiter].map(deleteTestUser));
});

type Scenario = { name: string; path: () => string; user: () => TestUser | undefined };

const scenarios: Scenario[] = [
  { name: "learn-kosong", path: () => "/learn", user: () => empty },
  { name: "learn-daftar", path: () => "/learn", user: () => lister },
  { name: "learn-baru", path: () => "/learn/new", user: () => empty },
  { name: "learn-draf", path: () => `/learn/${ids.draft}`, user: () => drafter },
  { name: "learn-review", path: () => `/learn/${ids.review}`, user: () => reviewer },
  { name: "learn-sudah-review", path: () => `/learn/${ids.reviewed}`, user: () => reviewed },
  { name: "learn-menunggu", path: () => `/learn/${ids.waiting}`, user: () => waiter },
  { name: "learn-ubah-bahan", path: () => `/learn/${ids.draft}/edit`, user: () => drafter },
];

async function open(page: Page, scenario: Scenario): Promise<void> {
  const user = scenario.user();

  if (!user) {
    throw new Error(`No test user for ${scenario.name}`);
  }

  await signIn(page.context(), user);
  await page.goto(scenario.path());
  await expect(page.getByRole("heading", { name: "Halaman ini belum bisa dibuka" })).toHaveCount(0);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
}

const scenarioNamed = (name: string): Scenario => {
  const found = scenarios.find((scenario) => scenario.name === name);

  if (!found) {
    throw new Error(`No scenario named ${name}`);
  }

  return found;
};

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

test("Belajar kosong: tiga langkah dan satu tombol primary Tambah materi (LEARN-1, DESIGN §6)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("learn-kosong"));
  await expect(page.getByRole("heading", { name: "Belajar", level: 1 })).toBeVisible();
  await expect(page.getByText("Jawab pertanyaan review dengan jarak yang makin panjang: 1, 3, 7, 14, lalu 30 hari.")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Tambah materi" })).toHaveAttribute("href", "/learn/new");
});

test("Belajar daftar: review hari ini di atas, status tiap materi, dan titik penanda di navigasi (LEARN-1, LEARN-9)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await page.setViewportSize({ width: 360, height: 800 });
  await open(page, scenarioNamed("learn-daftar"));

  const due = page.getByRole("region", { name: "Review hari ini" });
  await expect(due.getByRole("link", { name: /Fotosintesis/ })).toContainText("1 pertanyaan menunggu hari ini");
  await expect(due.getByRole("link", { name: /Hukum Newton/ })).toHaveCount(0);

  const all = page.getByRole("region", { name: "Materimu" });
  await expect(all.getByRole("link", { name: /Hukum Newton/ })).toContainText("Review berikutnya besok");
  await expect(all.getByRole("link", { name: /Sel hewan/ })).toContainText("Belum diperiksa");

  // Premium may add more, so it is a quiet link, not the plan note.
  await expect(page.getByRole("main").getByRole("link", { name: "Tambah materi" })).toBeVisible();

  const learnLink = page.locator("[data-app-nav]").getByRole("link", { name: /Belajar/ });
  await expect(learnLink).toHaveAttribute("aria-current", "page");
  await expect(learnLink).toContainText("ada review hari ini");
});

test("Belajar free: satu materi dibuat lewat form, lalu slotnya habis walau materinya dihapus (LEARN-1, LEARN-5, LEARN-8)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  const user = await createTestUser("learn-create", true);

  try {
    await signIn(page.context(), user);
    await page.goto("/learn/new");

    // Both fields are required, and the server is not asked when one is empty.
    await page.getByRole("button", { name: "Simpan materi" }).click();
    await expect(page.getByText("Beri judul materinya dulu.")).toBeVisible();

    await page.getByLabel("Judul").fill("Fotosintesis");
    await page.getByLabel("Bahan", { exact: true }).fill(SOURCE);
    await page.getByRole("button", { name: "Simpan materi" }).click();

    await expect(page).toHaveURL(/\/learn\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Fotosintesis", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jelaskan dengan kata sendiri" })).toBeVisible();
    await expect(page.getByText("Sisa pemeriksaan AI hari ini: 1")).toBeVisible();

    await page.goto("/learn");
    await expect(page.getByRole("region", { name: "Materimu" })).toContainText("Belum diperiksa");
    await expect(page.getByText("Paket gratis memuat 1 materi. Materi tanpa batas ada di Premium.")).toBeVisible();

    await page.goto("/learn/new");
    await expect(page.getByText("Paket gratis memuat 1 materi, dan kamu sudah memakainya.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Simpan materi" })).toHaveCount(0);

    // Deleting warns that the slot does not come back, and it does not.
    const [material] = await readRows<{ id: string }>("study_materials", `select=id&user_id=eq.${user.id}`);
    await page.goto(`/learn/${material.id}`);
    await page.getByRole("button", { name: "Hapus materi" }).click();
    await expect(page.getByText("Paket gratis hanya bisa membuat 1 materi, jadi setelah dihapus kamu tidak bisa menambah materi baru.")).toBeVisible();
    await page.getByRole("button", { name: "Ya, hapus" }).click();

    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByText("Paket gratis memuat 1 materi. Materi tanpa batas ada di Premium.")).toBeVisible();
    expect(await readRows("study_materials", `select=id&user_id=eq.${user.id}`)).toEqual([]);
  } finally {
    await deleteTestUser(user);
  }
});

test("Belajar draf: kuota habis menyimpan penjelasan tanpa memanggil AI, dan bahan bisa dibuka (LEARN-2, LEARN-5)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("learn-draf"));

  // The material is closed by default.
  await expect(page.getByText("Proses ini terjadi di kloroplas")).toBeHidden();
  await page.locator("summary", { hasText: "Lihat bahan" }).click();
  await expect(page.getByText("Proses ini terjadi di kloroplas", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ubah bahan" })).toHaveAttribute("href", `/learn/${ids.draft}/edit`);

  await expect(page.getByText("Pemeriksaan AI hari ini sudah terpakai.", { exact: false })).toBeVisible();
  await page.getByLabel("Penjelasanmu").fill("Tumbuhan membuat makanan memakai cahaya matahari.");
  await page.getByRole("button", { name: "Periksa penjelasan" }).click();
  await expect(page.getByText("Paket gratis mendapat 1x sehari, besok bisa lagi.", { exact: false })).toBeVisible();

  const [material] = await readRows<{ explanation: string; status: string; feedback: unknown }>(
    "study_materials",
    `select=explanation,status,feedback&id=eq.${ids.draft}`,
  );
  expect(material).toEqual({
    explanation: "Tumbuhan membuat makanan memakai cahaya matahari.",
    status: "draft",
    feedback: null,
  });
  expect(await readRows("study_checks", `select=id&user_id=eq.${drafter!.id}`)).toHaveLength(1);
});

test("Belajar review: satu kartu per pertanyaan, jawab dulu, lihat jawaban, nilai sendiri, lalu jadwal bergeser (LEARN-3, LEARN-4)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("learn-review"));

  const session = page.getByRole("region", { name: "Review hari ini" });
  // One question at a time (DESIGN.md §15.8), retrieval first: the answer from
  // the material is not on screen yet.
  await expect(session.getByText("1 dari 2")).toBeVisible();
  await expect(session.getByText("Menurut bahan")).toHaveCount(0);

  await session.getByLabel("Jawabanmu").fill("Cahaya matahari dan air");
  await session.getByRole("button", { name: "Lihat jawaban" }).click();
  await expect(session.getByText("Menurut bahan")).toHaveCount(1);
  await expect(session.getByText("Cahaya matahari, air, dan karbon dioksida.")).toBeVisible();

  // Every question needs the user's own rating before going on.
  await session.getByRole("button", { name: "Lanjut ke pertanyaan 2" }).click();
  await expect(session.getByText("Pilih dulu: Lupa, Ragu, atau Ingat.")).toBeVisible();
  await session.getByRole("group", { name: "Seberapa ingat?" }).getByText("Ingat", { exact: true }).click();
  await session.getByRole("button", { name: "Lanjut ke pertanyaan 2" }).click();

  await expect(session.getByText("2 dari 2")).toBeVisible();
  await expect(session.getByText("Hubungkan dengan pemahamanmu")).toBeVisible();
  await session.getByRole("button", { name: "Lihat jawaban" }).click();
  await expect(session.getByText("Kamu tidak menulis jawaban.")).toBeVisible();
  await session.getByRole("group", { name: "Seberapa ingat?" }).getByText("Lupa", { exact: true }).click();
  await session.getByRole("button", { name: "Simpan review" }).click();

  const done = page.getByRole("region", { name: "Review hari ini selesai" });
  await expect(done).toBeVisible();
  // Remembered at step 1 moves to the 7 day gap; forgotten goes back to tomorrow.
  await expect(done).toContainText("Kamu menilai: Ingat.");
  await expect(done).toContainText("Kamu menilai: Lupa. Muncul lagi besok.");
  // No check is left today, so no AI call was made and the reason is shown.
  await expect(done).toContainText("Pemeriksaan AI hari ini sudah terpakai.");
  // The summary on top (DESIGN.md §15.8) and the way back when nothing else waits.
  await expect(done).toContainText("Muncul lagi");
  await expect(page.getByRole("link", { name: "Kembali ke Belajar" })).toBeVisible();

  const questions = await readRows<{ id: string; step: number; due_date: string }>(
    "study_questions",
    `select=id,step,due_date&material_id=eq.${ids.review}&order=position`,
  );
  expect(questions).toEqual([
    { id: ids.reviewQ1, step: 2, due_date: daysBefore(today, -7) },
    { id: ids.reviewQ2, step: 0, due_date: tomorrow },
  ]);

  const reviews = await readRows<{ answer: string; rating: string; feedback: string | null }>(
    "study_reviews",
    `select=answer,rating,feedback&material_id=eq.${ids.review}&order=id`,
  );
  expect(reviews).toEqual([
    { answer: "Cahaya matahari dan air", rating: "remembered", feedback: null },
    { answer: "", rating: "forgot", feedback: null },
  ]);
});

test("Belajar sudah review: hasil tersimpan dengan umpan balik AI berlabel, tanpa sesi baru (LEARN-4, LEARN-6)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("learn-sudah-review"));

  const done = page.getByRole("region", { name: "Review hari ini selesai" });
  await expect(done).toContainText("Tepat, kedua hasilnya sudah kamu sebut.");
  await expect(done.getByText("Diperiksa AI dari bahanmu")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Lihat jawaban" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Umpan balik penjelasan" })).toContainText("Tidak ada di bahanmu");
});

test("Belajar menunggu: umpan balik penjelasan, tanggal review, jelaskan ulang, dan bahan terkunci (LEARN-2, LEARN-3)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await open(page, scenarioNamed("learn-menunggu"));

  await expect(page.getByText("Review berikutnya besok")).toBeVisible();
  const feedback = page.getByRole("region", { name: "Umpan balik penjelasan" });
  await expect(feedback).toContainText("Diperiksa AI dari bahanmu");
  await expect(feedback).toContainText("Yang terlewat");
  await expect(feedback).not.toContainText("Perlu dicek lagi");

  const questions = page.getByRole("region", { name: "Pertanyaan review" });
  await expect(questions).toContainText("Muncul lagi besok");

  // No primary button on this state; explaining again is a secondary one that opens the sheet.
  await page.getByRole("button", { name: "Jelaskan ulang" }).click();
  await expect(page.getByLabel("Penjelasanmu")).toHaveValue("Tumbuhan bikin makanan dari cahaya.");
  await expect(page.getByText("Pertanyaan dan jadwal reviewmu tidak berubah.", { exact: false })).toBeVisible();

  // Once checked, the material can no longer be edited.
  await page.locator("summary", { hasText: "Lihat bahan" }).click();
  await expect(page.getByRole("link", { name: "Ubah bahan" })).toHaveCount(0);
  await page.goto(`/learn/${ids.waiting}/edit`);
  await expect(page.getByText("Bahan tidak bisa diubah setelah diperiksa", { exact: false })).toBeVisible();
});

test("Belajar: materi milik user lain tidak bisa dibuka lewat URL (LEARN-8, PRD §7)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  await signIn(page.context(), empty!);
  await page.goto(`/learn/${ids.waiting}`);
  await expect(page.getByRole("heading", { name: "Materi tidak ditemukan" })).toBeVisible();
  await expect(page.getByText("Tumbuhan bikin makanan dari cahaya.")).toHaveCount(0);
});

test("Navigasi: Belajar menggantikan Riwayat, Progres bertab dan aktif di ketiga tab (DESIGN §5, §6)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page.context(), empty!);

    for (const [path, tab] of [
      ["/dashboard", "Grafik"],
      ["/history", "Riwayat"],
      ["/reports", "Laporan"],
    ] as const) {
      await page.goto(path);
      const main = page.getByRole("navigation", { name: "Navigasi utama" }).filter({ visible: true });
      await expect(main.getByRole("link", { name: "Belajar" })).toHaveAttribute("href", "/learn");
      await expect(main.getByRole("link", { name: "Riwayat" })).toHaveCount(0);
      await expect(main.getByRole("link", { name: "Progres" })).toHaveAttribute("aria-current", "page");

      const tabs = page.getByRole("navigation", { name: "Bagian Progres" });
      await expect(tabs.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
      await expect(tabs.getByRole("link")).toHaveCount(3);
    }
  }
});
