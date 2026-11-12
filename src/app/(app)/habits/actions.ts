"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayKey } from "@/lib/dates";
import { FREE_HABIT_LIMIT } from "@/lib/habits";
import { getActionContext } from "@/lib/session";

/**
 * Habits (HABIT-1 to HABIT-3). Every action reads the user and the plan on the
 * server and checks that the habit is theirs. The free limit is also enforced by
 * a trigger in the database (supabase/migrations/20261029000000_habit_rules.sql),
 * so it holds for a browser that never calls these actions.
 */

export type HabitActionResult = { ok: true } | { ok: false; message: string };

const SESSION_ENDED = "Sesi kamu sudah berakhir. Masuk lagi dulu.";
const GENERIC_FAILURE = "Belum berhasil disimpan. Coba lagi sebentar lagi.";
const LIMIT_REACHED = `Paket gratis memuat ${FREE_HABIT_LIMIT} kebiasaan aktif. Arsipkan satu dulu untuk menambah yang baru.`;

const habitFields = z.object({
  name: z.string().trim().min(1, "Beri nama kebiasaannya dulu.").max(120, "Nama maksimal 120 karakter."),
  identity: z
    .string()
    .trim()
    .max(200, "Identitas maksimal 200 karakter.")
    .optional()
    .transform((value) => (value ? value : null)),
});

const idSchema = z.uuid();

function refresh(): void {
  revalidatePath("/habits");
  revalidatePath("/today");
}

function isLimitError(error: { message?: string }): boolean {
  return error.message?.includes("habit_limit_reached") ?? false;
}

export async function createHabit(input: { name: string; identity?: string }): Promise<HabitActionResult> {
  const parsed = habitFields.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  const { error } = await context.supabase
    .from("habits")
    .insert({ user_id: context.userId, name: parsed.data.name, identity: parsed.data.identity });

  if (error) {
    return { ok: false, message: isLimitError(error) ? LIMIT_REACHED : GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

export async function updateHabit(input: {
  id: string;
  name: string;
  identity?: string;
}): Promise<HabitActionResult> {
  const parsedId = idSchema.safeParse(input.id);
  const parsed = habitFields.safeParse(input);

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
    .from("habits")
    .update({ name: parsed.data.name, identity: parsed.data.identity })
    .eq("id", parsedId.data)
    .eq("user_id", context.userId)
    .is("archived_at", null)
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

/** HABIT-1: archived, not deleted, so the logs and the history stay. */
export async function archiveHabit(id: string): Promise<HabitActionResult> {
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  const { data, error } = await context.supabase
    .from("habits")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("user_id", context.userId)
    .is("archived_at", null)
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  refresh();
  return { ok: true };
}

const toggleSchema = z.object({
  habitId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
});

/**
 * HABIT-2: check or uncheck a habit for today. Only today, by the profile's
 * time zone, can change: a tab left open past midnight must not tick yesterday.
 */
export async function toggleHabit(input: {
  habitId: string;
  date: string;
  done: boolean;
}): Promise<HabitActionResult> {
  const parsed = toggleSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  const context = await getActionContext();

  if (!context) {
    return { ok: false, message: SESSION_ENDED };
  }

  if (parsed.data.date !== todayKey(context.timeZone)) {
    return { ok: false, message: "Hari sudah berganti. Muat ulang halaman ini dulu." };
  }

  const { data: habit, error: habitError } = await context.supabase
    .from("habits")
    .select("id")
    .eq("id", parsed.data.habitId)
    .eq("user_id", context.userId)
    .is("archived_at", null)
    .maybeSingle();

  if (habitError) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  if (!habit) {
    return { ok: false, message: "Kebiasaan ini sudah diarsipkan. Muat ulang halaman ini dulu." };
  }

  const { error } = parsed.data.done
    ? await context.supabase
        .from("habit_logs")
        .upsert(
          { habit_id: habit.id, user_id: context.userId, date: parsed.data.date },
          { onConflict: "habit_id,date", ignoreDuplicates: true },
        )
    : await context.supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", habit.id)
        .eq("user_id", context.userId)
        .eq("date", parsed.data.date);

  if (error) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}
