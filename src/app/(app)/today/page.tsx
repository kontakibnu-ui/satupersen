import type { Metadata } from "next";
import { addDays, formatDayLabel, isValidTimeZone, lastNDays, todayKey } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CrisisView } from "./crisis-view";
import type { SummaryResult } from "./summary-result";
import { TodayClient } from "./today-client";

export const metadata: Metadata = {
  title: "Hari Ini · Satu Persen",
};

/**
 * DIARY-1: the editor for today, where "today" is the user's own calendar day
 * according to the time zone in their profile, never the server's day.
 *
 * Mood, energy, and the habit list also live on this screen in DESIGN.md §8,
 * but they arrive with their own tasks (3.3 and 3.2) rather than being faked
 * here.
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ tulis?: string }>;
}) {
  const { tulis } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone, plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  // The Akun page only saves zones the runtime knows, but a stored value that
  // is not one must not take the whole screen down (AUTH-3 fallback).
  const timeZone =
    profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const date = todayKey(timeZone);

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("content")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (entryError) {
    throw new Error("Catatan hari ini tidak bisa dibaca");
  }

  const { data: summary, error: summaryError } = await supabase
    .from("daily_summaries")
    .select(
      "status, risk_flag, regen_count, summary, strengths, improvements, tomorrow_tip, score, delta_pct, score_reason",
    )
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (summaryError) {
    throw new Error("Ringkasan hari ini tidak bisa dibaca");
  }

  // The crisis screen replaces everything, including the editor (DESIGN.md §9).
  // The text is the fixed Indonesian one; crisis.ts already holds the English
  // version for the ASK phase, and a language choice needs a profile column
  // that neither PRD.md §9 nor the migration defines yet.
  if (summary?.risk_flag && tulis !== "1") {
    return (
      <main className="py-8">
        <p className="text-sm text-text-muted">{formatDayLabel(date)}</p>
        <CrisisView language="id" keepWritingHref="/today?tulis=1" />
      </main>
    );
  }

  const regenLimit = profile?.plan === "premium" ? 3 : 1;
  const initialResult =
    summary?.status === "done" && typeof summary.score === "number"
      ? await buildInitialResult(supabase, userId, date, summary)
      : null;

  return (
    <main className="py-8">
      <p className="text-sm text-text-muted">{formatDayLabel(date)}</p>
      <h1 className="mt-1 font-serif text-title text-text">Gimana harimu?</h1>

      <TodayClient
        date={date}
        initialContent={entry?.content ?? ""}
        initialResult={initialResult}
        regenLeft={Math.max(0, regenLimit - (summary?.regen_count ?? 0))}
      />
    </main>
  );
}

/**
 * A summary saved on an earlier visit still has to draw its percentage, and the
 * percentage needs to know how many scored days sit behind it. One indexed
 * count is cheaper than storing that number on every row.
 */
async function buildInitialResult(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  date: string,
  summary: {
    summary: string | null;
    strengths: string[] | null;
    improvements: string[] | null;
    tomorrow_tip: string | null;
    score: number | null;
    delta_pct: number | null;
    score_reason: string | null;
  },
): Promise<SummaryResult | null> {
  if (summary.summary === null || typeof summary.score !== "number") {
    return null;
  }

  const { count } = await supabase
    .from("daily_summaries")
    .select("date", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("date", lastNDays(addDays(date, -1), 7))
    .eq("status", "done")
    .not("score", "is", null);

  return {
    summary: summary.summary,
    strengths: summary.strengths ?? [],
    improvements: summary.improvements ?? [],
    tomorrowTip: summary.tomorrow_tip ?? "",
    score: summary.score,
    deltaPct: summary.delta_pct,
    scoreReason: summary.score_reason ?? "",
    scoredDays: count ?? 0,
  };
}
