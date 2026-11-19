import { notFound, redirect } from "next/navigation";
import { describe, expect, it } from "vitest";
import { CONNECTION_MESSAGE, callAction } from "./call-action";

describe("callAction", () => {
  it("mengembalikan hasil action apa adanya", async () => {
    await expect(callAction(async () => ({ ok: true as const, id: "a" }))).resolves.toEqual({ ok: true, id: "a" });
    await expect(callAction(async () => ({ ok: false as const, message: "Ditolak" }))).resolves.toEqual({
      ok: false,
      message: "Ditolak",
    });
  });

  it("mengubah koneksi putus menjadi kegagalan yang bisa dicoba lagi", async () => {
    const result = await callAction(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(result).toEqual({ ok: false, message: CONNECTION_MESSAGE, retryable: true, connectionLost: true });
  });

  it("melempar ulang redirect dan notFound supaya Next.js tetap berpindah halaman", async () => {
    await expect(callAction(async () => redirect("/login"))).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT/),
    });
    await expect(callAction(async () => notFound())).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/),
    });
  });
});
