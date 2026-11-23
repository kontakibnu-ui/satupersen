import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { safeNextPath } from "@/lib/redirects";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "Masuk · Satu Persen",
};

/**
 * One screen, one focus (DESIGN.md §2): the way in. Nothing else is competing
 * for attention, and there is a single primary button.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mode?: string; next?: string }>;
}) {
  const { status, mode, next } = await searchParams;
  const signingUp = mode === "daftar";

  return (
    <AuthShell
      title={signingUp ? "Buat akun Satu Persen" : "Masuk ke Satu Persen"}
      description={
        signingUp ? "Mulai catatan harianmu, gratis." : "Lanjutkan catatan harianmu."
      }
    >
      <LoginForm mode={signingUp ? "daftar" : "masuk"} next={safeNextPath(next)} failed={status === "gagal"} />
    </AuthShell>
  );
}
