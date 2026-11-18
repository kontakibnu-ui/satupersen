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
 * The line chart of DESIGN.md §14.3 "Grafik" (version 5): a 2.5 px `primary`
 * line over a flat 7% `primary` area (no gradient), faint dashed grid lines in
 * `border`, a `control` baseline, and on the latest point a dot circled in pen
 * with "hari ini" (or "terakhir" when that point is not today) written beside
 * it. The point being touched gets a dot and a tooltip on `surface`. Colours are
 * the CSS tokens, so the chart follows the light and dark mode by itself.
 *
 * The drawing is for the eyes; `description` and the visually hidden table give
 * a screen reader the same numbers. Animation is off, which also respects
 * `prefers-reduced-motion` (DESIGN.md §13).
 */
/** The pen circle of §14.3, drawn 32 px round the latest point. */
const CIRCLE_PATH = "M27 4C15 3 5 12 4.5 25.5 4 39 13.5 48.5 26.5 48 39 47.5 48 38.5 48 26 48 13.5 39.5 5.5 25 3.5";

export function ScoreChart({
  points,
  description,
  lastLabel = "hari ini",
}: {
  points: ChartPoint[];
  description: string;
  /** What the circled latest point is called: "hari ini" for days, "bulan ini" for months. */
  lastLabel?: string;
}) {
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
          <ComposedChart data={points} margin={{ top: 24, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 5" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--control)" }}
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
              fill="var(--primary)"
              fillOpacity={0.07}
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
                dot.index === lastIndexWithValue && typeof dot.cx === "number" && typeof dot.cy === "number" ? (
                  <g key={dot.index}>
                    <path
                      d={CIRCLE_PATH}
                      transform={`translate(${dot.cx - 16} ${dot.cy - 16}) scale(0.615)`}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                    />
                    <circle cx={dot.cx} cy={dot.cy} r={4} fill="var(--primary)" />
                    <text
                      x={dot.cx - 22}
                      y={dot.cy - 8}
                      textAnchor="end"
                      fontSize={14}
                      fill="var(--primary)"
                      className="font-serif italic"
                    >
                      {lastIndexWithValue === points.length - 1 ? lastLabel : "terakhir"}
                    </text>
                  </g>
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
    <div className="rounded-[14px] border border-border bg-surface px-3 py-2 text-sm text-text shadow-float">
      <p className="text-text-muted">{point.fullLabel}</p>
      <p>{point.value === null ? "Belum ada skor" : `Skor ${Math.round(point.value)}`}</p>
    </div>
  );
}
