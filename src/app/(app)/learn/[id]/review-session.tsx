"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BinderSheet, SectionHead, StickyNote } from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { MAX_ANSWER_LENGTH, RATING_LABELS, RATINGS, type Rating } from "@/lib/study/rules";
import { cn } from "@/lib/utils";
import { checkReview, saveReview } from "../actions";
import type { AiStatus } from "../learn-data";
import { LinedTextarea } from "../lined-textarea";

export type DueQuestion = {
  id: string;
  prompt: string;
  answer: string;
  kind: "recall" | "elaboration";
};

type Phase = "working" | "saving" | "checking";

/**
 * One review session, one question at a time (LEARN-4 as changed on
 * 2026-11-22; DESIGN.md §15.8). Retrieval first: the question is answered from
 * memory, then "Lihat jawaban" shows the answer from the material and the user
 * rates it; that rating alone moves the schedule (LEARN-3). "Lanjut" goes to the
 * next question and "Sebelumnya" back. Everything is saved at once on the last
 * question, so the AI still checks the whole session in one go (LEARN-5), and
 * the page is read again so the stored results and the next dates show.
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
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const promptRef = useRef<HTMLHeadingElement | null>(null);
  const moved = useRef(false);

  const question = questions[index];
  const answer = answers[question.id] ?? "";
  const revealed = shown[question.id] === true;
  const isLast = index === questions.length - 1;

  // A new card takes the focus to its question, so a screen reader and the
  // keyboard start where the eyes do. Not on the first render.
  useEffect(() => {
    if (moved.current) {
      promptRef.current?.focus();
    }
  }, [index]);

  function go(next: number) {
    moved.current = true;
    setMessage(undefined);
    setIndex(next);
  }

  function reveal() {
    if (answer.length > MAX_ANSWER_LENGTH) {
      setMessage(`Jawaban maksimal ${new Intl.NumberFormat("id-ID").format(MAX_ANSWER_LENGTH)} karakter.`);
      return;
    }

    setMessage(undefined);
    setShown((current) => ({ ...current, [question.id]: true }));
  }

  function proceed() {
    if (ratings[question.id] === undefined) {
      setMessage("Pilih dulu: Lupa, Ragu, atau Ingat.");
      return;
    }

    if (!isLast) {
      go(index + 1);
      return;
    }

    void save();
  }

  async function save() {
    const unrated = questions.findIndex((item) => ratings[item.id] === undefined);

    if (unrated !== -1) {
      go(unrated);
      setMessage("Pilih dulu: Lupa, Ragu, atau Ingat.");
      return;
    }

    setPhase("saving");
    setMessage(undefined);

    const saved = await callAction(() =>
      saveReview({
        id: materialId,
        items: questions.map((item) => ({
          questionId: item.id,
          answer: answers[item.id] ?? "",
          rating: ratings[item.id],
        })),
      }),
    );

    if (!saved.ok) {
      setPhase("working");
      setMessage(saved.message);
      return;
    }

    // The review is stored. Feedback is a bonus: when it fails or no check is
    // left, the page shows the stored results and says so.
    if (saved.ai.available) {
      setPhase("checking");
      await callAction(() => checkReview(materialId));
    }

    router.refresh();
  }

  const fieldId = `answer-${question.id}`;

  return (
    <BinderSheet id="review" aria-labelledby="review-title" className="mt-6 scroll-mt-4">
      <SectionHead
        id="review-title"
        title="Review hari ini"
        aside={
          questions.length > 1 ? (
            <span className="inline-flex items-center gap-2.5">
              <span>
                {index + 1} dari {questions.length}
              </span>
              <span aria-hidden="true" className="flex gap-1.5">
                {questions.map((item, position) => (
                  <span
                    key={item.id}
                    className={cn("size-2 rounded-full", position === index ? "bg-primary" : "bg-rule-strong")}
                  />
                ))}
              </span>
            </span>
          ) : null
        }
      />

      <h3
        ref={promptRef}
        tabIndex={-1}
        className="mt-[22px] font-heading text-lg leading-snug font-semibold text-text focus:outline-none"
      >
        {question.prompt}
      </h3>
      {question.kind === "elaboration" ? (
        <p className="mt-0.5 text-sm text-text-muted">Hubungkan dengan pemahamanmu</p>
      ) : null}

      {revealed ? (
        <>
          {answer.trim() === "" ? (
            <p className="mt-3 text-sm text-text-muted">Kamu tidak menulis jawaban.</p>
          ) : (
            <>
              <p className="mt-3 text-xs text-text-muted">Jawabanmu</p>
              <p className="binder-bleed paper-lines whitespace-pre-line font-serif text-editor text-primary">{answer}</p>
            </>
          )}

          <StickyNote className="mt-[18px]">
            <h4 className="text-sm font-bold text-primary">Menurut bahan</h4>
            <p className="mt-0.5 text-base text-text">{question.answer}</p>
          </StickyNote>

          <fieldset className="mt-5" disabled={phase !== "working"}>
            <legend className="text-sm font-bold text-text">Seberapa ingat?</legend>
            <div className="mt-2 flex gap-1 rounded-full bg-surface-muted p-1">
              {RATINGS.map((rating) => (
                <label key={rating} className="relative flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name={`rating-${question.id}`}
                    value={rating}
                    checked={ratings[question.id] === rating}
                    onChange={() => {
                      setMessage(undefined);
                      setRatings((current) => ({ ...current, [question.id]: rating }));
                    }}
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
          {index === 0 ? (
            <p className="mt-1 text-sm text-text-muted">Jawab dari ingatan dulu, tanpa membuka bahan. Kosong juga tidak apa-apa.</p>
          ) : null}
          <label htmlFor={fieldId} className="mt-3 block text-sm text-text-muted">
            Jawabanmu
          </label>
          <LinedTextarea
            // A new card is a new field, so the lines and the height start fresh.
            key={fieldId}
            id={fieldId}
            value={answer}
            onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
            rows={4}
            invalid={answer.length > MAX_ANSWER_LENGTH}
            onSheet
          />
        </>
      )}

      <div className="mt-[26px]">
        {!revealed ? (
          <Button onClick={reveal} className="w-full">
            Lihat jawaban
          </Button>
        ) : (
          <Button onClick={proceed} disabled={phase !== "working"} className="w-full">
            {phase === "saving"
              ? "Menyimpan…"
              : phase === "checking"
                ? "Tersimpan"
                : isLast
                  ? "Simpan review"
                  : `Lanjut ke pertanyaan ${index + 2}`}
          </Button>
        )}
        {index > 0 && phase === "working" ? (
          <div className="mt-2 flex justify-center">
            <Button variant="link" onClick={() => go(index - 1)} className="text-sm font-semibold text-primary">
              Sebelumnya
            </Button>
          </div>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-3">
        {phase === "checking" ? (
          <p className="text-sm text-text-muted">Review tersimpan. Sedang memeriksa jawabanmu…</p>
        ) : message ? (
          <p className="text-base text-text">{message}</p>
        ) : revealed && isLast ? (
          <p className="text-sm text-text-muted">
            {ai.available ? "Setelah disimpan, AI memeriksa jawabanmu dari bahan." : ai.reason}
          </p>
        ) : null}
      </div>
    </BinderSheet>
  );
}
