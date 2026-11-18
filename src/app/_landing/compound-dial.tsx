"use client";

import { useId, useState } from "react";
import { InkStamp } from "@/components/notebook";
import { compound, formatMultiple, MAX_DAYS } from "./compound";

/**
 * "Satu persen itu kecil" on the landing page (wireframe "Landing", DESIGN.md
 * §14.9): an ink stamp with 1% a day compounded over the chosen days, the
 * sentence beside it, and one slider; on wider screens the stamp grows and the
 * rest stacks beside it. The figure is plain arithmetic and the
 * line under it says it is an illustration, not a promise.
 */
export function CompoundDial() {
  const [days, setDays] = useState<number>(MAX_DAYS);
  const sliderId = useId();
  const better = compound(days, 0.01);
  const worse = compound(days, -0.01);

  return (
    // Phone (wireframe): stamp beside the sentence, slider and note below. From 768 px a
    // larger stamp spans the three rows and the sentence, slider, and note stack beside it.
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[18px] gap-y-3.5 md:gap-x-14 md:gap-y-4">
      <InkStamp
        figure={`${formatMultiple(better)}×`}
        caption={`setelah ${days} hari`}
        size={132}
        className="rotate-6 md:row-span-3 md:size-[240px]"
      />
      <output htmlFor={sliderId} aria-live="polite" className="min-w-0 text-base text-text md:text-xl md:leading-snug">
        Naik 1% tiap hari selama {days} hari jadi <strong className="font-bold">{formatMultiple(better)} kali</strong>{" "}
        lipat. Turun 1% tiap hari tinggal <strong className="font-bold">{formatMultiple(worse)} kali</strong>.
      </output>

      <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1 md:col-start-2">
        <label htmlFor={sliderId} className="text-sm font-semibold text-text">
          Jumlah hari: <span className="tabular-nums">{days}</span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={1}
          max={MAX_DAYS}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="h-11 w-full cursor-pointer accent-primary"
        />
      </div>

      <p className="col-span-2 text-xs text-text-muted md:col-span-1 md:col-start-2 md:self-start">
        Ilustrasi cara kebiasaan kecil menumpuk, bukan janji hasil.
      </p>
    </div>
  );
}
