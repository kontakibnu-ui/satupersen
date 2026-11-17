"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PLAN_LIMITS, tokenStanding } from "@/config/plans";
import {
  AiConfigError,
  checkExplanation,
  checkReviewAnswers,
  type TokenUsage,
} from "@/lib/ai/openrouter";
import { recordUsage, tokensUsedThisMonth } from "@/lib/ai/usage";
import { todayKey } from "@/lib/dates";
import { rateLimitMessage, takeAiRateLimit } from "@/lib/rate-limit";
import { getActionContext, type ActionContext } from "@/lib/session";
import { fromExplanationFeedback, type FeedbackView } from "@/lib/study/feedback";
import { checksLeftToday, checksUsedUpMessage } from "@/lib/study/limits";
import {
  MAX_ANSWER_LENGTH,
  MAX_EXPLANATION_LENGTH,
  MAX_SOURCE_LENGTH,
  MAX_TITLE_LENGTH,
  RATINGS,
} from "@/lib/study/rules";
import { firstSchedule, isDue, nextSchedule, reviewDayLabel } from "@/lib/study/schedule";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AI_NOT_CONFIGURED_MESSAGE, countChecksToday, loadAiStatus, TOKEN_CAP_MESSAGE, type AiStatus } from "./learn-data";

/**
 * Belajar (PRD.md LEARN-1 to LEARN-8, RATE-1).
 *
 * Every action reads the user, the plan, and the time zone from the session on
 * the server and checks that the material is theirs; nothing the browser sends
 * about plan, quota, or schedule is trusted (PRD.md §7). The user's own text
 * (title, material) is written with their session, so row level security and
 * the database triggers apply; the AI's output, the questions, the schedule,
 * and the quota rows are written with the service role after those checks.
 *
 * No material, explanation, or answer text is ever logged: only ids and the
 * class of a failure.
 */

type Failure = { ok: false; message: string; retryable?: boolean };

const SESSION_ENDED = "Sesi kamu sudah berakhir. Masuk lagi dulu.";
const GENERIC_FAILURE = "Belum berhasil disimpan. Coba lagi sebentar lagi.";
const NOT_FOUND = "Materi ini tidak ditemukan. Mungkin sudah dihapus.";
const MATERIAL_LIMIT = "Paket gratis memuat 1 materi. Materi tanpa batas ada di Premium.";
const SOURCE_LOCKED = "Bahan tidak bisa diubah setelah diperiksa, karena pertanyaannya dibuat dari bahan itu.";
const AI_FAILED = "Pemeriksaan gagal dibuat. Tulisanmu aman. Coba lagi.";

const fail = (message: string, retryable = false): Failure => ({ ok: false, message, retryable });

const idSchema = z.uuid();

const materialFields = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Beri judul materinya dulu.")
    .max(MAX_TITLE_LENGTH, `Judul maksimal ${MAX_TITLE_LENGTH} karakter.`),
  source: z
    .string()
    .trim()
    .min(1, "Tempel atau tulis bahannya dulu.")
    .max(MAX_SOURCE_LENGTH, `Bahan maksimal ${MAX_SOURCE_LENGTH.toLocaleString("id-ID")} karakter.`),
});

function refresh(materialId?: string): void {
  revalidatePath("/learn");

  if (materialId) {
    revalidatePath(`/learn/${materialId}`);
  }
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? GENERIC_FAILURE;
}

// ---------------------------------------------------------------------------
// Materials (LEARN-1, LEARN-2, LEARN-8)

export async function createMaterial(input: {
  title: string;
  source: string;
}): Promise<{ ok: true; id: string } | Failure> {
  const parsed = materialFields.safeParse(input);

  if (!parsed.success) {
    return fail(firstIssue(parsed.error));
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  // The free limit is the database's call (trigger on insert), so it holds for
  // a browser that never goes through this action (LEARN-5).
  const { data, error } = await context.supabase
    .from("study_materials")
    .insert({ user_id: context.userId, title: parsed.data.title, source: parsed.data.source })
    .select("id")
    .single();

  if (error || !data) {
    return fail(error?.message.includes("study_material_limit_reached") ? MATERIAL_LIMIT : GENERIC_FAILURE);
  }

  refresh();
  return { ok: true, id: data.id as string };
}

/** Only a draft can be edited; the trigger refuses a new text once questions exist (LEARN-2). */
export async function updateMaterial(input: {
  id: string;
  title: string;
  source: string;
}): Promise<{ ok: true } | Failure> {
  const parsedId = idSchema.safeParse(input.id);
  const parsed = materialFields.safeParse(input);

  if (!parsedId.success) {
    return fail(NOT_FOUND);
  }

  if (!parsed.success) {
    return fail(firstIssue(parsed.error));
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const { data, error } = await context.supabase
    .from("study_materials")
    .update({ title: parsed.data.title, source: parsed.data.source })
    .eq("id", parsedId.data)
    .eq("user_id", context.userId)
    .select("id");

  if (error) {
    return fail(error.message.includes("study_source_locked") ? SOURCE_LOCKED : GENERIC_FAILURE);
  }

  if (!data || data.length === 0) {
    return fail(NOT_FOUND);
  }

  refresh(parsedId.data);
  return { ok: true };
}

/** Removes the material with its questions and reviews (LEARN-8). Used checks of today stay counted. */
export async function deleteMaterial(id: string): Promise<{ ok: true } | Failure> {
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return fail(NOT_FOUND);
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const { data, error } = await context.supabase
    .from("study_materials")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", context.userId)
    .select("id");

  if (error) {
    return fail("Materi belum terhapus. Coba lagi sebentar lagi.");
  }

  if (!data || data.length === 0) {
    return fail(NOT_FOUND);
  }

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The gate in front of every AI check (RATE-1, LEARN-5, PRD.md §8)

type Reservation = { ok: true; reservationId: number } | Failure;

/**
 * In order: the rate limit counts the tap; the monthly token cap stops Belajar
 * checks until the 1st; then one check is taken from today's quota under a
 * database lock, so two taps at once cannot both use the last one. The caller
 * gives the check back with `releaseCheck` if the model call fails.
 */
async function reserveCheck(
  context: ActionContext,
  materialId: string,
  kind: "explanation" | "review",
  today: string,
): Promise<Reservation> {
  const wait = await takeAiRateLimit(context.userId);

  if (wait > 0) {
    return fail(rateLimitMessage(wait), true);
  }

  // An unreadable total lets the check through: the cap is soft (PRD.md §8).
  const used = await tokensUsedThisMonth(context.supabase, context.userId, context.timeZone);

  if (used !== null && tokenStanding(context.plan, used).overCap) {
    return fail(TOKEN_CAP_MESSAGE);
  }

  const { scope, perDay } = PLAN_LIMITS[context.plan].studyChecks;
  const { data, error } = await createSupabaseAdminClient().rpc("reserve_study_check", {
    p_user: context.userId,
    p_material: materialId,
    p_date: today,
    p_kind: kind,
    p_scope: scope,
    p_limit: perDay,
  });

  if (error) {
    console.error("reserving a study check failed", { userId: context.userId, materialId });
    return fail("Pemeriksaan belum bisa dimulai. Coba lagi sebentar lagi.", true);
  }

  if (typeof data !== "number") {
    return fail(checksUsedUpMessage(context.plan));
  }

  return { ok: true, reservationId: data };
}

/** A check whose model call failed does not count (LEARN-5). */
async function releaseCheck(reservationId: number, userId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("study_checks")
    .delete()
    .eq("id", reservationId)
    .eq("user_id", userId);

  if (error) {
    console.error("giving back a failed study check failed", { userId, reservationId });
  }
}

function aiFailureMessage(error: unknown): Failure {
  return error instanceof AiConfigError ? fail(AI_NOT_CONFIGURED_MESSAGE) : fail(AI_FAILED, true);
}

async function checksLeftAfter(context: ActionContext, materialId: string, today: string): Promise<number> {
  try {
    return checksLeftToday(context.plan, await countChecksToday(context.supabase, context.userId, materialId, today));
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// "Jelaskan dengan kata sendiri" (LEARN-2)

export type ExplanationCheckOutcome =
  | { ok: true; feedback: FeedbackView; questionsCreated: number | null; checksLeft: number }
  | Failure;

const explanationInput = z.object({
  id: idSchema,
  explanation: z
    .string()
    .trim()
    .min(1, "Tulis minimal satu kalimat dulu, apa pun yang kamu ingat.")
    .max(MAX_EXPLANATION_LENGTH, `Penjelasan maksimal ${MAX_EXPLANATION_LENGTH.toLocaleString("id-ID")} karakter.`),
});

export async function checkMaterialExplanation(input: {
  id: string;
  explanation: string;
}): Promise<ExplanationCheckOutcome> {
  const parsed = explanationInput.safeParse(input);

  if (!parsed.success) {
    return fail(firstIssue(parsed.error));
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const { id, explanation } = parsed.data;
  const today = todayKey(context.timeZone);

  const { data: material, error: materialError } = await context.supabase
    .from("study_materials")
    .select("id, title, source, status")
    .eq("id", id)
    .eq("user_id", context.userId)
    .maybeSingle();

  if (materialError) {
    return fail("Materi belum bisa dibaca. Coba lagi sebentar lagi.", true);
  }

  if (!material) {
    return fail(NOT_FOUND);
  }

  const admin = createSupabaseAdminClient();

  // The explanation is kept whatever happens next, so a failed check loses nothing.
  const { error: saveError } = await admin
    .from("study_materials")
    .update({ explanation })
    .eq("id", id)
    .eq("user_id", context.userId);

  if (saveError) {
    return fail(GENERIC_FAILURE, true);
  }

  const reservation = await reserveCheck(context, id, "explanation", today);

  if (!reservation.ok) {
    return reservation;
  }

  const questionsWanted = material.status === "draft";
  const usages: TokenUsage[] = [];
  let result: Awaited<ReturnType<typeof checkExplanation>>;

  try {
    result = await checkExplanation(
      {
        title: material.title as string,
        source: material.source as string,
        explanation,
        questionsWanted,
      },
      (usage) => usages.push(usage),
    );
  } catch (error) {
    console.error("study explanation check failed", { userId: context.userId, materialId: id, kind: (error as Error).name });
    await releaseCheck(reservation.reservationId, context.userId);
    return aiFailureMessage(error);
  } finally {
    // Every billed attempt counts toward the monthly cap, a failed one too.
    await recordUsage(context.userId, "study", usages);
  }

  // Feedback, questions, and activation land in one transaction (LEARN-2), so a
  // failure never leaves a material half checked. Only a draft gets questions.
  const schedule = firstSchedule(today);
  const { error: storeError } = await admin.rpc("store_study_explanation_check", {
    p_user: context.userId,
    p_material: id,
    p_feedback: result.feedback,
    p_questions: result.questions.map((question, index) => ({
      position: index + 1,
      prompt: question.prompt,
      answer: question.answer,
      kind: question.kind,
      step: schedule.step,
      due_date: schedule.dueDate,
    })),
  });

  if (storeError) {
    console.error("storing a study explanation check failed", { userId: context.userId, materialId: id, code: storeError.code });
    await releaseCheck(reservation.reservationId, context.userId);
    return fail("Umpan balik belum tersimpan. Tulisanmu aman. Coba lagi.", true);
  }

  refresh(id);

  return {
    ok: true,
    feedback: fromExplanationFeedback(result.feedback),
    questionsCreated: questionsWanted ? result.questions.length : null,
    checksLeft: await checksLeftAfter(context, id, today),
  };
}

// ---------------------------------------------------------------------------
// Review sessions (LEARN-3, LEARN-4)

export type SavedReview = {
  ok: true;
  next: { questionId: string; label: string }[];
  ai: AiStatus;
};

const reviewInput = z.object({
  id: idSchema,
  items: z
    .array(
      z.object({
        questionId: idSchema,
        answer: z.string().max(MAX_ANSWER_LENGTH, `Jawaban maksimal ${MAX_ANSWER_LENGTH.toLocaleString("id-ID")} karakter.`),
        rating: z.enum(RATINGS),
      }),
    )
    .min(1)
    .max(5),
});

/**
 * Stores the session and moves each question along by the user's own rating.
 * No AI here: the schedule is never the model's (LEARN-3). The answer to
 * whether an AI check can follow comes back with it.
 */
export async function saveReview(input: {
  id: string;
  items: { questionId: string; answer: string; rating: string }[];
}): Promise<SavedReview | Failure> {
  const parsed = reviewInput.safeParse(input);

  if (!parsed.success) {
    return fail(firstIssue(parsed.error));
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const { id, items } = parsed.data;
  const today = todayKey(context.timeZone);

  if (new Set(items.map((item) => item.questionId)).size !== items.length) {
    return fail(GENERIC_FAILURE);
  }

  const { data: questions, error: questionsError } = await context.supabase
    .from("study_questions")
    .select("id, step, due_date")
    .eq("material_id", id)
    .eq("user_id", context.userId);

  if (questionsError) {
    return fail("Pertanyaan belum bisa dibaca. Coba lagi sebentar lagi.", true);
  }

  const byId = new Map((questions ?? []).map((question) => [question.id as string, question]));

  // Only questions of this material that are due today can be answered; a
  // second submit of the same session finds them already moved on.
  for (const item of items) {
    const question = byId.get(item.questionId);

    if (!question) {
      return fail(NOT_FOUND);
    }

    if (!isDue(question.due_date as string | null, today)) {
      return fail("Review ini sudah tersimpan. Muat ulang halaman untuk melihat jadwal berikutnya.");
    }
  }

  const plans = items.map((item) => {
    const question = byId.get(item.questionId)!;
    return { item, schedule: nextSchedule(question.step as number, item.rating, today) };
  });

  // The answers, the ratings, and the moved schedule land together (LEARN-3, LEARN-4).
  const { error: saveError } = await createSupabaseAdminClient().rpc("save_study_review", {
    p_user: context.userId,
    p_material: id,
    p_day: today,
    p_items: plans.map(({ item, schedule }) => ({
      question_id: item.questionId,
      answer: item.answer.trim(),
      rating: item.rating,
      step: schedule.step,
      due_date: schedule.dueDate,
    })),
  });

  if (saveError) {
    const already = saveError.code === "23505";

    if (!already) {
      console.error("saving a study review failed", { userId: context.userId, materialId: id, code: saveError.code });
    }

    return fail(
      already ? "Review ini sudah tersimpan. Muat ulang halaman untuk melihat jadwal berikutnya." : GENERIC_FAILURE,
      !already,
    );
  }

  let ai: AiStatus;

  try {
    ai = await loadAiStatus({
      reader: context.supabase,
      userId: context.userId,
      plan: context.plan,
      timeZone: context.timeZone,
      materialId: id,
      today,
    });
  } catch {
    ai = { available: false, reason: "Pemeriksaan AI belum bisa dimulai. Reviewmu sudah tersimpan." };
  }

  refresh(id);

  return {
    ok: true,
    next: plans.map(({ item, schedule }) => ({
      questionId: item.questionId,
      label: schedule.dueDate === null ? "Selesai, sudah nempel" : `Muncul lagi ${reviewDayLabel(schedule.dueDate, today)}`,
    })),
    ai,
  };
}

export type ReviewCheckOutcome =
  | { ok: true; feedback: { questionId: string; feedback: string }[]; checksLeft: number }
  | Failure;

/**
 * AI feedback on today's session of one material (LEARN-4): one check covers
 * every answer of the session that has no feedback yet. The reviews themselves
 * are already stored, so a failure here loses nothing.
 */
export async function checkReview(id: string): Promise<ReviewCheckOutcome> {
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return fail(NOT_FOUND);
  }

  const context = await getActionContext();

  if (!context) {
    return fail(SESSION_ENDED);
  }

  const materialId = parsedId.data;
  const today = todayKey(context.timeZone);

  const [{ data: material, error: materialError }, { data: reviews, error: reviewsError }] = await Promise.all([
    context.supabase
      .from("study_materials")
      .select("title, source")
      .eq("id", materialId)
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.supabase
      .from("study_reviews")
      .select("id, question_id, answer, study_questions(position, prompt, answer, kind)")
      .eq("material_id", materialId)
      .eq("user_id", context.userId)
      .eq("reviewed_on", today)
      .is("feedback", null),
  ]);

  if (materialError || reviewsError) {
    return fail("Reviewmu belum bisa dibaca. Coba lagi sebentar lagi.", true);
  }

  if (!material) {
    return fail(NOT_FOUND);
  }

  type ReviewRow = {
    id: number;
    question_id: string;
    answer: string;
    study_questions: { position: number; prompt: string; answer: string; kind: "recall" | "elaboration" } | null;
  };

  const rows = ((reviews ?? []) as unknown as ReviewRow[])
    .filter((row) => row.study_questions !== null)
    .sort((a, b) => a.study_questions!.position - b.study_questions!.position);

  if (rows.length === 0) {
    return fail("Tidak ada jawaban hari ini yang menunggu diperiksa.");
  }

  const reservation = await reserveCheck(context, materialId, "review", today);

  if (!reservation.ok) {
    return reservation;
  }

  const usages: TokenUsage[] = [];
  let result: Awaited<ReturnType<typeof checkReviewAnswers>>;

  try {
    result = await checkReviewAnswers(
      {
        title: material.title as string,
        source: material.source as string,
        items: rows.map((row, index) => ({
          number: index + 1,
          kind: row.study_questions!.kind,
          prompt: row.study_questions!.prompt,
          answer: row.study_questions!.answer,
          userAnswer: row.answer,
        })),
      },
      (usage) => usages.push(usage),
    );
  } catch (error) {
    console.error("study review check failed", { userId: context.userId, materialId, kind: (error as Error).name });
    await releaseCheck(reservation.reservationId, context.userId);
    return aiFailureMessage(error);
  } finally {
    await recordUsage(context.userId, "study", usages);
  }

  const feedback = result.items.map((item) => ({ row: rows[item.number - 1], feedback: item.feedback }));
  const { error: storeError } = await createSupabaseAdminClient().rpc("store_study_review_feedback", {
    p_user: context.userId,
    p_items: feedback.map(({ row, feedback: text }) => ({ id: row.id, feedback: text })),
  });

  if (storeError) {
    console.error("storing study review feedback failed", { userId: context.userId, materialId, code: storeError.code });
    await releaseCheck(reservation.reservationId, context.userId);
    return fail("Umpan balik belum tersimpan. Reviewmu aman. Coba lagi.", true);
  }

  refresh(materialId);

  return {
    ok: true,
    feedback: feedback.map(({ row, feedback: text }) => ({ questionId: row.question_id, feedback: text })),
    checksLeft: await checksLeftAfter(context, materialId, today),
  };
}
