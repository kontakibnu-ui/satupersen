"use client";

import { EllipsisVertical } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { toggleHabit } from "@/app/(app)/habits/actions";
import { ScribbleTick, Tally } from "@/components/notebook";
import { callAction } from "@/lib/call-action";
import { formatDayParts, formatWeekdayShort, lastNDays } from "@/lib/dates";
import type { HabitView } from "@/lib/habits";
import { streakAtRisk, streakLength } from "@/lib/streak";
import { cn } from "@/lib/utils";

/** `habits` with `habitId` checked or unchecked for `date`. */
function withDone(list: HabitView[], habitId: string, date: string, done: boolean): HabitView[] {
  return list.map((habit) =>
    habit.id === habitId
      ? {
          ...habit,
          doneDates: done
            ? [...new Set([...habit.doneDates, date])]
            : habit.doneDates.filter((day) => day !== date),
        }
      : habit,
  );
}

/**
 * The checklist of DESIGN.md §14.3 "Baris kebiasaan", shared by Hari Ini and
 * Kebiasaan: 56 px rows on pale rules, a 26 px box that a pen tick runs out of
 * when checked (the box itself stays empty), the name, on Kebiasaan the
 * identity under it, and at the right tally marks and the streak ("5 hari").
 * The whole row is the target.
 *
 * The list lives in the parent, which passes its setter, so the parent can also
 * read which habits are checked (Hari Ini needs that to notice a change after
 * the summary). A tap updates the screen at once and is saved by the server
 * action; if the server refuses, the box goes back and the reason is written
 * under the list (DESIGN.md §6: status where the action happens, never a toast).
 * The streak is worked out from the checked days with the function the tests
 * cover.
 *
 * Version 5.1 (DESIGN.md §15.7): a habit whose streak hangs on today says
 * "Kemarin terlewat" under its name; Kebiasaan adds the last seven days under
 * each row and a button that opens the habit's settings, kept apart from the
 * box so a tap on one never does the other.
 */
export function HabitChecklist({
  date,
  habits,
  setHabits,
  showIdentity = true,
  lastRule = true,
  showWeek = false,
  onEdit,
}: {
  date: string;
  habits: HabitView[];
  setHabits: Dispatch<SetStateAction<HabitView[]>>;
  /** Kebiasaan shows who the habit makes you; Hari Ini keeps to the name. */
  showIdentity?: boolean;
  /** Inside a binder sheet the last row needs no rule under it. */
  lastRule?: boolean;
  /** Kebiasaan: the last seven days under each row. */
  showWeek?: boolean;
  /** Kebiasaan: opens the habit's settings sheet. */
  onEdit?: (habit: HabitView) => void;
}) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function change(habitId: string, done: boolean) {
    setHabits((current) => withDone(current, habitId, date, done));
    setBusy((current) => new Set(current).add(habitId));
    setMessage(undefined);

    const result = await callAction(() => toggleHabit({ habitId, date, done }));

    setBusy((current) => {
      const next = new Set(current);
      next.delete(habitId);
      return next;
    });

    if (!result.ok) {
      setHabits((current) => withDone(current, habitId, date, !done));
      setMessage(result.message);
    }
  }

  return (
    <div>
      <ul className={cn("flex flex-col", !lastRule && "[&>li:last-child]:border-b-0")}>
        {habits.map((habit) => {
          const done = habit.doneDates.includes(date);
          const streak = streakLength(habit.doneDates, date);
          const atRisk = streakAtRisk(habit.doneDates, date);

          return (
            <li key={habit.id} className="border-b border-rule">
              <div className="flex items-center gap-1">
                <label className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3.5 py-2">
                  <span className="relative inline-flex size-[26px] shrink-0">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={busy.has(habit.id)}
                      onChange={(event) => void change(habit.id, event.target.checked)}
                      className="peer absolute inset-0 size-[26px] cursor-pointer appearance-none rounded-md border-[1.5px] border-control bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait"
                    />
                    <ScribbleTick
                      strokeWidth={2.6}
                      className="absolute -top-[9px] left-0 h-[30px] w-8 opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-base text-text">{habit.name}</span>
                    {showIdentity && habit.identity ? (
                      <span className="block font-serif text-sm text-text-muted italic">{habit.identity}</span>
                    ) : null}
                    {atRisk ? <span className="block text-sm text-text-muted">Kemarin terlewat</span> : null}
                  </span>

                  {streak > 0 ? (
                    <span className="inline-flex shrink-0 items-center gap-2 text-sm text-text-muted tabular-nums">
                      <Tally count={streak} />
                      <span>
                        {streak} hari<span className="sr-only"> beruntun</span>
                      </span>
                    </span>
                  ) : null}
                </label>
                {onEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(habit)}
                    aria-label={`Atur ${habit.name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <EllipsisVertical aria-hidden="true" size={18} strokeWidth={1.8} />
                  </button>
                ) : null}
              </div>
              {showWeek ? <WeekMarks doneDates={habit.doneDates} date={date} /> : null}
            </li>
          );
        })}
      </ul>

      <p role="status" className="mt-1 text-sm text-text-muted">
        {message}
      </p>
    </div>
  );
}

/**
 * The last seven days under a habit (DESIGN.md §15.7): a pen tick for a checked
 * day, a short dash for a missed one, a dotted circle for today while it is
 * open. One label reads the whole week to a screen reader.
 */
function WeekMarks({ doneDates, date }: { doneDates: string[]; date: string }) {
  const done = new Set(doneDates);
  const days = lastNDays(date, 7);
  const checked = days.filter((day) => done.has(day)).map((day) => formatDayParts(day).weekday);
  const label =
    checked.length === 0
      ? "Tujuh hari terakhir: belum ada yang dicentang"
      : `Tujuh hari terakhir, dicentang: ${checked.join(", ")}`;

  return (
    <div role="img" aria-label={label} className="grid grid-cols-7 gap-0.5 pb-3 pl-10">
      {days.map((day) => {
        const isToday = day === date;
        const isDone = done.has(day);

        return (
          <span
            key={day}
            className={isToday ? "flex flex-col items-center gap-0.5 text-xs font-bold text-text" : "flex flex-col items-center gap-0.5 text-xs text-text-muted"}
          >
            {formatWeekdayShort(day)}
            {isDone ? (
              <ScribbleTick strokeWidth={2.4} className="h-[18px] w-5" />
            ) : isToday ? (
              <svg aria-hidden="true" viewBox="0 0 32 30" className="h-[18px] w-5 text-control">
                <circle cx="16" cy="15" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 3" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 32 30" className="h-[18px] w-5 text-control">
                <path d="M10 15h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}
