"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
  type TooltipContentProps,
} from "recharts";
import { formatRupiah } from "@/lib/format";
import type { PacePoint } from "@/lib/money-analysis";

/** "2,5 jt" for 2.500.000: the axis has little room. */
function formatAxis(value: number): string {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** The small hand-drawn circle of DESIGN.md §14.3, around today's point. */
const CIRCLE_PATH = "M27 4C15 3 5 12 4.5 25.5 4 39 13.5 48.5 26.5 48 39 47.5 48 38.5 48 26 48 13.5 39.5 5.5 25 3.5";

function TodayMark({ cx, cy }: DotProps) {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return <g />;
  }

  return (
    <g aria-hidden="true">
      <circle cx={cx} cy={cy} r={4} fill="var(--primary)" />
      <path
        d={CIRCLE_PATH}
        transform={`translate(${cx - 11} ${cy - 11}) scale(0.423)`}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={4.2}
        strokeLinecap="round"
      />
      <text
        x={cx - 6}
        y={cy - 20}
        textAnchor="middle"
        fill="var(--primary)"
        className="font-serif italic"
        fontSize={14}
      >
        hari ini
      </text>
    </g>
  );
}

/**
 * "Laju pengeluaran" (PRD.md EXP-10, DESIGN.md §16.2): money out summed day by
 * day, the month on screen against the month before. The month on screen is a
 * `primary` line with a flat 7% area, the month before a `rule-strong` line;
 * because that line has little contrast, the legend is written text and a
 * hidden table carries every number. Today's point is circled in a running
 * month. Animation is off (DESIGN.md §13).
 */
export function PaceChart({
  points,
  monthName,
  previousName,
  today,
  description,
}: {
  points: PacePoint[];
  /** "November" */
  monthName: string;
  /** "Oktober" */
  previousName: string;
  /** The day to circle in a running month, or null. */
  today: number | null;
  description: string;
}) {
  const last = points.length;
  const ticks = [1, 8, 15, 22, last].filter((day, index, all) => day <= last && all.indexOf(day) === index);
  const todayPoint = today === null ? null : points[today - 1];

  return (
    <div>
      <div role="img" aria-label={description} className="mt-4 h-52 w-full md:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 28, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 6" />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, last]}
              ticks={ticks}
              tickLine={false}
              axisLine={{ stroke: "var(--control)" }}
              tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={formatAxis}
              tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            />
            <Tooltip
              content={<PaceTooltip monthName={monthName} previousName={previousName} />}
              cursor={{ stroke: "var(--rule-strong)" }}
            />
            <Line
              dataKey="previous"
              stroke="var(--rule-strong)"
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              dataKey="current"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="var(--primary)"
              fillOpacity={0.07}
              dot={false}
              activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {todayPoint && todayPoint.current !== null ? (
              <ReferenceDot x={todayPoint.day} y={todayPoint.current} shape={TodayMark} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-[2.5px] w-3.5 bg-primary" />
          {monthName}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3.5 bg-rule-strong" />
          {previousName}
        </li>
      </ul>

      {/* sr-only on a wrapper: a hidden table wider than the screen would still scroll the page at 360 px. */}
      <div className="sr-only">
        <table>
          <caption>{description}</caption>
          <thead>
            <tr>
              <th scope="col">Tanggal</th>
              <th scope="col">{monthName}</th>
              <th scope="col">{previousName}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day}>
                <th scope="row">{point.day}</th>
                <td>{point.current === null ? "-" : formatRupiah(point.current)}</td>
                <td>{point.previous === null ? "-" : formatRupiah(point.previous)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaceTooltip({
  active,
  payload,
  monthName,
  previousName,
}: Partial<TooltipContentProps<number, string>> & { monthName: string; previousName: string }) {
  const point = payload?.[0]?.payload as PacePoint | undefined;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface px-3 py-2 text-sm text-text shadow-float">
      <p className="text-text-muted">Sampai tanggal {point.day}</p>
      {point.current !== null ? (
        <p className="tabular-nums">
          {monthName} {formatRupiah(point.current)}
        </p>
      ) : null}
      {point.previous !== null ? (
        <p className="tabular-nums">
          {previousName} {formatRupiah(point.previous)}
        </p>
      ) : null}
    </div>
  );
}
