"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIN_NEW_PASSWORD } from "@/lib/passwords";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type LoginMode = "masuk" | "daftar";

type Status = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

/**
 * Says what happened and what to do next, without blaming the user (DESIGN.md §11).
 * The codes are the ones Supabase Auth returns in `error.code`.
 */
function describeError(code: string | undefined, mode: LoginMode): string {
  switch (code) {
    case "invalid_credentials":
      return "Email atau passwordnya belum cocok. Coba lagi, atau daftar kalau kamu belum punya akun.";
    case "email_not_confirmed":
      return "Emailmu belum dikonfirmasi. Buka email konfirmasi yang kami kirim, lalu coba masuk lagi.";
    case "user_already_exists":
    case "email_exists":
      return "Email ini sudah terdaftar. Coba masuk dengan email itu.";
    case "weak_password":
      return "Passwordnya terlalu mudah ditebak. Coba yang lebih panjang atau lebih beragam.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
    case "signup_disabled":
      return "Pendaftaran sedang ditutup. Coba lagi nanti.";
    default:
      return mode === "daftar"
        ? "Akunmu belum bisa dibuat. Coba lagi sebentar lagi."
        : "Belum bisa masuk. Coba lagi sebentar lagi.";
  }
}

/**
 * Two ways in (AUTH-1): email and password, and Google. Signing up and signing
 * in are the same form in two modes, chosen by the page so the heading matches.
 * Status is written where the action happens, never in a toast (DESIGN.md §6).
 */
export function LoginForm({
  mode,
  next,
  failed,
}: {
  mode: LoginMode;
  next: string;
  failed: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>(
    failed ? { kind: "error", message: "Masuknya belum berhasil. Coba lagi." } : { kind: "idle" },
  );
  const [busy, setBusy] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const otherModeHref = () => {
    const query = new URLSearchParams();

    if (mode === "masuk") {
      query.set("mode", "daftar");
    }

    if (next !== "/today") {
      query.set("next", next);
    }

    const text = query.toString();

    return text === "" ? "/login" : `/login?${text}`;
  };

  async function signInWithGoogle() {
    setBusy(true);
    setStatus({ kind: "sending", message: "Membuka halaman Google…" });

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });

    if (error) {
      setBusy(false);
      setStatus({ kind: "error", message: "Google sedang tidak bisa dihubungi. Coba lagi sebentar lagi." });
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();

    if (trimmed === "") {
      setStatus({ kind: "error", message: "Isi alamat emailmu dulu." });
      return;
    }

    if (password === "") {
      setStatus({ kind: "error", message: "Isi passwordmu dulu." });
      return;
    }

    if (mode === "daftar" && password.length < MIN_NEW_PASSWORD) {
      setStatus({ kind: "error", message: `Password minimal ${MIN_NEW_PASSWORD} karakter.` });
      return;
    }

    setBusy(true);
    setStatus({ kind: "sending", message: mode === "daftar" ? "Membuat akunmu…" : "Memeriksa…" });

    const supabase = createSupabaseBrowserClient();

    if (mode === "masuk") {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });

      if (error) {
        setBusy(false);
        setStatus({ kind: "error", message: describeError(error.code, mode) });
        return;
      }

      router.replace(next);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });

    if (error) {
      setBusy(false);
      setStatus({ kind: "error", message: describeError(error.code, mode) });
      return;
    }

    // With email confirmation off, signing up already signs the user in.
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }

    setBusy(false);
    setStatus({
      kind: "sent",
      // Supabase answers the same way for an email that already has an account (so nobody can
      // probe which emails are registered), hence the second sentence.
      message: `Kalau ${trimmed} belum terdaftar, kami kirim email konfirmasi ke sana. Buka tautannya, lalu masuk. Kalau kamu sudah punya akun, langsung masuk saja.`,
    });
  }

  // DESIGN.md §15.6: Google first, since one tap is quicker than typing an
  // email and a password; then the email form with the one primary button.
  return (
    <div className="mt-8">
      <Button variant="secondary" onClick={signInWithGoogle} disabled={busy} className="w-full">
        <GoogleMark />
        Masuk dengan Google
      </Button>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-rule" />
        <span className="text-sm text-text-muted">atau dengan email</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form onSubmit={submit}>
        <label htmlFor="email" className="block text-sm font-medium text-text-muted">
          Alamat email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nama@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1"
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium text-text-muted">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "daftar" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1"
        />
        {mode === "daftar" ? (
          <p className="mt-2 text-sm text-text-muted">Minimal {MIN_NEW_PASSWORD} karakter.</p>
        ) : (
          // Without it an account made with email and password has no way back once the password is gone (AUTH-5).
          <div className="flex justify-end">
            <Link href="/forgot-password" className={buttonVariants({ variant: "link", className: "text-sm" })}>
              Lupa password?
            </Link>
          </div>
        )}

        <Button type="submit" disabled={busy} className="mt-4 w-full">
          {mode === "daftar" ? "Daftar" : "Masuk"}
        </Button>
      </form>

      {status.message ? (
        <p role="status" className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text">
          {status.message}
        </p>
      ) : null}

      <div className="mt-2 flex justify-center">
        <Link href={otherModeHref()} className={buttonVariants({ variant: "link" })}>
          {mode === "daftar" ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
        </Link>
      </div>

    </div>
  );
}

/** The Google "G", drawn in the text colour so no brand hex lives in a component (DESIGN.md §3). */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
      <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
    </svg>
  );
}
