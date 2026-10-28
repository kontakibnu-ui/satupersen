/**
 * The score ring from DESIGN.md §6: 160 px on phones, 184 px on desktop, an
 * 8 px stroke, `border` as the track and `primary` as the arc whatever the
 * score is. A bad day never turns red, and the number is the only thing that
 * gets the 56 px Newsreader treatment.
 */
export function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Skor hari ini ${score} dari 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="stroke-primary motion-safe:transition-[stroke-dasharray] motion-safe:duration-[600ms] motion-safe:ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-score text-text tabular-nums">{score}</span>
        <span className="text-sm text-text-muted">/100</span>
      </div>
    </div>
  );
}
