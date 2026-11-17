import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/config/plans";
import { isStudyAiConfigured } from "@/lib/ai/openrouter";
import { monthlyStanding } from "@/lib/ai/usage";
import { checksLeftToday, checksUsedUpMessage } from "@/lib/study/limits";

/**
 * Reads shared by the Belajar pages and their server actions (PRD.md LEARN-5).
 * `reader` is the user's own session, so row level security limits every count
 * to their rows; each query also filters by the user id itself.
 */

export type AiStatus = { available: true; left: number } | { available: false; reason: string };

export const TOKEN_CAP_MESSAGE =
  "Kuota AI bulan ini sudah habis. Pemeriksaan AI Belajar bisa lagi tanggal 1, dan review dengan penilaian sendiri tetap jalan.";
export const AI_NOT_CONFIGURED_MESSAGE = "Pemeriksaan AI belum dikonfigurasi. Hubungi pengelola aplikasi.";

/** Checks used today: all of the user's, and the ones on this material. Throws when unreadable. */
export async function countChecksToday(
  reader: SupabaseClient,
  userId: string,
  materialId: string,
  today: string,
): Promise<{ accountToday: number; materialToday: number }> {
  const [account, material] = await Promise.all([
    reader.from("study_checks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("date", today),
    reader
      .from("study_checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("material_id", materialId)
      .eq("date", today),
  ]);

  if (account.error || material.error) {
    throw new Error("The study checks of today could not be counted");
  }

  return { accountToday: account.count ?? 0, materialToday: material.count ?? 0 };
}

/**
 * Whether an AI check could run now, and why not. The server action decides
 * again when the check is asked for; this is what the screen shows before.
 */
export async function loadAiStatus(input: {
  reader: SupabaseClient;
  userId: string;
  plan: Plan;
  timeZone: string;
  materialId: string;
  today: string;
}): Promise<AiStatus> {
  if (!isStudyAiConfigured()) {
    return { available: false, reason: AI_NOT_CONFIGURED_MESSAGE };
  }

  const [used, standing] = await Promise.all([
    countChecksToday(input.reader, input.userId, input.materialId, input.today),
    monthlyStanding(input.reader, input.userId, input.plan, input.timeZone),
  ]);

  if (standing.overCap) {
    return { available: false, reason: TOKEN_CAP_MESSAGE };
  }

  const left = checksLeftToday(input.plan, used);

  return left > 0 ? { available: true, left } : { available: false, reason: checksUsedUpMessage(input.plan) };
}
