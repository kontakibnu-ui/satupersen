import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The plain card of DESIGN.md §14.2 and §14.4 (version 5): `surface`, a
 * hairline, a 14 px radius, no holes, no ruled lines, no shadow. For groups
 * that are status or tools rather than notes (calendar, quota, a WhatsApp
 * number). What the user writes goes on a binder sheet instead
 * (`components/notebook.tsx`). A card never sits inside another card.
 */
export function Card({
  as: Tag = "section",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "li" }) {
  return <Tag className={cn("rounded-[14px] border border-border bg-surface p-[18px] md:p-6", className)} {...props} />;
}

/** The heading row of a card: a small ink icon, the title in bold sans, and an optional item at the right. */
export function CardHeader({
  title,
  id,
  icon: Icon,
  tone = "primary",
  aside,
}: {
  title: string;
  id?: string;
  icon?: LucideIcon;
  tone?: IconTone;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <Icon aria-hidden="true" size={18} strokeWidth={1.6} className={cn("shrink-0", TEXT_TONES[tone])} />
        ) : null}
        <h2 id={id} className="truncate font-heading text-lg font-bold text-text">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

export type IconTone = "primary" | "accent" | "plum" | "sage" | "neutral";

const TEXT_TONES: Record<IconTone, string> = {
  primary: "text-primary",
  accent: "text-accent-warm",
  plum: "text-plum",
  sage: "text-sage",
  neutral: "text-text-muted",
};

const SOFT_TONES: Record<IconTone, string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent-warm",
  plum: "bg-plum-soft text-plum",
  sage: "bg-sage-soft text-sage",
  neutral: "bg-surface-muted text-text-muted",
};

/** An icon in a tinted circle, like a small printed seal (DESIGN.md §2: the one place colour decorates). */
export function IconBadge({
  icon: Icon,
  tone = "primary",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "lg" ? "size-14" : "size-9",
        SOFT_TONES[tone],
      )}
    >
      <Icon size={size === "lg" ? 24 : 17} strokeWidth={1.6} />
    </span>
  );
}

/** A small tag: a streak, a count, a period. Tinted paper with ink text. */
export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: IconTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
        SOFT_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
