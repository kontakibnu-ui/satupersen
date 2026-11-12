import { Lock, MessageCircle, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { MONTHLY_TOKEN_SOFT_CAP, PREMIUM_PACKAGES, packageValue } from "@/config/plans";
import { formatRupiah } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CompoundDial } from "./_landing/compound-dial";
import { FeatureSwitches } from "./_landing/feature-switches";
import { AnalysisPreview, ChatPreview, EntryPreview, ProgressPreview, ResultPreview } from "./_landing/previews";
import { PricingFields } from "./_landing/pricing-fields";
import { RevealRoot } from "./_landing/reveal-root";

export const metadata: Metadata = {
  title: "Satu Persen, jadi 1% lebih baik tiap hari",
  description:
    "Tulis harimu dalam beberapa kalimat. Satu Persen menganalisanya, memberi skor beserta alasannya, dan menunjukkan seberapa jauh kamu sudah bergerak.",
};

const formatTokens = (value: number) => new Intl.NumberFormat("id-ID").format(value);

const PACKAGES = PREMIUM_PACKAGES.map((pkg) => ({ ...pkg, ...packageValue(pkg) }));
const CHEAPEST_MONTH = Math.min(...PACKAGES.map((pkg) => pkg.perMonth));

const STEPS = [
  { clause: "Pertama, kamu menulis.", detail: "Beberapa kalimat saja, satu sampai dua menit.", preview: EntryPreview, tone: "bg-surface-muted" },
  { clause: "Lalu harimu dianalisa.", detail: "Yang sudah bagus, ruang untuk tumbuh, dan satu saran untuk besok.", preview: AnalysisPreview, tone: "bg-primary-soft" },
  { clause: "Lalu progresmu terlihat.", detail: "\"Kamu 2% lebih baik dibanding kemarin\", beserta alasannya.", preview: ProgressPreview, tone: "bg-accent-soft" },
] as const;

const FEATURES = [
  {
    id: "habits",
    sentence: "Centang kebiasaan kecilmu.",
    consequence: "3 kebiasaan aktif di paket gratis, tanpa batas di premium. Streak memaafkan satu hari yang terlewat.",
    onTone: "bg-sage-soft",
  },
  {
    id: "mood",
    sentence: "Catat mood dan energimu.",
    consequence: "Dua ketukan, lima pilihan masing-masing. Keduanya ikut menentukan skor harianmu.",
    onTone: "bg-plum-soft",
  },
  {
    id: "money",
    sentence: "Catat pengeluaran harianmu.",
    consequence: "Total bulan ini langsung terlihat. Budget bulanan, yang ikut masuk skor, tersedia di premium.",
    onTone: "bg-accent-soft",
  },
  {
    id: "reports",
    sentence: "Terima laporan tiap Senin pagi.",
    consequence: "Pola minggumu dan satu fokus untuk minggu depan. Laporan lengkap dan bulanan ada di premium.",
    onTone: "bg-primary-soft",
  },
];

const PRIVACY_POINTS: { text: string; icon: LucideIcon }[] = [
  {
    text: "Tulisanmu milikmu. Kamu bisa mengunduh semuanya atau menghapus akunmu kapan saja, tanpa syarat.",
    icon: Lock,
  },
  {
    text: "Untuk membuat analisa, tulisanmu dikirim ke penyedia model AI. Kami hanya memakai penyedia yang, menurut pernyataan mereka, tidak mengumpulkan datamu.",
    icon: ShieldCheck,
  },
  {
    text: "Lewat WhatsApp, pesanmu melewati server Meta. Jangan kirim data yang sangat sensitif seperti password atau nomor kartu.",
    icon: MessageCircle,
  },
];

const FAQ = [
  {
    tab: "Skor",
    question: "Bagaimana skornya dihitung?",
    answer:
      "Sebagian dari yang kamu isi sendiri, yaitu kebiasaan, mood, dan pengeluaran, dan sebagian dari penilaian AI atas tulisanmu. Perhitungan akhirnya dilakukan aplikasi, bukan AI, dan skor selalu datang dengan alasannya.",
  },
  {
    tab: "Kuota AI",
    question: "Apa itu kuota AI bulanan?",
    answer: `Setiap analisa dan balasan AI memakai token. Paket gratis mendapat ${formatTokens(MONTHLY_TOKEN_SOFT_CAP.free)} token per bulan, premium ${formatTokens(MONTHLY_TOKEN_SOFT_CAP.premium)}. Kalau habis, analisa pertama tiap hari tetap jalan; analisa ulang dan balasan chat berhenti sampai tanggal 1.`,
  },
  {
    tab: "Harga",
    question: "Berapa biayanya?",
    answer: `Fitur dasar gratis selamanya. Premium ${formatRupiah(PACKAGES[0].price)} sebulan, atau mulai ${formatRupiah(CHEAPEST_MONTH)} sebulan kalau mengambil paket 1 tahun.`,
  },
  {
    tab: "Berhenti",
    question: "Kalau premium berakhir, catatanku hilang?",
    answer:
      "Tidak. Akunmu kembali ke paket gratis dan semua catatanmu tetap utuh; hanya fitur premium yang terkunci sampai kamu memperpanjang.",
  },
  {
    tab: "Data",
    question: "Bisa mengunduh atau menghapus semua data?",
    answer: "Bisa, dari halaman Akun, untuk semua paket. Unduhannya satu berkas JSON, dan hapus akun menghapus seluruh datanya.",
  },
] as const;

/** Container of every section: one pair of outer margins on the whole page. */
const frame = "mx-auto w-full max-w-[1080px] px-4 md:px-8";

/** A section heading in Fraunces; every section names itself. */
const sectionTitle = "font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] font-light tracking-[-0.02em] text-text";

/**
 * The landing page (DESIGN.md §10). One motif, the round "1%" stamp of the
 * brand mark, runs through it: huge in the hero, as the dial of the one live
 * thing (the compounding calculator), as list bullets, as the package
 * selector, and as the closing seal. One primary button, repeated once at the
 * end. Every app fragment is marked "Contoh"; prices and quotas come from
 * src/config/plans.ts. Signed in visitors go straight to the app.
 */
export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/today");
  }

  return (
    <div className="relative isolate overflow-x-clip pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <RevealRoot />

      {/* The stamp sits behind the header and the hero; later sections paint their own fields over it. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[-18vw] right-[-46vw] -z-10 aspect-square w-[118vw] rounded-full bg-primary-soft md:top-[-12vw] md:right-[-16vw] md:w-[64vw]",
          "landing-stamp",
        )}
      >
        <div className="absolute inset-[5%] rounded-full border-2 border-primary/15" />
      </div>

      <header className={cn(frame, "flex items-center justify-between gap-3 py-4")}>
        <Brand />
        <nav aria-label="Bagian halaman" className="hidden items-center gap-6 text-base md:flex">
          <a href="#cara-kerja" className="flex min-h-11 items-center text-text underline-offset-4 hover:underline">
            Cara kerja
          </a>
          <a href="#harga" className="flex min-h-11 items-center text-text underline-offset-4 hover:underline">
            Harga
          </a>
          <a href="#faq" className="flex min-h-11 items-center text-text underline-offset-4 hover:underline">
            Tanya jawab
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "secondary", className: "min-h-11 bg-surface px-5" })}>
            Masuk
          </Link>
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-title">
          <div className={cn(frame, "grid items-center gap-12 pt-10 pb-24 md:grid-cols-[1.05fr_0.95fr] md:pt-16 md:pb-32")}>
            <div data-reveal className="landing-reveal">
              <h1
                id="hero-title"
                className="font-serif text-[clamp(3rem,8.5vw,5rem)] leading-[0.98] font-light tracking-[-0.03em] text-text"
              >
                Jadi 1% lebih baik tiap hari
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg text-text">
                Tulis harimu dalam beberapa kalimat. Satu Persen menganalisanya, lalu bilang berapa persen kamu lebih
                baik dibanding kemarin, lengkap dengan alasannya.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link href="/login" className={buttonVariants({ variant: "primary", className: "min-h-14 px-8 text-lg" })}>
                  Mulai gratis
                </Link>
                <a
                  href="#harga"
                  className="inline-flex min-h-11 items-center text-base font-semibold text-text underline-offset-4 hover:underline"
                >
                  Lihat harga
                </a>
              </div>
              <p className="mt-4 text-sm text-text-muted">Fitur dasar gratis selamanya. Tanpa kartu.</p>
            </div>

            <div
              data-reveal
              className={cn("landing-reveal", "flex justify-center md:justify-end")}
              style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
            >
              <ResultPreview />
            </div>
          </div>
        </section>

        <section aria-labelledby="dial-title" className="bg-surface py-20 md:py-32">
          <div className={frame}>
            <div data-reveal className={cn("landing-reveal", "max-w-[40rem]")}>
              <h2 id="dial-title" className={sectionTitle}>
                Satu persen itu kecil
              </h2>
              <p className="mt-4 text-lg text-text">
                Tapi kalau diulang tiap hari, hasilnya berlipat. Geser harinya dan lihat sendiri.
              </p>
            </div>
            <div data-reveal className={cn("landing-reveal", "mt-12 md:mt-16")}>
              <CompoundDial />
            </div>
          </div>
        </section>

        <section id="cara-kerja" aria-labelledby="how-title" className="scroll-mt-4 pt-20 md:pt-32">
          <div data-reveal className={cn(frame, "landing-reveal")}>
            <h2 id="how-title" className={sectionTitle}>
              Dua menit sehari, tiga langkah
            </h2>
          </div>
          <div className={cn(frame, "mt-12 md:mt-16")}>
            <ol className="grid overflow-hidden rounded-3xl md:grid-cols-3">
              {STEPS.map((step, index) => {
                const Preview = step.preview;

                return (
                  <li key={step.clause} className={cn(step.tone, "flex flex-col gap-8 px-5 py-10 md:min-h-[32rem] md:px-4 md:py-12")}>
                    <div
                      data-reveal
                      className="landing-reveal"
                      style={{ "--reveal-delay": `${index * 90}ms` } as React.CSSProperties}
                    >
                      <p className="font-serif text-[clamp(1.5rem,2.4vw,2rem)] leading-tight text-text">{step.clause}</p>
                      <p className="mt-2 max-w-[30ch] text-base text-text">{step.detail}</p>
                    </div>
                    <div
                      data-reveal
                      className={cn("landing-reveal", "mt-auto")}
                      style={{ "--reveal-delay": `${index * 90 + 120}ms` } as React.CSSProperties}
                    >
                      <div className="landing-lift">
                        <Preview />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section aria-labelledby="features-title" className="py-20 md:py-32">
          <div data-reveal className={cn(frame, "landing-reveal")}>
            <h2 id="features-title" className={sectionTitle}>
              Catat yang penting, tanpa ribet
            </h2>
            <p className="mt-4 max-w-[40rem] text-lg text-text">Nyalakan satu per satu untuk melihat yang kamu dapat.</p>
          </div>
          <div className="mt-10 md:mt-14">
            <FeatureSwitches features={FEATURES} />
          </div>
        </section>

        <section aria-labelledby="wa-title" className="bg-surface py-20 md:py-32">
          <div className={cn(frame, "grid items-center gap-12 md:grid-cols-2 md:gap-16")}>
            <div data-reveal className="landing-reveal">
              <h2 id="wa-title" className={sectionTitle}>
                Curhat lewat WhatsApp
              </h2>
              <p className="mt-5 max-w-[34rem] text-lg text-text">
                Kirim ceritamu seperti ngobrol. Setiap pesan masuk ke diary hari itu, dan kamu mendapat balasan singkat
                yang hangat. Ketik SELESAI kapan saja untuk melihat analisa dan skor hari itu.
              </p>
            </div>
            <div
              data-reveal
              className={cn("landing-reveal", "flex justify-center md:justify-end")}
              style={{ "--reveal-delay": "140ms" } as React.CSSProperties}
            >
              <ChatPreview />
            </div>
          </div>
        </section>

        <section aria-labelledby="privacy-title" className="py-20 md:py-32">
          <div className={cn(frame, "grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16")}>
            <div data-reveal className="landing-reveal">
              <h2 id="privacy-title" className={sectionTitle}>
                Tulisanmu tetap milikmu
              </h2>
              <p className="mt-5 max-w-[30rem] text-lg text-text">
                Diary itu pribadi. Ini yang terjadi pada tulisanmu, tanpa bahasa yang berbelit.
              </p>
            </div>
            <ul className="flex flex-col gap-8">
              {PRIVACY_POINTS.map((point, index) => {
                const Icon = point.icon;

                return (
                  <li
                    key={point.text}
                    data-reveal
                    className={cn("landing-reveal", "flex gap-5")}
                    style={{ "--reveal-delay": `${index * 90}ms` } as React.CSSProperties}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary outline outline-offset-2 outline-primary/20"
                    >
                      <Icon size={20} strokeWidth={1.6} />
                    </span>
                    <p className="text-lg text-text">{point.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="harga" aria-labelledby="price-title" className="scroll-mt-4 pb-20 md:pb-32">
          <div className={frame}>
            <div data-reveal className={cn("landing-reveal", "max-w-[40rem]")}>
              <h2 id="price-title" className={sectionTitle}>
                Harga
              </h2>
              <p className="mt-4 text-lg text-text">
                Mulai gratis. Kalau ingin lebih dalam, makin lama paketnya makin hemat.
              </p>
            </div>
            <div data-reveal className={cn("landing-reveal", "mt-12")}>
              <PricingFields
                packages={PACKAGES}
                freeTokens={formatTokens(MONTHLY_TOKEN_SOFT_CAP.free)}
                premiumTokens={formatTokens(MONTHLY_TOKEN_SOFT_CAP.premium)}
              />
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 pb-20 md:pb-32">
          <div className={cn(frame, "max-w-[820px]")}>
            <h2 id="faq-title" data-reveal className={cn(sectionTitle, "landing-reveal")}>
              Pertanyaan yang sering muncul
            </h2>
            <div className="mt-12">
              {FAQ.map((item, index) => (
                <details
                  key={item.question}
                  name="faq"
                  open={index === 0}
                  className={cn("landing-faq-card", "group relative")}
                  style={{ "--tab-step": Math.min(index * 18, 72) } as React.CSSProperties}
                >
                  <summary className="block cursor-pointer list-none">
                    <span
                      className={cn(
                        "landing-faq-tab",
                        "inline-block px-4 pt-2 pb-1 text-sm font-semibold",
                        index % 2 === 0 ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent-warm",
                      )}
                    >
                      {item.tab}
                    </span>
                    <span
                      className={cn(
                        "flex min-h-16 items-center justify-between gap-4 rounded-tr-3xl rounded-b-3xl px-5 py-4 text-lg font-semibold text-text group-open:rounded-b-none md:px-6",
                        index % 2 === 0 ? "bg-primary-soft" : "bg-accent-soft",
                      )}
                    >
                      {item.question}
                      <span
                        aria-hidden="true"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-text transition-transform duration-200 group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p
                    className={cn(
                      "rounded-b-3xl px-5 pb-6 text-base text-text md:px-6",
                      index % 2 === 0 ? "bg-primary-soft" : "bg-accent-soft",
                    )}
                  >
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="bg-primary text-primary-foreground">
          <div className={cn(frame, "flex flex-col items-start gap-8 py-20 md:flex-row md:items-end md:justify-between md:py-28")}>
            <div data-reveal className="landing-reveal">
              <h2 id="cta-title" className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] font-light tracking-[-0.02em]">
                Mulai dari satu kalimat hari ini
              </h2>
              <p className="mt-4 text-lg">Gratis untuk dimulai. Tanpa kartu.</p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-14 shrink-0 items-center rounded-full bg-surface px-8 text-lg font-semibold text-primary transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Mulai gratis
            </Link>
          </div>
        </section>
      </main>

      <div className={frame}>
        <div aria-hidden="true" className="pt-16 md:pt-24">
          <span className="font-wordmark text-[clamp(3rem,11vw,6.5rem)] leading-none font-normal tracking-[-0.03em] whitespace-nowrap text-text">
            Satu Persen.
          </span>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
