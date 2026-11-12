import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The button kinds of DESIGN.md §6 (version 3), written once so every screen
 * looks the same. Ink on paper, no lift:
 * - primary: a pill filled with `primary` ink. At most one per screen (§2).
 * - secondary: a pill drawn with a `control` hairline.
 * - soft: a `primary-soft` pill for a quiet second action.
 * - link: plain `text`, underlined on hover and keyboard focus.
 *
 * Every kind is at least 44 px tall (DESIGN.md §5); the pills are 48 px.
 * `size: "inline"` is only for a link inside a sentence, where WCAG 2.5.8
 * exempts the target. The focus ring is 2 px `primary` (DESIGN.md §13).
 *
 * `buttonVariants` is exported for anchors that must look like a button.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 text-base font-semibold transition-[transform,background-color,border-color,color,opacity] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "rounded-full bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
        secondary:
          "rounded-full border border-control bg-transparent text-text hover:bg-surface-muted active:scale-[0.98]",
        soft: "rounded-full bg-primary-soft text-primary hover:opacity-85 active:scale-[0.98]",
        link: "font-normal text-text underline-offset-4 hover:underline focus-visible:underline",
      },
      size: {
        default: "min-h-12 px-6",
        inline: "inline px-0 text-[length:inherit]",
      },
    },
    compoundVariants: [{ variant: "link", size: "default", className: "min-h-11 px-0" }],
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & ButtonVariantProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
