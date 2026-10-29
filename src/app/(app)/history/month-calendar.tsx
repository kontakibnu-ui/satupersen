import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { addDays, endOfMonthKey, formatDayLabel, formatMonthLabel, monthGrid, startOfMonthKey } from "@/lib/dates";

const WEEKDAYS = [
  { short: "Sen", full: "Senin" },
  { short: "Sel", full: "Selasa" },
  { short: "Rab", full: "Rabu" },
  { short: "Kam", full: "Kamis" },
  { short: "Jum", full: "Jumat" },
  { short: "Sab", full: "Sabtu" },
  { short: "Min", full: "Minggu" },
];

export function historyHref(month: string, day?: string): string {
  return day ? `/history?month=${month}&day=${day}` : `/history?month=${month}`;
}

/**
 * The history calendar from DESIGN.md §6: seven columns, 44 px cells, a 4 px
 * `text-muted` dot under days that have an entry, a `control` ring around
 * today, and a `primary` fill for the selected day. Days without an entry get
 * no mark at all.
 *
 * At 360 px the seven columns are about 47 px wide each, so the cells touch.
 * DESIGN.md §5 asks for 8 px between targets, which seven 44 px cells cannot
 * have at that width; the component rule for this calendar wins here, and each
 * cell's whole area is its target.
 *
 * Days after today cannot be opened, because nothing can be written there yet.
 */
export function MonthCalendar({
  monthKey,
  today,
  selected,
  entryDays,
}: {
  /** The month on screen as "yyyy-MM". */
  monthKey: string;
  today: string;
  selected: string | null;
  entryDays: Set<string>;
}) {
  const first = startOfMonthKey(`${monthKey}-01`);
  const previousMonth = addDays(first, -1).slice(0, 7);
  const nextMonth = addDays(endOfMonthKey(first), 1).slice(0, 7);
  const canGoForward = nextMonth <= today.slice(0, 7);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <Link
          href={historyHref(previousMonth)}
          aria-label={`Bulan sebelumnya, ${formatMonthLabel(`${previousMonth}-01`)}`}
          className={buttonVariants({ variant: "link", className: "min-w-11" })}
        >
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={1.5} />
        </Link>

        <h2 className="text-base font-semibold text-text">{formatMonthLabel(first)}</h2>

        {canGoForward ? (
          <Link
            href={historyHref(nextMonth)}
            aria-label={`Bulan berikutnya, ${formatMonthLabel(`${nextMonth}-01`)}`}
            className={buttonVariants({ variant: "link", className: "min-w-11" })}
          >
            <ChevronRight aria-hidden="true" size={20} strokeWidth={1.5} />
          </Link>
        ) : (
          <span className="min-w-11" aria-hidden="true" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-7 text-center">
        {WEEKDAYS.map((weekday) => (
          <abbr
            key={weekday.short}
            title={weekday.full}
            className="pb-2 text-sm text-text-muted no-underline"
          >
            {weekday.short}
          </abbr>
        ))}

        {monthGrid(first)
          .flat()
          .map((day, index) =>
            day === null ? (
              <span key={`empty-${index}`} aria-hidden="true" />
            ) : (
              <div key={day} className="flex justify-center">
                <DayCell
                  day={day}
                  monthKey={first.slice(0, 7)}
                  isToday={day === today}
                  isSelected={day === selected}
                  hasEntry={entryDays.has(day)}
                  isFuture={day > today}
                />
              </div>
            ),
          )}
      </div>
    </div>
  );
}

function DayCell({
  day,
  monthKey,
  isToday,
  isSelected,
  hasEntry,
  isFuture,
}: {
  day: string;
  monthKey: string;
  isToday: boolean;
  isSelected: boolean;
  hasEntry: boolean;
  isFuture: boolean;
}) {
  const number = Number(day.slice(8));

  if (isFuture) {
    return (
      <span className="flex size-11 items-center justify-center text-base text-text-muted tabular-nums">
        {number}
      </span>
    );
  }

  const label = [formatDayLabel(day), isToday ? "hari ini" : null, hasEntry ? "ada entri" : "tanpa entri"]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={historyHref(monthKey, day)}
      aria-label={label}
      aria-current={isSelected ? "date" : undefined}
      className={`relative flex size-11 items-center justify-center rounded-full text-base tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isSelected
          ? "bg-primary text-primary-foreground"
          : isToday
            ? "border border-control text-text"
            : "text-text"
      }`}
    >
      {number}
      {hasEntry ? (
        <span
          aria-hidden="true"
          className={`absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full ${
            isSelected ? "bg-primary-foreground" : "bg-text-muted"
          }`}
        />
      ) : null}
    </Link>
  );
}
