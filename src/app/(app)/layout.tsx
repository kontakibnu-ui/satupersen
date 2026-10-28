import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Shell for every signed in page (DESIGN.md §5).
 *
 * - `min-h-dvh` and safe-area padding so nothing hides behind the phone's home
 *   indicator, and the content column stays at 680 px (Progres overrides this
 *   with its own 960 px container later).
 * - AUTH-2: without a session the user goes to /login.
 * - AUTH-4: without recorded consent the user goes to /onboarding first.
 *
 * The navigation only lists pages that exist: right now that is Akun alone, and
 * each new page adds its own item as it is built.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  if (!profile) {
    redirect("/onboarding");
  }

  if (!profile.consented_at) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-dvh md:pl-[72px] lg:pl-[240px]">
      <AppNav />

      <div className="mx-auto w-full max-w-[680px] px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-8">
        {children}
      </div>
    </div>
  );
}
