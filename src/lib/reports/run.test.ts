import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GeneratedReport } from "@/lib/ai/openrouter";
import type { ReportPromptInput } from "@/lib/ai/prompts";
import { addDays } from "@/lib/dates";
import { runReports, type ReportGenerator } from "@/lib/reports/run";

/**
 * The scheduled report run against the real local database (REPORT-1, REPORT-2,
 * REPORT-4, TASKS.md 4.3 and 4.5). Only the model is a stand-in, and only in
 * this file: what is under test is who gets a report, when, how many times, and
 * from whose data.
 *
 * Needs LOCAL_SUPABASE_URL and LOCAL_SUPABASE_SERVICE_KEY, like the RLS tests;
 * without them, or with the stack stopped, the file is skipped so `npm test`
 * stays offline.
 */

const url = process.env.LOCAL_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;

async function isReachable(): Promise<boolean> {
  if (!url || !serviceKey) {
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

/** Monday 2026-11-02 08:00 in Asia/Jakarta. The week before is 2026-10-26 to 2026-11-01. */
const MONDAY_8AM = new Date("2026-11-02T01:00:00Z");
/** The same Monday at 06:59 Jakarta time, one minute before the due time. */
const MONDAY_BEFORE_7 = new Date("2026-11-01T23:59:00Z");
const WEEK = { start: "2026-10-26", end: "2026-11-01" };
const MONTH = { start: "2026-10-01", end: "2026-10-31" };

let admin: SupabaseClient;
const created: string[] = [];
const calls: ReportPromptInput[] = [];

const okGenerator: ReportGenerator = async (input): Promise<GeneratedReport> => {
  calls.push(input);

  return input.variant === "brief"
    ? { variant: "brief", text: { trend: "tren", focus: "fokus" }, model: "model-uji" }
    : {
        variant: "full",
        text: { trend: "tren", patterns: ["pola satu", "pola dua"], focus: "fokus", insights: ["tautan dua area"] },
        model: "model-uji",
      };
};

const callsFor = (marker: string) =>
  calls.filter((call) => call.days.some((day) => day.summary.includes(marker)));

async function makeUser(
  label: string,
  options: { plan?: "free" | "premium"; timezone?: string } = {},
): Promise<{ id: string; marker: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `laporan-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
    password: "RahasiaUji123!",
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Gagal membuat user uji: ${error?.message}`);
  }

  created.push(data.user.id);

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      consented_at: new Date().toISOString(),
      plan: options.plan ?? "free",
      timezone: options.timezone ?? "Asia/Jakarta",
    })
    .eq("id", data.user.id);

  if (profileError) {
    throw new Error(`Gagal menyiapkan profil uji: ${profileError.message}`);
  }

  return { id: data.user.id, marker: `RAHASIA-${label}` };
}

/** One scored day each, from `from` to `to`, with the marker inside the summary text. */
async function seedScores(user: { id: string; marker: string }, from: string, to: string, score: (day: number) => number) {
  const rows = [];

  for (let day = from, index = 0; day <= to; day = addDays(day, 1), index += 1) {
    rows.push({
      user_id: user.id,
      date: day,
      status: "done",
      score: score(index),
      summary: `${user.marker} ${day}`,
      score_reason: "alasan",
      strengths: [],
      improvements: [],
      tomorrow_tip: "tip",
      ai_dimension_score: 5,
      risk_flag: false,
      regen_count: 0,
    });
  }

  const { error } = await admin.from("daily_summaries").insert(rows);

  if (error) {
    throw new Error(`Gagal mengisi skor uji: ${error.message}`);
  }
}

async function reportsOf(userId: string) {
  const { data, error } = await admin
    .from("reports")
    .select("type, period_start, period_end, content")
    .eq("user_id", userId)
    .order("type", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data as { type: string; period_start: string; period_end: string; content: Record<string, unknown> }[];
}

describe.skipIf(!stackIsUp)("laporan terjadwal dengan database sungguhan", () => {
  beforeAll(() => {
    admin = createClient(url as string, serviceKey as string, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("paket gratis mendapat laporan mingguan ringkas, premium mendapat mingguan lengkap dan bulanan (REPORT-1, REPORT-4)", async () => {
    const free = await makeUser("gratis");
    const premium = await makeUser("premium", { plan: "premium" });

    await seedScores(free, WEEK.start, WEEK.end, (index) => 60 + index);
    // Premium has the two months before, so both the weekly and monthly changes can be measured.
    await seedScores(premium, "2026-09-01", "2026-11-01", (index) => 50 + (index % 20));

    const summary = await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });
    expect(summary.generated).toBeGreaterThanOrEqual(3);

    const freeReports = await reportsOf(free.id);
    expect(freeReports).toHaveLength(1);
    expect(freeReports[0]).toMatchObject({ type: "weekly", period_start: WEEK.start, period_end: WEEK.end });
    expect(freeReports[0].content).toMatchObject({
      status: "done",
      variant: "brief",
      scored_days: 7,
      period_days: 7,
      trend: "tren",
      focus: "fokus",
      patterns: [],
      insights: [],
      model: "model-uji",
    });

    const premiumReports = await reportsOf(premium.id);
    expect(premiumReports.map((report) => report.type)).toEqual(["monthly", "weekly"]);
    expect(premiumReports.find((report) => report.type === "monthly")).toMatchObject({
      period_start: MONTH.start,
      period_end: MONTH.end,
      content: { status: "done", variant: "full", scored_days: 31, patterns: ["pola satu", "pola dua"] },
    });
    expect(premiumReports.find((report) => report.type === "weekly")?.content).toMatchObject({
      status: "done",
      variant: "full",
    });
  });

  it("angka berasal dari kode: rata-rata dan persen perubahan dihitung dari skor, bukan dari model (REPORT-3)", async () => {
    const user = await makeUser("angka");
    // The week before scored 50 every day, the reported week 60: +20%.
    await seedScores(user, "2026-10-19", "2026-10-25", () => 50);
    await seedScores(user, WEEK.start, WEEK.end, () => 60);

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });

    const [report] = await reportsOf(user.id);
    expect(report.content).toMatchObject({
      average_score: 60,
      previous_average_score: 50,
      delta_pct: 20,
      scored_days: 7,
    });
  });

  it("dijalankan berulang tidak membuat laporan ganda dan tidak memanggil model lagi (REPORT-2)", async () => {
    const user = await makeUser("ulang");
    await seedScores(user, WEEK.start, WEEK.end, () => 70);

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });
    const callsAfterFirst = callsFor(user.marker).length;
    expect(callsAfterFirst).toBe(1);

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });
    await runReports({ admin, now: new Date("2026-11-03T05:00:00Z"), generate: okGenerator, maxGenerations: 50 });

    expect(callsFor(user.marker)).toHaveLength(callsAfterFirst);
    expect(await reportsOf(user.id)).toHaveLength(1);
  });

  it("dua tick bersamaan menulis laporan satu kali (REPORT-2)", async () => {
    const user = await makeUser("bersamaan");
    await seedScores(user, WEEK.start, WEEK.end, () => 65);

    await Promise.all([
      runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 }),
      runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 }),
    ]);

    expect(callsFor(user.marker)).toHaveLength(1);
    expect(await reportsOf(user.id)).toHaveLength(1);
  });

  it("belum jam 07:00 waktu user: tidak ada laporan; zona waktu lain memakai jam sendiri (REPORT-1)", async () => {
    const jakarta = await makeUser("jam-wib");
    const makassar = await makeUser("jam-wita", { timezone: "Asia/Makassar" });
    await seedScores(jakarta, WEEK.start, WEEK.end, () => 60);
    await seedScores(makassar, WEEK.start, WEEK.end, () => 60);

    // 06:59 in Jakarta is already 07:59 in Makassar.
    await runReports({ admin, now: MONDAY_BEFORE_7, generate: okGenerator, maxGenerations: 50 });

    expect(await reportsOf(jakarta.id)).toHaveLength(0);
    expect(await reportsOf(makassar.id)).toHaveLength(1);

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });
    expect(await reportsOf(jakarta.id)).toHaveLength(1);
  });

  it("periode dengan terlalu sedikit hari berskor ditandai dilewati dan tidak memanggil model", async () => {
    const user = await makeUser("tipis");
    await seedScores(user, "2026-10-26", "2026-10-27", () => 60);

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });

    const [report] = await reportsOf(user.id);
    expect(report.content).toMatchObject({ status: "skipped" });
    expect(callsFor(user.marker)).toHaveLength(0);
  });

  it("gagal dicoba lagi di tick berikutnya, berhenti setelah 3 percobaan, dan tidak menyimpan teks palsu", async () => {
    const user = await makeUser("gagal");
    await seedScores(user, WEEK.start, WEEK.end, () => 60);

    const failing: ReportGenerator = async (input) => {
      calls.push(input);
      throw new Error("model tidak menjawab");
    };

    await runReports({ admin, now: MONDAY_8AM, generate: failing, maxGenerations: 50 });
    expect((await reportsOf(user.id))[0].content).toEqual({ status: "failed", attempts: 1 });

    await runReports({ admin, now: MONDAY_8AM, generate: failing, maxGenerations: 50 });
    await runReports({ admin, now: MONDAY_8AM, generate: failing, maxGenerations: 50 });
    expect((await reportsOf(user.id))[0].content).toEqual({ status: "failed", attempts: 3 });

    // After three tries it stays failed instead of costing a model call every 15 minutes.
    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });
    expect(callsFor(user.marker)).toHaveLength(3);
    expect((await reportsOf(user.id))[0].content).toEqual({ status: "failed", attempts: 3 });
  });

  it("satu kegagalan lalu berhasil: laporan akhirnya jadi", async () => {
    const user = await makeUser("pulih");
    await seedScores(user, WEEK.start, WEEK.end, () => 60);

    const once: ReportGenerator = async (input) => {
      calls.push(input);
      throw new Error("sementara gagal");
    };

    await runReports({ admin, now: MONDAY_8AM, generate: once, maxGenerations: 50 });
    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });

    expect((await reportsOf(user.id))[0].content).toMatchObject({ status: "done", variant: "brief" });
  });

  it("tautan antar-area hanya jika mood dan pengeluaran masing-masing minimal 5 hari (REPORT-3)", async () => {
    const thin = await makeUser("tautan-tipis", { plan: "premium" });
    const rich = await makeUser("tautan-cukup", { plan: "premium" });

    for (const user of [thin, rich]) {
      await seedScores(user, WEEK.start, WEEK.end, () => 60);
    }

    const days = (count: number) => Array.from({ length: count }, (_, index) => addDays(WEEK.start, index));

    // Thin: mood on 4 days. Rich: mood and spending on 5 days each.
    await admin.from("entries").insert(days(4).map((date) => ({ user_id: thin.id, date, mood: 3, energy: 3 })));
    await admin.from("expenses").insert(days(7).map((date) => ({ user_id: thin.id, date, amount: 1000, category: "makan" })));
    await admin.from("entries").insert(days(5).map((date) => ({ user_id: rich.id, date, mood: 4, energy: 3 })));
    await admin.from("expenses").insert(days(5).map((date) => ({ user_id: rich.id, date, amount: 1000, category: "makan" })));

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });

    // The stand-in model always offers an insight; only the one with enough data may keep it.
    const weekly = async (id: string) =>
      (await reportsOf(id)).find((report) => report.type === "weekly")?.content;
    expect((await weekly(thin.id))?.insights).toEqual([]);
    expect((await weekly(rich.id))?.insights).toEqual(["tautan dua area"]);
  });

  it("laporan satu user tidak pernah memuat data user lain", async () => {
    const first = await makeUser("terpisah-a");
    const second = await makeUser("terpisah-b");
    await seedScores(first, WEEK.start, WEEK.end, () => 60);
    await seedScores(second, WEEK.start, WEEK.end, () => 60);

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });

    for (const call of callsFor(first.marker)) {
      expect(JSON.stringify(call)).not.toContain(second.marker);
    }
    for (const call of callsFor(second.marker)) {
      expect(JSON.stringify(call)).not.toContain(first.marker);
    }
    expect(callsFor(first.marker)).toHaveLength(1);
    expect(callsFor(second.marker)).toHaveLength(1);
  });

  it("satu tick menulis paling banyak sebanyak batasnya, sisanya di tick berikutnya", async () => {
    const users = await Promise.all([makeUser("batas-a"), makeUser("batas-b")]);
    for (const user of users) {
      await seedScores(user, WEEK.start, WEEK.end, () => 60);
    }

    const first = await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 1 });
    expect(first.generated).toBe(1);

    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 1 });
    await runReports({ admin, now: MONDAY_8AM, generate: okGenerator, maxGenerations: 50 });

    for (const user of users) {
      expect(await reportsOf(user.id)).toHaveLength(1);
      expect(callsFor(user.marker)).toHaveLength(1);
    }
  });
});
