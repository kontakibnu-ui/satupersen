"use client";

import { cn } from "@/lib/utils";

/**
 * A button that opens the phone's file picker: pictures for "Dari screenshot
 * bank" (EXP-7), statements for "Dari e-statement" (EXP-9). A label around the
 * file input rather than input.click() from code: the tap itself opens the
 * picker, which also works from inside the modal sheet, where the page behind
 * is inert. The input stays focusable, so the keyboard reaches it and the ring
 * shows on the label.
 */
export function FilePicker({
  accept,
  onPick,
  className,
  children,
}: {
  accept: string;
  onPick: (file: File) => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        className,
        "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
      )}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file again still counts as a change.
          event.target.value = "";

          if (file) {
            onPick(file);
          }
        }}
      />
      {children}
    </label>
  );
}
