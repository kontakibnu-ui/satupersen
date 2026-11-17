"use client";

import {
  Banknote,
  Briefcase,
  Bus,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Ellipsis,
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
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, IconBadge, type IconTone } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { formatDayLabel } from "@/lib/dates";
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
import { cn } from "@/lib/utils";
import { addExpense, clearBudget, deleteExpense, readReceiptText, setBudget, updateExpense } from "./actions";
import { MoneyChart, type MonthBar } from "./money-chart";
import { readImageText, type ReadStage } from "./read-image-text";

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

/** How each built-in category looks in the list and the picker (EXP-3). */
const CATEGORY_LOOK: Record<EntryType, Record<string, { icon: LucideIcon; tone: IconTone }>> = {
  expense: {
    makan: { icon: Utensils, tone: "accent" },
    transport: { icon: Bus, tone: "sage" },
    kuliah_kerja: { icon: GraduationCap, tone: "plum" },
    hiburan: { icon: Clapperboard, tone: "primary" },
    tagihan: { icon: Receipt, tone: "neutral" },
    lainnya: { icon: Ellipsis, tone: "neutral" },
  },
  income: {
    gaji: { icon: Banknote, tone: "sage" },
    uang_saku: { icon: HandCoins, tone: "sage" },
    usaha: { icon: Store, tone: "sage" },
    bonus: { icon: Gift, tone: "sage" },
    lainnya: { icon: Briefcase, tone: "neutral" },
  },
};

function lookFor(type: EntryType, category: string): { icon: LucideIcon; tone: IconTone } {
  return CATEGORY_LOOK[type][category] ?? CATEGORY_LOOK[type].lainnya;
}

type Editing =
  | { kind: "add"; type: EntryType; draft?: ReceiptDraft }
  | { kind: "edit"; item: ExpenseItem }
  | { kind: "budget" }
  | { kind: "receipt"; image: File; id: number };

/**
 * The Uang screen (DESIGN.md §2, §6, §8, version 3). What is left of the month
 * (money in minus money out) is the focus; until income is logged it is the
 * total spent. The single primary button adds an expense and sits right under
 * the card, so logging takes one tap, and a secondary button adds income
 * (EXP-5). Under them the month is set against the month before and against the
 * last few months (EXP-6). Going over the
 * budget is written as a plain sentence and the bar stays the same colour: no
 * red anywhere except deleting data (§12).
 *
 * "Isi dari screenshot" (EXP-7) is a quiet link under the two buttons: the
 * picture is read on the phone, the form opens filled in, and the user checks
 * it before saving. A new entry can carry an earlier day (EXP-8); when that day
 * is in another month, a line under the card links to it.
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
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [savedElsewhere, setSavedElsewhere] = useState<string | null>(null);
  const readCount = useRef(0);

  const startAdd = (type: EntryType, draft?: ReceiptDraft) => {
    setNotice(undefined);
    setSavedElsewhere(null);
    setEditing({ kind: "add", type, draft });
  };

  const startReading = (image: File) => {
    setNotice(undefined);
    setSavedElsewhere(null);
    readCount.current += 1;
    setEditing({ kind: "receipt", image, id: readCount.current });
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

      <div className="mt-6 rounded-3xl border border-border bg-surface p-5 text-text md:p-6">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/expenses?bulan=${previousMonth}`}
            aria-label="Bulan sebelumnya"
            className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-muted"
          >
            <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
          </Link>
          <p className="text-sm font-semibold">{monthLabel}</p>
          {nextMonth ? (
            <Link
              href={`/expenses?bulan=${nextMonth}`}
              aria-label="Bulan berikutnya"
              className="-mr-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-muted"
            >
              <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
            </Link>
          ) : (
            <span aria-hidden="true" className="-mr-2 size-11" />
          )}
        </div>

        <p className="mt-4 text-sm text-text-muted">{hasIncome ? "Sisa uang bulan ini" : "Total pengeluaran bulan ini"}</p>
        <p className="mt-1 font-serif text-focus font-light text-primary tabular-nums">
          {formatSigned(hasIncome ? left : expense)}
        </p>

        {hasIncome ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Masuk</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{formatRupiah(income)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Keluar</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{formatRupiah(expense)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-text-muted">Catat pemasukan supaya sisa uangmu kelihatan.</p>
        )}

        {remaining !== null && budget !== null ? (
          <div className="mt-4">
            <p className="text-sm text-text-muted tabular-nums">
              {remaining >= 0
                ? `Sisa budget ${formatRupiah(remaining)}`
                : `Lewat ${formatRupiah(-remaining)} dari budget`}
            </p>
            <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-accent-warm" style={{ width: `${usedPercent}%` }} />
            </div>
          </div>
        ) : null}

        {isCurrentMonth ? (
          <button
            type="button"
            onClick={openBudget}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-control px-4 text-sm font-semibold text-text transition-colors duration-200 hover:bg-surface-muted active:scale-[0.98]"
          >
            <Target aria-hidden="true" size={16} strokeWidth={2.2} />
            {budget === null ? "Atur budget" : "Ubah budget"}
          </button>
        ) : null}
      </div>

      <p role="status" className="mt-2 text-sm text-text-muted">
        {notice}
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

      {isCurrentMonth ? (
        <>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => startAdd("expense")} className="w-full sm:flex-1">
              <Plus aria-hidden="true" size={20} strokeWidth={2.2} />
              Tambah pengeluaran
            </Button>
            <Button variant="secondary" onClick={() => startAdd("income")} className="w-full sm:flex-1">
              <Plus aria-hidden="true" size={20} strokeWidth={2.2} />
              Tambah pemasukan
            </Button>
          </div>
          <div className="mt-1 flex justify-center">
            <ImagePicker onPick={startReading} className={buttonVariants({ variant: "link" })}>
              <ScanText aria-hidden="true" size={18} strokeWidth={2} />
              Isi dari screenshot bank
            </ImagePicker>
          </div>
        </>
      ) : null}

      {hasHistory ? (
        <Card as="section" aria-label="Perkembangan uang" className="mt-4">
          <h2 className="font-serif text-xl font-normal text-text">Perkembangan</h2>
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

      {groups.length === 0 ? (
        <Card as="div" className="mt-4 flex flex-col items-center py-10 text-center">
          <IconBadge icon={Wallet} tone="accent" size="lg" />
          <p className="mt-4 max-w-sm text-base text-text-muted">
            Belum ada catatan uang di bulan ini. Catat yang pertama, nominalnya saja sudah cukup.
          </p>
        </Card>
      ) : (
        // One ledger sheet like a cash book (DESIGN.md §6): a day is a section
        // with its own total, divided by hairlines rather than cards.
        <Card as="div" className="mt-4 divide-y divide-border py-2 md:py-3">
          {groups.map((group) => (
            <section key={group.date} aria-label={group.label} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-text">{group.label}</h2>
                <p className="text-sm font-semibold text-text-muted tabular-nums">
                  {group.net > 0 ? "+" : ""}
                  {formatSigned(group.net)}
                </p>
              </div>
              <ul className="mt-2 flex flex-col">
                {group.items.map((item) => {
                  const look = lookFor(item.type, item.category);

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ kind: "edit", item })}
                        className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 text-left text-base text-text transition-colors duration-200 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <IconBadge icon={look.icon} tone={look.tone} />
                        <span className="min-w-0 flex-1 truncate">
                          {categoryLabel(item.category, item.type)}
                          {item.note ? `, ${item.note}` : ""}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
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
        </Card>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={sheetTitle(editing)}
      >
        {editing?.kind === "budget" ? (
          <BudgetForm current={budget} onDone={() => setEditing(null)} />
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

  if (editing?.kind === "edit") {
    return editing.item.type === "income" ? "Ubah pemasukan" : "Ubah pengeluaran";
  }

  if (editing?.draft) {
    return "Cek hasil screenshot";
  }

  return editing?.type === "income" ? "Pemasukan baru" : "Pengeluaran baru";
}

/**
 * A button that opens the phone's picture picker. A label around the file input
 * rather than input.click() from code: the tap itself opens the picker, which
 * also works from inside the modal sheet, where the page behind is inert. The
 * input stays focusable, so the keyboard reaches it and the ring shows on the
 * label.
 */
function ImagePicker({
  onPick,
  className,
  children,
}: {
  onPick: (image: File) => void;
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
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const image = event.target.files?.[0];
          // Cleared so choosing the same picture again still counts as a change.
          event.target.value = "";

          if (image) {
            onPick(image);
          }
        }}
      />
      {children}
    </label>
  );
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
        <ImagePicker onPick={onChooseAnother} className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
          Pilih gambar lain
        </ImagePicker>
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
    <label className="block text-sm text-text-muted">
      {label}
      <span className="mt-1 flex min-h-11 items-center gap-2 rounded-md border border-control bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
        <span aria-hidden="true" className="text-base text-text-muted">
          Rp
        </span>
        <input
          data-autofocus
          inputMode="numeric"
          autoComplete="off"
          value={shown}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="0"
          className="min-h-11 w-full bg-transparent text-base text-text tabular-nums placeholder:text-text-muted focus:outline-none"
        />
      </span>
    </label>
  );
}

/** A choice drawn as a pill: the categories, and the type of a screenshot entry. */
const CHOICE_CHIP_CLASS =
  "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-control bg-surface px-4 text-sm text-text transition-colors duration-200 ease-out has-checked:border-primary has-checked:bg-primary-soft has-checked:font-semibold has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary";

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
}: {
  type: EntryType;
  item: ExpenseItem | null;
  draft?: ReceiptDraft;
  today: string;
  onDone: () => void;
  /** Called instead of onDone after a new entry is saved, with its day. */
  onAdded?: (date: string) => void;
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

    const result = item
      ? await updateExpense({ id: item.id, type, amount, category, note })
      : await addExpense({ type, amount, category, note, date });

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
    const result = await deleteExpense(item.id);
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
    <form noValidate onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
      {draft ? (
        <>
          <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text">
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

      <AmountField label="Nominal" value={digits} onChange={setDigits} />

      <div role="radiogroup" aria-label="Kategori" className="flex flex-wrap gap-2">
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

      <label className="block text-sm text-text-muted">
        Catatan (opsional)
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          autoComplete="off"
          placeholder={type === "income" ? "Contoh: gaji bulan ini" : "Contoh: makan siang"}
          className="mt-1"
        />
      </label>

      {item ? null : (
        <label className="block text-sm text-text-muted">
          Tanggal
          <Input
            type="date"
            value={date}
            min={earliestEntryDate(today)}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1"
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
    const result = await setBudget({ amount });
    setPending(false);

    if (result.ok) {
      onDone();
      return;
    }

    setMessage(result.message);
  }

  async function clear() {
    setPending(true);
    const result = await clearBudget();
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
