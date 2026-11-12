import { cn } from "@/lib/utils";

/**
 * A text field from DESIGN.md §3 and §4 (version 3): 48 px tall and rounded, a 1 px `control` border,
 * and at least 16 px text so Safari on iOS does not zoom in when it is focused.
 */
export const inputClassName =
  "min-h-12 w-full rounded-2xl border border-control bg-surface px-4 text-base text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClassName, className)} {...props} />;
}
