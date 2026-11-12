import type { SupabaseClient } from "@supabase/supabase-js";
import { detectCrisis } from "@/config/crisis";
import { tokenStanding } from "@/config/plans";
import {
  AiConfigError,
  AiOutputError,
  AiProviderError,
  summarizeDay,
  type TokenUsage,
} from "@/lib/ai/openrouter";
import { computeDailyScore, dailyDeltaPoints } from "@/lib/ai/scoring";
import { recordUsage, tokensUsedThisMonth } from "@/lib/ai/usage";
import { endOfMonthKey, startOfMonthKey } from "@/lib/dates";
import { monthTotals, spentOnDay } from "@/lib/expenses";
import { loadEffectiveBudget, loadMoneyRows } from "@/lib/money";
import { comparedToLabel } from "@/lib/score-delta";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Summarising one day for one user (AI-1 to AI-5, SCORE-1 to SCORE-3). The web
 * button, the WhatsApp command `selesai`, and the automatic 22:00 summary all
 * come through here, so the quota, the crisis path, and the score are the same
 * everywhere (AI-4: the quota is shared).
 *
 * `reader` is whatever client the caller holds: the user's own session on the
 * web (row level security applies), or the service role in the background. Every
 * read below filters by `userId` itself, so either one only ever sees that
 * user's rows. The caller has already established who the user is and what day
 * "today" is for them.
 *
 * The summary row is written with the service role, because users may not write
 * it themselves: otherwise anyone could reset their own quota or set their own
 * score through the database API
 * (supabase/migrations/20261028230000_restrict_client_writes.sql).
 */

const REGEN_LIMIT = { free: 1, premium: 3 } as const;

export type SummaryOutcome =
  | {
      kind: "summary";
      summary: string;
      strengths: string[];
      improvements: string[];
      tomorrowTip: string;
      /** Fills the stamp's arc; the number itself is not shown (SCORE-2). */
      score: number;
      /** Points against the last scored day, or null on the first one. */
      delta: number | null;
      /** That day as it reads after "dibanding": "kemarin", "hari Kamis", "12 Oktober". */
      comparedTo: string | null;
      scoreReason: string;
    }
  | { kind: "crisis" }
  /** `status` is the HTTP status the web route answers with. The message is safe to show. */
  | { kind: "error"; status: number; message: string };

const fail = (status: number, message: string): SummaryOutcome => ({ kind: "error", status, message });

export async function summarizeUserDay(input: {
  reader: SupabaseClient;
  userId: string;
  timeZone: string;
  plan: "free" | "premium";
  /** The user's "today". Summaries are only ever made for today (AI-1). */
  date: string;
}): Promise<SummaryOutcome> {
  const { reader: supabase, userId, timeZone, plan, date } = input;

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("content, mood, energy")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (entryError) {
    return fail(500, "Catatan hari ini belum bisa dibaca. Coba lagi sebentar lagi.");
  }

  const content = (entry?.content as string | null | undefined)?.trim() ?? "";

  if (content === "") {
    return fail(400, "Tulis minimal satu kalimat dulu, lalu tekan Analisa hari ini.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("daily_summaries")
    .select("status, regen_count")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (existingError) {
    return fail(500, "Analisa hari ini belum bisa dibaca. Coba lagi sebentar lagi.");
  }

  const regenUsed = (existing?.regen_count as number | undefined) ?? 0;

  if (existing?.status === "done" && regenUsed >= REGEN_LIMIT[plan]) {
    return fail(
      429,
      plan === "premium"
        ? "Analisa ulang hari ini sudah terpakai. Besok bisa lagi."
        : "Analisa ulang hari ini sudah terpakai. Ini batas paket gratis.",
    );
  }

  // The keyword filter runs before the model, so a clear signal never waits for
  // an AI answer, and no AI text is ever shown for it (PRD.md §7).
  if (detectCrisis(content)) {
    const saved = await saveSummary({
      userId,
      date,
      status: "done",
      riskFlag: true,
      regenCount: regenUsed,
    });

    // The crisis text is shown even if the row could not be written: a person
    // in crisis must never be held back by a storage error.
    if (!saved) {
      console.error("crisis summary not stored", { userId, date });
    }

    return { kind: "crisis" };
  }

  // The habits the score is built from: the ones still active, and which of
  // them were checked that day. A habit archived after being checked no longer
  // counts, so the completed count can never exceed the active one.
  const { data: activeHabits, error: habitsError } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null);

  if (habitsError) {
    return fail(500, "Kebiasaanmu belum bisa dibaca. Coba lagi sebentar lagi.");
  }

  const activeHabitIds = (activeHabits ?? []).map((habit) => habit.id as string);
  let completedHabitCount = 0;

  if (activeHabitIds.length > 0) {
    const { data: checked, error: checkedError } = await supabase
      .from("habit_logs")
      .select("habit_id")
      .eq("user_id", userId)
      .eq("date", date)
      .in("habit_id", activeHabitIds);

    if (checkedError) {
      return fail(500, "Centang kebiasaanmu belum bisa dibaca. Coba lagi sebentar lagi.");
    }

    completedHabitCount = checked?.length ?? 0;
  }

  // The money part of the score: what was spent that day, the month's income
  // and spending so far (EXP-5), and the budget in force. A budget is a premium
  // feature (SUB-1), so a free account has none even if a row exists from an
  // earlier plan; its data stays intact (SUB-3).
  let spentToday: number;
  let monthlyBudget: number | null;
  let monthSoFar: { income: number; expense: number };

  try {
    const moneyRows = await loadMoneyRows(supabase, userId, startOfMonthKey(date), date);

    spentToday = spentOnDay(moneyRows, date);
    monthSoFar = monthTotals(moneyRows, date.slice(0, 7));
    monthlyBudget = plan === "premium" ? await loadEffectiveBudget(supabase, userId, date) : null;
  } catch {
    return fail(500, "Pengeluaranmu belum bisa dibaca. Coba lagi sebentar lagi.");
  }

  // PRD.md §8 soft cap: past the month's tokens a second analysis of the same
  // day waits for next month, while the first analysis of each day still runs
  // (AI-4). An unreadable total lets the request through: the cap is soft.
  if (existing?.status === "done") {
    const used = await tokensUsedThisMonth(supabase, userId, timeZone);

    if (used !== null && tokenStanding(plan, used).overCap) {
      return fail(
        429,
        "Kuota AI bulan ini sudah habis untuk analisa ulang. Analisa pertama tiap hari tetap jalan, dan kuotanya terisi lagi tanggal 1.",
      );
    }
  }

  let result: Awaited<ReturnType<typeof summarizeDay>>;
  const usages: TokenUsage[] = [];

  try {
    result = await summarizeDay(
      {
        date,
        content,
        timeZone,
        context: {
          mood: (entry?.mood as number | null | undefined) ?? null,
          energy: (entry?.energy as number | null | undefined) ?? null,
          habitsDone: completedHabitCount,
          habitsTotal: activeHabitIds.length,
        },
      },
      (usage) => usages.push(usage),
    );
  } catch (error) {
    // Only the class of the failure is logged, never the entry text (AGENTS.md §6).
    console.error("summarize failed", { userId, date, kind: (error as Error).name });

    // AI-2: a day without a usable summary is marked failed. A summary that
    // already exists is kept as it is, so a failed regen never erases it.
    if (existing?.status !== "done") {
      const saved = await saveSummary({
        userId,
        date,
        status: "failed",
        riskFlag: false,
        regenCount: regenUsed,
      });

      if (!saved) {
        console.error("failed status not stored", { userId, date });
      }
    }

    if (error instanceof AiConfigError) {
      return fail(503, "Fitur AI belum dikonfigurasi. Hubungi pengelola aplikasi.");
    }

    if (error instanceof AiOutputError || error instanceof AiProviderError) {
      return fail(502, "Analisa gagal dibuat. Tulisanmu aman. Coba lagi.");
    }

    return fail(500, "Ada yang tidak beres di sisi kami. Coba lagi sebentar lagi.");
  } finally {
    // Every billed attempt counts, including one whose output was unusable.
    await recordUsage(userId, "daily", usages);
  }

  if (result.kind === "crisis") {
    const saved = await saveSummary({
      userId,
      date,
      status: "done",
      riskFlag: true,
      regenCount: regenUsed,
    });

    if (!saved) {
      console.error("crisis summary not stored", { userId, date });
    }

    return { kind: "crisis" };
  }

  const { summary } = result;

  // SCORE-1: the score is computed here, in code, from the model's dimension
  // score plus whatever the user recorded. A dimension without data is dropped
  // and its weight shared out.
  const score = computeDailyScore({
    activeHabitCount: activeHabitIds.length,
    completedHabitCount,
    aiDimensionScore: summary.ai_dimension_score,
    mood: (entry?.mood as number | null | undefined) ?? null,
    energy: (entry?.energy as number | null | undefined) ?? null,
    spentToday,
    monthlyBudget,
    monthIncomeToDate: monthSoFar.income,
    monthSpentToDate: monthSoFar.expense,
    daysInMonth: Number(endOfMonthKey(date).slice(8)),
  });

  // SCORE-2: against the last scored day before today. An unreadable one only
  // costs the comparison; the analysis itself is already paid for.
  let previous: PreviousScore | null = null;

  try {
    previous = await loadPreviousScore(supabase, userId, date);
  } catch {
    console.error("reading the previous score failed", { userId, date });
  }

  const delta = score.score === null ? null : dailyDeltaPoints(score.score, previous?.score ?? null);

  const saved = await saveSummary({
    userId,
    date,
    status: "done",
    riskFlag: summary.risk_flag,
    regenCount: existing?.status === "done" ? regenUsed + 1 : regenUsed,
    payload: {
      summary: summary.summary,
      strengths: summary.strengths,
      improvements: summary.improvements,
      tomorrow_tip: summary.tomorrow_tip,
      ai_dimension_score: summary.ai_dimension_score,
      score: score.score,
      score_dimensions: score.dimensions,
      // The column keeps its name; since 2026-11-01 it holds points, not a ratio.
      delta_pct: delta,
      score_reason: summary.score_reason,
      model: result.model,
    },
  });

  // A summary that is shown but not stored would vanish on reload and still
  // cost an AI call, so it is reported instead of being shown.
  if (!saved) {
    return fail(500, "Analisa belum tersimpan. Tulisanmu aman. Coba lagi.");
  }

  if (score.score === null) {
    return fail(500, "Skor belum bisa dihitung dari catatan hari ini. Coba tambah sedikit cerita.");
  }

  return {
    kind: "summary",
    summary: summary.summary,
    strengths: summary.strengths,
    improvements: summary.improvements,
    tomorrowTip: summary.tomorrow_tip,
    score: score.score,
    delta,
    comparedTo: delta === null || previous === null ? null : comparedToLabel(date, previous.date),
    scoreReason: summary.score_reason,
  };
}

export type PreviousScore = { date: string; score: number };

/**
 * The last scored day before `date`, however far back (SCORE-2). Shared with
 * the Hari Ini page, which draws the comparison for a summary saved earlier.
 * Throws when the read fails, so a caller never mistakes it for a first day.
 */
export async function loadPreviousScore(
  reader: SupabaseClient,
  userId: string,
  date: string,
): Promise<PreviousScore | null> {
  const { data, error } = await reader
    .from("daily_summaries")
    .select("date, score")
    .eq("user_id", userId)
    .lt("date", date)
    .eq("status", "done")
    .not("score", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("The previous score could not be read");
  }

  return data && typeof data.score === "number" ? { date: data.date as string, score: data.score } : null;
}

type SummaryPayload = {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  tomorrow_tip?: string;
  ai_dimension_score?: number;
  score?: number | null;
  score_dimensions?: unknown;
  delta_pct?: number | null;
  score_reason?: string;
  model?: string;
};

/** Writes the day's summary row with the service role; false when it failed. */
async function saveSummary(input: {
  userId: string;
  date: string;
  status: "done" | "failed";
  riskFlag: boolean;
  regenCount: number;
  payload?: SummaryPayload;
}): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("daily_summaries").upsert(
    {
      user_id: input.userId,
      date: input.date,
      status: input.status,
      risk_flag: input.riskFlag,
      regen_count: input.regenCount,
      ...(input.payload ?? {}),
    },
    { onConflict: "user_id,date" },
  );

  if (error) {
    console.error("saving the daily summary failed", { userId: input.userId, date: input.date });
    return false;
  }

  return true;
}
