import { MONTHLY_TOKEN_SOFT_CAP, PREMIUM_PACKAGES, packageValue } from "@/config/plans";
import { formatRupiah } from "@/lib/format";

/**
 * The words of the landing page, kept in one place so the page, its structured
 * data (JSON-LD), and /llms.txt always say the same thing. Prices and quotas come
 * from src/config/plans.ts, never written by hand.
 */

const formatTokens = (value: number) => new Intl.NumberFormat("id-ID").format(value);

export const PACKAGES = PREMIUM_PACKAGES.map((pkg) => ({ ...pkg, ...packageValue(pkg) }));
export const CHEAPEST_MONTH = Math.min(...PACKAGES.map((pkg) => pkg.perMonth));

export const STEPS = [
  { title: "Tulis harimu", detail: "Satu kalimat juga cukup. Di web atau lewat WhatsApp." },
  { title: "AI menganalisa", detail: "Yang sudah bagus, ruang untuk tumbuh, dan satu saran untuk besok." },
  { title: "Lihat perubahanmu", detail: "Dibanding kemarin, minggu lalu, dan sejak mulai." },
] as const;

export const FEATURES = [
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

export const PRIVACY_POINTS: string[] = [
  "Tulisanmu milikmu. Kamu bisa mengunduh semuanya atau menghapus akunmu kapan saja, tanpa syarat.",
  "Untuk membuat analisa, tulisanmu dikirim ke penyedia model AI. Kami hanya memakai penyedia yang, menurut pernyataan mereka, tidak mengumpulkan datamu.",
  "Lewat WhatsApp, pesanmu melewati server Meta. Jangan kirim data yang sangat sensitif seperti password atau nomor kartu.",
];

export const FAQ: { anchor?: string; question: string; answer: string }[] = [
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
