import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Akun · Satu Persen",
};

/**
 * The first page inside the (app) group, so it is also what the login flow
 * lands on. DESIGN.md §2 keeps this screen calm: no focus element, no primary
 * button, everything neutral.
 */
export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, timezone, plan")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  return (
    <main className="py-8">
      <h1 className="font-serif text-title text-text">Akun</h1>

      <SettingsForm
        name={profile?.name ?? ""}
        timezone={profile?.timezone ?? "Asia/Jakarta"}
        plan={profile?.plan ?? "free"}
        email={claims?.claims?.email ?? ""}
      />
    </main>
  );
}
