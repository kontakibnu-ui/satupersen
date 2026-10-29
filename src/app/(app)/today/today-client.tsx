"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { EntryEditor } from "./entry-editor";
import { SummaryResultView, type SummaryResult } from "./summary-result";

/**
 * The states of DESIGN.md §7. The page already replaced the whole screen for
 * the crisis state, so what is left here is:
 * 1. empty: the button stays enabled and pressing it explains what to do;
 * 2. writing: the editor's own focus mode;
 * 3. summarising: the button says "Merangkum…" and a still skeleton shows;
 * 4. result: the result on top and the writing folded below, with no primary
 *    button (DESIGN.md §2);
 * 5. changed after the summary: a quiet line with "Rangkum ulang (sisa N)";
 * 6. failed: what happened, plus a secondary "Coba lagi" when trying again
 *    can help.
 */
type Phase = "idle" | "summarizing" | "failed";

/** Statuses where pressing "Coba lagi" cannot change the answer. */
const FINAL_STATUSES = new Set([400, 409, 429]);

export function TodayClient({
  date,
  initialContent,
  initialResult,
  regenLeft: initialRegenLeft,
}: {
  date: string;
  initialContent: string;
  initialResult: SummaryResult | null;
  regenLeft: number;
}) {
  const [content, setContent] = useState(initialContent);
  const [summarisedText, setSummarisedText] = useState<string | null>(
    initialResult ? initialContent : null,
  );
  const [result, setResult] = useState<SummaryResult | null>(initialResult);
  const [regenLeft, setRegenLeft] = useState(initialRegenLeft);
  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [retryable, setRetryable] = useState(true);
  const [blankHint, setBlankHint] = useState(false);

  const isBlank = content.trim() === "";
  const changed = result !== null && summarisedText !== null && content !== summarisedText;
  const showEditor = result === null || editing;

  const summarise = useCallback(async () => {
    // AI-1: an empty page never reaches the AI; the button explains instead.
    if (content.trim() === "") {
      setBlankHint(true);
      return;
    }

    setBlankHint(false);
    setPhase("summarizing");
    setMessage(undefined);

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const body = (await response.json()) as
        | ({ kind: "summary" } & SummaryResult)
        | { kind: "crisis" }
        | { kind: "error"; message: string };

      if (body.kind === "crisis") {
        // The crisis screen is a server render, so reload it rather than
        // painting a gentler version here.
        window.location.reload();
        return;
      }

      if (body.kind === "error") {
        setPhase("failed");
        setMessage(body.message);
        setRetryable(!FINAL_STATUSES.has(response.status));
        return;
      }

      if (result !== null) {
        setRegenLeft((left) => Math.max(0, left - 1));
      }

      setResult({
        summary: body.summary,
        strengths: body.strengths,
        improvements: body.improvements,
        tomorrowTip: body.tomorrowTip,
        score: body.score,
        deltaPct: body.deltaPct,
        scoreReason: body.scoreReason,
        scoredDays: body.scoredDays,
      });
      setSummarisedText(content);
      setEditing(false);
      setPhase("idle");
    } catch {
      setPhase("failed");
      setMessage("Koneksi terputus. Tulisanmu aman. Coba lagi.");
      setRetryable(true);
    }
  }, [content, date, result]);

  return (
    <>
      {result ? <SummaryResultView result={result} /> : null}

      {showEditor ? (
        <EntryEditor
          date={date}
          initialContent={content}
          onContentChange={(value) => {
            setContent(value);

            if (value.trim() !== "") {
              setBlankHint(false);
            }
          }}
        />
      ) : (
        <section aria-label="Tulisanmu hari ini" className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-text">Tulisanmu hari ini</h2>
            <Button variant="link" onClick={() => setEditing(true)}>
              Ubah tulisan
            </Button>
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-line font-serif text-editor text-text-muted">
            {content}
          </p>
        </section>
      )}

      <div className="mt-6">
        {result === null ? (
          <Button onClick={summarise} disabled={phase === "summarizing"} className="w-full">
            {phase === "summarizing" ? "Merangkum…" : "Rangkum hari ini"}
          </Button>
        ) : null}

        {blankHint && isBlank ? (
          <p aria-live="polite" className="mt-2 text-sm text-text-muted">
            Tulis minimal satu kalimat dulu
          </p>
        ) : null}

        {phase === "summarizing" ? (
          <div className="mt-4">
            <p aria-live="polite" className="text-sm text-text-muted">
              Sedang membaca harimu…
            </p>
            <div aria-hidden="true" className="mt-3 flex flex-col gap-2">
              <div className="h-4 w-3/4 rounded-sm bg-surface-muted" />
              <div className="h-4 w-full rounded-sm bg-surface-muted" />
              <div className="h-4 w-2/3 rounded-sm bg-surface-muted" />
            </div>
          </div>
        ) : null}

        {phase === "failed" ? (
          <div className="mt-2" aria-live="polite">
            <p className="text-sm text-text-muted">{message}</p>
            {retryable ? (
              <Button variant="secondary" onClick={summarise} className="mt-2">
                Coba lagi
              </Button>
            ) : null}
          </div>
        ) : null}

        {phase === "idle" && changed ? (
          <p className="text-sm text-text-muted">
            Tulisanmu berubah sejak dirangkum.{" "}
            {regenLeft > 0 ? (
              <Button variant="link" size="inline" onClick={summarise}>
                Rangkum ulang (sisa {regenLeft})
              </Button>
            ) : (
              <span>Rangkum ulang hari ini sudah terpakai.</span>
            )}
          </p>
        ) : null}
      </div>
    </>
  );
}
