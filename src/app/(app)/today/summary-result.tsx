import { Sprout, Stamp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { deltaFigure, deltaSentence } from "@/lib/score-delta";
import { cn } from "@/lib/utils";

/** What the screen needs, which is all the endpoint returns. */
export type SummaryResult = {
  summary: string;
  strengths: string[];
  improvements: string[];
  tomorrowTip: string;
  /** Sets the height of today's bar only; the number is not shown (SCORE-2). */
  score: number;
  delta: number | null;
  comparedTo: string | null;
  scoreReason: string;
};

/** One day of the week strip, oldest first and today last; `score` is null for a day without an analysis. */
export type WeekDay = { date: string; label: string; score: number | null };

/**
 * "Hari Ini, hasil" from DESIGN.md §6 (version 4, "Buku tulis"): one sheet of
 * the notebook, not a stack of cards. From the top:
 * - "Analisa hari ini", so it is plain that the AI wrote what follows;
 * - the change against the last scored day as a large figure in ink ("+2%")
 *   beside the same change in words (SCORE-2: no 0 to 100 number);
 * - the week strip: the six days before as pale bars and today in ink, a day
 *   without an analysis as a hairline. Today's bar always comes from `result`,
 *   so a fresh analysis shows without a reload. Bar heights follow the score but no
 *   number is printed, so the strip is decoration for screen readers;
 * - the reason for the score, always visible (SCORE-3);
 * - the analysis, the two lists, and "Untuk besok" written on the ruled lines.
 * A lower day reads as calmly as a better one: one ink, never red.
 */
export function SummaryResultView({ result, week }: { result: SummaryResult; week: WeekDay[] }) {
  const compared = result.delta !== null && result.comparedTo !== null;
  const strip = week.map((day, index) => (index === week.length - 1 ? { ...day, score: result.score } : day));

  return (
    <Card aria-labelledby="analysis-heading" className="flex flex-col gap-5">
      <h2 id="analysis-heading" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted">
        <Stamp aria-hidden="true" size={15} strokeWidth={1.7} className="text-primary" />
        Analisa hari ini
      </h2>

      <div className="flex items-end gap-4">
        {compared ? (
          <p aria-hidden="true" className="font-heading text-[44px] leading-none font-bold tracking-tight text-primary tabular-nums">
            {deltaFigure(result.delta ?? 0)}
          </p>
        ) : (
          <Sprout aria-hidden="true" size={44} strokeWidth={1.4} className="shrink-0 text-primary" />
        )}
        <p className="max-w-[28ch] pb-1 text-sm text-text">{deltaSentence(result.delta, result.comparedTo)}</p>
      </div>

      <WeekStrip days={strip} />

      {/* SCORE-3: the reason sits right under the score and is always visible. */}
      <p className="text-base text-text">{result.scoreReason}</p>

      <div className="paper-lines font-serif text-editor text-primary">
        <p>{result.summary}</p>
        <ResultList title="Yang sudah bagus" items={result.strengths} />
        <ResultList title="Ruang untuk tumbuh" items={result.improvements} />
      </div>

      <div className="rounded-2xl bg-primary-soft px-4 py-3.5">
        <h3 className="font-serif text-lg italic text-primary">Untuk besok</h3>
        <p className="mt-0.5 text-base text-text">{result.tomorrowTip}</p>
      </div>
    </Card>
  );
}

/**
 * Seven bars, oldest first. Heights follow the score on a 56 px track; a day
 * with no analysis is a hairline, so a skipped day looks skipped, not low.
 */
function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-7 items-end gap-2">
      {days.map((day, index) => {
        const isToday = index === days.length - 1;

        return (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <div className="flex h-14 w-full items-end">
              <span
                className={cn(
                  "w-full rounded-[4px]",
                  isToday ? "bg-primary" : "bg-rule",
                  day.score === null && "rounded-none",
                )}
                style={{ height: day.score === null ? 1 : Math.max(4, Math.round((day.score / 100) * 56)) }}
              />
            </div>
            <span className={cn("text-xs", isToday ? "font-semibold text-text" : "text-text-muted")}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A heading and its lines, written on the same ruled paper as the analysis. */
function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <h3 className="font-sans text-sm leading-[34px] font-bold text-text">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}
