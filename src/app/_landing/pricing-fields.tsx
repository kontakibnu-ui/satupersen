"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { PackageValue, PremiumPackage } from "@/config/plans";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type PackageOption = PremiumPackage & PackageValue;

/**
 * Two plans as two fields that meet at a hard edge (DESIGN.md §10). Premium is
 * the wider field, so it reads as the one that matters more without a badge.
 * Its length is chosen with round stamps, the motif of the page. Prices come
 * from src/config/plans.ts, the numbers the app itself uses.
 */
export function PricingFields({
  packages,
  freeTokens,
  premiumTokens,
}: {
  packages: PackageOption[];
  freeTokens: string;
  premiumTokens: string;
}) {
  const [selectedId, setSelectedId] = useState<PremiumPackage["id"]>("12m");
  const selected = packages.find((pkg) => pkg.id === selectedId) ?? packages[packages.length - 1];

  return (
    <div className="grid overflow-hidden rounded-3xl md:grid-cols-12">
      <div className="flex flex-col justify-between gap-10 bg-surface p-6 md:col-span-5 md:p-10">
        <div>
          <h3 className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-none font-normal text-text">Gratis</h3>
          <p className="mt-4 max-w-[30ch] text-lg text-text">Untuk mulai membangun kebiasaan menulis.</p>
          <p className="mt-6 max-w-[40ch] text-base text-text-muted">
            Diary tanpa batas, analisa dan skor tiap hari, 1 analisa ulang per hari, 3 kebiasaan aktif, catatan
            pengeluaran, grafik 30 hari, laporan mingguan ringkas, dan kuota AI {freeTokens} token per bulan.
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-serif text-[clamp(3rem,8.5vw,5rem)] leading-none font-light text-text">Rp 0</p>
            <p className="mt-2 text-base text-text-muted">selamanya</p>
          </div>
          <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
            Mulai gratis
          </Link>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-10 bg-primary-soft p-6 md:col-span-7 md:p-10">
        <div>
          <h3 className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-none font-normal text-text">Premium</h3>
          <p className="mt-4 max-w-[34ch] text-lg text-text">Untuk yang ingin melihat polanya lebih dalam.</p>
          <p className="mt-6 max-w-[48ch] text-base text-text-muted">
            Semua yang gratis, ditambah 3 analisa ulang per hari, kebiasaan tanpa batas, budget bulanan, grafik
            365 hari, laporan mingguan lengkap dan laporan bulanan, 30 balasan AI di WhatsApp per hari, dan kuota AI{" "}
            {premiumTokens} token per bulan.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div aria-live="polite">
              <p className="font-serif text-[clamp(3rem,8.5vw,5rem)] leading-none font-light text-text">
                {formatRupiah(selected.price)}
              </p>
              <p className="mt-2 text-base text-text-muted">
                {selected.months === 1 ? "per bulan" : `untuk ${selected.months} bulan`}
              </p>
            </div>
            <Link href="/login" className={cn(buttonVariants({ variant: "secondary" }), "bg-surface")}>
              Pilih premium
            </Link>
          </div>

          <fieldset className="mt-8">
            <legend className="text-sm font-medium text-text-muted">Lama paket</legend>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
              {packages.map((pkg) => (
                <label
                  key={pkg.id}
                  className="group flex cursor-pointer flex-col items-center gap-2 text-center"
                >
                  <input
                    type="radio"
                    name="landing-package"
                    value={pkg.id}
                    checked={pkg.id === selectedId}
                    onChange={() => setSelectedId(pkg.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="flex size-14 items-center justify-center rounded-full border border-primary/40 bg-surface font-serif text-lg text-primary transition-[transform,background-color,color] duration-200 group-hover:-translate-y-0.5 peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary sm:size-16"
                  >
                    {pkg.months}
                  </span>
                  <span className="text-sm text-text">{pkg.months === 12 ? "1 tahun" : `${pkg.months} bulan`}</span>
                  {pkg.savingsPercent > 0 ? (
                    <span className="text-sm font-semibold text-accent-warm">hemat {pkg.savingsPercent}%</span>
                  ) : (
                    <span className="text-sm text-text-muted">bulanan</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="mt-6 text-base text-text">
            {selected.months === 1
              ? "Bebas berhenti kapan saja."
              : `Sama dengan ${formatRupiah(selected.perMonth)} sebulan. Lebih murah ${formatRupiah(selected.savedRupiah)} dibanding bayar bulanan.`}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Pembayaran premium segera dibuka. Mulai gratis dulu; semua catatanmu ikut terbawa.
          </p>
        </div>
      </div>
    </div>
  );
}
