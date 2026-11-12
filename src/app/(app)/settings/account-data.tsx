"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { deleteAccount } from "./actions";

/**
 * Export and deletion (PRD.md §7, DESIGN.md §2): "Export data" is a plain link,
 * and "Hapus akun" is the smallest thing on the page, at the very bottom, in the
 * one colour reserved for deleting data (DESIGN.md §3, §12). Deleting asks for a
 * typed word, because it cannot be undone.
 */
export function AccountData() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-start gap-1">
      <a
        href="/api/account/export"
        download
        className={buttonVariants({ variant: "link", className: "gap-2" })}
      >
        <Download aria-hidden="true" size={20} strokeWidth={1.5} />
        Unduh semua datamu (JSON)
      </a>

      <Button variant="link" onClick={() => setOpen(true)} className="text-sm text-danger">
        Hapus akun
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Hapus akun">
        <DeleteForm />
      </Sheet>
    </div>
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

    // On success the server closes the session and redirects, so only a refusal comes back.
    const result = await deleteAccount({ confirmation });

    setPending(false);
    setMessage(result.message);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
      <p className="text-base text-text">
        Semua tulisan, kebiasaan, pengeluaran, hasil analisa, laporan, dan nomor WhatsApp yang terhubung akan
        dihapus, dan tidak bisa dikembalikan. Kalau ingin menyimpannya, unduh datamu dulu.
      </p>

      <label className="block text-sm text-text-muted">
        Ketik HAPUS untuk memastikan
        <Input
          data-autofocus
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className="mt-1"
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
