"use client";

import { ChevronRight, Library } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PLAN_LIMITS, type Plan } from "@/config/plans";
import { finishBookUpload, startBookUpload } from "@/lib/books/actions";
import {
  ACCEPT_ATTRIBUTE,
  BOOK_HEAD_BYTES,
  bookRoom,
  CONTENT_TYPES,
  detectBookFormat,
  formatBytes,
  FORMAT_LABELS,
  progressPercent,
  titleFromFileName,
  type BookFormat,
} from "@/lib/books/rules";
import { uploadBookFile } from "@/lib/books/upload";

export type ShelfBook = {
  id: string;
  title: string;
  format: BookFormat;
  sizeBytes: number;
  progress: number | null;
};

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; title: string; percent: number }
  | { kind: "checking"; title: string }
  | { kind: "failed"; message: string };

/** The error state of the sheet: the books could not be read, the rest of Belajar still works. */
export function BookShelfUnavailable() {
  return (
    <Card className="mt-4" aria-labelledby="reading-room">
      <CardHeader id="reading-room" title="Ruang baca" icon={Library} />
      <p role="alert" className="mt-3 text-sm text-text">
        Ruang baca belum bisa dibuka. Coba muat ulang halaman ini sebentar lagi.
      </p>
    </Card>
  );
}

/** How much free room is worth mentioning before it runs out. */
const NEARLY_FULL_BYTES = 200 * 1024 * 1024;

/**
 * Ruang baca on /learn (PRD.md READ-1, READ-2; DESIGN.md §6 "Lembaran Ruang
 * baca"). A quiet sheet under the materials: the books, then "Unggah buku" as a
 * link that opens the file picker. The file is checked on the phone first (type
 * from its content, size, plan room) so nothing doomed is uploaded; the server
 * and the database check again.
 *
 * Each book opens with a plain link, not a client-side navigation, so the
 * reader loads as a new document with its own Content-Security-Policy (READ-8).
 */
export function BookShelf({
  books,
  plan,
  booksCreated,
  usedBytes,
}: {
  books: ShelfBook[];
  plan: Plan;
  booksCreated: number;
  usedBytes: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });

  const roomForAny = bookRoom({ plan, booksCreated, usedBytes, size: 1 });
  const busy = state.kind === "uploading" || state.kind === "checking";

  async function upload(file: File) {
    const title = titleFromFileName(file.name);
    const head = new Uint8Array(await file.slice(0, BOOK_HEAD_BYTES).arrayBuffer());
    const format = detectBookFormat(file.name, head);

    if (!format) {
      setState({
        kind: "failed",
        message: "File ini bukan PDF, EPUB, DOCX, atau TXT yang bisa dibaca. Pilih file lain.",
      });
      return;
    }

    const room = bookRoom({ plan, booksCreated, usedBytes, size: file.size });

    if (!room.ok) {
      setState({ kind: "failed", message: room.message });
      return;
    }

    setState({ kind: "uploading", title, percent: 0 });

    const started = await startBookUpload({ fileName: file.name, format, size: file.size });

    if (!started.ok) {
      setState({ kind: "failed", message: started.message });
      return;
    }

    try {
      await uploadBookFile({
        path: started.path,
        token: started.token,
        file,
        contentType: CONTENT_TYPES[format],
        onProgress: (percent) => setState({ kind: "uploading", title, percent }),
      });
    } catch {
      setState({ kind: "failed", message: "Unggahan terputus. Periksa koneksimu, lalu coba lagi." });
      return;
    }

    setState({ kind: "checking", title });

    const finished = await finishBookUpload({ bookId: started.bookId });

    if (!finished.ok) {
      setState({ kind: "failed", message: finished.message });
      return;
    }

    setState({ kind: "idle" });
    router.refresh();
  }

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so picking the same file again after a failure still fires a change.
    event.target.value = "";

    if (file) {
      void upload(file);
    }
  }

  const totalRoom = PLAN_LIMITS[plan].bookStorageBytes;
  const roomLeft = totalRoom === null ? null : Math.max(0, totalRoom - usedBytes);
  const usedNote =
    totalRoom !== null && roomLeft !== null && roomForAny.ok && books.length > 0 && roomLeft <= NEARLY_FULL_BYTES
      ? `Tersisa ${formatBytes(roomLeft)} dari ${formatBytes(totalRoom)}.`
      : null;

  return (
    <Card className="mt-4" aria-labelledby="reading-room">
      <CardHeader id="reading-room" title="Ruang baca" icon={Library} />

      {books.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">
          Unggah PDF, EPUB, DOCX, atau TXT untuk dibaca di sini, lalu jadikan bagian pentingnya materi.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {books.map((book) => {
            const percent = progressPercent(book.progress);

            return (
              <li key={book.id} className="border-b border-border last:border-b-0">
                <a
                  href={`/read/${book.id}`}
                  className="-mx-2 flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-text">{book.title}</span>
                    <span className="block text-sm text-text-muted tabular-nums">
                      {FORMAT_LABELS[book.format]} · {formatBytes(book.sizeBytes)}
                      {percent === null ? "" : ` · ${percent}%`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0 text-text-muted" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {/* Opened by the "Unggah buku" button; hidden, so it is never a second control. */}
      <input ref={input} id="book-file" type="file" accept={ACCEPT_ATTRIBUTE} hidden onChange={pick} />

      <div className="mt-2" aria-live="polite">
        {state.kind === "uploading" ? (
          <p className="py-3 text-sm text-text tabular-nums">
            Mengunggah {state.title}… {state.percent}%
          </p>
        ) : state.kind === "checking" ? (
          <p className="py-3 text-sm text-text">Memeriksa file…</p>
        ) : roomForAny.ok ? (
          <Button variant="link" onClick={() => input.current?.click()} disabled={busy} className="font-semibold text-primary">
            Unggah buku
          </Button>
        ) : (
          <p className="py-3 text-sm text-text-muted">
            {roomForAny.message}{" "}
            <Link
              href="/settings/plan"
              className={buttonVariants({ variant: "link", size: "inline", className: "font-semibold text-primary" })}
            >
              Lihat paket
            </Link>
          </p>
        )}

        {state.kind === "failed" ? (
          <p role="alert" className="pb-2 text-sm text-text">
            {state.message}
          </p>
        ) : null}
        {usedNote ? <p className="pb-2 text-sm text-text-muted">{usedNote}</p> : null}
      </div>
    </Card>
  );
}
