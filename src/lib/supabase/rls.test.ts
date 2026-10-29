import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Proof that row level security actually isolates users (TASKS.md 1.2, and the
 * cross user test PRD.md §7 requires for ASK later).
 *
 * It only runs when the local Supabase stack is pointed at through env vars:
 *   LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_SERVICE_KEY
 * Without them the whole file is skipped, so `npm test` stays offline.
 */

const url = process.env.LOCAL_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

/**
 * The values can be present while the stack is stopped (they live in
 * .env.local), so reachability is checked too: `npm test` must keep passing on
 * a machine without Docker running.
 */
async function isReachable(): Promise<boolean> {
  if (!configured) {
    return false;
  }

  try {
    const response = await fetch(`${url}/auth/v1/health`, { signal: AbortSignal.timeout(3000) });

    return response.ok;
  } catch {
    return false;
  }
}

const stackIsUp = await isReachable();

const authHeaders = (key: string, token?: string) => ({
  apikey: key,
  Authorization: `Bearer ${token ?? key}`,
  "Content-Type": "application/json",
});

const stamp = Date.now();
const userA = { email: `uji-a-${stamp}@example.com`, password: "RahasiaUji123!" };
const userB = { email: `uji-b-${stamp}@example.com`, password: "RahasiaUji123!" };
const entryDate = "2026-10-28";
const entryContent = "Catatan rahasia milik user A";

let idA = "";
let idB = "";
let tokenA = "";
let tokenB = "";

async function createUser(email: string, password: string): Promise<string> {
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders(serviceKey as string),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  if (!response.ok) {
    throw new Error(`Gagal membuat user uji: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { id: string };
  return body.id;
}

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(anonKey as string),
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Gagal login user uji: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

async function deleteUser(id: string): Promise<void> {
  await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(serviceKey as string),
  });
}

async function get(path: string, key: string, token?: string) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: authHeaders(key, token),
  });

  return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
}

async function post(path: string, key: string, token: string | undefined, payload: unknown) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...authHeaders(key, token), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
}

async function patch(path: string, key: string, token: string | undefined, payload: unknown) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...authHeaders(key, token), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
}

describe.skipIf(!stackIsUp)("isolasi RLS dengan dua user sungguhan", () => {
  beforeAll(async () => {
    idA = await createUser(userA.email, userA.password);
    idB = await createUser(userB.email, userB.password);
    tokenA = await signIn(userA.email, userA.password);
    tokenB = await signIn(userB.email, userB.password);
  });

  afterAll(async () => {
    await deleteUser(idA);
    await deleteUser(idB);
  });

  it("trigger membuat profil dengan plan free (AUTH-3)", async () => {
    const { status, body } = await get("profiles?select=id,plan,timezone", anonKey as string, tokenA);

    expect(status).toBe(200);
    expect(body).toEqual([{ id: idA, plan: "free", timezone: "Asia/Jakarta" }]);
  });

  it("user A bisa menulis dan membaca entrinya sendiri", async () => {
    const created = await post("entries", anonKey as string, tokenA, {
      user_id: idA,
      date: entryDate,
      content: entryContent,
      mood: 4,
      energy: 3,
    });

    expect(created.status).toBe(201);

    const read = await get("entries?select=content,date", anonKey as string, tokenA);

    expect(read.status).toBe(200);
    expect(read.body).toEqual([{ content: entryContent, date: entryDate }]);
  });

  it("user B tidak bisa melihat entri user A", async () => {
    const { status, body } = await get("entries?select=content", anonKey as string, tokenB);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("user B tidak bisa menulis entri atas nama user A", async () => {
    const attempt = await post("entries", anonKey as string, tokenB, {
      user_id: idA,
      date: entryDate,
      content: "Percobaan menulis atas nama orang lain",
    });

    expect(attempt.status).toBeGreaterThanOrEqual(400);
  });

  it("anon tanpa token tidak mendapat akses tabel", async () => {
    const { status } = await get("entries?select=content", anonKey as string);

    expect(status).toBeGreaterThanOrEqual(400);
  });

  it("tabel server-only tidak membocorkan baris dan menolak tulisan user biasa", async () => {
    const readOnlyTables = ["subscriptions", "wa_messages", "whatsapp_link_codes"];

    for (const table of readOnlyTables) {
      const read = await get(`${table}?select=*`, anonKey as string, tokenA);

      // RLS without policies hides every row: PostgREST then answers 200 with an
      // empty array. A 4xx is also fine, but a 200 with rows would be a leak.
      if (read.status === 200) {
        expect(read.body, `baris terlihat di ${table}`).toEqual([]);
      } else {
        expect(read.status, `baca ${table}`).toBeGreaterThanOrEqual(400);
      }
    }

    // A row that would be valid on its own must still be refused by RLS.
    const attempts = [
      {
        table: "subscriptions",
        payload: { user_id: idA, provider: "uji", provider_ref: `uji-${stamp}`, plan: "premium", status: "active" },
      },
      {
        table: "wa_messages",
        payload: { user_id: idA, wa_message_id: `uji-${stamp}`, direction: "in", body: "uji" },
      },
      {
        table: "whatsapp_link_codes",
        payload: { code: `UJI${stamp}`, user_id: idA, expires_at: new Date().toISOString() },
      },
    ];

    for (const attempt of attempts) {
      const written = await post(attempt.table, anonKey as string, tokenA, attempt.payload);
      expect(written.status, `tulis ke ${attempt.table}`).toBeGreaterThanOrEqual(400);
    }
  });

  // The rows below belong to the user, so RLS alone would let the owner write
  // them. Column and command grants are what keep the browser away from the
  // values that decide plans, quotas, scores, and WhatsApp verification
  // (supabase/migrations/20261028230000_restrict_client_writes.sql).

  it("user tidak bisa menaikkan plan-nya sendiri (SUB-2)", async () => {
    const attempt = await patch(`profiles?id=eq.${idA}`, anonKey as string, tokenA, {
      plan: "premium",
      premium_until: "2099-01-01T00:00:00Z",
    });

    expect(attempt.status).toBeGreaterThanOrEqual(400);

    const { body } = await get("profiles?select=plan,premium_until", anonKey as string, tokenA);
    expect(body).toEqual([{ plan: "free", premium_until: null }]);
  });

  it("user tetap bisa mengubah nama dan timezone-nya sendiri", async () => {
    const updated = await patch(`profiles?id=eq.${idA}`, anonKey as string, tokenA, {
      name: "Uji A",
      timezone: "Asia/Makassar",
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual([expect.objectContaining({ name: "Uji A", timezone: "Asia/Makassar" })]);
  });

  it("user tidak bisa menulis ringkasan, skor, atau kuotanya sendiri (SCORE-1, AI-4)", async () => {
    const forged = await post("daily_summaries", anonKey as string, tokenA, {
      user_id: idA,
      date: entryDate,
      status: "done",
      score: 100,
      regen_count: 0,
    });

    expect(forged.status).toBeGreaterThanOrEqual(400);

    // A row written by the server is readable by its owner, and only by them.
    const serverRow = await post("daily_summaries", serviceKey as string, undefined, {
      user_id: idA,
      date: entryDate,
      status: "done",
      score: 70,
      regen_count: 1,
    });
    expect(serverRow.status).toBe(201);

    const reset = await patch(`daily_summaries?user_id=eq.${idA}`, anonKey as string, tokenA, {
      regen_count: 0,
      score: 100,
    });
    expect(reset.status).toBeGreaterThanOrEqual(400);

    const own = await get("daily_summaries?select=score,regen_count", anonKey as string, tokenA);
    expect(own.body).toEqual([{ score: 70, regen_count: 1 }]);

    const other = await get("daily_summaries?select=score", anonKey as string, tokenB);
    expect(other.body).toEqual([]);
  });

  it("user tidak bisa menulis laporannya sendiri (REPORT-2)", async () => {
    const forged = await post("reports", anonKey as string, tokenA, {
      user_id: idA,
      type: "weekly",
      period_start: "2026-10-26",
      period_end: "2026-11-01",
    });

    expect(forged.status).toBeGreaterThanOrEqual(400);
  });

  it("nomor WhatsApp hanya bisa diverifikasi server, user hanya mengatur pengingat (PRD §6)", async () => {
    const forged = await post("whatsapp_links", anonKey as string, tokenA, {
      user_id: idA,
      phone: "6281200000000",
      verified_at: new Date().toISOString(),
      opted_in: true,
    });
    expect(forged.status).toBeGreaterThanOrEqual(400);

    const linked = await post("whatsapp_links", serviceKey as string, undefined, {
      user_id: idA,
      phone: `62812${String(stamp).slice(-8)}`,
      verified_at: new Date().toISOString(),
      opted_in: true,
    });
    expect(linked.status).toBe(201);

    const optOut = await patch(`whatsapp_links?user_id=eq.${idA}`, anonKey as string, tokenA, {
      opted_in: false,
      reminder_time: "21:00",
    });
    expect(optOut.status).toBe(200);

    const swapPhone = await patch(`whatsapp_links?user_id=eq.${idA}`, anonKey as string, tokenA, {
      phone: "6281299999999",
    });
    expect(swapPhone.status).toBeGreaterThanOrEqual(400);
  });

  it("menghapus akun ikut menghapus entrinya", async () => {
    await deleteUser(idA);

    const { status, body } = await get(
      `entries?select=content&user_id=eq.${idA}`,
      serviceKey as string,
    );

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});
