import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BinderSheet, SectionHead } from "@/components/notebook";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isValidTimeZone, todayKey } from "@/lib/dates";
import { toFeedbackView } from "@/lib/study/feedback";
import { RATING_LABELS, type Rating } from "@/lib/study/rules";
import { isDue, materialState, reviewDayLabel, type MaterialState } from "@/lib/study/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FeedbackSheet } from "../feedback-sheet";
import { loadAiStatus } from "../learn-data";
import { CheckReviewButton } from "./check-review-button";
import { DeleteMaterial } from "./delete-material";
import { ExplainPanel } from "./explain-panel";
import { ReviewSession } from "./review-session";

export const metadata: Metadata = {
  title: "Materi · Satu Persen",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type QuestionRow = {
  id: string;
  position: number;
  prompt: string;
  answer: string;
  kind: "recall" | "elaboration";
  due_date: string | null;
};

type ReviewRow = { question_id: string; answer: string; rating: Rating; feedback: string | null };

function statusLine(state: MaterialState, today: string): string {
  switch (state.kind) {
    case "draft":
      return "Belum diperiksa";
    case "due":
      return `${state.dueCount} pertanyaan menunggu hari ini`;
    case "waiting":
      return `Review berikutnya ${reviewDayLabel(state.nextDue, today)}`;
    case "finished":
      return "Selesai, semua pertanyaan sudah nempel";
  }
}

function nextLabel(dueDate: string | null, today: string): string {
  return dueDate === null ? "Selesai, sudah nempel" : `Muncul lagi ${reviewDayLabel(dueDate, today)}`;
}

/**
 * One material (LEARN-2 to LEARN-5, LEARN-8; DESIGN.md §2, §6, §8). What it
 * shows follows from the material's state on the user's local day:
 * - draft: the "Jelaskan dengan kata sendiri" sheet is the focus;
 * - questions due: the review session is the focus;
 * - reviewed today: the stored results with their feedback;
 * - otherwise: the explanation feedback, the questions and their next dates,
 *   and "Jelaskan ulang".
 * The material sits closed under it, and deleting is a small link at the end.
 */
export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const backLink = (
    <Link href="/learn" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
      <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
      Belajar
    </Link>
  );

  const [profileResult, materialResult] = await Promise.all([
    supabase.from("profiles").select("timezone, plan").eq("id", userId).maybeSingle(),
    UUID_PATTERN.test(id)
      ? supabase
          .from("study_materials")
          .select("id, title, source, status, explanation, feedback")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileResult.error || materialResult.error) {
    throw new Error("Materi tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const material = materialResult.data;

  if (!material) {
    return (
      <main className="py-6 md:py-10">
        <PageHeader eyebrow={backLink} title="Materi tidak ditemukan" />
        <Card as="div" className="mt-6">
          <p className="text-base text-text">Materi ini tidak ada, atau sudah dihapus.</p>
          <Link href="/learn" className={buttonVariants({ variant: "secondary", className: "mt-5" })}>
            Kembali ke Belajar
          </Link>
        </Card>
      </main>
    );
  }

  const profile = profileResult.data;
  const timeZone = profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const plan = profile?.plan === "premium" ? "premium" : "free";
  const today = todayKey(timeZone);

  const [questionsResult, reviewsResult, ai] = await Promise.all([
    supabase
      .from("study_questions")
      .select("id, position, prompt, answer, kind, due_date")
      .eq("material_id", material.id)
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("study_reviews")
      .select("question_id, answer, rating, feedback")
      .eq("material_id", material.id)
      .eq("user_id", userId)
      .eq("reviewed_on", today),
    loadAiStatus({ reader: supabase, userId, plan, timeZone, materialId: material.id, today }),
  ]);

  if (questionsResult.error || reviewsResult.error) {
    throw new Error("Pertanyaan review tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const questions = (questionsResult.data ?? []) as QuestionRow[];
  const reviewsToday = (reviewsResult.data ?? []) as ReviewRow[];
  const status = material.status === "active" ? "active" : "draft";
  const state = materialState(
    status,
    questions.map((question) => question.due_date),
    today,
  );
  const feedback = toFeedbackView(material.feedback);
  const dueQuestions = questions.filter((question) => isDue(question.due_date, today));
  const reviewedQuestions = questions.filter((question) =>
    reviewsToday.some((review) => review.question_id === question.id),
  );

  return (
    <main className="py-6 md:py-10">
      <PageHeader eyebrow={backLink} title={material.title as string} description={statusLine(state, today)} />

      {state.kind === "draft" ? (
        <ExplainPanel
          key="draft"
          materialId={material.id as string}
          initialExplanation={(material.explanation as string | null) ?? ""}
          ai={ai}
          again={false}
        />
      ) : null}

      {state.kind === "due" ? (
        <ReviewSession
          materialId={material.id as string}
          questions={dueQuestions.map(({ id: questionId, prompt, answer, kind }) => ({ id: questionId, prompt, answer, kind }))}
          ai={ai}
        />
      ) : null}

      {state.kind !== "draft" && state.kind !== "due" && reviewedQuestions.length > 0 ? (
        <BinderSheet aria-labelledby="reviewed-title" className="mt-6">
          <SectionHead id="reviewed-title" title="Review hari ini selesai" />
          <ol className="mt-[18px] flex flex-col gap-6">
            {reviewedQuestions.map((question, index) => {
              const review = reviewsToday.find((row) => row.question_id === question.id)!;

              return (
                <li key={question.id}>
                  <p className="text-base font-semibold text-text">
                    {index + 1}. {question.prompt}
                  </p>
                  {review.answer.trim() === "" ? (
                    <p className="mt-2 text-sm text-text-muted">Kamu tidak menulis jawaban.</p>
                  ) : (
                    <p className="binder-bleed paper-lines mt-2 whitespace-pre-line font-serif text-editor text-primary">
                      {review.answer}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-text-muted">
                    Kamu menilai: {RATING_LABELS[review.rating]}. {nextLabel(question.due_date, today)}.
                  </p>
                  {review.feedback ? (
                    <div className="mt-3">
                      <p className="text-sm text-text-muted">Diperiksa AI dari bahanmu</p>
                      <p className="mt-1 text-base text-text">{review.feedback}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {reviewsToday.some((review) => review.feedback === null) ? (
            ai.available ? (
              <CheckReviewButton materialId={material.id as string} />
            ) : (
              <p className="mt-5 text-sm text-text-muted">{ai.reason}</p>
            )
          ) : null}
        </BinderSheet>
      ) : null}

      {state.kind === "finished" ? (
        <Card as="div" className="mt-6">
          <p className="text-base text-text">Semua pertanyaan materi ini sudah nempel.</p>
          <p className="mt-1 text-sm text-text-muted">Kamu masih bisa menjelaskannya ulang kapan saja.</p>
        </Card>
      ) : null}

      {state.kind !== "draft" && feedback ? (
        <div className="mt-4">
          <FeedbackSheet feedback={feedback} headingId="feedback-title" />
        </div>
      ) : null}

      {state.kind !== "draft" && state.kind !== "due" ? (
        <ExplainPanel
          key="again"
          materialId={material.id as string}
          initialExplanation={(material.explanation as string | null) ?? ""}
          ai={ai}
          again
        />
      ) : null}

      {state.kind !== "draft" ? (
        <section aria-labelledby="questions-title" className="mt-6">
          <SectionHead id="questions-title" title="Pertanyaan review" aside={`${questions.length} pertanyaan`} />
          <ol className="flex flex-col">
            {questions.map((question, index) => (
              <li key={question.id} className="flex min-h-14 flex-col justify-center border-b border-rule py-2">
                <p className="text-base text-text">
                  {index + 1}. {question.prompt}
                </p>
                <p className="mt-0.5 text-sm text-text-muted">{nextLabel(question.due_date, today)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <details className="group mt-6 rounded-[14px] border border-border bg-surface px-[18px] py-1 md:px-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            size={18}
            strokeWidth={1.8}
            className="shrink-0 transition-transform duration-200 group-open:rotate-90"
          />
          Lihat bahan
        </summary>
        <p className="mt-2 mb-3 max-w-[65ch] whitespace-pre-line font-serif text-base leading-7 text-text">
          {material.source as string}
        </p>
        {state.kind === "draft" ? (
          <Link
            href={`/learn/${material.id}/edit`}
            className={buttonVariants({ variant: "link", className: "mb-1 text-sm font-semibold text-primary" })}
          >
            Ubah bahan
          </Link>
        ) : null}
      </details>

      <DeleteMaterial materialId={material.id as string} title={material.title as string} isFree={plan === "free"} />
    </main>
  );
}
