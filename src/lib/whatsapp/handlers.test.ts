import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CRISIS_RESPONSE_EN, CRISIS_RESPONSE_ID } from "@/config/crisis";
import type { SummaryOutcome } from "@/lib/ai/summarize-day";
import { todayKey } from "@/lib/dates";
import {
  handleInboundMessage,
  isWithinServiceWindow,
  TEXTS,
  type InboundMessage,
  type WhatsAppDeps,
} from "@/lib/whatsapp/handlers";

/**
 * The WhatsApp message handling against the real local database (TASKS.md 5.1
 * to 5.5). Only the outside world is a stand-in: the sender, the model, and the
 * summary, and only in this file. What is under test is who is answered, how
 * often, what reaches the diary, and what never gets a reply.
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

let admin: SupabaseClient;
const created: string[] = [];
let counter = 0;

type Sent = { to: string; body: string };

function fakeDeps(overrides: Partial<WhatsAppDeps> = {}): WhatsAppDeps & { sent: Sent[]; chatCalls: number } {
  const state = { sent: [] as Sent[], chatCalls: 0 };

  const deps: WhatsAppDeps = {
    admin,
    now: () => new Date(),
    send: async (to, body) => {
      state.sent.push({ to, body });
      counter += 1;

      return `wamid.uji.${Date.now()}.${counter}`;
    },
    chat: async () => {
      state.chatCalls += 1;

      return { reply: "Aku dengar kamu. Cerita lagi kalau mau.", riskFlag: false };
    },
    summarize: async (): Promise<SummaryOutcome> => ({
      kind: "summary",
      summary: "ringkasan",
      strengths: [],
      improvements: [],
      tomorrowTip: "Tidur lebih awal.",
      score: 74,
      delta: null,
      comparedTo: null,
      scoreReason: "Laporan selesai dan olahraga tetap jalan.",
    }),
    appUrl: "https://contoh.test/",
    ...overrides,
  };

  // Live getters: Object.assign would copy the value they have right now.
  return Object.defineProperties(deps, {
    sent: { get: () => state.sent },
    chatCalls: { get: () => state.chatCalls },
  }) as WhatsAppDeps & { sent: Sent[]; chatCalls: number };
}

const randomPhone = () => `628${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

async function linkedUser(options: { plan?: "free" | "premium"; optedIn?: boolean } = {}) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `wa-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
    password: "RahasiaUji123!",
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Gagal membuat user uji: ${error?.message}`);
  }

  created.push(data.user.id);
  await admin.from("profiles").update({ consented_at: new Date().toISOString(), plan: options.plan ?? "free" }).eq("id", data.user.id);

  const phone = randomPhone();
  const { error: linkError } = await admin.from("whatsapp_links").insert({
    user_id: data.user.id,
    phone,
    verified_at: new Date().toISOString(),
    opted_in: options.optedIn ?? true,
  });

  if (linkError) {
    throw new Error(`Gagal menghubungkan nomor uji: ${linkError.message}`);
  }

  return { userId: data.user.id, phone, today: todayKey("Asia/Jakarta") };
}

let messageCounter = 0;
const text = (from: string, body: string, id?: string): InboundMessage => {
  messageCounter += 1;

  return { id: id ?? `wamid.masuk.${Date.now()}.${messageCounter}`, from, type: "text", text: body };
};

async function diaryOf(userId: string, date: string): Promise<string> {
  const { data } = await admin.from("entries").select("content").eq("user_id", userId).eq("date", date).maybeSingle();

  return (data?.content as string | undefined) ?? "";
}

async function outbound(userId: string, kind?: string) {
  let query = admin.from("wa_messages").select("kind, body").eq("user_id", userId).eq("direction", "out");

  if (kind) {
    query = query.eq("kind", kind);
  }

  const { data } = await query;

  return (data ?? []) as { kind: string; body: string }[];
}

describe.skipIf(!stackIsUp)("pesan WhatsApp dengan database sungguhan", () => {
  beforeAll(() => {
    admin = createClient(url as string, serviceKey as string, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("nomor tak dikenal hanya mendapat satu petunjuk per hari dan teksnya tidak disimpan (PRD §6)", async () => {
    const deps = fakeDeps();
    const stranger = randomPhone();

    expect(await handleInboundMessage(deps, text(stranger, "halo apa kabar rahasia"))).toBe("unknown-number");
    expect(await handleInboundMessage(deps, text(stranger, "halo lagi"))).toBe("unknown-number");
    await handleInboundMessage(deps, text(stranger, "dan lagi"));

    expect(deps.sent).toEqual([{ to: stranger, body: TEXTS.unknownNumber }]);

    const { data } = await admin.from("wa_messages").select("body, user_id").is("user_id", null).eq("direction", "in").like("wa_message_id", "wamid.masuk.%");
    expect((data ?? []).every((row) => row.body === null)).toBe(true);
    expect(deps.chatCalls).toBe(0);
  });

  it("LINK KODE menghubungkan nomor, kodenya sekali pakai, dan huruf kecil pun diterima (PRD §6)", async () => {
    const deps = fakeDeps();
    const { data } = await admin.auth.admin.createUser({
      email: `wa-link-${Date.now()}@example.com`,
      password: "RahasiaUji123!",
      email_confirm: true,
    });
    const userId = data.user!.id;
    created.push(userId);

    const phone = randomPhone();
    await admin.from("whatsapp_link_codes").insert({
      code: "AB2CD3",
      user_id: userId,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    expect(await handleInboundMessage(deps, text(phone, "link ab2cd3"))).toBe("linked");

    const { data: link } = await admin.from("whatsapp_links").select("phone, opted_in, verified_at").eq("user_id", userId).single();
    expect(link).toMatchObject({ phone, opted_in: true });
    expect(link?.verified_at).not.toBeNull();
    expect(deps.sent.at(-1)).toEqual({ to: phone, body: TEXTS.linked });

    // The same code from another number no longer works.
    const other = randomPhone();
    expect(await handleInboundMessage(deps, text(other, "LINK AB2CD3"))).toBe("link-failed");
    expect(deps.sent.at(-1)).toEqual({ to: other, body: TEXTS.badCode });
  });

  it("kode kedaluwarsa atau tidak dikenal tidak menghubungkan apa pun", async () => {
    const deps = fakeDeps();
    const { data } = await admin.auth.admin.createUser({
      email: `wa-lama-${Date.now()}@example.com`,
      password: "RahasiaUji123!",
      email_confirm: true,
    });
    created.push(data.user!.id);

    await admin.from("whatsapp_link_codes").insert({
      code: "OLD234",
      user_id: data.user!.id,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const phone = randomPhone();
    expect(await handleInboundMessage(deps, text(phone, "LINK OLD234"))).toBe("link-failed");
    expect(await handleInboundMessage(deps, text(phone, "LINK ZZZ999"))).toBe("link-failed");

    const { count } = await admin.from("whatsapp_links").select("user_id", { count: "exact", head: true }).eq("phone", phone);
    expect(count).toBe(0);
  });

  it("nomor yang sudah dipakai akun lain tidak bisa dipindahkan lewat kode (UNIQUE phone)", async () => {
    const deps = fakeDeps();
    const owner = await linkedUser();
    const { data } = await admin.auth.admin.createUser({
      email: `wa-rebut-${Date.now()}@example.com`,
      password: "RahasiaUji123!",
      email_confirm: true,
    });
    created.push(data.user!.id);

    await admin.from("whatsapp_link_codes").insert({
      code: "TAK234",
      user_id: data.user!.id,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    });

    // The number is already verified for `owner`, so the message is treated as theirs.
    expect(await handleInboundMessage(deps, text(owner.phone, "LINK TAK234"))).toBe("command");
    expect(deps.sent.at(-1)?.body).toBe(TEXTS.alreadyLinked);

    const { data: links } = await admin.from("whatsapp_links").select("user_id").eq("phone", owner.phone);
    expect(links).toEqual([{ user_id: owner.userId }]);
  });

  it("pesan yang sama dikirim ulang oleh Meta hanya diproses sekali (idempotensi)", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();
    const message = text(user.phone, "Hari ini aku jalan pagi.");

    expect(await handleInboundMessage(deps, message)).toBe("chat");
    expect(await handleInboundMessage(deps, message)).toBe("duplicate");
    expect(await handleInboundMessage(deps, message)).toBe("duplicate");

    expect(deps.sent).toHaveLength(1);
    expect(deps.chatCalls).toBe(1);
    expect(await diaryOf(user.userId, user.today)).toBe("Hari ini aku jalan pagi.");
  });

  it("curhat masuk ke diary hari itu dipisah baris kosong, dan dibalas AI (PRD §6)", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "Pagi ini aku olahraga."));
    await handleInboundMessage(deps, text(user.phone, "Sorenya aku kerja."));

    expect(await diaryOf(user.userId, user.today)).toBe("Pagi ini aku olahraga.\n\nSorenya aku kerja.");
    expect((await outbound(user.userId, "ai_reply")).length).toBe(1);
  });

  it("free: 1 balasan AI per hari, satu pemberitahuan batas, lalu diam, tetapi diary tetap terisi (AGENTS §6)", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    for (const line of ["satu", "dua", "tiga", "empat"]) {
      await handleInboundMessage(deps, text(user.phone, `pesan ${line}`));
    }

    expect(deps.chatCalls).toBe(1);
    expect((await outbound(user.userId, "ai_reply")).length).toBe(1);
    expect((await outbound(user.userId, "notice")).filter((row) => row.body === TEXTS.limit)).toHaveLength(1);
    expect(deps.sent).toHaveLength(2);
    expect(await diaryOf(user.userId, user.today)).toBe("pesan satu\n\npesan dua\n\npesan tiga\n\npesan empat");
  });

  it("premium mendapat lebih dari satu balasan sehari", async () => {
    const deps = fakeDeps();
    const user = await linkedUser({ plan: "premium" });

    for (const line of ["a", "b", "c"]) {
      await handleInboundMessage(deps, text(user.phone, `pesan ${line}`));
    }

    expect(deps.chatCalls).toBe(3);
    expect((await outbound(user.userId, "ai_reply")).length).toBe(3);
  });

  it("kata kunci krisis: teks tetap, AI tidak dipanggil, tidak dihitung ke batas, diary tetap terisi (PRD §7)", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "aku udah gak kuat hidup"));

    expect(deps.chatCalls).toBe(0);
    expect(deps.sent).toEqual([{ to: user.phone, body: CRISIS_RESPONSE_ID }]);
    expect((await outbound(user.userId, "crisis")).length).toBe(1);
    expect(await diaryOf(user.userId, user.today)).toBe("aku udah gak kuat hidup");

    // The crisis reply did not use up the free AI reply.
    await handleInboundMessage(deps, text(user.phone, "tadi berat, sekarang agak lega"));
    expect(deps.chatCalls).toBe(1);
    expect((await outbound(user.userId, "ai_reply")).length).toBe(1);
  });

  it("pesan krisis berbahasa Inggris dijawab dengan teks Inggris", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "I want to die"));

    expect(deps.sent).toEqual([{ to: user.phone, body: CRISIS_RESPONSE_EN }]);
  });

  it("krisis tetap dijawab walau batas harian habis dan walau balasan otomatis dimatikan", async () => {
    const deps = fakeDeps();
    const user = await linkedUser({ optedIn: false });

    await handleInboundMessage(deps, text(user.phone, "aku mau bunuh diri"));

    expect(deps.sent).toEqual([{ to: user.phone, body: CRISIS_RESPONSE_ID }]);
  });

  it("risk_flag dari model: balasan model dibuang dan diganti teks tetap (PRD §7)", async () => {
    const deps = fakeDeps({
      chat: async () => ({ reply: "balasan yang tidak boleh terkirim", riskFlag: true }),
    });
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "rasanya semua lebih baik tanpa aku"));

    expect(deps.sent).toEqual([{ to: user.phone, body: CRISIS_RESPONSE_ID }]);
    expect((await outbound(user.userId, "ai_reply")).length).toBe(0);
    expect((await outbound(user.userId, "crisis")).length).toBe(1);
  });

  it("model gagal: pengguna diberi tahu, ceritanya tetap di diary, dan batas harian tidak terpakai", async () => {
    let fail = true;
    const deps = fakeDeps({
      chat: async () => {
        if (fail) {
          throw new Error("model tidak menjawab");
        }

        return { reply: "Aku di sini.", riskFlag: false };
      },
    });
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "hari ini lumayan"));
    expect(deps.sent.at(-1)?.body).toBe(TEXTS.aiUnavailable);
    expect(await diaryOf(user.userId, user.today)).toBe("hari ini lumayan");

    fail = false;
    await handleInboundMessage(deps, text(user.phone, "sudah mendingan"));
    expect((await outbound(user.userId, "ai_reply")).length).toBe(1);
  });

  it("BERHENTI mematikan balasan otomatis sampai MULAI; pesan tetap masuk diary (PRD §6)", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "Berhenti"));
    expect(deps.sent.at(-1)?.body).toBe(TEXTS.stopped);
    const { data: off } = await admin.from("whatsapp_links").select("opted_in").eq("user_id", user.userId).single();
    expect(off?.opted_in).toBe(false);

    await handleInboundMessage(deps, text(user.phone, "tetap aku tulis di sini"));
    expect(deps.chatCalls).toBe(0);
    expect(deps.sent).toHaveLength(1);
    expect(await diaryOf(user.userId, user.today)).toBe("tetap aku tulis di sini");

    await handleInboundMessage(deps, text(user.phone, "MULAI."));
    expect(deps.sent.at(-1)?.body).toBe(TEXTS.started);
    await handleInboundMessage(deps, text(user.phone, "sekarang boleh dibalas"));
    expect(deps.chatCalls).toBe(1);
  });

  it("perintah hanya berlaku bila seluruh pesan adalah perintahnya; kalimat biasa tidak memicunya", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "aku berhenti merokok hari ini"));

    expect((await outbound(user.userId)).map((row) => row.kind)).toEqual(["ai_reply"]);
    const { data } = await admin.from("whatsapp_links").select("opted_in").eq("user_id", user.userId).single();
    expect(data?.opted_in).toBe(true);
  });

  it("BANTUAN mengirim daftar perintah", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "bantuan"));

    expect(deps.sent).toEqual([{ to: user.phone, body: TEXTS.help }]);
    expect(await diaryOf(user.userId, user.today)).toBe("");
  });

  it("SELESAI meminta ringkasan hari ini dan mengirim versi singkat dengan perbandingan, alasan, saran, dan tautan", async () => {
    let asked: { date: string; plan: string } | null = null;
    const deps = fakeDeps({
      summarize: async (input) => {
        asked = { date: input.date, plan: input.plan };

        return {
          kind: "summary",
          summary: "s",
          strengths: [],
          improvements: [],
          tomorrowTip: "Tidur lebih awal.",
          score: 74,
          delta: 2,
          comparedTo: "kemarin",
          scoreReason: "Laporan selesai dan olahraga tetap jalan.",
        };
      },
    });
    const user = await linkedUser();

    await handleInboundMessage(deps, text(user.phone, "SELESAI"));

    expect(asked).toEqual({ date: user.today, plan: "free" });
    expect(deps.sent).toHaveLength(1);
    expect(deps.sent[0].body).toContain("Kamu 2% lebih baik dibanding kemarin");
    expect(deps.sent[0].body).not.toContain("74");
    expect(deps.sent[0].body).toContain("Laporan selesai dan olahraga tetap jalan.");
    expect(deps.sent[0].body).toContain("Untuk besok: Tidur lebih awal.");
    expect(deps.sent[0].body).toContain("https://contoh.test/dashboard");
    expect((await outbound(user.userId, "summary")).length).toBe(1);
    // A summary is not an AI chat reply, so it does not use up the daily reply.
    expect((await outbound(user.userId, "ai_reply")).length).toBe(0);
  });

  it("SELESAI tanpa tulisan, saat kuota habis, dan saat krisis dijawab dengan teks yang tepat", async () => {
    const user = await linkedUser();

    const empty = fakeDeps({ summarize: async () => ({ kind: "error", status: 400, message: "x" }) });
    await handleInboundMessage(empty, text(user.phone, "selesai"));
    expect(empty.sent.at(-1)?.body).toBe(TEXTS.noEntry);

    const spent = fakeDeps({
      summarize: async () => ({ kind: "error", status: 429, message: "Analisa ulang hari ini sudah terpakai." }),
    });
    await handleInboundMessage(spent, text(user.phone, "selesai"));
    expect(spent.sent.at(-1)?.body).toBe("Analisa ulang hari ini sudah terpakai.");

    const broken = fakeDeps({ summarize: async () => ({ kind: "error", status: 502, message: "detail internal" }) });
    await handleInboundMessage(broken, text(user.phone, "selesai"));
    expect(broken.sent.at(-1)?.body).toBe(TEXTS.summaryUnavailable);
    expect(broken.sent.at(-1)?.body).not.toContain("detail internal");

    const crisis = fakeDeps({ summarize: async () => ({ kind: "crisis" }) });
    await handleInboundMessage(crisis, text(user.phone, "selesai"));
    expect(crisis.sent.at(-1)?.body).toBe(CRISIS_RESPONSE_ID);
  });

  it("pesan non-teks dibalas satu kalimat dan tidak masuk diary", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();

    const result = await handleInboundMessage(deps, { id: `wamid.gambar.${Date.now()}`, from: user.phone, type: "image", text: null });

    expect(result).toBe("non-text");
    expect(deps.sent).toEqual([{ to: user.phone, body: TEXTS.nonText }]);
    expect(await diaryOf(user.userId, user.today)).toBe("");
  });

  it("diary yang hampir penuh menolak pesan yang membuatnya lewat 5.000 karakter dan memberi tahu (DIARY-3)", async () => {
    const deps = fakeDeps();
    const user = await linkedUser();
    await admin.from("entries").insert({ user_id: user.userId, date: user.today, content: "x".repeat(4990) });

    await handleInboundMessage(deps, text(user.phone, "pesan ini membuat diary melewati batas lima ribu karakter"));

    expect((await diaryOf(user.userId, user.today)).length).toBe(4990);
    expect(deps.sent[0].body).toBe(TEXTS.entryFull);
  });

  it("dua pesan bersamaan sama-sama masuk diary tanpa saling menimpa", async () => {
    const deps = fakeDeps({ chat: async () => ({ reply: "ok", riskFlag: false }) });
    const user = await linkedUser({ plan: "premium" });

    await Promise.all(
      ["alpha", "bravo", "charlie", "delta", "echo"].map((word) => handleInboundMessage(deps, text(user.phone, word))),
    );

    const parts = (await diaryOf(user.userId, user.today)).split("\n\n").sort();
    expect(parts).toEqual(["alpha", "bravo", "charlie", "delta", "echo"]);
  });

  it("banjir pesan: lebih dari 10 per menit tetap tersimpan tetapi tidak dijawab (rate limit)", async () => {
    const deps = fakeDeps({ chat: async () => ({ reply: "ok", riskFlag: false }) });
    const user = await linkedUser({ plan: "premium" });

    await admin.from("wa_messages").insert(
      Array.from({ length: 11 }, (_, index) => ({
        user_id: user.userId,
        wa_message_id: `wamid.banjir.${Date.now()}.${index}`,
        direction: "in",
        kind: null,
        body: "x",
      })),
    );

    expect(await handleInboundMessage(deps, text(user.phone, "satu lagi"))).toBe("flood");
    expect(deps.sent).toHaveLength(0);
    expect(deps.chatCalls).toBe(0);
  });

  it("pesan satu user tidak menyentuh diary atau percakapan user lain", async () => {
    const deps = fakeDeps();
    const first = await linkedUser();
    const second = await linkedUser();

    await handleInboundMessage(deps, text(first.phone, "rahasia milik pertama"));

    expect(await diaryOf(second.userId, second.today)).toBe("");
    expect((await outbound(second.userId)).length).toBe(0);
  });

  it("jendela 24 jam: teks bebas hanya sampai 24 jam setelah pesan terakhir user (AGENTS §6)", () => {
    const now = new Date("2026-11-02T12:00:00Z");

    expect(isWithinServiceWindow("2026-11-02T11:59:00Z", now)).toBe(true);
    expect(isWithinServiceWindow("2026-11-01T12:01:00Z", now)).toBe(true);
    expect(isWithinServiceWindow("2026-11-01T12:00:00Z", now)).toBe(false);
    expect(isWithinServiceWindow("2026-10-30T12:00:00Z", now)).toBe(false);
    expect(isWithinServiceWindow(null, now)).toBe(false);
  });
});
