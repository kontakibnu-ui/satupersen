"use client";

import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/card";

/**
 * Error state for every signed in page (AGENTS.md §6, DESIGN.md §15.5): a plain
 * card that says the page could not open and that saved data is safe, with one
 * way out. It never blames the user (§11) and never shows the error itself:
 * messages and stack traces stay on the server (PRD.md §7).
 *
 * `retry` re-fetches and re-renders the page, as the Next.js 16 error.js
 * reference recommends for errors that may be temporary.
 */
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="py-6 md:py-10">
      <div className="flex flex-col items-center rounded-[14px] border border-border bg-surface px-6 py-10 text-center">
        <IconBadge icon={CloudOff} size="lg" />
        <h1 className="mt-4 font-heading text-lg font-bold text-text">Halaman ini belum bisa dibuka</h1>
        <p className="mt-2 max-w-sm text-base text-text-muted">Yang sudah tersimpan tetap aman.</p>
        <Button variant="secondary" onClick={() => retry()} className="mt-6">
          Coba lagi
        </Button>
      </div>
    </main>
  );
}
