import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { deltaFigure } from "@/lib/score-delta";

/**
 * The score of DESIGN.md §6, drawn like a round ink stamp: a thin outer ring,
 * the score arc in the gold ink, and a dotted inner ring. 160 px on phones and
 * 184 px from 768 px up. The arc is the same gold whatever the score is, so a
 * bad day never turns red.
 *
 * Inside sits the change against the last scored day ("+2%", "dari kemarin"),
 * never the 0 to 100 score itself (SCORE-2, user decision 2026-11-01). On the
 * first analysis there is nothing to compare with, so a sprout stands in.
 *
 * The stamp is decorative: the sentence next to it says the same in words.
 */
export function ScoreRing({
  score,
  delta,
  comparedTo,
  size = 160,
}: {
  score: number;
  delta: number | null;
  comparedTo: string | null;
  size?: number;
}) {
  const stroke = 7;
  const center = size / 2;
  const outer = center - 1;
  const radius = center - 10;
  const inner = radius - stroke - 5;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const figure = delta === null || comparedTo === null ? null : deltaFigure(delta);

  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={outer} fill="none" strokeWidth={1} className="stroke-accent-warm/60" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="stroke-accent-warm motion-safe:transition-[stroke-dasharray] motion-safe:duration-[600ms] motion-safe:ease-out"
        />
        <circle
          cx={center}
          cy={center}
          r={inner}
          fill="none"
          strokeWidth={1}
          strokeDasharray="1.5 4"
          strokeLinecap="round"
          className="stroke-control"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {figure === null ? (
          <>
            <Sprout size={size >= 150 ? 40 : 28} strokeWidth={1.5} className="text-accent-warm" />
            <span className="mt-1 font-serif text-sm italic text-text-muted">analisa pertama</span>
          </>
        ) : (
          <>
            <span
              className={cn(
                // Big numbers are Plus Jakarta Sans 700 in version 4 (DESIGN.md §4).
                "font-heading font-bold leading-none tracking-[-0.02em] text-text tabular-nums",
                // A signed bold figure is wide, so it steps down to stay inside the dotted ring.
                size >= 150 ? (figure.length <= 3 ? "text-4xl" : "text-3xl") : "text-2xl",
              )}
            >
              {figure}
            </span>
            {/* The small stamp has no room for the caption; the sentence beside it carries it. */}
            {size >= 150 ? (
              <span className="mt-1.5 max-w-[70%] font-serif text-sm italic leading-tight text-text-muted">
                dari {comparedTo}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
