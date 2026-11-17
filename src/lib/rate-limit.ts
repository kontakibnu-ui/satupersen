import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The per user rate limit on AI calls (PRD.md RATE-1 to RATE-3, approved by the
 * user on 2026-11-15 on the condition that normal use is never disturbed).
 *
 * The count lives in the `rate_limits` table and moves through one database
 * function, so every Vercel instance sees the same number. One bucket is shared
 * by "Analisa hari ini" and the Belajar checks: normal use stays far below 5 a
 * minute, so only rapid repeated taps or a script ever reach it.
 *
 * Server only: it writes with the service role.
 */
export const AI_RATE_LIMIT = { bucket: "ai", limit: 5, windowSeconds: 60 } as const;

/**
 * Counts one tap that is about to call the model and answers how many seconds
 * to wait; 0 means go ahead. Call it once per tap, before the model: the retry
 * a model call makes on unusable output is not a new tap (RATE-2).
 *
 * An unreadable count lets the request through and logs only the user id
 * (RATE-3): a database hiccup must not block someone using the app normally,
 * and the daily quotas still apply.
 */
export async function takeAiRateLimit(userId: string): Promise<number> {
  const { data, error } = await createSupabaseAdminClient().rpc("take_rate_limit", {
    p_user: userId,
    p_bucket: AI_RATE_LIMIT.bucket,
    p_limit: AI_RATE_LIMIT.limit,
    p_window_seconds: AI_RATE_LIMIT.windowSeconds,
  });

  if (error || typeof data !== "number") {
    console.error("rate limit could not be read, letting the request through", { userId });
    return 0;
  }

  return data;
}

/** RATE-3: what the screen says while the user waits. */
export function rateLimitMessage(waitSeconds: number): string {
  const seconds = Math.min(AI_RATE_LIMIT.windowSeconds, Math.max(1, Math.ceil(waitSeconds)));

  return `Tunggu sebentar ya, kamu bisa coba lagi dalam ${seconds} detik.`;
}
