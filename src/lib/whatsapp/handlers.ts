import type { SupabaseClient } from "@supabase/supabase-js";
import { fromZonedTime } from "date-fns-tz";
import { crisisLanguageOf, crisisResponseFor, detectCrisis } from "@/config/crisis";
import { tokenStanding } from "@/config/plans";
import type { ChatTurn } from "@/lib/ai/prompts";
import type { SummaryOutcome } from "@/lib/ai/summarize-day";
import { tokensUsedThisMonth } from "@/lib/ai/usage";
import { isValidTimeZone, todayKey } from "@/lib/dates";
import { deltaSentence } from "@/lib/score-delta";

/**
 * What happens to a WhatsApp message once its signature has been checked
 * (PRD.md §6, §7, AGENTS.md §6). Everything that reaches the outside world is
 * passed in through `WhatsAppDeps`, so the same code runs against the real
 * sender and model in production and against stand-ins in tests.
 *
 * Rules kept here:
 * - A message id is stored first; one that already exists is dropped, because
 *   Meta resends a webhook until it gets a 200.
 * - Only a verified number is processed. Any other number can only link itself
 *   with `LINK KODE`, or get one hint a day.
 * - Every text goes through the crisis filter before any AI call, and a crisis
 *   reply is never counted against the daily limit.
 * - No message text is ever logged; log lines carry ids and statuses only.
 */

export type InboundMessage = { id: string; from: string; type: string; text: string | null };

export type WhatsAppDeps = {
  /** Service role: this runs with no user session. */
  admin: SupabaseClient;
  now: () => Date;
  /** Sends a text inside the 24 hour window and returns Meta's message id. */
  send: (to: string, body: string) => Promise<string>;
  /** `userId` is who the tokens of the reply are recorded against (PRD.md §8). */
  chat: (turns: ChatTurn[], userId: string) => Promise<{ reply: string; riskFlag: boolean }>;
  summarize: (input: {
    userId: string;
    timeZone: string;
    plan: "free" | "premium";
    date: string;
  }) => Promise<SummaryOutcome>;
  /** Public address of the app, for the link at the end of a summary. */
  appUrl: string;
};

/** PRD.md §6 and §11: AI replies per local day. */
export const AI_REPLY_LIMIT = { free: 1, premium: 30 } as const;

/** More than this many messages in a minute from one user is a flood: they are kept and not answered. */
const MAX_MESSAGES_PER_MINUTE = 10;
const CONTEXT_MESSAGES = 10;
/** PRD.md §6: a message after which the 24 hour window opens. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const TEXTS = {
  help: `Perintah yang bisa kamu ketik:
SELESAI: analisa hari ini dan lihat skormu
BERHENTI: matikan balasan otomatis
MULAI: nyalakan lagi
BANTUAN: lihat daftar ini

Selain itu, kirim ceritamu seperti ngobrol biasa. Setiap pesan masuk ke diary hari ini.`,
  unknownNumber:
    "Halo, ini Satu Persen. Nomor ini belum terhubung ke akun. Buka Akun lalu WhatsApp di aplikasi, buat kode, lalu kirim pesan LINK KODE ke sini.",
  linked:
    "Nomor ini sudah terhubung ke Satu Persen. Kirim ceritamu kapan saja, dan ketik BANTUAN untuk melihat perintah.",
  alreadyLinked: "Nomor ini sudah terhubung. Ketik BANTUAN untuk melihat perintah.",
  badCode: "Kode itu tidak dikenali atau sudah kedaluwarsa. Buat kode baru di Akun lalu WhatsApp, lalu kirim lagi.",
  numberTaken: "Nomor ini sudah terhubung ke akun lain.",
  nonText: "Untuk sekarang aku baru bisa membaca pesan teks. Tulis saja ceritamu, ya.",
  stopped: "Oke, balasan otomatis dimatikan. Pesanmu tetap masuk ke diary. Ketik MULAI untuk menyalakannya lagi.",
  started: "Balasan otomatis menyala lagi.",
  limit:
    "Balasan otomatis untuk hari ini sudah habis. Ceritamu tetap masuk ke diary. Ketik SELESAI kapan saja untuk menganalisa hari ini.",
  tokenCap:
    "Kuota AI bulan ini sudah habis, jadi aku belum bisa membalas sampai tanggal 1. Ceritamu tetap masuk ke diary, dan SELESAI tetap bisa menganalisa hari ini sekali.",
  aiUnavailable: "Aku belum bisa membalas sekarang, tapi ceritamu sudah masuk ke diary.",
  entryFull: "Tulisan hari ini sudah penuh (5.000 karakter), jadi pesan ini belum masuk ke diary.",
  noEntry: "Belum ada tulisan hari ini. Kirim ceritamu dulu, lalu ketik SELESAI.",
  summaryUnavailable: "Analisanya belum bisa dibuat sekarang. Ceritamu aman. Coba lagi nanti.",
} as const;

export type HandleResult =
  | "duplicate"
  | "unknown-number"
  | "linked"
  | "link-failed"
  | "command"
  | "flood"
  | "no-profile"
  | "non-text"
  | "chat";

type Link = { user_id: string; phone: string; opted_in: boolean };
type Profile = { timezone: string; plan: "free" | "premium" };

const LINK_PATTERN = /^\s*link\s+([a-z0-9]{6})\s*[.!]?\s*$/i;

/** "Selesai", " selesai! " and "SELESAI." are all the command; a sentence that contains it is not. */
function commandOf(text: string): "selesai" | "berhenti" | "mulai" | "bantuan" | null {
  const word = text.trim().toLowerCase().replace(/[.!]+$/, "");

  return word === "selesai" || word === "berhenti" || word === "mulai" || word === "bantuan" ? word : null;
}

export async function handleInboundMessage(
  deps: WhatsAppDeps,
  message: InboundMessage,
): Promise<HandleResult> {
  const { admin } = deps;

  const link = await findVerifiedLink(admin, message.from);

  // The text of a stranger is never stored; only a verified user's messages are
  // part of their diary and conversation.
  const stored = await claimInbound(admin, message.id, link?.user_id ?? null, link ? message.text : null);

  if (!stored) {
    return "duplicate";
  }

  if (!link) {
    return handleUnknownNumber(deps, message);
  }

  const profile = await loadProfile(admin, link.user_id);

  if (!profile) {
    console.error("whatsapp: profile missing for a linked number", { userId: link.user_id });
    return "no-profile";
  }

  const now = deps.now();
  await admin
    .from("whatsapp_links")
    .update({ last_inbound_at: now.toISOString() })
    .eq("user_id", link.user_id);

  const context = { link, profile, to: message.from };

  if (await isFlood(deps, link.user_id)) {
    return "flood";
  }

  if (message.type !== "text" || message.text === null || message.text.trim() === "") {
    if (link.opted_in) {
      await reply(deps, context, "notice", TEXTS.nonText);
    }

    return "non-text";
  }

  const text = message.text.trim();

  if (LINK_PATTERN.test(text)) {
    await reply(deps, context, "notice", TEXTS.alreadyLinked);
    return "command";
  }

  const command = commandOf(text);

  if (command) {
    await runCommand(deps, context, command);
    return "command";
  }

  await handleChat(deps, context, text);
  return "chat";
}

type Context = { link: Link; profile: Profile; to: string };

async function runCommand(
  deps: WhatsAppDeps,
  context: Context,
  command: "selesai" | "berhenti" | "mulai" | "bantuan",
): Promise<void> {
  const { admin } = deps;

  if (command === "bantuan") {
    await reply(deps, context, "help", TEXTS.help);
    return;
  }

  if (command === "berhenti" || command === "mulai") {
    await admin
      .from("whatsapp_links")
      .update({ opted_in: command === "mulai" })
      .eq("user_id", context.link.user_id);

    await reply(deps, context, "notice", command === "mulai" ? TEXTS.started : TEXTS.stopped);
    return;
  }

  const date = localToday(deps.now(), context.profile.timezone);
  const outcome = await deps.summarize({
    userId: context.link.user_id,
    timeZone: context.profile.timezone,
    plan: context.profile.plan,
    date,
  });

  if (outcome.kind === "crisis") {
    await sendCrisis(deps, context, "");
    return;
  }

  if (outcome.kind === "error") {
    await reply(
      deps,
      context,
      "notice",
      outcome.status === 400
        ? TEXTS.noEntry
        : outcome.status === 429
          ? outcome.message
          : TEXTS.summaryUnavailable,
    );
    return;
  }

  await reply(deps, context, "summary", shortSummary(outcome, deps.appUrl));
}

/**
 * The short version sent on WhatsApp (PRD.md §6): how the day compares with
 * the last one, the reason, one tip, and a link. The 0 to 100 score is not
 * shown (SCORE-2, user decision 2026-11-01).
 */
export function shortSummary(
  outcome: Extract<SummaryOutcome, { kind: "summary" }>,
  appUrl: string,
): string {
  return `${deltaSentence(outcome.delta, outcome.comparedTo)}\n${outcome.scoreReason}\n\nUntuk besok: ${outcome.tomorrowTip}\n\nLihat selengkapnya: ${appUrl.replace(/\/$/, "")}/dashboard`;
}

async function handleChat(deps: WhatsAppDeps, context: Context, text: string): Promise<void> {
  const { admin } = deps;
  const { link, profile } = context;
  const date = localToday(deps.now(), profile.timezone);

  // PRD.md §6: the message goes into today's diary whatever else happens.
  const { data: appended, error: appendError } = await admin.rpc("append_to_entry", {
    p_user: link.user_id,
    p_date: date,
    p_text: text,
  });

  if (appendError) {
    console.error("whatsapp: appending to the diary failed", { userId: link.user_id });
  }

  // §7: the keyword filter comes before any AI call, and its reply is never limited.
  if (detectCrisis(text)) {
    await sendCrisis(deps, context, text);
    return;
  }

  if (!appendError && appended === false) {
    await reply(deps, context, "notice", TEXTS.entryFull);
  }

  // "berhenti" turned automatic replies off; the message still reached the diary.
  if (!link.opted_in) {
    return;
  }

  const dayStart = localDayStart(deps.now(), profile.timezone).toISOString();
  const limit = AI_REPLY_LIMIT[profile.plan];
  const used = await countOutbound(admin, link.user_id, dayStart, "ai_reply");

  if (used >= limit) {
    // One notice a day, then silence (AGENTS.md §6).
    const alreadyTold = await countOutbound(admin, link.user_id, dayStart, "notice", TEXTS.limit);

    if (alreadyTold === 0) {
      await reply(deps, context, "notice", TEXTS.limit);
    }

    return;
  }

  // PRD.md §8 soft cap: past the month's tokens the chat goes quiet until the
  // month turns, with one notice a day. An unreadable total lets it through.
  const tokensUsed = await tokensUsedThisMonth(admin, link.user_id, profile.timezone, deps.now());

  if (tokensUsed !== null && tokenStanding(profile.plan, tokensUsed).overCap) {
    const alreadyTold = await countOutbound(admin, link.user_id, dayStart, "notice", TEXTS.tokenCap);

    if (alreadyTold === 0) {
      await reply(deps, context, "notice", TEXTS.tokenCap);
    }

    return;
  }

  let answer: { reply: string; riskFlag: boolean };

  try {
    answer = await deps.chat(await recentTurns(admin, link.user_id, dayStart), link.user_id);
  } catch (error) {
    console.error("whatsapp: chat reply failed", { userId: link.user_id, kind: (error as Error).name });
    await reply(deps, context, "notice", TEXTS.aiUnavailable);
    return;
  }

  if (answer.riskFlag) {
    await sendCrisis(deps, context, text);
    return;
  }

  await reply(deps, context, "ai_reply", answer.reply);
}

async function sendCrisis(deps: WhatsAppDeps, context: Context, text: string): Promise<void> {
  await reply(deps, context, "crisis", crisisResponseFor(text === "" ? "id" : crisisLanguageOf(text)));
}

async function handleUnknownNumber(deps: WhatsAppDeps, message: InboundMessage): Promise<HandleResult> {
  const { admin } = deps;
  const match = message.type === "text" && message.text ? LINK_PATTERN.exec(message.text) : null;

  if (match) {
    return linkNumber(deps, message.from, match[1].toUpperCase());
  }

  // One hint per number per day. The key is the claim: a second hint the same day
  // finds it taken, so a stranger cannot make the app answer in a loop.
  const hintKey = `hint-${message.from}-${deps.now().toISOString().slice(0, 10)}`;
  const { data } = await admin
    .from("wa_messages")
    .upsert(
      { user_id: null, wa_message_id: hintKey, direction: "out", kind: "help", body: TEXTS.unknownNumber },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");

  if ((data?.length ?? 0) > 0) {
    await safeSend(deps, message.from, TEXTS.unknownNumber);
  }

  return "unknown-number";
}

async function linkNumber(deps: WhatsAppDeps, phone: string, code: string): Promise<HandleResult> {
  const { admin } = deps;

  const { data: row } = await admin
    .from("whatsapp_link_codes")
    .select("user_id, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!row || Date.parse(row.expires_at as string) <= deps.now().getTime()) {
    await safeSend(deps, phone, TEXTS.badCode);
    return "link-failed";
  }

  // PRD.md §6: the consent was ticked before the code could be made, so linking
  // also turns the automatic replies on.
  const { error } = await admin.from("whatsapp_links").upsert(
    {
      user_id: row.user_id,
      phone,
      verified_at: deps.now().toISOString(),
      opted_in: true,
      last_inbound_at: deps.now().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    // The only constraint that can fail here is the unique phone number.
    await safeSend(deps, phone, TEXTS.numberTaken);
    return "link-failed";
  }

  // A code works once.
  await admin.from("whatsapp_link_codes").delete().eq("code", code);

  const sent = await safeSend(deps, phone, TEXTS.linked);

  if (sent) {
    await admin.from("wa_messages").insert({
      user_id: row.user_id,
      wa_message_id: sent,
      direction: "out",
      kind: "notice",
      body: TEXTS.linked,
    });
  }

  return "linked";
}

/** A send that fails is logged and ends there: Meta must still get its 200. */
async function safeSend(deps: WhatsAppDeps, to: string, body: string): Promise<string | null> {
  try {
    return await deps.send(to, body);
  } catch (error) {
    console.error("whatsapp: send failed", { kind: (error as Error).name });
    return null;
  }
}

type OutKind = "ai_reply" | "notice" | "crisis" | "summary" | "help";

/** Sends to a linked user and keeps the outbound row, which also counts the daily limit. */
async function reply(deps: WhatsAppDeps, context: Context, kind: OutKind, body: string): Promise<void> {
  const id = await safeSend(deps, context.to, body);

  if (!id) {
    return;
  }

  const { error } = await deps.admin.from("wa_messages").insert({
    user_id: context.link.user_id,
    wa_message_id: id,
    direction: "out",
    kind,
    body,
  });

  if (error) {
    console.error("whatsapp: storing a sent message failed", { userId: context.link.user_id });
  }
}

async function findVerifiedLink(admin: SupabaseClient, phone: string): Promise<Link | null> {
  const { data } = await admin
    .from("whatsapp_links")
    .select("user_id, phone, opted_in")
    .eq("phone", phone)
    .not("verified_at", "is", null)
    .maybeSingle();

  return (data as Link | null) ?? null;
}

async function loadProfile(admin: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data } = await admin.from("profiles").select("timezone, plan").eq("id", userId).maybeSingle();

  if (!data) {
    return null;
  }

  return {
    timezone: isValidTimeZone(data.timezone as string) ? (data.timezone as string) : "Asia/Jakarta",
    plan: data.plan === "premium" ? "premium" : "free",
  };
}

/** Stores the message id first. False when it was already there, which means Meta sent it again. */
async function claimInbound(
  admin: SupabaseClient,
  id: string,
  userId: string | null,
  body: string | null,
): Promise<boolean> {
  const { data, error } = await admin
    .from("wa_messages")
    .upsert(
      { user_id: userId, wa_message_id: id, direction: "in", kind: null, body },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    throw new Error("Pesan masuk tidak bisa disimpan");
  }

  return (data?.length ?? 0) > 0;
}

async function isFlood(deps: WhatsAppDeps, userId: string): Promise<boolean> {
  const since = new Date(deps.now().getTime() - 60_000).toISOString();
  const { count } = await deps.admin
    .from("wa_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("direction", "in")
    .gte("created_at", since);

  return (count ?? 0) > MAX_MESSAGES_PER_MINUTE;
}

async function countOutbound(
  admin: SupabaseClient,
  userId: string,
  sinceIso: string,
  kind: OutKind,
  body?: string,
): Promise<number> {
  let query = admin
    .from("wa_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("direction", "out")
    .eq("kind", kind)
    .gte("created_at", sinceIso);

  if (body !== undefined) {
    query = query.eq("body", body);
  }

  const { count } = await query;

  return count ?? 0;
}

/** The last messages of today, oldest first: the user's texts and the bot's earlier replies. */
async function recentTurns(admin: SupabaseClient, userId: string, sinceIso: string): Promise<ChatTurn[]> {
  const { data } = await admin
    .from("wa_messages")
    .select("direction, kind, body")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .not("body", "is", null)
    .or("direction.eq.in,kind.eq.ai_reply")
    .order("created_at", { ascending: false })
    .limit(CONTEXT_MESSAGES);

  return (data ?? [])
    .reverse()
    .map((row) => ({ from: row.direction === "in" ? "user" : "bot", text: row.body as string }));
}

function localToday(now: Date, timeZone: string): string {
  return todayKey(timeZone, now);
}

/** The instant the user's calendar day began, which is where the daily counts start. */
function localDayStart(now: Date, timeZone: string): Date {
  return fromZonedTime(`${todayKey(timeZone, now)}T00:00:00`, timeZone);
}

/** True while free-form text may still be sent to the number (PRD.md §6, AGENTS.md §6). */
export function isWithinServiceWindow(lastInboundAt: string | null, now: Date): boolean {
  return lastInboundAt !== null && now.getTime() - Date.parse(lastInboundAt) < SERVICE_WINDOW_MS;
}
