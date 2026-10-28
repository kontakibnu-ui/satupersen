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
