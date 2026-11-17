import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Minified tesseract.js files copied from node_modules by scripts/copy-ocr-assets.mjs.
    "public/ocr/**",
    // Upstream foliate-js, kept byte for byte (vendor/foliate-js/README.md), and
    // its copy plus PDF.js made by scripts/copy-reader-assets.mjs.
    "vendor/**",
    "public/reader/**",
  ]),
]);

export default eslintConfig;
