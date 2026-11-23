import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "Password baru · Satu Persen",
};

/**
 * Where the reset link lands after /auth/callback (AUTH-5). With a session the
 * user sets the new password; without one (the link expired, was used already,
 * or was opened in another browser) the page says so and offers a new link,
 * instead of a login form that would not help.
 */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    return (
      <AuthShell
        title="Tautannya sudah tidak berlaku"
        description="Tautan untuk membuat password baru hanya bisa dipakai sekali, ada batas waktunya, dan harus dibuka di browser tempat kamu memintanya."
      >
        <div className="mt-8">
          <Link href="/forgot-password" className={buttonVariants({ variant: "primary", className: "w-full" })}>
            Minta tautan baru
          </Link>
          <div className="mt-2 flex justify-center">
            <Link href="/login" className={buttonVariants({ variant: "link" })}>
              Kembali ke halaman masuk
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Buat password baru" description="Setelah disimpan, kamu langsung masuk dengan password ini.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
