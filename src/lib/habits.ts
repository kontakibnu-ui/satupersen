import { addDays, type DateKey } from "@/lib/dates";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

/** HABIT-3: the most active habits a free account can have. */
export const FREE_HABIT_LIMIT = 3;

/**
 * How far back the checked days are read for a streak. The streak stops at the
 * first two missed days in a row, so a run longer than a year is only ever
 * shown as 366.
 */
const STREAK_LOOKBACK_DAYS = 366;

/** PostgREST answers at most 1000 rows per request, so logs are read in pages. */
const PAGE_SIZE = 1000;

export type HabitView = {
  id: string;
  name: string;
  identity: string | null;
  /** Days this habit was checked, inside the streak lookback. */
  doneDates: DateKey[];
};

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The user's active habits in the order they were made, with the days each was checked. */
export async function loadActiveHabits(
  supabase: ServerClient,
  userId: string,
  today: DateKey,
): Promise<HabitView[]> {
  const { data: habits, error } = await supabase
    .from("habits")
    .select("id, name, identity")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Kebiasaan tidak bisa dibaca");
  }

  if (!habits || habits.length === 0) {
    return [];
  }

  const habitIds = habits.map((habit) => habit.id as string);
  const doneByHabit = new Map<string, DateKey[]>(habitIds.map((id) => [id, []]));
  const from = addDays(today, -STREAK_LOOKBACK_DAYS);

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data: logs, error: logsError } = await supabase
      .from("habit_logs")
      .select("habit_id, date")
      .eq("user_id", userId)
      .in("habit_id", habitIds)
      .gte("date", from)
      .lte("date", today)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);

    if (logsError) {
      throw new Error("Centang kebiasaan tidak bisa dibaca");
    }

    for (const log of logs ?? []) {
      doneByHabit.get(log.habit_id as string)?.push(log.date as DateKey);
    }

    if (!logs || logs.length < PAGE_SIZE) {
      break;
    }
  }

  return habits.map((habit) => ({
    id: habit.id as string,
    name: habit.name as string,
    identity: (habit.identity as string | null) ?? null,
    doneDates: doneByHabit.get(habit.id as string) ?? [],
  }));
}
