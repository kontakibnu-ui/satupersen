import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privasi · Satu Persen",
};

/**
 * Draft privacy policy (LAUNCH, PRD.md §7). It states what the product does, as
 * PRD.md §7 and §9 define it. It names no company, address, contact, or storage
 * period, because those are decisions that are not made yet; each is a bracketed
 * gap for the operator. A human must review it before launch.
 */
const SECTIONS: LegalSection[] = [
  {
    title: "Siapa yang mengelola Satu Persen",
    paragraphs: ["[Nama pengelola, alamat, dan email untuk pertanyaan soal data: menunggu keputusan pengelola.]"],
  },
  {
    title: "Data yang kami simpan",
    paragraphs: ["Hanya yang kamu berikan atau hasilkan saat memakai Satu Persen:"],
    items: [
      "Akun: email, nama, timezone, dan persetujuanmu saat mendaftar.",
      "Tulisan harianmu, serta mood dan energi yang kamu pilih.",
      "Kebiasaan yang kamu buat dan hari-hari kamu mencentangnya.",
      "Pengeluaran yang kamu catat, dan budget bulanan jika kamu mengaturnya.",
      "Ringkasan, skor, dan laporan yang dibuat dari data di atas.",
      "Jika kamu menghubungkan WhatsApp: nomormu dan pesan yang kamu kirim ke Satu Persen, beserta balasannya.",
    ],
  },
  {
    title: "Untuk apa data dipakai",
    paragraphs: [
      "Hanya untuk menjalankan fitur yang kamu pakai: menyimpan tulisanmu, membuat ringkasan dan skor, menampilkan progres, membuat laporan, dan membalas pesanmu di WhatsApp.",
    ],
  },
  {
    title: "Siapa yang ikut memproses datamu",
    paragraphs: [
      "Untuk menjalankan layanan, data melewati pihak berikut. Masing-masing punya kebijakan privasinya sendiri.",
    ],
    items: [
      "Supabase: database dan proses masuk.",
      "Vercel: tempat aplikasi berjalan.",
      "OpenRouter dan penyedia model AI di baliknya: isi tulisan, mood, kebiasaan, dan pengeluaranmu dikirim ke sini agar ringkasan, laporan, dan balasan chat bisa dibuat. Kami meminta hanya penyedia yang, menurut pernyataan mereka, tidak mengumpulkan datamu.",
      "Meta (WhatsApp): jika kamu menghubungkan WhatsApp, pesanmu melewati server Meta. Jangan kirim data yang sangat sensitif seperti password atau nomor kartu.",
      "Google: jika kamu masuk dengan akun Google.",
    ],
  },
  {
    title: "Keamanan",
    paragraphs: [
      "Semua lalu lintas memakai HTTPS. Data tiap pengguna dipisahkan di database sehingga hanya pemiliknya yang bisa membacanya, dan isi tulisanmu tidak dicatat di log kami. Tidak ada sistem yang bisa dijanjikan bebas celah sepenuhnya, jadi kami terus memeriksanya.",
    ],
  },
  {
    title: "Hakmu atas data",
    paragraphs: [
      "Dari halaman Akun kamu bisa mengunduh semua datamu dalam satu berkas JSON, dan menghapus akunmu beserta seluruh datanya. Keduanya tersedia untuk semua pengguna, tanpa syarat berlangganan.",
    ],
  },
  {
    title: "Berapa lama data disimpan",
    paragraphs: [
      "Data disimpan selama akunmu ada, dan semuanya dihapus saat kamu menghapus akun. [Ketentuan lain tentang lama penyimpanan, termasuk cadangan: menunggu keputusan pengelola.]",
    ],
  },
  {
    title: "Perubahan kebijakan ini",
    paragraphs: ["[Cara pemberitahuan perubahan: menunggu keputusan pengelola.]"],
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Kebijakan privasi" updated="29 Oktober 2026 (draf)" sections={SECTIONS} />;
}
