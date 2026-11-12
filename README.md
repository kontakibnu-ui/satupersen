# Satu Persen

Web app life tracker: diary harian, ringkasan dan skor dari AI, kebiasaan, mood, pengeluaran, dan curhat lewat WhatsApp.

## Dokumen

Baca berurutan sebelum menyentuh kode:

1. [`AGENTS.md`](AGENTS.md): aturan kerja dan keputusan terkunci
2. [`PRD.md`](PRD.md): apa yang dibangun dan kriteria penerimaannya
3. [`DESIGN.md`](DESIGN.md): aturan tampilan (wajib untuk tugas UI)
4. [`TASKS.md`](TASKS.md): daftar tugas, yang terblokir, dan catatan keputusan

## Menjalankan di komputer sendiri

Butuh Node 22, npm, dan Docker Desktop.

```bash
npm install
npx supabase start          # database, auth, dan Mailpit lokal (Docker)
cp .env.example .env.local  # isi nilainya; lihat di bawah
npm run dev                 # http://127.0.0.1:3000
```

Buka lewat `http://127.0.0.1:3000`, bukan `localhost`: Supabase lokal hanya mengizinkan tautan masuk kembali ke host itu.

## File env

| File | Isi | Dibaca Next.js |
| --- | --- | --- |
| `.env.example` | Daftar nama variabel tanpa nilai. Satu-satunya file env di git. | Tidak |
| `.env.local` | Nilai untuk pengembangan: Supabase **lokal**, kunci OpenRouter, ID model | Ya |
| `.env.hosted` | Kredensial project Supabase hosted, hanya untuk mendorong migrasi | Tidak |

Nilai production diisi di dashboard Vercel, bukan di file.

## Perintah

| Perintah | Isi |
| --- | --- |
| `npm test` | Tes vitest untuk fungsi murni (tanggal, skor, streak, progres, schema AI, prompt, klien OpenRouter, filter krisis, signature WhatsApp). Tes yang memakai database (RLS, laporan terjadwal, pesan WhatsApp, ringkasan otomatis) hanya jalan bila env `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_ANON_KEY`, dan `LOCAL_SUPABASE_SERVICE_KEY` diisi dengan nilai stack lokal (`npx supabase start`); tanpa itu dilewati. |
| `npm run test:ui` | Playwright + axe di 360, 768, dan 1280 px, mode terang dan gelap, plus alur tiap layar, endpoint tick dan webhook, dan header keamanan. Tes yang butuh login dilewati bila Supabase lokal tidak jalan. Webhook dan tick memakai `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, dan `CRON_SECRET` di `.env.local` (nilai lokal acak; jangan isi `WHATSAPP_ACCESS_TOKEN` untuk tes agar tidak ada yang dikirim ke Meta). Untuk uji produksi: `npm run build`, `npm run start`, lalu `npm run test:ui`. |
| `npm run lint`, `npx tsc --noEmit`, `npm run build` | Wajib lulus sebelum tugas dicentang (`AGENTS.md` §2). |

## Struktur

```
src/app/(auth)/login        halaman masuk (grup tanpa segmen URL)
src/app/auth/callback       URL asli /auth/callback, penukar kode masuk
src/app/onboarding          persetujuan dan usia, di luar (app) karena tanpa navigasi
src/app/(app)/...           halaman yang butuh login dan persetujuan
src/app/api/...             route handler server
src/components/ui           komponen dasar (tombol) sesuai DESIGN.md §6
src/components              komponen yang dipakai lebih dari satu rute
src/lib, src/config         logika server, AI, tanggal, Supabase, krisis
supabase/migrations         satu-satunya tempat perubahan skema
e2e                         tes Playwright
```

Komponen yang hanya dipakai satu rute tinggal di folder rute itu.
