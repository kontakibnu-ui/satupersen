"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

export type ChartPoint = {
  /** Short text under the axis: a day of the month, or a month name. */
  label: string;
  /** Full text for the tooltip and the text version of the chart. */
  fullLabel: string;
  /** The score or the average, or null when there is no data for the point. */
  value: number | null;
};

/**
 * The line chart of DESIGN.md §6 (version 3): a 2.5 px `primary` line over a
 * soft area that fades to nothing, faint dashed grid lines in `border`, a dot only on the latest
 * point and on the one being touched, and a tooltip on `surface`. Colours are
 * the CSS tokens, so the chart follows the light and dark mode by itself.
 *
 * The drawing is for the eyes; `description` and the visually hidden table give
 * a screen reader the same numbers. Animation is off, which also respects
 * `prefers-reduced-motion` (DESIGN.md §13).
 */
export function ScoreChart({ points, description }: { points: ChartPoint[]; description: string }) {
  let lastIndexWithValue = -1;
  points.forEach((point, index) => {
    if (point.value !== null) {
      lastIndexWithValue = index;
    }
  });

  return (
    <div>
      <div role="img" aria-label={description} className="h-48 w-full md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="score-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--primary)", stopOpacity: 0.28 }} />
                <stop offset="100%" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 6" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
              tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickLine={false}
              axisLine={false}
              width={32}
              tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#score-area)"
              connectNulls
              isAnimationActive={false}
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2.5}
              connectNulls
              isAnimationActive={false}
              dot={(dot) =>
                dot.index === lastIndexWithValue ? (
                  <circle key={dot.index} cx={dot.cx} cy={dot.cy} r={4} fill="var(--primary)" />
                ) : (
                  <g key={dot.index} />
                )
              }
              activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{description}</caption>
        <thead>
          <tr>
            <th scope="col">Waktu</th>
            <th scope="col">Skor</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.fullLabel}>
              <th scope="row">{point.fullLabel}</th>
              <td>{point.value === null ? "Belum ada skor" : Math.round(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const point = payload?.[0]?.payload as ChartPoint | undefined;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text shadow-float">
      <p className="text-text-muted">{point.fullLabel}</p>
      <p>{point.value === null ? "Belum ada skor" : `Skor ${Math.round(point.value)}`}</p>
    </div>
  );
}
