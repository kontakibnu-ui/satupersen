"use client";

import { Button } from "@/components/ui/button";

/**
 * Error state for every signed in page (AGENTS.md §6). It says what happened
 * and what to do without blaming the user (DESIGN.md §11), and never shows the
 * error itself: messages and stack traces stay on the server (PRD.md §7).
 *
 * `retry` re-fetches and re-renders the page, as the Next.js 16 error.js
 * reference recommends for errors that may be temporary.
 */
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="py-8">
      <h1 className="font-serif text-title text-text">Halaman ini belum bisa ditampilkan</h1>
      <p className="mt-2 text-base text-text-muted">
        Ada gangguan saat mengambil datamu. Tulisanmu yang sudah tersimpan tetap aman.
      </p>
      <Button variant="secondary" onClick={() => retry()} className="mt-6">
        Coba lagi
      </Button>
    </main>
  );
}
