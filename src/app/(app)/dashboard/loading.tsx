/**
 * The loading state of Progres (DASH-3): the same shape as the page, still, with
 * no spinner and no progress bar that pretends to know how long it takes.
 */
export default function DashboardLoading() {
  return (
    <main data-wide aria-busy="true" className="py-8">
      <h1 className="font-heading text-title font-bold text-text">Progres</h1>

      <div aria-hidden="true" className="mt-4 flex gap-2">
        <div className="h-11 w-24 rounded-full bg-surface-muted" />
        <div className="h-11 w-24 rounded-full bg-surface-muted" />
        <div className="h-11 w-24 rounded-full bg-surface-muted" />
      </div>

      <div aria-hidden="true" className="mt-8 flex flex-col gap-3">
        <div className="h-10 w-20 rounded-sm bg-surface-muted" />
        <div className="h-4 w-2/3 rounded-sm bg-surface-muted" />
        <div className="mt-3 h-48 w-full rounded-lg bg-surface-muted md:h-64" />
      </div>

      <p role="status" className="mt-6 text-sm text-text-muted">
        Memuat progresmu…
      </p>
    </main>
  );
}
