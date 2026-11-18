"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ScribbleUnderline, StickyNote } from "@/components/notebook";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PackageValue, PremiumPackage } from "@/config/plans";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type PackageOption = PremiumPackage & PackageValue;

/** A note is 262 px wide with a 14 px gap (DESIGN.md §14.3). */
const NOTE_STEP = 276;
const SPACER = "w-[max(0px,calc(50%-145px))] shrink-0";

/**
 * The premium packages as sticky notes (DESIGN.md §14.3 "Pilihan paket
 * premium"), longest first. On a phone they are a row that scrolls sideways
 * and snaps to the middle, the next note peeking at the edge, and the note in
 * the middle is the chosen one. From 768 px all four fit as a 2 × 2 grid and a
 * tap chooses (user 2026-11-17: the phone wireframe adapted for the web). Each
 * note holds a real radio button, so keys and screen readers choose too. One
 * primary button below follows the choice ("Pilih 12 bulan"). Prices, the
 * monthly figure, and the saving come from src/config/plans.ts.
 *
 * Payment is not connected yet (TASKS.md 6.2 waits for the gateway decision).
 * On Paket the button stays disabled and the line under it says so instead of
 * pretending to take money. On the landing page (`href`) it leads to sign up,
 * because a visitor has no account to pay from yet.
 */
export function PackagePicker({
  packages,
  href,
  note = "Pembayaran premium segera dibuka.",
  rowClassName = "-mx-4 md:mx-0",
  className,
}: {
  packages: PackageOption[];
  href?: string;
  note?: string;
  /** Lets the row run to the screen's edges inside the page padding. */
  rowClassName?: string;
  className?: string;
}) {
  const ordered = [...packages].sort((a, b) => b.months - a.months);
  const [index, setIndex] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  const selected = ordered[Math.min(index, ordered.length - 1)];

  function choose(position: number) {
    setIndex(position);
    // On a phone the chosen note slides to the middle; on a grid there is nothing to scroll.
    row.current?.scrollTo({ left: position * NOTE_STEP, behavior: "smooth" });
  }

  return (
    <div className={className}>
      <div
        ref={row}
        role="radiogroup"
        aria-label="Lama paket premium"
        onScroll={(event) => {
          const next = Math.round(event.currentTarget.scrollLeft / NOTE_STEP);

          if (next !== index) {
            setIndex(Math.max(0, Math.min(ordered.length - 1, next)));
          }
        }}
        className={cn(
          "flex snap-x snap-mandatory gap-3.5 overflow-x-auto pt-[22px] pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // From 768 px there is room for all four: a 2 × 2 grid, chosen by tapping a note.
          "md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-7 md:overflow-visible md:snap-none",
          rowClassName,
        )}
      >
        {/* A spacer of half the row minus half a note (and the gap) at each end, so the first
            and the last note can also snap to the middle, and the index is scroll / one step. */}
        <span aria-hidden="true" className={cn(SPACER, "md:hidden")} />
        {ordered.map((pkg, position) => (
          <StickyNote
            key={pkg.id}
            as="label"
            tilt={position % 2 === 0 ? "left" : "right"}
            className={cn(
              "w-[262px] shrink-0 cursor-pointer snap-center px-5 pt-[22px] pb-5 md:w-auto",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-primary",
              // On the grid the chosen note is marked, since it is not the one in the middle.
              "md:has-checked:ring-2 md:has-checked:ring-primary md:has-checked:ring-offset-4 md:has-checked:ring-offset-background",
            )}
          >
            <input
              type="radio"
              name="premium-package"
              value={pkg.id}
              checked={position === index}
              onChange={() => choose(position)}
              aria-label={pkg.label}
              aria-describedby={`package-${pkg.id}`}
              className="sr-only"
            />
            <span aria-hidden="true" className="block font-serif text-xl text-primary italic">
              {pkg.label}
            </span>
            <span id={`package-${pkg.id}`} className="block">
              <span className="mt-1.5 block font-heading text-[34px] leading-[1.05] font-bold tracking-[-0.02em] text-primary tabular-nums">
                {formatRupiah(pkg.price)}
              </span>
              <span className="mt-2.5 block text-sm text-text-muted tabular-nums">
                {formatRupiah(pkg.perMonth)} sebulan
                {pkg.savingsPercent > 0 ? (
                  <>
                    , <ScribbleUnderline className="font-bold text-text">hemat {pkg.savingsPercent}%</ScribbleUnderline>
                  </>
                ) : null}
              </span>
              <span className="mt-3.5 block text-base text-text">{pkg.note}</span>
            </span>
          </StickyNote>
        ))}
        <span aria-hidden="true" className={cn(SPACER, "md:hidden")} />
      </div>

      <div aria-hidden="true" className="flex justify-center gap-2 md:hidden">
        {ordered.map((pkg, position) => (
          <span
            key={pkg.id}
            className={cn("size-2 rounded-full", position === index ? "bg-primary" : "bg-rule-strong")}
          />
        ))}
      </div>

      {href ? (
        <Link href={href} className={buttonVariants({ className: "mt-[18px] w-full md:mt-4" })} aria-describedby="payment-note">
          Pilih {selected.label}
        </Link>
      ) : (
        <Button type="button" disabled className="mt-[18px] w-full md:mt-4" aria-describedby="payment-note">
          Pilih {selected.label}
        </Button>
      )}
      <p id="payment-note" className="mt-2.5 text-center text-sm text-text-muted">
        {note}
      </p>
    </div>
  );
}
