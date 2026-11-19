import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Selamat datang · Satu Persen",
};

/**
 * AUTH-4: one screen with one button; pressing it records the privacy consent
 * (the sentence under it links the policy). Nothing else is asked here,
 * because the user is one step away from writing their first entry.
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
    <AuthShell title="Selamat datang" description="Satu kalimat sehari sudah cukup untuk mulai.">
      <OnboardingForm />
    </AuthShell>
  );
}
