import {
  buildChatUserPrompt,
  buildDailySummaryUserPrompt,
  buildReceiptUserPrompt,
  buildReportUserPrompt,
  buildStudyExplanationUserPrompt,
  buildStudyReviewUserPrompt,
  DAILY_SUMMARY_SYSTEM_PROMPT,
  RECEIPT_SYSTEM_PROMPT,
  REPORT_BRIEF_SYSTEM_PROMPT,
  REPORT_FULL_SYSTEM_PROMPT,
  STUDY_EXPLANATION_SYSTEM_PROMPT,
  STUDY_REVIEW_SYSTEM_PROMPT,
  WHATSAPP_CHAT_SYSTEM_PROMPT,
  type ChatTurn,
  type DailySummaryPromptInput,
  type ReportPromptInput,
  type StudyExplanationPromptInput,
  type StudyReviewPromptInput,
} from "@/lib/ai/prompts";
import {
  parseBriefReport,
  parseChatReply,
  parseCrisisSignal,
  parseDailySummary,
  parseExplanationCheck,
  parseFullReport,
  parseReceiptReading,
  parseReviewFeedback,
  parseTokenUsage,
  type BriefReportText,
  type ChatReply,
  type DailySummary,
  type ExplanationFeedback,
  type FullReportText,
  type ReceiptReading,
  type ReviewFeedbackItem,
  type StudyQuestion,
  type SummaryLanguage,
} from "@/lib/ai/schemas";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/expenses";

/**
 * The only place that talks to OpenRouter (AGENTS.md §6). It runs on the
 * server, always sends provider.data_collection "deny", and never logs entry
 * text. If no provider can satisfy that routing rule OpenRouter answers with an
 * error; the error is surfaced as it is, and the setting is never relaxed.
 */
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 30_000;
const TEMPERATURE = 0.2;
const ATTEMPTS = 2;

export type ModelRole = "daily" | "chat" | "report";

const ENV_BY_ROLE: Record<ModelRole, string> = {
  daily: "AI_MODEL_DAILY",
  chat: "AI_MODEL_CHAT",
  report: "AI_MODEL_REPORT",
};

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

export class AiProviderError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

/** No fallback model on purpose: a missing env value is a configuration error. */
export function getModelFor(role: ModelRole): string {
  const envName = ENV_BY_ROLE[role];
  const value = process.env[envName]?.trim();

  if (!value) {
    throw new AiConfigError(`${envName} is empty, so the AI feature is not configured yet`);
  }

  return value;
}

function getApiKey(): string {
  const value = process.env.OPENROUTER_API_KEY?.trim();

  if (!value) {
    throw new AiConfigError("OPENROUTER_API_KEY is empty, so the AI feature is not configured yet");
  }

  return value;
}

type ChatMessage = { role: "system" | "user"; content: string };

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: unknown;
  error?: { message?: string } | string;
};

/** Tokens of one billed call to the model (PRD.md §8). */
export type TokenUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
};

/**
 * Called once per answered request, retries included, because each attempt is
 * billed. The caller decides where the numbers go (src/lib/ai/usage.ts).
 */
export type UsageSink = (usage: TokenUsage) => void;

const shorten = (value: string, max = 300): string =>
  value.length > max ? `${value.slice(0, max)}...` : value;

function describeProviderError(payload: ChatCompletionResponse, rawBody: string): string {
  const { error } = payload;

  if (typeof error === "string") {
    return shorten(error);
  }

  if (error?.message) {
    return shorten(error.message);
  }

  return shorten(rawBody);
}

async function requestCompletion(
  model: string,
  messages: ChatMessage[],
  onUsage?: UsageSink,
): Promise<string> {
  const apiKey = getApiKey();

  let response: Response;

  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
        provider: { data_collection: "deny" },
        // Token counts and the USD cost come back in `usage`, for the meter.
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AiProviderError(`Could not reach OpenRouter: ${reason}`);
  }

  const rawBody = await response.text();

  let payload: ChatCompletionResponse = {};

  try {
    payload = JSON.parse(rawBody) as ChatCompletionResponse;
  } catch {
    if (response.ok) {
      throw new AiProviderError("OpenRouter answered with text that is not JSON");
    }
  }

  if (!response.ok) {
    throw new AiProviderError(
      `OpenRouter refused the request (${response.status}): ${describeProviderError(payload, rawBody)}`,
      response.status,
    );
  }

  // Counted before the content is checked: an empty or unusable answer is still billed.
  const usage = parseTokenUsage(payload.usage);

  if (usage && onUsage) {
    onUsage({ model, ...usage });
  }

  const content = payload.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim() === "") {
    throw new AiProviderError("OpenRouter answered without any message content");
  }

  return content;
}

export type DailySummaryResult =
  | { kind: "summary"; summary: DailySummary; model: string }
  | { kind: "crisis"; language: SummaryLanguage; model: string };

/**
 * Summarises one diary entry.
 *
 * Two stages on purpose: `risk_flag` is read first, because on a day with
 * crisis signs the model's text is thrown away and the fixed text from
 * src/config/crisis.ts is shown with no score (PRD.md §7). Only normal days
 * must satisfy the full summary schema, and unusable output is retried once
 * before the caller marks the day as failed (AI-2).
 */
export async function summarizeDay(
  input: DailySummaryPromptInput,
  onUsage?: UsageSink,
): Promise<DailySummaryResult> {
  const model = getModelFor("daily");
  const messages: ChatMessage[] = [
    { role: "system", content: DAILY_SUMMARY_SYSTEM_PROMPT },
    { role: "user", content: buildDailySummaryUserPrompt(input) },
  ];

  let lastOutputError: Error | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const content = await requestCompletion(model, messages, onUsage);

    let signal: { risk_flag: boolean; language: SummaryLanguage };

    try {
      signal = parseCrisisSignal(content);
    } catch (error) {
      lastOutputError = error instanceof Error ? error : new Error(String(error));
      continue;
    }

    if (signal.risk_flag) {
      return { kind: "crisis", language: signal.language, model };
    }

    try {
      return { kind: "summary", summary: parseDailySummary(content), model };
    } catch (error) {
      lastOutputError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new AiOutputError(
    `The model did not return a usable summary after ${ATTEMPTS} attempts: ${
      lastOutputError?.message ?? "unknown reason"
    }`,
  );
}

export type GeneratedReport =
  | { variant: "brief"; text: BriefReportText; model: string }
  | { variant: "full"; text: FullReportText; model: string };

/**
 * Writes the words of a report (REPORT-3). The numbers are computed by the
 * caller and passed in; the model only describes them. Output that does not
 * fit the schema is retried once, then reported as an error so the caller can
 * mark the report failed instead of storing something made up (AI-2).
 */
export async function generateReport(
  input: ReportPromptInput,
  onUsage?: UsageSink,
): Promise<GeneratedReport> {
  const model = getModelFor("report");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: input.variant === "brief" ? REPORT_BRIEF_SYSTEM_PROMPT : REPORT_FULL_SYSTEM_PROMPT,
    },
    { role: "user", content: buildReportUserPrompt(input) },
  ];

  let lastOutputError: Error | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const content = await requestCompletion(model, messages, onUsage);

    try {
      return input.variant === "brief"
        ? { variant: "brief", text: parseBriefReport(content), model }
        : { variant: "full", text: parseFullReport(content), model };
    } catch (error) {
      lastOutputError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new AiOutputError(
    `The model did not return a usable report after ${ATTEMPTS} attempts: ${
      lastOutputError?.message ?? "unknown reason"
    }`,
  );
}

/**
 * Belajar uses the model of the daily analysis (AI_MODEL_DAILY): a
 * non-reasoning model that answers in JSON (AGENTS.md §6). No new env var, so
 * no model is chosen here; the ID still comes only from the environment.
 */
const STUDY_MODEL_ROLE: ModelRole = "daily";

/**
 * Whether Belajar's checks can run at all, so a screen can say "not configured"
 * instead of offering a check that is bound to fail. Reads presence only.
 */
export function isStudyAiConfigured(): boolean {
  return Boolean(process.env[ENV_BY_ROLE[STUDY_MODEL_ROLE]]?.trim() && process.env.OPENROUTER_API_KEY?.trim());
}

export type ExplanationCheckResult = {
  feedback: ExplanationFeedback;
  /** Empty unless `questionsWanted` was set (the first check of a material). */
  questions: StudyQuestion[];
  model: string;
};

/**
 * Checks a "Jelaskan dengan kata sendiri" against the material (LEARN-2) and,
 * on the first check, writes the review questions. Unusable output is retried
 * once, then raised so nothing made up is stored or shown (LEARN-6).
 */
export async function checkExplanation(
  input: StudyExplanationPromptInput,
  onUsage?: UsageSink,
): Promise<ExplanationCheckResult> {
  const model = getModelFor(STUDY_MODEL_ROLE);
  const messages: ChatMessage[] = [
    { role: "system", content: STUDY_EXPLANATION_SYSTEM_PROMPT },
    { role: "user", content: buildStudyExplanationUserPrompt(input) },
  ];

  let lastOutputError: Error | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const content = await requestCompletion(model, messages, onUsage);

    try {
      return { ...parseExplanationCheck(content, input.questionsWanted), model };
    } catch (error) {
      lastOutputError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new AiOutputError(
    `The model did not return a usable explanation check after ${ATTEMPTS} attempts: ${
      lastOutputError?.message ?? "unknown reason"
    }`,
  );
}

/**
 * Feedback on one review session (LEARN-4), one item per answer. The schedule
 * is not the model's business: the user's own ratings were stored before this
 * runs. Unusable output is retried once, then raised.
 */
export async function checkReviewAnswers(
  input: StudyReviewPromptInput,
  onUsage?: UsageSink,
): Promise<{ items: ReviewFeedbackItem[]; model: string }> {
  const model = getModelFor(STUDY_MODEL_ROLE);
  const messages: ChatMessage[] = [
    { role: "system", content: STUDY_REVIEW_SYSTEM_PROMPT },
    { role: "user", content: buildStudyReviewUserPrompt(input) },
  ];
  const expectedNumbers = input.items.map((item) => item.number);

  let lastOutputError: Error | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const content = await requestCompletion(model, messages, onUsage);

    try {
      return { items: parseReviewFeedback(content, expectedNumbers), model };
    } catch (error) {
      lastOutputError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new AiOutputError(
    `The model did not return usable review feedback after ${ATTEMPTS} attempts: ${
      lastOutputError?.message ?? "unknown reason"
    }`,
  );
}

/**
 * "Isi dari screenshot" also uses the model of the daily analysis
 * (AI_MODEL_DAILY): short JSON from a non-reasoning model, and no new env var.
 */
const RECEIPT_MODEL_ROLE: ModelRole = "daily";

/**
 * Reads the text of a bank or e-wallet screenshot into the fields of one money
 * entry (PRD.md EXP-7). `text` must already have gone through
 * `prepareReceiptText` (src/lib/receipt.ts). Unusable output is retried once,
 * then raised, so the form is never filled with something made up (AI-2).
 */
export async function readReceipt(
  input: { text: string; today: string },
  onUsage?: UsageSink,
): Promise<{ reading: ReceiptReading; model: string }> {
  const model = getModelFor(RECEIPT_MODEL_ROLE);
  const messages: ChatMessage[] = [
    { role: "system", content: RECEIPT_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildReceiptUserPrompt({
        text: input.text,
        today: input.today,
        expenseCategories: EXPENSE_CATEGORIES,
        incomeCategories: INCOME_CATEGORIES,
      }),
    },
  ];

  let lastOutputError: Error | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const content = await requestCompletion(model, messages, onUsage);

    try {
      return { reading: parseReceiptReading(content), model };
    } catch (error) {
      lastOutputError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new AiOutputError(
    `The model did not return a usable receipt reading after ${ATTEMPTS} attempts: ${
      lastOutputError?.message ?? "unknown reason"
    }`,
  );
}

export type ChatReplyResult = ChatReply & { model: string };

/**
 * The WhatsApp answer to one message (PRD.md §6). Unusable output is retried
 * once, then raised so the caller can say it could not answer instead of
 * sending something made up.
 */
export async function chatReply(turns: ChatTurn[], onUsage?: UsageSink): Promise<ChatReplyResult> {
  const model = getModelFor("chat");
  const messages: ChatMessage[] = [
    { role: "system", content: WHATSAPP_CHAT_SYSTEM_PROMPT },
    { role: "user", content: buildChatUserPrompt(turns) },
  ];

  let lastOutputError: Error | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const content = await requestCompletion(model, messages, onUsage);

    try {
      return { ...parseChatReply(content), model };
    } catch (error) {
      lastOutputError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new AiOutputError(
    `The model did not return a usable chat reply after ${ATTEMPTS} attempts: ${
      lastOutputError?.message ?? "unknown reason"
    }`,
  );
}
