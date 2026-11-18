"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { toggleHabit } from "@/app/(app)/habits/actions";
import { ScribbleTick, Tally } from "@/components/notebook";
import type { HabitView } from "@/lib/habits";
import { streakLength } from "@/lib/streak";
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
 */
export function HabitChecklist({
  date,
  habits,
  setHabits,
  showIdentity = true,
  lastRule = true,
}: {
  date: string;
  habits: HabitView[];
  setHabits: Dispatch<SetStateAction<HabitView[]>>;
  /** Kebiasaan shows who the habit makes you; Hari Ini keeps to the name. */
  showIdentity?: boolean;
  /** Inside a binder sheet the last row needs no rule under it. */
  lastRule?: boolean;
}) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function change(habitId: string, done: boolean) {
    setHabits((current) => withDone(current, habitId, date, done));
    setBusy((current) => new Set(current).add(habitId));
    setMessage(undefined);

    const result = await toggleHabit({ habitId, date, done });

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

          return (
            <li key={habit.id} className="border-b border-rule">
              <label className="flex min-h-14 cursor-pointer items-center gap-3.5 py-2">
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
