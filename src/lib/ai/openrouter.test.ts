import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiConfigError,
  AiOutputError,
  AiProviderError,
  getModelFor,
  summarizeDay,
} from "@/lib/ai/openrouter";

/**
 * fetch is stubbed here on purpose (mocks are only allowed in test files,
 * TASKS.md 2.3). These tests pin down the rules that would otherwise only be
 * proven by a live call: the routing policy, the retry, and the crisis path.
 */

const validSummary = {
  summary: "Kamu menyelesaikan laporan dan tetap jalan pagi.",
  strengths: ["Laporan selesai", "Jalan pagi tetap dilakukan"],
  improvements: ["Tidur masih terlalu malam", "Belum sempat baca"],
  tomorrow_tip: "Coba tidur 30 menit lebih awal.",
  ai_dimension_score: 7,
  score_reason: "Laporan selesai walau tidur larut.",
  risk_flag: false,
  language: "id",
};

const completion = (content: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () =>
    JSON.stringify({ choices: [{ message: { content } }] }),
});

const providerError = (message: string, status: number) => ({
  ok: false,
  status,
  text: async () => JSON.stringify({ error: { message } }),
});

function stubFetch(...responses: unknown[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  fetchMock.mockImplementation(() => {
    throw new Error("unexpected extra fetch call");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const promptInput = {
  date: "2026-10-28",
  content: "Hari ini aku kelarin laporan.",
  timeZone: "Asia/Jakarta",
  context: { mood: 4, energy: 3, habitsDone: 1, habitsTotal: 2 },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getModelFor", () => {
  it("reads the model from the environment", () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");

    expect(getModelFor("daily")).toBe("deepseek/test-model");
  });

  it("refuses to guess a model when the environment is empty", () => {
    vi.stubEnv("AI_MODEL_DAILY", "");

    expect(() => getModelFor("daily")).toThrow(AiConfigError);
    expect(() => getModelFor("daily")).toThrow(/AI_MODEL_DAILY is empty/);
  });
});

describe("summarizeDay", () => {
  it("sends the locked request shape and returns the summary", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(completion(JSON.stringify(validSummary)));

    const result = await summarizeDay(promptInput);

    expect(result).toEqual({
      kind: "summary",
      summary: validSummary,
      model: "deepseek/test-model",
    });

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(body.model).toBe("deepseek/test-model");
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.provider).toEqual({ data_collection: "deny" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns a crisis result without needing the full summary", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    stubFetch(completion(JSON.stringify({ risk_flag: true, language: "id" })));

    const result = await summarizeDay(promptInput);

    expect(result).toEqual({ kind: "crisis", language: "id", model: "deepseek/test-model" });
  });

  it("retries once when the output does not match the schema", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(
      completion("bukan json sama sekali"),
      completion(JSON.stringify(validSummary)),
    );

    const result = await summarizeDay(promptInput);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe("summary");
  });

  it("fails after two unusable answers", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(
      completion(JSON.stringify({ ...validSummary, strengths: ["Cuma satu"] })),
      completion(JSON.stringify({ ...validSummary, ai_dimension_score: 42 })),
    );

    await expect(summarizeDay(promptInput)).rejects.toThrow(AiOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a provider error with its status", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    stubFetch(providerError("No allowed providers for this model", 404));

    const error = await summarizeDay(promptInput).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).status).toBe(404);
    expect((error as Error).message).toMatch(/No allowed providers/);
  });

  it("fails clearly when the API key is missing", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = stubFetch(completion(JSON.stringify(validSummary)));

    await expect(summarizeDay(promptInput)).rejects.toThrow(AiConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails clearly when the network is unreachable", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(summarizeDay(promptInput)).rejects.toThrow(/Could not reach OpenRouter/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
