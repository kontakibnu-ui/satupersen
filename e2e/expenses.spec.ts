import { expect, test, type Page } from "@playwright/test";
import {
  createTestUser,
  daysBefore,
  deleteTestUser,
  jakartaToday,
  localStackIsRunning,
  seedBudget,
  seedExpense,
  seedIncome,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Expenses and budget (EXP-1 to EXP-4) through the real screen and the real
 * server actions. Each test makes its own user and leaves nothing behind.
 */

const today = jakartaToday();
const firstOfMonth = `${today.slice(0, 7)}-01`;
let stackUp = false;
const created: TestUser[] = [];

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();
});

test.afterAll(async () => {
  await Promise.all(created.map(deleteTestUser));
});

async function newUser(page: Page, label: string): Promise<TestUser> {
  const user = await createTestUser(label, true);
  created.push(user);
  await signIn(page.context(), user);
  await page.setViewportSize({ width: 360, height: 740 });
  return user;
}

test("tambah pengeluaran: nominal berpemisah ribuan, kategori, catatan; total dan daftar ikut berubah (EXP-1, EXP-2)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "tambah");
  await page.goto("/expenses");

  await expect(page.getByText("Belum ada catatan uang di bulan ini.")).toBeVisible();
  await expect(page.getByText("Rp 0", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Tambah pengeluaran" }).click();
  const amount = page.getByLabel("Nominal");
  await amount.fill("25000");
  await expect(amount).toHaveValue("25.000");
  await page.getByRole("radio", { name: "Makan" }).check({ force: true });
  await page.getByLabel("Catatan (opsional)").fill("makan siang");
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page.getByRole("button", { name: /Makan, makan siang\s*Rp 25\.000/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hari ini" })).toBeVisible();

  // A second one on the same day adds to the day and the month.
  await page.getByRole("button", { name: "Tambah pengeluaran" }).click();
  await page.getByLabel("Nominal").fill("20000");
  await page.getByRole("radio", { name: "Transport" }).check({ force: true });
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("region", { name: "Hari ini" }).getByText("Rp 45.000")).toBeVisible();
});

test("nominal dan kategori wajib: pesan jelas dan tidak ada yang tersimpan (EXP-1)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "wajib");
  await page.goto("/expenses");

  await page.getByRole("button", { name: "Tambah pengeluaran" }).click();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Isi nominalnya dulu.")).toBeVisible();

  await page.getByLabel("Nominal").fill("5000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Pilih kategorinya dulu.")).toBeVisible();

  await page.getByRole("button", { name: "Tutup" }).click();
  await expect(page.getByText("Belum ada catatan uang di bulan ini.")).toBeVisible();
});

test("ubah dan hapus pengeluaran (EXP-2)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "ubah");
  await seedExpense(user, today, 30000, "hiburan", "nonton");
  await page.goto("/expenses");

  await page.getByRole("button", { name: /Hiburan, nonton/ }).click();
  await expect(page.getByLabel("Nominal")).toHaveValue("30.000");
  await page.getByLabel("Nominal").fill("35000");
  await page.getByRole("radio", { name: "Tagihan" }).check({ force: true });
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("button", { name: /Tagihan, nonton\s*Rp 35\.000/ })).toBeVisible();

  await page.getByRole("button", { name: /Tagihan, nonton/ }).click();
  await page.getByRole("button", { name: "Hapus pengeluaran" }).click();
  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page.getByText("Belum ada catatan uang di bulan ini.")).toBeVisible();
});

test("tambah pemasukan: sisa uang, masuk, dan keluar tampil; kategori pemasukan terpisah (EXP-5)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "masuk");
  await seedExpense(user, today, 40000, "makan");
  await page.goto("/expenses");

  await expect(page.getByText("Catat pemasukan supaya sisa uangmu kelihatan.")).toBeVisible();

  await page.getByRole("button", { name: "Tambah pemasukan" }).click();
  await expect(page.getByRole("radio", { name: "Makan" })).toHaveCount(0);
  await page.getByLabel("Nominal").fill("1000000");
  await page.getByRole("radio", { name: "Gaji" }).check({ force: true });
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page.getByText("Sisa uang bulan ini")).toBeVisible();
  await expect(page.getByText("Rp 960.000", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Gaji\s*\+Rp 1\.000\.000/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Hari ini" }).getByText("+Rp 960.000")).toBeVisible();
});

test("ubah dan hapus pemasukan tidak menyentuh pengeluaran (EXP-5)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "ubahmasuk");
  await seedIncome(user, today, 500000, "uang_saku", "dari ayah");
  await seedExpense(user, today, 20000, "transport");
  await page.goto("/expenses");

  await page.getByRole("button", { name: /Uang saku, dari ayah/ }).click();
  await page.getByLabel("Nominal").fill("600000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("button", { name: /Uang saku, dari ayah\s*\+Rp 600\.000/ })).toBeVisible();

  await page.getByRole("button", { name: /Uang saku, dari ayah/ }).click();
  await page.getByRole("button", { name: "Hapus pemasukan" }).click();
  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page.getByRole("button", { name: /Uang saku/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Transport\s*Rp 20\.000/ })).toBeVisible();
});

test("perbandingan dengan bulan lalu dan grafik masuk lawan keluar (EXP-6)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "banding");
  // Both on the 1st, so the same stretch of last month holds them whatever day today is.
  const firstOfLastMonth = `${daysBefore(firstOfMonth, 1).slice(0, 7)}-01`;
  await seedIncome(user, firstOfLastMonth, 3000000, "gaji");
  await seedExpense(user, firstOfLastMonth, 100000, "makan");
  await seedIncome(user, firstOfMonth, 3000000, "gaji");
  await seedExpense(user, firstOfMonth, 40000, "makan");
  await page.goto("/expenses");

  await expect(page.getByRole("region", { name: "Perkembangan uang" })).toBeVisible();
  await expect(page.getByText("Pengeluaran Rp 60.000 lebih sedikit")).toBeVisible();
  await expect(page.getByText("Sisa uang Rp 60.000 lebih banyak")).toBeVisible();
  await expect(page.getByRole("img", { name: /Uang masuk dan keluar 6 bulan terakhir/ })).toBeVisible();
});

test("tanpa catatan sama sekali: tidak ada kartu perkembangan (EXP-6)", async ({ page }) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  await newUser(page, "kosong");
  await page.goto("/expenses");

  await expect(page.getByRole("region", { name: "Perkembangan uang" })).toHaveCount(0);
});

test("budget: paket gratis diberi tahu dan tidak ada yang tertulis; premium menyimpan dan menampilkan sisa (EXP-4, SUB-1)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "budget");
  await seedExpense(user, today, 400000, "makan");
  await page.goto("/expenses");

  await page.getByRole("button", { name: "Atur budget" }).click();
  await expect(page.getByText("Budget bulanan ada di Premium.")).toBeVisible();
  await expect(page.getByLabel("Budget per bulan")).toHaveCount(0);

  await setPlan(user, "premium");
  await page.reload();
  await page.getByRole("button", { name: "Atur budget" }).click();
  await page.getByLabel("Budget per bulan").fill("1500000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Sisa budget Rp 1.100.000")).toBeVisible();

  // Over budget is a plain sentence, and the bar never turns red for it.
  await page.getByRole("button", { name: "Ubah budget" }).click();
  await page.getByLabel("Budget per bulan").fill("300000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Lewat Rp 100.000 dari budget")).toBeVisible();

  await page.getByRole("button", { name: "Ubah budget" }).click();
  await page.getByRole("button", { name: "Hapus budget" }).click();
  await expect(page.getByRole("button", { name: "Atur budget" })).toBeVisible();
});

test("budget bulan lalu tetap berlaku sampai diubah, dan paket gratis tidak melihatnya (EXP-4, SUB-3)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "carry");
  await seedBudget(user, "2026-01-01", 2000000);
  await seedExpense(user, today, 500000, "tagihan");
  await setPlan(user, "premium");

  await page.goto("/expenses");
  await expect(page.getByText("Sisa budget Rp 1.500.000")).toBeVisible();

  // The plan lapses: the budget row stays in the database but is no longer shown.
  await setPlan(user, "free");
  await page.reload();
  await expect(page.getByRole("button", { name: /Tagihan/ })).toBeVisible();
  await expect(page.getByText(/Sisa budget/)).toHaveCount(0);
});

test("bulan sebelumnya bisa dibuka tanpa tombol tambah, dan bulan depan dipotong ke bulan ini (EXP-2)", async ({
  page,
}) => {
  test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");
  const user = await newUser(page, "bulan");
  await seedExpense(user, daysBefore(firstOfMonth, 1), 12000, "transport");
  await page.goto("/expenses");

  await expect(page.getByRole("link", { name: "Bulan berikutnya" })).toHaveCount(0);
  await page.getByRole("link", { name: "Bulan sebelumnya" }).click();
  await expect(page.getByRole("button", { name: /Transport\s*Rp 12\.000/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tambah pengeluaran" })).toHaveCount(0);

  await page.goto("/expenses?bulan=2099-01");
  await expect(page.getByRole("button", { name: "Tambah pengeluaran" })).toBeVisible();
});
