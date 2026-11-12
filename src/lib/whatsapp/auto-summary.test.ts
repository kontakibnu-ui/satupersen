import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SummaryOutcome } from "@/lib/ai/summarize-day";
import { runAutoSummaries, type AutoSummaryDeps } from "@/lib/whatsapp/auto-summary";

/**
 * The 22:00 automatic summary against the real local database (TASKS.md 5.6,
 * PRD.md §6 item 6). Only the model and the sender are stand-ins.
 *
 * Needs LOCAL_SUPABASE_URL and LOCAL_SUPABASE_SERVICE_KEY, like the RLS tests;
 * without them, or with the stack stopped, the file is skipped.
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

/** 22:30 on Monday 2026-11-02 in Asia/Jakarta, which is 15:30 UTC. */
const NIGHT = new Date("2026-11-02T15:30:00Z");
const NIGHT_DAY = "2026-11-02";

let admin: SupabaseClient;
const created: string[] = [];
let counter = 0;

type Sent = { to: string; body: string };

function deps(overrides: Partial<AutoSummaryDeps> = {}) {
  const state = { asked: [] as { userId: string; date: string }[], sent: [] as Sent[] };

  const base: AutoSummaryDeps = {
    admin,
    now: NIGHT,
    summarize: async (input): Promise<SummaryOutcome> => {
      state.asked.push({ userId: input.userId, date: input.date });

      return {
        kind: "summary",
        summary: "s",
        strengths: [],
        improvements: [],
        tomorrowTip: "Tidur lebih awal.",
        score: 71,
        delta: null,
        comparedTo: null,
        scoreReason: "Alasan skor.",
      };
    },
    send: async (to, body) => {
      state.sent.push({ to, body });
      counter += 1;

      return `wamid.otomatis.${Date.now()}.${counter}`;
    },
    appUrl: "https://contoh.test",
    maxSummaries: 100,
    ...overrides,
  };

  return { deps: base, state };
}

async function user(
  options: {
    timezone?: string;
    optedIn?: boolean;
    entry?: string | null;
    lastInboundMinutesAgo?: number;
    summaryStatus?: "done" | "failed" | "pending";
  } = {},
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `otomatis-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
    password: "RahasiaUji123!",
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Gagal membuat user uji: ${error?.message}`);
  }

  const id = data.user.id;
  created.push(id);

  const timezone = options.timezone ?? "Asia/Jakarta";
  await admin.from("profiles").update({ consented_at: new Date().toISOString(), timezone }).eq("id", id);

  const phone = `628${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
  await admin.from("whatsapp_links").insert({
    user_id: id,
    phone,
    verified_at: new Date().toISOString(),
    opted_in: options.optedIn ?? true,
    last_inbound_at: new Date(NIGHT.getTime() - (options.lastInboundMinutesAgo ?? 120) * 60_000).toISOString(),
  });

  // The user's own day at that instant: Jakarta is already on 2 November, Makassar too.
  if (options.entry !== null) {
    await admin.from("entries").insert({ user_id: id, date: NIGHT_DAY, content: options.entry ?? "Hari ini aku belajar masak dan jalan sore." });
  }

  if (options.summaryStatus) {
    await admin.from("daily_summaries").insert({
      user_id: id,
      date: NIGHT_DAY,
      status: options.summaryStatus,
      ...(options.summaryStatus === "done" ? { summary: "sudah", score: 60, score_reason: "x" } : {}),
    });
  }

  return { id, phone };
}

describe.skipIf(!stackIsUp)("ringkasan otomatis 22:00 dengan database sungguhan", () => {
  beforeAll(() => {
    admin = createClient(url as string, serviceKey as string, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("merangkum hari yang ada tulisannya tetapi belum dirangkum, dan mengirimnya selagi jendela 24 jam terbuka", async () => {
    const target = await user();
    const { deps: d, state } = deps();

    const result = await runAutoSummaries(d);

    expect(state.asked.filter((call) => call.userId === target.id)).toEqual([{ userId: target.id, date: NIGHT_DAY }]);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const message = state.sent.find((sent) => sent.to === target.phone);
    expect(message?.body).toContain("Ini analisa pertamamu.");
    expect(message?.body).not.toContain("/100");
    expect(message?.body).toContain("https://contoh.test/dashboard");

    const { data } = await admin.from("wa_messages").select("kind").eq("user_id", target.id).eq("direction", "out");
    expect(data).toEqual([{ kind: "summary" }]);
  });

  it("dijalankan berulang atau bersamaan hanya merangkum sekali", async () => {
    const target = await user();
    const { deps: d, state } = deps();

    await Promise.all([runAutoSummaries(d), runAutoSummaries(d)]);
    await runAutoSummaries(d);

    expect(state.asked.filter((call) => call.userId === target.id)).toHaveLength(1);
    expect(state.sent.filter((sent) => sent.to === target.phone)).toHaveLength(1);
  });

  it("belum pukul 22:00 waktu user: tidak ada yang dirangkum; zona waktu lain memakai jam sendiri", async () => {
    const jakarta = await user();
    // 15:30 UTC is 23:30 in Makassar: past 22:00 there too, so use an earlier instant for the cut.
    const beforeTen = new Date("2026-11-02T14:30:00Z"); // 21:30 Jakarta, 22:30 Makassar
    const makassar = await user({ timezone: "Asia/Makassar" });
    const { deps: d, state } = deps({ now: beforeTen });

    await runAutoSummaries(d);

    expect(state.asked.some((call) => call.userId === jakarta.id)).toBe(false);
    expect(state.asked.some((call) => call.userId === makassar.id)).toBe(true);
  });

  it("tidak merangkum hari tanpa tulisan, atau yang sudah dirangkum", async () => {
    const blank = await user({ entry: "   " });
    const none = await user({ entry: null });
    const finished = await user({ summaryStatus: "done" });
    const { deps: d, state } = deps();

    await runAutoSummaries(d);

    for (const person of [blank, none, finished]) {
      expect(state.asked.some((call) => call.userId === person.id)).toBe(false);
    }
  });

  it("balasan otomatis yang dimatikan (BERHENTI) berarti tidak ada ringkasan otomatis", async () => {
    const stopped = await user({ optedIn: false });
    const { deps: d, state } = deps();

    await runAutoSummaries(d);

    expect(state.asked.some((call) => call.userId === stopped.id)).toBe(false);
  });

  it("jendela 24 jam sudah tertutup: ringkasan dibuat tetapi tidak dikirim, tersedia di web", async () => {
    const lapsed = await user({ lastInboundMinutesAgo: 30 * 60 });
    const { deps: d, state } = deps();

    await runAutoSummaries(d);

    expect(state.asked.some((call) => call.userId === lapsed.id)).toBe(true);
    expect(state.sent.some((sent) => sent.to === lapsed.phone)).toBe(false);
  });

  it("ringkasan yang gagal tadi dicoba lagi, dan yang masih diproses run lain tidak disentuh", async () => {
    const failed = await user({ summaryStatus: "failed" });
    const inFlight = await user({ summaryStatus: "pending" });
    const { deps: d, state } = deps();

    await runAutoSummaries(d);

    expect(state.asked.some((call) => call.userId === failed.id)).toBe(true);
    expect(state.asked.some((call) => call.userId === inFlight.id)).toBe(false);
  });

  it("hari krisis tidak mengirim apa pun ke chat", async () => {
    const target = await user();
    const { deps: d, state } = deps({ summarize: async () => ({ kind: "crisis" }) });

    await runAutoSummaries(d);

    expect(state.sent.some((sent) => sent.to === target.phone)).toBe(false);
  });

  it("kegagalan model tercatat dan tidak menjatuhkan seluruh putaran", async () => {
    const first = await user();
    const second = await user();
    let calls = 0;
    const { deps: d } = deps({
      summarize: async () => {
        calls += 1;
        throw new Error("model tidak menjawab");
      },
    });

    const result = await runAutoSummaries(d);

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBeGreaterThanOrEqual(2);
    expect([first.id, second.id]).toHaveLength(2);
  });

  it("satu putaran merangkum paling banyak sebanyak batasnya", async () => {
    await Promise.all([user(), user(), user()]);
    const { deps: d } = deps({ maxSummaries: 1 });

    const result = await runAutoSummaries(d);

    expect(result.summarized + result.failed).toBe(1);
  });
});
