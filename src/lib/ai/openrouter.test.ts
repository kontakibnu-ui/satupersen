import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiConfigError,
  AiOutputError,
  AiProviderError,
  checkExplanation,
  checkReviewAnswers,
  getModelFor,
  readReceipt,
  readStatementPart,
  summarizeDay,
  writeMoneyAnalysis,
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

describe("Belajar: checkExplanation dan checkReviewAnswers (LEARN-2, LEARN-4, LEARN-6)", () => {
  const explanationInput = {
    title: "Fotosintesis",
    source: "Tumbuhan memakai cahaya, air, dan karbon dioksida untuk membuat glukosa dan oksigen.",
    explanation: "Tumbuhan bikin makanan dari cahaya.",
    questionsWanted: true,
  };
  const explanationOutput = {
    summary: "Kamu menangkap bahwa tumbuhan memakai cahaya.",
    correct: ["Tumbuhan memakai cahaya"],
    missing: ["Air dan karbon dioksida sebagai bahan", "Hasilnya glukosa dan oksigen"],
    wrong: [],
    not_in_material: [],
    language: "id",
    questions: [
      { prompt: "Apa bahan fotosintesis?", answer: "Cahaya, air, dan karbon dioksida.", kind: "recall" },
      { prompt: "Apa hasilnya?", answer: "Glukosa dan oksigen.", kind: "recall" },
      { prompt: "Kenapa tumbuhan butuh cahaya?", answer: "Cahaya dipakai untuk membuat glukosa.", kind: "elaboration" },
    ],
  };

  it("memakai model analisa harian, data_collection deny, dan mengembalikan pertanyaan", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(completion(JSON.stringify(explanationOutput)));

    const result = await checkExplanation(explanationInput);

    expect(result.model).toBe("deepseek/test-model");
    expect(result.questions).toHaveLength(3);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("deepseek/test-model");
    expect(body.provider).toEqual({ data_collection: "deny" });
    expect(body.messages[1].content).toContain("Questions wanted: yes");
  });

  it("mencoba ulang sekali lalu gagal jelas, tanpa hasil karangan", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const withoutQuestions = { ...explanationOutput, questions: [] };
    const fetchMock = stubFetch(completion(JSON.stringify(withoutQuestions)), completion("bukan json"));

    await expect(checkExplanation(explanationInput)).rejects.toThrow(AiOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("umpan balik review: percobaan kedua yang benar dipakai", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(
      completion(JSON.stringify({ items: [{ number: 1, feedback: "Sudah benar." }] })),
      completion(
        JSON.stringify({
          items: [
            { number: 1, feedback: "Sudah benar." },
            { number: 2, feedback: "Oksigennya terlewat." },
          ],
        }),
      ),
    );

    const result = await checkReviewAnswers({
      title: "Fotosintesis",
      source: explanationInput.source,
      items: [
        { number: 1, kind: "recall", prompt: "Apa bahannya?", answer: "Cahaya, air, CO2.", userAnswer: "Cahaya dan air" },
        { number: 2, kind: "recall", prompt: "Apa hasilnya?", answer: "Glukosa dan oksigen.", userAnswer: "Glukosa" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.items.map((item) => item.number)).toEqual([1, 2]);
  });

  it("tanpa AI_MODEL_DAILY tidak memilih model sendiri", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch();

    await expect(checkExplanation(explanationInput)).rejects.toThrow(AiConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readReceipt (EXP-7)", () => {
  const reading = {
    found: true,
    type: "expense",
    amount: 50000,
    date: "2026-11-15",
    category: "makan",
    note: "Bayar Warung Bu Sri",
  };
  const input = { text: "Pembayaran Berhasil\nWarung Bu Sri\nRp 50.000\n15 Nov 2026", today: "2026-11-16" };

  const billed = (content: string) => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 300, completion_tokens: 40, cost: 0.0001 },
      }),
  });

  it("sends the locked request shape with the daily model and the screenshot text", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(completion(JSON.stringify(reading)));

    const result = await readReceipt(input);

    expect(result).toEqual({ reading, model: "deepseek/test-model" });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));

    expect(body.model).toBe("deepseek/test-model");
    expect(body.provider).toEqual({ data_collection: "deny" });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content).toContain("Warung Bu Sri");
    expect(body.messages[1].content).toContain("Today's date: 2026-11-16");
  });

  it("retries an unusable answer once and meters both calls", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(billed('{"amount": "lima puluh ribu"}'), billed(JSON.stringify(reading)));
    const usages: unknown[] = [];

    const result = await readReceipt(input, (usage) => usages.push(usage));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.reading).toEqual(reading);
    expect(usages).toHaveLength(2);
  });

  it("gives up after two unusable answers instead of filling the form with a guess", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    stubFetch(completion("maaf, tidak bisa"), completion('{"found": "ya"}'));

    await expect(readReceipt(input)).rejects.toThrow(AiOutputError);
  });

  it("does not pick a model when AI_MODEL_DAILY is empty", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch();

    await expect(readReceipt(input)).rejects.toThrow(AiConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readStatementPart (EXP-9)", () => {
  const reading = {
    transactions: [{ date: "11-15", type: "expense", amount: 52500, category: "makan", note: "Transfer ke Budi" }],
  };
  const input = { text: "15/11 | TRSF KE BUDI | 52,500.00 DB | 1,200,000.00", today: "2026-11-22", part: 1, parts: 2 };

  it("sends the locked request shape with the daily model and the statement part", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(completion(JSON.stringify(reading)));

    const result = await readStatementPart(input);

    expect(result).toEqual({ reading, model: "deepseek/test-model" });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));

    expect(body.provider).toEqual({ data_collection: "deny" });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content).toContain("TRSF KE BUDI");
    expect(body.messages[1].content).toContain("This is part 1 of 2");
  });

  it("retries an unusable answer once, then gives up instead of guessing", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "deepseek/test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const retried = stubFetch(completion('{"transactions": "banyak"}'), completion(JSON.stringify(reading)));

    await expect(readStatementPart(input)).resolves.toMatchObject({ reading });
    expect(retried).toHaveBeenCalledTimes(2);

    stubFetch(completion("maaf"), completion('{"rows": []}'));

    await expect(readStatementPart(input)).rejects.toThrow(AiOutputError);
  });

  it("does not pick a model when AI_MODEL_DAILY is empty", async () => {
    vi.stubEnv("AI_MODEL_DAILY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch();

    await expect(readStatementPart(input)).rejects.toThrow(AiConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("writeMoneyAnalysis (EXP-10)", () => {
  const analysis = { paragraphs: ["Makan paling besar bulan ini."], next_month: "Coba jatah makan mingguan." };
  const input = {
    monthLabel: "November 2026",
    previousLabel: "Oktober 2026",
    running: true,
    throughLabel: "22 November",
    income: 0,
    expense: 25_000,
    previousIncome: 0,
    previousExpense: 0,
    categories: [{ label: "Makan", amount: 25_000, percent: 100, previous: 0 }],
    weeks: [],
    weekdays: [],
    budget: null,
    estimate: null,
    transactions: [{ date: "2026-11-22", type: "expense" as const, category: "Makan", amount: 25_000, note: "Kopi" }],
  };

  it("uses the report model with the locked request shape", async () => {
    vi.stubEnv("AI_MODEL_REPORT", "deepseek/report-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch(completion(JSON.stringify(analysis)));

    await expect(writeMoneyAnalysis(input)).resolves.toEqual({ analysis, model: "deepseek/report-model" });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));

    expect(body.model).toBe("deepseek/report-model");
    expect(body.provider).toEqual({ data_collection: "deny" });
    expect(body.messages[1].content).toContain("Kopi");
  });

  it("retries an unusable answer once, then gives up", async () => {
    vi.stubEnv("AI_MODEL_REPORT", "deepseek/report-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    stubFetch(completion('{"paragraphs": []}'), completion("bukan JSON"));

    await expect(writeMoneyAnalysis(input)).rejects.toThrow(AiOutputError);
  });

  it("does not pick a model when AI_MODEL_REPORT is empty", async () => {
    vi.stubEnv("AI_MODEL_REPORT", "");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = stubFetch();

    await expect(writeMoneyAnalysis(input)).rejects.toThrow(AiConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
