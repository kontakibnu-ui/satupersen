"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { removeBookFiles } from "@/lib/books/sweep";
import { isValidTimeZone } from "@/lib/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * Server Actions for the Akun page. Every value that comes back from the
 * browser is validated here, and the row that gets updated is chosen from the
 * session, never from the form (PRD.md §7, AGENTS.md §6).
 */

const profileInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // An unknown zone would break every "today" on the next page load, and an
  // edited form can send anything, so the zone must be one the runtime knows.
  timezone: z.string().trim().max(60).refine(isValidTimeZone),
});

export type ProfileActionResult = { ok: boolean; message: string };

export async function updateProfile(formData: FormData): Promise<ProfileActionResult> {
  const parsed = profileInputSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Nama tidak boleh kosong dan timezone harus dipilih." };
  }

  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);

  if (error) {
    return { ok: false, message: "Perubahan belum tersimpan. Coba lagi sebentar lagi." };
  }

  revalidatePath("/settings");

  return { ok: true, message: "Tersimpan." };
}

/**
 * Switches only the time zone, for the banner that offers the device's zone
 * (AUTH-3). The user confirms it; nothing here runs without a tap.
 */
export async function updateTimezone(input: { timezone: string }): Promise<ProfileActionResult> {
  const parsed = profileInputSchema.shape.timezone.safeParse(input?.timezone);

  if (!parsed.success) {
    return { ok: false, message: "Timezone dari perangkatmu tidak dikenali." };
  }

  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  const { error } = await supabase.from("profiles").update({ timezone: parsed.data }).eq("id", userId);

  if (error) {
    return { ok: false, message: "Timezone belum berubah. Coba lagi sebentar lagi." };
  }

  revalidatePath("/", "layout");

  return { ok: true, message: "Tersimpan." };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Keluar dari akun gagal, coba lagi sebentar lagi");
  }

  redirect("/login");
}

export type DeleteAccountResult = { ok: false; message: string };

/** The word the user types to confirm; anything else leaves the account alone. */
const DELETE_CONFIRMATION = "HAPUS";

/**
 * Deletes the account and everything stored for it (PRD.md §7: for every plan,
 * with no condition). Removing the user in Supabase Auth cascades through every
 * table, because each one references `auth.users` with ON DELETE CASCADE, so
 * the diary, habits, expenses, summaries, reports, WhatsApp link and messages
 * go together. The user is read from the session, never from the request.
 *
 * Only a failure is returned: on success the session is closed and the user is
 * sent to the front page.
 */
export async function deleteAccount(input: { confirmation: string }): Promise<DeleteAccountResult> {
  if (typeof input?.confirmation !== "string" || input.confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) {
    return { ok: false, message: `Ketik ${DELETE_CONFIRMATION} untuk memastikan.` };
  }

  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  const admin = createSupabaseAdminClient();

  // Book files live in Storage, which the cascade does not reach (READ-10).
  // They go first; if they cannot, the account stays, so nothing is left behind.
  if (!(await removeBookFiles(admin, userId))) {
    return { ok: false, message: "Akun belum bisa dihapus. Coba lagi sebentar lagi." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("deleting an account failed", { userId });

    return { ok: false, message: "Akun belum bisa dihapus. Coba lagi sebentar lagi." };
  }

  // The user is gone, so closing the session may find nothing to revoke; the
  // cookies are cleared either way, and a failure here changes nothing for them.
  const { error: signOutError } = await supabase.auth.signOut();

  if (signOutError) {
    console.error("closing the session after deleting an account failed", { kind: signOutError.name });
  }

  redirect("/");
}
