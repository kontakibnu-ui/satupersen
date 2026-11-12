import { z } from "zod";

/**
 * Shape the daily summary must have (PRD.md §5). The model is asked for exactly
 * this object, and nothing reaches the database before it validates here.
 */
export const dailySummarySchema = z.object({
  summary: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).min(2).max(3),
  improvements: z.array(z.string().trim().min(1)).min(2).max(3),
  tomorrow_tip: z.string().trim().min(1),
  ai_dimension_score: z.number().int().min(0).max(10),
  score_reason: z.string().trim().min(1),
  risk_flag: z.boolean(),
  language: z.enum(["id", "en", "mixed"]),
});

export type DailySummary = z.infer<typeof dailySummarySchema>;

export const languageSchema = z.enum(["id", "en", "mixed"]);

export type SummaryLanguage = z.infer<typeof languageSchema>;

/**
 * Read before anything else. On a day with crisis signs the app throws the
 * model's text away and shows the fixed text from src/config/crisis.ts with no
 * score (PRD.md §7, DESIGN.md §9), so only these two fields matter then.
 */
export const crisisSignalSchema = z.object({
  risk_flag: z.boolean(),
  language: languageSchema,
});

const JSON_OBJECT_PATTERN = /\{[\s\S]*\}/;

/**
 * DeepSeek often answers with a fenced code block or a sentence around the
 * JSON (AGENTS.md §6), so the text is sliced down to the outermost braces
 * before validation.
 */
function extractJsonObject(raw: string): unknown {
  const match = JSON_OBJECT_PATTERN.exec(raw);

  if (!match) {
    throw new Error("Model output did not contain a JSON object");
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error("Model output contained text that is not valid JSON");
  }
}

export function parseCrisisSignal(raw: string): z.infer<typeof crisisSignalSchema> {
  const candidate = extractJsonObject(raw);
  const parsed = crisisSignalSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error));
  }

  return parsed.data;
}

/**
 * What the model writes for a report (REPORT-3). The numbers are never the
 * model's: averages and percentages come from code, and these fields are only
 * the words around them. The short weekly version has no patterns.
 */
export const briefReportSchema = z.object({
  trend: z.string().trim().min(1),
  focus: z.string().trim().min(1),
});

export const fullReportSchema = z.object({
  trend: z.string().trim().min(1),
  patterns: z.array(z.string().trim().min(1)).min(2).max(3),
  focus: z.string().trim().min(1),
  insights: z.array(z.string().trim().min(1)).max(2),
});

export type BriefReportText = z.infer<typeof briefReportSchema>;
export type FullReportText = z.infer<typeof fullReportSchema>;

export function parseBriefReport(raw: string): BriefReportText {
  const parsed = briefReportSchema.safeParse(extractJsonObject(raw));

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "report"));
  }

  return parsed.data;
}

export function parseFullReport(raw: string): FullReportText {
  const parsed = fullReportSchema.safeParse(extractJsonObject(raw));

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "report"));
  }

  return parsed.data;
}

export function parseDailySummary(raw: string): DailySummary {
  const candidate = extractJsonObject(raw);
  const parsed = dailySummarySchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error));
  }

  return parsed.data;
}

function describeIssues(error: z.ZodError, schemaName = "daily summary"): string {
  const issues = error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

  return `Model output did not match the ${schemaName} schema: ${issues}`;
}

/**
 * A WhatsApp reply (PRD.md §6): at most about 80 words, so a generous character
 * cap catches a model that ignores the length rule, and `risk_flag` lets the app
 * swap the reply for the fixed crisis text (PRD.md §7).
 */
export const chatReplySchema = z.object({
  reply: z.string().trim().min(1).max(700),
  risk_flag: z.boolean(),
});

export type ChatReply = z.infer<typeof chatReplySchema>;

export function parseChatReply(raw: string): ChatReply {
  const parsed = chatReplySchema.safeParse(extractJsonObject(raw));

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "chat reply"));
  }

  return parsed.data;
}

/**
 * The token counts OpenRouter reports with every completion (PRD.md §8). Only
 * the fields the meter needs are read; `cost` is in USD and may be absent.
 */
export const tokenUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  cost: z.number().nonnegative().optional(),
});

export type ReportedUsage = { promptTokens: number; completionTokens: number; costUsd: number | null };

/** Null when the answer carried no usable usage block; the call itself still counts as answered. */
export function parseTokenUsage(raw: unknown): ReportedUsage | null {
  const parsed = tokenUsageSchema.safeParse(raw);

  if (!parsed.success) {
    return null;
  }

  return {
    promptTokens: parsed.data.prompt_tokens,
    completionTokens: parsed.data.completion_tokens,
    costUsd: parsed.data.cost ?? null,
  };
}
