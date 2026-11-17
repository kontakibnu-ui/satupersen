"use client";

import { ChevronLeft, Maximize, Minimize } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cachedBook, forgetOtherAccounts, storeBook } from "@/lib/books/cache";
import { saveMaterialDraft } from "@/lib/books/draft";
import {
  DEFAULT_SIZE_INDEX,
  isFixedFormat,
  parseFlow,
  parseSizeIndex,
  positionLabel,
  positionToSave,
  READER_SIZES,
  readerStyles,
  restoreTarget,
  tapAction,
  type Flow,
  type ReaderColors,
  type RelocateDetail,
} from "@/lib/books/reader";
import {
  CONTENT_TYPES,
  formatBytes,
  FORMAT_LABELS,
  MAX_SELECTION_LENGTH,
  normalizeSelection,
  suggestMaterialTitle,
  type BookFormat,
} from "@/lib/books/rules";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DeleteBook } from "./delete-book";
import { docxBook, textBook } from "./html-book";

export type ReaderBook = {
  id: string;
  title: string;
  format: BookFormat;
  sizeBytes: number;
  storagePath: string;
  location: string | null;
  progress: number | null;
};

/** The parts of foliate-js's <foliate-view> this page uses (vendor/foliate-js/view.js). */
type FoliateView = HTMLElement & {
  open: (book: unknown) => Promise<void>;
  init: (options: { lastLocation?: string | number }) => Promise<void>;
  close: () => void;
  goLeft: () => unknown;
  goRight: () => unknown;
  isFixedLayout?: boolean;
  book?: { destroy?: () => void };
  renderer: HTMLElement & {
    setStyles?: (css: string) => void;
    getContents?: () => { doc: Document }[];
  };
};

type Phase = { kind: "loading"; percent: number | null } | { kind: "ready" } | { kind: "failed"; message: string };

/** foliate-js, served from this site by scripts/copy-reader-assets.mjs and left unbundled. */
const VIEW_MODULE = "/reader/foliate/view.js";
const FLOW_KEY = "satupersen-reader-flow";
const SIZE_KEY = "satupersen-reader-size";
const SAVE_DELAY_MS = 2000;
const CHROME_HIDE_MS = 4000;
const SWIPE_PX = 50;

const OPEN_FAILED = "Buku ini tidak bisa dibuka. Mungkin filenya rusak atau terkunci DRM.";
const DOWNLOAD_FAILED = "Buku belum bisa diunduh. Periksa koneksimu, lalu coba lagi.";

/** A failure whose message is meant for the reader's screen. */
class ReaderError extends Error {}

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Blocked storage: the choice still applies now, it is only not remembered.
    console.warn("remembering a reader choice failed", { kind: (error as Error).name });
  }
}

/** The tokens' real colours in the current mode, read from the page (never written in code). */
function tokenColors(): ReaderColors {
  const probe = document.createElement("span");
  probe.hidden = true;
  document.body.append(probe);

  const read = (token: string) => {
    probe.style.color = `var(--${token})`;
    return getComputedStyle(probe).color;
  };
  const colors = { text: read("text"), background: read("background"), link: read("primary") };

  probe.remove();
  return colors;
}

const isDark = () => document.documentElement.classList.contains("dark");

/** Downloads the file with the user's session; the Storage policy decides again (READ-8). */
async function downloadBook(book: ReaderBook, onPercent: (percent: number) => void): Promise<Blob> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const { data, error } = await createSupabaseBrowserClient().auth.getSession();

  if (!base || !anonKey || error || !data.session) {
    throw new ReaderError("Sesi kamu sudah berakhir. Masuk lagi dulu.");
  }

  const path = book.storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${base}/storage/v1/object/books/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${data.session.access_token}` },
  });

  if (!response.ok || !response.body) {
    throw new ReaderError(DOWNLOAD_FAILED);
  }

  const total = Number(response.headers.get("content-length")) || book.sizeBytes;
  const stream = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await stream.read();

    if (done) {
      break;
    }

    chunks.push(value as BlobPart);
    loaded += value.byteLength;
    onPercent(Math.min(100, Math.round((loaded / total) * 100)));
  }

  return new Blob(chunks, { type: CONTENT_TYPES[book.format] });
}

/**
 * The Ruang baca reader (PRD.md READ-3 to READ-9; DESIGN.md §6 "Pembaca").
 *
 * foliate-js renders the book inside iframes; this component downloads or
 * reuses the copy, hands foliate-js the file (or DOCX and TXT as HTML), and
 * adds what the library leaves to its host: Gulir and Geser, tap zones, swipe
 * for PDF pages, font size, night colours, full screen, the saved position,
 * and "Jadikan materi". Nothing about the book's text is logged.
 */
export function Reader({ book, userId, isFree }: { book: ReaderBook; userId: string; isFree: boolean }) {
  const { id: bookId, title, format, location: savedLocation } = book;
  const fixed = isFixedFormat(format);
  const router = useRouter();

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoliateView | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const pendingRef = useRef<ReturnType<typeof positionToSave> | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const chromeTimerRef = useRef<number | null>(null);
  const browserFullRef = useRef(false);

  const [phase, setPhase] = useState<Phase>({ kind: "loading", percent: null });
  const [flow, setFlow] = useState<Flow>("paginated");
  const [sizeIndex, setSizeIndex] = useState(DEFAULT_SIZE_INDEX);
  const [panelOpen, setPanelOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [chromeShown, setChromeShown] = useState(false);
  const [selection, setSelection] = useState("");
  const [label, setLabel] = useState("");
  const [handoffFailed, setHandoffFailed] = useState(false);

  // Handlers inside the book's iframes outlive renders, so they read these mirrors.
  const stateRef = useRef({ flow, full, panelOpen, chromeShown });
  useEffect(() => {
    stateRef.current = { flow, full, panelOpen, chromeShown };
  }, [flow, full, panelOpen, chromeShown]);

  const supabase = useCallback(() => {
    supabaseRef.current ??= createSupabaseBrowserClient();
    return supabaseRef.current;
  }, []);

  const savePosition = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const pending = pendingRef.current;
    pendingRef.current = null;

    if (!pending) {
      return;
    }

    const changes: { opened_at: string; location?: string; progress?: number } = { opened_at: new Date().toISOString() };

    if (pending.location !== null) {
      changes.location = pending.location;
    }

    if (pending.progress !== null) {
      changes.progress = pending.progress;
    }

    const { error } = await supabase().from("books").update(changes).eq("id", bookId);

    if (error) {
      console.error("saving the reading position failed", { bookId, code: error.code });
    }
  }, [bookId, supabase]);

  const hideChromeLater = useCallback(() => {
    if (chromeTimerRef.current !== null) {
      window.clearTimeout(chromeTimerRef.current);
    }

    chromeTimerRef.current = window.setTimeout(() => {
      if (!stateRef.current.panelOpen) {
        setChromeShown(false);
      }
    }, CHROME_HIDE_MS);
  }, []);

  const toggleChrome = useCallback(() => {
    if (!stateRef.current.full) {
      return;
    }

    if (stateRef.current.chromeShown) {
      setChromeShown(false);
    } else {
      setChromeShown(true);
      hideChromeLater();
    }
  }, [hideChromeLater]);

  const setFullscreen = useCallback(async (next: boolean) => {
    setFull(next);
    setChromeShown(false);

    if (next) {
      setPanelOpen(false);
    }

    try {
      if (next && document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        browserFullRef.current = true;
      } else if (!next && document.fullscreenElement) {
        browserFullRef.current = false;
        await document.exitFullscreen();
      }
    } catch (error) {
      // Refused (iPhone Safari, or no gesture): only the app's controls hide, as READ-4 allows.
      console.warn("browser full screen was refused", { kind: (error as Error).name });
    }
  }, []);

  /** Applies the reading choices to the open book. */
  const applyLayout = useCallback(
    (view: FoliateView, nextFlow: Flow, nextSize: number) => {
      if (!view.isFixedLayout) {
        view.renderer.setAttribute("flow", nextFlow);

        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          view.renderer.setAttribute("animated", "");
        }
      }

      // foliate-js keeps its renderer in a closed shadow root; this mirrors what was applied.
      view.dataset.flow = view.isFixedLayout ? "paginated" : nextFlow;

      view.renderer.setStyles?.(
        readerStyles({ format, dark: isDark(), sizePercent: READER_SIZES[nextSize], colors: tokenColors() }),
      );
    },
    [format],
  );

  // Open the book once.
  useEffect(() => {
    let cancelled = false;
    let view: FoliateView | null = null;
    let release: (() => void) | null = null;
    const detachers: (() => void)[] = [];

    const turn = (direction: "left" | "right") => {
      const current = viewRef.current;

      if (current) {
        void (direction === "left" ? current.goLeft() : current.goRight());
      }
    };

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        turn("left");
      } else if (event.key === "ArrowRight") {
        turn("right");
      } else if (event.key === "Escape" && stateRef.current.full) {
        void setFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    detachers.push(() => window.removeEventListener("keydown", onKey));

    const onLoad = (event: Event) => {
      const doc = (event as CustomEvent<{ doc: Document }>).detail.doc;

      const onSelect = () => setSelection(normalizeSelection(doc.getSelection()?.toString() ?? ""));

      const onTap = (tap: MouseEvent) => {
        const target = tap.target as Element | null;
        const host = viewRef.current;
        const frame = doc.defaultView?.frameElement as HTMLElement | null;

        if (tap.defaultPrevented || target?.closest?.("a[href]") || !host || !frame) {
          return;
        }

        if (!(doc.getSelection()?.isCollapsed ?? true)) {
          return;
        }

        // Where the tap lands across the book, also when foliate-js scales or scrolls the frame.
        const frameRect = frame.getBoundingClientRect();
        const width = doc.documentElement.clientWidth || frameRect.width;
        const x = frameRect.left + (tap.clientX / width) * frameRect.width;
        const hostRect = host.getBoundingClientRect();
        const action = tapAction(
          (x - hostRect.left) / hostRect.width,
          Boolean(host.isFixedLayout) || stateRef.current.flow === "paginated",
        );

        if (action === "menu") {
          toggleChrome();
        } else {
          turn(action);
        }
      };

      doc.addEventListener("selectionchange", onSelect);
      doc.addEventListener("click", onTap);
      doc.addEventListener("keydown", onKey);

      // foliate-js swipes reflowable books itself; PDF pages need it here (READ-4).
      if (viewRef.current?.isFixedLayout) {
        let start: { x: number; y: number } | null = null;

        doc.addEventListener(
          "touchstart",
          (touch) => {
            const point = touch.touches[0];
            start = point ? { x: point.clientX, y: point.clientY } : null;
          },
          { passive: true },
        );
        doc.addEventListener("touchend", (touch) => {
          const point = touch.changedTouches[0];

          if (!start || !point || !(doc.getSelection()?.isCollapsed ?? true)) {
            start = null;
            return;
          }

          const dx = point.clientX - start.x;
          const dy = point.clientY - start.y;
          start = null;

          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
            turn(dx < 0 ? "right" : "left");
          }
        });
      }
    };

    const onRelocate = (event: Event) => {
      const detail = (event as CustomEvent<RelocateDetail>).detail;
      const isFixedNow = Boolean(viewRef.current?.isFixedLayout);

      setLabel(positionLabel(detail, isFixedNow));

      // A page turn drops the old selection along with the page it was on.
      const contents = viewRef.current?.renderer.getContents?.() ?? [];
      const stillSelected = contents
        .map(({ doc }) => normalizeSelection(doc.getSelection()?.toString() ?? ""))
        .find((text) => text !== "");
      setSelection(stillSelected ?? "");

      pendingRef.current = positionToSave(detail, isFixedNow);

      if (saveTimerRef.current === null) {
        saveTimerRef.current = window.setTimeout(() => void savePosition(), SAVE_DELAY_MS);
      }
    };

    const flushOnHide = () => void savePosition();
    window.addEventListener("pagehide", flushOnHide);
    detachers.push(() => window.removeEventListener("pagehide", flushOnHide));

    void (async () => {
      try {
        const startFlow = fixed ? "paginated" : parseFlow(readPreference(FLOW_KEY));
        const startSize = parseSizeIndex(readPreference(SIZE_KEY));
        setFlow(startFlow);
        setSizeIndex(startSize);

        await forgetOtherAccounts(userId);
        let file = await cachedBook(userId, bookId);

        if (!file) {
          setPhase({ kind: "loading", percent: 0 });
          file = await downloadBook(book, (percent) => {
            if (!cancelled) {
              setPhase({ kind: "loading", percent });
            }
          });

          if (cancelled) {
            return;
          }

          await storeBook(userId, bookId, file);
          setPhase({ kind: "loading", percent: null });
        }

        let source: unknown;

        if (format === "docx" || format === "txt") {
          const html = format === "docx" ? await docxBook(file, title) : await textBook(file, title);
          release = html.release;
          source = html.book;
        } else {
          source = new File([file], `${bookId}.${format}`, { type: CONTENT_TYPES[format] });
        }

        await import(/* webpackIgnore: true */ VIEW_MODULE);

        if (cancelled || !hostRef.current) {
          return;
        }

        view = document.createElement("foliate-view") as FoliateView;
        view.style.display = "block";
        view.style.width = "100%";
        view.style.height = "100%";
        view.addEventListener("load", onLoad);
        view.addEventListener("relocate", onRelocate);
        hostRef.current.append(view);
        viewRef.current = view;

        await view.open(source);

        if (cancelled) {
          return;
        }

        applyLayout(view, startFlow, startSize);
        await view.init({ lastLocation: restoreTarget(savedLocation, Boolean(view.isFixedLayout)) });

        if (cancelled) {
          return;
        }

        setPhase({ kind: "ready" });

        const { error } = await supabase()
          .from("books")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", bookId);

        if (error) {
          console.error("marking a book as opened failed", { bookId, code: error.code });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("opening a book failed", { bookId, kind: (error as Error).name });
        setPhase({ kind: "failed", message: error instanceof ReaderError ? error.message : OPEN_FAILED });
      }
    })();

    return () => {
      cancelled = true;
      void savePosition();
      detachers.forEach((detach) => detach());

      if (view) {
        view.close();
        view.book?.destroy?.();
        view.remove();
      }

      release?.();
      viewRef.current = null;
    };
    // The book is opened once per page load; the choices are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // Gulir, Geser, and font size, applied as they change and remembered on this device.
  useEffect(() => {
    const view = viewRef.current;

    if (phase.kind !== "ready" || !view) {
      return;
    }

    applyLayout(view, flow, sizeIndex);

    if (!fixed) {
      writePreference(FLOW_KEY, flow);
    }

    writePreference(SIZE_KEY, String(sizeIndex));
  }, [applyLayout, fixed, flow, phase.kind, sizeIndex]);

  // The colours follow day and night mode if it changes while reading.
  useEffect(() => {
    if (phase.kind !== "ready") {
      return;
    }

    const observer = new MutationObserver(() => {
      const view = viewRef.current;

      if (view) {
        applyLayout(view, stateRef.current.flow, sizeIndex);
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [applyLayout, phase.kind, sizeIndex]);

  // Leaving the browser's full screen (its own Esc) also leaves the reader's.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && browserFullRef.current) {
        browserFullRef.current = false;
        setFull(false);
        setChromeShown(false);
      }
    };

    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function makeMaterial() {
    if (selection === "" || selection.length > MAX_SELECTION_LENGTH) {
      return;
    }

    if (!saveMaterialDraft({ title: suggestMaterialTitle(selection, title), source: selection })) {
      setHandoffFailed(true);
      return;
    }

    void savePosition().finally(() => router.push("/learn/new?dari=buku"));
  }

  const hideTop = full && !chromeShown;
  const hideBottom = full && !chromeShown && selection === "";
  const tooLong = selection.length > MAX_SELECTION_LENGTH;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-text">
      <header
        inert={hideTop}
        className={cn(
          "z-20 border-b border-border bg-surface pt-[env(safe-area-inset-top)]",
          full && "absolute inset-x-0 top-0 shadow-float motion-safe:transition-transform motion-safe:duration-[250ms]",
          hideTop && "-translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-[960px] items-center gap-1 px-2 py-2">
          <Link
            href="/learn"
            aria-label="Kembali ke Belajar"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-sm font-semibold text-text">{title}</h1>
            <p className="text-xs text-text-muted tabular-nums">
              {FORMAT_LABELS[format]} · {formatBytes(book.sizeBytes)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void setFullscreen(!full)}
            aria-pressed={full}
            aria-label={full ? "Keluar dari layar penuh" : "Layar penuh"}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            {full ? (
              <Minimize aria-hidden="true" size={20} strokeWidth={2} />
            ) : (
              <Maximize aria-hidden="true" size={20} strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !panelOpen;
              setPanelOpen(next);

              if (full && !next) {
                hideChromeLater();
              }
            }}
            aria-expanded={panelOpen}
            aria-controls="reader-settings"
            aria-label="Aa, pengaturan baca"
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary",
              panelOpen && "bg-surface-muted",
            )}
          >
            Aa
          </button>
        </div>

        {panelOpen ? (
          <div id="reader-settings" className="border-t border-border bg-surface-muted">
            <div className="mx-auto flex max-w-[960px] flex-col gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span id="flow-label" className="text-sm text-text">
                  Cara baca
                </span>
                {fixed ? (
                  <span className="text-sm text-text-muted">PDF dibaca per halaman.</span>
                ) : (
                  <div role="radiogroup" aria-labelledby="flow-label" className="inline-flex gap-1 rounded-full bg-surface p-1">
                    {(["scrolled", "paginated"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={flow === value}
                        onClick={() => setFlow(value)}
                        className={cn(
                          "min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary",
                          flow === value ? "bg-primary text-primary-foreground" : "text-text-muted",
                        )}
                      >
                        {value === "scrolled" ? "Gulir" : "Geser"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {fixed ? null : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-text">Ukuran huruf</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSizeIndex((index) => Math.max(0, index - 1))}
                      disabled={sizeIndex === 0}
                      aria-label="A−, perkecil huruf"
                      className="inline-flex size-11 items-center justify-center rounded-full border-[1.5px] border-control bg-surface text-sm font-semibold text-text disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      A−
                    </button>
                    <output className="min-w-12 text-center text-sm text-text tabular-nums" aria-live="polite">
                      {READER_SIZES[sizeIndex]}%
                    </output>
                    <button
                      type="button"
                      onClick={() => setSizeIndex((index) => Math.min(READER_SIZES.length - 1, index + 1))}
                      disabled={sizeIndex === READER_SIZES.length - 1}
                      aria-label="A+, perbesar huruf"
                      className="inline-flex size-11 items-center justify-center rounded-full border-[1.5px] border-control bg-surface text-sm font-semibold text-text disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      A+
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-text-muted">Pilihanmu diingat di perangkat ini.</p>
              <DeleteBook bookId={bookId} title={title} isFree={isFree} userId={userId} />
            </div>
          </div>
        ) : null}
      </header>

      <main className="relative min-h-0 flex-1" aria-label="Isi buku" aria-busy={phase.kind === "loading"}>
        {/* foliate-js puts its element in here; React renders nothing inside this div. */}
        <div ref={hostRef} className="absolute inset-0" />

        {phase.kind === "loading" ? (
          <div role="status" className="absolute inset-0 grid place-items-center p-6 text-base text-text-muted tabular-nums">
            {phase.percent === null ? "Membuka buku…" : `Mengunduh buku… ${phase.percent}%`}
          </div>
        ) : null}

        {phase.kind === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
            <p role="alert" className="max-w-sm text-base text-text">
              {phase.message}
            </p>
            <Link href="/learn" className={buttonVariants({ variant: "secondary" })}>
              Kembali ke Belajar
            </Link>
          </div>
        ) : null}
      </main>

      <footer
        inert={hideBottom}
        className={cn(
          "z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]",
          full && "absolute inset-x-0 bottom-0 shadow-float motion-safe:transition-transform motion-safe:duration-[250ms]",
          hideBottom && "translate-y-full",
        )}
      >
        {selection !== "" ? (
          <div className="mx-auto flex min-h-14 max-w-[960px] items-center gap-3 px-4 py-2">
            {tooLong ? (
              <p className="flex-1 text-sm text-text">Terlalu panjang, maksimal 5.000 karakter</p>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-sm text-text-muted tabular-nums">
                  {new Intl.NumberFormat("id-ID").format(selection.length)} karakter terpilih
                </p>
                <Button onClick={makeMaterial} className="shrink-0">
                  Jadikan materi
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="mx-auto flex min-h-11 max-w-[960px] items-center px-4 text-xs text-text-muted tabular-nums">
            {label}
          </p>
        )}
        {handoffFailed ? (
          <p role="alert" className="mx-auto max-w-[960px] px-4 pb-3 text-sm text-text">
            Teksnya belum bisa dibawa karena browser ini menolak penyimpanan sementara. Salin teksnya, lalu tempel di Materi baru.
          </p>
        ) : null}
      </footer>

      {full && !chromeShown && selection === "" && label !== "" ? (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 text-xs text-text-muted tabular-nums"
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
