"use client";

import { Plus, RefreshCw, Stamp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { HabitChecklist } from "@/components/habit-checklist";
import { Button } from "@/components/ui/button";
import { BinderSheet, Kop, SectionHead } from "@/components/notebook";
import { Card } from "@/components/ui/card";
import {
  clearEntryDraft,
  forgetOtherEntryDrafts,
  readEntryDraft,
  resolveEntryDraft,
  writeEntryDraft,
  type DraftResolution,
} from "@/lib/entry-draft";
import type { HabitView } from "@/lib/habits";
import { EntryEditor } from "./entry-editor";
import { MoodEnergy } from "./mood-energy";
import { SummaryResultView, type SummaryResult, type WeekDay } from "./summary-result";

/**
 * The states of DESIGN.md §7. The page already replaced the whole screen for
 * the crisis state, so what is left here is:
 * 1. empty: the button stays enabled and pressing it explains what to do;
 * 2. writing: the editor's own writing mode;
 * 3. analysing: the button says "Menganalisa…" and a still skeleton shows;
 * 4. result: the analysis on top and the writing folded below, with no
 *    primary button (DESIGN.md §2);
 * 5. changed after the analysis: a quiet line with "Analisa ulang (sisa N)";
 * 6. failed: what happened, plus a secondary "Coba lagi" when trying again
 *    can help.
 *
 * The page reads in the order a day is closed (DESIGN.md §8): the writing
 * first, because it is the focus, then mood and energy, the habits, and the one
 * primary button at the end. Version 5 ("Meja Tulis", §14.2) keeps one binder
 * sheet for the writing and lays the rest straight on the page under section
 * heads, without cards.
 */
type Phase = "idle" | "summarizing" | "failed";

/** Statuses where pressing "Coba lagi" cannot change the answer. */
const FINAL_STATUSES = new Set([400, 409, 429]);

const subscribeNever = () => () => {};
const inBrowser = () => true;
const onServer = () => false;

export function TodayClient({
  userId,
  date,
  weekday,
  fullDate,
  week,
  initialContent,
  initialResult,
  initialMood,
  initialEnergy,
  initialHabits,
  regenLeft: initialRegenLeft,
}: {
  /** Keys the diary draft kept in this browser (`lib/entry-draft.ts`). */
  userId: string;
  date: string;
  /** "Minggu", for the notebook heading. */
  weekday: string;
  /** "8 November 2026", for the notebook heading. */
  fullDate: string;
  week: WeekDay[];
  initialContent: string;
  initialResult: SummaryResult | null;
  initialMood: number | null;
  initialEnergy: number | null;
  initialHabits: HabitView[];
  regenLeft: number;
}) {
  // False for the server render and hydration, which must match the server HTML.
  const hydrated = useSyncExternalStore(subscribeNever, inBrowser, onServer);
  const [content, setContent] = useState(initialContent);
  // What the server has; differs from `content` until a restored draft is saved.
  const [savedText, setSavedText] = useState(initialContent);
  const [draftChecked, setDraftChecked] = useState(false);
  const [draftKind, setDraftKind] = useState<DraftResolution["kind"]>("none");
  const [conflict, setConflict] = useState<string | null>(null);
  // Bumped to open the editor again with a draft's text.
  const [editorKey, setEditorKey] = useState(0);
  const [mood, setMood] = useState(initialMood);
  const [energy, setEnergy] = useState(initialEnergy);
  const [habits, setHabits] = useState(initialHabits);

  // What the score was built from besides the text: mood, energy, and which
  // habits were checked. A change in any of them makes the summary out of date.
  const inputsKey = `${mood ?? ""}|${energy ?? ""}|${habits
    .filter((habit) => habit.doneDates.includes(date))
    .map((habit) => habit.id)
    .sort()
    .join(",")}`;

  const [summarisedText, setSummarisedText] = useState<string | null>(
    initialResult ? initialContent : null,
  );
  const [summarisedInputs, setSummarisedInputs] = useState<string | null>(
    initialResult ? inputsKey : null,
  );
  const [result, setResult] = useState<SummaryResult | null>(initialResult);
  const [regenLeft, setRegenLeft] = useState(initialRegenLeft);
  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [retryable, setRetryable] = useState(true);
  const [blankHint, setBlankHint] = useState(false);

  // The server render cannot see the draft kept in this browser, so it is read
  // once, in the first render after hydration (React's "adjust state while
  // rendering" pattern, so no effect writes state and nothing else remounts).
  // Only a restored draft reopens the editor, with its text; with no draft the
  // screen stays as it was, including anything already typed into it.
  if (hydrated && !draftChecked) {
    const found = resolveEntryDraft(initialContent, readEntryDraft(userId, date));

    setDraftChecked(true);
    setDraftKind(found.kind);

    if (found.kind === "restore") {
      setContent(found.content);
      // Not on the server yet, so the editor stays open to save it.
      setEditing(true);
      setEditorKey((key) => key + 1);
    } else if (found.kind === "conflict") {
      setConflict(found.content);
    }
  }

  const isBlank = content.trim() === "";
  const textChanged = result !== null && summarisedText !== null && content !== summarisedText;
  const inputsChanged =
    result !== null && summarisedInputs !== null && inputsKey !== summarisedInputs;
  const changed = textChanged || inputsChanged;
  const showEditor = result === null || editing;

  const summarise = useCallback(async () => {
    // AI-1: an empty page never reaches the AI; the button explains instead.
    if (content.trim() === "") {
      setBlankHint(true);
      return;
    }

    setBlankHint(false);
    setPhase("summarizing");
    setMessage(undefined);

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const body = (await response.json()) as
        | ({ kind: "summary" } & SummaryResult)
        | { kind: "crisis" }
        | { kind: "error"; message: string };

      if (body.kind === "crisis") {
        // The crisis screen is a server render, so reload it rather than
        // painting a gentler version here.
        window.location.reload();
        return;
      }

      if (body.kind === "error") {
        setPhase("failed");
        setMessage(body.message);
        // A rate limit (RATE-3) passes in seconds, so its 429 keeps "Coba lagi".
        setRetryable(!FINAL_STATUSES.has(response.status) || response.headers.has("Retry-After"));
        return;
      }

      if (result !== null) {
        setRegenLeft((left) => Math.max(0, left - 1));
      }

      setResult({
        summary: body.summary,
        strengths: body.strengths,
        improvements: body.improvements,
        tomorrowTip: body.tomorrowTip,
        score: body.score,
        delta: body.delta,
        comparedTo: body.comparedTo,
        scoreReason: body.scoreReason,
      });
      setSummarisedText(content);
      setSummarisedInputs(inputsKey);
      setEditing(false);
      setPhase("idle");
    } catch {
      setPhase("failed");
      setMessage("Koneksi terputus. Tulisanmu aman. Coba lagi.");
      setRetryable(true);
    }
  }, [content, date, inputsKey, result]);

  // Drafts of other days can never be sent (the server only takes today), and
  // another account's have no business on this screen.
  useEffect(() => {
    if (!draftChecked) {
      return;
    }

    forgetOtherEntryDrafts(userId, date);

    if (draftKind === "discard") {
      clearEntryDraft(userId, date);
    }
  }, [draftChecked, draftKind, userId, date]);

  function takeDraft() {
    if (conflict === null) {
      return;
    }

    // Chosen over the server text, so a reload before it is saved puts it back without asking again.
    writeEntryDraft(userId, date, { content: conflict, base: savedText });
    setContent(conflict);
    setConflict(null);
    setEditing(true);
    setEditorKey((key) => key + 1);
  }

  function dropDraft() {
    clearEntryDraft(userId, date);
    setConflict(null);
  }

  // Text kept on this device while today's entry was changed somewhere else:
  // neither is thrown away without the user choosing.
  const conflictBlock =
    conflict !== null ? (
      <Card aria-labelledby="draft-conflict-title">
        <h2 id="draft-conflict-title" className="font-heading text-base font-bold text-text">
          Ada tulisan yang belum terkirim
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Tulisan ini tersimpan di perangkat ini, sementara tulisan hari ini sudah diubah di tempat lain. Mau pakai
          yang mana?
        </p>
        {conflict.trim() !== "" ? (
          <p className="mt-3 line-clamp-6 whitespace-pre-line font-serif text-base text-text">{conflict}</p>
        ) : (
          <p className="mt-3 text-sm text-text-muted">Tulisan di perangkat ini kosong.</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button variant="secondary" onClick={takeDraft}>
            Pakai tulisan ini
          </Button>
          <Button variant="link" onClick={dropDraft} className="text-sm font-semibold">
            Tetap pakai yang tersimpan
          </Button>
        </div>
      </Card>
    ) : null;

  const moodBlock = (
    <MoodEnergy date={date} mood={mood} energy={energy} setMood={setMood} setEnergy={setEnergy} />
  );

  const doneToday = habits.filter((habit) => habit.doneDates.includes(date)).length;

  // DESIGN.md §8: the checklist sits under the writing; with no habits yet it is
  // only a quiet invitation, because Hari Ini is not where habits are made.
  const habitBlock =
    habits.length > 0 ? (
      <section aria-labelledby="habit-heading">
        <SectionHead
          id="habit-heading"
          title="Kebiasaan"
          aside={
            <>
              {doneToday} dari {habits.length}
              <span className="sr-only"> selesai hari ini</span>
            </>
          }
        />
        <HabitChecklist date={date} habits={habits} setHabits={setHabits} showIdentity={false} />
      </section>
    ) : (
      <section aria-label="Kebiasaan" className="flex flex-wrap items-center justify-between gap-x-3 border-y border-rule py-2">
        <p className="text-sm text-text-muted">Belum ada kebiasaan. Mulai dari satu yang kecil.</p>
        <Link
          href="/habits"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          <Plus aria-hidden="true" size={16} strokeWidth={2} />
          Tambah kebiasaan
        </Link>
      </section>
    );

  const writingBlock = showEditor ? (
    // No name of its own: the textarea inside is already "Tulisan hari ini".
    <BinderSheet as="div" className="focus-within:border-primary">
      <Kop
        rows={[
          ["Hari", weekday],
          ["Tanggal", fullDate],
        ]}
      />
      <EntryEditor
        key={editorKey}
        userId={userId}
        date={date}
        initialContent={content}
        savedContent={savedText}
        onSaved={setSavedText}
        onContentChange={(value) => {
          setContent(value);

          if (value.trim() !== "") {
            setBlankHint(false);
          }
        }}
      />
    </BinderSheet>
  ) : (
    <section aria-labelledby="writing-heading">
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-rule-strong">
        <h2 id="writing-heading" className="font-heading text-base font-bold text-text">
          Tulisanmu
        </h2>
        <Button variant="link" onClick={() => setEditing(true)} className="text-sm font-semibold text-primary">
          Ubah tulisan
        </Button>
      </div>
      <p className="mt-2 line-clamp-4 whitespace-pre-line font-serif text-lg leading-[1.65] text-primary">{content}</p>
    </section>
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      {result ? <SummaryResultView result={result} week={week} /> : null}

      {conflictBlock}

      {writingBlock}

      {moodBlock}

      {habitBlock}

      <div className="flex flex-col gap-3">
        {result === null ? (
          <>
            <Button onClick={summarise} disabled={phase === "summarizing"} className="w-full text-[17px]">
              <Stamp aria-hidden="true" size={18} strokeWidth={1.7} />
              {phase === "summarizing" ? "Menganalisa…" : "Analisa hari ini"}
            </Button>
            {phase === "idle" && !blankHint ? (
              <p className="text-center text-sm text-text-muted">
                AI membaca tulisan, mood, dan kebiasaanmu, lalu menulis analisanya.
              </p>
            ) : null}
          </>
        ) : null}

        {blankHint && isBlank ? (
          <p aria-live="polite" className="text-center text-sm font-medium text-text">
            Tulis minimal satu kalimat dulu
          </p>
        ) : null}

        {phase === "summarizing" ? (
          <Card as="div">
            <p aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <Stamp aria-hidden="true" size={16} strokeWidth={1.7} className="text-primary" />
              Sedang membaca harimu…
            </p>
            <div aria-hidden="true" className="mt-4 flex flex-col gap-2.5">
              <div className="h-4 w-3/4 rounded-full bg-surface-muted" />
              <div className="h-4 w-full rounded-full bg-surface-muted" />
              <div className="h-4 w-2/3 rounded-full bg-surface-muted" />
            </div>
          </Card>
        ) : null}

        {phase === "failed" ? (
          <Card as="div" aria-live="polite">
            <p className="text-base text-text">{message}</p>
            {retryable ? (
              <Button variant="secondary" onClick={summarise} className="mt-3">
                Coba lagi
              </Button>
            ) : null}
          </Card>
        ) : null}

        {phase === "idle" && changed ? (
          <div className="flex items-start gap-3 rounded-[14px] border border-dashed border-control p-4">
            <RefreshCw aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-text-muted" />
            <p className="text-sm text-text-muted">
              {textChanged
                ? "Tulisanmu berubah sejak dianalisa."
                : "Mood, energi, atau kebiasaanmu berubah sejak dianalisa."}{" "}
              {regenLeft > 0 ? (
                <Button variant="link" size="inline" onClick={summarise} className="font-semibold text-primary">
                  Analisa ulang (sisa {regenLeft})
                </Button>
              ) : (
                <span>Analisa ulang hari ini sudah terpakai.</span>
              )}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
