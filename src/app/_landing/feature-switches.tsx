"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Feature = {
  id: string;
  sentence: string;
  consequence: string;
  /** The field colour of the band while it is switched on. */
  onTone: string;
};

/**
 * What can be recorded, as sentences that end in a real switch (DESIGN.md §10).
 * A band switched on fills with its colour and says what it means in numbers.
 * All of them start on, so a visitor who only scrolls still reads every one
 * (design audit 2026-11-14: two bands that started off hid half the list).
 */
export function FeatureSwitches({ features }: { features: Feature[] }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(features.map((feature) => feature.id)));

  const toggle = (id: string) =>
    setOn((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

  return (
    <ul className="flex flex-col">
      {features.map((feature) => {
        const active = on.has(feature.id);

        return (
          <li
            key={feature.id}
            className={cn(
              "transition-colors duration-300",
              active ? feature.onTone : "bg-background",
            )}
          >
            <div className="mx-auto flex min-h-[8.5rem] max-w-[1080px] items-center gap-6 px-4 py-6 md:min-h-[9.5rem] md:px-8">
              <div className="min-w-0 flex-1">
                <p
                  id={`feature-${feature.id}`}
                  className={cn(
                    "font-heading text-[clamp(1.375rem,2.2vw,1.75rem)] leading-tight font-bold tracking-[-0.015em] transition-colors duration-300",
                    active ? "text-text" : "text-text-muted",
                  )}
                >
                  {feature.sentence}
                </p>
                <p
                  id={`feature-${feature.id}-detail`}
                  hidden={!active}
                  className="mt-2 max-w-[60ch] text-base text-text"
                >
                  {feature.consequence}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-labelledby={`feature-${feature.id}`}
                aria-describedby={active ? `feature-${feature.id}-detail` : undefined}
                onClick={() => toggle(feature.id)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full"
                data-ui
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative inline-flex h-8 w-14 items-center rounded-full border transition-colors duration-200",
                    active ? "border-primary bg-primary" : "border-control bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "absolute size-6 rounded-full transition-transform duration-200",
                      active ? "translate-x-7 bg-primary-foreground" : "translate-x-1 bg-text-muted",
                    )}
                  />
                </span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
