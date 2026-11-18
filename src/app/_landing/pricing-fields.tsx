import Link from "next/link";
import { ScribbleTick } from "@/components/notebook";
import { PackagePicker } from "@/components/package-picker";
import { buttonVariants } from "@/components/ui/button";
import { MONTHLY_TOKEN_SOFT_CAP, PLAN_LIMITS, type PackageValue, type PremiumPackage } from "@/config/plans";

type PackageOption = PremiumPackage & PackageValue;

const FREE = PLAN_LIMITS.free;
const formatTokens = (value: number) => new Intl.NumberFormat("id-ID").format(value);

/** What the free plan holds, from src/config/plans.ts, the limits the server enforces. */
const FREE_ITEMS = [
  `${FREE.activeHabits} kebiasaan aktif`,
  `${FREE.studyMaterials} materi Belajar dan ${FREE.books} buku di Ruang baca`,
  `Analisa harian, plus ${FREE.reanalysesPerDay} analisa ulang`,
  `Grafik ${FREE.chartDays} hari dan laporan mingguan`,
  `Kuota AI ${formatTokens(MONTHLY_TOKEN_SOFT_CAP.free)} token sebulan`,
];

/**
 * "Harga" on the landing page (wireframe "Landing", DESIGN.md §14.3, §14.9).
 *
 * Below 1024 px it is the wireframe: Gratis as a plain card (name and Rp 0 on
 * one line, one sentence, the secondary "Mulai gratis"), then Premium as a row
 * of sticky notes. From 1024 px the two plans sit side by side on shared rows
 * (CSS subgrid), so their headings line up and the Gratis card stands as tall
 * as the notes, with its price, what it holds ticked in pen, and its button at
 * the bottom (user 2026-11-17: the small card "kaya aneh"). Premium's one
 * primary button follows the chosen note and leads to sign up, since payment
 * is not open yet.
 */
export function PricingFields({ packages }: { packages: PackageOption[] }) {
  return (
    // minmax(0, 1fr) and min-w-0: the sideways row of notes must not widen its column to its full length.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:gap-10 lg:grid-cols-12 lg:grid-rows-[auto_1fr_auto_auto] lg:gap-y-0">
      <div className="min-w-0 lg:col-span-4 lg:row-span-4 lg:grid lg:grid-rows-subgrid">
        <div className="hidden lg:block">
          <h3 className="text-base font-bold text-text">Gratis</h3>
          <p className="mt-1 text-sm text-text-muted">Untuk mulai membangun kebiasaan menulis.</p>
        </div>

        <div className="flex flex-col rounded-[14px] border border-border bg-surface p-[18px] md:p-7 lg:row-span-3 lg:mt-[22px]">
          {/* Phone and tablet: the card of the wireframe. */}
          <div className="flex items-baseline justify-between gap-3 lg:hidden">
            <h3 className="text-base font-bold text-text">Gratis</h3>
            <p className="text-xl font-bold text-text tabular-nums">Rp 0</p>
          </div>
          <p className="mt-1.5 text-sm text-text-muted lg:hidden">
            {FREE.activeHabits} kebiasaan, {FREE.studyMaterials} materi, {FREE.books} buku, grafik {FREE.chartDays} hari,
            dan analisa harian.
          </p>

          {/* Laptop: as tall as the notes beside it. */}
          <div className="hidden lg:block">
            <p className="font-heading text-[34px] leading-[1.05] font-bold tracking-[-0.02em] text-text tabular-nums">Rp 0</p>
            <p className="mt-2.5 text-sm text-text-muted">Selamanya, tanpa kartu.</p>
            <ul className="mt-5 flex flex-col gap-2.5 border-t border-rule pt-5">
              {FREE_ITEMS.map((item) => (
                <li key={item} className="flex gap-2.5 text-base text-text">
                  <ScribbleTick className="mt-0.5 size-5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3.5 lg:mt-auto lg:pt-7">
            <Link href="/login" className={buttonVariants({ variant: "secondary", className: "w-full" })}>
              Mulai gratis
            </Link>
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-8 lg:row-span-4 lg:grid lg:grid-rows-subgrid">
        <div>
          <h3 className="text-base font-bold text-text">Premium</h3>
          <p className="mt-1 text-sm text-text-muted">
            Semua yang gratis, ditambah batas yang lebih longgar dan grafik 1 tahun.{" "}
            <span className="md:hidden">Geser catatannya untuk melihat pilihan lain.</span>
            <span className="hidden md:inline">Pilih catatan lama paketnya.</span>
          </p>
        </div>
        {/* `lg:contents` puts the notes, the button, and the note under it on the shared rows. */}
        <PackagePicker packages={packages} href="/login" className="lg:contents" />
      </div>
    </div>
  );
}
