import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Syarat layanan · Satu Persen",
};

/**
 * Draft terms of service (LAUNCH, PRD.md §7). Like the privacy page, it says what
 * the product does and leaves what is not decided (the operator, prices, payment,
 * governing law) as bracketed gaps. A human, and a legal reviewer, must read it
 * before launch.
 */
const SECTIONS: LegalSection[] = [
  {
    title: "Tentang layanan",
    paragraphs: [
      "Satu Persen adalah aplikasi untuk menulis diary singkat, mencatat kebiasaan, mood, dan pengeluaran, lalu mendapat ringkasan, skor, dan laporan yang dibuat dengan bantuan AI. [Nama pengelola: menunggu keputusan pengelola.]",
    ],
  },
  {
    title: "Akun",
    paragraphs: ["Kamu bertanggung jawab atas akunmu dan atas apa yang kamu tulis."],
  },
  {
    title: "Tulisanmu",
    paragraphs: [
      "Tulisanmu tetap milikmu. Dengan memakai fitur ringkasan, laporan, dan balasan chat, kamu mengizinkan kami memprosesnya untuk fitur itu, termasuk mengirimkannya ke penyedia model AI seperti dijelaskan di kebijakan privasi.",
    ],
  },
  {
    title: "Ringkasan dan skor dari AI",
    paragraphs: [
      "Ringkasan, skor, laporan, dan balasan dibuat dengan bantuan AI dan bisa keliru atau kurang tepat. Anggap itu cermin yang membantu, bukan penilaian atas dirimu dan bukan dasar keputusan penting.",
    ],
  },
  {
    title: "Paket dan batas pemakaian",
    paragraphs: [
      "Ada paket gratis dengan batas pemakaian harian dan jumlah tertentu, dan paket berbayar dengan batas yang lebih longgar. [Harga, cara pembayaran, perpanjangan, dan pengembalian dana: menunggu keputusan pengelola.]",
    ],
  },
  {
    title: "Menghentikan layanan",
    paragraphs: [
      "Kamu bisa menghapus akunmu kapan saja dari halaman Akun, dan seluruh datamu ikut terhapus. [Syarat kami menghentikan akun yang melanggar aturan: menunggu keputusan pengelola.]",
    ],
  },
  {
    title: "Hukum yang berlaku",
    paragraphs: ["[Hukum yang berlaku dan cara menyelesaikan sengketa: menunggu keputusan pengelola dan tinjauan hukum.]"],
  },
];

export default function TermsPage() {
  return <LegalPage title="Syarat layanan" updated="29 Oktober 2026 (draf)" sections={SECTIONS} />;
}
