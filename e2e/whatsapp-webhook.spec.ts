import { expect, test } from "@playwright/test";
import { signWebhookBody } from "../src/lib/whatsapp/signature";
import {
  createTestUser,
  deleteTestUser,
  localStackIsRunning,
  readRows,
  seedWhatsAppLink,
  type TestUser,
} from "./support/test-users";

/**
 * POST and GET /api/whatsapp/webhook (TASKS.md 5.1). The secrets come from
 * .env.local and are never printed. WHATSAPP_ACCESS_TOKEN is left empty in the
 * local env on purpose, so nothing here ever calls Meta: a reply that cannot be
 * sent is logged and dropped, and what these tests look at is what reached the
 * database.
 */

const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
let stackUp = false;
const users: TestUser[] = [];

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();
});

test.afterAll(async () => {
  await Promise.all(users.map(deleteTestUser));
});

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

function payload(messageId: string, from: string, text: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550000000", phone_number_id: "1" },
              contacts: [{ profile: { name: "Uji" }, wa_id: from }],
              messages: [{ from, id: messageId, timestamp: "1749416383", type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  };
}

const randomPhone = () => `628${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

async function waitForRows<T>(table: string, filter: string, count: number): Promise<T[]> {
  let rows: T[] = [];

  await expect(async () => {
    rows = await readRows<T>(table, filter);
    expect(rows.length).toBeGreaterThanOrEqual(count);
  }).toPass({ timeout: 15_000 });

  return rows;
}

test("GET: Meta mendapat tantangannya kembali bila token benar, selain itu 403 (AGENTS §6)", async ({ request }) => {
  test.skip(verifyToken === "", "WHATSAPP_VERIFY_TOKEN belum diisi di .env.local");

  const ok = await request.get(
    `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=1158201444`,
  );
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toBe("1158201444");

  for (const query of [
    `hub.mode=subscribe&hub.verify_token=salah&hub.challenge=123`,
    `hub.mode=subscribe&hub.challenge=123`,
    `hub.mode=unsubscribe&hub.verify_token=${verifyToken}&hub.challenge=123`,
    `hub.verify_token=${verifyToken}&hub.challenge=123`,
    ``,
  ]) {
    const response = await request.get(`/api/whatsapp/webhook?${query}`);
    expect(response.status(), query.replace(verifyToken, "<token>")).toBe(403);
    expect(await response.text()).not.toContain("123");
  }
});

test("POST: tanpa tanda tangan, dengan tanda tangan salah, atau badan yang diubah ditolak 401", async ({ request }) => {
  test.skip(appSecret === "", "WHATSAPP_APP_SECRET belum diisi di .env.local");

  const id = `wamid.tolak.${unique()}`;
  const body = JSON.stringify(payload(id, randomPhone(), "halo"));

  const attempts: Record<string, string>[] = [
    {},
    { "x-hub-signature-256": "sha256=" + "0".repeat(64) },
    { "x-hub-signature-256": signWebhookBody(body, "rahasia-lain") },
    { "x-hub-signature-256": signWebhookBody(body + " ", appSecret) },
    { "x-hub-signature-256": signWebhookBody(body, appSecret).replace("sha256=", "") },
  ];

  for (const headers of attempts) {
    const response = await request.post("/api/whatsapp/webhook", {
      data: body,
      headers: { "content-type": "application/json", ...headers },
    });
    expect(response.status()).toBe(401);
  }

  // Nothing was stored for any of them.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(await readRows("wa_messages", `wa_message_id=eq.${id}`)).toEqual([]);
});

test("POST: tanda tangan benar dijawab 200 segera, dan pesan dari nomor tak dikenal tersimpan tanpa teksnya", async ({
  request,
}) => {
  test.skip(!stackUp || appSecret === "", "Supabase lokal atau WHATSAPP_APP_SECRET belum siap");

  const id = `wamid.asing.${unique()}`;
  const body = JSON.stringify(payload(id, randomPhone(), "isi pesan yang tidak boleh disimpan"));

  const response = await request.post("/api/whatsapp/webhook", {
    data: body,
    headers: { "content-type": "application/json", "x-hub-signature-256": signWebhookBody(body, appSecret) },
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe("ok");

  const [row] = await waitForRows<{ user_id: string | null; body: string | null; direction: string }>(
    "wa_messages",
    `wa_message_id=eq.${id}&select=user_id,body,direction`,
    1,
  );
  expect(row).toEqual({ user_id: null, body: null, direction: "in" });
});

test("POST: Meta mengirim ulang pesan yang sama, tetap satu baris dan satu catatan di diary (idempotensi)", async ({
  request,
}) => {
  test.skip(!stackUp || appSecret === "", "Supabase lokal atau WHATSAPP_APP_SECRET belum siap");

  const user = await createTestUser("wa-ulang", true);
  users.push(user);
  const phone = randomPhone();
  await seedWhatsAppLink(user, phone, { optedIn: false });

  const id = `wamid.ulang.${unique()}`;
  const body = JSON.stringify(payload(id, phone, "Hari ini aku belajar masak."));
  const headers = { "content-type": "application/json", "x-hub-signature-256": signWebhookBody(body, appSecret) };

  for (let delivery = 1; delivery <= 3; delivery += 1) {
    const response = await request.post("/api/whatsapp/webhook", { data: body, headers });
    expect(response.status(), `pengiriman ${delivery}`).toBe(200);
  }

  const [stored] = await waitForRows<{ body: string }>(
    "wa_messages",
    `wa_message_id=eq.${id}&select=body,user_id`,
    1,
  );
  expect(stored.body).toBe("Hari ini aku belajar masak.");

  await expect(async () => {
    const entries = await readRows<{ content: string }>("entries", `user_id=eq.${user.id}&select=content`);
    expect(entries).toEqual([{ content: "Hari ini aku belajar masak." }]);
  }).toPass({ timeout: 15_000 });

  expect(await readRows("wa_messages", `wa_message_id=eq.${id}`)).toHaveLength(1);

  const [link] = await readRows<{ last_inbound_at: string | null }>(
    "whatsapp_links",
    `user_id=eq.${user.id}&select=last_inbound_at`,
  );
  expect(link.last_inbound_at).not.toBeNull();
});

test("POST: badan dengan spasi dan huruf non-ASCII tetap lolos karena yang ditandatangani adalah teks mentahnya", async ({
  request,
}) => {
  test.skip(!stackUp || appSecret === "", "Supabase lokal atau WHATSAPP_APP_SECRET belum siap");

  const id = `wamid.mentah.${unique()}`;
  const body = JSON.stringify(payload(id, randomPhone(), "kopi à la crème ☕"), null, 4);

  const response = await request.post("/api/whatsapp/webhook", {
    data: body,
    headers: { "content-type": "application/json", "x-hub-signature-256": signWebhookBody(body, appSecret) },
  });
  expect(response.status()).toBe(200);
  await waitForRows("wa_messages", `wa_message_id=eq.${id}`, 1);
});

test("POST: laporan status pengiriman dan badan bukan pesan dijawab 200 tanpa menyimpan apa pun", async ({
  request,
}) => {
  test.skip(!stackUp || appSecret === "", "Supabase lokal atau WHATSAPP_APP_SECRET belum siap");

  const bodies = [
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "1", changes: [{ field: "messages", value: { statuses: [{ id: "wamid.status", status: "delivered" }] } }] }],
    }),
    JSON.stringify({ object: "whatsapp_business_account" }),
    "bukan json sama sekali",
  ];

  for (const body of bodies) {
    const response = await request.post("/api/whatsapp/webhook", {
      data: body,
      // Plain text for the last one: Playwright would otherwise re-encode a string that is not JSON.
      headers: {
        "content-type": body.startsWith("{") ? "application/json" : "text/plain",
        "x-hub-signature-256": signWebhookBody(body, appSecret),
      },
    });
    expect(response.status()).toBe(200);
  }

  expect(await readRows("wa_messages", "wa_message_id=eq.wamid.status")).toEqual([]);
});
