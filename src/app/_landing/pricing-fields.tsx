"use client";

import { Check } from "lucide-react";
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
 *
 * From 768 px both fields share their first two rows (CSS subgrid), so the plan
 * names and the two prices sit on the same lines and can be compared at a
 * glance (design audit 2026-11-14). What each plan holds is a short list, not a
 * paragraph, and the note that payment is not open yet sits right under the
 * button it qualifies.
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

  const freeItems = [
    "Diary tanpa batas",
    "Analisa dan skor tiap hari, plus 1 analisa ulang",
    "3 kebiasaan aktif",
    "Belajar: 1 materi, diperiksa AI 1x sehari",
    "Catatan pengeluaran",
    "Grafik 30 hari dan laporan mingguan ringkas",
  ];

  const premiumItems = [
    "3 analisa ulang per hari",
    "Kebiasaan tanpa batas dan budget bulanan",
    "Materi Belajar tanpa batas, diperiksa AI 10x per materi sehari",
    "Grafik 365 hari",
    "Laporan mingguan lengkap dan laporan bulanan",
    "30 balasan AI di WhatsApp per hari",
  ];

  return (
    <div className="grid overflow-hidden rounded-3xl md:grid-cols-12">
      <div className="grid content-start gap-8 bg-surface p-6 md:col-span-5 md:row-span-3 md:grid-rows-subgrid md:p-10">
        <PlanHeading name="Gratis" tagline="Untuk mulai membangun kebiasaan menulis." />

        <div>
          <p className={priceClass}>Rp 0</p>
          <p className="mt-2 text-base text-text-muted">selamanya</p>
        </div>

        <div className="flex flex-col items-start gap-8">
          <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
            Mulai gratis
          </Link>
          <PlanList heading="Yang kamu dapat" items={freeItems} tokens={freeTokens} />
        </div>
      </div>

      <div className="grid content-start gap-8 bg-primary-soft p-6 md:col-span-7 md:row-span-3 md:grid-rows-subgrid md:p-10">
        <PlanHeading name="Premium" tagline="Untuk yang ingin melihat polanya lebih dalam." />

        <div aria-live="polite">
          <p className={priceClass}>{formatRupiah(selected.price)}</p>
          <p className="mt-2 text-base text-text-muted">
            {selected.months === 1 ? "per bulan" : `untuk ${selected.months} bulan`}
          </p>
        </div>

        <div className="flex flex-col items-start gap-8">
          <div className="w-full">
            <fieldset>
              <legend className="text-sm font-medium text-text-muted">Lama paket</legend>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
                {packages.map((pkg) => (
                  <label key={pkg.id} className="group flex cursor-pointer flex-col items-center gap-2 text-center">
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
                      className="flex size-14 items-center justify-center rounded-full border border-primary/40 bg-surface font-heading text-lg font-semibold text-primary transition-[transform,background-color,color] duration-200 group-hover:-translate-y-0.5 peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary sm:size-16"
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
          </div>

          <div>
            <Link href="/login" className={cn(buttonVariants({ variant: "secondary" }), "bg-surface")}>
              Pilih premium
            </Link>
            <p className="mt-3 max-w-[44ch] text-sm text-text-muted">
              Pembayaran premium segera dibuka. Mulai gratis dulu; semua catatanmu ikut terbawa.
            </p>
          </div>

          <PlanList heading="Semua yang gratis, ditambah" items={premiumItems} tokens={premiumTokens} />
        </div>
      </div>
    </div>
  );
}

/** Big numbers are Plus Jakarta Sans 700 in version 4 (DESIGN.md §4). */
const priceClass =
  "font-heading text-[clamp(2.5rem,7vw,4rem)] leading-none font-bold tracking-[-0.03em] text-text tabular-nums";

function PlanHeading({ name, tagline }: { name: string; tagline: string }) {
  return (
    <div>
      <h3 className="font-heading text-[clamp(1.75rem,4vw,2.5rem)] leading-none font-bold tracking-[-0.02em] text-text">
        {name}
      </h3>
      <p className="mt-4 max-w-[34ch] text-lg text-text">{tagline}</p>
    </div>
  );
}

/**
 * What a plan holds. The AI quota is the last line and links to the question
 * that explains what a token is, instead of leaving the word unexplained.
 */
function PlanList({ heading, items, tokens }: { heading: string; items: string[]; tokens: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-text">{heading}</p>
      <ul className="mt-3 flex flex-col gap-2 text-base text-text">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <Check aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-text-muted" />
            {item}
          </li>
        ))}
        <li className="flex gap-3">
          <Check aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-text-muted" />
          <span>
            Kuota AI {tokens} token sebulan (
            <a href="#faq-kuota" className="underline underline-offset-4">
              apa itu?
            </a>
            )
          </span>
        </li>
      </ul>
    </div>
  );
}
