"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { startOfMonthKey, todayKey } from "@/lib/dates";
import { ENTRY_TYPES, isCategoryOf, MAX_AMOUNT, MAX_NOTE_LENGTH } from "@/lib/expenses";
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

/** EXP-1, EXP-5: two required fields, one optional, dated today by the user's own clock. */
export async function addExpense(input: {
  type: string;
  amount: number;
  category: string;
  note?: string;
}): Promise<ExpenseActionResult> {
  const parsed = expenseFields.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  const { error } = await context.supabase.from("expenses").insert({
    user_id: context.userId,
    date: todayKey(context.timeZone),
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
