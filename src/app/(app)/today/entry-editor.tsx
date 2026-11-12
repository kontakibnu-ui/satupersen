"use client";

import { Check, Shuffle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_CONTENT_LENGTH } from "@/lib/entries";
import { cueForDay } from "@/lib/writing-cues";
import { saveEntry } from "./actions";

/**
 * The diary editor (DIARY-1 to DIARY-3, DESIGN.md §5 to §7). Version 4 writes
 * in blue ink on pale blue rules, like a school notebook.
 *
 * - One writing cue sits above the page so it is never blank, and "Pertanyaan
 *   lain" moves to the next one. The cue is a hint, never part of the entry.
 * - Auto-save two seconds after the typing stops, and one row per day: the
 *   server action upserts on (user_id, date).
 * - The textarea grows with its content and never scrolls itself; the page
 *   scrolls (DESIGN.md §5).
 * - On phones and tablets, focusing the editor turns on the writing mode: the
 *   bottom navigation hides and a slim bar at the top shows the save status and
 *   "Selesai", because the in-page status sits under the keyboard by then.
 * - Status is written where the action happens, never as a toast (DESIGN.md §6).
 */
const AUTOSAVE_DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;
const COUNTER_VISIBLE_FROM = 4000;

/** "blocked" is an error that saving again cannot fix, so no retry is scheduled. */
type SaveState = "idle" | "saving" | "saved" | "error" | "blocked";

export function EntryEditor({
  date,
  initialContent,
  onContentChange,
  onSaved,
}: {
  date: string;
  initialContent: string;
  /** Lets the page know whether the text changed after it was summarised. */
  onContentChange?: (value: string) => void;
  onSaved?: (value: string) => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [writing, setWriting] = useState(false);
  const [cueStep, setCueStep] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedContentRef = useRef(initialContent);
  const tooLong = content.length > MAX_CONTENT_LENGTH;

  const grow = useCallback(() => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    grow();
  }, [grow, content]);

  useEffect(() => {
    document.documentElement.dataset.writing = writing ? "true" : "false";

    return () => {
      document.documentElement.dataset.writing = "false";
    };
  }, [writing]);

  const persist = useCallback(
    async (value: string) => {
      setState("saving");

      const result = await saveEntry({ date, content: value });

      if (result.ok) {
        savedContentRef.current = value;
        setState("saved");
        setMessage(undefined);
        onSaved?.(value);
        return;
      }

      setState(result.retryable === false ? "blocked" : "error");
      setMessage(result.message);
    },
    [date, onSaved],
  );

  useEffect(() => {
    if (content === savedContentRef.current || tooLong) {
      return;
    }

    const timer = setTimeout(() => {
      void persist(content);
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [content, persist, tooLong]);

  // A failed save is not the end of the story: it keeps trying while the tab is
  // open, and says so, instead of pretending the text is safe.
  useEffect(() => {
    if (state !== "error" || tooLong) {
      return;
    }

    const timer = setTimeout(() => {
      void persist(content);
    }, RETRY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [state, content, persist, tooLong]);

  // DIARY-3: too long is derived from the text itself, so it is shown the moment
  // the limit is crossed instead of being written from inside an effect.
  const statusText = tooLong
    ? `Tulisan maksimal ${MAX_CONTENT_LENGTH} karakter, jadi belum bisa disimpan.`
    : state === "saving"
      ? "Menyimpan…"
      : state === "saved"
        ? "Tersimpan"
        : state === "error"
          ? (message ?? "Belum tersimpan, mencoba lagi")
          : state === "blocked"
            ? (message ?? "Tulisan belum bisa disimpan.")
            : "";
  const savedMark =
    state === "saved" && !tooLong ? (
      <Check aria-hidden="true" size={15} strokeWidth={2.4} className="text-primary" />
    ) : null;

  return (
    <div>
      {writing ? (
        // The writing bar of DESIGN.md §5. Its status repeats the one under the
        // page for the eyes only; screen readers already hear that one.
        <div className="fixed inset-x-0 top-0 z-20 border-b border-border bg-background pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="mx-auto flex min-h-16 max-w-[640px] items-center justify-between gap-3 px-4 md:px-6">
            <p aria-hidden="true" className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm text-text-muted">
              {savedMark}
              {statusText || "Tersimpan otomatis"}
            </p>
            <Button
              variant="link"
              // Keep the editor focused until the tap lands, so the bar is
              // still there to receive it.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                textareaRef.current?.blur();
                setWriting(false);
              }}
              className="min-w-11 shrink-0 font-semibold text-primary"
            >
              Selesai
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <p id="entry-cue" className="pt-2.5 font-serif text-base italic text-text-muted md:text-lg">
          {cueForDay(date, cueStep)}
        </p>
        <Button
          variant="link"
          aria-label="Pertanyaan lain"
          title="Pertanyaan lain"
          // A tap swaps the question without taking the focus, so the keyboard
          // stays open while writing.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setCueStep((step) => step + 1)}
          className="-mr-2 size-11 shrink-0 rounded-full text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <Shuffle aria-hidden="true" size={18} strokeWidth={1.7} />
        </Button>
      </div>

      <label htmlFor="entry" className="sr-only">
        Tulisan hari ini
      </label>
      <textarea
        id="entry"
        ref={textareaRef}
        value={content}
        aria-describedby="entry-cue"
        onChange={(event) => {
          setContent(event.target.value);
          onContentChange?.(event.target.value);
        }}
        onFocus={() => setWriting(true)}
        onBlur={() => setWriting(false)}
        rows={6}
        autoCapitalize="sentences"
        placeholder="Tulis bebas. Satu kalimat juga cukup untuk mulai."
        className="paper-lines mt-2 min-h-[204px] w-full resize-none bg-transparent font-serif text-editor text-primary placeholder:text-text-muted focus:outline-none md:min-h-[272px]"
      />

      <div className="mt-3 flex min-h-6 items-center justify-between gap-4">
        <p role="status" className="inline-flex items-center gap-1.5 text-sm text-text-muted">
          {savedMark}
          {statusText}
        </p>

        {content.length > COUNTER_VISIBLE_FROM ? (
          <p className="text-sm text-text-muted tabular-nums">
            {content.length}/{MAX_CONTENT_LENGTH}
          </p>
        ) : null}
      </div>
    </div>
  );
}
