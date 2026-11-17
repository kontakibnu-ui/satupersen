import type { Metadata } from "next";
import {
  addDays,
  endOfMonthKey,
  formatDayLabel,
  formatMonthLabel,
  isDateKey,
  isValidTimeZone,
  todayKey,
} from "@/lib/dates";
import { compareMonths, monthsEndingAt, monthTotals } from "@/lib/expenses";
import { loadEffectiveBudget, loadMonthExpenses, loadMoneyRows } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseBoard, type DayGroup } from "./expense-board";
import type { MonthBar } from "./money-chart";

export const metadata: Metadata = {
  title: "Uang · Satu Persen",
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** How many months the comparison chart shows, ending at the month on screen. */
const CHART_MONTHS = 6;

/**
 * Uang (EXP-1 to EXP-6, DESIGN.md §2 and §8). The one focus is what is left of
 * the month (or the total spent, while no income is logged); the days below it
 * stay quiet. The month comes from the URL and is
 * clamped to a real month that is not after the current one, so the screen
 * never reads a future month. The budget is read only for a premium account
 * (SUB-1), and a free account never receives that number.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone, plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const timeZone =
    profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const today = todayKey(timeZone);
  const currentMonth = today.slice(0, 7);
  const month =
    bulan && MONTH_PATTERN.test(bulan) && isDateKey(`${bulan}-01`) && bulan <= currentMonth
      ? bulan
      : currentMonth;
  const monthStart = `${month}-01`;
  const isPremium = profile?.plan === "premium";

  const chartMonths = monthsEndingAt(month, CHART_MONTHS);

  const [expenses, budget, history] = await Promise.all([
    loadMonthExpenses(supabase, userId, monthStart),
    isPremium ? loadEffectiveBudget(supabase, userId, monthStart) : Promise.resolve(null),
    loadMoneyRows(supabase, userId, `${chartMonths[0]}-01`, endOfMonthKey(monthStart)),
  ]);

  const totals = monthTotals(expenses, month);
  const previousMonth = chartMonths[CHART_MONTHS - 2];
  const comparison = compareMonths(
    history,
    month,
    previousMonth,
    month === currentMonth ? Number(today.slice(8)) : 31,
  );
  const bars: MonthBar[] = chartMonths.map((entry) => {
    const sums = monthTotals(history, entry);

    return {
      label: formatMonthLabel(`${entry}-01`).split(" ")[0].slice(0, 3),
      fullLabel: formatMonthLabel(`${entry}-01`),
      income: sums.income,
      expense: sums.expense,
    };
  });

  const byDay = new Map<string, DayGroup>();
  for (const expense of expenses) {
    const group = byDay.get(expense.date) ?? {
      date: expense.date,
      label:
        expense.date === today
          ? "Hari ini"
          : expense.date === addDays(today, -1)
            ? "Kemarin"
            : formatDayLabel(expense.date),
      net: 0,
      items: [],
    };

    group.net += expense.type === "income" ? expense.amount : -expense.amount;
    group.items.push({
      id: expense.id,
      type: expense.type,
      amount: expense.amount,
      category: expense.category,
      note: expense.note,
    });
    byDay.set(expense.date, group);
  }

  const nextMonth = addDays(endOfMonthKey(monthStart), 1).slice(0, 7);

  return (
    <main className="py-6 md:py-10">
      <ExpenseBoard
        monthLabel={formatMonthLabel(monthStart)}
        previousMonth={previousMonth}
        nextMonth={nextMonth <= currentMonth ? nextMonth : null}
        isCurrentMonth={month === currentMonth}
        income={totals.income}
        expense={totals.expense}
        comparison={comparison}
        bars={bars}
        budget={budget}
        isPremium={isPremium}
        groups={[...byDay.values()]}
        today={today}
      />
    </main>
  );
}
