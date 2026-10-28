"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_CONTENT_LENGTH } from "@/lib/entries";
import { saveEntry } from "./actions";

/**
 * The diary editor (DIARY-1 to DIARY-3, DESIGN.md §5 to §7).
 *
 * - Auto-save two seconds after the typing stops, and one row per day: the
 *   server action upserts on (user_id, date).
 * - The textarea grows with its content and never scrolls itself; the page
 *   scrolls (DESIGN.md §5).
 * - On phones, focusing the editor hides the bottom navigation and shows a
 *   small "Selesai" link, so the keyboard does not cover what is being written.
 * - Status is written where the action happens, never as a toast (DESIGN.md §6).
 */
const AUTOSAVE_DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;
const COUNTER_VISIBLE_FROM = 4000;

type SaveState = "idle" | "saving" | "saved" | "error";

export function EntryEditor({
  date,
  initialContent,
}: {
  date: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [writing, setWriting] = useState(false);

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
        return;
      }

      setState("error");
      setMessage(result.message);
    },
    [date],
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
          : "";

  return (
    <div className="mt-6">
      {writing ? (
        <button
          type="button"
          onClick={() => {
            textareaRef.current?.blur();
            setWriting(false);
          }}
          className="fixed top-[calc(env(safe-area-inset-top)+0.5rem)] right-4 z-20 h-11 text-sm text-text underline md:hidden"
        >
          Selesai
        </button>
      ) : null}

      <label htmlFor="entry" className="sr-only">
        Tulisan hari ini
      </label>
      <textarea
        id="entry"
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onFocus={() => setWriting(true)}
        onBlur={() => setWriting(false)}
        rows={1}
        placeholder="Mulai dari satu kalimat: apa satu hal yang terjadi hari ini?"
        className="w-full resize-none border-b border-transparent bg-transparent font-serif text-editor text-text placeholder:text-text-muted focus:border-control focus:outline-none"
      />

      <div className="mt-3 flex items-center justify-between gap-4">
        <p role="status" className="text-sm text-text-muted">
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
