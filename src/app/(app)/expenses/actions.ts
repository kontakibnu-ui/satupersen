"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tokenStanding } from "@/config/plans";
import { AiConfigError, readReceipt, type TokenUsage } from "@/lib/ai/openrouter";
import { recordUsage, tokensUsedThisMonth } from "@/lib/ai/usage";
import { startOfMonthKey, todayKey } from "@/lib/dates";
import { ENTRY_TYPES, isAllowedEntryDate, isCategoryOf, MAX_AMOUNT, MAX_NOTE_LENGTH } from "@/lib/expenses";
import { rateLimitMessage, takeAiRateLimit } from "@/lib/rate-limit";
import {
  hasReadableText,
  MAX_RECEIPT_TEXT_LENGTH,
  prepareReceiptText,
  toReceiptDraft,
  type ReceiptDraft,
} from "@/lib/receipt";
import { getActionContext } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Money entries (expenses and income) and the monthly budget (EXP-1 to EXP-5).
 * The user and the plan are read on the server. Entries are the user's own data
 * and are written with their session; a budget is a premium feature, so it is written with the
 * service role only after the plan is checked here, and the database does not
 * let the browser write it (supabase/migrations/20261029010000_budget_premium_only.sql).
 */

export type ExpenseActionResult = { ok: true } | { ok: false; message: string };

const SESSION_ENDED = "Sesi kamu sudah berakhir. Masuk lagi dulu.";
const GENERIC_FAILURE = "Belum berhasil disimpan. Coba lagi sebentar lagi.";

const amountField = z
  .number("Isi nominalnya dulu.")
  .int("Nominal harus bilangan bulat.")
  .min(1, "Nominalnya harus lebih dari nol.")
  .max(MAX_AMOUNT, "Nominalnya terlalu besar.");

// A category is only valid for its own type: "gaji" is income, "makan" is not.
const expenseFields = z
  .object({
    type: z.enum(ENTRY_TYPES, "Pilih jenisnya dulu."),
    amount: amountField,
    category: z.string("Pilih kategorinya dulu."),
    note: z
      .string()
      .trim()
      .max(MAX_NOTE_LENGTH, `Catatan maksimal ${MAX_NOTE_LENGTH} karakter.`)
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((fields) => isCategoryOf(fields.type, fields.category), {
    message: "Pilih kategorinya dulu.",
    path: ["category"],
  });

const idSchema = z.uuid();

function refresh(): void {
  revalidatePath("/expenses");
}

const DATE_NOT_ALLOWED = "Tanggalnya tidak bisa dipakai. Pilih hari ini atau sebelumnya, paling jauh setahun ke belakang.";

/**
 * EXP-1, EXP-5, EXP-8: two required fields, one optional, and the day. Without
 * a day the entry is dated today by the user's own clock; a day sent by the
 * browser is checked against that same clock, never trusted.
 */
export async function addExpense(input: {
  type: string;
  amount: number;
  category: string;
  note?: string;
  date?: string;
}): Promise<ExpenseActionResult> {
  const parsed = expenseFields.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  const today = todayKey(context.timeZone);
  const date = input.date === undefined ? today : input.date;

  if (typeof date !== "string" || !isAllowedEntryDate(date, today)) {
    return { ok: false, message: DATE_NOT_ALLOWED };
  }

  const { error } = await context.supabase.from("expenses").insert({
    user_id: context.userId,
    date,
    type: parsed.data.type,
    amount: parsed.data.amount,
    category: parsed.data.category,
    note: parsed.data.note,
  });

  if (error) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

/** EXP-2: edit the amount, category, and note. The day and the type of an entry stay. */
export async function updateExpense(input: {
  id: string;
  type: string;
  amount: number;
  category: string;
  note?: string;
}): Promise<ExpenseActionResult> {
  const parsedId = idSchema.safeParse(input.id);
  const parsed = expenseFields.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  }

  if (!parsedId.success) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  const { data, error } = await context.supabase
    .from("expenses")
    .update({ amount: parsed.data.amount, category: parsed.data.category, note: parsed.data.note })
    .eq("id", parsedId.data)
    .eq("user_id", context.userId)
    .eq("type", parsed.data.type)
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ExpenseActionResult> {
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  const { data, error } = await context.supabase
    .from("expenses")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", context.userId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

/**
 * EXP-4: set the monthly budget, from this month on. Premium only (SUB-1); a
 * free account is told so and nothing is written.
 */
export async function setBudget(input: { amount: number }): Promise<ExpenseActionResult> {
  const parsed = amountField.safeParse(input.amount);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  if (context.plan !== "premium") {
    return { ok: false, message: "Budget bulanan ada di Premium." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("budgets")
    .upsert(
      {
        user_id: context.userId,
        month: startOfMonthKey(todayKey(context.timeZone)),
        amount: parsed.data,
      },
      { onConflict: "user_id,month" },
    );

  if (error) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

/** Removes every budget the user set, so the finance part leaves their score again. */
export async function clearBudget(): Promise<ExpenseActionResult> {
  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  if (context.plan !== "premium") {
    return { ok: false, message: "Budget bulanan ada di Premium." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("budgets")
    .delete()
    .eq("user_id", context.userId);

  if (error) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

export type ReceiptReadResult = { ok: true; draft: ReceiptDraft } | { ok: false; message: string };

const RECEIPT_UNREADABLE = "Tulisan di gambar ini tidak terbaca. Coba screenshot yang lebih jelas, atau isi manual.";
const RECEIPT_NOT_FOUND =
  "Nominal transaksi tidak ketemu di gambar ini. Pastikan ini bukti transfer atau pembayaran, atau isi manual.";
const RECEIPT_FAILED = "Gambar belum berhasil dibaca. Coba lagi, atau isi manual.";
const RECEIPT_NOT_CONFIGURED = "Baca screenshot belum dikonfigurasi. Isi manual dulu, ya.";
const RECEIPT_TOKEN_CAP = "Kuota AI bulan ini sudah habis. Isi manual dulu, baca screenshot bisa lagi tanggal 1.";

const receiptInput = z.object({
  // The browser already cut the text; twice the limit leaves room for an
  // edited browser, and the server cuts it again below.
  text: z.string().max(MAX_RECEIPT_TEXT_LENGTH * 2, RECEIPT_UNREADABLE),
});

/**
 * EXP-7: the text of a bank or e-wallet screenshot, read on the phone, turned
 * into the fields of one entry. Nothing is saved here: the user checks the form
 * and saves it through `addExpense`. In order: the text is cut again (long
 * numbers hidden), the rate limit counts the tap (RATE-1), the monthly token cap
 * is checked (PRD.md §8), and the model's reading is made safe for the form.
 * Neither the text nor the reading is logged or stored; only the token counts are.
 */
export async function readReceiptText(input: { text: string }): Promise<ReceiptReadResult> {
  const parsed = receiptInput.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? RECEIPT_UNREADABLE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  const text = prepareReceiptText(parsed.data.text);

  // No model call, so not a tap the rate limit counts (RATE-2).
  if (!hasReadableText(text)) {
    return { ok: false, message: RECEIPT_UNREADABLE };
  }

  const wait = await takeAiRateLimit(context.userId);

  if (wait > 0) {
    return { ok: false, message: rateLimitMessage(wait) };
  }

  // An unreadable total lets the reading through: the cap is soft (PRD.md §8).
  const used = await tokensUsedThisMonth(context.supabase, context.userId, context.timeZone);

  if (used !== null && tokenStanding(context.plan, used).overCap) {
    return { ok: false, message: RECEIPT_TOKEN_CAP };
  }

  const today = todayKey(context.timeZone);
  const usages: TokenUsage[] = [];
  let draft: ReceiptDraft | null;

  try {
    const { reading } = await readReceipt({ text, today }, (usage) => usages.push(usage));
    draft = toReceiptDraft(reading, today);
  } catch (error) {
    if (error instanceof AiConfigError) {
      return { ok: false, message: RECEIPT_NOT_CONFIGURED };
    }

    console.error("reading a receipt failed", {
      userId: context.userId,
      kind: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, message: RECEIPT_FAILED };
  } finally {
    await recordUsage(context.userId, "receipt", usages);
  }

  return draft ? { ok: true, draft } : { ok: false, message: RECEIPT_NOT_FOUND };
}
