import { describe, expect, it } from "vitest";
import {
  FINISHED_STEP,
  firstSchedule,
  isDue,
  materialState,
  nextSchedule,
  REVIEW_GAPS,
  reviewDayLabel,
} from "./schedule";

describe("jadwal review (LEARN-3)", () => {
  it("jaraknya 1, 3, 7, 14, lalu 30 hari", () => {
    expect(REVIEW_GAPS).toEqual([1, 3, 7, 14, 30]);
    expect(FINISHED_STEP).toBe(5);
  });

  it("pertanyaan baru jatuh tempo sehari setelah materi diperiksa", () => {
    expect(firstSchedule("2026-11-15")).toEqual({ step: 0, dueDate: "2026-11-16" });
  });

  it("Ingat naik ke jarak berikutnya sampai selesai setelah jarak 30 hari", () => {
    let schedule = firstSchedule("2026-11-15");
    const reviewDays: string[] = [];

    while (schedule.dueDate !== null) {
      reviewDays.push(schedule.dueDate);
      schedule = nextSchedule(schedule.step, "remembered", schedule.dueDate);
    }

    // Day 1 after checking, then 3, 7, 14, and 30 days after each review.
    expect(reviewDays).toEqual(["2026-11-16", "2026-11-19", "2026-11-26", "2026-12-10", "2027-01-09"]);
    expect(schedule).toEqual({ step: FINISHED_STEP, dueDate: null });
  });

  it("Ragu mengulang jarak yang sama", () => {
    expect(nextSchedule(2, "unsure", "2026-11-20")).toEqual({ step: 2, dueDate: "2026-11-27" });
    expect(nextSchedule(0, "unsure", "2026-11-20")).toEqual({ step: 0, dueDate: "2026-11-21" });
  });

  it("Lupa kembali ke 1 hari dari tahap mana pun", () => {
    expect(nextSchedule(4, "forgot", "2026-12-31")).toEqual({ step: 0, dueDate: "2027-01-01" });
  });

  it("dihitung dari tanggal review, jadi review yang terlambat tidak menjadwalkan ke masa lalu", () => {
    // Due on the 16th, reviewed on the 20th: the next gap starts on the 20th.
    expect(nextSchedule(0, "remembered", "2026-11-20")).toEqual({ step: 1, dueDate: "2026-11-23" });
  });

  it("menolak tahap yang tidak ada atau pertanyaan yang sudah selesai", () => {
    expect(() => nextSchedule(FINISHED_STEP, "remembered", "2026-11-20")).toThrow();
    expect(() => nextSchedule(-1, "forgot", "2026-11-20")).toThrow();
    expect(() => nextSchedule(1.5, "forgot", "2026-11-20")).toThrow();
  });

  it("melewati akhir bulan dan tahun kabisat dengan benar", () => {
    expect(nextSchedule(3, "unsure", "2028-02-20")).toEqual({ step: 3, dueDate: "2028-03-05" });
    expect(nextSchedule(0, "forgot", "2028-02-28")).toEqual({ step: 0, dueDate: "2028-02-29" });
  });
});

describe("isDue", () => {
  it("jatuh tempo hari ini atau sebelumnya, tidak untuk besok atau yang sudah selesai", () => {
    expect(isDue("2026-11-15", "2026-11-15")).toBe(true);
    expect(isDue("2026-11-10", "2026-11-15")).toBe(true);
    expect(isDue("2026-11-16", "2026-11-15")).toBe(false);
    expect(isDue(null, "2026-11-15")).toBe(false);
  });
});

describe("materialState", () => {
  it("draf sampai diperiksa", () => {
    expect(materialState("draft", [], "2026-11-15")).toEqual({ kind: "draft" });
  });

  it("menghitung pertanyaan yang jatuh tempo", () => {
    expect(materialState("active", ["2026-11-15", "2026-11-14", "2026-11-20", null], "2026-11-15")).toEqual({
      kind: "due",
      dueCount: 2,
    });
  });

  it("menunggu sampai tanggal terdekat", () => {
    expect(materialState("active", ["2026-11-22", "2026-11-18", null], "2026-11-15")).toEqual({
      kind: "waiting",
      nextDue: "2026-11-18",
    });
  });

  it("selesai bila semua pertanyaan selesai", () => {
    expect(materialState("active", [null, null, null], "2026-11-15")).toEqual({ kind: "finished" });
  });

  it("materi aktif tanpa pertanyaan dibaca sebagai draf supaya bisa diperiksa lagi", () => {
    expect(materialState("active", [], "2026-11-15")).toEqual({ kind: "draft" });
  });
});

describe("reviewDayLabel", () => {
  it("hari ini, besok, atau nama hari dan tanggal", () => {
    expect(reviewDayLabel("2026-11-15", "2026-11-15")).toBe("hari ini");
    expect(reviewDayLabel("2026-11-16", "2026-11-15")).toBe("besok");
    expect(reviewDayLabel("2026-11-19", "2026-11-15")).toBe("Kamis, 19 November");
  });
});
