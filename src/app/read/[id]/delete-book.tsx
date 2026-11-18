"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteBook } from "@/lib/books/actions";
import { forgetBook } from "@/lib/books/cache";

/**
 * Deleting a book and its file (READ-10; DESIGN.md §6 "Pembaca", like "Hapus
 * materi"): a small danger link at the bottom of the Aa panel, confirmed in
 * place. On the free plan the confirmation says the slot does not come back.
 */
export function DeleteBook({
  bookId,
  title,
  isFree,
  userId,
}: {
  bookId: string;
  title: string;
  isFree: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function remove() {
    setPending(true);
    setMessage(undefined);

    const result = await deleteBook({ bookId });

    if (!result.ok) {
      setPending(false);
      setMessage(result.message);
      return;
    }

    await forgetBook(userId, bookId);
    router.push("/learn");
  }

  if (!confirming) {
    return (
      <Button variant="link" onClick={() => setConfirming(true)} className="self-start text-sm text-danger">
        Hapus buku
      </Button>
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-4">
      <p className="text-base text-text">Hapus “{title}” beserta filenya? Ini tidak bisa dibatalkan.</p>
      {isFree ? (
        <p className="mt-2 text-sm text-text-muted">
          Paket gratis hanya bisa mengunggah 1 buku, jadi setelah dihapus kamu tidak bisa mengunggah buku baru.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={remove} disabled={pending} className="text-danger">
          {pending ? "Menghapus…" : "Ya, hapus"}
        </Button>
        <Button variant="link" onClick={() => setConfirming(false)} disabled={pending}>
          Batal
        </Button>
      </div>
      {message ? (
        <p role="alert" className="mt-3 text-base text-text">
          {message}
        </p>
      ) : null}
    </div>
  );
}
