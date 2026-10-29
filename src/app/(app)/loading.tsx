/**
 * Loading state for every signed in page (AGENTS.md §6): a quiet line, no
 * spinner and no pulsing skeleton (DESIGN.md §12 forbids repeating animation).
 */
export default function AppLoading() {
  return (
    <main className="py-8">
      <p aria-live="polite" className="text-sm text-text-muted">
        Memuat…
      </p>
    </main>
  );
}
