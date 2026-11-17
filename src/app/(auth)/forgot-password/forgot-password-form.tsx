"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

/** What happened and what to do next, without blaming the user (DESIGN.md §11). Codes from Supabase Auth. */
function describeError(code: string | undefined): string {
  switch (code) {
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Terlalu banyak permintaan. Tunggu beberapa menit, lalu coba lagi.";
    case "email_address_invalid":
      return "Alamat emailnya belum benar. Periksa lagi, lalu kirim ulang.";
    case "email_address_not_authorized":
      return "Email ke alamat ini belum bisa dikirim. Coba lagi nanti, atau masuk dengan Google kalau akunmu memakainya.";
    default:
      return "Tautannya belum bisa dikirim. Coba lagi sebentar lagi.";
  }
}

/**
 * Step one of a forgotten password (AUTH-5): ask Supabase to email a reset link.
 * The link comes back through /auth/callback, which exchanges its code for a
 * session and opens /reset-password. The code is tied to this browser (PKCE),
 * so the message says to open the link here.
 *
 * Supabase answers the same way whether or not the email has an account, so
 * nobody can use this form to find out who is registered; the message says so.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();

    if (trimmed === "") {
      setStatus({ kind: "error", message: "Isi alamat emailmu dulu." });
      return;
    }

    setStatus({ kind: "sending", message: "Mengirim tautan…" });

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });

    if (error) {
      setStatus({ kind: "error", message: describeError(error.code) });
      return;
    }

    setStatus({
      kind: "sent",
      message: `Kalau ${trimmed} terdaftar, kami sudah mengirim tautan untuk membuat password baru. Buka tautannya di browser ini. Tidak ada di kotak masuk? Cek folder spam.`,
    });
  }

  return (
    <div className="mt-8">
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

        <Button type="submit" disabled={status.kind === "sending"} className="mt-4 w-full">
          {status.kind === "sent" ? "Kirim ulang tautan" : "Kirim tautan"}
        </Button>
      </form>

      {status.message ? (
        <p role="status" className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text">
          {status.message}
        </p>
      ) : null}

      <div className="mt-2 flex justify-center">
        <Link href="/login" className={buttonVariants({ variant: "link" })}>
          Kembali ke halaman masuk
        </Link>
      </div>
    </div>
  );
}
