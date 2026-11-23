"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tokenStanding } from "@/config/plans";
import { AiConfigError, writeMoneyAnalysis, type TokenUsage } from "@/lib/ai/openrouter";
import { recordUsage, tokensUsedThisMonth } from "@/lib/ai/usage";
import { endOfMonthKey, isDateKey, todayKey } from "@/lib/dates";
import { loadEffectiveBudget, loadMonthExpenses } from "@/lib/money";
import { analysisPromptInput, previousMonthOf, readThroughDay } from "@/lib/money-analysis";
import { rateLimitMessage, takeAiRateLimit } from "@/lib/rate-limit";
import { getActionContext } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * "Analisa uang" (PRD.md EXP-10): the premium AI reading of one month, stored
 * in `money_analyses` so the screen can show it again without a new model call.
 * The plan, the once-a-day refresh, the rate limit, and the token cap are all
 * checked here (SUB-1, RATE-1, PRD.md §8); the numbers are counted by
 * src/lib/money-analysis.ts, never by the model. The row is written with the
 * service role because the table takes no writes from the browser.
 */

export type MoneyAnalysisResult = { ok: true } | { ok: false; message: string };

const SESSION_ENDED = "Sesi kamu sudah berakhir. Masuk lagi dulu.";
const PREMIUM_ONLY = "Analisa uang ada di Premium.";
const BAD_MONTH = "Bulan ini belum bisa dianalisa.";
const ALREADY_TODAY = "Analisa bulan ini sudah diperbarui hari ini. Bisa diperbarui lagi besok.";
const NOTHING_SPENT = "Belum ada pengeluaran di bulan ini untuk dianalisa.";
const TOKEN_CAP = "Kuota AI bulan ini sudah habis. Grafiknya tetap bisa kamu pakai, analisa bisa lagi tanggal 1.";
const NOT_CONFIGURED = "Analisa uang belum dikonfigurasi. Grafiknya tetap bisa kamu pakai.";
const FAILED = "Analisa belum berhasil dibuat. Coba lagi sebentar lagi.";
const NOT_SAVED = "Analisa belum berhasil disimpan. Coba lagi sebentar lagi.";

const monthInput = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, BAD_MONTH) });

export async function analyzeMoney(input: { month: string }): Promise<MoneyAnalysisResult> {
  const parsed = monthInput.safeParse(input);

  if (!parsed.success || !isDateKey(`${parsed.data.month}-01`)) {
    return { ok: false, message: BAD_MONTH };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  if (context.plan !== "premium") {
    return { ok: false, message: PREMIUM_ONLY };
  }

  const { month } = parsed.data;
  const monthStart = `${month}-01`;
  const today = todayKey(context.timeZone);

  if (month > today.slice(0, 7)) {
    return { ok: false, message: BAD_MONTH };
  }

  const { data: existing, error: existingError } = await context.supabase
    .from("money_analyses")
    .select("generated_on")
    .eq("user_id", context.userId)
    .eq("month", monthStart)
    .maybeSingle();

  if (existingError) {
    return { ok: false, message: FAILED };
  }

  if (existing?.generated_on === today) {
    return { ok: false, message: ALREADY_TODAY };
  }

  const previousMonth = previousMonthOf(month);
  let entries: Awaited<ReturnType<typeof loadMonthExpenses>>;
  let budget: number | null;

  try {
    const [current, previous, effectiveBudget] = await Promise.all([
      loadMonthExpenses(context.supabase, context.userId, monthStart),
      loadMonthExpenses(context.supabase, context.userId, `${previousMonth}-01`),
      loadEffectiveBudget(context.supabase, context.userId, monthStart),
    ]);
    entries = [...current, ...previous];
    budget = effectiveBudget;
  } catch {
    return { ok: false, message: FAILED };
  }

  const throughDay = readThroughDay(month, today);
  const promptInput = analysisPromptInput({ entries, month, today, budget });

  if (promptInput.expense === 0) {
    return { ok: false, message: NOTHING_SPENT };
  }

  const wait = await takeAiRateLimit(context.userId);

  if (wait > 0) {
    return { ok: false, message: rateLimitMessage(wait) };
  }

  // An unreadable total lets the analysis through: the cap is soft (PRD.md §8).
  const used = await tokensUsedThisMonth(context.supabase, context.userId, context.timeZone);

  if (used !== null && tokenStanding(context.plan, used).overCap) {
    return { ok: false, message: TOKEN_CAP };
  }

  const usages: TokenUsage[] = [];
  let written: Awaited<ReturnType<typeof writeMoneyAnalysis>>;

  try {
    written = await writeMoneyAnalysis(promptInput, (usage) => usages.push(usage));
  } catch (error) {
    if (error instanceof AiConfigError) {
      return { ok: false, message: NOT_CONFIGURED };
    }

    console.error("writing a money analysis failed", {
      userId: context.userId,
      month,
      kind: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, message: FAILED };
  } finally {
    await recordUsage(context.userId, "money", usages);
  }

  const { error } = await createSupabaseAdminClient()
    .from("money_analyses")
    .upsert(
      {
        user_id: context.userId,
        month: monthStart,
        paragraphs: written.analysis.paragraphs,
        next_month: written.analysis.next_month,
        through_date: throughDay >= Number(endOfMonthKey(monthStart).slice(8)) ? endOfMonthKey(monthStart) : today,
        generated_on: today,
        model: written.model,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month" },
    );

  if (error) {
    console.error("storing a money analysis failed", { userId: context.userId, month, code: error.code });
    return { ok: false, message: NOT_SAVED };
  }

  revalidatePath("/expenses/analysis");
  return { ok: true };
}
