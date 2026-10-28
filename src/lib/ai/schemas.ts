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

export function parseDailySummary(raw: string): DailySummary {
  const candidate = extractJsonObject(raw);
  const parsed = dailySummarySchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error));
  }

  return parsed.data;
}

function describeIssues(error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

  return `Model output did not match the daily summary schema: ${issues}`;
}
