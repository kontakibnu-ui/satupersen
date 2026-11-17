# foliate-js (vendored)

The e-book renderer of Ruang baca (PRD.md READ-3), copied from its author's
repository instead of npm: the npm package named `foliate-js` is published by
someone else, and the author says the library has no release yet and its API
may change at any time. Pinning one commit means upstream changes never arrive
unreviewed.

- Source: https://github.com/johnfactotum/foliate-js
- Commit: `78914aef4466eb960965702401634c2cb348e9b1` (2026-05-01, "Use original
  hrefs for external links and add isExternal in fb2.js (#129)")
- License: MIT, see `LICENSE` (copied unchanged)
- Copied on 2026-11-17 with the original line endings. No file is modified.

## What is here

Only what the reader uses for EPUB and PDF:

| File | SHA-256 |
| --- | --- |
| `view.js` | `e0093af921feb03bb58fb51aeedc321fa108a4158d215f6913ecf7925415c945` |
| `paginator.js` | `51cec81572d5d182e231fe68ce9c3b5489a0976b36172060516336ba893565ea` |
| `fixed-layout.js` | `7aee1d15d8e0479b8a6c59a20304b250dafc4c7dc158147a2b2c6bed9e180b4c` |
| `epub.js` | `dfe347495039e9b5991478986ec6b7713cf9efbcd8f475a77ef7b967c5176298` |
| `epubcfi.js` | `e1a688ad5c84bf31f33cef467f92c7a6d060a0f17ec37c1d3c048e9c7b1cf645` |
| `progress.js` | `544f5e90babc0cb31c5caf971a5f06dd6249ec06600cb62f672fa7179811fde1` |
| `overlayer.js` | `d3d3396e3083277ccbd4f17c407621159b22a407107e43ce75ca3014578094fb` |
| `text-walker.js` | `4ad740ab6142b5be428700ef4d270253cef6649cf6e047ae7d2698a7aec65e92` |
| `pdf.js` | `684da69d4366f2fee1e08423d02e727c32c553f2487bba661c6a1870b0508475` |
| `vendor/zip.js` | `2a0d43157e4a447c6e43351225758795b75a33e8dfec10c6767248df2182949a` |
| `vendor/pdfjs/text_layer_builder.css` | `2be9205c98964559f0fb63bac692d002171cee13b1c0da38f7e7ef1966c622b5` |
| `vendor/pdfjs/annotation_layer_builder.css` | `d0b814831f57d907830427eaac02654ba652a423e07c894888e1095b0a63e7a9` |
| `LICENSE` | `b621ffc351fe263bc9b09dd0bc1c9332fda9c462a3904c1e4f0b4d3236b9c28c` |

Left out on purpose: the readers for MOBI, AZW3, FB2, and CBZ (outside the
four formats the user chose), search, text to speech, the demo reader, and
upstream's copy of PDF.js. PDF.js comes from the npm package `pdfjs-dist`,
pinned in `package.json` to 5.5.207, the exact build upstream vendors (the
files are byte-identical apart from line endings, checked 2026-11-17), so
`npm audit` covers it.

## How it is served

`scripts/copy-reader-assets.mjs` copies this folder and the PDF.js build into
`public/reader/foliate/` before `next dev` and `next build`; that folder is
not committed. The reader loads `/reader/foliate/view.js` as a native ES
module, so the relative imports between these files keep working, and every
file comes from this site, as the Content-Security-Policy requires.

## Updating

Pick a new commit, read its diff, copy the same files with their original line
endings (`git -c core.autocrlf=false`), update the commit and the hashes above,
match `pdfjs-dist` to the PDF.js version upstream vendors, and run the reader
tests (`e2e/reader.spec.ts`) before shipping.
