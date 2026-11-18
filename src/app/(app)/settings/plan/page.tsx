import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScribbleTick } from "@/components/notebook";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { MONTHLY_TOKEN_SOFT_CAP, PLAN_LIMITS, PREMIUM_PACKAGES, packageValue } from "@/config/plans";
import { monthlyStanding } from "@/lib/ai/usage";
import { formatDayLabel, isValidTimeZone, startOfNextMonthKey, toDateKey, todayKey } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PackagePicker } from "@/components/package-picker";

export const metadata: Metadata = {
  title: "Paket · Satu Persen",
};

const formatTokens = (value: number) => new Intl.NumberFormat("id-ID").format(value);

const PREMIUM = PLAN_LIMITS.premium;

/**
 * What premium adds to the free plan (PRD.md §8), as the ticked list of DESIGN.md
 * §14.3. Only features that exist are listed, and the numbers come from
 * src/config/plans.ts, the same limits the server enforces.
 */
const PREMIUM_EXTRAS: string[] = [
  `Analisa ulang ${PREMIUM.reanalysesPerDay} kali sehari`,
  `Balasan AI di WhatsApp ${PREMIUM.whatsappRepliesPerDay} per hari`,
  "Kebiasaan aktif, materi Belajar, dan buku tanpa batas jumlah",
  `Pemeriksaan AI di Belajar ${PREMIUM.studyChecks.perDay} kali per materi per hari`,
  "Budget bulanan",
  `Grafik sampai ${PREMIUM.chartDays} hari`,
  "Laporan mingguan lengkap dan laporan bulanan",
  `Kuota AI ${formatTokens(MONTHLY_TOKEN_SOFT_CAP.premium)} token per bulan`,
];

/**
 * Paket (PRD.md §8): the current plan, the AI tokens used this month against the
 * plan's soft cap, the four premium packages, and what each plan includes. Plan,
 * end date, and usage are read on the server with the user's own session; the
 * packages come from src/config/plans.ts, the same numbers the server enforces.
 */
export default async function PlanPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("plan, premium_until, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const plan = profile.plan === "premium" ? "premium" : "free";
  const timeZone = isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const standing = await monthlyStanding(supabase, userId, plan, timeZone);
  const resetLabel = formatDayLabel(startOfNextMonthKey(todayKey(timeZone)));
  const premiumUntil =
    plan === "premium" && profile.premium_until
      ? formatDayLabel(toDateKey(new Date(profile.premium_until), timeZone))
      : null;

  const packages = PREMIUM_PACKAGES.map((pkg) => ({ ...pkg, ...packageValue(pkg) }));

  return (
    <main className="py-6 md:py-10">
      <PageHeader
        eyebrow={
          <Link href="/settings" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
            Akun
          </Link>
        }
        title="Paket"
        description={
          premiumUntil
            ? `Kamu memakai paket premium sampai ${premiumUntil}.`
            : plan === "premium"
              ? "Kamu memakai paket premium."
              : "Kamu memakai paket gratis."
        }
      />

      <div className="mt-6 flex flex-col gap-8">
        <Card aria-labelledby="usage-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="usage-title" className="font-heading text-base font-bold text-text">
              Kuota AI bulan ini
            </h2>
            {standing.known ? (
              <span className="text-sm text-text-muted tabular-nums">{standing.percent}%</span>
            ) : null}
          </div>

          {standing.known ? (
            <>
              <div
                role="meter"
                aria-label="Kuota AI bulan ini"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={standing.percent}
                aria-valuetext={`${standing.percent}% terpakai`}
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${standing.percent}%` }} />
              </div>
              <p className="mt-2 text-sm text-text-muted tabular-nums">
                {formatTokens(standing.used)} dari {formatTokens(standing.cap)} token
              </p>
            </>
          ) : (
            <p className="mt-4 text-base text-text">
              Pemakaian bulan ini belum bisa dibaca. Fitur AI tetap jalan seperti biasa; coba muat ulang nanti.
            </p>
          )}

          <p className="mt-2.5 text-sm text-text-muted">
            {standing.overCap
              ? `Batasnya sudah tercapai. Analisa ulang dan balasan chat WhatsApp berhenti sampai ${resetLabel}. Analisa pertama tiap hari tetap jalan.`
              : `Kuota terisi lagi ${resetLabel}. Kalau lewat batas, analisa pertama tiap hari tetap jalan; analisa ulang dan balasan chat WhatsApp berhenti sampai kuotanya terisi.`}
          </p>
        </Card>

        <section aria-labelledby="packages-title">
          <h2 id="packages-title" className="font-heading text-xl font-bold text-text">
            Premium
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            <span className="md:hidden">Geser catatannya untuk melihat pilihan lain.</span>
            <span className="hidden md:inline">Pilih catatan lama paketnya.</span>
          </p>
          <PackagePicker packages={packages} />
        </section>

        <section aria-labelledby="extras-title">
          <h3 id="extras-title" className="border-b border-rule pb-2.5 text-sm font-bold text-text">
            Semua yang gratis, ditambah
          </h3>
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {PREMIUM_EXTRAS.map((extra) => (
              <li key={extra} className="flex gap-2.5 text-base text-text">
                <ScribbleTick className="mt-0.5 size-5 shrink-0" />
                <span>{extra}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
