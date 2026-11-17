"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatRupiah } from "@/lib/format";

export type MonthBar = {
  /** Short text under the axis: a month name. */
  label: string;
  /** Full text for the tooltip and the text version of the chart. */
  fullLabel: string;
  income: number;
  expense: number;
};

/** "2,5 jt" for 2.500.000: the axis has little room, so it counts in thousands and millions. */
function formatAxis(value: number): string {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Money in against money out for a few months (EXP-6). Two bars per month in the
 * chart tokens of DESIGN.md §6: `primary` for money in and `accent` for money
 * out, so the colour tells the two apart and neither reads as good or bad. The
 * legend is written text, and `description` plus a visually hidden table give a
 * screen reader the same numbers as the drawing. Animation is off, which also
 * respects `prefers-reduced-motion` (DESIGN.md §13).
 */
export function MoneyChart({ months, description }: { months: MonthBar[]; description: string }) {
  return (
    <div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-primary" />
          Masuk
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-accent-warm" />
          Keluar
        </li>
      </ul>

      <div role="img" aria-label={description} className="mt-3 h-48 w-full md:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 6" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={formatAxis}
              tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-muted)" }} />
            <Bar dataKey="income" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* sr-only sits on a wrapper: a table never shrinks below its content, so a hidden
          table that is wider than the screen would still scroll the page sideways at 360 px. */}
      <div className="sr-only">
        <table>
          <caption>{description}</caption>
          <thead>
            <tr>
              <th scope="col">Bulan</th>
              <th scope="col">Masuk</th>
              <th scope="col">Keluar</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.fullLabel}>
                <th scope="row">{month.fullLabel}</th>
                <td>{formatRupiah(month.income)}</td>
                <td>{formatRupiah(month.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const month = payload?.[0]?.payload as MonthBar | undefined;

  if (!active || !month) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text shadow-float">
      <p className="text-text-muted">{month.fullLabel}</p>
      <p className="tabular-nums">Masuk {formatRupiah(month.income)}</p>
      <p className="tabular-nums">Keluar {formatRupiah(month.expense)}</p>
    </div>
  );
}
