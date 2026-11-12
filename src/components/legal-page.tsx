import Link from "next/link";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";

export type LegalSection = { title: string; paragraphs: string[]; items?: string[] };

/**
 * The shared shell of the privacy and terms pages. Both are drafts written from
 * PRD.md §7 and wait for a human review before launch (PRD.md §7, TASKS.md 6.4),
 * and the notice at the top says so, so nobody reads a draft as final.
 */
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between gap-3 py-5">
        <Link href="/" className="flex min-h-11 min-w-11 items-center">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>

      <main className="rounded-3xl border border-border bg-surface p-6 md:p-10">
        <h1 className="font-heading text-title font-bold text-text">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">Terakhir diubah {updated}</p>

        <p role="note" className="mt-4 rounded-2xl bg-accent-soft p-4 text-sm text-text">
          Ini draf yang masih menunggu tinjauan manusia dan belum final. Bagian dalam tanda kurung siku
          menunggu keputusan pengelola.
        </p>

        <div className="mt-8 flex flex-col gap-8">
          {sections.map((section, index) => (
            <section key={section.title} aria-labelledby={`legal-${index}`}>
              <h2 id={`legal-${index}`} className="font-serif text-xl font-medium text-text">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-base text-text">
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3 text-base text-text">
                      <span aria-hidden="true" className="mt-[0.65rem] size-1.5 shrink-0 rounded-full bg-text-muted" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
