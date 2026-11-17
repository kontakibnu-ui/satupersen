"use client";

import { useId, useState } from "react";
import { compound, dialFraction, formatMultiple, MAX_DAYS } from "./compound";

const PRESETS = [7, 30, 90, 365] as const;
const RADIUS = 132;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The one live thing of the landing page: drag the days and watch 1% a day
 * compound inside the stamp. The dial is the brand's "1%" seal; the ring fills
 * as the year goes on. The figure is plain arithmetic and says so.
 */
export function CompoundDial() {
  const [days, setDays] = useState<number>(MAX_DAYS);
  const sliderId = useId();
  const better = compound(days, 0.01);
  const worse = compound(days, -0.01);
  const offset = CIRCUMFERENCE * (1 - dialFraction(days));

  return (
    <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
      <div className="relative mx-auto aspect-square w-full max-w-[22rem]" data-ui>
        <svg viewBox="0 0 300 300" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="150" cy="150" r="146" className="fill-surface stroke-primary/25" strokeWidth="2" />
          <circle cx="150" cy="150" r={RADIUS} className="fill-none stroke-surface-muted" strokeWidth="14" />
          <circle
            cx="150"
            cy="150"
            r={RADIUS}
            className="landing-arc fill-none stroke-accent-warm"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
          <circle cx="150" cy="150" r="112" className="fill-none stroke-primary/30" strokeWidth="1.5" strokeDasharray="2 6" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-heading text-[clamp(2.75rem,8vw,4.5rem)] leading-none font-bold tracking-[-0.03em] text-primary tabular-nums">
            {formatMultiple(better)}x
          </span>
          <span className="mt-2 text-base text-text-muted">hari ke-{days}</span>
        </div>
      </div>

      <div>
        <output htmlFor={sliderId} aria-live="polite" className="block text-xl leading-snug text-text md:text-2xl">
          Naik 1% tiap hari selama {days} hari: <strong className="font-semibold">{formatMultiple(better)} kali</strong>{" "}
          dari titik awalmu. Turun 1% tiap hari: tinggal{" "}
          <strong className="font-semibold">{formatMultiple(worse)} kali</strong>.
        </output>

        <label htmlFor={sliderId} className="mt-8 block text-sm font-medium text-text-muted">
          Geser jumlah hari
        </label>
        <input
          id={sliderId}
          type="range"
          min={1}
          max={MAX_DAYS}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="mt-3 h-11 w-full cursor-pointer accent-primary"
        />

        {/* Four equal columns on a phone, so "1 tahun" does not drop to a row of its own at 360 px. */}
        <div className="mt-3 grid grid-cols-4 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Pilih cepat">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDays(preset)}
              aria-pressed={days === preset}
              className="min-h-11 rounded-full border border-control px-2 text-sm font-semibold whitespace-nowrap sm:px-4 text-text transition-colors duration-200 hover:bg-surface-muted aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {preset === MAX_DAYS ? "1 tahun" : `${preset} hari`}
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm text-text-muted">
          Hitungan sederhana 1,01 pangkat jumlah hari. Ilustrasi cara kebiasaan kecil menumpuk, bukan janji hasil.
        </p>
      </div>
    </div>
  );
}
