"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BinderSheet } from "@/components/notebook";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { MAX_EXPLANATION_LENGTH } from "@/lib/study/rules";
import { checkMaterialExplanation } from "../actions";
import type { AiStatus } from "../learn-data";
import { LinedTextarea } from "../lined-textarea";

const formatCount = (value: number) => new Intl.NumberFormat("id-ID").format(value);

/**
 * "Jelaskan dengan kata sendiri" (LEARN-2; DESIGN.md §6 "Lembaran menjelaskan").
 * The server saves the explanation before it asks the model, so a failed or
 * refused check loses nothing. On success the page is read again, which brings
 * the feedback and, after the first check, the review questions.
 *
 * The button stays usable when no check is left: pressing it still saves the
 * text, and the server's answer says why it was not checked.
 */
export function ExplainPanel({
  materialId,
  initialExplanation,
  ai,
  again,
}: {
  materialId: string;
  initialExplanation: string;
  ai: AiStatus;
  /** An active material: explaining again, with the questions already made. */
  again: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!again);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [phase, setPhase] = useState<"idle" | "checking">("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [retryable, setRetryable] = useState(false);

  const tooLong = explanation.length > MAX_EXPLANATION_LENGTH;

  async function check() {
    if (explanation.trim() === "") {
      setMessage("Tulis minimal satu kalimat dulu, apa pun yang kamu ingat.");
      setRetryable(false);
      return;
    }

    if (tooLong) {
      setMessage(`Penjelasan maksimal ${formatCount(MAX_EXPLANATION_LENGTH)} karakter.`);
      setRetryable(false);
      return;
    }

    setPhase("checking");
    setMessage(undefined);

    const result = await callAction(() => checkMaterialExplanation({ id: materialId, explanation }));

    if (!result.ok) {
      setPhase("idle");
      setMessage(result.message);
      setRetryable(result.retryable ?? false);
      return;
    }

    if (again) {
      setOpen(false);
    }

    setPhase("idle");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="mt-4">
        Jelaskan ulang
      </Button>
    );
  }

  return (
    <BinderSheet aria-labelledby="explain-title" className="mt-6">
      <h2 id="explain-title" className="font-heading text-base font-bold text-text">
        Jelaskan dengan kata sendiri
      </h2>
      <p id="explain-hint" className="mt-1 text-sm text-text-muted">
        {again
          ? "Tulis lagi tanpa melihat bahan. Pertanyaan dan jadwal reviewmu tidak berubah."
          : "Tutup bahannya, lalu tulis apa yang kamu pahami seolah menjelaskan ke teman."}
      </p>

      <label htmlFor="explanation" className="mt-3 block text-sm font-semibold text-text">
        Penjelasanmu
      </label>
      <LinedTextarea
        id="explanation"
        value={explanation}
        onChange={setExplanation}
        rows={6}
        describedBy="explain-hint"
        invalid={tooLong}
        disabled={phase === "checking"}
        placeholder="Mulai dari yang paling kamu ingat."
        onSheet
        className="mt-1.5 border-t-[3px] border-double border-rule-strong"
      />
      {explanation.length > MAX_EXPLANATION_LENGTH - 500 ? (
        <p className={`mt-2 text-sm tabular-nums ${tooLong ? "font-semibold text-text" : "text-text-muted"}`}>
          {formatCount(explanation.length)} / {formatCount(MAX_EXPLANATION_LENGTH)}
        </p>
      ) : null}

      <div className="mt-[18px] flex flex-col gap-3">
        <Button onClick={check} disabled={phase === "checking"} className="w-full">
          {phase === "checking" ? "Memeriksa…" : "Periksa penjelasan"}
        </Button>
        {again ? (
          <Button variant="link" onClick={() => setOpen(false)} disabled={phase === "checking"} className="self-center">
            Batal
          </Button>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-2.5 text-center">
        {phase === "checking" ? (
          <p className="text-sm text-text-muted">Sedang membandingkan dengan bahanmu…</p>
        ) : message ? (
          <div>
            <p className="text-base text-text">{message}</p>
            {retryable ? (
              <Button variant="secondary" onClick={check} className="mt-3">
                Coba lagi
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            {ai.available ? `Sisa pemeriksaan AI hari ini: ${ai.left}` : ai.reason}
          </p>
        )}
      </div>
    </BinderSheet>
  );
}
