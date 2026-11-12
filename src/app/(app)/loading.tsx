/**
 * Loading state for every signed in page (AGENTS.md §6): a quiet line, no
 * spinner and no pulsing skeleton (DESIGN.md §12 forbids repeating animation).
 */
export default function AppLoading() {
  return (
    <main aria-busy="true" className="py-6 md:py-10">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-4 w-40 rounded-full bg-surface-muted" />
        <div className="h-8 w-56 rounded-full bg-surface-muted" />
      </div>
      <div aria-hidden="true" className="mt-6 flex flex-col gap-4">
        <div className="h-40 rounded-3xl border border-border bg-surface" />
        <div className="h-56 rounded-3xl border border-border bg-surface" />
      </div>
      <p aria-live="polite" className="mt-4 text-sm text-text-muted">
        Memuat…
      </p>
    </main>
  );
}
