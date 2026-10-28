"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * Server Actions for the Akun page. Every value that comes back from the
 * browser is validated here, and the row that gets updated is chosen from the
 * session, never from the form (PRD.md §7, AGENTS.md §6).
 */

const profileInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().trim().min(1).max(60),
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

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Keluar dari akun gagal, coba lagi sebentar lagi");
  }

  redirect("/login");
}
