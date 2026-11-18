import { Sprout, Stamp } from "lucide-react";
import {
  BinderSheet,
  BLEED,
  InkStamp,
  ScribbleRing,
  ScribbleTick,
  ScribbleUnderline,
  StickyNote,
} from "@/components/notebook";
import { deltaFigure, deltaSentenceParts } from "@/lib/score-delta";
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
 * "Hari Ini, hasil" from DESIGN.md §14.3 (version 5, "Meja Tulis"): one binder
 * sheet, in this order:
 * - "Analisa hari ini", so it is plain that the AI wrote what follows;
 * - the ink stamp with the change against the last scored day ("+4%"), beside
 *   the same change in words with the figure underlined in pen (SCORE-2: no
 *   0 to 100 number). The first analysis has a sprout and no stamp;
 * - the week strip: the six days before as pale bars and today in ink, a day
 *   without an analysis as a 2 px line. Today's bar always comes from `result`,
 *   so a fresh analysis shows without a reload. Heights follow the score but
 *   no number is printed, so the strip is decoration for screen readers;
 * - the reason for the score, always visible (SCORE-3);
 * - the analysis and the two lists on the ruled lines, ticked and circled in pen;
 * - "Untuk besok" on a sticky note, without an underline until the AI can mark
 *   the phrase (§14.8).
 * A lower day reads as calmly as a better one: one ink, never red.
 */
export function SummaryResultView({ result, week }: { result: SummaryResult; week: WeekDay[] }) {
  const compared = result.delta !== null && result.comparedTo !== null;
  const strip = week.map((day, index) => (index === week.length - 1 ? { ...day, score: result.score } : day));
  const sentence = deltaSentenceParts(result.delta, result.comparedTo);

  return (
    <BinderSheet aria-labelledby="analysis-heading">
      <h2 id="analysis-heading" className="flex items-center gap-2 text-sm text-text-muted">
        <Stamp aria-hidden="true" size={18} strokeWidth={1.6} className="text-primary" />
        Analisa hari ini
      </h2>

      <div className="mt-3 flex items-center gap-3.5">
        {compared ? (
          <InkStamp figure={deltaFigure(result.delta ?? 0)} caption={`dari ${result.comparedTo}`} />
        ) : (
          <Sprout aria-hidden="true" size={44} strokeWidth={1.4} className="shrink-0 text-primary" />
        )}
        <p className={cn("text-text", compared ? "text-[17px] font-semibold" : "text-base")}>
          {sentence.before}
          {sentence.key ? <ScribbleUnderline>{sentence.key}</ScribbleUnderline> : null}
          {sentence.after}
          {compared ? "." : ""}
        </p>
      </div>

      <WeekStrip days={strip} />

      {/* SCORE-3: the reason sits right under the score and is always visible. */}
      <p className="mt-4 text-base text-text">{result.scoreReason}</p>

      <div
        className={cn(
          BLEED,
          "paper-lines mt-3.5 border-t-[3px] border-double border-rule-strong font-serif text-editor text-primary",
        )}
      >
        <p>{result.summary}</p>
        <ResultList title="Yang sudah bagus" items={result.strengths} mark="tick" />
        <ResultList title="Ruang untuk tumbuh" items={result.improvements} mark="ring" />
      </div>

      {result.tomorrowTip ? (
        <StickyNote className="mt-7">
          <h3 className="text-sm font-bold text-primary">Untuk besok</h3>
          <p className="mt-1 font-serif text-lg leading-relaxed text-text italic">{result.tomorrowTip}</p>
        </StickyNote>
      ) : null}
    </BinderSheet>
  );
}

/**
 * Seven bars, oldest first, on an 84 px cell with the weekday under each. A
 * day with no analysis is a 2 px line, so a skipped day looks skipped, not low.
 */
function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div aria-hidden="true" className="mt-[18px] grid grid-cols-7 gap-2">
      {days.map((day, index) => {
        const isToday = index === days.length - 1;

        return (
          <div key={day.date} className="flex h-[84px] flex-col items-center justify-end gap-1.5">
            <span
              className={cn("block w-full rounded-t-[3px]", isToday ? "bg-primary" : "bg-rule")}
              style={{ height: day.score === null ? 2 : Math.max(4, Math.round((day.score / 100) * 58)) }}
            />
            <span className={cn("text-xs", isToday ? "font-bold text-text" : "text-text-muted")}>{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A heading on its own ruled line, then one line per item behind a pen mark. */
function ResultList({ title, items, mark }: { title: string; items: string[]; mark: "tick" | "ring" }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="pt-[34px] font-sans text-sm leading-[34px] font-bold text-text">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            {mark === "tick" ? (
              <ScribbleTick className="mt-1.5 size-5 shrink-0" />
            ) : (
              <ScribbleRing className="mt-1.5 size-5 shrink-0" />
            )}
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
