import { cn } from "@/lib/utils";

/**
 * The pieces of version 5, "Meja Tulis" (DESIGN.md §14): objects on a desk and
 * marks made with a pen, all in the one ink. Which one goes where is set by
 * §14.2; nothing here is a new colour, font, or shape (§14.6).
 */

/** Lets ruled lines and double rules inside a binder sheet run to its edges. */
export const BLEED = "binder-bleed";

/**
 * A binder sheet (§14.3): only for what the user writes, or reads back as a
 * note. `stacked` draws the two sheets peeking out underneath; leave it off
 * where the sheet runs to the bottom of the screen (writing mode).
 */
export function BinderSheet({
  as: Tag = "section",
  stacked = true,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "figure"; stacked?: boolean }) {
  const sheet = <Tag className={cn("binder-sheet", className)} {...props} />;

  return stacked ? <div className="binder-stack">{sheet}</div> : sheet;
}

/**
 * The printed heading of a school notebook page (§14.3 "Kop"): a label and the
 * value filled in with ink on a dotted line, closed by a double rule. Hari
 * Ini and Riwayat use "Hari / Tanggal", Laporan "Laporan / Periode".
 */
export function Kop({ rows, className }: { rows: readonly (readonly [string, string])[]; className?: string }) {
  return (
    <dl
      className={cn(
        BLEED,
        "grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 border-b-[3px] border-double border-rule-strong pb-2.5",
        className,
      )}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm text-text-muted">{label}</dt>
          <dd className="border-b border-dotted border-control font-serif text-lg italic text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The heading of a part laid straight on the page (§14.3 "Kepala bagian"): the
 * title at the left, a short count at the right, and a double rule under both.
 */
export function SectionHead({
  title,
  id,
  aside,
  as: Heading = "h2",
  className,
}: {
  title: React.ReactNode;
  id?: string;
  aside?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 border-b-[3px] border-double border-rule-strong pb-2",
        className,
      )}
    >
      <Heading id={id} className="min-w-0 font-heading text-base font-bold text-text">
        {title}
      </Heading>
      {aside ? <div className="shrink-0 text-sm text-text-muted tabular-nums">{aside}</div> : null}
    </div>
  );
}

/**
 * A sticky note (§14.3 "Catatan tempel"): one thing to remember, tilted a
 * degree and held by a strip of tape. Never a button, warning, or error. In a
 * row that scrolls sideways the tilt alternates, so pass `tilt="right"` for
 * every second note.
 */
export function StickyNote({
  as: Tag = "div",
  tilt = "left",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "label"; tilt?: "left" | "right" }) {
  return (
    <Tag
      className={cn(
        "relative rounded-[3px] bg-primary-soft px-4 py-3.5",
        "before:pointer-events-none before:absolute before:-top-2 before:left-1/2 before:-ml-6 before:h-[15px] before:w-12 before:rotate-2 before:bg-rule/85 before:content-['']",
        tilt === "left" ? "-rotate-1" : "rotate-1",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The ink stamp (§14.3 "Cap tinta"): the change against the last scored day,
 * pressed on at an angle. Decoration only; the sentence beside it is what a
 * screen reader reads.
 */
export function InkStamp({
  figure,
  caption = "dari kemarin",
  size = 112,
  className,
}: {
  figure: string;
  caption?: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 116 116"
      className={cn("shrink-0 -rotate-8 text-primary", className)}
    >
      <circle cx="58" cy="58" r="54" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="58" cy="58" r="47" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
      <text
        x="58"
        y="64"
        textAnchor="middle"
        fontSize={figure.length > 4 ? 26 : 32}
        fontWeight="700"
        fill="currentColor"
        className="font-heading tabular-nums"
      >
        {figure}
      </text>
      <text
        x="58"
        y="84"
        textAnchor="middle"
        // "dari hari Kamis" and "dari 12 Oktober" need a smaller hand to stay inside the inner ring.
        fontSize={caption.length > 12 ? 10.5 : 13}
        fill="currentColor"
        className="font-serif italic"
      >
        {caption}
      </text>
    </svg>
  );
}

/* The five pen marks of §14.3. Draw only these; a new shape needs the user's approval. */

const UNDERLINE_PATH = "M1 6C18 2 30 7.5 49 4.5S82 2.5 99 5.5";
const CIRCLE_PATH = "M27 4C15 3 5 12 4.5 25.5 4 39 13.5 48.5 26.5 48 39 47.5 48 38.5 48 26 48 13.5 39.5 5.5 25 3.5";
const TICK_PATH = "M5 17c2.5 2 4.5 4.5 6 7.5C14.5 16 20 9 28 4";
const SMALL_CIRCLE_PATH = "M12.5 5C8 4.5 5 8 5 12s3 7.5 7.5 7 7-3.5 6.5-8S15.5 4.5 11 5.5";
const TALLY_PATHS = ["M3 2.5v13", "M7 2v13.5", "M11 2.5v13", "M15 2v13.5", "M1 12.5 17.5 5"];

/**
 * A pen stroke under the one key figure or phrase of a block (§14.1 rule 3):
 * never under a title, never under text that already has a line beneath it.
 */
export function ScribbleUnderline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 9"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-[5px] -left-[3px] h-2 w-[calc(100%+6px)] overflow-visible text-primary"
      >
        <path
          d={UNDERLINE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

/** The circle drawn round a chosen mood or energy, and round today's point on the chart. */
export function ScribbleCircle({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 52 52" className={cn("pointer-events-none text-primary", className)}>
      <path d={CIRCLE_PATH} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

/** A pen tick: a checked habit, "Yang sudah bagus", what Premium adds, a privacy point. */
export function ScribbleTick({ className, strokeWidth = 3 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 30" className={cn("pointer-events-none text-primary", className)}>
      <path
        d={TICK_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A small pen circle: "Ruang untuk tumbuh", "Pola yang terlihat", "Kaitan antar bagian". */
export function ScribbleRing({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("pointer-events-none text-primary", className)}>
      <path d={SMALL_CIRCLE_PATH} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Tally marks beside a streak (§14.3 "Turus"): one stroke a day up to four,
 * the fifth across them. Longer streaks keep the full group of five; the
 * number next to it says the rest.
 */
export function Tally({ count, className }: { count: number; className?: string }) {
  const strokes = Math.min(5, Math.max(0, Math.floor(count)));

  if (strokes === 0) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 18"
      className={cn("pointer-events-none h-[18px] w-5 shrink-0 text-text-muted", className)}
    >
      {TALLY_PATHS.slice(0, strokes).map((path) => (
        <path key={path} d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </svg>
  );
}
