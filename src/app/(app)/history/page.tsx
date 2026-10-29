import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  endOfMonthKey,
  formatDayLabel,
  isDateKey,
  isValidTimeZone,
  startOfMonthKey,
  todayKey,
} from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MonthCalendar } from "./month-calendar";

export const metadata: Metadata = {
  title: "Riwayat · Satu Persen",
};

/**
 * DIARY-4: a calendar that marks the days with an entry, and a read-only view
 * of the chosen day. Only today can be written, and only on /today; saving is
 * refused on the server for any other day (src/app/(app)/today/actions.ts).
 *
 * The month and day come from the URL, so they are validated before use and
 * clamped to what exists: nothing after today, and the day must sit inside the
 * month on screen.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const params = await searchParams;
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
    throw new Error("Profil tidak bisa dibaca, jadi riwayat belum bisa ditampilkan");
  }

  const timeZone =
    profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "Asia/Jakarta";
  const today = todayKey(timeZone);

  const requestedMonth = params.month && isDateKey(`${params.month}-01`) ? params.month : null;
  const monthKey =
    requestedMonth && requestedMonth <= today.slice(0, 7) ? requestedMonth : today.slice(0, 7);
  const first = startOfMonthKey(`${monthKey}-01`);
  const last = endOfMonthKey(first);

  const requestedDay =
    params.day && isDateKey(params.day) && params.day.startsWith(monthKey) && params.day <= today
      ? params.day
      : null;
  const selected = requestedDay ?? (monthKey === today.slice(0, 7) ? today : null);

  const { data: monthEntries, error: monthError } = await supabase
    .from("entries")
    .select("date")
    .eq("user_id", userId)
    .gte("date", first)
    .lte("date", last)
    .neq("content", "");

  if (monthError) {
    throw new Error("Riwayat bulan ini tidak bisa dibaca");
  }

  const entryDays = new Set((monthEntries ?? []).map((row) => row.date as string));

  let selectedContent: string | null = null;

  if (selected && entryDays.has(selected)) {
    const { data: entry, error: entryError } = await supabase
      .from("entries")
      .select("content")
      .eq("user_id", userId)
      .eq("date", selected)
      .maybeSingle();

    if (entryError) {
      throw new Error("Entri tanggal ini tidak bisa dibaca");
    }

    selectedContent = entry?.content?.trim() ? entry.content : null;
  }

  const isToday = selected === today;

  return (
    <main className="py-8">
      <h1 className="font-serif text-title text-text">Riwayat</h1>

      <MonthCalendar monthKey={monthKey} today={today} selected={selected} entryDays={entryDays} />

      <section aria-live="polite" className="mt-8">
        {selected === null ? (
          <p className="text-base text-text-muted">
            {entryDays.size === 0 ? "Belum ada entri di bulan ini." : "Pilih tanggal yang bertitik untuk membaca entrinya."}
          </p>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-text">{formatDayLabel(selected)}</h2>

            {selectedContent ? (
              <p className="mt-2 whitespace-pre-line font-serif text-editor text-text">{selectedContent}</p>
            ) : (
              <p className="mt-2 text-base text-text-muted">
                {isToday ? "Belum ada entri. Mulai dari satu kalimat saja." : "Tidak ada entri di tanggal ini."}
              </p>
            )}

            {isToday ? (
              <Link href="/today" className={buttonVariants({ variant: "link", className: "mt-2" })}>
                {selectedContent ? "Lanjut menulis di Hari Ini" : "Mulai menulis"}
              </Link>
            ) : selectedContent ? (
              <p className="mt-3 text-sm text-text-muted">Entri hari lampau hanya bisa dibaca.</p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
