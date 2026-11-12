import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { formatPercent } from "@/lib/format";
import { reportContentSchema, type ReportContent } from "@/lib/reports/content";
import { formatPeriodLabel, type ReportType } from "@/lib/reports/period";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Laporan · Satu Persen",
};

/** The latest reports shown at once: about half a year of weeks plus the months. */
const MAX_REPORTS = 30;

type ReportRow = {
  type: ReportType;
  period_start: string;
  period_end: string;
  content: unknown;
};

/**
 * Laporan (REPORT-1 to REPORT-4). The tick writes these; this screen only reads
 * the user's own rows, so row level security keeps everyone else's out. Rows
 * that are not finished (pending, skipped, failed) are not shown, and nothing is
 * made up to fill the gap (DESIGN.md §12).
 */
export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data, error } = await supabase
    .from("reports")
    .select("type, period_start, period_end, content")
    .eq("user_id", userId)
    .eq("content->>status", "done")
    .order("period_start", { ascending: false })
    .order("type", { ascending: true })
    .limit(MAX_REPORTS);

  if (error) {
    throw new Error("Laporan tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const reports = ((data ?? []) as ReportRow[]).flatMap((row) => {
    const parsed = reportContentSchema.safeParse(row.content);

    return parsed.success
      ? [{ type: row.type, start: row.period_start, end: row.period_end, content: parsed.data }]
      : [];
  });

  return (
    <main className="py-6 md:py-10">
      <PageHeader title="Laporan" description="Tren, pola, dan satu fokus untuk periode berikutnya." />

      {reports.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-border bg-surface p-6 text-base text-text-muted">
          Belum ada laporan. Laporan mingguan muncul tiap Senin pagi, kalau minggu sebelumnya punya
          minimal 3 hari yang sudah dianalisa.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {reports.map((report) => (
            <ReportView key={`${report.type}-${report.start}`} {...report} />
          ))}
        </div>
      )}
    </main>
  );
}

function ReportView({
  type,
  start,
  end,
  content,
}: {
  type: ReportType;
  start: string;
  end: string;
  content: ReportContent;
}) {
  const label = formatPeriodLabel(type, { start, end });
  const previous = type === "weekly" ? "minggu sebelumnya" : "bulan sebelumnya";
  const average = Math.round(content.average_score);

  return (
    <section
      aria-label={`${type === "weekly" ? "Laporan mingguan" : "Laporan bulanan"} ${label}`}
      className="rounded-3xl border border-border bg-surface p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${type === "weekly" ? "bg-sage-soft text-sage" : "bg-plum-soft text-plum"}`}>
          {type === "weekly" ? "Mingguan" : "Bulanan"}
        </span>
        <h2 className="text-base font-semibold text-text">{label}</h2>
      </div>
      <p className="mt-3 font-serif text-3xl font-light text-text tabular-nums">{average}</p>
      <p className="mt-1 text-sm text-text-muted">
        {content.delta_pct === null
          ? `rata-rata ${average}`
          : `rata-rata ${average}, ${formatPercent(Math.abs(content.delta_pct))}% ${
              content.delta_pct >= 0 ? "di atas" : "di bawah"
            } ${previous}`}
      </p>

      <p className="mt-4 text-base text-text">{content.trend}</p>

      <BulletList title="Pola yang terlihat" items={content.patterns} />
      <BulletList title="Kaitan antar bagian" items={content.insights} />

      <div className="mt-6 rounded-2xl bg-accent-soft p-4">
        <p className="text-sm font-semibold text-accent-warm">{type === "weekly" ? "Fokus minggu ini" : "Fokus bulan ini"}</p>
        <p className="mt-1 text-base text-text">{content.focus}</p>
      </div>
    </section>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="mt-5 text-sm font-semibold text-text">{title}</h3>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-base text-text">
            <span aria-hidden="true" className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
