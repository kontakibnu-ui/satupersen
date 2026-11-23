import { describe, expect, it } from "vitest";
import {
  parseBriefReport,
  parseDailySummary,
  parseExplanationCheck,
  parseFullReport,
  parseReceiptReading,
  parseMoneyAnalysis,
  parseReviewFeedback,
  parseStatementReading,
  parseTokenUsage,
} from "@/lib/ai/schemas";

describe("parseTokenUsage (meter token, PRD §8)", () => {
  it("membaca bentuk usage yang dikirim OpenRouter (dicek dengan panggilan sungguhan 2026-11-01)", () => {
    expect(
      parseTokenUsage({
        prompt_tokens: 63,
        completion_tokens: 39,
        total_tokens: 102,
        cost: 0.0000065043,
        completion_tokens_details: { reasoning_tokens: 32 },
      }),
    ).toEqual({ promptTokens: 63, completionTokens: 39, costUsd: 0.0000065043 });
  });

  it("biaya boleh tidak ada", () => {
    expect(parseTokenUsage({ prompt_tokens: 10, completion_tokens: 5 })).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      costUsd: null,
    });
  });

  it.each([undefined, null, {}, { prompt_tokens: -1, completion_tokens: 2 }, { prompt_tokens: 1.5, completion_tokens: 2 }])(
    "usage yang tidak bisa dipakai menjadi null: %j",
    (raw) => {
      expect(parseTokenUsage(raw)).toBeNull();
    },
  );
});

const validSummary = {
  summary: "Hari ini kamu menyelesaikan laporan yang tertunda dan tetap jalan pagi.",
  strengths: ["Menyelesaikan laporan", "Jalan pagi tetap dilakukan"],
  improvements: ["Waktu tidur masih terlalu malam", "Belum sempat baca buku"],
  tomorrow_tip: "Coba tidur 30 menit lebih awal.",
  ai_dimension_score: 7,
  score_reason: "Laporan selesai dan olahraga tetap jalan, walau tidur larut.",
  risk_flag: false,
  language: "id",
};

describe("parseDailySummary", () => {
  it("accepts a plain JSON object", () => {
    expect(parseDailySummary(JSON.stringify(validSummary))).toEqual(validSummary);
  });

  it("accepts JSON wrapped in a fenced code block", () => {
    const raw = `Berikut hasilnya:\n\`\`\`json\n${JSON.stringify(validSummary)}\n\`\`\`\nSemoga membantu.`;
    expect(parseDailySummary(raw)).toEqual(validSummary);
  });

  it("accepts JSON surrounded by plain prose", () => {
    const raw = `Ini ringkasannya: ${JSON.stringify(validSummary)} Selesai.`;
    expect(parseDailySummary(raw).ai_dimension_score).toBe(7);
  });

  it("rejects text without a JSON object", () => {
    expect(() => parseDailySummary("Maaf, aku tidak bisa membantu hari ini.")).toThrow(/JSON object/);
  });

  it("rejects a JSON object with the wrong types", () => {
    const raw = JSON.stringify({ ...validSummary, ai_dimension_score: "tujuh" });
    expect(() => parseDailySummary(raw)).toThrow(/ai_dimension_score/);
  });

  it("rejects a score outside 0 to 10", () => {
    const raw = JSON.stringify({ ...validSummary, ai_dimension_score: 11 });
    expect(() => parseDailySummary(raw)).toThrow(/ai_dimension_score/);
  });

  it("rejects fewer than two strengths or improvements", () => {
    expect(() => parseDailySummary(JSON.stringify({ ...validSummary, strengths: ["Satu saja"] }))).toThrow(
      /strengths/,
    );
    expect(() =>
      parseDailySummary(JSON.stringify({ ...validSummary, improvements: ["Satu saja"] })),
    ).toThrow(/improvements/);
  });

  it("rejects an unknown language value", () => {
    const raw = JSON.stringify({ ...validSummary, language: "jv" });
    expect(() => parseDailySummary(raw)).toThrow(/language/);
  });

  it("rejects an empty summary", () => {
    const raw = JSON.stringify({ ...validSummary, summary: "   " });
    expect(() => parseDailySummary(raw)).toThrow(/summary/);
  });

  it("keeps a true risk flag", () => {
    const raw = JSON.stringify({ ...validSummary, risk_flag: true });
    expect(parseDailySummary(raw).risk_flag).toBe(true);
  });
});

describe("report schemas (REPORT-3)", () => {
  it("accepts the short weekly report: a trend and a focus", () => {
    expect(parseBriefReport('{"trend":"Naik pelan.","focus":"Tidur lebih awal."}')).toEqual({
      trend: "Naik pelan.",
      focus: "Tidur lebih awal.",
    });
  });

  it("reads a report the model wrapped in a code fence or a sentence", () => {
    const wrapped = 'Ini laporannya:\n```json\n{"trend":"Stabil.","focus":"Jalan sore."}\n```';
    expect(parseBriefReport(wrapped).focus).toBe("Jalan sore.");
  });

  it("requires two or three patterns in the full report, never one and never four", () => {
    const report = (patterns: string[]) =>
      JSON.stringify({ trend: "t", patterns, focus: "f", insights: [] });

    expect(() => parseFullReport(report(["satu"]))).toThrow(/report schema/);
    expect(parseFullReport(report(["satu", "dua"])).patterns).toHaveLength(2);
    expect(parseFullReport(report(["a", "b", "c"])).patterns).toHaveLength(3);
    expect(() => parseFullReport(report(["a", "b", "c", "d"]))).toThrow(/report schema/);
  });

  it("allows at most two cross-area insights", () => {
    const withInsights = (insights: string[]) =>
      JSON.stringify({ trend: "t", patterns: ["a", "b"], focus: "f", insights });

    expect(parseFullReport(withInsights(["x", "y"])).insights).toHaveLength(2);
    expect(() => parseFullReport(withInsights(["x", "y", "z"]))).toThrow(/report schema/);
  });

  it("rejects an empty trend or focus, and text that is not JSON", () => {
    expect(() => parseBriefReport('{"trend":"","focus":"f"}')).toThrow(/report schema/);
    expect(() => parseBriefReport('{"trend":"t"}')).toThrow(/report schema/);
    expect(() => parseBriefReport("maaf, tidak bisa")).toThrow(/JSON/);
  });
});

describe("Belajar: pemeriksaan penjelasan (LEARN-2, LEARN-6)", () => {
  const feedback = {
    summary: "Kamu sudah menangkap inti fotosintesis.",
    correct: ["Tumbuhan memakai cahaya matahari"],
    missing: ["Hasilnya glukosa dan oksigen"],
    wrong: [],
    not_in_material: [],
    language: "id",
  };
  const questions = [
    { prompt: "Apa bahan fotosintesis?", answer: "Air dan karbon dioksida.", kind: "recall" },
    { prompt: "Apa hasil fotosintesis?", answer: "Glukosa dan oksigen.", kind: "recall" },
    { prompt: "Kenapa daun berwarna hijau?", answer: "Karena klorofil, menurut bahan.", kind: "elaboration" },
  ];

  it("membaca umpan balik dan pertanyaan, juga bila dibungkus blok kode", () => {
    const parsed = parseExplanationCheck(`\`\`\`json\n${JSON.stringify({ ...feedback, questions })}\n\`\`\``, true);
    expect(parsed.feedback.missing).toEqual(["Hasilnya glukosa dan oksigen"]);
    expect(parsed.questions).toHaveLength(3);
  });

  it("pemeriksaan ulang tidak butuh pertanyaan dan mengabaikannya bila ada", () => {
    expect(parseExplanationCheck(JSON.stringify({ ...feedback, questions: [] }), false).questions).toEqual([]);
    expect(parseExplanationCheck(JSON.stringify({ ...feedback, questions }), false).questions).toEqual([]);
  });

  it("pemeriksaan pertama butuh 3 sampai 5 pertanyaan dengan minimal satu elaborasi", () => {
    expect(() => parseExplanationCheck(JSON.stringify({ ...feedback, questions: questions.slice(0, 2) }), true)).toThrow(
      /study questions/,
    );
    const onlyRecall = questions.map((question) => ({ ...question, kind: "recall" }));
    expect(() => parseExplanationCheck(JSON.stringify({ ...feedback, questions: onlyRecall }), true)).toThrow(/elaboration/);
    const six = [...questions, ...questions];
    expect(() => parseExplanationCheck(JSON.stringify({ ...feedback, questions: six }), true)).toThrow(/study questions/);
  });

  it("menolak daftar yang terlalu panjang dan ringkasan kosong", () => {
    const tooMany = { ...feedback, correct: ["a", "b", "c", "d", "e"] };
    expect(() => parseExplanationCheck(JSON.stringify(tooMany), false)).toThrow(/explanation check/);
    expect(() => parseExplanationCheck(JSON.stringify({ ...feedback, summary: " " }), false)).toThrow(/explanation check/);
  });
});

describe("Belajar: umpan balik review (LEARN-4, LEARN-6)", () => {
  it("menerima satu umpan balik untuk setiap nomor yang dikirim", () => {
    const raw = JSON.stringify({
      items: [
        { number: 2, feedback: "Tepat, tapi oksigennya terlewat." },
        { number: 1, feedback: "Sudah benar." },
      ],
    });
    expect(parseReviewFeedback(raw, [1, 2]).map((item) => item.number)).toEqual([2, 1]);
  });

  it("menolak nomor yang terlewat, ganda, atau dikarang", () => {
    const one = JSON.stringify({ items: [{ number: 1, feedback: "Sudah benar." }] });
    expect(() => parseReviewFeedback(one, [1, 2])).toThrow(/instead of 1,2/);
    const doubled = JSON.stringify({
      items: [
        { number: 1, feedback: "a" },
        { number: 1, feedback: "b" },
      ],
    });
    expect(() => parseReviewFeedback(doubled, [1, 2])).toThrow(/review feedback/);
    const invented = JSON.stringify({
      items: [
        { number: 1, feedback: "a" },
        { number: 3, feedback: "b" },
      ],
    });
    expect(() => parseReviewFeedback(invented, [1, 2])).toThrow(/review feedback/);
  });
});

describe("Uang: bacaan screenshot (EXP-7)", () => {
  const reading = {
    found: true,
    type: "expense",
    amount: 52500,
    date: "2026-11-15",
    category: "makan",
    note: "Bayar Warung Bu Sri",
  };

  it("reads the object out of a fenced answer", () => {
    expect(parseReceiptReading(`Berikut hasilnya:\n\`\`\`json\n${JSON.stringify(reading)}\n\`\`\``)).toEqual(reading);
  });

  it("accepts null fields when the screenshot does not show them", () => {
    const empty = { found: false, type: null, amount: null, date: null, category: null, note: null };

    expect(parseReceiptReading(JSON.stringify(empty))).toEqual(empty);
  });

  it("refuses a wrong shape so the call is retried", () => {
    expect(() => parseReceiptReading(JSON.stringify({ ...reading, amount: "52.500" }))).toThrow(/receipt reading/);
    expect(() => parseReceiptReading(JSON.stringify({ ...reading, type: "transfer" }))).toThrow(/receipt reading/);
    expect(() => parseReceiptReading(JSON.stringify({ ...reading, found: undefined }))).toThrow(/receipt reading/);
    expect(() => parseReceiptReading("tidak ada JSON")).toThrow(/JSON object/);
  });
});

describe("parseStatementReading (EXP-9)", () => {
  const reading = {
    transactions: [
      { date: "2026-11-15", type: "expense", amount: 52500, category: "makan", note: "Transfer ke Budi" },
      { date: "11-16", type: "income", amount: null, category: null, note: null },
    ],
  };

  it("accepts a list, with null fields where the statement shows nothing", () => {
    expect(parseStatementReading(`Hasilnya:\n\`\`\`json\n${JSON.stringify(reading)}\n\`\`\``)).toEqual(reading);
    expect(parseStatementReading('{"transactions": []}')).toEqual({ transactions: [] });
  });

  it("refuses a wrong shape so the part is retried", () => {
    const [first] = reading.transactions;

    expect(() => parseStatementReading(JSON.stringify({ transactions: [{ ...first, type: "transfer" }] }))).toThrow(
      /statement reading/,
    );
    expect(() => parseStatementReading(JSON.stringify({ transactions: [{ ...first, amount: "52.500" }] }))).toThrow(
      /statement reading/,
    );
    expect(() => parseStatementReading(JSON.stringify({ items: [] }))).toThrow(/statement reading/);
  });
});

describe("parseMoneyAnalysis (EXP-10)", () => {
  const analysis = { paragraphs: ["Makan paling besar bulan ini."], next_month: "Coba jatah makan mingguan." };

  it("accepts one to three paragraphs and one suggestion", () => {
    expect(parseMoneyAnalysis(JSON.stringify(analysis))).toEqual(analysis);
    expect(parseMoneyAnalysis(JSON.stringify({ ...analysis, paragraphs: ["a", "b", "c"] })).paragraphs).toHaveLength(3);
  });

  it("refuses an empty, overlong, or wrongly shaped answer so it is retried", () => {
    expect(() => parseMoneyAnalysis(JSON.stringify({ ...analysis, paragraphs: [] }))).toThrow(/money analysis/);
    expect(() => parseMoneyAnalysis(JSON.stringify({ ...analysis, paragraphs: ["a", "b", "c", "d"] }))).toThrow(
      /money analysis/,
    );
    expect(() => parseMoneyAnalysis(JSON.stringify({ ...analysis, paragraphs: ["x".repeat(321)] }))).toThrow(
      /money analysis/,
    );
    expect(() => parseMoneyAnalysis(JSON.stringify({ ...analysis, next_month: "" }))).toThrow(/money analysis/);
  });
});
