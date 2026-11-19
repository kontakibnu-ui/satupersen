import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, IconBadge } from "@/components/ui/card";

/**
 * One group of the Akun menu (DESIGN.md §14.3 "Akun"): a short title in
 * `text-muted` above a plain card that holds the rows. Used only on this route.
 */
export function SettingsGroup({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="px-1 text-sm font-semibold text-text-muted">
        {title}
      </h2>
      <Card as="div" className="mt-2 overflow-hidden p-0 md:p-0">
        <ul>{children}</ul>
      </Card>
    </section>
  );
}

/**
 * One row of an Akun group: an ink icon in a soft circle (the same seal the
 * category rows of Uang use), the title, an optional line of detail, an
 * optional value at the right, and a chevron when the row opens another
 * screen. The whole row is the target, at least 60 px tall. `download` makes
 * it a plain link that downloads instead of navigating; `children` sits under
 * the detail (the quota meter of Paket).
 */
export function SettingsRow({
  href,
  icon,
  title,
  detail,
  value,
  download = false,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
  value?: React.ReactNode;
  download?: boolean;
  children?: React.ReactNode;
}) {
  const content = (
    <>
      <IconBadge icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-text">{title}</span>
        {detail ? <span className="block text-sm text-text-muted">{detail}</span> : null}
        {children}
      </span>
      {value ? <span className="max-w-[45%] shrink-0 truncate text-sm text-text-muted">{value}</span> : null}
      {download ? null : (
        <ChevronRight aria-hidden="true" size={18} strokeWidth={1.6} className="shrink-0 text-text-muted" />
      )}
    </>
  );

  // The focus ring sits inside the row, because the card clips what pokes out of it.
  const className =
    "flex min-h-15 items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";

  return (
    <li className="border-t border-rule first:border-t-0">
      {download ? (
        <a href={href} download className={className}>
          {content}
        </a>
      ) : (
        <Link href={href} className={className}>
          {content}
        </Link>
      )}
    </li>
  );
}
