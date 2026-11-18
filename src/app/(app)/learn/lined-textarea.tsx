"use client";

import { useCallback, useEffect, useRef } from "react";
import { BLEED } from "@/components/notebook";
import { cn } from "@/lib/utils";

/**
 * What the user writes in Belajar (the material, an explanation, an answer) sits
 * on ruled paper in Lora ink like the diary (DESIGN.md §6 version 4). The field
 * grows with its text and never scrolls itself, so the page is what scrolls.
 * Its label is visible and passed in by the caller. `onSheet` is for a field on
 * a binder sheet, whose ruled lines run to the sheet's edges (§14.3); the
 * `control` line under the field still marks where it ends.
 */
export function LinedTextarea({
  id,
  value,
  onChange,
  rows,
  placeholder,
  describedBy,
  disabled,
  invalid,
  onSheet = false,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** The empty height in ruled lines. */
  rows: number;
  placeholder?: string;
  describedBy?: string;
  disabled?: boolean;
  invalid?: boolean;
  onSheet?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const grow = useCallback(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    grow();
  }, [grow, value]);

  const field = (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      style={{ minHeight: `${rows * 34}px` }}
      autoCapitalize="sentences"
      placeholder={placeholder}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      className={cn(
        "w-full resize-none rounded-sm border-b border-control bg-transparent font-serif text-editor text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-70",
        onSheet ? "block" : "paper-lines",
        !onSheet && className,
      )}
    />
  );

  return onSheet ? <div className={cn(BLEED, "paper-lines", className)}>{field}</div> : field;
}
