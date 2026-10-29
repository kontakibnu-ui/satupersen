import { NextResponse } from "next/server";
import { z } from "zod";
import { detectCrisis } from "@/config/crisis";
import {
  AiConfigError,
  AiOutputError,
  AiProviderError,
  summarizeDay,
} from "@/lib/ai/openrouter";
import { computeDailyScore, dailyDeltaPct } from "@/lib/ai/scoring";
import { addDays, isValidTimeZone, lastNDays, todayKey } from "@/lib/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * POST /api/ai/summarize (AI-1 to AI-5).
 *
 * The screen sends the date it was opened for, and the server checks it is
 * still today by the profile's time zone ("Rangkum hari ini"). The text, the
 * profile, and the previous scores are read here, because a client can be
 * edited (PRD.md §7). The response carries only what the screen shows: never
 * the model id, never a stack trace, and never another user's data.
 *
 * Regen quota (AI-4): the first summary of a day is always allowed, and after
 * that free accounts get 1 more attempt while premium gets 3.
 *
 * Reads use the user's session, so row level security applies. The summary row
 * is written with the service role, because users may not write it themselves:
 * otherwise anyone could reset their own quota or set their own score through
 * the database API (supabase/migrations/20261028230000_restrict_client_writes.sql).
 */

const REGEN_LIMIT = { free: 1, premium: 3 } as const;

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type SummarizeResponse =
  | {
      kind: "summary";
      summary: string;
      strengths: string[];
      improvements: string[];
      tomorrowTip: string;
      score: number;
      deltaPct: number | null;
      scoreReason: string;
      /** Scored days behind the percentage, so the screen can say (2/3). */
      scoredDays: number;
    }
  | { kind: "crisis" }
  | { kind: "error"; message: string };

const fail = (status: number, message: string) =>
  NextResponse.json<SummarizeResponse>({ kind: "error", message }, { status });

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return fail(400, "Tanggalnya tidak dikenali. Coba muat ulang halaman ini.");
  }

  const date = parsedBody.data.date;
  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return fail(401, "Sesi kamu sudah berakhir. Masuk lagi dulu.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone, plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return fail(500, "Profilmu belum bisa dibaca. Coba lagi sebentar lagi.");
  }

  const timeZone = isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";

  if (date !== todayKey(timeZone)) {
    return fail(409, "Hari sudah berganti. Muat ulang halaman ini untuk merangkum hari ini.");
  }

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("content, mood, energy")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (entryError) {
    return fail(500, "Catatan hari ini belum bisa dibaca. Coba lagi sebentar lagi.");
  }

  const content = entry?.content?.trim() ?? "";

  if (content === "") {
    return fail(400, "Tulis minimal satu kalimat dulu, lalu tekan Rangkum hari ini.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("daily_summaries")
    .select("status, regen_count")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (existingError) {
    return fail(500, "Ringkasan hari ini belum bisa dibaca. Coba lagi sebentar lagi.");
  }

  const plan = profile.plan === "premium" ? "premium" : "free";
  const regenUsed = existing?.regen_count ?? 0;

  if (existing?.status === "done" && regenUsed >= REGEN_LIMIT[plan]) {
    return fail(
      429,
      plan === "premium"
        ? "Rangkum ulang hari ini sudah terpakai. Besok bisa lagi."
        : "Rangkum ulang hari ini sudah terpakai. Ini batas paket gratis.",
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

    return NextResponse.json<SummarizeResponse>({ kind: "crisis" });
  }

  let result: Awaited<ReturnType<typeof summarizeDay>>;

  try {
    result = await summarizeDay({
      date,
      content,
      timeZone,
      context: {
        mood: entry?.mood ?? null,
        energy: entry?.energy ?? null,
        habitsDone: 0,
        habitsTotal: 0,
      },
    });
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
      return fail(502, "Ringkasan gagal dibuat. Tulisanmu aman. Coba lagi.");
    }

    return fail(500, "Ada yang tidak beres di sisi kami. Coba lagi sebentar lagi.");
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

    return NextResponse.json<SummarizeResponse>({ kind: "crisis" });
  }

  const { summary } = result;

  // SCORE-1: the score is computed here, in code, from the model's dimension
  // score plus whatever the user recorded. Habits and budget arrive in later
  // phases; a dimension without data is dropped and its weight shared out.
  const score = computeDailyScore({
    activeHabitCount: 0,
    completedHabitCount: 0,
    aiDimensionScore: summary.ai_dimension_score,
    mood: entry?.mood ?? null,
    energy: entry?.energy ?? null,
    spentToday: 0,
    monthlyBudget: null,
    daysInMonth: 30,
  });

  const { data: previous } = await supabase
    .from("daily_summaries")
    .select("score")
    .eq("user_id", userId)
    .in("date", lastNDays(addDays(date, -1), 7))
    .eq("status", "done")
    .not("score", "is", null);

  const previousScores = (previous ?? [])
    .map((row) => row.score)
    .filter((value): value is number => typeof value === "number");

  // SCORE-2: null until three scored days exist, which the screen explains.
  const deltaPct = score.score === null ? null : dailyDeltaPct(score.score, previousScores);

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
      delta_pct: deltaPct,
      score_reason: summary.score_reason,
      model: result.model,
    },
  });

  // A summary that is shown but not stored would vanish on reload and still
  // cost an AI call, so it is reported instead of being shown.
  if (!saved) {
    return fail(500, "Ringkasan belum tersimpan. Tulisanmu aman. Coba lagi.");
  }

  if (score.score === null) {
    return fail(500, "Skor belum bisa dihitung dari catatan hari ini. Coba tambah sedikit cerita.");
  }

  return NextResponse.json<SummarizeResponse>({
    kind: "summary",
    summary: summary.summary,
    strengths: summary.strengths,
    improvements: summary.improvements,
    tomorrowTip: summary.tomorrow_tip,
    score: score.score,
    deltaPct,
    scoreReason: summary.score_reason,
    scoredDays: previousScores.length,
  });
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
