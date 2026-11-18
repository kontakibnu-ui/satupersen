"use client";

import { BookOpen, ChartLine, CircleCheck, PenLine, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Navigation for the (app) group, following DESIGN.md §5 (version 3):
 * - a header on every size with the brand on the left and, on the right, the
 *   day and night switch and the profile circle that opens Akun;
 * - from 1024 px the five pages sit in that header as words;
 * - below 1024 px they sit in a flat bar at the bottom, within thumb reach.
 *
 * The active item is bolder **and** carries `aria-current`, so colour is never
 * the only signal (§13). Version 5 (§14.3) draws the bottom bar as divider
 * tabs: the active page hangs from the bar's top line as a paper tab.
 *
 * Since 2026-11-15 Belajar takes the slot Riwayat had, and Progres holds
 * Riwayat and Laporan as tabs, so Progres is active on all three routes.
 * Belajar carries a small ink dot while a review is due today (LEARN-9).
 */
const NAV_ITEMS: { href: string; label: string; icon: typeof PenLine; also?: string[] }[] = [
  { href: "/today", label: "Hari Ini", icon: PenLine },
  { href: "/habits", label: "Kebiasaan", icon: CircleCheck },
  { href: "/learn", label: "Belajar", icon: BookOpen },
  { href: "/expenses", label: "Uang", icon: Wallet },
  { href: "/dashboard", label: "Progres", icon: ChartLine, also: ["/history", "/reports"] },
];

const LEARN_HREF = "/learn";
const DUE_TEXT = ", ada review hari ini";

function useIsActive() {
  const pathname = usePathname();
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (href: string, also: string[] = []) => matches(href) || also.some(matches);
}

export function AppHeader({ initial, learnDue }: { initial: string; learnDue: boolean }) {
  const isActive = useIsActive();
  const onAccount = isActive("/settings");

  return (
    <header className="mx-auto w-full max-w-[1120px] px-4 pt-[env(safe-area-inset-top)] md:px-6">
      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border">
        <Link href="/today" className="flex min-h-11 items-center">
          <Brand />
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.also);
            const due = learnDue && item.href === LEARN_HREF;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 px-3 text-[15px] underline-offset-[10px] transition-colors duration-200",
                  active
                    ? "font-semibold text-text underline decoration-primary decoration-2"
                    : "text-text-muted hover:text-text",
                )}
              >
                {item.label}
                {due ? (
                  <>
                    <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                    <span className="sr-only">{DUE_TEXT}</span>
                  </>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/settings"
            aria-current={onAccount ? "page" : undefined}
            className="inline-flex size-11 items-center justify-center rounded-full"
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground transition-shadow duration-200",
                onAccount && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              {initial}
            </span>
            <span className="sr-only">Akun</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function AppNav({ learnDue }: { learnDue: boolean }) {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Navigasi utama"
      data-app-nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background lg:hidden"
    >
      <div className="mx-auto grid max-w-[560px] grid-cols-5 gap-0.5 px-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.also);
          const due = learnDue && item.href === LEARN_HREF;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[58px] min-w-11 flex-col items-center justify-center gap-[3px] rounded-b-[14px] border border-t-0 text-xs transition-colors duration-200",
                active
                  ? "border-border bg-surface font-bold text-primary"
                  : "border-transparent font-medium text-text-muted hover:text-text",
              )}
            >
              <span className="relative">
                <item.icon aria-hidden="true" size={22} strokeWidth={active ? 1.9 : 1.6} />
                {due ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-1.5 -top-0.5 size-2 rounded-full bg-primary ring-2",
                      active ? "ring-surface" : "ring-background",
                    )}
                  />
                ) : null}
              </span>
              {item.label}
              {due ? <span className="sr-only">{DUE_TEXT}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
