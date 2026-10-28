"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseActionClient } from "@/lib/supabase/server";

/**
 * AUTH-4: both statements are required before the app can be used, and the
 * consent is stored with a timestamp. The time zone comes from the browser and
 * is only accepted when it looks like a real IANA name (AUTH-3).
 */

const timezonePattern = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/;

const onboardingSchema = z.object({
  privacy: z.literal("set"),
  age: z.literal("set"),
  timezone: z.string().trim().max(60).optional(),
});

export type OnboardingResult = { ok: boolean; message: string };

export async function completeOnboarding(formData: FormData): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse({
    privacy: formData.get("privacy"),
    age: formData.get("age"),
    timezone: formData.get("timezone") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Dua pernyataan di bawah harus dicentang dulu sebelum kamu bisa masuk.",
    };
  }

  const supabase = await createSupabaseActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Masuk lagi dulu." };
  }

  const detected = parsed.data.timezone ?? "";
  const timezone = timezonePattern.test(detected) ? detected : null;

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
