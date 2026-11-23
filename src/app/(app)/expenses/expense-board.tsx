"use client";

import {
  Banknote,
  Briefcase,
  Bus,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Ellipsis,
  FileText,
  Gift,
  GraduationCap,
  HandCoins,
  Plus,
  Receipt,
  ScanText,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BinderSheet, BLEED, ScribbleUnderline, SectionHead } from "@/components/notebook";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, IconBadge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { callAction } from "@/lib/call-action";
import { formatDayLabel, formatMonthLabel } from "@/lib/dates";
import {
  categoriesFor,
  categoryLabel,
  earliestEntryDate,
  isAllowedEntryDate,
  isCategoryOf,
  MAX_NOTE_LENGTH,
  netOf,
  parseAmount,
  type EntryType,
  type MonthComparison,
} from "@/lib/expenses";
import { formatRupiah } from "@/lib/format";
import { hasReadableText, prepareReceiptText, type ReceiptDraft } from "@/lib/receipt";
import { STATEMENT_ACCEPT } from "@/lib/statement";
import { cn } from "@/lib/utils";
import { addExpense, clearBudget, deleteExpense, readReceiptText, setBudget, updateExpense } from "./actions";
import { FilePicker } from "./file-picker";
import { MoneyChart, type MonthBar } from "./money-chart";
import { readImageText, type ReadStage } from "./read-image-text";
import { StatementImport, StatementPremium, type StatementSaved } from "./statement-import";

export type ExpenseItem = {
  id: string;
  type: EntryType;
  amount: number;
  category: string;
  note: string | null;
};
/** `net` is the day's money in minus money out. */
export type DayGroup = { date: string; label: string; net: number; items: ExpenseItem[] };

/** "Rp 5.000", or "−Rp 5.000" when below zero, so a minus is never lost in a thin hyphen. */
function formatSigned(amount: number): string {
  return amount < 0 ? `−${formatRupiah(-amount)}` : formatRupiah(amount);
}

/**
 * The icon of each built-in category in the list and the picker (EXP-3). In
 * the list every icon sits in the same 36 px `primary-soft` circle (§14.3).
 */
const CATEGORY_LOOK: Record<EntryType, Record<string, { icon: LucideIcon }>> = {
  expense: {
    makan: { icon: Utensils },
    transport: { icon: Bus },
    kuliah_kerja: { icon: GraduationCap },
    hiburan: { icon: Clapperboard },
    tagihan: { icon: Receipt },
    lainnya: { icon: Ellipsis },
  },
  income: {
    gaji: { icon: Banknote },
    uang_saku: { icon: HandCoins },
    usaha: { icon: Store },
    bonus: { icon: Gift },
    lainnya: { icon: Briefcase },
  },
};

function lookFor(type: EntryType, category: string): { icon: LucideIcon } {
  return CATEGORY_LOOK[type][category] ?? CATEGORY_LOOK[type].lainnya;
}

type Editing =
  | { kind: "add"; type: EntryType; draft?: ReceiptDraft }
  | { kind: "edit"; item: ExpenseItem }
  | { kind: "budget" }
  | { kind: "receipt"; image: File; id: number }
  | { kind: "statement"; file: File; id: number; reviewing: boolean }
  | { kind: "statement-premium" };

/**
 * The Uang screen (DESIGN.md §2, §8, §14.3 "Uang"). The month is a cash book on
 * a binder sheet: what is left (money in minus money out) is the focus,
 * underlined in pen; until income is logged it is the total spent. The single
 * primary button "Catat uang" sits right under the sheet and opens the form on
 * money out, so an expense still takes one tap; money in is the other half of
 * the switch at the top of the form (EXP-5, DESIGN.md §15.3). Under it a plain
 * card sets the month against the month before and the last few months
 * (EXP-6), and the month's entries follow on a second binder sheet, one section
 * head per day. Going over the budget is written as a plain sentence and the
 * bar stays the same colour: no red anywhere except deleting data (§12).
 *
 * "Dari screenshot bank" (EXP-7) is a quiet link under that switch: the
 * picture is read on the phone, the form opens filled in, and the user checks
 * it before saving. A new entry can carry an earlier day (EXP-8); when that day
 * is in another month, a line under the card links to it. "Dari e-statement"
 * (EXP-9, Premium) sits beside it: a whole statement becomes rows to tick.
 */
export function ExpenseBoard({
  monthLabel,
  previousMonth,
  nextMonth,
  isCurrentMonth,
  income,
  expense,
  comparison,
  bars,
  budget,
  isPremium,
  groups,
  today,
  analysis,
}: {
  monthLabel: string;
  previousMonth: string;
  nextMonth: string | null;
  isCurrentMonth: boolean;
  income: number;
  expense: number;
  comparison: MonthComparison;
  bars: MonthBar[];
  budget: number | null;
  isPremium: boolean;
  groups: DayGroup[];
  /** The user's today, from their profile's time zone. */
  today: string;
  /** The row to the Analisa screen (EXP-10), when the month has money out. */
  analysis: { title: string; fact: string; href: string } | null;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [savedElsewhere, setSavedElsewhere] = useState<string | null>(null);
  const [statementSaved, setStatementSaved] = useState<StatementSaved | null>(null);
  const readCount = useRef(0);

  const clearStatus = () => {
    setNotice(undefined);
    setSavedElsewhere(null);
    setStatementSaved(null);
  };

  const startAdd = (type: EntryType, draft?: ReceiptDraft) => {
    clearStatus();
    setEditing({ kind: "add", type, draft });
  };

  const startReading = (image: File) => {
    clearStatus();
    readCount.current += 1;
    setEditing({ kind: "receipt", image, id: readCount.current });
  };

  const startStatement = (file: File) => {
    clearStatus();
    readCount.current += 1;
    setEditing({ kind: "statement", file, id: readCount.current, reviewing: false });
  };

  const onStatementSaved = (result: StatementSaved) => {
    setEditing(null);
    setStatementSaved(result);
  };

  const onEntrySaved = (date: string) => {
    setEditing(null);

    if (date.slice(0, 7) !== today.slice(0, 7)) {
      setSavedElsewhere(date);
    }
  };

  const openBudget = () => {
    if (!isPremium) {
      setNotice("Budget bulanan ada di Premium.");
      return;
    }

    setNotice(undefined);
    setEditing({ kind: "budget" });
  };

  const hasIncome = income > 0;
  const left = netOf({ income, expense });
  const remaining = budget === null ? null : budget - expense;
  const usedPercent = budget === null ? 0 : Math.min(100, Math.round((expense / budget) * 100));
  const hasHistory = bars.some((bar) => bar.income > 0 || bar.expense > 0);

  return (
    <>
      <PageHeader title="Uang" description="Catat uang masuk dan keluar, lihat ke mana uangmu pergi." />

      {/* DESIGN.md §15.1: from 1024 px the cash book and the month's entries take
          the left column, the one button and the progress card the right one.
          Below that the right column is "contents", so the phone order stays:
          cash book, button, progress, entries. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-x-10">
        <div className="lg:col-start-1 lg:row-start-1">
          <BinderSheet aria-label={`Buku kas ${monthLabel}`} className="mt-6 text-text">
            <div className="-mx-2.5 -mt-1.5 flex items-center justify-between gap-2">
              <Link
                href={`/expenses?bulan=${previousMonth}`}
                aria-label="Bulan sebelumnya"
                className="flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
              >
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
              </Link>
              <h2 className="font-heading text-base font-bold">{monthLabel}</h2>
              {nextMonth ? (
                <Link
                  href={`/expenses?bulan=${nextMonth}`}
                  aria-label="Bulan berikutnya"
                  className="flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
                >
                  <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
                </Link>
              ) : (
                <span aria-hidden="true" className="size-11" />
              )}
            </div>

            <p className="mt-1.5 text-sm text-text-muted">{hasIncome ? "Sisa uang bulan ini" : "Total pengeluaran bulan ini"}</p>
            <p className="mt-0.5 font-heading text-[36px] leading-[1.15] font-bold tracking-[-0.02em] text-primary tabular-nums">
              <ScribbleUnderline>{formatSigned(hasIncome ? left : expense)}</ScribbleUnderline>
            </p>

            {hasIncome ? (
              <dl className={cn(BLEED, "mt-[18px] border-t-[3px] border-double border-rule-strong")}>
                <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
                  <dt className="text-text-muted">Masuk</dt>
                  <dd className="tabular-nums">{formatRupiah(income)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
                  <dt className="text-text-muted">Keluar</dt>
                  <dd className="tabular-nums">{formatRupiah(expense)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-text-muted">Catat pemasukan supaya sisa uangmu kelihatan.</p>
            )}

            {remaining !== null && budget !== null ? (
              <div className="mt-3.5">
                <p className="text-sm text-text-muted tabular-nums">
                  {remaining >= 0
                    ? `Sisa budget ${formatRupiah(remaining)} dari ${formatRupiah(budget)}`
                    : `Lewat ${formatRupiah(-remaining)} dari budget ${formatRupiah(budget)}`}
                </p>
                <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
                </div>
              </div>
            ) : null}

            {isCurrentMonth ? (
              <Button variant="link" onClick={openBudget} className="mt-1 gap-2 text-sm font-semibold text-primary">
                <Target aria-hidden="true" size={16} strokeWidth={1.8} />
                {budget === null ? "Atur budget" : "Ubah budget"}
              </Button>
            ) : null}
          </BinderSheet>

          <p role="status" className="mt-2 text-sm text-text-muted">
            {notice}
            {statementSaved ? (
              <>
                {statementSaved.saved} transaksi tersimpan.
                {statementSaved.month !== today.slice(0, 7) ? (
                  <>
                    {" "}
                    <Link
                      href={`/expenses?bulan=${statementSaved.month}`}
                      className="font-semibold text-text underline underline-offset-4"
                    >
                      Lihat {formatMonthLabel(`${statementSaved.month}-01`)}
                    </Link>
                  </>
                ) : null}
              </>
            ) : null}
            {savedElsewhere ? (
              <>
                Tersimpan di {formatDayLabel(savedElsewhere)} {savedElsewhere.slice(0, 4)}.{" "}
                <Link
                  href={`/expenses?bulan=${savedElsewhere.slice(0, 7)}`}
                  className="font-semibold text-text underline underline-offset-4"
                >
                  Lihat bulan itu
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col">
          {isCurrentMonth ? (
            // DESIGN.md §15.3: one button for money in and out; the type, and the
            // screenshot, are chosen inside the sheet.
            <Button onClick={() => startAdd("expense")} className="mt-2 w-full lg:mt-6">
              <Plus aria-hidden="true" size={20} strokeWidth={2.2} />
              Catat uang
            </Button>
          ) : null}

          {analysis ? (
            // DESIGN.md §16.2 (arah C): one plain card row, like the Akun menu, to the Analisa screen.
            <Link
              href={analysis.href}
              className="mt-6 flex min-h-15 items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-2.5 transition-colors duration-200 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconBadge icon={ChartLine} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-text">{analysis.title}</span>
                <span className="block truncate text-sm text-text-muted">{analysis.fact}</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.6} className="shrink-0 text-text-muted" />
            </Link>
          ) : null}

          {hasHistory ? (
            <Card as="section" aria-label="Perkembangan uang" className="mt-6">
              <h2 className="font-heading text-base font-bold text-text">Perkembangan</h2>
              <ComparisonLines
                comparison={comparison}
                hasIncome={hasIncome || comparison.previous.income > 0}
                isCurrentMonth={isCurrentMonth}
              />
              <div className="mt-4">
                <MoneyChart
                  months={bars}
                  description={`Uang masuk dan keluar ${bars.length} bulan terakhir, sampai ${bars[bars.length - 1].fullLabel}`}
                />
              </div>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          {groups.length === 0 ? (
            <Card as="div" className="mt-6 flex flex-col items-center py-10 text-center">
              <IconBadge icon={Wallet} size="lg" />
              <p className="mt-4 max-w-sm text-base text-text-muted">
                Belum ada catatan uang di bulan ini. Catat yang pertama, nominalnya saja sudah cukup.
              </p>
            </Card>
          ) : (
            // The month's entries on a binder sheet like a cash book (§14.3): one
            // section head per day with the day's total, rows on pale rules.
            <BinderSheet as="div" className="mt-6">
              {groups.map((group, groupIndex) => (
                <section key={group.date} aria-label={group.label} className={groupIndex > 0 ? "mt-[22px]" : undefined}>
                  <SectionHead
                    title={group.label}
                    aside={
                      <>
                        {group.net > 0 ? "+" : ""}
                        {formatSigned(group.net)}
                      </>
                    }
                  />
                  <ul className={cn(groupIndex === groups.length - 1 && "[&>li:last-child]:border-b-0")}>
                    {group.items.map((item) => {
                      const look = lookFor(item.type, item.category);

                      return (
                        <li key={item.id} className="border-b border-rule">
                          <button
                            type="button"
                            onClick={() => setEditing({ kind: "edit", item })}
                            className="flex min-h-14 w-full items-center gap-3.5 py-2 text-left text-base text-text transition-colors duration-200 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <IconBadge icon={look.icon} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{categoryLabel(item.category, item.type)}</span>
                              {item.note ? <span className="block truncate text-sm text-text-muted">{item.note}</span> : null}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {item.type === "income" ? "+" : ""}
                              {formatRupiah(item.amount)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </BinderSheet>
          )}
        </div>
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={sheetTitle(editing)}
      >
        {editing?.kind === "budget" ? (
          <BudgetForm current={budget} onDone={() => setEditing(null)} />
        ) : editing?.kind === "statement-premium" ? (
          <StatementPremium onManual={() => startAdd("expense")} />
        ) : editing?.kind === "statement" ? (
          <StatementImport
            key={editing.id}
            file={editing.file}
            onChooseAnother={startStatement}
            onManual={() => startAdd("expense")}
            onReview={() =>
              setEditing((current) => (current?.kind === "statement" ? { ...current, reviewing: true } : current))
            }
            onSaved={onStatementSaved}
          />
        ) : editing?.kind === "receipt" ? (
          <ReceiptReader
            key={editing.id}
            image={editing.image}
            onRead={(draft) => startAdd(draft.type, draft)}
            onChooseAnother={startReading}
            onManual={() => startAdd("expense")}
          />
        ) : editing?.kind === "edit" ? (
          <ExpenseForm
            // A different entry starts a fresh form.
            key={editing.item.id}
            type={editing.item.type}
            item={editing.item}
            today={today}
            onDone={() => setEditing(null)}
          />
        ) : editing?.kind === "add" ? (
          <ExpenseForm
            // A different type, or a reading, starts a fresh form.
            key={`${editing.type}-${editing.draft ? "draft" : "blank"}`}
            type={editing.type}
            item={null}
            draft={editing.draft}
            today={today}
            onDone={() => setEditing(null)}
            onAdded={onEntrySaved}
            onPickImage={startReading}
            onPickStatement={isPremium ? startStatement : undefined}
            onStatementLocked={isPremium ? undefined : () => setEditing({ kind: "statement-premium" })}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function sheetTitle(editing: Editing | null): string {
  if (editing?.kind === "budget") {
    return "Budget bulanan";
  }

  if (editing?.kind === "receipt") {
    return "Isi dari screenshot";
  }

  if (editing?.kind === "statement") {
    return editing.reviewing ? "Cek hasil e-statement" : "Dari e-statement";
  }

  if (editing?.kind === "statement-premium") {
    return "Dari e-statement";
  }

  if (editing?.kind === "edit") {
    return editing.item.type === "income" ? "Ubah pemasukan" : "Ubah pengeluaran";
  }

  if (editing?.draft) {
    return "Cek hasil screenshot";
  }

  return "Catat uang";
}

const READ_STAGE_TEXT: Record<ReadStage | "tidying", string> = {
  preparing: "Menyiapkan pembaca gambar…",
  reading: "Membaca tulisan di gambar…",
  tidying: "Merapikan hasilnya…",
};

/**
 * Reads one chosen picture (EXP-7): the text on the phone first, then the server
 * turns it into the fields of one entry. Closing the sheet mid-way drops the
 * result. Every failure says what to do next: another picture, or the empty form.
 */
function ReceiptReader({
  image,
  onRead,
  onChooseAnother,
  onManual,
}: {
  image: File;
  onRead: (draft: ReceiptDraft) => void;
  onChooseAnother: (image: File) => void;
  onManual: () => void;
}) {
  const [stage, setStage] = useState<ReadStage | "tidying">("preparing");
  const [percent, setPercent] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const onReadRef = useRef(onRead);

  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  useEffect(() => {
    let active = true;

    async function run() {
      let text: string;

      try {
        text = prepareReceiptText(
          await readImageText(image, (next, fraction) => {
            if (!active) {
              return;
            }

            setStage(next);
            setPercent(next === "reading" ? Math.round(fraction * 100) : null);
          }),
        );
      } catch {
        if (active) {
          setFailure("Gambar ini belum bisa dibaca di perangkatmu. Coba gambar lain, atau isi manual.");
        }
        return;
      }

      if (!active) {
        return;
      }

      if (!hasReadableText(text)) {
        setFailure("Tulisan di gambar ini tidak terbaca. Coba screenshot yang lebih jelas, atau isi manual.");
        return;
      }

      setStage("tidying");
      setPercent(null);

      let result: Awaited<ReturnType<typeof readReceiptText>>;

      try {
        result = await readReceiptText({ text });
      } catch {
        if (active) {
          setFailure("Koneksi terputus saat membaca gambar. Coba lagi, atau isi manual.");
        }
        return;
      }

      if (!active) {
        return;
      }

      if (result.ok) {
        onReadRef.current(result.draft);
      } else {
        setFailure(result.message);
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [image]);

  if (failure) {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <p role="alert" className="text-base text-text">
          {failure}
        </p>
        <FilePicker
          accept="image/*"
          onPick={onChooseAnother}
          className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
        >
          Pilih gambar lain
        </FilePicker>
        <Button variant="link" onClick={onManual} className="self-center">
          Isi manual
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3" aria-busy="true">
      <p role="status" className="text-base text-text">
        {READ_STAGE_TEXT[stage]}
        {percent !== null ? <span className="tabular-nums"> {percent}%</span> : null}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-surface-muted" />
      </div>
      <p className="text-sm text-text-muted">
        Gambarnya dibaca di perangkatmu dan tidak diunggah. Hanya tulisannya, dengan nomor rekening disamarkan, yang
        dikirim untuk dirapikan AI.
      </p>
    </div>
  );
}

/**
 * This month set against the month before (EXP-6), in plain sentences with an
 * arrow for the direction. More or less is not good or bad here, so neither gets
 * a colour (DESIGN.md §12). A running month is set against the same days of the
 * month before, and the sentence says so.
 */
function ComparisonLines({
  comparison,
  hasIncome,
  isCurrentMonth,
}: {
  comparison: MonthComparison;
  hasIncome: boolean;
  isCurrentMonth: boolean;
}) {
  if (comparison.previousEmpty) {
    return <p className="mt-1 text-sm text-text-muted">Belum ada catatan di bulan sebelumnya untuk dibandingkan.</p>;
  }

  const lines = [{ key: "expense", change: comparison.expenseChange, noun: "Pengeluaran" }];

  if (hasIncome) {
    lines.push({ key: "net", change: comparison.netChange, noun: "Sisa uang" });
  }

  return (
    <>
      <p className="mt-1 text-sm text-text-muted">
        {isCurrentMonth ? "Dibanding periode yang sama bulan lalu" : "Dibanding bulan sebelumnya"}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {lines.map((line) => {
          const Icon = line.change < 0 ? TrendingDown : TrendingUp;

          return (
            <li key={line.key} className="flex items-center gap-3 text-base text-text">
              <Icon aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-text-muted" />
              <span>
                {line.change === 0
                  ? `${line.noun} sama persis`
                  : `${line.noun} ${formatRupiah(Math.abs(line.change))} ${line.change > 0 ? "lebih banyak" : "lebih sedikit"}`}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** "Rp" prefix, a numeric keypad on phones, and the thousands dots added while typing. */
function AmountField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (digits: string) => void;
  label: string;
}) {
  const shown = value === "" ? "" : new Intl.NumberFormat("id-ID").format(Number(value));

  return (
    <label className="block text-sm font-semibold text-text">
      {label}
      <span className="mt-1.5 flex min-h-16 items-center gap-2 rounded-xl border border-control bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
        <span aria-hidden="true" className="text-sm font-bold text-text-muted">
          Rp
        </span>
        <input
          data-autofocus
          inputMode="numeric"
          autoComplete="off"
          value={shown}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="0"
          className="min-h-14 w-full min-w-0 bg-transparent font-heading text-[28px] font-bold text-primary tabular-nums placeholder:text-text-muted focus:outline-none"
        />
      </span>
    </label>
  );
}

/** A choice drawn as a pill: the categories, and the type of a screenshot entry. */
const CHOICE_CHIP_CLASS =
  "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-control bg-transparent px-3.5 text-sm text-text transition-colors duration-200 ease-out has-checked:border-primary has-checked:bg-primary-soft has-checked:font-bold has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary";

/** One half of the type switch at the top of a new entry (DESIGN.md §6 "Kontrol segmen"). */
const SEGMENT_CLASS =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-full text-sm text-text-muted transition-colors duration-200 ease-out has-checked:bg-surface has-checked:font-bold has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary";

/**
 * Adds or edits one entry. A new entry carries a day (EXP-8), today unless the
 * user picks an earlier one; an existing entry keeps its day and type (EXP-2).
 * Filled from a screenshot (EXP-7), the form says so, keeps the type switchable
 * in case the reading got the direction wrong, and saves nothing until "Simpan".
 */
function ExpenseForm({
  type: initialType,
  item,
  draft,
  today,
  onDone,
  onAdded,
  onPickImage,
  onPickStatement,
  onStatementLocked,
}: {
  type: EntryType;
  item: ExpenseItem | null;
  draft?: ReceiptDraft;
  today: string;
  onDone: () => void;
  /** Called instead of onDone after a new entry is saved, with its day. */
  onAdded?: (date: string) => void;
  /** A new entry can start from a screenshot instead (EXP-7). */
  onPickImage?: (image: File) => void;
  /** Premium: many entries can start from a statement file instead (EXP-9). */
  onPickStatement?: (file: File) => void;
  /** Free: the same link explains that statements are a Premium feature. */
  onStatementLocked?: () => void;
}) {
  const [type, setType] = useState<EntryType>(initialType);
  const categories = categoriesFor(type);
  const noun = type === "income" ? "pemasukan" : "pengeluaran";
  const [digits, setDigits] = useState(item ? String(item.amount) : draft ? String(draft.amount) : "");
  const [category, setCategory] = useState<string | null>(
    item
      ? (categories.find((entry) => entry.value === item.category)?.value ?? "lainnya")
      : (draft?.category ?? null),
  );
  const [note, setNote] = useState(item?.note ?? draft?.note ?? "");
  const [date, setDate] = useState(draft?.date ?? today);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function changeType(next: EntryType) {
    setType(next);

    if (category !== null && !isCategoryOf(next, category)) {
      setCategory(null);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = parseAmount(digits);

    if (amount === null) {
      setMessage("Isi nominalnya dulu.");
      return;
    }

    if (category === null) {
      setMessage("Pilih kategorinya dulu.");
      return;
    }

    if (!item && !isAllowedEntryDate(date, today)) {
      setMessage("Pilih tanggal hari ini atau sebelumnya, paling jauh setahun ke belakang.");
      return;
    }

    setPending(true);
    setMessage(undefined);

    const result = await callAction(() =>
      item
        ? updateExpense({ id: item.id, type, amount, category, note })
        : addExpense({ type, amount, category, note, date }),
    );

    setPending(false);

    if (result.ok) {
      if (!item && onAdded) {
        onAdded(date);
      } else {
        onDone();
      }
      return;
    }

    setMessage(result.message);
  }

  async function remove() {
    if (!item) {
      return;
    }

    setPending(true);
    const result = await callAction(() => deleteExpense(item.id));
    setPending(false);

    if (result.ok) {
      onDone();
      return;
    }

    setMessage(result.message);
    setConfirmingDelete(false);
  }

  return (
    // noValidate: the date limits are explained in the form's own words, not the browser's.
    <form noValidate onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-[18px]">
      {draft ? (
        <>
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-text">
            Diisi dari screenshot. Cek nominal, jenis, dan tanggalnya dulu sebelum disimpan.
          </p>
          <div role="radiogroup" aria-label="Jenis" className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "expense", label: "Uang keluar" },
                { value: "income", label: "Uang masuk" },
              ] as const
            ).map((entry) => (
              <label key={entry.value} className={CHOICE_CHIP_CLASS}>
                <input
                  type="radio"
                  name="type"
                  value={entry.value}
                  checked={type === entry.value}
                  onChange={() => changeType(entry.value)}
                  className="sr-only"
                />
                {entry.label}
              </label>
            ))}
          </div>
        </>
      ) : null}

      {!item && !draft ? (
        // DESIGN.md §15.3: money out is the default, so an expense is still one tap away.
        <div className="flex flex-col gap-1">
          <div role="radiogroup" aria-label="Jenis" className="grid grid-cols-2 rounded-full bg-surface-muted p-1">
            {(
              [
                { value: "expense", label: "Uang keluar" },
                { value: "income", label: "Uang masuk" },
              ] as const
            ).map((entry) => (
              <label key={entry.value} className={SEGMENT_CLASS}>
                <input
                  type="radio"
                  name="type"
                  value={entry.value}
                  checked={type === entry.value}
                  onChange={() => changeType(entry.value)}
                  className="sr-only"
                />
                {entry.label}
              </label>
            ))}
          </div>
          {/* DESIGN.md §16.1: the two ways to fill from the bank, side by side. */}
          <div className="flex flex-wrap gap-x-5">
            {onPickImage ? (
              <FilePicker
                accept="image/*"
                onPick={onPickImage}
                className={buttonVariants({ variant: "link", className: "text-sm font-semibold" })}
              >
                <ScanText aria-hidden="true" size={18} strokeWidth={2} />
                Dari screenshot bank
              </FilePicker>
            ) : null}
            {onPickStatement ? (
              <FilePicker
                accept={STATEMENT_ACCEPT}
                onPick={onPickStatement}
                className={buttonVariants({ variant: "link", className: "text-sm font-semibold" })}
              >
                <FileText aria-hidden="true" size={18} strokeWidth={2} />
                Dari e-statement
              </FilePicker>
            ) : onStatementLocked ? (
              <Button variant="link" onClick={onStatementLocked} className="text-sm font-semibold">
                <FileText aria-hidden="true" size={18} strokeWidth={2} />
                Dari e-statement
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <AmountField label="Nominal" value={digits} onChange={setDigits} />

      <div>
        <p id="category-label" className="text-sm font-semibold text-text">
          Kategori
        </p>
        <div role="radiogroup" aria-labelledby="category-label" className="mt-1.5 flex flex-wrap gap-2">
          {categories.map((entry) => (
            <label key={entry.value} className={CHOICE_CHIP_CLASS}>
              <input
                type="radio"
                name="category"
                value={entry.value}
                checked={category === entry.value}
                onChange={() => setCategory(entry.value)}
                className="sr-only"
              />
              {(() => {
                const Icon = lookFor(type, entry.value).icon;

                return <Icon aria-hidden="true" size={16} strokeWidth={2} />;
              })()}
              {entry.label}
            </label>
          ))}
        </div>
      </div>

      <label className="block text-sm font-semibold text-text">
        Catatan (opsional)
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          autoComplete="off"
          placeholder={type === "income" ? "Contoh: gaji bulan ini" : "Contoh: makan siang"}
          className="mt-1.5 font-serif font-normal text-primary"
        />
      </label>

      {item ? null : (
        <label className="block text-sm font-semibold text-text">
          Tanggal
          <Input
            type="date"
            value={date}
            min={earliestEntryDate(today)}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1.5 font-normal"
          />
        </label>
      )}

      <p role="status" className="min-h-5 text-sm text-text-muted">
        {message}
      </p>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>

      {item ? (
        confirmingDelete ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-text">Hapus {noun} ini?</span>
            <span className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => void remove()}
                className="border-danger text-danger"
              >
                Ya, hapus
              </Button>
              <Button variant="link" className="min-w-11" onClick={() => setConfirmingDelete(false)}>
                Batal
              </Button>
            </span>
          </div>
        ) : (
          <Button variant="link" onClick={() => setConfirmingDelete(true)} className="self-center text-danger">
            Hapus {noun}
          </Button>
        )
      ) : null}
    </form>
  );
}

function BudgetForm({ current, onDone }: { current: number | null; onDone: () => void }) {
  const [digits, setDigits] = useState(current === null ? "" : String(current));
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = parseAmount(digits);

    if (amount === null) {
      setMessage("Isi nominal budgetnya dulu.");
      return;
    }

    setPending(true);
    setMessage(undefined);
    const result = await callAction(() => setBudget({ amount }));
    setPending(false);

    if (result.ok) {
      onDone();
      return;
    }

    setMessage(result.message);
  }

  async function clear() {
    setPending(true);
    const result = await callAction(() => clearBudget());
    setPending(false);

    if (result.ok) {
      onDone();
      return;
    }

    setMessage(result.message);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
      <AmountField label="Budget per bulan" value={digits} onChange={setDigits} />

      <p className="text-sm text-text-muted">
        Budget ini berlaku mulai bulan ini dan terus dipakai sampai kamu mengubahnya.
      </p>

      <p role="status" className="min-h-5 text-sm text-text-muted">
        {message}
      </p>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>

      {current !== null ? (
        <Button variant="link" disabled={pending} onClick={() => void clear()} className="self-center text-danger">
          Hapus budget
        </Button>
      ) : null}
    </form>
  );
}
