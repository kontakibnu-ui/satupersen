import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, Chip } from "@/components/ui/card";
import { MONTHLY_TOKEN_SOFT_CAP, PREMIUM_PACKAGES, packageValue } from "@/config/plans";
import { monthlyStanding } from "@/lib/ai/usage";
import { formatDayLabel, isValidTimeZone, startOfNextMonthKey, toDateKey, todayKey } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PackagePicker } from "./package-picker";

export const metadata: Metadata = {
  title: "Paket · Satu Persen",
};

const formatTokens = (value: number) => new Intl.NumberFormat("id-ID").format(value);

/** What each plan gets (PRD.md §8). Only features that exist are listed. */
const COMPARISON: { feature: string; free: string; premium: string }[] = [
  { feature: "Diary, ringkasan AI, dan skor harian", free: "Ya", premium: "Ya" },
  { feature: "Analisa ulang per hari", free: "1x", premium: "3x" },
  { feature: "Balasan AI di WhatsApp", free: "1 per hari", premium: "30 per hari" },
  { feature: "Kebiasaan aktif", free: "3", premium: "Tanpa batas" },
  { feature: "Budget bulanan", free: "Tidak", premium: "Ya" },
  { feature: "Riwayat grafik", free: "30 hari", premium: "365 hari" },
  { feature: "Laporan mingguan", free: "Ringkas", premium: "Lengkap" },
  { feature: "Laporan bulanan", free: "Tidak", premium: "Ya" },
  {
    feature: "Kuota AI per bulan",
    free: `${formatTokens(MONTHLY_TOKEN_SOFT_CAP.free)} token`,
    premium: `${formatTokens(MONTHLY_TOKEN_SOFT_CAP.premium)} token`,
  },
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
      <PageHeader title="Paket" description="Paketmu sekarang, kuota AI bulan ini, dan pilihan premium." />

      <div className="mt-6 flex flex-col gap-4">
        <Card aria-labelledby="usage-title">
          <CardHeader
            id="usage-title"
            title="Kuota AI bulan ini"
            aside={
              <Chip tone={plan === "premium" ? "accent" : "neutral"}>
                {plan === "premium" ? "Premium" : "Gratis"}
              </Chip>
            }
          />

          {premiumUntil ? (
            <p className="mt-2 text-sm text-text-muted">Premium aktif sampai {premiumUntil}.</p>
          ) : null}

          {standing.known ? (
            <>
              <p className="mt-4 text-base text-text">
                <span className="font-serif text-3xl font-light tabular-nums">{standing.percent}%</span>
                <span className="ml-2 text-text-muted">
                  {formatTokens(standing.used)} dari {formatTokens(standing.cap)} token
                </span>
              </p>
              <div
                role="meter"
                aria-label="Kuota AI bulan ini"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={standing.percent}
                aria-valuetext={`${standing.percent}% terpakai`}
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className={standing.overCap ? "h-full rounded-full bg-accent-warm" : "h-full rounded-full bg-primary"}
                  style={{ width: `${standing.percent}%` }}
                />
              </div>
            </>
          ) : (
            <p className="mt-4 text-base text-text">
              Pemakaian bulan ini belum bisa dibaca. Fitur AI tetap jalan seperti biasa; coba muat ulang nanti.
            </p>
          )}

          <p className="mt-4 text-sm text-text-muted">
            {standing.overCap
              ? `Batasnya sudah tercapai. Analisa ulang dan balasan chat WhatsApp berhenti sampai ${resetLabel}. Analisa pertama tiap hari tetap jalan.`
              : `Kuota terisi lagi ${resetLabel}. Kalau lewat batas, analisa pertama tiap hari tetap jalan; analisa ulang dan balasan chat WhatsApp berhenti sampai kuotanya terisi.`}
          </p>
        </Card>

        <Card aria-labelledby="packages-title">
          <CardHeader id="packages-title" title={plan === "premium" ? "Perpanjang premium" : "Pilih premium"} />
          <PackagePicker packages={packages} />
        </Card>

        <Card aria-labelledby="compare-title">
          <CardHeader id="compare-title" title="Gratis dan premium" />
          <div className="mt-4">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="text-text-muted">
                  <th scope="col" className="w-[44%] py-2 pr-3 font-medium">
                    Fitur
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Gratis
                  </th>
                  <th scope="col" className="py-2 pl-3 font-medium">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-t border-border">
                    <th scope="row" className="py-3 pr-3 font-normal text-text">
                      {row.feature}
                    </th>
                    <td className="px-3 py-3 text-text-muted">{row.free}</td>
                    <td className="py-3 pl-3 font-semibold text-text">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Link href="/settings" className={buttonVariants({ variant: "link", className: "mt-8" })}>
        Kembali ke Akun
      </Link>
    </main>
  );
}
