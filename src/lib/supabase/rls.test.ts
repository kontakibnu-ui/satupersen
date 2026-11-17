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

  let materialId = "";

  it("Belajar: free hanya 1 materi seumur akun, hapus tidak membuka slot, premium tanpa batas (LEARN-5)", async () => {
    // Columns the server owns cannot be set by the browser, not even on insert.
    const forgedStatus = await post("study_materials", anonKey as string, tokenA, {
      user_id: idA,
      title: "Fotosintesis",
      source: "Tumbuhan membuat makanan dari cahaya.",
      status: "active",
    });
    expect(forgedStatus.status).toBeGreaterThanOrEqual(400);

    const first = await post("study_materials", anonKey as string, tokenA, {
      user_id: idA,
      title: "Fotosintesis",
      source: "Tumbuhan membuat makanan dari cahaya.",
    });
    expect(first.status).toBe(201);
    const firstRow = (first.body as { id: string; status: string }[])[0];
    expect(firstRow.status).toBe("draft");

    const second = await post("study_materials", anonKey as string, tokenA, {
      user_id: idA,
      title: "Hukum Newton",
      source: "Benda diam tetap diam.",
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(second.body)).toContain("study_material_limit_reached");

    // Deleting gives no slot back: the count of materials ever made is what counts.
    const removal = await fetch(`${url}/rest/v1/study_materials?id=eq.${firstRow.id}`, {
      method: "DELETE",
      headers: authHeaders(anonKey as string, tokenA),
    });
    expect(removal.status).toBe(204);

    const afterDelete = await post("study_materials", anonKey as string, tokenA, {
      user_id: idA,
      title: "Hukum Newton",
      source: "Benda diam tetap diam.",
    });
    expect(JSON.stringify(afterDelete.body)).toContain("study_material_limit_reached");

    // The counter itself is out of the user's reach.
    const resetCounter = await patch(`profiles?id=eq.${idA}`, anonKey as string, tokenA, {
      study_materials_created: 0,
    });
    expect(resetCounter.status).toBeGreaterThanOrEqual(400);

    await patch(`profiles?id=eq.${idA}`, serviceKey as string, undefined, { plan: "premium" });

    try {
      for (const title of ["Hukum Newton", "Sel hewan"]) {
        const created = await post("study_materials", anonKey as string, tokenA, {
          user_id: idA,
          title,
          source: `Bahan ${title}.`,
        });
        expect(created.status).toBe(201);
        materialId = (created.body as { id: string }[])[0].id;
      }
    } finally {
      await patch(`profiles?id=eq.${idA}`, serviceKey as string, undefined, { plan: "free" });
    }
  });

  it("Belajar: user B tidak bisa membaca, mengubah, atau menghapus materi user A (uji ganti ID, LEARN-8)", async () => {
    const read = await get(`study_materials?select=id&id=eq.${materialId}`, anonKey as string, tokenB);
    expect(read.body).toEqual([]);

    const changed = await patch(`study_materials?id=eq.${materialId}`, anonKey as string, tokenB, {
      title: "Diambil alih",
    });
    expect(changed.body).toEqual([]);

    const removal = await fetch(`${url}/rest/v1/study_materials?id=eq.${materialId}`, {
      method: "DELETE",
      headers: { ...authHeaders(anonKey as string, tokenB), Prefer: "return=representation" },
    });
    expect(await removal.json()).toEqual([]);

    const forged = await post("study_materials", anonKey as string, tokenB, {
      user_id: idA,
      title: "Atas nama A",
      source: "Bahan palsu.",
    });
    expect(forged.status).toBeGreaterThanOrEqual(400);

    const own = await get(`study_materials?select=title&id=eq.${materialId}`, anonKey as string, tokenA);
    expect(own.body).toEqual([{ title: "Sel hewan" }]);
  });

  it("Belajar: pertanyaan, review, kuota, dan rate limit hanya ditulis server (LEARN-3, LEARN-5, RATE-1)", async () => {
    // The AI's columns and the schedule are not the user's to write.
    const forgedFeedback = await patch(`study_materials?id=eq.${materialId}`, anonKey as string, tokenA, {
      status: "active",
      feedback: { summary: "palsu" },
    });
    expect(forgedFeedback.status).toBeGreaterThanOrEqual(400);

    const question = await post("study_questions", anonKey as string, tokenA, {
      material_id: materialId,
      user_id: idA,
      position: 1,
      prompt: "Pertanyaan palsu?",
      answer: "Jawaban palsu.",
      kind: "recall",
    });
    expect(question.status).toBeGreaterThanOrEqual(400);

    const check = await post("study_checks", anonKey as string, tokenA, {
      user_id: idA,
      material_id: materialId,
      date: "2026-11-15",
      kind: "review",
    });
    expect(check.status).toBeGreaterThanOrEqual(400);

    const limits = await get("rate_limits?select=*", anonKey as string, tokenA);
    expect(limits.status).toBeGreaterThanOrEqual(400);

    for (const fn of [
      "take_rate_limit",
      "reserve_study_check",
      "store_study_explanation_check",
      "save_study_review",
      "store_study_review_feedback",
    ]) {
      const call = await post(`rpc/${fn}`, anonKey as string, tokenA, {});
      expect(call.status, fn).toBeGreaterThanOrEqual(400);
    }
  });

  it("Belajar: bahan terkunci setelah materi aktif, judul tetap bisa diubah (LEARN-2)", async () => {
    const activated = await patch(`study_materials?id=eq.${materialId}`, serviceKey as string, undefined, {
      status: "active",
    });
    expect(activated.status).toBe(200);

    const sourceChange = await patch(`study_materials?id=eq.${materialId}`, anonKey as string, tokenA, {
      source: "Bahan baru yang lain sama sekali.",
    });
    expect(sourceChange.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(sourceChange.body)).toContain("study_source_locked");

    const titleChange = await patch(`study_materials?id=eq.${materialId}`, anonKey as string, tokenA, {
      title: "Sel hewan dan tumbuhan",
    });
    expect(titleChange.status).toBe(200);
  });

  it("review tersimpan utuh atau tidak sama sekali, dan pertanyaan user lain tidak bisa ikut (LEARN-3, LEARN-4)", async () => {
    const question = await post("study_questions", serviceKey as string, undefined, {
      material_id: materialId,
      user_id: idA,
      position: 1,
      prompt: "Apa isi sel hewan?",
      answer: "Inti sel dan sitoplasma.",
      kind: "recall",
      due_date: "2026-11-15",
    });
    expect(question.status).toBe(201);
    const questionId = (question.body as { id: string }[])[0].id;

    // One real question and one that is not on this material: nothing may land.
    const mixed = await post("rpc/save_study_review", serviceKey as string, undefined, {
      p_user: idA,
      p_material: materialId,
      p_day: "2026-11-15",
      p_items: [
        { question_id: questionId, answer: "Inti sel", rating: "remembered", step: 1, due_date: "2026-11-18" },
        { question_id: "00000000-0000-4000-8000-000000000000", answer: "", rating: "forgot", step: 0, due_date: "2026-11-16" },
      ],
    });
    expect(mixed.status).toBeGreaterThanOrEqual(400);
    expect((await get(`study_reviews?select=id&question_id=eq.${questionId}`, serviceKey as string)).body).toEqual([]);
    expect((await get(`study_questions?select=step,due_date&id=eq.${questionId}`, serviceKey as string)).body).toEqual([
      { step: 0, due_date: "2026-11-15" },
    ]);

    // The same session on its own lands whole: the review and the moved question.
    const clean = await post("rpc/save_study_review", serviceKey as string, undefined, {
      p_user: idA,
      p_material: materialId,
      p_day: "2026-11-15",
      p_items: [{ question_id: questionId, answer: "Inti sel", rating: "remembered", step: 1, due_date: "2026-11-18" }],
    });
    expect(clean.status).toBeLessThan(300);
    expect((await get(`study_questions?select=step,due_date&id=eq.${questionId}`, serviceKey as string)).body).toEqual([
      { step: 1, due_date: "2026-11-18" },
    ]);

    // A second submit of the same day changes nothing.
    const again = await post("rpc/save_study_review", serviceKey as string, undefined, {
      p_user: idA,
      p_material: materialId,
      p_day: "2026-11-15",
      p_items: [{ question_id: questionId, answer: "Lagi", rating: "forgot", step: 0, due_date: "2026-11-16" }],
    });
    expect(JSON.stringify(again.body)).toContain("23505");
    expect((await get(`study_questions?select=step&id=eq.${questionId}`, serviceKey as string)).body).toEqual([{ step: 1 }]);

    // Feedback for another user's review is refused as a whole.
    const [review] = (await get(`study_reviews?select=id&question_id=eq.${questionId}`, serviceKey as string)).body as {
      id: number;
    }[];
    const foreign = await post("rpc/store_study_review_feedback", serviceKey as string, undefined, {
      p_user: idB,
      p_items: [{ id: review.id, feedback: "Bukan milikmu." }],
    });
    expect(foreign.status).toBeGreaterThanOrEqual(400);
    expect((await get(`study_reviews?select=feedback&id=eq.${review.id}`, serviceKey as string)).body).toEqual([
      { feedback: null },
    ]);
  });

  it("reserve_study_check menahan kuota dan take_rate_limit menahan panggilan keenam (LEARN-5, RATE-1)", async () => {
    const reserve = (scope: string, limit: number) =>
      post("rpc/reserve_study_check", serviceKey as string, undefined, {
        p_user: idA,
        p_material: materialId,
        p_date: "2026-11-15",
        p_kind: "explanation",
        p_scope: scope,
        p_limit: limit,
      });

    const firstCheck = await reserve("account", 1);
    expect(typeof firstCheck.body).toBe("number");
    const secondCheck = await reserve("account", 1);
    expect(secondCheck.body).toBeNull();
    // Per material for premium: the same day still has 9 of 10 left.
    const perMaterial = await reserve("material", 10);
    expect(typeof perMaterial.body).toBe("number");

    const waits: number[] = [];

    // An hour long window, so six calls a few milliseconds apart never straddle
    // two windows; the app itself uses a one minute window.
    for (let hit = 0; hit < 6; hit += 1) {
      const taken = await post("rpc/take_rate_limit", serviceKey as string, undefined, {
        p_user: idA,
        p_bucket: `uji-${stamp}`,
        p_limit: 5,
        p_window_seconds: 3600,
      });
      waits.push(taken.body as number);
    }

    expect(waits.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(waits[5]).toBeGreaterThan(0);
    expect(waits[5]).toBeLessThanOrEqual(3600);
  });

  it("Ruang baca: buku hanya dibuat server, user hanya memindah posisi, file orang lain tertutup (READ-2, READ-6, READ-8)", async () => {
    const storage = `${url}/storage/v1`;
    const startUpload = (size: number, title = "Catatan Kecil") =>
      post("rpc/start_book_upload", serviceKey as string, undefined, {
        p_user: idA,
        p_title: title,
        p_format: "txt",
        p_size: size,
      });
    const finishUpload = (bookId: string, size: number) =>
      post("rpc/finish_book_upload", serviceKey as string, undefined, { p_user: idA, p_book: bookId, p_size: size });
    const signUpload = async (path: string) => {
      const response = await fetch(`${storage}/object/upload/sign/books/${path}`, {
        method: "POST",
        headers: authHeaders(serviceKey as string),
        body: "{}",
      });
      const body = (await response.json()) as { url: string };
      const token = new URL(`${storage}${body.url}`).searchParams.get("token");
      expect(token).toBeTruthy();
      return token as string;
    };
    const putSigned = (path: string, token: string, body: string, contentType: string) =>
      fetch(`${storage}/object/upload/sign/books/${path}?token=${token}`, {
        method: "PUT",
        headers: { apikey: anonKey as string, "content-type": contentType, "x-upsert": "false" },
        body,
      });
    const download = (path: string, token: string) =>
      fetch(`${storage}/object/books/${path}`, { headers: authHeaders(anonKey as string, token) });
    const text = "Rasa akrab itu menipu.";

    // The browser cannot make a book row, not even for itself.
    const forgedRow = await post("books", anonKey as string, tokenA, {
      user_id: idA,
      title: "Palsu",
      format: "txt",
      size_bytes: 10,
      storage_path: `${idA}/palsu`,
      status: "ready",
    });
    expect(forgedRow.status).toBeGreaterThanOrEqual(400);

    const started = await startUpload(text.length);
    expect(started.status).toBe(200);
    const bookId = started.body as string;
    const path = `${idA}/${bookId}`;

    // Free: one book, and an upload in flight already holds the slot.
    const second = await startUpload(10, "Kedua");
    expect(JSON.stringify(second.body)).toContain("book_limit_reached");

    // A position cannot be saved before the file is in, and the title never by the user.
    const earlyPosition = await patch(`books?id=eq.${bookId}`, anonKey as string, tokenA, { progress: 0.5 });
    expect(earlyPosition.body).toEqual([]);
    const renamed = await patch(`books?id=eq.${bookId}`, anonKey as string, tokenA, { title: "Diganti" });
    expect(renamed.status).toBeGreaterThanOrEqual(400);

    // Uploading straight into the bucket with the user's own session is refused.
    const directUpload = await fetch(`${storage}/object/books/${path}`, {
      method: "POST",
      headers: { ...authHeaders(anonKey as string, tokenA), "content-type": "text/plain" },
      body: text,
    });
    expect(directUpload.status).toBeGreaterThanOrEqual(400);

    // The bucket accepts only the four book types.
    const wrongTypeToken = await signUpload(`${idA}/bukan-buku`);
    const wrongType = await putSigned(`${idA}/bukan-buku`, wrongTypeToken, "<script></script>", "text/html");
    expect(wrongType.status).toBeGreaterThanOrEqual(400);

    const uploadToken = await signUpload(path);
    const uploaded = await putSigned(path, uploadToken, text, "text/plain");
    expect(uploaded.status).toBe(200);

    const info = await fetch(`${storage}/object/info/books/${path}`, { headers: authHeaders(serviceKey as string) });
    const stored = (await info.json()) as { size?: number; metadata?: { size?: number } };
    const storedSize = stored.size ?? stored.metadata?.size;
    expect(storedSize).toBe(text.length);

    expect((await finishUpload(bookId, storedSize as number)).body).toBe("ready");
    expect((await get(`profiles?select=books_created&id=eq.${idA}`, serviceKey as string)).body).toEqual([
      { books_created: 1 },
    ]);

    // The owner reads the row and the file and moves the position.
    const ownRow = await get(`books?select=title,status&id=eq.${bookId}`, anonKey as string, tokenA);
    expect(ownRow.body).toEqual([{ title: "Catatan Kecil", status: "ready" }]);
    const moved = await patch(`books?id=eq.${bookId}`, anonKey as string, tokenA, { progress: 0.34, location: "epubcfi(/6/4)" });
    expect(moved.body).toEqual([expect.objectContaining({ progress: 0.34 })]);
    const ownFile = await download(path, tokenA);
    expect(ownFile.status).toBe(200);
    expect(await ownFile.text()).toBe(text);

    // User B gets nothing: not the row, not the file, not the position (ID swap test).
    expect((await get(`books?select=id&id=eq.${bookId}`, anonKey as string, tokenB)).body).toEqual([]);
    const stolenFile = await download(path, tokenB);
    expect(stolenFile.status).toBeGreaterThanOrEqual(400);
    expect(await stolenFile.text()).not.toContain(text);
    const hijacked = await patch(`books?id=eq.${bookId}`, anonKey as string, tokenB, { progress: 0.99 });
    expect(hijacked.body).toEqual([]);
    const anonFile = await fetch(`${storage}/object/books/${path}`, { headers: authHeaders(anonKey as string) });
    expect(anonFile.status).toBeGreaterThanOrEqual(400);

    // Users cannot delete files or rows themselves; the server does both.
    const userDelete = await fetch(`${storage}/object/books/${path}`, {
      method: "DELETE",
      headers: authHeaders(anonKey as string, tokenA),
    });
    expect((await download(path, tokenA)).status).toBe(200);
    expect(userDelete.status === 200 ? await userDelete.text() : "").not.toContain(bookId);
    const rowDelete = await fetch(`${url}/rest/v1/books?id=eq.${bookId}`, {
      method: "DELETE",
      headers: { ...authHeaders(anonKey as string, tokenA), Prefer: "return=representation" },
    });
    expect(rowDelete.status).toBeGreaterThanOrEqual(400);

    await fetch(`${storage}/object/books`, {
      method: "DELETE",
      headers: authHeaders(serviceKey as string),
      body: JSON.stringify({ prefixes: [path, `${idA}/bukan-buku`] }),
    });
    await fetch(`${url}/rest/v1/books?id=eq.${bookId}`, { method: "DELETE", headers: authHeaders(serviceKey as string) });

    // Deleting gives no slot back.
    expect(JSON.stringify((await startUpload(10, "Lagi")).body)).toContain("book_limit_reached");

    // Premium: 2 GB across every book, 50 MB per file.
    await patch(`profiles?id=eq.${idA}`, serviceKey as string, undefined, { plan: "premium" });

    try {
      expect(JSON.stringify((await startUpload(2147483649)).body)).toContain("book_storage_full");
      const premiumBook = (await startUpload(10, "Premium")).body as string;
      expect(typeof premiumBook).toBe("string");
      expect((await finishUpload(premiumBook, 52428801)).body).toBe("too_large");
      expect((await finishUpload(premiumBook, 10)).body).toBe("ready");
      expect((await finishUpload(premiumBook, 10)).body).toBe("not_found");
    } finally {
      await patch(`profiles?id=eq.${idA}`, serviceKey as string, undefined, { plan: "free" });
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
