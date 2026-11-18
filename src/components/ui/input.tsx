import { cn } from "@/lib/utils";

/**
 * A text field from DESIGN.md §14.3 and §14.4 (version 5): at least 52 px tall with a 12 px radius,
 * a 1 px `control` border, and at least 16 px text so Safari on iOS does not zoom in when it is focused.
 */
export const inputClassName =
  "min-h-13 w-full rounded-xl border border-control bg-surface px-4 text-base text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClassName, className)} {...props} />;
}
