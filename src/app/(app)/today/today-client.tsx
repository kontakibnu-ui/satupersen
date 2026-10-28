"use client";

import { useCallback, useState } from "react";
import { EntryEditor } from "./entry-editor";
import { SummaryResultView, type SummaryResult } from "./summary-result";

/**
 * DESIGN.md §7 lists seven states for this screen. The page has already handled
 * the crisis state by replacing the whole screen, so what is left here is:
 * empty, writing, summarising, the result, changed-after-summary, and failed.
 */
type State = "idle" | "summarizing" | "failed";

export function TodayClient({
  date,
  initialContent,
  initialResult,
  regenLeft,
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
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  const isBlank = content.trim() === "";
  const changed = result !== null && summarisedText !== null && content !== summarisedText;

  const summarise = useCallback(async () => {
    setState("summarizing");
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
        setState("failed");
        setMessage(body.message);
        return;
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
      setState("idle");
    } catch {
      setState("failed");
      setMessage("Koneksi terputus. Tulisanmu aman. Coba lagi.");
    }
  }, [date, content]);

  return (
    <>
      <EntryEditor
        date={date}
        initialContent={initialContent}
        onContentChange={setContent}
      />

      {result ? <SummaryResultView result={result} /> : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={summarise}
          disabled={state === "summarizing" || isBlank}
          className="flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-base text-primary-foreground disabled:opacity-50"
        >
          {state === "summarizing" ? "Merangkum…" : "Rangkum hari ini"}
        </button>

        {state === "summarizing" ? (
          <p className="mt-2 text-sm text-text-muted">Sedang membaca harimu…</p>
        ) : null}

        {state === "failed" ? (
          <div className="mt-2">
            <p className="text-sm text-text-muted">{message}</p>
            <button type="button" onClick={summarise} className="mt-1 text-sm text-text underline">
              Coba lagi
            </button>
          </div>
        ) : null}

        {state === "idle" && changed ? (
          <p className="mt-2 text-sm text-text-muted">
            Tulisanmu berubah sejak dirangkum.{" "}
            {regenLeft > 0 ? (
              <button type="button" onClick={summarise} className="text-text underline">
                Rangkum ulang (sisa {regenLeft})
              </button>
            ) : (
              <span>Batas rangkum ulang hari ini sudah terpakai.</span>
            )}
          </p>
        ) : null}

        {state === "idle" && !changed && result ? (
          <p className="mt-2 text-sm text-text-muted">
            Ringkasan ini dibuat dari tulisanmu tadi.{" "}
            {regenLeft > 0 ? (
              <button type="button" onClick={summarise} className="text-text underline">
                Rangkum ulang (sisa {regenLeft})
              </button>
            ) : (
              <span>Batas rangkum ulang hari ini sudah terpakai.</span>
            )}
          </p>
        ) : null}

        {isBlank && state === "idle" ? (
          <p className="mt-2 text-sm text-text-muted">
            Tombolnya hidup setelah kamu menulis minimal satu kalimat.
          </p>
        ) : null}
      </div>
    </>
  );
}
