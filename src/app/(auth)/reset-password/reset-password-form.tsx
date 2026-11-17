"use client";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIN_NEW_PASSWORD } from "@/lib/passwords";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = { kind: "idle" | "saving" | "saved" | "error" | "expired"; message?: string };

/** What happened and what to do next, without blaming the user (DESIGN.md §11). Codes from Supabase Auth. */
function describeError(code: string | undefined): string {
  switch (code) {
    case "same_password":
      return "Password baru harus berbeda dari password lama.";
    case "weak_password":
      return "Passwordnya terlalu mudah ditebak. Coba yang lebih panjang atau lebih beragam.";
    case "over_request_rate_limit":
      return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
    default:
      return "Password baru belum bisa disimpan. Coba lagi sebentar lagi.";
  }
}

/**
 * Step two of a forgotten password (AUTH-5): the reset link has already been
 * exchanged for a session by /auth/callback, so the new password is saved on
 * that session and the user goes straight into the app.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < MIN_NEW_PASSWORD) {
      setStatus({ kind: "error", message: `Password minimal ${MIN_NEW_PASSWORD} karakter.` });
      return;
    }

    setStatus({ kind: "saving", message: "Menyimpan…" });

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      if (isAuthSessionMissingError(error) || error.code === "session_not_found" || error.code === "session_expired") {
        setStatus({
          kind: "expired",
          message: "Waktu untuk membuat password baru sudah habis. Minta tautan baru, lalu buka di browser ini.",
        });
        return;
      }

      setStatus({ kind: "error", message: describeError(error.code) });
      return;
    }

    setStatus({ kind: "saved", message: "Password baru tersimpan. Membuka aplikasimu…" });
    router.replace("/today");
    router.refresh();
  }

  const busy = status.kind === "saving" || status.kind === "saved";

  return (
    <div className="mt-8">
      <form onSubmit={submit}>
        <label htmlFor="password" className="block text-sm font-medium text-text-muted">
          Password baru
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-rule"
          className="mt-1"
        />
        <p id="password-rule" className="mt-2 text-sm text-text-muted">
          Minimal {MIN_NEW_PASSWORD} karakter.
        </p>

        <Button type="submit" disabled={busy} className="mt-4 w-full">
          Simpan password baru
        </Button>
      </form>

      {status.message ? (
        <p role="status" className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text">
          {status.message}
        </p>
      ) : null}

      {status.kind === "expired" ? (
        <div className="mt-2 flex justify-center">
          <Link href="/forgot-password" className={buttonVariants({ variant: "link" })}>
            Minta tautan baru
          </Link>
        </div>
      ) : null}
    </div>
  );
}
