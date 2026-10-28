import { describe, expect, it } from "vitest";
import { parseDailySummary } from "@/lib/ai/schemas";

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
