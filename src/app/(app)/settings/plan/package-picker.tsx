"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/card";
import type { PackageValue, PremiumPackage } from "@/config/plans";
import { formatRupiah } from "@/lib/format";

type PackageOption = PremiumPackage & PackageValue;

const BADGES: Partial<Record<PremiumPackage["id"], string>> = {
  "3m": "Pas untuk mencoba",
  "12m": "Paling hemat",
};

/**
 * The four premium packages as one radio group. Payment is not connected yet
 * (TASKS.md 6.2 waits for the gateway decision), so the button says so instead
 * of pretending to take money.
 */
export function PackagePicker({ packages }: { packages: PackageOption[] }) {
  const [selectedId, setSelectedId] = useState<PremiumPackage["id"]>("12m");
  const selected = packages.find((pkg) => pkg.id === selectedId) ?? packages[0];

  return (
    <div className="mt-4">
      <fieldset>
        <legend className="sr-only">Lama paket premium</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((pkg) => (
            <label
              key={pkg.id}
              className="flex min-h-11 cursor-pointer flex-col gap-1 rounded-2xl border border-border bg-surface p-4 transition-colors duration-200 hover:bg-surface-muted has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="package"
                    value={pkg.id}
                    checked={pkg.id === selectedId}
                    onChange={() => setSelectedId(pkg.id)}
                    className="size-5 accent-primary"
                  />
                  <span className="text-base font-semibold text-text">{pkg.label}</span>
                </span>
                {BADGES[pkg.id] ? <Chip tone={pkg.id === "12m" ? "accent" : "sage"}>{BADGES[pkg.id]}</Chip> : null}
              </span>
              <span className="font-serif text-2xl font-light text-text tabular-nums">{formatRupiah(pkg.price)}</span>
              <span className="text-sm text-text-muted">
                {pkg.months > 1 ? `${formatRupiah(pkg.perMonth)} sebulan, hemat ${pkg.savingsPercent}%` : "Dibayar per bulan"}
              </span>
              <span className="text-sm text-text-muted">{pkg.note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button type="button" disabled className="w-full sm:w-auto" aria-describedby="payment-note">
          Bayar {formatRupiah(selected.price)}
        </Button>
        <p id="payment-note" className="text-sm text-text-muted">
          {selected.savedRupiah > 0
            ? `Lebih murah ${formatRupiah(selected.savedRupiah)} dibanding bayar bulanan. `
            : ""}
          Pembayaran belum dibuka; paket bisa dibeli begitu gateway pembayaran tersambung.
        </p>
      </div>
    </div>
  );
}
