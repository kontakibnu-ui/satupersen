"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { SectionHead } from "@/components/notebook";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { forgetAllBooks } from "@/lib/books/cache";
import { callAction } from "@/lib/call-action";
import { forgetAllEntryDrafts } from "@/lib/entry-draft";
import { deleteAccount } from "./actions";

/**
 * "Datamu" on Akun (PRD.md §7, DESIGN.md §2, §14.3): export is a plain link,
 * signing out sits in its own row, and "Hapus akun" is the smallest thing on
 * the page, at the very bottom, in the one colour reserved for deleting data
 * (DESIGN.md §3, §12). Deleting asks for a typed word, because it cannot be
 * undone. `signOut` is the form that signs out, passed in by the page.
 */
export function AccountData({ signOut }: { signOut: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="data-title">
      <SectionHead id="data-title" title="Datamu" />
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 border-b border-rule py-1.5">
        <span className="text-base text-text">Unduh semua datamu</span>
        <a
          href="/api/account/export"
          download
          className={buttonVariants({ variant: "link", className: "gap-2 text-sm font-semibold text-primary" })}
        >
          <Download aria-hidden="true" size={16} strokeWidth={1.8} />
          Export data (JSON)
        </a>
      </div>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 border-b border-rule py-1.5">
        <span className="text-base text-text">Keluar dari perangkat ini</span>
        {signOut}
      </div>

      <Button variant="link" onClick={() => setOpen(true)} className="mt-3 text-sm text-danger">
        Hapus akun
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Hapus akun">
        <DeleteForm />
      </Sheet>
    </section>
  );
}

function DeleteForm() {
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);

    // What this browser keeps for the account goes with it, as on sign out.
    // Same rule as the server's check, so a mistyped word keeps everything.
    if (confirmation.trim().toUpperCase() === "HAPUS") {
      await forgetAllBooks();
      forgetAllEntryDrafts();
    }

    // On success the server closes the session and redirects, so only a refusal comes back.
    const result = await callAction(() => deleteAccount({ confirmation }));

    setPending(false);
    setMessage(result.message);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
      <p className="text-base text-text">
        Semua tulisan, kebiasaan, pengeluaran, hasil analisa, laporan, dan nomor WhatsApp yang terhubung akan
        dihapus, dan tidak bisa dikembalikan. Kalau ingin menyimpannya, unduh datamu dulu.
      </p>

      <label className="block text-sm font-semibold text-text">
        Ketik HAPUS untuk memastikan
        <Input
          data-autofocus
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className="mt-1.5 font-normal"
        />
      </label>

      <p role="status" className="min-h-5 text-sm text-text-muted">
        {message}
      </p>

      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="w-full border-danger text-danger"
      >
        {pending ? "Menghapus…" : "Hapus akun saya"}
      </Button>
    </form>
  );
}
