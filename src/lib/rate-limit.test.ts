import { describe, expect, it } from "vitest";
import { AI_RATE_LIMIT, rateLimitMessage } from "./rate-limit";

describe("rate limit AI (RATE-1, RATE-3)", () => {
  it("5 panggilan per menit per user", () => {
    expect(AI_RATE_LIMIT).toEqual({ bucket: "ai", limit: 5, windowSeconds: 60 });
  });

  it("pesan menyebut berapa detik lagi, dibulatkan ke atas", () => {
    expect(rateLimitMessage(40)).toBe("Tunggu sebentar ya, kamu bisa coba lagi dalam 40 detik.");
    expect(rateLimitMessage(12.2)).toBe("Tunggu sebentar ya, kamu bisa coba lagi dalam 13 detik.");
  });

  it("tidak pernah menyebut 0 detik atau lebih dari satu jendela", () => {
    expect(rateLimitMessage(0)).toContain("dalam 1 detik");
    expect(rateLimitMessage(500)).toContain("dalam 60 detik");
  });
});
