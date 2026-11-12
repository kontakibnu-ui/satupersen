import { describe, expect, it } from "vitest";
import { parseBriefReport, parseDailySummary, parseFullReport, parseTokenUsage } from "@/lib/ai/schemas";

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
