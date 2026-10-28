import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Sebelum mulai · Satu Persen",
};

/**
 * AUTH-4: one screen, the disclaimer, and two checkboxes that cannot be
 * skipped. Nothing else is asked here, because the user is one step away from
 * writing their first entry.
 */
export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("consented_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  if (profile?.consented_at) {
    redirect("/settings");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col justify-center px-4 py-12">
      <h1 className="font-serif text-title text-text">Sebelum mulai</h1>

      <p className="mt-3 text-base text-text">
        Satu Persen bukan pengganti terapi atau tenaga profesional. Kalau kamu sedang dalam
        situasi berat, ceritakan pada orang yang kamu percaya atau cari bantuan profesional.
      </p>

      <OnboardingForm />
    </main>
  );
}
