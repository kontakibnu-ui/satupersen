import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Frame, type Page } from "@playwright/test";
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
  localStackIsRunning,
  readRows,
  setPlan,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * Ruang baca (PRD.md READ-1 to READ-10; DESIGN.md §6 "Lembaran Ruang baca",
 * "Pembaca"). One test uploads through the real screen; the others put their
 * books in place the way the server does (start_book_upload, a one-time upload,
 * finish_book_upload), so each starts from a known state.
 *
 * The books in e2e/fixtures/books are written by make-fixtures.mjs in that folder.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const fixtures = join(process.cwd(), "e2e", "fixtures", "books");
const fixture = (name: string) => join(fixtures, name);

const CONTENT_TYPES = {
  epub: "application/epub+zip",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
} as const;

const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

/** Puts a book in place exactly as the server's two steps do. */
async function seedBook(user: TestUser, file: string, format: keyof typeof CONTENT_TYPES, title: string): Promise<string> {
  const data = readFileSync(fixture(file));
  const started = await fetch(`${url}/rest/v1/rpc/start_book_upload`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({ p_user: user.id, p_title: title, p_format: format, p_size: data.length }),
  });
  const bookId = (await started.json()) as string;
  const path = `${user.id}/${bookId}`;

  const signed = await fetch(`${url}/storage/v1/object/upload/sign/books/${path}`, {
    method: "POST",
    headers: serviceHeaders,
    body: "{}",
  });
  const token = new URL(`${url}/storage/v1${((await signed.json()) as { url: string }).url}`).searchParams.get("token");
  const uploaded = await fetch(`${url}/storage/v1/object/upload/sign/books/${path}?token=${token}`, {
    method: "PUT",
    headers: { apikey: serviceKey, "content-type": CONTENT_TYPES[format] },
    body: data,
  });

  if (!uploaded.ok) {
    throw new Error(`Seeding the book file failed with ${uploaded.status}`);
  }

  const finished = await fetch(`${url}/rest/v1/rpc/finish_book_upload`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({ p_user: user.id, p_book: bookId, p_size: data.length }),
  });

  if ((await finished.json()) !== "ready") {
    throw new Error("Seeding the book did not finish");
  }

  return bookId;
}

/** The first frame of the book that shows `text`; foliate-js renders each part in an iframe. */
async function bookFrameWith(page: Page, text: string): Promise<Frame> {
  let found: Frame | undefined;

  await expect
    .poll(
      async () => {
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) {
            continue;
          }

          const body = await frame.evaluate(() => document.body?.innerText ?? "").catch(() => "");

          if (body.includes(text)) {
            found = frame;
            return true;
          }
        }

        return false;
      },
      { timeout: 45_000, message: `book text "${text}" never appeared` },
    )
    .toBe(true);

  return found as Frame;
}

async function openReader(page: Page, bookId: string) {
  const response = await page.goto(`/read/${bookId}`);
  expect(response?.status()).toBe(200);
  return response;
}

/** The reader has opened the book at its position; earlier key presses would be undone by that. */
async function readerReady(page: Page) {
  await expect(page.getByRole("main", { name: "Isi buku" })).toHaveAttribute("aria-busy", "false", { timeout: 45_000 });
}

let reader: TestUser | undefined;
let uploader: TestUser | undefined;
let formats: TestUser | undefined;
let scripted: TestUser | undefined;
let stranger: TestUser | undefined;
let stackUp = false;
const ids: Record<string, string> = {};

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();

  if (!stackUp) {
    return;
  }

  reader = await createTestUser("read-epub", true);
  ids.epub = await seedBook(reader, "catatan-kecil.epub", "epub", "Catatan Kecil tentang Ingatan");

  uploader = await createTestUser("read-upload", true);

  formats = await createTestUser("read-formats", true);
  await setPlan(formats, "premium");
  ids.pdf = await seedBook(formats, "dua-halaman.pdf", "pdf", "Dua Halaman");
  ids.docx = await seedBook(formats, "modul.docx", "docx", "Modul");
  ids.txt = await seedBook(formats, "catatan.txt", "txt", "Catatan");

  scripted = await createTestUser("read-script", true);
  ids.scripted = await seedBook(scripted, "buku-berskrip.epub", "epub", "Buku Berskrip");

  stranger = await createTestUser("read-stranger", true);
});

test.afterAll(async () => {
  for (const user of [reader, uploader, formats, scripted, stranger]) {
    if (!user) {
      continue;
    }

    // Files are not reached by the account cascade; remove them like deleteAccount does.
    await fetch(`${url}/storage/v1/object/books`, {
      method: "DELETE",
      headers: serviceHeaders,
      body: JSON.stringify({
        prefixes: Object.values(ids).flatMap((id) => [`${user.id}/${id}`]),
      }),
    });
    await deleteTestUser(user);
  }
});

test.beforeEach(() => {
  test.skip(!stackUp, "Supabase lokal tidak jalan");
});

test("Unggah lewat Belajar: file dicek di HP, terunggah, terbaca, dan slot free habis walau dihapus (READ-1, READ-2, READ-10)", async ({ page }) => {
  await signIn(page.context(), uploader as TestUser);
  await page.goto("/learn");

  const shelf = page.getByRole("region", { name: "Ruang baca" });
  await expect(shelf).toContainText("Unggah PDF, EPUB, DOCX, atau TXT untuk dibaca di sini");

  // A renamed file is refused before anything is uploaded.
  await page.locator("#book-file").setInputFiles({
    name: "palsu.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("<html><script>alert(1)</script></html>"),
  });
  await expect(shelf.getByRole("alert")).toHaveText(/bukan PDF, EPUB, DOCX, atau TXT/);
  expect(await readRows("books", `user_id=eq.${uploader?.id}&select=id`)).toEqual([]);

  await page.locator("#book-file").setInputFiles(fixture("catatan-kecil.epub"));
  const row = shelf.getByRole("link", { name: /catatan-kecil/ });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("EPUB · 4 KB");
  await expect(shelf).toContainText("Paket gratis memuat 1 buku");
  await expect(shelf.getByRole("button", { name: "Unggah buku" })).toHaveCount(0);

  const [book] = await readRows<{ id: string; status: string; size_bytes: number }>(
    "books",
    `user_id=eq.${uploader?.id}&select=id,status,size_bytes`,
  );
  expect(book).toMatchObject({ status: "ready", size_bytes: readFileSync(fixture("catatan-kecil.epub")).length });

  await row.click();
  await page.waitForURL(`**/read/${book.id}`);
  await bookFrameWith(page, "Kebanyakan dari kita belajar");

  // Deleting frees nothing on the free plan.
  await page.getByRole("button", { name: "Pengaturan baca" }).click();
  await page.getByRole("button", { name: "Hapus buku" }).click();
  await expect(page.getByText("Paket gratis hanya bisa mengunggah 1 buku")).toBeVisible();
  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await page.waitForURL("**/learn");
  await expect(page.getByRole("region", { name: "Ruang baca" })).toContainText("Paket gratis memuat 1 buku");
  expect(await readRows("books", `user_id=eq.${uploader?.id}&select=id`)).toEqual([]);

  const file = await fetch(`${url}/storage/v1/object/info/books/${uploader?.id}/${book.id}`, { headers: serviceHeaders });
  expect(file.status).toBeGreaterThanOrEqual(400);
});

test("Pembaca EPUB: CSP nonce, Gulir dan Geser diingat, posisi tersimpan dan dibuka lagi (READ-3, READ-4, READ-6, READ-8)", async ({ page }) => {
  await signIn(page.context(), reader as TestUser);
  const response = await openReader(page, ids.epub);
  const policy = response?.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toMatch(/script-src 'nonce-[^']+' 'strict-dynamic'/);

  await bookFrameWith(page, "Kebanyakan dari kita belajar");
  await readerReady(page);
  await expect(page.getByRole("heading", { level: 1, name: "Catatan Kecil tentang Ingatan" })).toBeVisible();

  // Geser is the default; the right arrow moves on, and the position is saved within 2 seconds.
  await expect(page.locator("foliate-view")).toHaveAttribute("data-flow", "paginated");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await bookFrameWith(page, "Mengingat adalah latihan");

  await expect
    .poll(async () => (await readRows<{ location: string | null }>("books", `id=eq.${ids.epub}&select=location`))[0]?.location, {
      timeout: 10_000,
    })
    .toMatch(/^epubcfi\(/);

  // Gulir is chosen in the Aa panel and survives a reload, as does the position.
  await page.getByRole("button", { name: "Pengaturan baca" }).click();
  await page.getByRole("radio", { name: "Gulir" }).click();
  await expect(page.getByRole("radio", { name: "Gulir" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("foliate-view")).toHaveAttribute("data-flow", "scrolled");

  await page.reload();
  await bookFrameWith(page, "Mengingat adalah latihan");
  await expect(page.locator("foliate-view")).toHaveAttribute("data-flow", "scrolled");
});

test("Jadikan materi: teks yang diblok dibawa ke form Materi baru tanpa disimpan dulu (READ-7)", async ({ page }) => {
  await signIn(page.context(), reader as TestUser);
  await openReader(page, ids.epub);
  // This paragraph is in both chapters, so the test holds wherever the saved position opens the book.
  const frame = await bookFrameWith(page, "Ingatan menguat justru");
  await readerReady(page);

  await expect(page.getByRole("button", { name: "Jadikan materi" })).toHaveCount(0);

  await frame.evaluate(() => {
    const paragraph = Array.from(document.querySelectorAll("p")).find((element) =>
      element.textContent?.includes("Ingatan menguat justru"),
    );
    const range = document.createRange();
    range.selectNodeContents(paragraph as Node);
    const selection = document.getSelection() as Selection;
    selection.removeAllRanges();
    selection.addRange(range);
  });

  await expect(page.getByText(/karakter terpilih/)).toBeVisible();
  await page.getByRole("button", { name: "Jadikan materi" }).click();
  await page.waitForURL("**/learn/new?dari=buku");

  await expect(page.getByText("Diambil dari Ruang baca")).toBeVisible();
  await expect(page.getByLabel("Judul")).toHaveValue(
    "Ingatan menguat justru saat kita berusaha memanggilnya. · Catatan Kecil tentang Ingatan",
  );
  await expect(page.locator("#material-source")).toHaveValue(/^Ingatan menguat justru saat kita berusaha memanggilnya\. Tutup buku/);
  expect(await readRows("study_materials", `user_id=eq.${reader?.id}&select=id`)).toEqual([]);
});

test("Script di dalam buku tidak pernah jalan (READ-8)", async ({ page }) => {
  const refusals: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) {
      refusals.push(message.text());
    }
  });

  await signIn(page.context(), scripted as TestUser);
  await openReader(page, ids.scripted);
  await bookFrameWith(page, "Kebanyakan dari kita belajar");
  // Give the inline script, the image error handler, and the parser a moment.
  await page.waitForTimeout(1500);

  expect(await page.title()).toBe("Ruang baca · Satu Persen");
  expect(refusals.length, "the browser reports the blocked script").toBeGreaterThan(0);
});

test("PDF, DOCX, dan TXT terbuka di pembaca yang sama; PDF per halaman (READ-1, READ-3, READ-4)", async ({ page }) => {
  await signIn(page.context(), formats as TestUser);

  await openReader(page, ids.docx);
  await bookFrameWith(page, "Rasa akrab itu menipu");

  await openReader(page, ids.txt);
  await bookFrameWith(page, "Jarak juga berperan");

  await openReader(page, ids.pdf);
  await bookFrameWith(page, "Halaman satu tentang ingatan");
  await readerReady(page);
  await expect(page.getByText("Hlm 1 dari 2")).toBeVisible();
  await page.getByRole("button", { name: "Pengaturan baca" }).click();
  await expect(page.getByText("PDF dibaca per halaman.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Gulir" })).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Hlm 2 dari 2")).toBeVisible();
});

test("Salinan buku disimpan di browser dan dihapus saat keluar akun (READ-9)", async ({ page }) => {
  const cacheNames = () => page.evaluate(() => caches.keys());

  await signIn(page.context(), formats as TestUser);
  await openReader(page, ids.txt);
  await bookFrameWith(page, "Jarak juga berperan");
  await readerReady(page);
  expect(await cacheNames()).toContain(`satupersen-books-${formats?.id}`);

  // A second visit opens from the copy: no request reaches the file in Storage.
  const downloads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/storage/v1/object/books/")) {
      downloads.push(request.url());
    }
  });
  await page.reload();
  await bookFrameWith(page, "Jarak juga berperan");
  await readerReady(page);
  expect(downloads).toEqual([]);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("**/login");
  expect((await cacheNames()).filter((name) => name.startsWith("satupersen-books-"))).toEqual([]);
});

test("Buku milik user lain tidak bisa dibuka lewat URL (READ-8, PRD §7)", async ({ page }) => {
  await signIn(page.context(), stranger as TestUser);
  await openReader(page, ids.epub);
  await expect(page.getByRole("heading", { name: "Buku ini tidak ada, atau sudah dihapus." })).toBeVisible();
});

test("Layar penuh menyembunyikan kontrol dan ketuk tengah memunculkannya (READ-4)", async ({ page }) => {
  await signIn(page.context(), reader as TestUser);
  await openReader(page, ids.epub);
  const frame = await bookFrameWith(page, "Ingatan menguat justru");
  await readerReady(page);

  await page.getByRole("button", { name: "Layar penuh" }).click();
  await expect(page.locator("header")).toHaveAttribute("inert", "");

  const box = await frame.frameElement().then((element) => element.boundingBox());
  await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await expect(page.locator("header")).not.toHaveAttribute("inert", "");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Layar penuh" })).toBeVisible();
});

for (const viewport of viewports) {
  for (const scheme of colorSchemes) {
    test(`Ruang baca dan pembaca rapi di ${viewport.name} mode ${scheme} (DESIGN §13)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signIn(page.context(), formats as TestUser);

      await page.goto("/learn");
      await applyColorScheme(page, scheme);
      await expect(page.getByRole("region", { name: "Ruang baca" })).toContainText("Modul");
      await expectNoHorizontalScroll(page);
      await expectTouchTargetsAtLeast44(page);
      await expectNoSeriousAxeViolations(page);

      await openReader(page, ids.docx);
      await applyColorScheme(page, scheme);
      await bookFrameWith(page, "Rasa akrab itu menipu");
      await page.getByRole("button", { name: "Pengaturan baca" }).click();
      await expectNoHorizontalScroll(page);
      await expectTouchTargetsAtLeast44(page);
      await expectNoSeriousAxeViolations(page);
    });
  }
}
