# TASKS.md — daftar tugas dan progres

Fase aktif: **Fase 1**

**Tidak ada tenggat per fase.** Urutan mengikuti dependensi, bukan kalender. Jika lancar, seluruh fase bisa selesai dalam 1 sampai 2 hari. Penghambat terbesar kemungkinan di luar kendali AI: verifikasi Meta Business dan aktivasi gateway pembayaran, jadi manusia memulainya di Fase 0.

**Prompt awal tiap sesi (salin ke AI):**

> Baca `AGENTS.md`, `PRD.md`, `DESIGN.md`, dan `TASKS.md` sampai habis. Kerjakan hanya tugas berikutnya yang belum dicentang di fase aktif, ikuti protokol di `AGENTS.md` §1. Tempel bukti verifikasi. Berhenti di akhir fase dan laporkan.

**Fase yang menyentuh UI baru dianggap selesai setelah user mengecek tampilannya** di HP sendiri (mode terang dan gelap), memakai daftar cek visual dari AI.

Jika tool AI-mu tidak otomatis membaca `AGENTS.md`, tempel isinya ke file aturan tool itu atau sertakan di prompt pertama.

---

## Fase 0 — Persiapan manusia (bukan tugas AI)

- [x] 0.1 Nama produk: Satu Persen (kode dan domain: `satupersen`)
- [x] 0.2 Buat project Supabase; catat URL, anon key, service role key (dikonfirmasi user 2026-10-28; kredensial diisi langsung ke `.env.local` di mesin user, tidak pernah masuk repo atau chat)
- [ ] 0.3 Buat akun OpenRouter dan API key
- [ ] 0.4 Pilih varian DeepSeek di [openrouter.ai/models](https://openrouter.ai/models): untuk output JSON pilih yang non-reasoning, dan pastikan ada provider yang lolos `data_collection: deny`. Uji 10 contoh entri (Indonesia, Inggris, campur, pendek, curhat berat), lalu isi `AI_MODEL_DAILY`, `AI_MODEL_CHAT`, `AI_MODEL_REPORT`
- [ ] 0.5 Mulai verifikasi Meta Business, buat app WhatsApp Cloud API, siapkan nomor uji (jangan tunggu fase lain)
- [ ] 0.6 Pilih gateway pembayaran (Midtrans atau Xendit) dan mulai aktivasi merchant
- [ ] 0.7 Setujui atau ubah draf teks respons krisis di `PRD.md` §7, lalu verifikasi sendiri nomor Healing119 di healing119.id
- [ ] 0.8 Buat akun Vercel dan siapkan domain
- [ ] 0.9 Baca `DESIGN.md` dan setujui arahnya (palet, font, wireframe), atau minta perubahan sebelum Fase 1.6

**Syarat mulai Fase 1:** minimal 0.2 selesai. Item lain boleh menyusul, tetapi tugas yang bergantung padanya akan terblokir.

---

## Fase 1 — Fondasi dan deploy awal

- [ ] 1.1 `git init` jika belum ada repo. Scaffold Next.js (TypeScript strict, Tailwind, shadcn/ui, vitest, Playwright, `@axe-core/playwright`). Script `npm test` dan `npm run test:ui` jalan. `.gitignore` mencakup `.env*`. `.env.example` berisi semua nama env dari `AGENTS.md` §4.
- [ ] 1.2 Migrasi SQL 12 tabel sesuai PRD §9, RLS di semua tabel, dan trigger yang membuat `profiles` saat user baru (AUTH-3). Buktikan isolasi: tulis hasil query yang menunjukkan user A tidak bisa membaca data user B.
- [ ] 1.3 `src/lib/dates.ts` dan tes vitest (timezone Asia/Jakarta, pergantian hari, WITA dan WIT)
- [ ] 1.4 Login Google dan magic link, middleware proteksi grup `(app)` (AUTH-1, AUTH-2)
- [ ] 1.5 Onboarding: disclaimer, persetujuan privasi, pernyataan usia 18 tahun ke atas, dan deteksi timezone browser (AUTH-3, AUTH-4)
- [ ] 1.6 Design system dan layout sesuai `DESIGN.md` §3 sampai §5: semua token warna light dan dark di `globals.css` (termasuk `control` dan `primary-foreground`), radius, font Plus Jakarta Sans dan Newsreader, navigasi bawah di HP, rail di tablet, sidebar di laptop, safe-area, `min-h-dvh`. Hanya link ke halaman yang sudah ada. `npm run test:ui` lulus.
- [ ] 1.7 Halaman Akun dasar (`/settings`): nama, timezone, tema (Sistem, Terang, Gelap), keluar
- [ ] 1.8 Deploy ke Vercel dengan env production. Login berhasil di URL production.

**Selesai bila:** user baru bisa login di URL production, melewati onboarding, dan melihat layout; build dan tes lulus; isolasi RLS terbukti.

---

## Fase 2 — Diary, ringkasan AI, skor

- [ ] 2.1 Editor `/today` dengan auto-save, auto-grow, dan mode fokus menulis di HP (DIARY-1, DIARY-2, DIARY-3, `DESIGN.md` §5 sampai §7)
- [ ] 2.2 `/history` kalender, entri lampau hanya baca (DIARY-4)
- [ ] 2.3 Klien OpenRouter, schema zod, prompts (AI-2). Mock hanya boleh di file tes.
- [ ] 2.4 `scoring.ts` dan tes: pembobotan, dimensi tanpa data dikeluarkan lalu bobot dibagi ulang, `delta_pct` null jika data kurang (SCORE-1, SCORE-2)
- [ ] 2.5 `POST /api/ai/summarize` dan UI hasil dengan tombol "Rangkum hari ini": ringkasan, cincin skor, delta, alasan, kuota rangkum ulang, dan ketujuh state di `DESIGN.md` §7 (AI-1, AI-3, AI-4, SCORE-3)
- [ ] 2.6 Penanganan krisis: `crisis.ts` (filter kata kunci, teks tetap), tampilan khusus tanpa skor (AI-5, PRD §7)

**Selesai bila:** menulis entri lalu menekan "Rangkum hari ini" menampilkan ringkasan dan skor dari model sungguhan. Kegagalan AI tertangani tanpa kehilangan entri. Bukti: lima entri contoh (Indonesia, Inggris, campur, sangat pendek, tanda krisis) dijalankan dan hasilnya dicatat di "Catatan keputusan AI".

---

## Fase 3 — Habit, mood, dashboard

- [ ] 3.1 CRUD habit dan arsip (HABIT-1)
- [ ] 3.2 Centang harian dan streak "jangan bolos dua kali" dengan tes: satu hari terlewat tidak memutus, dua hari berturut-turut memutus (HABIT-2, HABIT-3, PRD §5)
- [ ] 3.3 Mood dan energi (MOOD-1)
- [ ] 3.4 Hubungkan dimensi kebiasaan dan mood ke skor
- [ ] 3.5 Progres (`/dashboard`): rata-rata periode, persen vs periode sebelumnya, "sejak mulai", grafik 7 dan 30 hari, batang dimensi netral, state loading, kosong, error, sesuai wireframe `DESIGN.md` §8 (DASH-1, DASH-2, DASH-3)

**Selesai bila:** skor harian memakai data habit dan mood nyata, dan dashboard menampilkan riwayat dari data sungguhan.

---

## Fase 4 — Expense, laporan, scheduler

- [ ] 4.1 Input dan daftar expense, total harian dan bulanan, edit dan hapus (EXP-1, EXP-2, EXP-3)
- [ ] 4.2 Budget bulanan dan dimensi keuangan pada skor (EXP-4)
- [ ] 4.3 `POST /api/cron/tick` dengan pengecekan `CRON_SECRET` dan idempotensi
- [ ] 4.4 Laporan mingguan dan bulanan beserta halaman `/reports` (REPORT-1 sampai REPORT-4)
- [ ] 4.5 Pasang `pg_cron` + `pg_net` di Supabase untuk memanggil tick tiap 15 menit; buktikan dengan dua pemanggilan beruntun tidak membuat laporan ganda

**Selesai bila:** laporan terbentuk otomatis untuk user uji dan tidak pernah ganda.

---

## Fase 5 — WhatsApp (bisa ditukar urutannya dengan Fase 6 jika salah satunya terblokir di luar kode)

- [ ] 5.1 Endpoint webhook: handshake `GET`, verifikasi signature `POST` dengan tes, idempotensi `wa_message_id`
- [ ] 5.2 Halaman `/settings/whatsapp`: persetujuan, kode hubung, tombol `wa.me`; handler `LINK KODE`
- [ ] 5.3 Curhat: simpan pesan, tambahkan ke entri hari itu, balasan AI dengan prompt khusus chat, batas 1 balasan per hari untuk free (pesan di atas batas tetap disimpan, notifikasi batas sekali sehari, respons krisis tidak dibatasi)
- [ ] 5.4 Filter krisis pada tiap pesan masuk dan balasan teks tetap
- [ ] 5.5 Perintah `selesai`, `berhenti`, `mulai`, `bantuan`, dan balasan untuk pesan non-teks
- [ ] 5.6 Pengingat template dan ringkasan otomatis 22:00 lewat tick, dengan aturan jendela 24 jam

**Selesai bila:** dengan nomor uji, user bisa menghubungkan nomor, curhat beberapa pesan, mengetik `selesai`, dan menerima ringkasan; entri muncul di web; pesan dobel dari Meta tidak membuat entri ganda.

---

## Fase 6 — Langganan dan launch

- [ ] 6.1 Gating plan di server untuk semua batas di PRD §8
- [ ] 6.2 Pembayaran dan webhook, sinkron ke `subscriptions` dan `profiles` (SUB-1 sampai SUB-3). **Terblokir sampai gateway diputuskan.**
- [ ] 6.3 Export data (JSON) dan hapus akun beserta seluruh data
- [ ] 6.4 Landing page sesuai `DESIGN.md` §10, `/privacy`, `/terms` (draf, wajib ditinjau manusia), dan manifest PWA sesuai `DESIGN.md` §5
- [ ] 6.5 Checklist launch: semua env production terisi, audit RLS ulang, tidak ada log berisi isi diary, pencarian secret di repo, uji penuh di HP

**Selesai bila:** user baru bisa daftar, memakai fitur gratis, membayar, dan fitur premium terbuka; user bisa export dan menghapus akunnya.

---

## Terblokir

| Tugas | Penyebab | Dibutuhkan dari manusia |
| --- | --- | --- |
| 1.2, 1.4, 1.5, 1.7 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` belum ada di `.env.local` | Isi ketiga variabel dari dashboard Supabase langsung di file `.env.local` (jangan ditempel di chat) |
| 1.8 | Akun Vercel dan domain belum disiapkan (Fase 0.8) | Selesaikan 0.8, lalu beri URL production ke AI |

## Catatan keputusan AI

| Tanggal | Tugas | Keputusan dan alasan |
| --- | --- | --- |
| 2026-10-28 | Lingkungan | Mesin kerja: Node v22.23.2, npm 12.0.2, git 2.52.0, registry npm terjangkau. `LongPathsEnabled=0` dan project berada di dalam OneDrive; jika nanti `npm run build` atau Playwright gagal dengan error path terlalu panjang atau file terkunci, pindahkan project ke `C:\dev\satupersen`. |
| 2026-10-28 | Fase 1.1 | Folder project dinamai `satupersen` (bukan "Life Tracker") karena `create-next-app` memakai nama folder sebagai nama paket npm, dan spasi serta huruf besar ditolak aturan penamaan npm. |
| 2026-10-28 | Fase 1.1 | Scaffold wajib memakai `--no-agents-md`: `create-next-app` 16 membuat `AGENTS.md` sendiri secara default dan bisa menimpa `AGENTS.md` project ini. |
| 2026-10-28 | Fase 1.1 | Scaffold memakai `--empty` agar tidak ada halaman demo berisi konten palsu (`DESIGN.md` §12). `--react-compiler` dan cache components tidak dipakai karena tidak diminta PRD. |
| 2026-10-28 | Fase 1.1 | `.gitignore` bawaan Next mengabaikan `.env*` termasuk `.env.example`; perlu ditambah `!.env.example` agar template env tetap ikut masuk repo. |
| 2026-10-28 | Fase 1.1 | Versi paket terbaru di registry npm per 2026-10-28 (periksa ulang saat install): next dan create-next-app 16.4.3, tailwindcss 4.3.3, shadcn 4.23.0, vitest 5.0.5, @playwright/test 1.64.1, @axe-core/playwright 4.14.0, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0, zod 4.6.7, recharts 3.10.1, date-fns 4.4.0, date-fns-tz 3.2.0. |

## Ide ditunda

- "Tanya diary-mu" (pencarian AI di seluruh riwayat)
- Pesan suara WhatsApp dengan transkripsi
- Catat expense dan habit lewat WhatsApp
- Scan struk
- Laporan tahunan oleh AI
