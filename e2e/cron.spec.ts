import { expect, test } from "@playwright/test";

/**
 * POST /api/cron/tick (TASKS.md 4.3). The route is called by pg_cron without a
 * session, so its only protection is the shared secret: anything else must be
 * turned away before any work starts. The secret comes from .env.local and is
 * never printed.
 */

const secret = process.env.CRON_SECRET ?? "";

test("tanpa header Authorization ditolak 401", async ({ request }) => {
  const response = await request.post("/api/cron/tick");

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ ok: false, message: "Tidak diizinkan." });
});

test("secret yang salah, termasuk yang hampir benar, ditolak 401", async ({ request }) => {
  test.skip(secret === "", "CRON_SECRET belum diisi di .env.local");

  for (const header of [
    "Bearer salah",
    `Bearer ${secret}x`,
    `Bearer ${secret.slice(0, -1)}`,
    secret, // the right value without the "Bearer " word
    `bearer ${secret}`,
    "Bearer ",
  ]) {
    const response = await request.post("/api/cron/tick", { headers: { Authorization: header } });
    expect(response.status(), `header ${header.slice(0, 12)}…`).toBe(401);
  }
});

test("hanya POST yang dijawab; GET tidak menjalankan tick", async ({ request }) => {
  const response = await request.get("/api/cron/tick");

  expect(response.status()).toBe(405);
});

test("secret yang benar menjalankan tick dan hanya mengembalikan hitungan, dua kali berturut-turut", async ({
  request,
}) => {
  test.skip(secret === "", "CRON_SECRET belum diisi di .env.local");
  test.setTimeout(120_000);

  const headers = { Authorization: `Bearer ${secret}` };

  for (let call = 1; call <= 2; call += 1) {
    const response = await request.post("/api/cron/tick", { headers });
    expect(response.status(), `panggilan ${call}`).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Object.keys(body.reports).sort()).toEqual(["considered", "failed", "generated", "skipped"]);
    // Nothing a user wrote may come back in the response.
    expect(JSON.stringify(body)).not.toMatch(/summary|content|trend|focus/i);
  }
});
