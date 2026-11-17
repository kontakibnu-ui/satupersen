/**
 * Where to send someone after signing in, from a `next` value that arrives in a
 * URL and so may be written by anyone.
 *
 * Only a path inside this app passes: one slash first, and not "//" or "/\",
 * which a browser reads as another host. Anything else, including "@evil.com"
 * (glued after an origin it would turn the origin into a user name and send the
 * browser to evil.com), falls back to `fallback`.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/today"): string {
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : fallback;
}
