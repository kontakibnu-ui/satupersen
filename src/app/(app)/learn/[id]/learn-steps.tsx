import { ScribbleTick } from "@/components/notebook";
import type { MaterialState } from "@/lib/study/schedule";
import { cn } from "@/lib/utils";

const STEPS = ["Tempel bahan", "Jelaskan", "Review"] as const;

/**
 * The three steps of a material (DESIGN.md §15.8), the same three the empty
 * Belajar screen explains, so they do not vanish after the first material. The
 * current one follows the material's own state; nothing new is stored.
 */
export function LearnSteps({ state }: { state: MaterialState["kind"] }) {
  // 1-based: draft is at step 2, an active material at step 3, a finished one past all three.
  const current = state === "draft" ? 2 : state === "finished" ? 4 : 3;

  return (
    <nav aria-label="Langkah belajar" className="mt-5">
      <ol className="relative grid grid-cols-3 gap-2 before:absolute before:top-4 before:right-[16.6%] before:left-[16.6%] before:border-t-[1.5px] before:border-rule-strong before:content-['']">
        {STEPS.map((label, position) => {
          const step = position + 1;
          const done = step < current;
          const now = step === current;

          return (
            <li
              key={label}
              aria-current={now ? "step" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1.5 text-center text-sm leading-tight",
                now ? "font-bold text-text" : "text-text-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm",
                  done && "bg-primary-soft text-primary",
                  now && "bg-primary text-primary-foreground",
                  !done && !now && "border-[1.5px] border-control bg-background",
                )}
              >
                {done ? <ScribbleTick strokeWidth={3} className="h-4 w-[18px]" /> : step}
              </span>
              <span>
                {label}
                {done ? <span className="sr-only">, selesai</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
