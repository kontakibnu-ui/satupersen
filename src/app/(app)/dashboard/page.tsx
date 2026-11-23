import { ChartLine, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScribbleUnderline, SectionHead, Tally } from "@/components/notebook";
import { PageHeader } from "@/components/page-header";
import { ProgressTabs } from "@/components/progress-tabs";
import { buttonVariants } from "@/components/ui/button";
import { Card, IconBadge } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import {
  addDays,
  formatDayLabel,
  formatMonthLabel,
  isValidTimeZone,
  lastNDays,
  todayKey,
} from "@/lib/dates";
import {
  dimensionAverages,
  MIN_SCORED_DAYS_FOR_DELTA,
  monthlyAverages,
  periodDeltaPct,
  sinceStartPct,
  windowAverage,
  type DimensionName,
  type ScoredDay,
} from "@/lib/progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ScoreChart, type ChartPoint } from "./score-chart";

export const metadata: Metadata = {
  title: "Progres · Satu Persen",
};

const PERIODS = [
  { key: "7", days: 7, label: "7 hari", previous: "7 hari sebelumnya", short: "7 hari" },
  { key: "30", days: 30, label: "30 hari", previous: "30 hari sebelumnya", short: "30 hari" },
  { key: "365", days: 365, label: "1 tahun", previous: "tahun sebelumnya", short: "1 tahun" },
] as const;

const DIMENSION_LABELS: Record<DimensionName, string> = {
  habits: "Kebiasaan",
  productivity: "Produktivitas",
  mood: "Mood dan energi",
  finance: "Keuangan",
};

/**
 * Progres (DASH-1 to DASH-3, DESIGN.md §2, §8, §14.3 "Grafik"). The one focus
 * is the average score of the chosen period, with its line, laid straight on
 * the page: charts never sit on paper (§14.1). Everything else stays quiet: the
 * dimension bars share the one ink and "sejak mulai" is one line. Riwayat and Laporan
 * are the other two tabs of Progres (DESIGN.md §6 "Tab Progres", 2026-11-15).
 *
 * The period comes from the URL, and the server decides what it may show: the
 * 1 year view belongs to premium (DASH-2), so a free account is told so here and
 * its data is never read for that view (SUB-1).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  const period = PERIODS.find((candidate) => candidate.key === periode) ?? PERIODS[0];

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone, plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error("Profil tidak bisa dibaca, jadi Progres belum bisa ditampilkan");
  }

  const timeZone =
    profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const today = todayKey(timeZone);
  const locked = period.days === 365 && profile?.plan !== "premium";

  return (
    <main data-wide className="py-6 md:py-10">
      <PageHeader title="Progres" description="Lihat arahmu, bukan hanya satu hari." />
      <ProgressTabs current="grafik" />

      <nav aria-label="Periode" className="mt-6 max-w-[640px]">
        <ul className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted p-1">
          {PERIODS.map((candidate) => {
            const active = candidate.key === period.key;

            return (
              <li key={candidate.key}>
                <Link
                  href={`/dashboard?periode=${candidate.key}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 text-sm transition-colors duration-200 ${
                    active ? "bg-surface font-bold text-primary" : "text-text-muted hover:text-text"
                  }`}
                >
                  {candidate.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {locked ? (
        <Card as="div" className="mt-6 flex items-start gap-4">
          <IconBadge icon={Lock} />
          <p className="text-base text-text">
            Riwayat 1 tahun ada di Premium. Grafik 7 hari dan 30 hari tetap bisa kamu lihat.
          </p>
        </Card>
      ) : (
        <Overview supabase={supabase} userId={userId} today={today} period={period} />
      )}

    </main>
  );
}

async function Overview({
  supabase,
  userId,
  today,
  period,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  today: string;
  period: (typeof PERIODS)[number];
}) {
  // One window for this period and one for the period before it, in one read.
  const from = addDays(today, -(period.days * 2 - 1));

  const scoredDays = () =>
    supabase
      .from("daily_summaries")
      .select("date", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "done")
      .not("score", "is", null);

  const [windowResult, totalResult, firstResult, lastResult] = await Promise.all([
    supabase
      .from("daily_summaries")
      .select("date, score, score_dimensions")
      .eq("user_id", userId)
      .eq("status", "done")
      .not("score", "is", null)
      .gte("date", from)
      .lte("date", today)
      .order("date", { ascending: true })
      .limit(1000),
    scoredDays(),
    supabase
      .from("daily_summaries")
      .select("score")
      .eq("user_id", userId)
      .eq("status", "done")
      .not("score", "is", null)
      .order("date", { ascending: true })
      .limit(7),
    supabase
      .from("daily_summaries")
      .select("score")
      .eq("user_id", userId)
      .eq("status", "done")
      .not("score", "is", null)
      .order("date", { ascending: false })
      .limit(7),
  ]);

  if (windowResult.error || totalResult.error || firstResult.error || lastResult.error) {
    throw new Error("Skor tidak bisa dibaca, jadi Progres belum bisa ditampilkan");
  }

  const rows = (windowResult.data ?? []) as {
    date: string;
    score: number;
    score_dimensions: unknown;
  }[];
  const days: ScoredDay[] = rows.map((row) => ({ date: row.date, score: row.score }));

  const current = windowAverage(days, today, period.days);
  const previous = windowAverage(days, addDays(today, -period.days), period.days);
  const delta = periodDeltaPct(current, previous);

  if (current.average === null) {
    // DESIGN.md §15.5: in the first days the card counts toward the three
    // analysed days the chart needs, with tally marks.
    const scoredSoFar = totalResult.count ?? 0;
    const firstDays = scoredSoFar < MIN_SCORED_DAYS_FOR_DELTA;

    return (
      <Card aria-label="Ringkasan progres" className="mt-6 flex flex-col items-center py-10 text-center">
        <IconBadge icon={ChartLine} size="lg" />
        {firstDays ? (
          <>
            <p className="mt-4 font-heading text-base font-bold text-text">Grafikmu mulai terbentuk</p>
            <p className="mt-2 max-w-sm text-base text-text-muted">
              Garis dan persennya muncul setelah {MIN_SCORED_DAYS_FOR_DELTA} hari dianalisa.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-text tabular-nums">
              <Tally count={scoredSoFar} className="text-text-muted" />
              {scoredSoFar} dari {MIN_SCORED_DAYS_FOR_DELTA} hari
            </p>
          </>
        ) : (
          <p className="mt-4 max-w-sm text-base text-text-muted">
            Belum ada skor di {period.short === "1 tahun" ? "setahun ini" : `${period.short} terakhir`}.
            Tulis satu entri, lalu tekan Analisa hari ini.
          </p>
        )}
        <Link href="/today" className={buttonVariants({ variant: "soft", className: "mt-5" })}>
          Mulai menulis
        </Link>
      </Card>
    );
  }

  const currentStart = addDays(today, -(period.days - 1));
  const dimensions = dimensionAverages(
    rows.filter((row) => row.date >= currentStart).map((row) => row.score_dimensions),
  );

  const sinceStart = sinceStartPct({
    totalScoredDays: totalResult.count ?? 0,
    firstScores: (firstResult.data ?? []).map((row) => row.score as number),
    lastScores: (lastResult.data ?? []).map((row) => row.score as number),
  });

  const points: ChartPoint[] =
    period.days === 365
      ? monthlyAverages(days, today, 12).map((month) => ({
          label: formatMonthLabel(`${month.month}-01`).slice(0, 3),
          fullLabel: formatMonthLabel(`${month.month}-01`),
          value: month.average,
        }))
      : lastNDays(today, period.days).map((date) => {
          const score = days.find((day) => day.date === date)?.score ?? null;

          return { label: String(Number(date.slice(8))), fullLabel: formatDayLabel(date), value: score };
        });

  const average = Math.round(current.average);
  const averageLabel = period.days === 365 ? "rata-rata 1 tahun" : `rata-rata ${period.days} hari`;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section aria-label="Ringkasan progres">
        <p className="font-heading text-[44px] leading-[1.05] font-bold tracking-[-0.02em] text-primary tabular-nums">
          {average}
        </p>
        <p className="mt-1.5 text-sm text-text-muted">
          {delta === null ? (
            `${averageLabel}. Persen muncul setelah ${MIN_SCORED_DAYS_FOR_DELTA} hari berskor di tiap periode.`
          ) : (
            <>
              {averageLabel},{" "}
              <ScribbleUnderline className="font-bold text-text">
                {formatPercent(Math.abs(delta))}% {delta >= 0 ? "di atas" : "di bawah"}
              </ScribbleUnderline>{" "}
              {period.previous}
            </>
          )}
        </p>

        <div className="mt-5">
          <ScoreChart
            points={points}
            description={`Grafik skor ${period.label}, rata-rata ${average} dari 100`}
            lastLabel={period.days === 365 ? "bulan ini" : "hari ini"}
          />
        </div>
      </section>

      <p className="text-base text-text">
        {sinceStart === null ? (
          `Sejak mulai muncul setelah 14 hari berskor (${Math.min(totalResult.count ?? 0, 14)}/14).`
        ) : (
          <>
            Sejak mulai:{" "}
            <span className="font-bold">
              {formatPercent(Math.abs(sinceStart))}% {sinceStart >= 0 ? "lebih baik" : "di bawah awal"}
            </span>
          </>
        )}
      </p>

      {dimensions.length > 0 ? (
        <section aria-labelledby="dimensions-title" className="max-w-[640px]">
          <SectionHead id="dimensions-title" title="Per bagian" aside={period.short} />
          <ul aria-label="Skor per bagian" className="flex flex-col">
            {dimensions.map((dimension) => (
              <li key={dimension.name} className="flex min-h-14 items-center gap-3 border-b border-rule py-2">
                <span className="w-[120px] shrink-0 text-base text-text">{DIMENSION_LABELS[dimension.name]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(dimension.average)}%` }}
                  />
                </span>
                <span className="w-7 shrink-0 text-right text-sm text-text-muted tabular-nums">
                  {Math.round(dimension.average)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
