"use client";

import { Check } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { toggleHabit } from "@/app/(app)/habits/actions";
import type { HabitView } from "@/lib/habits";
import { streakLength } from "@/lib/streak";

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
 * The checklist of DESIGN.md §6 "Baris kebiasaan", shared by Hari Ini and
 * Kebiasaan: rows ruled like a notebook, a 28 px ink circle inside a 56 px row,
 * the name, the identity under it, and the streak at the right as quiet text
 * ("5 hari").
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
}: {
  date: string;
  habits: HabitView[];
  setHabits: Dispatch<SetStateAction<HabitView[]>>;
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
      <ul className="flex flex-col divide-y divide-border">
        {habits.map((habit) => {
          const done = habit.doneDates.includes(date);
          const streak = streakLength(habit.doneDates, date);

          return (
            <li key={habit.id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                <span className="relative inline-flex size-7 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={busy.has(habit.id)}
                    onChange={(event) => void change(habit.id, event.target.checked)}
                    className="peer absolute inset-0 size-7 cursor-pointer appearance-none rounded-full border-2 border-control bg-surface transition-colors duration-200 ease-out checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait"
                  />
                  <Check
                    aria-hidden="true"
                    strokeWidth={3}
                    className="pointer-events-none relative size-4 text-primary-foreground opacity-0 peer-checked:opacity-100"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium text-text">{habit.name}</span>
                  {habit.identity ? (
                    <span className="block text-sm text-text-muted">{habit.identity}</span>
                  ) : null}
                </span>

                {streak > 0 ? (
                  <span className="shrink-0 text-sm text-text-muted tabular-nums">
                    {streak} hari<span className="sr-only"> beruntun</span>
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
