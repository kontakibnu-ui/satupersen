import Link from "next/link";

/**
 * The footer of every public page: the way in, and links to the two legal
 * pages. It sits on the landing page, the privacy page, and the terms page.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border py-8 text-sm text-text-muted">
      <nav aria-label="Tautan bawah" className="flex flex-wrap gap-x-6">
        <Link href="/login" className="flex min-h-11 min-w-11 items-center text-text underline-offset-4 hover:underline">
          Masuk
        </Link>
        <Link href="/privacy" className="flex min-h-11 min-w-11 items-center text-text underline-offset-4 hover:underline">
          Privasi
        </Link>
        <Link href="/terms" className="flex min-h-11 min-w-11 items-center text-text underline-offset-4 hover:underline">
          Syarat layanan
        </Link>
      </nav>
    </footer>
  );
}
