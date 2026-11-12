import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk · Satu Persen",
};

/**
 * Only a path inside this app is a valid place to go after signing in: one slash
 * first, and not "//" or "/\" which a browser reads as another host.
 */
function safeNext(value: string | undefined): string {
  return value !== undefined && /^\/(?![/\\])/.test(value) ? value : "/today";
}

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
        signingUp
          ? "Pakai email dan password pilihanmu."
          : "Masuk dengan email dan passwordmu."
      }
    >
      <LoginForm mode={signingUp ? "daftar" : "masuk"} next={safeNext(next)} failed={status === "gagal"} />
    </AuthShell>
  );
}
