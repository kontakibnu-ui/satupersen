import Link from "next/link";

const TABS = [
  { key: "grafik", href: "/dashboard", label: "Grafik" },
  { key: "riwayat", href: "/history", label: "Riwayat" },
  { key: "laporan", href: "/reports", label: "Laporan" },
] as const;

export type ProgressTab = (typeof TABS)[number]["key"];

/**
 * The three parts of Progres (DESIGN.md §5, §6 "Tab Progres", 2026-11-15):
 * Grafik, Riwayat, and Laporan, one route each, so a tab can be linked and
 * reloaded. Drawn as underlined words on a hairline, unlike the period's
 * segmented control, so the two choices are never confused. The active tab is
 * bolder and underlined in ink and carries `aria-current`, so colour is never
 * the only signal (§13).
 */
export function ProgressTabs({ current }: { current: ProgressTab }) {
  return (
    <nav aria-label="Bagian Progres" className="mt-4 border-b border-border">
      <ul className="flex gap-6">
        {TABS.map((tab) => {
          const active = tab.key === current;

          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 min-w-11 items-center justify-center text-base transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-primary ${
                  active
                    ? "font-semibold text-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
