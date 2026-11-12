import { cn } from "@/lib/utils";

/** The logo: the name alone with its closing full stop, set as a quiet editorial wordmark. */
export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap font-wordmark text-[1.375rem] leading-none font-medium tracking-[-0.02em] text-text",
        className,
      )}
    >
      Satu Persen.
    </span>
  );
}
