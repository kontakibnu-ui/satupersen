import { Bar } from "@/components/loading-shapes";

/**
 * The loading state of Progres (DASH-3, DESIGN.md §15.5): the real title right
 * away, then the outline of the tabs, the period switch, the number, and the
 * chart, still, with no spinner and no progress bar that pretends to know how
 * long it takes.
 */
export default function DashboardLoading() {
  return (
    <main data-wide="" aria-busy="true" className="py-6 md:py-10">
      <h1 className="font-heading text-title font-bold text-text">Progres</h1>

      <div aria-hidden="true">
        <Bar className="mt-3 w-60 max-w-full" />
        <div className="mt-5 flex gap-6 border-b border-border pb-3">
          <Bar className="w-14" />
          <Bar className="w-16" />
          <Bar className="w-16" />
        </div>
        <div className="max-w-[640px]">
          <span className="mt-6 block h-12 rounded-full bg-surface-muted" />
          <Bar className="mt-6 h-11 w-24" />
          <Bar className="mt-3 w-60 max-w-full" />
          <div className="mt-6 h-48 border-b border-control md:h-64" />
        </div>
      </div>

      <p role="status" className="sr-only">
        Memuat progresmu…
      </p>
    </main>
  );
}
