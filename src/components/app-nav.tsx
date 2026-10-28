"use client";

import { NotebookPen, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation for the (app) group, following DESIGN.md §5: a bottom bar on
 * phones, a 72 px rail on tablets, and a 240 px sidebar on laptops.
 *
 * Only pages that already exist get an item, so this list grows as the app
 * does: Hari Ini, Kebiasaan, Uang, and Progres join it in later phases. The
 * active item is marked with `primary` **and** `aria-current`, because colour
 * alone is never the only signal (DESIGN.md §13).
 */
const NAV_ITEMS = [
  { href: "/today", label: "Hari Ini", icon: NotebookPen },
  { href: "/settings", label: "Akun", icon: UserRound },
] as const;

export function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        data-app-nav
        className="fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 py-2 text-label ${
              isActive(item.href) ? "text-primary" : "text-text-muted"
            }`}
          >
            <item.icon aria-hidden="true" size={20} strokeWidth={1.5} />
            {item.label}
          </Link>
        ))}
      </nav>

      <nav
        aria-label="Navigasi utama"
        data-app-nav
        className="fixed inset-y-0 left-0 z-10 hidden w-[72px] flex-col items-center gap-2 border-r border-border bg-surface pt-6 md:flex lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex min-h-11 w-full flex-col items-center justify-center gap-1 py-2 text-label ${
              isActive(item.href) ? "text-primary" : "text-text-muted"
            }`}
          >
            <item.icon aria-hidden="true" size={20} strokeWidth={1.5} />
            {item.label}
          </Link>
        ))}
      </nav>

      <nav
        aria-label="Navigasi utama"
        data-app-nav
        className="fixed inset-y-0 left-0 z-10 hidden w-[240px] flex-col gap-1 border-r border-border bg-surface px-3 pt-6 lg:flex"
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-base ${
              isActive(item.href) ? "text-primary" : "text-text-muted"
            }`}
          >
            <item.icon aria-hidden="true" size={20} strokeWidth={1.5} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
