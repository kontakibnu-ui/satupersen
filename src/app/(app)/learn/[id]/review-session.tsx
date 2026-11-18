"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BinderSheet, SectionHead, StickyNote } from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { MAX_ANSWER_LENGTH, RATING_LABELS, RATINGS, type Rating } from "@/lib/study/rules";
import { checkReview, saveReview } from "../actions";
import type { AiStatus } from "../learn-data";
import { LinedTextarea } from "../lined-textarea";

export type DueQuestion = {
  id: string;
  prompt: string;
  answer: string;
  kind: "recall" | "elaboration";
};

type Phase = "answering" | "revealed" | "saving" | "checking";

/**
 * One review session (LEARN-4; DESIGN.md §6 "Sesi review"). Retrieval first:
 * every due question is answered from memory before any answer is shown. Then
 * "Lihat jawaban" shows the answer from the material and the user rates each
 * question; that rating alone moves the schedule (LEARN-3). After saving, the
 * session's answers go to the AI for feedback when a check is left, and the page
 * is read again so the stored results and the next dates show.
 */
export function ReviewSession({
  materialId,
  questions,
  ai,
}: {
  materialId: string;
  questions: DueQuestion[];
  ai: AiStatus;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [phase, setPhase] = useState<Phase>("answering");
  const [message, setMessage] = useState<string | undefined>(undefined);

  const revealed = phase !== "answering";

  function reveal() {
    const tooLong = questions.some((question) => (answers[question.id] ?? "").length > MAX_ANSWER_LENGTH);

    if (tooLong) {
      setMessage(`Jawaban maksimal ${new Intl.NumberFormat("id-ID").format(MAX_ANSWER_LENGTH)} karakter.`);
      return;
    }

    setMessage(undefined);
    setPhase("revealed");
  }

  async function save() {
    if (questions.some((question) => ratings[question.id] === undefined)) {
      setMessage("Nilai semua pertanyaan dulu: Lupa, Ragu, atau Ingat.");
      return;
    }

    setPhase("saving");
    setMessage(undefined);

    const saved = await saveReview({
      id: materialId,
      items: questions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] ?? "",
        rating: ratings[question.id],
      })),
    });

    if (!saved.ok) {
      setPhase("revealed");
      setMessage(saved.message);
      return;
    }

    // The review is stored. Feedback is a bonus: when it fails or no check is
    // left, the page shows the stored results and says so.
    if (saved.ai.available) {
      setPhase("checking");
      await checkReview(materialId);
    }

    router.refresh();
  }

  return (
    <BinderSheet id="review" aria-labelledby="review-title" className="mt-6 scroll-mt-4">
      <SectionHead id="review-title" title="Review hari ini" />
      <p className="mt-2 text-sm text-text-muted">
        {revealed
          ? "Bandingkan dengan bahan, lalu nilai seberapa ingat kamu."
          : "Jawab dari ingatan dulu, tanpa membuka bahan. Kosong juga tidak apa-apa."}
      </p>

      <ol className="mt-[18px] flex flex-col">
        {questions.map((question, index) => {
          const answer = answers[question.id] ?? "";
          const fieldId = `answer-${question.id}`;

          return (
            <li key={question.id} className="border-rule not-first:mt-[30px] not-first:border-t not-first:pt-[22px]">
              <h3 className="text-base font-semibold text-text">
                {index + 1}. {question.prompt}
              </h3>
              {question.kind === "elaboration" ? (
                <p className="mt-0.5 text-sm text-text-muted">Hubungkan dengan pemahamanmu</p>
              ) : null}

              {revealed ? (
                <>
                  {answer.trim() === "" ? (
                    <p className="mt-2 text-sm text-text-muted">Kamu tidak menulis jawaban.</p>
                  ) : (
                    <>
                      <p className="mt-2.5 text-xs text-text-muted">Jawabanmu</p>
                      <p className="binder-bleed paper-lines whitespace-pre-line font-serif text-editor text-primary">
                        {answer}
                      </p>
                    </>
                  )}

                  <StickyNote className="mt-[18px]">
                    <h4 className="text-sm font-bold text-primary">Menurut bahan</h4>
                    <p className="mt-0.5 text-base text-text">{question.answer}</p>
                  </StickyNote>

                  <fieldset className="mt-[18px]" disabled={phase !== "revealed"}>
                    <legend className="text-sm font-bold text-text">Seberapa ingat?</legend>
                    <div className="mt-2 flex gap-1 rounded-full bg-surface-muted p-1">
                      {RATINGS.map((rating) => (
                        <label key={rating} className="relative flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`rating-${question.id}`}
                            value={rating}
                            checked={ratings[question.id] === rating}
                            onChange={() => setRatings((current) => ({ ...current, [question.id]: rating }))}
                            className="peer sr-only"
                          />
                          <span className="flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium text-text-muted transition-colors duration-200 peer-checked:bg-surface peer-checked:font-bold peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-checked:[&_svg]:inline">
                            <Check aria-hidden="true" size={15} strokeWidth={2.4} className="hidden" />
                            {RATING_LABELS[rating]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : (
                <>
                  <label htmlFor={fieldId} className="mt-2.5 block text-sm text-text-muted">
                    Jawabanmu
                  </label>
                  <LinedTextarea
                    id={fieldId}
                    value={answer}
                    onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                    rows={3}
                    invalid={answer.length > MAX_ANSWER_LENGTH}
                    onSheet
                  />
                </>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-[26px]">
        {phase === "answering" ? (
          <Button onClick={reveal} className="w-full">
            Lihat jawaban
          </Button>
        ) : (
          <Button onClick={save} disabled={phase !== "revealed"} className="w-full">
            {phase === "saving" ? "Menyimpan…" : phase === "checking" ? "Tersimpan" : "Simpan review"}
          </Button>
        )}
      </div>

      <div aria-live="polite" className="mt-3">
        {phase === "checking" ? (
          <p className="text-sm text-text-muted">Review tersimpan. Sedang memeriksa jawabanmu…</p>
        ) : message ? (
          <p className="text-base text-text">{message}</p>
        ) : revealed ? (
          <p className="text-sm text-text-muted">
            {ai.available ? "Setelah disimpan, AI memeriksa jawabanmu dari bahan." : ai.reason}
          </p>
        ) : null}
      </div>
    </BinderSheet>
  );
}
