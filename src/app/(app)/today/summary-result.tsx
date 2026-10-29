import { ArrowDown, ArrowUp } from "lucide-react";
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

/**
 * "Hari Ini, hasil" from DESIGN.md §6 and §8. The score is the one focus; the
 * delta, the reason, the lists, and "Untuk besok" stay quiet. No card around
 * it, no check or cross icons, and nothing turns red on a bad day.
 *
 * The ring is 160 px on phones and 184 px from 768 px up. Two sizes are
 * rendered and one is hidden with `display: none`, so only one ever reaches
 * screen readers.
 */
export function SummaryResultView({ result }: { result: SummaryResult }) {
  const rising = (result.deltaPct ?? 0) >= 0;

  return (
    <section aria-label="Hasil hari ini" className="mt-8">
      <div className="flex flex-col items-center">
        <div className="md:hidden">
          <ScoreRing score={result.score} size={160} />
        </div>
        <div className="hidden md:block">
          <ScoreRing score={result.score} size={184} />
        </div>

        <p className="mt-3 flex items-center gap-1 text-sm text-text-muted">
          {result.deltaPct === null ? (
            `Persen muncul setelah 3 hari menulis (${Math.min(result.scoredDays, 3)}/3)`
          ) : (
            <>
              {rising ? (
                <ArrowUp className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <ArrowDown className="size-4" aria-hidden="true" />
              )}
              {`${Math.abs(result.deltaPct)}% ${rising ? "di atas" : "di bawah"} rata-rata 7 harimu`}
            </>
          )}
        </p>
      </div>

      {/* SCORE-3: the reason sits right under the score and is always visible. */}
      <p className="mt-4 text-base text-text">{result.scoreReason}</p>
      <p className="mt-4 text-base text-text">{result.summary}</p>

      <ResultList title="Yang sudah bagus" items={result.strengths} />
      <ResultList title="Ruang untuk tumbuh" items={result.improvements} />

      <div className="mt-8 rounded-lg bg-surface-muted p-4">
        <p className="text-sm text-text-muted">Untuk besok</p>
        <p className="mt-1 text-base text-text">{result.tomorrowTip}</p>
      </div>
    </section>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <h2 className="mt-8 text-sm font-semibold text-text">{title}</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-base text-text">
            <span aria-hidden="true" className="mt-[0.65rem] size-1.5 shrink-0 rounded-full bg-text-muted" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
