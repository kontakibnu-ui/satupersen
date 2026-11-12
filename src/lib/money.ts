import { endOfMonthKey, startOfMonthKey, type DateKey } from "@/lib/dates";
import type { EntryType, MoneyRow } from "@/lib/expenses";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ExpenseRow = {
  id: string;
  date: DateKey;
  amount: number;
  category: string;
  note: string | null;
  type: EntryType;
};

/** PostgREST answers at most 1000 rows per request, so a month is read in pages. */
const PAGE_SIZE = 1000;

/** Every entry (money out and money in) of the month that holds `anyDayInMonth`, newest day first. */
export async function loadMonthExpenses(
  supabase: ServerClient,
  userId: string,
  anyDayInMonth: DateKey,
): Promise<ExpenseRow[]> {
  const first = startOfMonthKey(anyDayInMonth);
  const last = endOfMonthKey(anyDayInMonth);
  const rows: ExpenseRow[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, date, amount, category, note, type")
      .eq("user_id", userId)
      .gte("date", first)
      .lte("date", last)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);

    if (error) {
      throw new Error("Catatan uang tidak bisa dibaca");
    }

    rows.push(...((data ?? []) as ExpenseRow[]));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

/**
 * The monthly budget in force for a month: the one set for that month, or else
 * the latest one set before it, so a budget keeps applying until it is changed
 * (EXP-4). Null when the user never set one.
 */
export async function loadEffectiveBudget(
  supabase: ServerClient,
  userId: string,
  anyDayInMonth: DateKey,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("budgets")
    .select("amount")
    .eq("user_id", userId)
    .lte("month", startOfMonthKey(anyDayInMonth))
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Budget tidak bisa dibaca");
  }

  return (data?.amount as number | undefined) ?? null;
}

/**
 * The day, amount, and direction of every entry from `from` to `to`, for the
 * monthly totals, the comparison, and the finance part of the score (EXP-5,
 * EXP-6). Only these three columns leave the database.
 */
export async function loadMoneyRows(
  supabase: ServerClient,
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<MoneyRow[]> {
  const rows: MoneyRow[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("expenses")
      .select("date, amount, type")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);

    if (error) {
      throw new Error("Catatan uang tidak bisa dibaca");
    }

    rows.push(...((data ?? []) as MoneyRow[]));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}
