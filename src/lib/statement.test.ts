import { describe, expect, it } from "vitest";
import { MAX_AMOUNT } from "@/lib/expenses";
import { REDACTED_NUMBER } from "@/lib/receipt";
import {
  checkStatementItems,
  hasStatementText,
  linesFromTextItems,
  markRecorded,
  MAX_STATEMENT_NOTE_LENGTH,
  prepareStatementText,
  REDACTED_EMAIL,
  REDACTED_NAME,
  resolveStatementDate,
  splitStatementParts,
  statementFormatOf,
  type PositionedText,
  type StatementReadingItem,
} from "@/lib/statement";

const run = (str: string, x: number, y: number, width = str.length * 5, height = 10): PositionedText => ({
  str,
  x,
  y,
  width,
  height,
});

describe("statementFormatOf (EXP-9: PDF, CSV, dan Excel)", () => {
  it("knows the three kinds by name, whatever the phone says the type is", () => {
    expect(statementFormatOf("mutasi.PDF", "")).toBe("pdf");
    expect(statementFormatOf("mutasi.csv", "application/octet-stream")).toBe("csv");
    expect(statementFormatOf("mutasi.xlsx", "")).toBe("excel");
    expect(statementFormatOf("mutasi.xls", "")).toBe("excel");
    expect(statementFormatOf("file", "application/pdf")).toBe("pdf");
  });

  it("refuses anything else", () => {
    expect(statementFormatOf("foto.jpg", "image/jpeg")).toBeNull();
    expect(statementFormatOf("catatan.txt", "text/plain")).toBeNull();
  });
});

describe("linesFromTextItems (baris dari halaman PDF)", () => {
  it("puts runs on the same height on one line, left to right, top line first", () => {
    const lines = linesFromTextItems([
      run("Saldo", 10, 700),
      run("TRSF", 10, 720),
      run("KE BUDI", 36, 720.5),
    ]);

    expect(lines).toEqual(["TRSF KE BUDI", "Saldo"]);
  });

  it("marks a wide gap as a column break, so two amounts never merge into one long number", () => {
    const lines = linesFromTextItems([run("15/11", 10, 600), run("52,500.00", 200, 600), run("1,234,567.00", 320, 600)]);

    expect(lines).toEqual(["15/11 | 52,500.00 | 1,234,567.00"]);
    expect(prepareStatementText(lines.join("\n"))).toBe("15/11 | 52,500.00 | 1,234,567.00");
  });

  it("joins runs that touch without adding a space inside a word", () => {
    expect(linesFromTextItems([run("Ga", 10, 500, 10), run("ji", 20, 500, 8)])).toEqual(["Gaji"]);
  });

  it("skips empty runs and runs without a position", () => {
    expect(linesFromTextItems([run(" ", 10, 400), run("Kredit", 10, 380), { ...run("x", 0, 0), x: Number.NaN }])).toEqual([
      "Kredit",
    ]);
  });
});

describe("prepareStatementText (EXP-9: yang dikirim sudah disamarkan)", () => {
  it("hides account numbers, card numbers, and email addresses", () => {
    const text = prepareStatementText("No. Rekening : 1234567890\nEmail: budi.s@contoh.co.id\nTRSF KE 0812-3456-7890");

    expect(text).toBe(`No. Rekening : ${REDACTED_NUMBER}\nEmail: ${REDACTED_EMAIL}\nTRSF KE ${REDACTED_NUMBER}`);
  });

  it("hides the user's own name, whole or word by word, in any case", () => {
    const text = prepareStatementText("NAMA : IBNU SULAIMAN\nTRSF DARI Sulaiman\nTOKO IBNUSINA", ["Ibnu Sulaiman"]);

    expect(text).toBe(`NAMA : ${REDACTED_NAME}\nTRSF DARI ${REDACTED_NAME}\nTOKO IBNUSINA`);
  });

  it("ignores names too short to hide safely", () => {
    expect(prepareStatementText("BAYAR KE AL", ["Al"])).toBe("BAYAR KE AL");
  });

  it("squeezes spaces and drops empty lines and lines of nothing but separators", () => {
    expect(prepareStatementText("  Tanggal   Keterangan \n\n , , ,\n |  | \n15/11  Gaji")).toBe("Tanggal Keterangan\n15/11 Gaji");
  });

  it("keeps amounts in the ways statements write them", () => {
    for (const amount of ["1,234,567.00", "1.234.567,00", "52500.00", "Rp 999.999.999"]) {
      expect(prepareStatementText(amount)).toBe(amount);
    }
  });
});

describe("hasStatementText", () => {
  it("needs enough letters or digits", () => {
    expect(hasStatementText(" | - | ")).toBe(false);
    expect(hasStatementText("15/11 TRSF KE BUDI 52,500.00")).toBe(true);
  });
});

describe("splitStatementParts", () => {
  it("splits on line breaks without cutting a row", () => {
    const parts = splitStatementParts(["aaaa", "bbbb", "cccc"].join("\n"), 9);

    expect(parts).toEqual(["aaaa\nbbbb", "cccc"]);
  });

  it("cuts a single line that is longer than one part on its own", () => {
    expect(splitStatementParts("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("keeps every character", () => {
    const text = Array.from({ length: 300 }, (_, index) => `15/11 TRANSAKSI ${index} | 10,000.00`).join("\n");
    const parts = splitStatementParts(text, 4000);

    expect(parts.every((part) => part.length <= 4000)).toBe(true);
    expect(parts.join("\n")).toBe(text);
  });
});

describe("resolveStatementDate (tahun yang tidak tertulis)", () => {
  it("keeps a full date", () => {
    expect(resolveStatementDate("2026-11-15", "2026-11-22")).toBe("2026-11-15");
  });

  it("takes this year when the day is not after today", () => {
    expect(resolveStatementDate("11-15", "2026-11-22")).toBe("2026-11-15");
  });

  it("takes last year when this year's day would be after today", () => {
    expect(resolveStatementDate("12-28", "2027-01-05")).toBe("2026-12-28");
    expect(resolveStatementDate("11-23", "2026-11-22")).toBe("2025-11-23");
  });

  it("refuses days that do not exist and other shapes", () => {
    expect(resolveStatementDate("2026-02-30", "2026-11-22")).toBeNull();
    expect(resolveStatementDate("02-30", "2026-11-22")).toBeNull();
    expect(resolveStatementDate("15/11", "2026-11-22")).toBeNull();
    expect(resolveStatementDate(null, "2026-11-22")).toBeNull();
  });
});

const item = (overrides: Partial<StatementReadingItem>): StatementReadingItem => ({
  date: "2026-11-15",
  type: "expense",
  amount: 52_500,
  category: "makan",
  note: "Bayar makan",
  ...overrides,
});

describe("checkStatementItems (EXP-9 memakai aturan EXP-7 dan EXP-8)", () => {
  const today = "2026-11-22";

  it("keeps good rows and orders them by day, keeping the order within a day", () => {
    const { entries, outOfRange, unusable } = checkStatementItems(
      [
        item({ date: "2026-11-16", note: "Kedua" }),
        item({ date: "2026-11-02", note: "Pertama" }),
        item({ date: "2026-11-16", note: "Ketiga" }),
      ],
      today,
    );

    expect(entries.map((entry) => entry.note)).toEqual(["Pertama", "Kedua", "Ketiga"]);
    expect(outOfRange).toBe(0);
    expect(unusable).toBe(0);
  });

  it("counts rows without a usable amount or day as unusable", () => {
    const { entries, unusable } = checkStatementItems(
      [
        item({ amount: null }),
        item({ amount: 0 }),
        item({ amount: 12.5 }),
        item({ amount: MAX_AMOUNT + 1 }),
        item({ date: null }),
        item({ date: "kemarin" }),
      ],
      today,
    );

    expect(entries).toEqual([]);
    expect(unusable).toBe(6);
  });

  it("skips days more than a year back or after today, and counts them", () => {
    const { entries, outOfRange } = checkStatementItems(
      [item({ date: "2025-11-01" }), item({ date: "2026-11-23" }), item({ date: "2025-11-22" })],
      today,
    );

    expect(entries.map((entry) => entry.date)).toEqual(["2025-11-22"]);
    expect(outOfRange).toBe(2);
  });

  it("turns a category of the wrong type into lainnya", () => {
    const { entries } = checkStatementItems(
      [item({ type: "income", category: "makan" }), item({ type: "expense", category: null }), item({ type: "income", category: "gaji" })],
      today,
    );

    expect(entries.map((entry) => entry.category)).toEqual(["lainnya", "lainnya", "gaji"]);
  });

  it("hides long numbers in notes and keeps them short", () => {
    const { entries } = checkStatementItems(
      [item({ note: "TRSF   KE 1234567890 BUDI" }), item({ note: "x".repeat(300) }), item({ note: null })],
      today,
    );

    expect(entries[0].note).toBe(`TRSF KE ${REDACTED_NUMBER} BUDI`);
    expect(entries[1].note).toHaveLength(MAX_STATEMENT_NOTE_LENGTH);
    expect(entries[2].note).toBe("");
  });

  it("fills in the year of a day written without one", () => {
    expect(checkStatementItems([item({ date: "11-15" })], today).entries[0].date).toBe("2026-11-15");
  });
});

describe("markRecorded (Sudah tercatat)", () => {
  const entry = { date: "2026-11-15", type: "expense" as const, amount: 25_000, category: "makan", note: "" };

  it("marks a row with the same day, direction, and amount as an existing entry", () => {
    expect(markRecorded([entry, { ...entry, type: "income" }, { ...entry, amount: 26_000 }], [{ ...entry }])).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("lets each existing entry match one row only", () => {
    expect(markRecorded([entry, entry], [{ ...entry }])).toEqual([true, false]);
    expect(markRecorded([entry, entry], [{ ...entry }, { ...entry }])).toEqual([true, true]);
  });

  it("marks nothing in an empty cash book", () => {
    expect(markRecorded([entry], [])).toEqual([false]);
  });
});
