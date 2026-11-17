import { redirect } from "next/navigation";
import { AppHeader, AppNav } from "@/components/app-nav";
import { isValidTimeZone, todayKey } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TimezoneNotice } from "./timezone-notice";

/**
 * Shell for every signed in page (DESIGN.md §5, version 3).
 *
 * - The header carries the brand, the day and night switch, and the profile
 *   circle at the top right; the bottom bar holds the pages below 1024 px.
 * - `min-h-dvh` and safe-area padding so nothing hides behind the phone's notch
 *   or home indicator, and the content column stays at 640 px. A page that
 *   holds `data-wide` (Progres) gets the 960 px column instead.
 * - AUTH-2: without a session the user goes to /login.
 * - AUTH-4: without recorded consent the user goes to /onboarding first.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("consented_at, name, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  if (!profile) {
    redirect("/onboarding");
  }

  if (!profile.consented_at) {
    redirect("/onboarding");
  }

  // The profile circle shows the first letter of the name, or of the email
  // when no name is set yet.
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : "";
  const initial = ((profile.name as string | null)?.trim()[0] ?? email.trim()[0] ?? "S").toUpperCase();
  const timeZone = isValidTimeZone(profile.timezone as string) ? (profile.timezone as string) : "Asia/Jakarta";

  // LEARN-9: a dot on Belajar while a review question is due on the user's day.
  // Only a count is read. If it cannot be read the dot is left off: the pages
  // themselves still show what is due.
  const { count: dueCount, error: dueError } = await supabase
    .from("study_questions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("due_date", todayKey(timeZone));

  if (dueError) {
    console.error("counting due study questions failed", { userId });
  }

  const learnDue = !dueError && (dueCount ?? 0) > 0;

  return (
    <div className="min-h-dvh">
      <AppHeader initial={initial} learnDue={learnDue} />

      <div className="mx-auto w-full max-w-[640px] px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] has-[[data-wide]]:max-w-[960px] md:px-6 lg:pb-16">
        <TimezoneNotice savedZone={timeZone} />
        {children}
      </div>

      <AppNav learnDue={learnDue} />
    </div>
  );
}
