import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportPromptInput } from "@/lib/ai/prompts";
import { fetchAllRows } from "@/lib/paging";
import { periodDeltaPct, windowAverage } from "@/lib/progress";
import {
  periodBefore,
  periodLength,
  type ReportPeriod,
  type ReportType,
} from "@/lib/reports/period";

/**
 * What a report is built from, and the numbers it quotes. The model only writes
 * words around these numbers (REPORT-3); every figure here is computed in code.
 */

/** A period with fewer scored days than this has too little to say anything about. */
export const MIN_SCORED_DAYS_FOR_REPORT = 3;

/** REPORT-3: a link between two areas needs at least this many days of data in both. */
export const MIN_DAYS_PER_AREA_FOR_INSIGHT = 5;

export function crossAreaInsightsAllowed(moodDays: number, spendingDays: number): boolean {
  return moodDays >= MIN_DAYS_PER_AREA_FOR_INSIGHT && spendingDays >= MIN_DAYS_PER_AREA_FOR_INSIGHT;
}

export type ReportMaterial = {
  prompt: ReportPromptInput;
  numbers: {
    average_score: number;
    previous_average_score: number | null;
    delta_pct: number | null;
    scored_days: number;
    period_days: number;
  };
  /** False when the period has too few scored days to write a report. */
  enoughData: boolean;
  crossAreaAllowed: boolean;
};

type SummaryRow = { date: string; score: number; summary: string | null; score_reason: string | null };

/**
 * Reads the period from the database with the service role (the tick has no
 * user session) and filters every read by `user_id` itself, so one user's report
 * can never include another user's rows.
 */
export async function collectReportMaterial(
  admin: SupabaseClient,
  input: { userId: string; type: ReportType; variant: "brief" | "full"; period: ReportPeriod },
): Promise<ReportMaterial> {
  const { userId, type, variant, period } = input;
  const previous = periodBefore(type, period);

  const summaries = await fetchAllRows<SummaryRow>(
    (from, to) =>
      admin
        .from("daily_summaries")
        .select("date, score, summary, score_reason")
        .eq("user_id", userId)
        .eq("status", "done")
        .not("score", "is", null)
        .gte("date", previous.start)
        .lte("date", period.end)
        .order("date", { ascending: true })
        .range(from, to),
    "Ringkasan harian tidak bisa dibaca",
  );

  const moods = await fetchAllRows<{ date: string; mood: number | null; energy: number | null }>(
    (from, to) =>
      admin
        .from("entries")
        .select("date, mood, energy")
        .eq("user_id", userId)
        .gte("date", period.start)
        .lte("date", period.end)
        .order("date", { ascending: true })
        .range(from, to),
    "Mood tidak bisa dibaca",
  );

  const checks = await fetchAllRows<{ date: string }>(
    (from, to) =>
      admin
        .from("habit_logs")
        .select("date")
        .eq("user_id", userId)
        .gte("date", period.start)
        .lte("date", period.end)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "Centang kebiasaan tidak bisa dibaca",
  );

  const spending = await fetchAllRows<{ date: string; amount: number }>(
    (from, to) =>
      admin
        .from("expenses")
        .select("date, amount")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("date", period.start)
        .lte("date", period.end)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "Pengeluaran tidak bisa dibaca",
  );

  const scored = summaries.map((row) => ({ date: row.date, score: row.score }));
  const current = windowAverage(scored, period.end, periodLength(period));
  const before = windowAverage(scored, previous.end, periodLength(previous));

  const moodByDate = new Map(moods.map((row) => [row.date, row]));
  const checksByDate = new Map<string, number>();
  for (const check of checks) {
    checksByDate.set(check.date, (checksByDate.get(check.date) ?? 0) + 1);
  }
  const spentByDate = new Map<string, number>();
  for (const expense of spending) {
    spentByDate.set(expense.date, (spentByDate.get(expense.date) ?? 0) + expense.amount);
  }

  const moodDays = moods.filter((row) => row.mood !== null).length;
  const crossAreaAllowed = crossAreaInsightsAllowed(moodDays, spentByDate.size);

  const days = summaries
    .filter((row) => row.date >= period.start)
    .map((row) => ({
      date: row.date,
      score: row.score,
      summary: row.summary ?? "",
      reason: row.score_reason ?? "",
      mood: moodByDate.get(row.date)?.mood ?? null,
      energy: moodByDate.get(row.date)?.energy ?? null,
      habitsChecked: checksByDate.get(row.date) ?? 0,
      spent: spentByDate.get(row.date) ?? null,
    }));

  const deltaPct = periodDeltaPct(current, before);

  return {
    prompt: {
      type,
      variant,
      period,
      numbers: {
        averageScore: current.average ?? 0,
        previousAverageScore: before.average,
        deltaPct,
        scoredDays: current.scoredDays,
        periodDays: periodLength(period),
      },
      days,
      crossAreaInsightsAllowed: crossAreaAllowed,
    },
    numbers: {
      average_score: current.average === null ? 0 : Math.round(current.average * 10) / 10,
      previous_average_score: before.average === null ? null : Math.round(before.average * 10) / 10,
      delta_pct: deltaPct,
      scored_days: current.scoredDays,
      period_days: periodLength(period),
    },
    enoughData: current.scoredDays >= MIN_SCORED_DAYS_FOR_REPORT,
    crossAreaAllowed,
  };
}
