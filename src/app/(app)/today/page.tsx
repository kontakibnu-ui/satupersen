import type { Metadata } from "next";
import { dailyDeltaPoints } from "@/lib/ai/scoring";
import { loadPreviousScore, type PreviousScore } from "@/lib/ai/summarize-day";
import {
  addDays,
  formatDayLabel,
  formatDayParts,
  formatWeekdayShort,
  isValidTimeZone,
  lastNDays,
  todayKey,
} from "@/lib/dates";
import { firstName, greetingFor, localHour } from "@/lib/greeting";
import { loadActiveHabits } from "@/lib/habits";
import { comparedToLabel } from "@/lib/score-delta";
import { streakLength } from "@/lib/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ScribbleUnderline } from "@/components/notebook";
import { CrisisView } from "./crisis-view";
import type { SummaryResult, WeekDay } from "./summary-result";
import { TodayClient } from "./today-client";

export const metadata: Metadata = {
  title: "Hari Ini · Satu Persen",
};

/**
 * DIARY-1: the editor for today, where "today" is the user's own calendar day
 * according to the time zone in their profile, never the server's day.
 *
 * Mood, energy, and the habit checklist live here too (MOOD-1, HABIT-2,
 * DESIGN.md §8). They are read for the same day and feed the score.
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
    .select("timezone, plan, name")
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
    .select("content, mood, energy")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (entryError) {
    throw new Error("Catatan hari ini tidak bisa dibaca");
  }

  const habits = await loadActiveHabits(supabase, userId, date);

  const { data: summary, error: summaryError } = await supabase
    .from("daily_summaries")
    .select(
      "status, risk_flag, regen_count, summary, strengths, improvements, tomorrow_tip, score, score_reason",
    )
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (summaryError) {
    throw new Error("Analisa hari ini tidak bisa dibaca");
  }

  // The crisis screen replaces everything, including the editor (DESIGN.md §9).
  // The text is the fixed Indonesian one; crisis.ts already holds the English
  // version for the ASK phase, and a language choice needs a profile column
  // that neither PRD.md §9 nor the migration defines yet.
  if (summary?.risk_flag && tulis !== "1") {
    return (
      <main className="py-6 md:py-10">
        <p className="text-sm font-medium text-text-muted">{formatDayLabel(date)}</p>
        <CrisisView language="id" keepWritingHref="/today?tulis=1" />
      </main>
    );
  }

  const regenLimit = profile?.plan === "premium" ? 3 : 1;
  const initialResult =
    summary?.status === "done" && typeof summary.score === "number"
      ? await buildInitialResult(supabase, userId, date, summary)
      : null;

  // PRD.md §5: the "don't miss twice" rule applies to writing too. Only days with
  // text count; a day with only a mood tap is not a written day.
  const { data: writtenDays, error: writtenError } = await supabase
    .from("entries")
    .select("date")
    .eq("user_id", userId)
    .gte("date", addDays(date, -366))
    .lte("date", date)
    .neq("content", "")
    .order("date", { ascending: false })
    .limit(400);

  if (writtenError) {
    throw new Error("Riwayat menulis tidak bisa dibaca");
  }

  const writingStreak = streakLength(
    (writtenDays ?? []).map((row) => row.date as string),
    date,
  );
  const name = firstName(profile?.name as string | null | undefined);
  const greeting = greetingFor(localHour(new Date(), timeZone));
  const parts = formatDayParts(date);
  const week = await loadWeek(supabase, userId, date);

  return (
    <main className="py-6 md:py-10">
      {/* DESIGN.md §6 (version 4): no calendar page any more; the day itself is
          written in the notebook heading inside the writing sheet. */}
      <header>
        <h1 className="font-heading text-title font-bold text-text">
          Gimana harimu{name ? `, ${name}` : ""}?
        </h1>
        <p className="mt-2.5 text-sm text-text-muted">
          {greeting}.
          {writingStreak > 0 ? (
            <>
              {" "}
              Sudah{" "}
              <ScribbleUnderline className="font-bold text-text">{writingStreak} hari</ScribbleUnderline> kamu
              menulis beruntun.
            </>
          ) : null}
        </p>
      </header>

      <TodayClient
        userId={userId}
        date={date}
        weekday={parts.weekday}
        fullDate={`${parts.day} ${parts.monthYear}`}
        week={week}
        initialContent={entry?.content ?? ""}
        initialResult={initialResult}
        initialMood={entry?.mood ?? null}
        initialEnergy={entry?.energy ?? null}
        initialHabits={habits}
        regenLeft={Math.max(0, regenLimit - (summary?.regen_count ?? 0))}
      />
    </main>
  );
}

/**
 * The last seven days, today included, for the week strip under the analysis:
 * each with its short weekday and its score, or null when that day has no
 * finished analysis. The strip takes today's score from the result itself, so
 * a fresh analysis shows without a reload. The scores only set bar heights; the
 * number is never shown (SCORE-2, user decision 2026-11-01).
 */
async function loadWeek(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  date: string,
): Promise<WeekDay[]> {
  const days = lastNDays(date, 7);
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("date, score")
    .eq("user_id", userId)
    .eq("status", "done")
    .gte("date", days[0])
    .lte("date", days[days.length - 1]);

  if (error) {
    throw new Error("Skor minggu ini tidak bisa dibaca");
  }

  const scores = new Map((data ?? []).map((row) => [row.date as string, row.score as number | null]));

  return days.map((day) => ({
    date: day,
    label: formatWeekdayShort(day),
    score: scores.get(day) ?? null,
  }));
}

/**
 * A summary saved on an earlier visit still has to say which day it is
 * compared with (SCORE-2). The change is worked out again from the last scored
 * day rather than read from `delta_pct`, because rows written before
 * 2026-11-01 hold the old ratio against the 7 day average.
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
    score_reason: string | null;
  },
): Promise<SummaryResult | null> {
  if (summary.summary === null || typeof summary.score !== "number") {
    return null;
  }

  let previous: PreviousScore | null;

  try {
    previous = await loadPreviousScore(supabase, userId, date);
  } catch {
    throw new Error("Skor hari sebelumnya tidak bisa dibaca");
  }

  const delta = dailyDeltaPoints(summary.score, previous?.score ?? null);

  return {
    summary: summary.summary,
    strengths: summary.strengths ?? [],
    improvements: summary.improvements ?? [],
    tomorrowTip: summary.tomorrow_tip ?? "",
    score: summary.score,
    delta,
    comparedTo: previous === null ? null : comparedToLabel(date, previous.date),
    scoreReason: summary.score_reason ?? "",
  };
}
