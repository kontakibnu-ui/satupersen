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

  // HABIT-1 and HABIT-3. The limit is checked by a trigger, so it holds for a
  // browser that talks to PostgREST directly and never touches the server action
  // (supabase/migrations/20261029000000_habit_rules.sql).
  it("free hanya boleh 3 habit aktif, arsip tidak memakai slot, premium tanpa batas (HABIT-3)", async () => {
    const add = (name: string) =>
      post("habits", anonKey as string, tokenB, { user_id: idB, name });

    const first = await add("Olahraga");
    const second = await add("Baca");
    const third = await add("Minum air");
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(201);

    const fourth = await add("Meditasi");
    expect(fourth.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(fourth.body)).toContain("habit_limit_reached");

    // Archiving frees a slot; bringing it back while full is refused again.
    const firstId = (first.body as { id: string }[])[0].id;
    const archived = await patch(`habits?id=eq.${firstId}`, anonKey as string, tokenB, {
      archived_at: new Date().toISOString(),
    });
    expect(archived.status).toBe(200);

    const replacement = await add("Meditasi");
    expect(replacement.status).toBe(201);

    const restore = await patch(`habits?id=eq.${firstId}`, anonKey as string, tokenB, {
      archived_at: null,
    });
    expect(restore.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(restore.body)).toContain("habit_limit_reached");

    // A rename never trips the limit, even when the account is at it.
    const renamed = await patch(`habits?id=eq.${(second.body as { id: string }[])[0].id}`, anonKey as string, tokenB, {
      name: "Baca buku",
    });
    expect(renamed.status).toBe(200);

    // Premium is set by the server only; the user cannot do it themselves.
    await patch(`profiles?id=eq.${idB}`, serviceKey as string, undefined, { plan: "premium" });
    const fifth = await add("Jurnal syukur");
    expect(fifth.status).toBe(201);
  });

  it("budget hanya ditulis server: user biasa tidak bisa membuat, mengubah, atau menghapusnya (EXP-4, SUB-1)", async () => {
    const created = await post("budgets", anonKey as string, tokenA, {
      user_id: idA,
      month: "2026-10-01",
      amount: 1000000,
    });
    expect(created.status).toBeGreaterThanOrEqual(400);

    // The server writes one, and the owner can read it but still cannot change it.
    const seeded = await post("budgets", serviceKey as string, undefined, {
      user_id: idA,
      month: "2026-10-01",
      amount: 1000000,
    });
    expect(seeded.status).toBe(201);

    const read = await get("budgets?select=amount", anonKey as string, tokenA);
    expect(read.body).toEqual([{ amount: 1000000 }]);

    const raised = await patch(`budgets?user_id=eq.${idA}`, anonKey as string, tokenA, { amount: 9 });
    const afterPatch = await get("budgets?select=amount", serviceKey as string);
    expect(raised.status === 200 ? raised.body : []).toEqual([]);
    expect((afterPatch.body as { amount: number }[]).some((row) => row.amount === 9)).toBe(false);

    // Another user sees nothing of it.
    const other = await get("budgets?select=amount", anonKey as string, tokenB);
    expect(other.body).toEqual([]);
  });

  it("user B tidak bisa membaca, mengubah, atau menghapus kebiasaan, centang, dan pengeluaran milik user A (uji ganti ID)", async () => {
    const habit = await post("habits", anonKey as string, tokenA, { user_id: idA, name: "Milik A" });
    expect(habit.status).toBe(201);
    const habitId = (habit.body as { id: string }[])[0].id;

    const log = await post("habit_logs", anonKey as string, tokenA, { habit_id: habitId, user_id: idA, date: "2026-10-29" });
    expect(log.status).toBe(201);

    const expense = await post("expenses", anonKey as string, tokenA, {
      user_id: idA,
      date: "2026-10-29",
      amount: 12345,
      category: "makan",
    });
    expect(expense.status).toBe(201);
    const expenseId = (expense.body as { id: string }[])[0].id;

    // B asks for A's rows by their exact ids: nothing comes back.
    for (const path of [
      `habits?id=eq.${habitId}`,
      `habit_logs?habit_id=eq.${habitId}`,
      `expenses?id=eq.${expenseId}`,
    ]) {
      const read = await get(path, anonKey as string, tokenB);
      expect(read.body, path).toEqual([]);
    }

    // B cannot change or remove them either; the rows are untouched afterwards.
    await patch(`habits?id=eq.${habitId}`, anonKey as string, tokenB, { name: "Dibajak" });
    await patch(`expenses?id=eq.${expenseId}`, anonKey as string, tokenB, { amount: 1 });
    await fetch(`${url}/rest/v1/expenses?id=eq.${expenseId}`, {
      method: "DELETE",
      headers: authHeaders(anonKey as string, tokenB),
    });
    await fetch(`${url}/rest/v1/habit_logs?habit_id=eq.${habitId}`, {
      method: "DELETE",
      headers: authHeaders(anonKey as string, tokenB),
    });

    const stillA = await get(`expenses?id=eq.${expenseId}&select=amount`, serviceKey as string);
    expect(stillA.body).toEqual([{ amount: 12345 }]);
    const habitAfter = await get(`habits?id=eq.${habitId}&select=name`, serviceKey as string);
    expect(habitAfter.body).toEqual([{ name: "Milik A" }]);
    const logAfter = await get(`habit_logs?habit_id=eq.${habitId}&select=date`, serviceKey as string);
    expect(logAfter.body).toEqual([{ date: "2026-10-29" }]);

    // B cannot attach a log to A's habit, which would distort A's streak.
    const forged = await post("habit_logs", anonKey as string, tokenB, {
      habit_id: habitId,
      user_id: idB,
      date: "2026-10-28",
    });
    expect(forged.status).toBeGreaterThanOrEqual(400);
  });

  it("habit tidak bisa dihapus dari browser, hanya diarsipkan (HABIT-1)", async () => {
    const created = await post("habits", anonKey as string, tokenA, { user_id: idA, name: "Jalan sore" });
    expect(created.status).toBe(201);
    const habitId = (created.body as { id: string }[])[0].id;

    const removal = await fetch(`${url}/rest/v1/habits?id=eq.${habitId}`, {
      method: "DELETE",
      headers: { ...authHeaders(anonKey as string, tokenA), Prefer: "return=representation" },
    });
    expect(removal.status).toBeGreaterThanOrEqual(400);

    const { body } = await get(`habits?select=id&id=eq.${habitId}`, anonKey as string, tokenA);
    expect(body).toEqual([{ id: habitId }]);

    // Columns that are not part of the edit form stay out of the user's reach.
    const reassign = await patch(`habits?id=eq.${habitId}`, anonKey as string, tokenA, {
      user_id: idB,
    });
    expect(reassign.status).toBeGreaterThanOrEqual(400);
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
