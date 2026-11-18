import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { BinderSheet, BLEED, InkStamp, ScribbleTick, ScribbleUnderline, Tally } from "@/components/notebook";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { MONTHLY_TOKEN_SOFT_CAP, PREMIUM_PACKAGES, packageValue } from "@/config/plans";
import { formatRupiah } from "@/lib/format";
import { deltaFigure, deltaSentence } from "@/lib/score-delta";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CompoundDial } from "./_landing/compound-dial";
import { FeatureSwitches } from "./_landing/feature-switches";
import { PricingFields } from "./_landing/pricing-fields";

export const metadata: Metadata = {
  title: "Satu Persen, jadi 1% lebih baik tiap hari",
  description:
    "Tulis harimu dalam beberapa kalimat. Satu Persen menganalisanya, memberi skor beserta alasannya, dan menunjukkan seberapa jauh kamu sudah bergerak.",
};

const formatTokens = (value: number) => new Intl.NumberFormat("id-ID").format(value);

const PACKAGES = PREMIUM_PACKAGES.map((pkg) => ({ ...pkg, ...packageValue(pkg) }));
const CHEAPEST_MONTH = Math.min(...PACKAGES.map((pkg) => pkg.perMonth));

/** The example in the hero; no number in it belongs to a real user. */
const EXAMPLE_DELTA = 4;

const STEPS = [
  { title: "Tulis harimu", detail: "Satu kalimat juga cukup. Di web atau lewat WhatsApp." },
  { title: "AI menganalisa", detail: "Yang sudah bagus, ruang untuk tumbuh, dan satu saran untuk besok." },
  { title: "Lihat perubahanmu", detail: "Dibanding kemarin, minggu lalu, dan sejak mulai." },
] as const;

const FEATURES = [
  {
    id: "habits",
    label: "Kebiasaan harian",
    consequence: "3 kebiasaan aktif di paket gratis, tanpa batas di premium. Streak memaafkan satu hari yang terlewat.",
  },
  {
    id: "mood",
    label: "Mood dan energi",
    consequence: "Dua ketukan, lima pilihan masing-masing. Keduanya ikut menentukan skor harianmu.",
  },
  {
    id: "money",
    label: "Pengeluaran",
    consequence: "Total bulan ini langsung terlihat. Budget bulanan, yang ikut masuk skor, tersedia di premium.",
  },
  {
    id: "reports",
    label: "Laporan tiap Senin",
    consequence: "Pola minggumu dan satu fokus untuk minggu depan. Laporan lengkap dan bulanan ada di premium.",
  },
];

const PRIVACY_POINTS: string[] = [
  "Tulisanmu milikmu. Kamu bisa mengunduh semuanya atau menghapus akunmu kapan saja, tanpa syarat.",
  "Untuk membuat analisa, tulisanmu dikirim ke penyedia model AI. Kami hanya memakai penyedia yang, menurut pernyataan mereka, tidak mengumpulkan datamu.",
  "Lewat WhatsApp, pesanmu melewati server Meta. Jangan kirim data yang sangat sensitif seperti password atau nomor kartu.",
];

const FAQ = [
  {
    // The first question of the wireframe; the pricing used to link here.
    anchor: "faq-kuota",
    question: "Apa itu kuota AI bulanan?",
    answer: `Setiap analisa dan balasan AI memakai token. Paket gratis mendapat ${formatTokens(MONTHLY_TOKEN_SOFT_CAP.free)} token per bulan, premium ${formatTokens(MONTHLY_TOKEN_SOFT_CAP.premium)}. Kalau habis, analisa pertama tiap hari tetap jalan; analisa ulang dan balasan chat berhenti sampai tanggal 1.`,
  },
  {
    question: "Bagaimana skornya dihitung?",
    answer:
      "Sebagian dari yang kamu isi sendiri, yaitu kebiasaan, mood, dan pengeluaran, dan sebagian dari penilaian AI atas tulisanmu. Perhitungan akhirnya dilakukan aplikasi, bukan AI, dan skor selalu datang dengan alasannya.",
  },
  {
    question: "Berapa biayanya?",
    answer: `Fitur dasar gratis selamanya. Premium ${formatRupiah(PACKAGES[0].price)} sebulan, atau mulai ${formatRupiah(CHEAPEST_MONTH)} sebulan kalau mengambil paket 1 tahun.`,
  },
  {
    question: "Kalau premium berakhir, catatanku hilang?",
    answer:
      "Tidak. Akunmu kembali ke paket gratis dan semua catatanmu tetap utuh; hanya fitur premium yang terkunci sampai kamu memperpanjang.",
  },
  {
    question: "Bisa mengunduh atau menghapus semua data?",
    answer: "Bisa, dari halaman Akun, untuk semua paket. Unduhannya satu berkas JSON, dan hapus akun menghapus seluruh datanya.",
  },
];

/**
 * The page's width: the phone layout of the wireframe in one column, and from
 * 768 px a wider frame where the parts sit side by side (DESIGN.md §14.9).
 */
const frame = "mx-auto w-full max-w-[1080px] px-4 md:px-8";

/** A section title: 24 px on a phone as in the wireframe, larger on wider screens. */
const sectionTitle = "font-heading text-2xl font-bold tracking-[-0.01em] text-text md:text-[32px] md:leading-tight";

/** The head of a ruled part: its title over a double rule (DESIGN.md §14.3 "Kepala bagian"). */
function LandingHead({ id, title, aside }: { id: string; title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-[3px] border-double border-rule-strong pb-2">
      <h2 id={id} className={sectionTitle}>
        {title}
      </h2>
      {aside ? <p className="hidden text-sm text-text-muted md:block">{aside}</p> : null}
    </div>
  );
}

/**
 * The landing page, from the wireframe "Landing" of version 5 (DESIGN.md §14.9).
 * On a phone it follows the wireframe as drawn: one column like a notebook. The
 * wireframe was drawn for a phone only, so from 768 px the same pieces are laid
 * out for a wider screen (user 2026-11-17: "sesuaikan aja"): the hero beside its
 * example sheet, the stamp beside the slider, how it works in three columns,
 * features in two, WhatsApp beside its chat, privacy in three, the two plans
 * side by side, and the closing band in one row.
 *
 * Every app fragment is marked "Contoh"; prices and quotas come from
 * src/config/plans.ts. Signed in visitors go straight to the app.
 */
export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/today");
  }

  return (
    <div className="overflow-x-clip pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-border">
        <div className={cn(frame, "flex min-h-[71px] items-center gap-1.5 py-3")}>
          <span className="flex-1">
            <Brand />
          </span>
          <nav aria-label="Bagian halaman" className="mr-4 hidden items-center gap-6 md:flex">
            <a href="#cara-kerja" className="flex min-h-11 items-center text-sm text-text underline-offset-4 hover:underline">
              Cara kerja
            </a>
            <a href="#harga" className="flex min-h-11 items-center text-sm text-text underline-offset-4 hover:underline">
              Harga
            </a>
            <a href="#faq" className="flex min-h-11 items-center text-sm text-text underline-offset-4 hover:underline">
              Tanya jawab
            </a>
          </nav>
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "secondary", className: "min-h-11 px-[18px] text-[15px]" })}>
            Masuk
          </Link>
        </div>
      </header>

      <main>
        <div className={cn(frame, "flex flex-col gap-12 pt-9 pb-12 md:gap-24 md:pt-16 md:pb-24")}>
          <section
            aria-labelledby="hero-title"
            className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center md:gap-x-14"
          >
            <div className="flex flex-col gap-4 md:gap-6">
              <h1
                id="hero-title"
                className="font-heading text-[38px] leading-[1.12] font-bold tracking-[-0.02em] text-text md:text-[52px] md:leading-[1.06] lg:text-[60px]"
              >
                Jadi <ScribbleUnderline>1% lebih baik</ScribbleUnderline> tiap hari
              </h1>
              <p className="text-base text-text md:max-w-[32rem] md:text-lg">
                Tulis harimu, centang kebiasaanmu, lalu lihat analisanya dibanding kemarin.
              </p>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <Link href="/login" className={buttonVariants({ className: "w-full sm:w-auto sm:px-9" })}>
                  Mulai gratis
                </Link>
                <a
                  href="#harga"
                  className="inline-flex min-h-11 items-center self-center text-sm font-semibold text-primary underline-offset-4 hover:underline sm:self-auto"
                >
                  Lihat harga
                </a>
              </div>
            </div>

            <BinderSheet as="figure" aria-label="Contoh hasil analisa" className="mt-2 md:mt-0">
              <p className="text-xs font-bold text-text-muted">Contoh</p>
              <div className="mt-2 flex items-center gap-3.5">
                <InkStamp figure={deltaFigure(EXAMPLE_DELTA)} size={96} className="md:size-[112px]" />
                <p className="text-base font-semibold text-text md:text-[17px]">{deltaSentence(EXAMPLE_DELTA, "kemarin")}.</p>
              </div>
              <p
                className={cn(
                  BLEED,
                  "paper-lines mt-3.5 border-t-[3px] border-double border-rule-strong font-serif text-editor text-primary",
                )}
              >
                Kamu sempat hampir menyerah, tapi memilih jalan kaki sebentar.
              </p>
            </BinderSheet>
          </section>

          <section aria-labelledby="dial-title" className="flex flex-col gap-3.5 md:gap-8">
            <h2 id="dial-title" className={sectionTitle}>
              Satu persen itu kecil
            </h2>
            <CompoundDial />
          </section>

          <section id="cara-kerja" aria-labelledby="how-title" className="scroll-mt-4">
            <LandingHead id="how-title" title="Cara kerja" aside="Dua menit sehari" />
            <ol className="md:grid md:grid-cols-3 md:gap-10">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex min-h-14 items-center gap-3.5 border-b border-rule py-2 md:flex-col md:items-start md:gap-3 md:py-6"
                >
                  <Tally count={index + 1} className="md:h-[27px] md:w-[30px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-text md:text-lg">{step.title}</span>
                    <span className="block text-sm text-text-muted md:mt-1 md:text-base">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="features-title">
            <LandingHead id="features-title" title="Yang ikut dicatat" />
            <FeatureSwitches features={FEATURES} />
            <p className="mt-3 text-sm text-text-muted md:mt-5">
              Semuanya bisa dipakai di paket gratis. Premium melonggarkan batasnya.
            </p>
          </section>

          <section
            aria-labelledby="wa-title"
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-x-14"
          >
            <div className="flex flex-col gap-3">
              <h2 id="wa-title" className={sectionTitle}>
                Curhat lewat WhatsApp
              </h2>
              <p className="text-sm text-text-muted md:text-base">
                Ceritamu di chat ikut masuk ke diary. Ketik SELESAI kapan saja untuk melihat analisa hari itu.
              </p>
            </div>
            <figure
              aria-label="Contoh percakapan WhatsApp"
              className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-surface p-[18px] md:p-6"
            >
              <p className="text-xs font-bold text-text-muted">Contoh</p>
              <p className="max-w-[260px] self-end rounded-[16px_16px_4px_16px] bg-primary-soft px-3.5 py-2.5 font-serif text-base text-text">
                Capek banget, rapat dari pagi sampai sore dan belum sempat makan siang.
              </p>
              <p className="max-w-[260px] self-start rounded-[16px_16px_16px_4px] border border-border px-3.5 py-2.5 text-base text-text">
                Hari yang panjang ya. Wajar kalau badanmu lemas sekarang. Sudah sempat makan sesuatu?
              </p>
            </figure>
          </section>

          <section aria-labelledby="privacy-title">
            <LandingHead id="privacy-title" title="Privasi" aside="Tulisanmu tetap milikmu" />
            <ul className="md:grid md:grid-cols-3 md:gap-10">
              {PRIVACY_POINTS.map((point) => (
                <li
                  key={point}
                  className="flex min-h-14 items-start gap-3.5 border-b border-rule py-3 md:flex-col md:gap-3 md:border-b-0 md:py-6"
                >
                  <ScribbleTick className="mt-0.5 size-5 shrink-0 md:size-7" />
                  <span className="min-w-0 flex-1 text-base text-text">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="harga" aria-labelledby="price-title" className="flex scroll-mt-4 flex-col gap-3.5 md:gap-8">
            <h2 id="price-title" className={sectionTitle}>
              Harga
            </h2>
            <PricingFields packages={PACKAGES} />
          </section>

          <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 md:max-w-[760px]">
            <LandingHead id="faq-title" title="Tanya jawab" />
            <div>
              {FAQ.map((item) => (
                <details key={item.question} id={item.anchor} name="faq" className="group scroll-mt-6 border-b border-rule">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5 py-2 text-base text-text md:text-lg [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">{item.question}</span>
                    <Plus
                      aria-hidden="true"
                      size={18}
                      strokeWidth={1.8}
                      className="shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-45"
                    />
                  </summary>
                  <p className="pb-4 text-sm text-text-muted md:max-w-[62ch] md:text-base">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <section aria-label="Penutup" className="bg-primary text-primary-foreground">
          <div className={cn(frame, "flex flex-col gap-[18px] py-10 md:flex-row md:items-center md:justify-between md:py-16")}>
            <p className="font-serif text-[26px] leading-[1.3] italic md:text-[36px]">Mulai dari satu kalimat hari ini.</p>
            <Link
              href="/login"
              className="inline-flex min-h-14 shrink-0 items-center justify-center rounded-full bg-surface px-9 text-[17px] font-semibold text-primary transition-transform duration-200 active:scale-[0.98]"
            >
              Mulai gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className={cn(frame, "flex flex-col gap-2 pt-6 pb-3 md:flex-row md:items-end md:justify-between md:pt-12 md:pb-8")}>
        <p aria-hidden="true">
          <Brand className="text-[40px] md:text-[64px]" />
        </p>
        <nav aria-label="Tautan bawah" className="flex flex-wrap gap-x-5">
          <Link href="/login" className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-primary">
            Masuk
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-primary">
            Privasi
          </Link>
          <Link href="/terms" className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-primary">
            Syarat layanan
          </Link>
        </nav>
      </footer>
    </div>
  );
}
