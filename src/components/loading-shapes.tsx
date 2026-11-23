import { cn } from "@/lib/utils";

/**
 * Still shapes for the loading.tsx of each main screen (DESIGN.md §15.5). Each
 * screen draws its own outline from these pieces, so the real content lands
 * where the outline was and nothing jumps. Plain `surface-muted` fields with no
 * pulse (§12 forbids repeating animation); the words are for screen readers.
 */
export function LoadingPage({
  children,
  split = false,
  wide = false,
}: {
  children: React.ReactNode;
  /** Hari Ini and Uang: the 1040 px two-column frame from 1024 px (§15.1). */
  split?: boolean;
  /** Progres: the 960 px frame (§5). */
  wide?: boolean;
}) {
  return (
    <main
      aria-busy="true"
      data-split={split ? "" : undefined}
      data-wide={wide ? "" : undefined}
      className="py-6 md:py-10"
    >
      <div aria-hidden="true">{children}</div>
      <p aria-live="polite" className="sr-only">
        Memuat…
      </p>
    </main>
  );
}

export function Bar({ className }: { className?: string }) {
  return <span className={cn("block h-4 rounded-full bg-surface-muted", className)} />;
}

/** The title and one line under it, like PageHeader. */
export function HeaderShape({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      {eyebrow ? <Bar className="h-3.5 w-32" /> : null}
      <Bar className="h-7 w-48" />
      <Bar className="w-64 max-w-full" />
    </div>
  );
}

/** A binder sheet's outline: the paper with its margin, without holes or tape. */
export function SheetShape({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[14px] border border-border bg-surface py-[18px] pr-[18px] pl-[52px]", className)}>
      {children}
    </div>
  );
}

/** A section head: title on the left, a short note on the right, the double rule under both. */
export function HeadShape() {
  return (
    <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-rule-strong pb-2.5">
      <Bar className="w-32" />
      <Bar className="h-3.5 w-14" />
    </div>
  );
}

/** One 56 px row on a pale rule, starting with a habit box or an icon circle. */
export function RowShape({ lead = "none", width = "w-40" }: { lead?: "box" | "circle" | "none"; width?: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3.5 border-b border-rule">
      {lead === "box" ? <span className="size-[26px] shrink-0 rounded-md border-[1.5px] border-control" /> : null}
      {lead === "circle" ? <span className="size-9 shrink-0 rounded-full bg-surface-muted" /> : null}
      <Bar className={width} />
    </div>
  );
}

/** A pill the size of a primary button. */
export function ButtonShape({ className }: { className?: string }) {
  return <span className={cn("block h-14 rounded-full bg-surface-muted", className)} />;
}
