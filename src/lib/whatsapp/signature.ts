import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks the `X-Hub-Signature-256` header Meta puts on every webhook POST
 * (AGENTS.md §6). The value is `sha256=` followed by the hex HMAC-SHA256 of the
 * **raw** request body, keyed with the app secret. It has to be the raw text:
 * parsing the JSON and writing it back out can change spacing and key order,
 * and then no signature would ever match.
 *
 * Returns false for anything that is not a well formed, matching signature, and
 * compares in constant time so the answer does not leak how much of it matched.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const presented = signatureHeader.slice("sha256=".length);

  if (!/^[0-9a-f]{64}$/i.test(presented)) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();

  return timingSafeEqual(expected, Buffer.from(presented, "hex"));
}

/** What Meta would send for a body, for tests and for signing local webhook calls. */
export function signWebhookBody(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}
