import { describe, expect, it } from "vitest";
import type { ReceiptReading } from "@/lib/ai/schemas";
import { MAX_AMOUNT, MAX_NOTE_LENGTH } from "@/lib/expenses";
import {
  hasReadableText,
  MAX_RECEIPT_TEXT_LENGTH,
  prepareReceiptText,
  REDACTED_NUMBER,
  redactLongNumbers,
  toReceiptDraft,
} from "@/lib/receipt";

describe("redactLongNumbers (EXP-7: nomor panjang tidak keluar dari HP)", () => {
  it("hides account, phone, and reference numbers", () => {
    expect(redactLongNumbers("Rekening tujuan 1234567890")).toBe(`Rekening tujuan ${REDACTED_NUMBER}`);
    expect(redactLongNumbers("BRI 0021 0109 8765 503")).toBe(`BRI ${REDACTED_NUMBER}`);
    expect(redactLongNumbers("Gopay 0812-3456-7890")).toBe(`Gopay ${REDACTED_NUMBER}`);
    expect(redactLongNumbers("+62 812 3456 7890")).toBe(`+62 ${REDACTED_NUMBER}`);
    expect(redactLongNumbers("No. Ref 20261116143012998877")).toBe(`No. Ref ${REDACTED_NUMBER}`);
  });

  it("keeps amounts in every way banks write them", () => {
    for (const amount of ["Rp 1.500.000", "Rp1.500.000,00", "IDR 1,500,000.00", "Rp 150000", "Rp 150 000", "Rp 999999999"]) {
      expect(redactLongNumbers(amount)).toBe(amount);
    }
  });

  it("keeps dates, times, and short codes", () => {
    for (const text of ["16 Nov 2026 14:30:05", "16/11/2026", "2026-11-16", "16-11-26", "PIN 123456", "Kode 1234 567"]) {
      expect(redactLongNumbers(text)).toBe(text);
    }
  });

  it("is safe to apply twice", () => {
    const once = redactLongNumbers("Ke 1234567890 Rp 50.000");

    expect(redactLongNumbers(once)).toBe(once);
  });
});

describe("prepareReceiptText", () => {
  it("squeezes spaces, drops empty lines, and hides long numbers", () => {
    const raw = "  Transfer   Berhasil \n\n\n Ke  BUDI\t SANTOSO \r\n 1234567890 \n Rp 50.000  ";

    expect(prepareReceiptText(raw)).toBe(`Transfer Berhasil\nKe BUDI SANTOSO\n${REDACTED_NUMBER}\nRp 50.000`);
  });

  it("cuts the text to the limit", () => {
    expect(prepareReceiptText("a".repeat(MAX_RECEIPT_TEXT_LENGTH + 500))).toHaveLength(MAX_RECEIPT_TEXT_LENGTH);
  });
});

describe("hasReadableText", () => {
  it("needs a few letters or digits, not just symbols", () => {
    expect(hasReadableText("Rp 50.000 ke Budi")).toBe(true);
    expect(hasReadableText("— | ~ . , ! ''")).toBe(false);
    expect(hasReadableText("ab 12")).toBe(false);
    expect(hasReadableText("")).toBe(false);
  });
});

describe("toReceiptDraft (EXP-7, EXP-8)", () => {
  const today = "2026-11-16";
  const reading = (overrides: Partial<ReceiptReading> = {}): ReceiptReading => ({
    found: true,
    type: "expense",
    amount: 50000,
    date: "2026-11-15",
    category: "makan",
    note: "Bayar Warung Bu Sri",
    ...overrides,
  });

  it("passes a clean reading through", () => {
    expect(toReceiptDraft(reading(), today)).toEqual({
      type: "expense",
      amount: 50000,
      category: "makan",
      date: "2026-11-15",
      note: "Bayar Warung Bu Sri",
    });
  });

  it("gives nothing to fill when no transaction or no usable amount was found", () => {
    expect(toReceiptDraft(reading({ found: false }), today)).toBeNull();
    expect(toReceiptDraft(reading({ amount: null }), today)).toBeNull();
    expect(toReceiptDraft(reading({ amount: 0 }), today)).toBeNull();
    expect(toReceiptDraft(reading({ amount: -5000 }), today)).toBeNull();
    expect(toReceiptDraft(reading({ amount: 12500.5 }), today)).toBeNull();
    expect(toReceiptDraft(reading({ amount: MAX_AMOUNT + 1 }), today)).toBeNull();
  });

  it("treats an unknown direction as money going out", () => {
    expect(toReceiptDraft(reading({ type: null, category: null }), today)?.type).toBe("expense");
  });

  it("empties a category that does not belong to the type", () => {
    expect(toReceiptDraft(reading({ type: "income", category: "makan" }), today)?.category).toBeNull();
    expect(toReceiptDraft(reading({ type: "expense", category: "gaji" }), today)?.category).toBeNull();
    expect(toReceiptDraft(reading({ category: "crypto" }), today)?.category).toBeNull();
    expect(toReceiptDraft(reading({ type: "income", category: "gaji" }), today)?.category).toBe("gaji");
  });

  it("keeps only a day an entry may carry", () => {
    expect(toReceiptDraft(reading({ date: today }), today)?.date).toBe(today);
    expect(toReceiptDraft(reading({ date: "2026-11-17" }), today)?.date).toBeNull();
    expect(toReceiptDraft(reading({ date: "2025-11-15" }), today)?.date).toBeNull();
    expect(toReceiptDraft(reading({ date: "2026-02-30" }), today)?.date).toBeNull();
    expect(toReceiptDraft(reading({ date: "16 Nov 2026" }), today)?.date).toBeNull();
  });

  it("keeps the note short and without long numbers", () => {
    expect(toReceiptDraft(reading({ note: "Transfer ke 1234567890  Budi " }), today)?.note).toBe(
      `Transfer ke ${REDACTED_NUMBER} Budi`,
    );
    expect(toReceiptDraft(reading({ note: "x".repeat(400) }), today)?.note).toHaveLength(MAX_NOTE_LENGTH);
    expect(toReceiptDraft(reading({ note: null }), today)?.note).toBe("");
  });
});
