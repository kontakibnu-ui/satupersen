"use server";

import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "@/lib/entries";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * Saving one day of the diary (DIARY-2, DIARY-3).
 *
 * The limit is enforced here as well as in the editor, because a client can be
 * edited: 5000 characters is the rule, not a suggestion. One row per
 * (user_id, date), so saving again updates instead of inserting a second row.
 */

const entryInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().max(MAX_CONTENT_LENGTH, `Tulisan maksimal ${MAX_CONTENT_LENGTH} karakter`),
});

export type SaveEntryResult = { ok: boolean; message?: string };

export async function saveEntry(input: { date: string; content: string }): Promise<SaveEntryResult> {
  const parsed = entryInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Tulisan belum bisa disimpan.",
    };
  }

  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
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
