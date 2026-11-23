"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callAction } from "@/lib/call-action";
import { categoryLabel } from "@/lib/expenses";
import { formatRupiah } from "@/lib/format";
import { hasStatementText, MAX_STATEMENT_TEXT_LENGTH, prepareStatementText, STATEMENT_ACCEPT } from "@/lib/statement";
import { cn } from "@/lib/utils";
import { addStatementEntries, readStatementText, type StatementRow } from "./actions";
import { FilePicker } from "./file-picker";
import { readStatementFile, StatementFileError, type StatementFileProblem, type StatementStage } from "./read-statement-file";

/**
 * "Dari e-statement" (PRD.md EXP-9, DESIGN.md §16.1). The file is read on the
 * phone, the server turns its text into rows, and the user ticks what to save.
 * Nothing is saved before "Simpan". Closing the sheet mid-way drops everything,
 * the password included.
 */

/** What the free plan sees instead of the file picker (SUB-1 is enforced on the server too). */
export function StatementPremium({ onManual }: { onManual: () => void }) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-base text-text">
        Baca e-statement ada di Premium. Mutasi dari PDF, CSV, atau Excel bankmu jadi daftar transaksi yang tinggal
        dicentang.
      </p>
      <Link href="/settings/plan" className={buttonVariants({ variant: "soft", className: "w-full" })}>
        Lihat Premium
      </Link>
      <Button variant="link" onClick={onManual} className="self-center">
        Isi manual
      </Button>
    </div>
  );
}

const FILE_PROBLEM: Record<Exclude<StatementFileProblem, "password-needed" | "password-wrong">, string> = {
  "too-big": "File-nya lebih dari 10 MB. Pilih e-statement yang lebih kecil, misalnya satu bulan.",
  format: "Pilih file PDF, CSV, atau Excel dari bankmu.",
  "too-many-pages": "PDF ini lebih dari 40 halaman. Pilih periode yang lebih pendek, misalnya satu bulan.",
  broken: "File ini belum bisa dibaca di perangkatmu. Coba file lain, atau isi manual.",
};

const NO_TEXT =
  "Tulisan di file ini tidak terbaca, mungkin karena hasil pindaian. Unduh ulang e-statement dari aplikasi bankmu, atau isi manual.";
const TOO_LONG =
  "E-statement ini terlalu panjang untuk dibaca sekaligus. Pilih periode yang lebih pendek, misalnya satu bulan.";

function stageText(stage: StatementStage | "tidying"): string {
  if (stage === "tidying") {
    return "Merapikan transaksinya…";
  }

  return stage.kind === "page" && stage.pages > 1
    ? `Membaca halaman ${stage.page} dari ${stage.pages}…`
    : "Membuka file…";
}

/** "Sab, 15 Nov" for a day key. */
const dayFormat = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function shortDay(key: string): string {
  return dayFormat.format(new Date(`${key}T00:00:00Z`));
}

export type StatementSaved = { saved: number; month: string };

type Phase =
  | { kind: "reading"; stage: StatementStage | "tidying" }
  | { kind: "password"; wrong: boolean }
  | { kind: "failed"; message: string }
  | { kind: "review"; rows: StatementRow[]; outOfRange: number; partial: boolean; overLimit: number };

export function StatementImport({
  file,
  onChooseAnother,
  onManual,
  onReview,
  onSaved,
}: {
  file: File;
  onChooseAnother: (file: File) => void;
  onManual: () => void;
  /** Called once the rows are ready, so the sheet can change its title. */
  onReview: () => void;
  onSaved: (result: StatementSaved) => void;
}) {
  const onReviewRef = useRef(onReview);

  useEffect(() => {
    onReviewRef.current = onReview;
  }, [onReview]);

  const [phase, setPhase] = useState<Phase>({ kind: "reading", stage: { kind: "opening" } });
  // A new password starts a new reading of the same file.
  const [attempt, setAttempt] = useState<{ password?: string; id: number }>({ id: 0 });
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;

    async function run() {
      let text: string;

      try {
        text = prepareStatementText(
          await readStatementFile(file, {
            password: attempt.password,
            onStage: (stage) => {
              if (active) {
                setPhase({ kind: "reading", stage });
              }
            },
          }),
        );
      } catch (error) {
        if (!active) {
          return;
        }

        const problem: StatementFileProblem = error instanceof StatementFileError ? error.problem : "broken";

        if (problem === "password-needed" || problem === "password-wrong") {
          setPhase({ kind: "password", wrong: problem === "password-wrong" });
        } else {
          setPhase({ kind: "failed", message: FILE_PROBLEM[problem] });
        }
        return;
      }

      if (!active) {
        return;
      }

      if (!hasStatementText(text)) {
        setPhase({ kind: "failed", message: NO_TEXT });
        return;
      }

      if (text.length > MAX_STATEMENT_TEXT_LENGTH) {
        setPhase({ kind: "failed", message: TOO_LONG });
        return;
      }

      setPhase({ kind: "reading", stage: "tidying" });

      const result = await callAction(() => readStatementText({ text }));

      if (!active) {
        return;
      }

      if (result.ok) {
        setPhase({
          kind: "review",
          rows: result.rows,
          outOfRange: result.outOfRange,
          partial: result.partial,
          overLimit: result.overLimit,
        });
        onReviewRef.current();
      } else {
        setPhase({ kind: "failed", message: result.message });
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [file, attempt]);

  if (phase.kind === "password") {
    return (
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();

          if (password !== "") {
            setPhase({ kind: "reading", stage: { kind: "opening" } });
            setAttempt((current) => ({ password, id: current.id + 1 }));
          }
        }}
      >
        <p className="text-base text-text">PDF ini dikunci password.</p>
        <label className="block text-sm font-semibold text-text">
          Password PDF
          <Input
            data-autofocus
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 font-normal"
          />
        </label>
        <p role="status" className="min-h-5 text-sm text-text-muted">
          {phase.wrong ? "Password-nya belum cocok." : null}
        </p>
        <Button type="submit" disabled={password === ""} className="w-full">
          Buka
        </Button>
        <FilePicker
          accept={STATEMENT_ACCEPT}
          onPick={onChooseAnother}
          className={buttonVariants({ variant: "link", className: "self-center" })}
        >
          Pilih file lain
        </FilePicker>
      </form>
    );
  }

  if (phase.kind === "failed") {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <p role="alert" className="text-base text-text">
          {phase.message}
        </p>
        <FilePicker
          accept={STATEMENT_ACCEPT}
          onPick={onChooseAnother}
          className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
        >
          Pilih file lain
        </FilePicker>
        <Button variant="link" onClick={onManual} className="self-center">
          Isi manual
        </Button>
      </div>
    );
  }

  if (phase.kind === "review") {
    return (
      <StatementReview
        rows={phase.rows}
        outOfRange={phase.outOfRange}
        partial={phase.partial}
        overLimit={phase.overLimit}
        onSaved={onSaved}
      />
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3" aria-busy="true">
      <p role="status" className="text-base text-text">
        {stageText(phase.stage)}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-4 w-2/3 rounded-full bg-surface-muted" />
        <div className="h-4 w-1/2 rounded-full bg-surface-muted" />
      </div>
      <p className="text-sm text-text-muted">
        File-nya dibaca di perangkatmu dan tidak diunggah. Hanya tulisannya, dengan nomor rekening dan namamu
        disamarkan, yang dikirim untuk dirapikan AI.
      </p>
    </div>
  );
}

/** The month most of the saved rows fall in, so the screen can link to it. */
function busiestMonth(rows: readonly StatementRow[]): string {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const month = row.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0][0];
}

function StatementReview({
  rows,
  outOfRange,
  partial,
  overLimit,
  onSaved,
}: {
  rows: StatementRow[];
  outOfRange: number;
  partial: boolean;
  overLimit: number;
  onSaved: (result: StatementSaved) => void;
}) {
  // Rows that look already written down start unticked.
  const [ticked, setTicked] = useState<boolean[]>(() => rows.map((row) => !row.recorded));
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  const count = ticked.filter(Boolean).length;
  const recordedCount = rows.filter((row) => row.recorded).length;
  const allTicked = count === rows.length;

  async function save() {
    if (saving.current || count === 0) {
      return;
    }

    saving.current = true;
    setPending(true);
    setMessage(undefined);

    const chosen = rows.filter((_, index) => ticked[index]);
    const result = await callAction(() =>
      addStatementEntries({
        rows: chosen.map(({ date, type, amount, category, note }) => ({ date, type, amount, category, note })),
      }),
    );

    saving.current = false;
    setPending(false);

    if (result.ok) {
      onSaved({ saved: result.saved, month: busiestMonth(chosen) });
      return;
    }

    setMessage(result.message);
  }

  return (
    <div className="mt-4 flex flex-col">
      <div className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-text">
        <p>{rows.length} transaksi terbaca. Centang yang mau disimpan.</p>
        {recordedCount > 0 ? <p className="mt-1">{recordedCount} sepertinya sudah tercatat, tidak dicentang.</p> : null}
        {outOfRange > 0 ? <p className="mt-1">{outOfRange} lebih dari setahun lalu, dilewati.</p> : null}
        {overLimit > 0 ? <p className="mt-1">{overLimit} sisanya tidak ditampilkan. Baca sisanya lewat file periode berikutnya.</p> : null}
        {partial ? <p className="mt-1">Sebagian isi file belum terbaca, jadi mungkin ada yang terlewat.</p> : null}
      </div>

      <Button
        variant="link"
        onClick={() => setTicked(rows.map(() => !allTicked))}
        className="mt-1 self-start text-sm font-semibold text-primary"
      >
        {allTicked ? "Kosongkan centang" : "Centang semua"}
      </Button>

      <ul aria-label="Transaksi dari e-statement" className="border-t border-rule">
        {rows.map((row, index) => (
          <li key={`${row.date}-${index}`} className="border-b border-rule">
            <label className="group flex min-h-14 cursor-pointer items-center gap-3.5 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
              <input
                type="checkbox"
                checked={ticked[index]}
                onChange={() => setTicked((current) => current.map((value, at) => (at === index ? !value : value)))}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex size-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] border-control text-primary-foreground group-has-checked:border-primary group-has-checked:bg-primary"
              >
                <Check size={14} strokeWidth={3} className="opacity-0 group-has-checked:opacity-100" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base text-text">{row.note || categoryLabel(row.category, row.type)}</span>
                <span className="block text-sm text-text-muted">
                  {shortDay(row.date)} · {categoryLabel(row.category, row.type)}
                  {row.recorded ? " · Sudah tercatat" : ""}
                </span>
              </span>
              <span className="shrink-0 text-base text-text tabular-nums">
                {row.type === "income" ? "+" : ""}
                {formatRupiah(row.amount)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {/* Stays at the bottom of the sheet while the list scrolls under it. */}
      <div className="sticky bottom-0 -mx-5 mt-3 bg-surface px-5 pt-3 md:-mx-6 md:px-6">
        <p role="status" className="min-h-5 text-sm text-text-muted">
          {message}
        </p>
        <Button onClick={() => void save()} disabled={pending || count === 0} className="mt-1 w-full">
          {pending ? "Menyimpan…" : count === 0 ? "Pilih transaksinya dulu" : `Simpan ${count} transaksi`}
        </Button>
      </div>
    </div>
  );
}
