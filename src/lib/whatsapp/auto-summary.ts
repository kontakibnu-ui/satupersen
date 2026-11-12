import type { SupabaseClient } from "@supabase/supabase-js";
import type { SummaryOutcome } from "@/lib/ai/summarize-day";
import { isValidTimeZone } from "@/lib/dates";
import { localMoment } from "@/lib/reports/period";
import { isWithinServiceWindow, shortSummary } from "@/lib/whatsapp/handlers";

/**
 * The automatic summary at 22:00 local time (PRD.md §6 item 6, AGENTS.md §6),
 * for users who linked WhatsApp and left automatic replies on: when they wrote
 * something today and it was never summarised, it is summarised for them. The
 * text goes to WhatsApp only while the 24 hour window is open; otherwise the
 * summary is simply there on the web.
 *
 * Idempotent through the `daily_summaries` row: a run takes the day by inserting
 * a pending row, which only one run can do, and a finished or pending day is
 * left alone. The clock, the model, and the sender are passed in, as in the
 * report runner, so tests can pin them.
 */

export type AutoSummaryDeps = {
  admin: SupabaseClient;
  now: Date;
  summarize: (input: {
    userId: string;
    timeZone: string;
    plan: "free" | "premium";
    date: string;
  }) => Promise<SummaryOutcome>;
  send: (to: string, body: string) => Promise<string>;
  appUrl: string;
  /** Most summaries written in one run, so one tick stays inside the request time limit. */
  maxSummaries?: number;
};

export type AutoSummaryResult = { considered: number; summarized: number; sent: number; failed: number };

const DEFAULT_MAX_SUMMARIES = 4;
const SUMMARY_FROM_MINUTE = 22 * 60;
const PAGE = 500;

type LinkRow = { user_id: string; phone: string; last_inbound_at: string | null };

export async function runAutoSummaries(deps: AutoSummaryDeps): Promise<AutoSummaryResult> {
  const { admin, now } = deps;
  const limit = deps.maxSummaries ?? DEFAULT_MAX_SUMMARIES;
  const result: AutoSummaryResult = { considered: 0, summarized: 0, sent: 0, failed: 0 };

  for (let from = 0; ; from += PAGE) {
    const { data: links, error } = await admin
      .from("whatsapp_links")
      .select("user_id, phone, last_inbound_at")
      .eq("opted_in", true)
      .not("verified_at", "is", null)
      .order("user_id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      throw new Error("Nomor WhatsApp tidak bisa dibaca");
    }

    const rows = (links ?? []) as LinkRow[];

    if (rows.length > 0) {
      const { data: profiles, error: profileError } = await admin
        .from("profiles")
        .select("id, timezone, plan")
        .in("id", rows.map((row) => row.user_id));

      if (profileError) {
        throw new Error("Profil tidak bisa dibaca");
      }

      const byId = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));

      for (const link of rows) {
        const profile = byId.get(link.user_id);

        if (!profile || !isValidTimeZone(profile.timezone as string)) {
          continue;
        }

        const timeZone = profile.timezone as string;
        const moment = localMoment(now, timeZone);

        if (moment.minuteOfDay < SUMMARY_FROM_MINUTE) {
          continue;
        }

        result.considered += 1;

        if (result.summarized + result.failed >= limit) {
          continue;
        }

        const outcome = await summariseOne(deps, link, {
          timeZone,
          plan: profile.plan === "premium" ? "premium" : "free",
          date: moment.day,
        });

        if (outcome === "skipped") {
          continue;
        }

        if (outcome === "failed") {
          result.failed += 1;
          continue;
        }

        result.summarized += 1;

        if (outcome === "sent") {
          result.sent += 1;
        }
      }
    }

    if (rows.length < PAGE) {
      return result;
    }
  }
}

async function summariseOne(
  deps: AutoSummaryDeps,
  link: LinkRow,
  day: { timeZone: string; plan: "free" | "premium"; date: string },
): Promise<"skipped" | "failed" | "summarized" | "sent"> {
  const { admin } = deps;

  // Nothing written today, nothing to summarise.
  const { data: entry } = await admin
    .from("entries")
    .select("content")
    .eq("user_id", link.user_id)
    .eq("date", day.date)
    .maybeSingle();

  if (!entry || (entry.content as string).trim() === "") {
    return "skipped";
  }

  if (!(await claimDay(admin, link.user_id, day.date))) {
    return "skipped";
  }

  let outcome: SummaryOutcome;

  try {
    outcome = await deps.summarize({
      userId: link.user_id,
      timeZone: day.timeZone,
      plan: day.plan,
      date: day.date,
    });
  } catch (error) {
    console.error("auto summary failed", { userId: link.user_id, kind: (error as Error).name });
    return "failed";
  }

  if (outcome.kind === "error") {
    return "failed";
  }

  // A crisis day is shown with the fixed text on the web; nothing is pushed to the chat.
  if (outcome.kind === "crisis" || !isWithinServiceWindow(link.last_inbound_at, deps.now)) {
    return "summarized";
  }

  try {
    const body = shortSummary(outcome, deps.appUrl);
    const id = await deps.send(link.phone, body);

    await admin.from("wa_messages").insert({
      user_id: link.user_id,
      wa_message_id: id,
      direction: "out",
      kind: "summary",
      body,
    });

    return "sent";
  } catch (error) {
    console.error("auto summary send failed", { userId: link.user_id, kind: (error as Error).name });
    return "summarized";
  }
}

/**
 * Takes the day. A day with no row is claimed by inserting one; a day whose last
 * try failed is claimed back by an update that only matches that status. A day
 * that is done or being written by another run is left alone.
 */
async function claimDay(admin: SupabaseClient, userId: string, date: string): Promise<boolean> {
  const { data: inserted, error } = await admin
    .from("daily_summaries")
    .upsert(
      { user_id: userId, date, status: "pending" },
      { onConflict: "user_id,date", ignoreDuplicates: true },
    )
    .select("id");

  if (!error && (inserted?.length ?? 0) > 0) {
    return true;
  }

  const { data: reclaimed, error: reclaimError } = await admin
    .from("daily_summaries")
    .update({ status: "pending" })
    .eq("user_id", userId)
    .eq("date", date)
    .eq("status", "failed")
    .select("id");

  return !reclaimError && (reclaimed?.length ?? 0) > 0;
}
