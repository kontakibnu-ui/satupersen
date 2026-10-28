"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

/**
 * Two ways in, both from AUTH-1. Status is written where the action happens,
 * never in a toast (DESIGN.md §6), and error sentences say what happened and
 * what to do next without blaming the user (DESIGN.md §11).
 */
export function LoginForm({ failed }: { failed: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(
    failed ? { kind: "error", message: "Tautan masuknya tidak berlaku lagi. Coba kirim ulang." } : { kind: "idle" },
  );
  const [busy, setBusy] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

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

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();

    if (trimmed === "") {
      setStatus({ kind: "error", message: "Isi alamat emailmu dulu." });
      return;
    }

    setBusy(true);
    setStatus({ kind: "sending", message: "Mengirim tautan…" });

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: callbackUrl() },
    });

    setBusy(false);

    if (error) {
      setStatus({ kind: "error", message: "Tautan gagal dikirim. Periksa alamat emailnya, lalu coba lagi." });
      return;
    }

    setStatus({ kind: "sent", message: `Tautan sudah dikirim ke ${trimmed}. Buka di perangkat ini.` });
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="h-11 w-full rounded-md bg-primary text-base font-normal text-primary-foreground disabled:opacity-60"
      >
        Masuk dengan Google
      </button>

      <p className="mt-6 text-sm text-text-muted">atau lewat email</p>

      <form onSubmit={sendMagicLink} className="mt-2">
        <label htmlFor="email" className="block text-sm text-text-muted">
          Alamat email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 h-11 w-full rounded-md border border-control bg-surface px-3 text-base text-text"
        />

        <button
          type="submit"
          disabled={busy}
          className="mt-3 h-11 w-full rounded-md border border-control text-base text-text disabled:opacity-60"
        >
          Kirim tautan masuk
        </button>
      </form>

      {status.message ? (
        <p
          role="status"
          className="mt-4 text-sm text-text-muted"
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
