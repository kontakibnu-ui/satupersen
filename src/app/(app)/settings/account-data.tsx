"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { forgetAllBooks } from "@/lib/books/cache";
import { callAction } from "@/lib/call-action";
import { forgetAllEntryDrafts } from "@/lib/entry-draft";
import { deleteAccount, signOut } from "./actions";

/**
 * The end of Akun (PRD.md §7, DESIGN.md §2, §14.3): signing out is a full
 * secondary button with its icon so it is easy to find, and "Hapus akun" is
 * the smallest thing on the page, set apart at the very bottom in the one
 * colour reserved for deleting data (DESIGN.md §3, §12). Deleting asks for a
 * typed word, because it cannot be undone.
 */
export function AccountData() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-8 flex flex-col items-stretch gap-4">
        {/* Book copies kept for Ruang baca (READ-9) and diary drafts not sent
            yet (lib/entry-draft.ts) go before the session does. */}
        <form
          action={async () => {
            await forgetAllBooks();
            forgetAllEntryDrafts();
            await signOut();
          }}
        >
          <Button type="submit" variant="secondary" className="w-full">
            <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
            Keluar
          </Button>
        </form>

        <Button variant="link" onClick={() => setOpen(true)} className="self-center px-2 text-sm text-danger">
          Hapus akun
        </Button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Hapus akun">
        <DeleteForm />
      </Sheet>
    </>
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
