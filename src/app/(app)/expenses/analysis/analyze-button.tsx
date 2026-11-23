"use client";

import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { analyzeMoney } from "./actions";

/**
 * Asks for the month's analysis (PRD.md EXP-10): the primary "Analisa bulan
 * ini" when there is none yet, or the secondary "Perbarui analisa" under an
 * existing one. The action revalidates the screen, so a success needs no more
 * than clearing the busy state; a refusal is said in a plain sentence below.
 */
export function AnalyzeButton({
  month,
  kind,
  label,
  refreshedToday = false,
}: {
  month: string;
  kind: "create" | "refresh";
  label: string;
  /** True when this month's analysis was already written today (one refresh per day). */
  refreshedToday?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const busy = useRef(false);

  async function run() {
    if (busy.current) {
      return;
    }

    busy.current = true;
    setPending(true);
    setMessage(undefined);

    const result = await callAction(() => analyzeMoney({ month }));

    busy.current = false;
    setPending(false);

    if (!result.ok) {
      setMessage(result.message);
    }
  }

  const disabled = pending || refreshedToday;

  return (
    <div className="flex w-full flex-col">
      <Button
        variant={kind === "create" ? "primary" : "secondary"}
        onClick={() => void run()}
        disabled={disabled}
        className="w-full"
      >
        {kind === "refresh" ? <RefreshCw aria-hidden="true" size={18} strokeWidth={2} /> : null}
        {pending ? "Menganalisa…" : refreshedToday ? "Bisa diperbarui lagi besok" : label}
      </Button>
      <p role="status" className="mt-2 min-h-5 text-center text-sm text-text-muted">
        {message}
      </p>
    </div>
  );
}
