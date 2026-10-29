import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The three button kinds from DESIGN.md §6, written once so every screen looks
 * the same:
 * - primary: `primary` fill. At most one per screen (DESIGN.md §2).
 * - secondary: 1 px `control` border with `text`.
 * - link: plain `text`, underlined on hover and keyboard focus.
 *
 * Every kind is 44 px tall by default (DESIGN.md §5). `size: "inline"` is only
 * for a link that sits inside a sentence, where WCAG 2.5.8 exempts the target.
 * The focus ring is 2 px `primary` (DESIGN.md §13).
 *
 * `buttonVariants` is exported for anchors that must look like a button, such
 * as the `tel:` link on the crisis screen.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center text-base font-normal transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "rounded-md bg-primary text-primary-foreground",
        secondary: "rounded-md border border-control text-text",
        link: "text-text underline-offset-4 hover:underline focus-visible:underline",
      },
      size: {
        default: "min-h-11 px-5",
        inline: "inline px-0 text-[length:inherit]",
      },
    },
    compoundVariants: [{ variant: "link", size: "default", className: "px-0" }],
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
