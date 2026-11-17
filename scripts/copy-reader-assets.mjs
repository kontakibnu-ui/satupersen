// Copies what the Ruang baca reader needs (PRD.md READ-3, READ-8) into
// public/reader, so every file it loads comes from this site: the
// Content-Security-Policy allows no other origin (src/lib/csp.ts). Runs before
// `next dev` and `next build` (package.json); public/reader is not committed.
//
// - vendor/foliate-js: the renderer, pinned to one upstream commit (see its README).
// - pdfjs-dist: PDF.js, which foliate-js's pdf.js imports from ./vendor/pdfjs/.
import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "reader", "foliate");
const pdfjs = join(root, "node_modules", "pdfjs-dist");

rmSync(join(root, "public", "reader"), { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(root, "vendor", "foliate-js"), target, {
  recursive: true,
  filter: (source) => !source.endsWith("README.md"),
});

const pdfFiles = [
  ["build/pdf.mjs", "vendor/pdfjs/pdf.mjs"],
  ["build/pdf.worker.mjs", "vendor/pdfjs/pdf.worker.mjs"],
];

for (const [from, to] of pdfFiles) {
  const destination = join(target, to);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(pdfjs, from), destination);
}

// Character maps and standard fonts, which foliate-js passes to PDF.js.
cpSync(join(pdfjs, "cmaps"), join(target, "vendor", "pdfjs", "cmaps"), { recursive: true });
cpSync(join(pdfjs, "standard_fonts"), join(target, "vendor", "pdfjs", "standard_fonts"), { recursive: true });

console.log("copied the reader assets to public/reader");
