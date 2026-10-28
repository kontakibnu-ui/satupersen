import type { Metadata } from "next";
import { formatDayLabel, todayKey } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EntryEditor } from "./entry-editor";

export const metadata: Metadata = {
  title: "Hari Ini · Satu Persen",
};

/**
 * DIARY-1: the editor for today, where "today" is the user's own calendar day
 * according to the time zone in their profile, never the server's day.
 *
 * Mood, energy, and the habit list also live on this screen in DESIGN.md §8,
 * but they arrive with their own tasks (3.3 and 3.2) rather than being faked
 * here.
 */
export default async function TodayPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const timeZone = profile?.timezone ?? "Asia/Jakarta";
  const date = todayKey(timeZone);

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("content")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (entryError) {
    throw new Error("Catatan hari ini tidak bisa dibaca");
  }

  return (
    <main className="py-8">
      <p className="text-sm text-text-muted">{formatDayLabel(date)}</p>
      <h1 className="mt-1 font-serif text-title text-text">Gimana harimu?</h1>

      <EntryEditor date={date} initialContent={entry?.content ?? ""} />
    </main>
  );
}
