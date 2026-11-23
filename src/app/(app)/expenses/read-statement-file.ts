import type * as PdfJs from "pdfjs-dist";
import {
  linesFromTextItems,
  MAX_STATEMENT_FILE_BYTES,
  MAX_STATEMENT_PAGES,
  statementFormatOf,
  type PositionedText,
} from "@/lib/statement";

/**
 * Reads the text of an e-statement on the phone (PRD.md EXP-9), so the file
 * itself is never uploaded.
 *
 * - PDF: PDF.js, the same copy the Ruang baca reader uses, served from
 *   /reader on this site (scripts/copy-reader-assets.mjs), because the
 *   Content-Security-Policy allows no other origin. A password is only handed
 *   to PDF.js here and goes nowhere else.
 * - CSV: the file's own text, UTF-8 or else Windows-1252.
 * - Excel: SheetJS from vendor/sheetjs, every sheet written out as rows.
 *
 * Each library is loaded only when a file of its kind is picked.
 */

export type StatementStage = { kind: "opening" } | { kind: "page"; page: number; pages: number };

export type StatementFileProblem =
  | "too-big"
  | "format"
  | "too-many-pages"
  | "password-needed"
  | "password-wrong"
  | "broken";

export class StatementFileError extends Error {
  readonly problem: StatementFileProblem;

  constructor(problem: StatementFileProblem) {
    super(problem);
    this.name = "StatementFileError";
    this.problem = problem;
  }
}

const PDFJS_DIR = "/reader/foliate/vendor/pdfjs";

export async function readStatementFile(
  file: File,
  options: { password?: string; onStage: (stage: StatementStage) => void },
): Promise<string> {
  if (file.size > MAX_STATEMENT_FILE_BYTES) {
    throw new StatementFileError("too-big");
  }

  const format = statementFormatOf(file.name, file.type);

  if (format === null) {
    throw new StatementFileError("format");
  }

  options.onStage({ kind: "opening" });

  if (format === "csv") {
    return decodeText(await file.arrayBuffer());
  }

  if (format === "excel") {
    return readSpreadsheet(await file.arrayBuffer());
  }

  return readPdf(await file.arrayBuffer(), options);
}

function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    // Not valid UTF-8: older bank exports are Windows-1252, which decodes any byte.
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function readSpreadsheet(buffer: ArrayBuffer): Promise<string> {
  let XLSX: typeof import("../../../../vendor/sheetjs/xlsx.mjs");

  try {
    XLSX = await import("../../../../vendor/sheetjs/xlsx.mjs");
  } catch {
    throw new StatementFileError("broken");
  }

  let rows: string[];

  try {
    const workbook = XLSX.read(buffer, { type: "array" });

    rows = workbook.SheetNames.map((name) =>
      // " | " between cells, like a column break read from a PDF.
      XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: " | ", blankrows: false, strip: true }),
    );
  } catch {
    throw new StatementFileError("broken");
  }

  return rows.join("\n");
}

type PdfError = { name?: unknown; code?: unknown };

async function readPdf(
  buffer: ArrayBuffer,
  options: { password?: string; onStage: (stage: StatementStage) => void },
): Promise<string> {
  let pdfjs: typeof PdfJs;

  try {
    // Loaded from this site as it is, not bundled: the same files the reader uses.
    pdfjs = (await import(/* webpackIgnore: true */ `${PDFJS_DIR}/pdf.mjs`)) as typeof PdfJs;
  } catch {
    throw new StatementFileError("broken");
  }

  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_DIR}/pdf.worker.mjs`;

  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password: options.password,
    // No eval (the CSP has none in production) and no font loading: only the text is read.
    isEvalSupported: false,
    disableFontFace: true,
    cMapUrl: `${PDFJS_DIR}/cmaps/`,
    cMapPacked: true,
  });

  let document: Awaited<typeof task.promise>;

  try {
    document = await task.promise;
  } catch (error) {
    await task.destroy();
    const { name, code } = (error ?? {}) as PdfError;

    if (name === "PasswordException") {
      throw new StatementFileError(
        code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "password-wrong" : "password-needed",
      );
    }

    throw new StatementFileError("broken");
  }

  try {
    if (document.numPages > MAX_STATEMENT_PAGES) {
      throw new StatementFileError("too-many-pages");
    }

    const lines: string[] = [];

    for (let number = 1; number <= document.numPages; number += 1) {
      options.onStage({ kind: "page", page: number, pages: document.numPages });

      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const runs: PositionedText[] = [];

      for (const item of content.items) {
        if (!("str" in item)) {
          continue;
        }

        const [, , c, d, x, y] = item.transform as number[];

        runs.push({ str: item.str, x, y, width: item.width, height: item.height || Math.hypot(c, d) });
      }

      lines.push(...linesFromTextItems(runs));
      page.cleanup();
    }

    return lines.join("\n");
  } catch (error) {
    if (error instanceof StatementFileError) {
      throw error;
    }

    throw new StatementFileError("broken");
  } finally {
    await task.destroy();
  }
}
