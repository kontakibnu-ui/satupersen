"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * The short-form container of DESIGN.md §6: a bottom sheet on phones and a
 * centred dialog from 768 px up. It is the native <dialog> element opened with
 * showModal(), so the browser supplies the focus trap, the Escape key, and the
 * inert page behind it. Only an overlay may carry a shadow (DESIGN.md §12).
 *
 * The children are mounted only while it is open, so a form inside starts empty
 * every time. Mark the field that should take focus with `data-autofocus`.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] border-0 bg-surface p-0 text-text shadow-float backdrop:bg-black/40 backdrop:backdrop-blur-sm md:m-auto md:max-w-[480px] md:rounded-[28px]"
    >
      {open ? (
        <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:px-6 md:pt-5">
          <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-border md:hidden" />
          <div className="flex items-center justify-between gap-4">
            <h2 id={titleId} className="font-serif text-xl font-medium text-text">
              {title}
            </h2>
            <Button variant="link" onClick={onClose}>
              Tutup
            </Button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
