"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * AUTH-4: the privacy consent is required before the app can be used, and it
 * is stored with a timestamp. Since the user's decision of 2026-11-19 it is
 * given by pressing "Mulai" under a sentence that links the privacy policy, so
 * submitting this form is the consent. The time zone comes from the browser
 * and is only accepted when the runtime knows it (AUTH-3); otherwise the
 * database default, Asia/Jakarta, stays.
 */

const onboardingSchema = z.object({
  timezone: z.string().trim().max(60).optional(),
});

export type OnboardingResult = { ok: boolean; message: string };

export async function completeOnboarding(formData: FormData): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse({
    timezone: formData.get("timezone") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: "Ada yang tidak beres saat menyiapkan akunmu. Muat ulang halaman, lalu coba lagi." };
  }

  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  const detected = parsed.data.timezone ?? "";
  const timezone = isValidTimeZone(detected) ? detected : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      consented_at: new Date().toISOString(),
      ...(timezone ? { timezone } : {}),
    })
    .eq("id", userId);

  if (error) {
    return { ok: false, message: "Persetujuan belum tersimpan. Coba lagi sebentar lagi." };
  }

  redirect("/today");
}
