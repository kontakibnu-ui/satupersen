import { ArrowDown, ArrowUp, ArrowRight, Check } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";

/** What the screen needs, which is all the endpoint returns. */
export type SummaryResult = {
  summary: string;
  strengths: string[];
  improvements: string[];
  tomorrowTip: string;
  score: number;
  deltaPct: number | null;
  scoreReason: string;
  scoredDays: number;
};

export function SummaryResultView({
  result,
  size = 160,
}: {
  result: SummaryResult;
  size?: 160 | 184;
}) {
  const rising = (result.deltaPct ?? 0) >= 0;

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col items-center">
        <ScoreRing score={result.score} size={size} />

        <p className="mt-3 flex items-center gap-1 text-sm text-text-muted">
          {result.deltaPct === null ? (
            `Persen muncul setelah 3 hari menulis (${result.scoredDays}/3)`
          ) : (
            <>
              {rising ? (
                <ArrowUp className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <ArrowDown className="size-4" aria-hidden="true" />
              )}
              {`${Math.abs(result.deltaPct)}% ${
                rising ? "di atas" : "di bawah"
              } rata-rata 7 harimu`}
            </>
          )}
        </p>

        <p className="mt-2 text-center text-sm text-text-muted">{result.scoreReason}</p>
      </div>

      <p className="mt-4 text-base text-text">{result.summary}</p>

      <h3 className="mt-4 text-lg font-medium text-text">Kelebihan hari ini</h3>
      <ul className="mt-1 space-y-1">
        {result.strengths.map((item) => (
          <li key={item} className="flex gap-2 text-base text-text">
            <Check className="mt-1 size-5 shrink-0 text-text-muted" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-lg font-medium text-text">Perlu diperbaiki</h3>
      <ul className="mt-1 space-y-1">
        {result.improvements.map((item) => (
          <li key={item} className="flex gap-2 text-base text-text">
            <ArrowRight className="mt-1 size-5 shrink-0 text-text-muted" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-md bg-surface-muted p-4">
        <h3 className="text-sm text-text-muted">Untuk besok</h3>
        <p className="mt-1 text-base text-text">{result.tomorrowTip}</p>
      </div>
    </section>
  );
}
