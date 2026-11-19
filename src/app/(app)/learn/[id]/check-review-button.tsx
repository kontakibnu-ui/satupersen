"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { checkReview } from "../actions";

/**
 * Asks for AI feedback on today's stored session when it has none yet, for
 * instance after a failed check (LEARN-4). The review itself is already saved.
 */
export function CheckReviewButton({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function run() {
    setPending(true);
    setMessage(undefined);

    const result = await callAction(() => checkReview(materialId));

    setPending(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-5">
      <Button variant="secondary" onClick={run} disabled={pending}>
        {pending ? "Memeriksa…" : "Periksa jawaban dengan AI"}
      </Button>
      <p aria-live="polite" className="mt-2 text-sm text-text-muted">
        {pending ? "Sedang memeriksa jawabanmu…" : message ?? "Umpan balik AI untuk review ini belum ada."}
      </p>
    </div>
  );
}
