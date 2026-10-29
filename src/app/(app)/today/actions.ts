"use server";

import { z } from "zod";
import { todayKey } from "@/lib/dates";
import { MAX_CONTENT_LENGTH } from "@/lib/entries";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * Saving one day of the diary (DIARY-2, DIARY-3, DIARY-4).
 *
 * The limit is enforced here as well as in the editor, because a client can be
 * edited: 5000 characters is the rule, not a suggestion. One row per
 * (user_id, date), so saving again updates instead of inserting a second row.
 *
 * Only today, by the profile's time zone, can be written. The screen sends the
 * date it was opened for, and a tab left open past midnight must not quietly
 * pour last night's text into the new day, so a mismatch is refused with a
 * clear message instead of being redirected.
 */

const entryInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().max(MAX_CONTENT_LENGTH, `Tulisan maksimal ${MAX_CONTENT_LENGTH} karakter`),
});

/** `retryable: false` tells the editor that saving again cannot help. */
export type SaveEntryResult = { ok: boolean; message?: string; retryable?: boolean };

export async function saveEntry(input: { date: string; content: string }): Promise<SaveEntryResult> {
  const parsed = entryInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Tulisan belum bisa disimpan.",
      retryable: false,
    };
  }

  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, message: "Tulisan belum tersimpan. Coba lagi." };
  }

  if (parsed.data.date !== todayKey(profile.timezone)) {
    return {
      ok: false,
      message: "Hari sudah berganti. Muat ulang halaman ini untuk menulis hari ini.",
      retryable: false,
    };
  }

  const { error } = await supabase
    .from("entries")
    .upsert(
      { user_id: userId, date: parsed.data.date, content: parsed.data.content },
      { onConflict: "user_id,date" },
    );

  if (error) {
    return { ok: false, message: "Tulisan belum tersimpan. Coba lagi." };
  }

  return { ok: true };
}
