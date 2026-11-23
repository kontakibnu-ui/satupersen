import { ChartLine, ChevronLeft, Stamp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BinderSheet, BLEED, Kop, ScribbleUnderline, SectionHead, StickyNote } from "@/components/notebook";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, IconBadge } from "@/components/ui/card";
import { moneyAnalysisSchema } from "@/lib/ai/schemas";
import { formatMonthLabel, isDateKey, isValidTimeZone, todayKey } from "@/lib/dates";
import { formatRupiah } from "@/lib/format";
import { loadMonthExpenses } from "@/lib/money";
import {
  categoryShares,
  dayAndMonthLabel,
  percentOf,
  previousMonthOf,
  readThroughDay,
  spendingPace,
  spentThrough,
} from "@/lib/money-analysis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AnalyzeButton } from "./analyze-button";
import { PaceChart } from "./pace-chart";

export const metadata: Metadata = {
  title: "Analisa uang · Satu Persen",
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** "22 November 14.05" in the user's zone, for the line under a stored analysis. */
function writtenAt(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("day")} ${part("month")} ${part("hour")}.${part("minute")}`;
}

/**
 * Analisa uang (PRD.md EXP-10, DESIGN.md §16.2, arah C). The charts are for
 * every account and are counted on the server from the month's entries; the
 * AI's reading is premium and comes from `money_analyses`, so opening the
 * screen never calls the model. A stored reading stays readable after the plan
 * returns to free (SUB-3); only writing a new one is premium.
 */
export default async function MoneyAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
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
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const timeZone = profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const today = todayKey(timeZone);
  const currentMonth = today.slice(0, 7);
  const month =
    bulan && MONTH_PATTERN.test(bulan) && isDateKey(`${bulan}-01`) && bulan <= currentMonth ? bulan : currentMonth;
  const monthStart = `${month}-01`;
  const previousMonth = previousMonthOf(month);
  const isPremium = profile?.plan === "premium";

  const [current, previous, stored] = await Promise.all([
    loadMonthExpenses(supabase, userId, monthStart),
    loadMonthExpenses(supabase, userId, `${previousMonth}-01`),
    supabase
      .from("money_analyses")
      .select("paragraphs, next_month, through_date, generated_on, updated_at")
      .eq("user_id", userId)
      .eq("month", monthStart)
      .maybeSingle(),
  ]);

  if (stored.error) {
    throw new Error("Analisa uang tidak bisa dibaca");
  }

  const entries = [...current, ...previous];
  const running = month === currentMonth;
  const throughDay = readThroughDay(month, today);
  const spent = spentThrough(entries, month, throughDay);
  const previousSpent = spentThrough(entries, previousMonth, throughDay);
  const shares = categoryShares(entries, month, previousMonth, throughDay);
  const monthLabel = formatMonthLabel(monthStart);
  const monthName = monthLabel.split(" ")[0];
  const previousName = formatMonthLabel(`${previousMonth}-01`).split(" ")[0];
  const analysis = stored.data
    ? moneyAnalysisSchema.safeParse({ paragraphs: stored.data.paragraphs, next_month: stored.data.next_month })
    : null;
  const reading = analysis?.success ? analysis.data : null;
  const backHref = running ? "/expenses" : `/expenses?bulan=${month}`;
  const createLabel = running ? "Analisa bulan ini" : `Analisa ${monthName}`;

  const header = (
    <PageHeader
      eyebrow={
        <Link href={backHref} className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
          <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
          Uang
        </Link>
      }
      title="Analisa uang"
    />
  );

  if (spent === 0 && !reading) {
    return (
      <main className="py-6 md:py-10">
        {header}
        <Card as="div" className="mt-6 flex flex-col items-center py-10 text-center">
          <IconBadge icon={ChartLine} size="lg" />
          <p className="mt-4 max-w-sm text-base text-text-muted">Belum ada pengeluaran di {monthLabel}.</p>
          <Link href={backHref} className={buttonVariants({ variant: "soft", className: "mt-5" })}>
            Kembali ke Uang
          </Link>
        </Card>
      </main>
    );
  }

  const change = spent - previousSpent;
  const throughLabel = `1–${throughDay} ${monthName}`;

  return (
    <main className="py-6 md:py-10">
      {header}

      {reading && stored.data ? (
        <BinderSheet aria-label={`Analisa uang ${monthLabel}`} className="mt-6">
          <Kop
            rows={[
              ["Bulan", monthLabel],
              ["Dibaca", `sampai ${dayAndMonthLabel(month, Number(String(stored.data.through_date).slice(8, 10)))}`],
            ]}
          />
          <div className={cn(BLEED, "paper-lines mt-1.5 font-serif text-editor text-primary")}>
            {reading.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <StickyNote className="mt-7">
            <h2 className="text-sm font-bold text-primary">Untuk bulan depan</h2>
            <p className="mt-1 font-serif text-lg leading-relaxed text-text italic">{reading.next_month}</p>
          </StickyNote>
        </BinderSheet>
      ) : isPremium ? (
        <Card as="section" aria-label="Analisa AI" className="mt-6 flex flex-col items-center py-8 text-center">
          <IconBadge icon={Stamp} size="lg" />
          <p className="mt-4 mb-5 max-w-sm text-base text-text-muted">
            AI membaca angka dan catatan uangmu bulan ini, lalu menuliskan yang menonjol.
          </p>
          <AnalyzeButton month={month} kind="create" label={createLabel} />
        </Card>
      ) : (
        <Card as="section" aria-label="Analisa AI" className="mt-6 flex flex-col items-center py-8 text-center">
          <IconBadge icon={Stamp} size="lg" />
          <p className="mt-4 max-w-sm text-base text-text-muted">
            Analisa AI ada di Premium. Grafiknya tetap bisa kamu pakai.
          </p>
          <Link href="/settings/plan" className={buttonVariants({ variant: "soft", className: "mt-5" })}>
            Lihat Premium
          </Link>
        </Card>
      )}

      <section aria-labelledby="pace-title" className="mt-8">
        <SectionHead id="pace-title" title="Laju pengeluaran" aside={throughLabel} />
        <p className="mt-3 text-base text-text">
          <span className="font-bold tabular-nums">{formatRupiah(spent)}</span>{" "}
          {running ? "keluar sejauh ini." : "keluar bulan itu."}
        </p>
        <p className="mt-0.5 text-sm text-text-muted">
          {change === 0 ? (
            <>Sama dengan 1–{throughDay} {previousName}</>
          ) : (
            <>
              <ScribbleUnderline>
                {formatRupiah(Math.abs(change))} {change > 0 ? "lebih banyak" : "lebih sedikit"}
              </ScribbleUnderline>{" "}
              dari 1–{throughDay} {previousName}
            </>
          )}
        </p>
        <PaceChart
          points={spendingPace(entries, month, previousMonth, throughDay)}
          monthName={monthName}
          previousName={previousName}
          today={running ? throughDay : null}
          description={`Pengeluaran yang terkumpul per tanggal, ${monthLabel} dibanding ${previousName}`}
        />
      </section>

      {shares.length > 0 ? (
        <section aria-labelledby="category-title" className="mt-8">
          <SectionHead id="category-title" title="Ke mana uangmu pergi" aside={formatRupiah(spent)} />
          <ul>
            {shares.map((share) => {
              const percent = percentOf(share.share);

              return (
                <li key={share.category} className="min-h-14 border-b border-rule py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-base text-text">
                    <span className="min-w-0 truncate">{share.label}</span>
                    <span className="shrink-0 tabular-nums">{formatRupiah(share.amount)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm text-text-muted tabular-nums">{percent}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {reading && stored.data ? (
        <div className="mt-8 flex flex-col items-center">
          {isPremium ? (
            <AnalyzeButton
              month={month}
              kind="refresh"
              label="Perbarui analisa"
              refreshedToday={stored.data.generated_on === today}
            />
          ) : null}
          <p className="mt-1 text-center text-sm text-text-muted">
            Dibaca AI dari catatanmu, {writtenAt(String(stored.data.updated_at), timeZone)}
          </p>
        </div>
      ) : null}
    </main>
  );
}
