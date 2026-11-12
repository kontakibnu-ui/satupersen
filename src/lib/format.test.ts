import { describe, expect, it } from "vitest";
import { formatPercent } from "@/lib/format";

describe("formatPercent", () => {
  it("uses the Indonesian decimal comma and drops a trailing zero", () => {
    expect(formatPercent(10.1)).toBe("10,1");
    expect(formatPercent(8)).toBe("8");
    expect(formatPercent(0)).toBe("0");
  });

  it("keeps at most one decimal", () => {
    expect(formatPercent(76.66)).toBe("76,7");
  });
});

describe("formatRupiah", () => {
  it("writes rupiah with the Indonesian thousands dot", async () => {
    const { formatRupiah } = await import("@/lib/format");
    expect(formatRupiah(25000)).toBe("Rp 25.000");
    expect(formatRupiah(1245000)).toBe("Rp 1.245.000");
    expect(formatRupiah(0)).toBe("Rp 0");
  });
});
