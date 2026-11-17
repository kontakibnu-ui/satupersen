import { Lightbulb, Smile } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { deltaSentence } from "@/lib/score-delta";

/**
 * Hand-written fragments of the real app for the landing page (DESIGN.md §10).
 * They are built from the app's own components and tokens, every one carries
 * the label "Contoh", and no number in them belongs to a real user.
 */

function ExampleLabel({ children = "Contoh" }: { children?: string }) {
  return (
    <span className="rounded-full bg-surface-muted px-2.5 py-1 text-sm font-semibold text-text-muted">{children}</span>
  );
}

/** The result of one analysed day: the stamp score, one line, and the tip for tomorrow. */
export function ResultPreview() {
  return (
    <figure aria-label="Contoh tampilan analisa hari ini" data-ui className="w-full max-w-[380px]">
      <div className="rounded-3xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <ExampleLabel />
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
            <Smile aria-hidden="true" size={14} strokeWidth={2.2} />
            Baik
          </span>
        </div>
        <div className="mt-4 flex justify-center">
          <ScoreRing score={78} delta={2} comparedTo="kemarin" size={150} />
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-sage">{deltaSentence(2, "kemarin")}</p>
        <p className="mt-2 text-center text-base text-text">
          Laporan yang tertunda akhirnya selesai dan kamu tetap jalan sore 20 menit.
        </p>
        <div className="mt-5 flex gap-3 rounded-2xl bg-accent-soft p-4">
          <Lightbulb aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-accent-warm" />
          <p className="text-sm text-text">
            <span className="font-semibold text-accent-warm">Untuk besok: </span>
            tulis satu target kecil sebelum membuka laptop.
          </p>
        </div>
      </div>
    </figure>
  );
}

/** Step one: the diary sheet with a few sentences on it. */
export function EntryPreview() {
  return (
    <figure aria-label="Contoh tulisan hari ini" data-ui className="w-full">
      <div className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-base font-bold text-text">Gimana harimu?</p>
          <ExampleLabel />
        </div>
        <p className="mt-3 font-serif text-base leading-relaxed text-text">
          Pagi telat bangun, tapi sempat jalan 20 menit. Laporan yang ketunda dua minggu akhirnya kelar. Malamnya
          capek, tapi lega.
        </p>
        <p className="mt-3 text-sm text-text-muted">Tersimpan</p>
      </div>
    </figure>
  );
}

/** Step two: what the analysis says about the day. */
export function AnalysisPreview() {
  return (
    <figure aria-label="Contoh analisa hari ini" data-ui className="w-full">
      <div className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-base font-bold text-text">Analisa hari ini</p>
          <ExampleLabel />
        </div>
        <p className="mt-3 text-sm font-semibold text-text">Yang sudah bagus</p>
        <ul className="mt-1 flex flex-col gap-1 text-sm text-text">
          <li className="flex gap-2">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-sage" />
            Laporan yang tertunda selesai
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-sage" />
            Tetap bergerak walau telat bangun
          </li>
        </ul>
        <p className="mt-3 text-sm font-semibold text-text">Ruang untuk tumbuh</p>
        <p className="mt-1 text-sm text-text">Jam tidur masih mundur ke tengah malam.</p>
      </div>
    </figure>
  );
}

/** Step three: the change against the last day, with its reason. */
export function ProgressPreview() {
  return (
    <figure aria-label="Contoh skor dan progres" data-ui className="w-full">
      <div className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-base font-bold text-text">Progresmu</p>
          <ExampleLabel />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <ScoreRing score={78} delta={2} comparedTo="kemarin" size={112} />
          <p className="text-sm font-semibold text-text">{deltaSentence(2, "kemarin")}</p>
        </div>
        <p className="mt-3 text-sm text-text-muted">Alasannya: kebiasaan lengkap dan mood baik, tapi tidur masih kurang.</p>
      </div>
    </figure>
  );
}

/** A WhatsApp chat: a message, a short warm reply, and the command that analyses the day. */
export function ChatPreview() {
  return (
    <figure aria-label="Contoh percakapan WhatsApp" data-ui className="w-full max-w-[420px]">
      <div className="rounded-3xl bg-surface-muted p-5">
        <ExampleLabel>Contoh chat</ExampleLabel>
        <div className="mt-4 flex flex-col gap-3">
          <p className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-base text-primary-foreground">
            Capek banget, rapat dari pagi sampai sore dan belum sempat makan siang.
          </p>
          <p className="max-w-[85%] rounded-3xl rounded-bl-lg bg-surface px-4 py-3 text-base text-text">
            Hari yang panjang ya. Wajar kalau badanmu lemas sekarang. Sudah sempat makan sesuatu?
          </p>
          <p className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-base text-primary-foreground">
            selesai
          </p>
        </div>
      </div>
    </figure>
  );
}
