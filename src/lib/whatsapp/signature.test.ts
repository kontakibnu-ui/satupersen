import { describe, expect, it } from "vitest";
import { signWebhookBody, verifyWebhookSignature } from "@/lib/whatsapp/signature";

const SECRET = "rahasia-aplikasi-uji";
const BODY = '{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[]}]}';

describe("verifyWebhookSignature (AGENTS.md §6)", () => {
  it("accepts the signature Meta would compute for the raw body", () => {
    expect(verifyWebhookSignature(BODY, signWebhookBody(BODY, SECRET), SECRET)).toBe(true);
  });

  it("matches a value computed independently of this module", () => {
    // HMAC-SHA256("key", "The quick brown fox jumps over the lazy dog"), a well known test vector.
    const known = "sha256=f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";
    expect(verifyWebhookSignature("The quick brown fox jumps over the lazy dog", known, "key")).toBe(true);
  });

  it("rejects a body that changed by even one character", () => {
    const signature = signWebhookBody(BODY, SECRET);
    expect(verifyWebhookSignature(BODY.replace("entry", "entri"), signature, SECRET)).toBe(false);
    expect(verifyWebhookSignature(`${BODY} `, signature, SECRET)).toBe(false);
  });

  it("rejects the same JSON written out differently, because the raw text is what is signed", () => {
    const signature = signWebhookBody(BODY, SECRET);
    const reformatted = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(verifyWebhookSignature(reformatted, signature, SECRET)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(verifyWebhookSignature(BODY, signWebhookBody(BODY, "rahasia-lain"), SECRET)).toBe(false);
  });

  it("rejects a missing, empty, or malformed header", () => {
    const valid = signWebhookBody(BODY, SECRET);
    const hex = valid.slice("sha256=".length);

    expect(verifyWebhookSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "sha256=", SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, hex, SECRET)).toBe(false); // no "sha256=" prefix
    expect(verifyWebhookSignature(BODY, `sha1=${hex}`, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, `sha256=${hex.slice(0, 62)}`, SECRET)).toBe(false); // too short
    expect(verifyWebhookSignature(BODY, `sha256=${hex}00`, SECRET)).toBe(false); // too long
    expect(verifyWebhookSignature(BODY, `sha256=${"z".repeat(64)}`, SECRET)).toBe(false); // not hex
  });

  it("never accepts anything when the app secret is empty", () => {
    expect(verifyWebhookSignature(BODY, signWebhookBody(BODY, ""), "")).toBe(false);
  });

  it("is not case sensitive about the hex digits Meta sends", () => {
    const upper = `sha256=${signWebhookBody(BODY, SECRET).slice("sha256=".length).toUpperCase()}`;
    expect(verifyWebhookSignature(BODY, upper, SECRET)).toBe(true);
  });
});
