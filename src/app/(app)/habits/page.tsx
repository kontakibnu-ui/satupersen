import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { formatDayLabel, isValidTimeZone, todayKey } from "@/lib/dates";
import { FREE_HABIT_LIMIT, loadActiveHabits } from "@/lib/habits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HabitManager } from "./habit-manager";

export const metadata: Metadata = {
  title: "Kebiasaan · Satu Persen",
};

/**
 * HABIT-1 and HABIT-2: the habits for today, with the streaks. The checklist is
 * the focus of this screen (DESIGN.md §2). Reading uses the user's session, so
 * row level security keeps every other user's habits out.
 */
export default async function HabitsPage() {
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
  const date = todayKey(timeZone);
  const habits = await loadActiveHabits(supabase, userId, date);

  // A new key hands the manager fresh habits after one is added, renamed, or archived.
  const habitsKey = habits.map((habit) => `${habit.id}:${habit.name}:${habit.identity ?? ""}`).join("|");

  return (
    <main className="py-6 md:py-10">
      <PageHeader eyebrow={formatDayLabel(date)} title="Kebiasaan" description="Kecil, tapi setiap hari. Bolos sehari tidak memutus streak." />

      <HabitManager
        key={habitsKey}
        date={date}
        habits={habits}
        atFreeLimit={profile?.plan !== "premium" && habits.length >= FREE_HABIT_LIMIT}
      />
    </main>
  );
}
