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
 * Belajar: the check of a "Jelaskan dengan kata sendiri" (LEARN-2). The model
 * compares the explanation with the user's own material only. Items are short
 * so a list cannot swallow the screen; a model that ignores the length rule is
 * caught here and retried (LEARN-6).
 */
const feedbackItemSchema = z.string().trim().min(1).max(300);

export const explanationFeedbackSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  correct: z.array(feedbackItemSchema).max(4),
  missing: z.array(feedbackItemSchema).max(4),
  wrong: z.array(feedbackItemSchema).max(3),
  not_in_material: z.array(feedbackItemSchema).max(2),
  language: languageSchema,
});

export type ExplanationFeedback = z.infer<typeof explanationFeedbackSchema>;

export const studyQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(800),
  kind: z.enum(["recall", "elaboration"]),
});

export type StudyQuestion = z.infer<typeof studyQuestionSchema>;

/** The first check also writes the review questions: 3 to 5, at least one elaboration. */
export const studyQuestionsSchema = z
  .array(studyQuestionSchema)
  .min(3)
  .max(5)
  .refine((questions) => questions.some((question) => question.kind === "elaboration"), {
    message: "at least one question must be an elaboration question",
  });

export function parseExplanationCheck(
  raw: string,
  questionsWanted: boolean,
): { feedback: ExplanationFeedback; questions: StudyQuestion[] } {
  const candidate = extractJsonObject(raw);
  const parsed = explanationFeedbackSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "explanation check"));
  }

  if (!questionsWanted) {
    return { feedback: parsed.data, questions: [] };
  }

  const questions = studyQuestionsSchema.safeParse((candidate as { questions?: unknown }).questions);

  if (!questions.success) {
    throw new Error(describeIssues(questions.error, "study questions"));
  }

  return { feedback: parsed.data, questions: questions.data };
}

/**
 * Belajar: feedback on one review session (LEARN-4), one item per numbered
 * answer. The numbers must be exactly the ones that were sent, each once, so a
 * model that skips or invents an answer is retried instead of shown.
 */
export const reviewFeedbackSchema = z.object({
  items: z
    .array(
      z.object({
        number: z.number().int().min(1).max(5),
        feedback: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(5),
});

export type ReviewFeedbackItem = z.infer<typeof reviewFeedbackSchema>["items"][number];

export function parseReviewFeedback(raw: string, expectedNumbers: number[]): ReviewFeedbackItem[] {
  const parsed = reviewFeedbackSchema.safeParse(extractJsonObject(raw));

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "review feedback"));
  }

  const got = parsed.data.items.map((item) => item.number).sort((a, b) => a - b);
  const wanted = [...expectedNumbers].sort((a, b) => a - b);

  if (got.length !== wanted.length || got.some((number, index) => number !== wanted[index])) {
    throw new Error(
      `Model output did not match the review feedback schema: answered ${got.join(",")} instead of ${wanted.join(",")}`,
    );
  }

  return parsed.data.items;
}

/**
 * Uang: what the model read from the text of a bank or e-wallet screenshot
 * (PRD.md EXP-7). Only the shape is strict here; whether the amount, the
 * category, and the day are acceptable is decided by `toReceiptDraft`
 * (src/lib/receipt.ts), so a wrong guess empties a field instead of failing the
 * whole reading.
 */
export const receiptReadingSchema = z.object({
  found: z.boolean(),
  type: z.enum(["expense", "income"]).nullable(),
  // zod 4 numbers already refuse Infinity and NaN.
  amount: z.number().nullable(),
  date: z.string().trim().max(20).nullable(),
  category: z.string().trim().max(40).nullable(),
  note: z.string().trim().max(300).nullable(),
});

export type ReceiptReading = z.infer<typeof receiptReadingSchema>;

export function parseReceiptReading(raw: string): ReceiptReading {
  const parsed = receiptReadingSchema.safeParse(extractJsonObject(raw));

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "receipt reading"));
  }

  return parsed.data;
}

/**
 * Uang: the transactions the model listed from one part of a statement
 * (PRD.md EXP-9). Only the shape is strict here; whether each amount, category,
 * and day is acceptable is decided by `checkStatementItems` (src/lib/statement.ts),
 * so one wrong row is dropped instead of failing the whole part.
 */
export const statementReadingSchema = z.object({
  transactions: z
    .array(
      z.object({
        date: z.string().trim().max(20).nullable(),
        type: z.enum(["expense", "income"]),
        // zod 4 numbers already refuse Infinity and NaN.
        amount: z.number().nullable(),
        category: z.string().trim().max(40).nullable(),
        note: z.string().trim().max(300).nullable(),
      }),
    )
    .max(300),
});

export type StatementReading = z.infer<typeof statementReadingSchema>;

export function parseStatementReading(raw: string): StatementReading {
  const parsed = statementReadingSchema.safeParse(extractJsonObject(raw));

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "statement reading"));
  }

  return parsed.data;
}

/**
 * Uang: the premium "Analisa uang" of one month (PRD.md EXP-10), as stored in
 * `money_analyses`. Strict, because the text is shown as it is: an answer of
 * the wrong shape or length is retried once and then reported as failed.
 */
export const moneyAnalysisSchema = z.object({
  paragraphs: z.array(z.string().trim().min(1).max(320)).min(1).max(3),
  next_month: z.string().trim().min(1).max(180),
});

export type MoneyAnalysis = z.infer<typeof moneyAnalysisSchema>;

export function parseMoneyAnalysis(raw: string): MoneyAnalysis {
  const parsed = moneyAnalysisSchema.safeParse(extractJsonObject(raw));

  if (!parsed.success) {
    throw new Error(describeIssues(parsed.error, "money analysis"));
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
