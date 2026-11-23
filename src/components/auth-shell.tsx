import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The frame of the screens before the app (login, password reset, onboarding):
 * the brand and the day and night switch on top, and one plain card (DESIGN.md
 * §15.6, radius 14 as in §14.4) in the middle of the page.
 */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-h-11 items-center">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>

      <main className="my-auto py-8">
        <div className="rounded-[14px] border border-border bg-surface p-6 md:p-8">
          <h1 className="font-heading text-title font-bold text-text">{title}</h1>
          {description ? <div className="mt-2 text-base text-text-muted">{description}</div> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
