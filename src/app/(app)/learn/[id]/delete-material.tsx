"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteMaterial } from "../actions";

/**
 * Deleting one material with its questions and reviews (LEARN-8; DESIGN.md §6
 * "Hapus materi"): a small danger link, confirmed in place. On the free plan the
 * confirmation says plainly that the slot does not come back (LEARN-5).
 */
export function DeleteMaterial({ materialId, title, isFree }: { materialId: string; title: string; isFree: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function remove() {
    setPending(true);
    setMessage(undefined);

    const result = await deleteMaterial(materialId);

    if (!result.ok) {
      setPending(false);
      setMessage(result.message);
      return;
    }

    router.push("/learn");
  }

  if (!confirming) {
    return (
      <Button variant="link" onClick={() => setConfirming(true)} className="mt-8 text-sm text-danger">
        Hapus materi
      </Button>
    );
  }

  return (
    <div className="mt-8 rounded-3xl border border-border bg-surface p-5 md:p-6">
      <p className="text-base text-text">
        Hapus “{title}” beserta pertanyaan dan riwayat reviewnya? Ini tidak bisa dibatalkan.
      </p>
      {isFree ? (
        <p className="mt-2 text-sm text-text-muted">
          Paket gratis hanya bisa membuat 1 materi, jadi setelah dihapus kamu tidak bisa menambah materi baru.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
