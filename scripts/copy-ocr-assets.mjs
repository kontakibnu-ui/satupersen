// Copies the files "Isi dari screenshot" needs (PRD.md EXP-7) from node_modules
// into public/ocr, so the browser reads a screenshot with files from this site
// only: the Content-Security-Policy allows no other origin (next.config.ts),
// and the picture never leaves the phone. Runs before `next dev` and
// `next build` (package.json), so the files always match the installed
// versions; public/ocr is not committed.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(root, "node_modules");
const target = join(root, "public", "ocr");

// tesseract.js picks one of these by what the device supports, with the LSTM
// engine only (OEM 1, its default); `src/app/(app)/expenses/read-image-text.ts`
// points corePath at the folder. The 4.0.0_best_int data is what tesseract.js
// itself loads for that engine.
const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/ind/4.0.0_best_int/ind.traineddata.gz", "lang/ind.traineddata.gz"],
];

rmSync(target, { recursive: true, force: true });

for (const [from, to] of files) {
  const destination = join(target, to);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(modules, from), destination);
}

console.log(`copied ${files.length} OCR files to public/ocr`);
