# SheetJS Community Edition (vendored)

Reads Excel files for "Dari e-statement" on the Uang screen (PRD.md EXP-9), in
the browser, so the file never leaves the phone. Approved by the user on
2026-11-22 together with the Excel format.

Copied here instead of installed from npm, for two reasons:

- The `xlsx` package on the npm registry stopped at 0.18.5, which has known
  security advisories (prototype pollution, regular expression denial of
  service). SheetJS publishes newer versions only on its own CDN.
- npm 12 refuses tarballs from a URL by default (`allow-remote = none`), so a
  `package.json` entry pointing at the CDN would fail on any machine or build
  server with that default.

- Source: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- Tarball SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- Version: 0.20.3
- License: Apache-2.0, see `LICENSE` (copied unchanged)
- Copied on 2026-11-22 with the original bytes. No file is modified.

## What is here

| File | From the tarball | SHA-256 |
| --- | --- | --- |
| `xlsx.mjs` | `package/xlsx.mjs` | `1a0fb062ee9781b13f6687371b202aaefc53b6ce55b530c027e01f9c087b77db` |
| `xlsx.d.mts` | `package/types/index.d.ts` (renamed so TypeScript pairs it with `xlsx.mjs`) | `191e4e6aceae3602aa3a1e9a6bc0e98821d6d5fb787e2bc16e250439482bddb6` |
| `LICENSE` | `package/LICENSE` | `4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64` |

`xlsx.mjs` has no imports of its own. It is loaded with a dynamic `import()`
only after the user picks an Excel file
(`src/app/(app)/expenses/read-statement-file.ts`), so the Uang screen does not
carry it otherwise. The codepage tables (`cpexcel`) are not included: XLSX and
XLS files from Excel 97 onwards store text as Unicode and do not need them.

## Updating

Download the new tarball from `https://cdn.sheetjs.com/`, check its SHA-256,
replace the three files, update the table above, and run `npm test` and
`npm run test:ui`.
