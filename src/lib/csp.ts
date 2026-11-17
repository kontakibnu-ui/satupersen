/**
 * Content-Security-Policy (PRD.md §7, point 6), shared by next.config.ts (every
 * page) and src/proxy.ts (the Ruang baca reader, which adds a second policy).
 *
 * Next.js writes small inline scripts into every page, so the site-wide policy
 * allows 'unsafe-inline' scripts. Everything else is closed: no plugins, no
 * framing of this site, no other origin for scripts, styles, fonts, images, or
 * requests. The dev server needs eval and a websocket for hot reload, which
 * production never gets.
 *
 * - 'wasm-unsafe-eval' lets the browser compile WebAssembly and nothing else:
 *   "Isi dari screenshot" (EXP-7) runs tesseract.js from /ocr in a same-origin
 *   worker.
 * - blob: frames, styles, and fonts are for the reader (READ-3): foliate-js
 *   shows each part of a book in an iframe made from a blob: URL, with the
 *   book's own stylesheets and fonts as blob: URLs too. Images already allowed
 *   blob: for the screenshot preview.
 */
export function siteContentSecurityPolicy(input: { isProduction: boolean; supabaseOrigin: string }): string {
  const { isProduction, supabaseOrigin } = input;

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline' blob:",
    "img-src 'self' data: blob:",
    "font-src 'self' data: blob:",
    "frame-src 'self' blob:",
    `connect-src 'self' ${supabaseOrigin}${isProduction ? "" : " ws: wss:"}`.replace(/\s+/g, " ").trimEnd(),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * The reader's second policy (READ-8). A browser enforces every policy it gets,
 * so this one only has to close what the site-wide policy leaves open: scripts
 * without this request's nonce. Next.js puts the nonce on its own scripts, and
 * 'strict-dynamic' lets the scripts those load in turn (the app's chunks, then
 * foliate-js from /reader) run. A script inside a book has no nonce, and a blob:
 * frame inherits its parent's policies, so it never runs, whatever the iframe's
 * sandbox allows. Deliberately no default-src: every other kind of resource is
 * governed by the site-wide policy alone.
 */
export function readerContentSecurityPolicy(input: { nonce: string; isProduction: boolean }): string {
  const { nonce, isProduction } = input;

  return [
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isProduction ? "" : " 'unsafe-eval'"}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/** True for the reader's pages, which get the second policy. */
export function isReaderPath(pathname: string): boolean {
  return pathname.startsWith("/read/");
}
