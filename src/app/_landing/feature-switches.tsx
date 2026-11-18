"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Feature = {
  id: string;
  label: string;
  consequence: string;
};

/**
 * "Yang ikut dicatat" on the landing page (wireframe "Landing", DESIGN.md
 * §14.9): one ruled row per thing the app records, ending in a real switch.
 * A switch that is on shows what the feature means under its name, so the
 * control does something. All start on, so a visitor who only scrolls still
 * reads every one (design audit 2026-11-14).
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
    <ul className="flex flex-col md:grid md:grid-cols-2 md:gap-x-10">
      {features.map((feature) => {
        const active = on.has(feature.id);

        return (
          <li key={feature.id} className="flex min-h-14 items-center gap-4 border-b border-rule py-2">
            <div className="min-w-0 flex-1">
              <p id={`feature-${feature.id}`} className="text-base text-text">
                {feature.label}
              </p>
              <p id={`feature-${feature.id}-detail`} hidden={!active} className="mt-0.5 text-sm text-text-muted">
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
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex h-[30px] w-[52px] items-center rounded-full border transition-colors duration-200",
                  active ? "border-primary bg-primary" : "border-control bg-surface-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] left-[3px] size-[22px] rounded-full transition-transform duration-200",
                    active ? "translate-x-[22px] bg-surface" : "bg-control",
                  )}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
