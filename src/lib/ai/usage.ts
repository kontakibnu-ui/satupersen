import type { SupabaseClient } from "@supabase/supabase-js";
import { tokenStanding, type Plan, type TokenStanding } from "@/config/plans";
import { chatReply, generateReport, type TokenUsage } from "@/lib/ai/openrouter";
import type { ChatTurn, ReportPromptInput } from "@/lib/ai/prompts";
import { startOfLocalMonth } from "@/lib/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The AI token meter (PRD.md §8). Every billed call is stored in `ai_usage`
 * with the counts OpenRouter reported, and the monthly total decides whether an
 * account is past its soft cap (src/config/plans.ts). Server only: it writes
 * with the service role. Nothing but ids and statuses is ever logged.
 */

export type AiFeature = "daily" | "chat" | "report" | "study" | "receipt";

/** Stores the calls of one feature run; a failed write is logged and never blocks the user. */
export async function recordUsage(userId: string, feature: AiFeature, usages: TokenUsage[]): Promise<void> {
  if (usages.length === 0) {
    return;
  }

  const { error } = await createSupabaseAdminClient()
    .from("ai_usage")
    .insert(
      usages.map((usage) => ({
        user_id: userId,
        feature,
        model: usage.model,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        cost_usd: usage.costUsd,
      })),
    );

  if (error) {
    console.error("recording ai usage failed", { userId, feature });
  }
}

/**
 * Tokens used since the start of the user's local month. `client` may be the
 * user's own session (row level security limits the sum to their rows) or the
 * service role. Null when the total cannot be read: the cap is soft, so callers
 * let the request through rather than blocking on a read error.
 */
export async function tokensUsedThisMonth(
  client: SupabaseClient,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<number | null> {
  const { data, error } = await client.rpc("ai_tokens_since", {
    p_user: userId,
    p_since: startOfLocalMonth(timeZone, now).toISOString(),
  });

  if (error) {
    console.error("reading ai usage failed", { userId });
    return null;
  }

  return Number(data ?? 0);
}

/** The month so far against the plan's soft cap; an unreadable total counts as 0. */
export async function monthlyStanding(
  client: SupabaseClient,
  userId: string,
  plan: Plan,
  timeZone: string,
  now: Date = new Date(),
): Promise<TokenStanding & { known: boolean }> {
  const used = await tokensUsedThisMonth(client, userId, timeZone, now);

  return { ...tokenStanding(plan, used ?? 0), known: used !== null };
}

/** generateReport with its calls recorded against the user the report is for. */
export async function meteredReport(
  input: ReportPromptInput,
  userId: string,
): ReturnType<typeof generateReport> {
  const usages: TokenUsage[] = [];

  try {
    return await generateReport(input, (usage) => usages.push(usage));
  } finally {
    await recordUsage(userId, "report", usages);
  }
}

/** chatReply with its calls recorded against the user who wrote on WhatsApp. */
export async function meteredChatReply(turns: ChatTurn[], userId: string): ReturnType<typeof chatReply> {
  const usages: TokenUsage[] = [];

  try {
    return await chatReply(turns, (usage) => usages.push(usage));
  } finally {
    await recordUsage(userId, "chat", usages);
  }
}
