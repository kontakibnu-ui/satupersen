import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { isValidTimeZone } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profil · Satu Persen",
};

/** How the user signs in, from the providers Supabase Auth puts in the session. */
const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  email: "email dan password",
};

/**
 * Profil (DESIGN.md §14.3 "Akun"): opened from the profile card and the time
 * zone row of Akun. Who is signed in and how, then the form for name and time
 * zone (AUTH-3). The email is read from the session and cannot be changed here.
 */
export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    throw new Error("Halaman ini butuh sesi yang masih berlaku");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Profil tidak bisa dibaca, jadi halaman ini belum bisa ditampilkan");
  }

  const email = claims?.claims?.email ?? "";
  const name = (profile?.name as string | null) ?? "";
  // The same letter as the profile circle in the header (app layout).
  const initial = (name.trim()[0] ?? email.trim()[0] ?? "S").toUpperCase();
  const savedZone = profile?.timezone ?? "Asia/Jakarta";
  const timezone = isValidTimeZone(savedZone) ? savedZone : "Asia/Jakarta";

  const providers = claims?.claims?.app_metadata?.providers;
  const methods = (Array.isArray(providers) ? providers : [])
    .map((provider) => PROVIDER_NAMES[String(provider)])
    .filter((method): method is string => Boolean(method));

  return (
    <main className="py-6 md:py-10">
      <PageHeader
        eyebrow={
          <Link href="/settings" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
            Akun
          </Link>
        }
        title="Profil"
        description="Nama dan zona waktumu."
      />

      <div className="mt-6 flex items-center gap-4">
        <span
          aria-hidden="true"
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base text-text">{email}</p>
          {methods.length > 0 ? (
            <p className="text-sm text-text-muted">Masuk dengan {methods.join(" atau ")}</p>
          ) : null}
        </div>
      </div>

      <ProfileForm name={name} timezone={timezone} />
    </main>
  );
}
