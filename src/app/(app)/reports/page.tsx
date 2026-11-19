import { ChevronRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BinderSheet, BLEED, Kop, ScribbleRing, ScribbleUnderline, SectionHead, StickyNote } from "@/components/notebook";
import { PageHeader } from "@/components/page-header";
import { ProgressTabs } from "@/components/progress-tabs";
import { buttonVariants } from "@/components/ui/button";
import { Card, IconBadge } from "@/components/ui/card";
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
 * Laporan (REPORT-1 to REPORT-4), the third tab of Progres since 2026-11-15
 * (DESIGN.md §5): Progres's title, tabs, and 960 px column, content at 640 px. The tick writes these; this screen only reads
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
    <main data-wide className="py-6 md:py-10">
      <PageHeader title="Progres" description="Tren, pola, dan satu fokus untuk periode berikutnya." />
      <ProgressTabs current="laporan" />

      <div className="max-w-[640px]">
        {reports.length === 0 ? (
          // The same empty state as the Grafik tab: a seal, what will appear and
          // when, and the one step that gets there.
          <Card className="mt-6 flex flex-col items-center py-10 text-center">
            <IconBadge icon={FileText} size="lg" />
            <p className="mt-4 max-w-sm text-base text-text-muted">
              Belum ada laporan. Laporan mingguan muncul tiap Senin pagi, kalau minggu sebelumnya punya
              minimal 3 hari yang sudah dianalisa.
            </p>
            <Link href="/today" className={buttonVariants({ variant: "soft", className: "mt-5" })}>
              Mulai menulis
            </Link>
          </Card>
        ) : (
          <ReportList reports={reports} />
        )}
      </div>
    </main>
  );
}

function ReportList({ reports }: { reports: { type: ReportType; start: string; end: string; content: ReportContent }[] }) {
  const [latest, ...earlier] = reports;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <LatestReport {...latest} />

      {earlier.length > 0 ? (
        <div>
          <SectionHead title="Laporan sebelumnya" aside={`${earlier.length} laporan`} />
          <ul>
            {earlier.map((report) => (
              <li key={`${report.type}-${report.start}`} className="border-b border-rule">
                <EarlierReport {...report} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-sm text-text-muted">
        Laporan mingguan muncul tiap Senin pagi, kalau minggu sebelumnya punya minimal 3 hari yang sudah dianalisa.
      </p>
    </div>
  );
}

type ReportProps = { type: ReportType; start: string; end: string; content: ReportContent };

function regionLabel(type: ReportType, label: string): string {
  return `${type === "weekly" ? "Laporan mingguan" : "Laporan bulanan"} ${label}`;
}

/** The newest report, read back as a note: a binder sheet headed "Laporan / Periode" (§14.2, §14.3 "Kop"). */
function LatestReport({ type, start, end, content }: ReportProps) {
  const label = formatPeriodLabel(type, { start, end });
  const average = Math.round(content.average_score);

  return (
    <BinderSheet aria-label={regionLabel(type, label)}>
      <Kop
        rows={[
          ["Laporan", type === "weekly" ? "Mingguan" : "Bulanan"],
          ["Periode", label],
        ]}
      />
      <p className="mt-4 font-heading text-[44px] leading-[1.05] font-bold tracking-[-0.02em] text-primary tabular-nums">
        {average}
      </p>
      <AverageLine type={type} average={average} delta={content.delta_pct} />

      <div className={`${BLEED} paper-lines mt-3.5 border-t-[3px] border-double border-rule-strong font-serif text-editor text-primary`}>
        <p>{content.trend}</p>
        <MarkedList title="Pola yang terlihat" items={content.patterns} />
        <MarkedList title="Kaitan antar bagian" items={content.insights} />
      </div>

      <FocusNote type={type} focus={content.focus} />
    </BinderSheet>
  );
}

/** An older report: one row that opens in place, so every report stays readable without a page of its own. */
function EarlierReport({ type, start, end, content }: ReportProps) {
  const label = formatPeriodLabel(type, { start, end });
  const average = Math.round(content.average_score);

  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-text">{label}</span>
          <span className="block text-sm text-text-muted">
            {type === "weekly" ? "Mingguan" : "Bulanan"}, rata-rata {average}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          size={18}
          strokeWidth={1.6}
          className="shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-90"
        />
      </summary>

      <section aria-label={regionLabel(type, label)} className="pb-5">
        <AverageLine type={type} average={average} delta={content.delta_pct} />
        <p className="mt-3 text-base text-text">{content.trend}</p>
        <div className="text-base text-text">
          <MarkedList title="Pola yang terlihat" items={content.patterns} ruled={false} />
          <MarkedList title="Kaitan antar bagian" items={content.insights} ruled={false} />
        </div>
        <FocusNote type={type} focus={content.focus} />
      </section>
    </details>
  );
}

function AverageLine({ type, average, delta }: { type: ReportType; average: number; delta: number | null }) {
  const previous = type === "weekly" ? "minggu sebelumnya" : "bulan sebelumnya";

  return (
    <p className="mt-1.5 text-sm text-text-muted">
      {delta === null ? (
        `rata-rata ${average}`
      ) : (
        <>
          rata-rata {average},{" "}
          <ScribbleUnderline className="font-bold text-text">
            {formatPercent(Math.abs(delta))}% {delta >= 0 ? "di atas" : "di bawah"}
          </ScribbleUnderline>{" "}
          {previous}
        </>
      )}
    </p>
  );
}

function FocusNote({ type, focus }: { type: ReportType; focus: string }) {
  return (
    <StickyNote className="mt-7">
      <h3 className="text-sm font-bold text-primary">{type === "weekly" ? "Fokus minggu ini" : "Fokus bulan ini"}</h3>
      <p className="mt-1 font-serif text-lg leading-relaxed text-text italic">{focus}</p>
    </StickyNote>
  );
}

/**
 * A heading, then one item per line behind a small pen circle (§14.3). On the
 * ruled sheet the heading takes a ruled line of its own; elsewhere it is spaced
 * like any short list.
 */
function MarkedList({ title, items, ruled = true }: { title: string; items: string[]; ruled?: boolean }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <h3
        className={
          ruled ? "pt-[34px] font-sans text-sm leading-[34px] font-bold text-text" : "mt-5 text-sm font-bold text-text"
        }
      >
        {title}
      </h3>
      <ul className={ruled ? undefined : "mt-2 flex flex-col gap-1.5"}>
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <ScribbleRing className={`${ruled ? "mt-1.5" : "mt-0.5"} size-5 shrink-0`} />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
