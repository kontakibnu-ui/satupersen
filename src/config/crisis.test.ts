import { describe, expect, it } from "vitest";
import {
  crisisLanguageOf,
  crisisResponseFor,
  CRISIS_RESPONSE_EN,
  CRISIS_RESPONSE_ID,
  CRISIS_SERVICE,
  detectCrisis,
} from "@/config/crisis";

describe("detectCrisis", () => {
  it.each([
    "aku udah capek banget, pengen mati rasanya",
    "kayaknya aku mau mati aja",
    "semalam aku kepikiran nyakitin diri sendiri",
    "aku gak mau hidup lagi",
    "I want to die",
    "sometimes I think about killing myself",
    "I keep hurting myself",
    "SUICIDE",
    "minum overdosis obat tidur",
    "Gak mau hidup!!!",
  ])("menandai sebagai krisis: %s", (text) => {
    expect(detectCrisis(text)).toBe(true);
  });

  it.each([
    "",
    "hari ini biasa aja",
    "lampu kamar mati, jadi gelap",
    "HP-ku mati total, harus di-charge",
    "belajar mati-matian buat ujian besok",
    "capek banget sama kerjaan, tapi masih bisa dijalanin",
    "aku sedih karena nilai turun",
    "mood-ku jelek hari ini",
  ])("tidak menandai sebagai krisis: %s", (text) => {
    expect(detectCrisis(text)).toBe(false);
  });

  it("tahan terhadap spasi dan tanda baca berlebih", () => {
    expect(detectCrisis("gak   mau    hidup???")).toBe(true);
    expect(detectCrisis("pengen\nmati")).toBe(true);
  });
});

describe("crisisResponseFor", () => {
  it("memakai teks Inggris untuk entri berbahasa Inggris", () => {
    expect(crisisResponseFor("en")).toBe(CRISIS_RESPONSE_EN);
  });

  it("memakai teks Indonesia untuk bahasa id dan campur", () => {
    expect(crisisResponseFor("id")).toBe(CRISIS_RESPONSE_ID);
    expect(crisisResponseFor("mixed")).toBe(CRISIS_RESPONSE_ID);
  });

  it("teks tetap memuat layanan yang sudah ditulis manusia, bukan karangan AI", () => {
    for (const text of [CRISIS_RESPONSE_ID, CRISIS_RESPONSE_EN]) {
      expect(text).toContain("119");
      expect(text).toContain("healing119.id");
    }

    expect(CRISIS_RESPONSE_ID).toContain("IGD");
    expect(CRISIS_RESPONSE_EN).toContain("emergency room");
  });

  it("teks tidak menampilkan skor atau nada menghakimi", () => {
    for (const text of [CRISIS_RESPONSE_ID, CRISIS_RESPONSE_EN]) {
      expect(text).not.toMatch(/\b\d{1,3}\s*\/\s*100\b/);
      expect(text).not.toMatch(/gagal|salah kamu|harusnya kamu/i);
    }
  });
});

describe("CRISIS_SERVICE", () => {
  it("sesuai draf PRD §7 dan wajib diverifikasi manusia sebelum launch", () => {
    expect(CRISIS_SERVICE.phone).toBe("119");
    expect(CRISIS_SERVICE.phoneExtension).toBe("8");
    expect(CRISIS_SERVICE.website).toBe("https://healing119.id");
  });
});

describe("crisisLanguageOf", () => {
  it("picks the language of the phrase that matched", () => {
    expect(crisisLanguageOf("I want to die")).toBe("en");
    expect(crisisLanguageOf("aku pengen mati")).toBe("id");
  });

  it("uses Indonesian when both languages appear, because the product is Indonesian", () => {
    expect(crisisLanguageOf("I feel suicidal, aku ingin mati")).toBe("id");
  });

  it("defaults to Indonesian when nothing matched", () => {
    expect(crisisLanguageOf("hari ini biasa saja")).toBe("id");
  });
});
