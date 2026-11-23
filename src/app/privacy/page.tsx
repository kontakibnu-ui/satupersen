import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privasi · Satu Persen",
  alternates: { canonical: "/privacy" },
};

/**
 * Draft privacy policy (LAUNCH, PRD.md §7). It states what the product does, as
 * PRD.md §7 and §9 define it. The contact email was chosen by the user
 * (2026-11-18); it names no company, address, or storage period, because those
 * are decisions that are not made yet, and each is a bracketed gap for the
 * operator. A human must review it before launch.
 */
const SECTIONS: LegalSection[] = [
  {
    title: "Siapa yang mengelola Satu Persen",
    paragraphs: [
      "Untuk pertanyaan soal datamu, atau permintaan melihat, membetulkan, dan menghapusnya, kirim email ke satupersendev@gmail.com.",
      "[Nama pengelola dan alamat: menunggu keputusan pengelola.]",
    ],
  },
  {
    title: "Data yang kami simpan",
    paragraphs: ["Hanya yang kamu berikan atau hasilkan saat memakai Satu Persen:"],
    items: [
      "Akun: email, nama, timezone, dan persetujuanmu saat mendaftar.",
      "Tulisan harianmu, serta mood dan energi yang kamu pilih. Selama tulisan belum terkirim ke server (misalnya saat koneksi putus), salinannya disimpan sementara di browser perangkatmu supaya tidak hilang. Salinan itu dihapus setelah tulisan tersimpan di server, saat hari berganti, saat akun lain membuka Hari Ini di browser yang sama, dan saat kamu keluar dari akun atau menghapus akun.",
      "Kebiasaan yang kamu buat dan hari-hari kamu mencentangnya.",
      "Pengeluaran yang kamu catat, dan budget bulanan jika kamu mengaturnya. Screenshot bank dan file e-statement yang kamu pakai untuk mengisi catatan tidak disimpan, begitu juga password PDF-nya; yang tersimpan hanya catatan yang kamu simpan sendiri.",
      "Analisa uang yang kamu minta, satu untuk setiap bulan, sampai akunmu dihapus.",
      "Ringkasan, skor, dan laporan yang dibuat dari data di atas.",
      "Jika kamu memakai Belajar: bahan yang kamu tempel, penjelasan dan jawaban reviewmu, pertanyaan dan umpan balik yang dibuat dari bahan itu, serta jadwal reviewnya.",
      "Jika kamu memakai Ruang baca: file e-book yang kamu unggah (PDF, EPUB, DOCX, atau TXT), judulnya, dan posisi terakhir kamu membacanya. File disimpan privat; hanya kamu yang bisa membukanya. Setelah sebuah buku dibuka, salinannya juga disimpan di browser perangkatmu supaya tidak perlu diunduh ulang, dan salinan itu dihapus saat kamu keluar dari akun atau menghapus bukunya.",
      "Jika kamu menghubungkan WhatsApp: nomormu dan pesan yang kamu kirim ke Satu Persen, beserta balasannya.",
    ],
  },
  {
    title: "Untuk apa data dipakai",
    paragraphs: [
      "Hanya untuk menjalankan fitur yang kamu pakai: menyimpan tulisanmu, membuat ringkasan dan skor, menampilkan progres, membuat laporan, memeriksa penjelasan dan menjadwalkan review di Belajar, dan membalas pesanmu di WhatsApp.",
    ],
  },
  {
    title: "Siapa yang ikut memproses datamu",
    paragraphs: [
      "Untuk menjalankan layanan, data melewati pihak berikut. Masing-masing punya kebijakan privasinya sendiri.",
    ],
    items: [
      "Supabase: database, proses masuk, dan penyimpanan file e-book Ruang baca.",
      "Vercel: tempat aplikasi berjalan.",
      "OpenRouter dan penyedia model AI di baliknya: isi tulisan, mood, kebiasaan, dan pengeluaranmu dikirim ke sini agar ringkasan, laporan, dan balasan chat bisa dibuat. Di Belajar, bahan, penjelasan, dan jawabanmu dikirim saat kamu memintanya diperiksa. Saat kamu memakai “Isi dari screenshot” di Uang, gambarnya dibaca di perangkatmu dan tidak diunggah; hanya tulisan di gambar itu, dengan deretan angka panjang seperti nomor rekening disamarkan lebih dulu, yang dikirim agar nominal, tanggal, dan kategorinya bisa diisi. Tulisan itu tidak disimpan. “Dari e-statement” bekerja dengan cara yang sama: file PDF, CSV, atau Excel dibaca di perangkatmu dan tidak diunggah, password PDF hanya dipakai di perangkatmu, dan tulisannya dikirim setelah deretan angka panjang, alamat email, dan namamu disamarkan. Nama lawan transaksi, toko, alamat, dan saldo yang tertulis di e-statement tetap ikut terkirim. Tulisan itu juga tidak disimpan. Saat kamu meminta “Analisa uang”, angka uangmu bulan itu dan daftar catatannya, termasuk catatan yang kamu tulis, dikirim agar analisanya bisa ditulis. Isi buku di Ruang baca tidak pernah dikirim ke sini; hanya bagian yang kamu pilih sendiri lewat “Jadikan materi” lalu kamu simpan sebagai materi Belajar, dan hanya saat kamu memintanya diperiksa. Kami meminta hanya penyedia yang, menurut pernyataan mereka, tidak mengumpulkan datamu.",
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
