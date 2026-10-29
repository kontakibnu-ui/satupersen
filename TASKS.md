# TASKS.md — daftar tugas dan progres

Fase aktif: **Fase 2**. Tertinggal dari Fase 1 dan menunggu manusia: 1.2 (menerapkan migrasi ke project hosted) dan 1.8 (deploy Vercel).

**Cara membaca status:** `[x]` selesai dan lolos `AGENTS.md` §2. `[ ]` dengan "Kode selesai, menunggu cek visual user" berarti semua tes lulus dan tinggal kamu cek di HP. Bukti dan detail ada di "Catatan keputusan AI" di bawah.

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
- [ ] 0.4 Pilih varian DeepSeek di [openrouter.ai/models](https://openrouter.ai/models): untuk output JSON pilih yang non-reasoning, dan pastikan ada provider yang lolos `data_collection: deny`. Uji 10 contoh entri (Indonesia, Inggris, campur, pendek, curhat berat), lalu isi `AI_MODEL_DAILY`, `AI_MODEL_CHAT`, `AI_MODEL_REPORT`. Sebagian: `deepseek/deepseek-v4.1-flash` dipilih dan lolos `data_collection: deny`; 5 dari 10 contoh sudah diuji. Sisa: 5 contoh lagi.
- [ ] 0.5 Mulai verifikasi Meta Business, buat app WhatsApp Cloud API, siapkan nomor uji (jangan tunggu fase lain)
- [ ] 0.6 Pilih gateway pembayaran (Midtrans atau Xendit) dan mulai aktivasi merchant
- [ ] 0.7 Setujui atau ubah draf teks respons krisis di `PRD.md` §7, lalu verifikasi sendiri nomor Healing119 di healing119.id
- [ ] 0.8 Buat akun Vercel dan siapkan domain
- [ ] 0.9 Baca `DESIGN.md` dan setujui arahnya (palet, font, wireframe), atau minta perubahan sebelum Fase 1.6

**Syarat mulai Fase 1:** minimal 0.2 selesai. Item lain boleh menyusul, tetapi tugas yang bergantung padanya akan terblokir.

---

## Fase 1 — Fondasi dan deploy awal

- [x] 1.1 `git init` jika belum ada repo. Scaffold Next.js (TypeScript strict, Tailwind, shadcn/ui, vitest, Playwright, `@axe-core/playwright`). Script `npm test` dan `npm run test:ui` jalan. `.gitignore` mencakup `.env*`. `.env.example` berisi semua nama env dari `AGENTS.md` §4.
- [ ] 1.2 Migrasi SQL 12 tabel sesuai PRD §9, RLS di semua tabel, dan trigger yang membuat `profiles` saat user baru (AUTH-3). Buktikan isolasi: tulis hasil query yang menunjukkan user A tidak bisa membaca data user B. Terbukti di Supabase lokal. Sisa: terapkan dua file migrasi ke project hosted (lihat Terblokir).
- [x] 1.3 `src/lib/dates.ts` dan tes vitest (timezone Asia/Jakarta, pergantian hari, WITA dan WIT)
- [ ] 1.4 Login Google dan magic link, proxy proteksi grup `(app)` (AUTH-1, AUTH-2). Magic link terverifikasi lokal. Sisa: OAuth Google (lihat Terblokir) dan cek visual user.
- [ ] 1.5 Onboarding: disclaimer, persetujuan privasi, pernyataan usia 18 tahun ke atas, dan deteksi timezone browser (AUTH-3, AUTH-4). Kode selesai, menunggu cek visual user.
- [x] 1.6a Token warna light dan dark di `globals.css` sesuai `DESIGN.md` §3 (semua token, termasuk `control` dan `primary-foreground`), radius, dan pemetaan token ke nama token shadcn agar komponen bawaan shadcn ikut patuh.
- [x] 1.6b Font Plus Jakarta Sans dan Newsreader lewat `next/font/google`, skala dan berat tipografi `DESIGN.md` §4, dan `lang="id"` pada `<html>`.
- [ ] 1.6c Shell responsif: `min-h-dvh`, `viewport-fit=cover`, padding safe-area, lebar konten maksimum 680 px (960 px untuk Progres), padding samping 16 px di HP. Verifikasi `npm run test:ui` di 360, 768, dan 1280 px mode terang dan gelap. Sebagian: semua kecuali kontainer 960 px, yang baru dibutuhkan halaman Progres di 3.5.
- [ ] 1.6d Navigasi bawah di HP, rail di tablet, sidebar di laptop. Kode selesai, menunggu cek visual user.
- [ ] 1.7 Halaman Akun dasar (`/settings`): nama, timezone, tema (Sistem, Terang, Gelap), keluar. Kode selesai, menunggu cek visual user.
- [ ] 1.8 Deploy ke Vercel dengan env production. Login berhasil di URL production.

**Selesai bila:** user baru bisa login di URL production, melewati onboarding, dan melihat layout; build dan tes lulus; isolasi RLS terbukti.

---

## Fase 2 — Diary, ringkasan AI, skor

- [ ] 2.1 Editor `/today` dengan auto-save, auto-grow, dan mode fokus menulis di HP (DIARY-1, DIARY-2, DIARY-3, `DESIGN.md` §5 sampai §7). Kode selesai, menunggu cek visual user.
- [ ] 2.2 `/history` kalender, entri lampau hanya baca (DIARY-4). Kode selesai, menunggu cek visual user dan keputusan pintu masuk (lihat Terblokir).
- [x] 2.3 Klien OpenRouter, schema zod, prompts (AI-2). Mock hanya boleh di file tes.
- [x] 2.4 `scoring.ts` dan tes: pembobotan, dimensi tanpa data dikeluarkan lalu bobot dibagi ulang, `delta_pct` null jika data kurang (SCORE-1, SCORE-2)
- [ ] 2.5 `POST /api/ai/summarize` dan UI hasil dengan tombol "Rangkum hari ini": ringkasan, cincin skor, delta, alasan, kuota rangkum ulang, dan ketujuh state di `DESIGN.md` §7 (AI-1, AI-3, AI-4, SCORE-3). Kode selesai dan diselaraskan dengan `DESIGN.md` §6 dan §7, menunggu cek visual user. Rate limit per user terblokir (lihat Terblokir).
- [ ] 2.6 Penanganan krisis: `crisis.ts` (filter kata kunci, teks tetap), tampilan khusus tanpa skor (AI-5, PRD §7). Tampilan selesai; teks masih draf dan menunggu persetujuan user (0.7).

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
- [ ] 6.4 Landing page sesuai `DESIGN.md` §10, `/privacy`, `/terms` (draf, wajib ditinjau manusia), dan manifest PWA sesuai `DESIGN.md` §5. Kebijakan privasi wajib menyebut bahwa isi entri dikirim ke penyedia model, dan ke penyedia embedding bila pgvector dipakai (PRD §7)
- [ ] 6.5 Checklist launch: semua env production terisi, audit RLS ulang, tidak ada log berisi isi diary, pencarian secret di repo, pencarian nama dan nilai tiap secret di hasil build (`.next/static`), uji RLS dengan anon key saja, uji akses data user lain dengan mengganti ID, cek header keamanan produksi (CSP, HSTS, nosniff, framing, Referrer-Policy), `npm audit`, uji penuh di HP

**Selesai bila:** user baru bisa daftar, memakai fitur gratis, membayar, dan fitur premium terbuka; user bisa export dan menghapus akunnya.

---

## Fase 7 — Tanya diary-mu (setelah Fase 6)

- [ ] 7.1 Migrasi: indeks pencarian dan `ask_usage` sesuai keputusan `PRD.md` §11, RLS aktif. Buktikan isolasi: pencarian user A tidak mengembalikan entri user B (ASK-1, ASK-8)
- [ ] 7.2 Pengindeksan entri lewat tick atau setelah dirangkum, tidak pernah saat auto-save; ikut diperbarui dan dihapus bersama entri (ASK-8); indeks tidak ikut export dan tidak pernah muncul di respons API (data turunan, PRD §7)
- [ ] 7.3 `POST /api/ai/ask`: validasi zod (pertanyaan maks 300 karakter, potongan maks 8, batas total karakter konteks), filter krisis, pencarian dengan sesi user, prompt berlandaskan entri di `prompts.ts`, validasi sumber terhadap hasil pencarian, kuota dan rate limit di server (ASK-1 sampai ASK-7); pertanyaan dan jawaban tidak disimpan dan tidak masuk log, yang tercatat hanya hitungan pemakaian harian (ASK-7); jalur krisis tidak dihitung ke kuota (ASK-5); pesan error ke user berupa kalimat umum tanpa detail internal (PRD §7, AGENTS.md §6)
- [ ] 7.4 UI Tanya diary-mu dengan state loading, kosong, dan error; jawaban ditampilkan sebagai teks biasa tanpa HTML dan tanpa tautan aktif buatan model, dengan sumber yang bisa dibuka di `/history` (PRD §7). Wireframe dan penempatan navigasi ditambahkan dulu ke `DESIGN.md` dan perlu disetujui user
- [ ] 7.5 Uji guardrail dengan model sungguhan, hasilnya dicatat: pertanyaan yang jawabannya ada, tidak ada, minta diagnosis, bertanda krisis, entri berisi instruksi tersembunyi (prompt injection), dan dua user dengan entri mirip

**Selesai bila:** user bertanya tentang riwayatnya dan menerima jawaban bersumber tanggal yang benar; pertanyaan tanpa bukti dijawab "tidak menemukan"; tidak ada data lintas user yang bocor.

---

## Terblokir

| Tugas | Penyebab | Dibutuhkan dari manusia |
| --- | --- | --- |
| 1.2 (sisa) | Migrasi sudah terbukti di Supabase lokal, tetapi belum diterapkan ke project hosted: koneksi "Direct connection" hanya IPv6, sedangkan mesin ini hanya IPv4 | Ambil URI **Session pooler** (IPv4) di dashboard → Connect dan isi sebagai `SUPABASE_DB_URL` di `.env.hosted`, atau jalankan isi kedua file di `supabase/migrations/` berurutan di SQL Editor |
| 1.4 (sisa) | OAuth Google butuh client ID dari Google, dan magic link di production butuh SMTP (email bawaan Supabase sangat dibatasi) | Buat OAuth client Google dan daftarkan di Supabase → Authentication → Providers; tentukan SMTP |
| 1.8 | Akun Vercel dan domain belum disiapkan (Fase 0.8) | Selesaikan 0.8, lalu beri URL production ke AI |
| 2.5 (rate limit) | `AGENTS.md` §6 mewajibkan rate limit per user untuk endpoint AI, tetapi `PRD.md` §9 tidak punya tempat menyimpan hitungannya. Hitungan di memori tidak berlaku antar instance Vercel, dan menambah tabel di luar PRD dilarang tanpa persetujuan. Kuota rangkum ulang (AI-4) sudah jalan, tetapi percobaan yang gagal tidak terhitung | Setujui tabel kecil `rate_limits` (`user_id`, `bucket`, `window_start`, `count`) yang hanya ditulis server, atau pilih cara lain |
| 2.2 (pintu masuk) | `/history` sudah jadi, tetapi `DESIGN.md` §5 menaruh pintunya di halaman Progres (3.5) dan navigasi tidak memuat Riwayat. Sampai 3.5 selesai, Riwayat hanya bisa dibuka lewat URL `/history` | Putuskan: biarkan sampai 3.5, atau izinkan tautan sementara (mengubah `DESIGN.md`) |
| 2.6 | Teks respons krisis belum disetujui manusia (Fase 0.7); AI dilarang mengarang nomor layanan | Setujui atau ubah draf di `PRD.md` §7 |
| 7.1 sampai 7.5 | Metode pencarian, model embedding, kuota per plan, dan persetujuan menyimpan indeks pencarian masih terbuka (`PRD.md` §11); selain itu bergantung pada Fase 2 sampai 6. Temuan verifikasi 2026-10-28: katalog OpenRouter (464 model) tidak memuat satu pun model embedding dan keluarga DeepSeek tidak menyediakan embedding, jadi usulan pgvector butuh penyedia embedding di luar keputusan terkunci `AGENTS.md` §4 | Putuskan empat butir ASK di `PRD.md` §11 sebelum Fase 7 dimulai. Pilihan realistis: full-text Postgres (tanpa penyedia baru, lebih lemah untuk pertanyaan parafrase) atau pgvector dengan penyedia embedding baru (mis. OpenAI, Gemini, Cohere langsung, atau model lokal) plus revisi `AGENTS.md` §4 |

## Catatan keputusan AI

| Tanggal | Tugas | Keputusan dan alasan |
| --- | --- | --- |
| 2026-10-28 | Lingkungan | Mesin kerja: Node v22.23.2, npm 12.0.2, git 2.52.0, registry npm terjangkau. `LongPathsEnabled=0` dan project berada di dalam OneDrive; jika nanti `npm run build` atau Playwright gagal dengan error path terlalu panjang atau file terkunci, pindahkan project ke `C:\dev\satupersen`. |
| 2026-10-28 | Fase 1.1 | Folder project dinamai `satupersen` (bukan "Life Tracker") karena `create-next-app` memakai nama folder sebagai nama paket npm, dan spasi serta huruf besar ditolak aturan penamaan npm. |
| 2026-10-28 | Fase 1.1 | Scaffold wajib memakai `--no-agents-md`: `create-next-app` 16 membuat `AGENTS.md` sendiri secara default dan bisa menimpa `AGENTS.md` project ini. |
| 2026-10-28 | Fase 1.1 | Scaffold memakai `--empty` agar tidak ada halaman demo berisi konten palsu (`DESIGN.md` §12). `--react-compiler` dan cache components tidak dipakai karena tidak diminta PRD. |
| 2026-10-28 | Fase 1.1 | `.gitignore` bawaan Next mengabaikan `.env*` termasuk `.env.example`; perlu ditambah `!.env.example` agar template env tetap ikut masuk repo. |
| 2026-10-28 | Fase 1.1 | Versi paket terbaru di registry npm per 2026-10-28 (periksa ulang saat install): next dan create-next-app 16.4.3, tailwindcss 4.3.3, shadcn 4.23.0, vitest 5.0.5, @playwright/test 1.64.1, @axe-core/playwright 4.14.0, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0, zod 4.6.7, recharts 3.10.1, date-fns 4.4.0, date-fns-tz 3.2.0. |
| 2026-10-28 | Fase 1.1 | `@types/node` dinaikkan dari `^20` ke `^22` karena `vitest@5.0.5` mensyaratkan peer `@types/node@^22 \|\| >=24`, dan `^22` sejalan dengan Node v22.23.2 di mesin ini. |
| 2026-10-28 | Fase 1.1 | Konfigurasi vitest diberi ekstensi `.mts` agar tidak dibaca sebagai CommonJS (menghilangkan peringatan `configLoader` dari Vite). |
| 2026-10-28 | Fase 1.1 | Script `test` memakai `--passWithNoTests` sementara; dihapus di 1.3 setelah `src/lib/dates.test.ts` ada, supaya pola include yang salah tidak lolos diam-diam. |
| 2026-10-28 | Fase 1.1 | shadcn/ui memakai library primitif **Base UI** dan preset `nova` (dipilih user). `shadcn init` menambahkan font Geist di `layout.tsx` dan token netral di `globals.css`; keduanya menyimpang dari `DESIGN.md` §3 dan §4 dan wajib diganti di 1.6. |
| 2026-10-28 | Fase 1.1 | `npm run test:ui` menjalankan `next dev` lewat `webServer` Playwright (bukan build produksi) untuk kecepatan di mesin ini. Smoke test `e2e/smoke.spec.ts` memeriksa scroll horizontal, axe serius/kritis, dan target sentuh 44 px di 360/768/1280 px mode terang dan gelap; diperluas/diganti di 1.6 sesuai `DESIGN.md` §13. |
| 2026-10-28 | Fase 1.1 | `shadcn init` bersifat interaktif: butuh `-b <base>` dan `-p <preset>` eksplisit (preset valid: nova, vega, maia, lyra, mira, luma, sera, rhea) agar tidak menggantung di prompt. |
| 2026-10-28 | Fase 1.3 | Aritmetika kalender (`addDays`, `daysBetween`, `lastNDays`, minggu, bulan) dihitung di ruang UTC (`Date.UTC` + penambahan milidetik), bukan lewat `addDays` date-fns pada waktu lokal, karena fungsi berbasis waktu lokal dapat bergeser bila mesin pengembang berada di zona ber-DST. `date-fns-tz` tetap dipakai untuk konversi instan ke tanggal user (`formatInTimeZone`). |
| 2026-10-28 | Fase 1.3 | Nilai harapan tes diambil dari `Intl.DateTimeFormat` (ICU) sebagai sumber independen, bukan dari implementasi yang diuji. Mencakup pergantian hari WIB vs WITA vs WIT, zona ber-DST, tahun kabisat, dan tanggal tidak valid (`2026-02-31` ditolak). |
| 2026-10-28 | Fase 1.3 | Kunci tanggal divalidasi pola `yyyy-MM-dd` dan pemeriksaan bolak-balik; kunci tidak valid melempar error dengan pesan jelas, tidak dikembalikan sebagai `Invalid Date`. |
| 2026-10-28 | Fase 1.3 | `--passWithNoTests` dihapus dari script `test`. 32 tes lulus, `tsc`, `lint`, dan `build` lulus. Commit `a46d5c4`. |
| 2026-10-28 | Fase 1.6 | 1.6 dipecah menjadi 1.6a sampai 1.6d karena navigasi tidak punya halaman untuk ditautkan: satu-satunya rute yang ada adalah `/`, sedangkan item navigasi `DESIGN.md` §5 (`/today`, `/habits`, `/expenses`, `/dashboard`, `/settings`) baru lahir di 1.7, 2.1, 2.2, 3.1, 3.5, dan 4.1. Membuat halaman kosong dilarang `AGENTS.md` §5. |
| 2026-10-28 | Fase 1.6a | Token `DESIGN.md` §3 dideklarasikan sekali per mode dengan `light-dark()` dan `color-scheme`, sehingga mode gelap mengikuti sistem secara otomatis, dan pilihan manual cukup menetapkan kelas `light`/`dark` di `<html>` (dipasang di 1.7). Bukti: `e2e/design-tokens.spec.ts` mencocokkan nilai rgb token di kedua mode dan menguji override dua arah. |
| 2026-10-28 | Fase 1.6a | Token shadcn (`--color-card`, `--color-muted`, `--color-accent`, `--color-destructive`, `--color-input`, `--color-ring`) dipetakan ke token `DESIGN.md` supaya komponen shadcn patuh otomatis tanpa hex di komponen. Radius: sm 8, md 10, lg 12, xl 16 px. |
| 2026-10-28 | Fase 1.6b | Font Geist dari preset shadcn dihapus, diganti Plus Jakarta Sans dan Newsreader lewat variabel `--font-plus-jakarta-sans` dan `--font-newsreader`; `--font-heading` menunjuk ke Newsreader. `<html lang="id">` karena seluruh teks UI berbahasa Indonesia. |
| 2026-10-28 | Fase 1.6b | Skala tipografi `DESIGN.md` §4 ditambahkan sebagai `--text-label` (12 px), `--text-title` (24 px), `--text-focus` (40 px), `--text-score` (56 px), dan `--text-editor` (18 px, tinggi baris 1,7). Ukuran 14, 16, dan 18 px memakai skala bawaan Tailwind. |
| 2026-10-28 | Fase 1.6 | Commit `5cdd519`: `build`, `lint`, `tsc`, 32 tes vitest, dan 12 tes Playwright lulus. Catatan terbuka: komponen shadcn memakai varian `dark:` berbasis kelas `.dark`, sedangkan token mengikuti sistem; kelas `.dark` baru dipasang di 1.7, jadi sebelum itu varian `dark:` di komponen shadcn belum aktif saat sistem gelap. |
| 2026-10-28 | Fase 1.1 | `npm install` di dalam OneDrive butuh sekitar 5 menit untuk 357 paket. `node_modules`, `.next`, `test-results`, dan `*.tsbuildinfo` tidak ikut ter-commit. Commit pertama: `7f1073a`. |
| 2026-10-28 | Fase 1.6 | Rute `/` masih berisi teks bawaan scaffold (`--empty`: "Hello world!") karena halaman Hari Ini baru dibuat di 2.1 dan landing page di 6.4. Ini teks bawaan, bukan data contoh buatan AI, dan tidak boleh ditambahi konten palsu. |
| 2026-10-28 | Fase 2.4 | 2.4 dikerjakan sebelum 2.1-2.3 karena 2.1 dan 2.2 butuh tabel serta login (terblokir kredensial Supabase) dan 2.3 serta 2.5 butuh API key OpenRouter. `scoring.ts` adalah fungsi murni tanpa ketergantungan keduanya, dan `SCORE-1` memang memisahkan perhitungan skor dari jalur AI. |
| 2026-10-28 | Fase 2.4 | Bobot dimensi disimpan sebagai konstanta `DIMENSION_WEIGHTS` (kebiasaan 30%, produktivitas 30%, mood dan energi 25%, keuangan 15%) sesuai tabel `PRD.md` §5, tetapi `PRD.md` §11 masih membuka "bobot skor final setelah diuji pada contoh entri nyata". Konstanta ini satu tempat, jadi mengubahnya murah setelah user menguji dengan entri asli. |
| 2026-10-28 | Fase 2.4 | Kurva dimensi keuangan adalah tafsiran saya karena `PRD.md` hanya menyebut "pengeluaran hari itu vs budget harian": nilai 100 bila pengeluaran di bawah atau sama dengan budget harian, lalu turun garis lurus ke 0 tepat di dua kali budget harian, dan berhenti di 0 setelahnya. Ini perlu ditinjau user; angkanya mudah diubah di `financeValue`. |
| 2026-10-28 | Fase 2.4 | Input yang tidak mungkin datang dari database melempar error, bukan dibulatkan diam-diam (mis. mood 6, `completedHabitCount` melebihi `activeHabitCount`, `daysInMonth` 0, `monthlyBudget` 0 yang akan membuat pembagian nol). `delta_pct` dibulatkan 1 angka desimal; pembulatan tampilan ditentukan UI di 3.5 dan 4.4. |
| 2026-10-28 | Fase 2.4 | Total 49 tes lulus (32 tanggal + 17 skor), `tsc`, `lint`, dan `build` lulus. Commit `cbc3222`. |
| 2026-10-28 | Lingkungan | Mesin ini tidak punya alamat IPv6 global dan `ipv6.google.com:443` tidak terjangkau, sedangkan host database Supabase "Direct connection" hanya punya alamat IPv6. Karena itu `supabase db push` gagal (`getaddrinfo ENOTFOUND`). Docker Desktop terpasang (v29.6.1) tetapi engine-nya belum berjalan, jadi Supabase lokal belum bisa dipakai. |
| 2026-10-28 | Fase 1.2 | Migrasi 12 tabel, RLS di semua tabel, dan trigger `handle_new_user` ditulis di `supabase/migrations/20261028180000_init.sql`; `supabase init` sudah dijalankan. Migrasi belum bisa diterapkan sampai ada koneksi database, jadi bukti isolasi RLS juga masih menunggu. |
| 2026-10-28 | Fase 1.2 | Policy `habit_logs` diperketat di luar `user_id = auth.uid()`: baris hanya boleh dibuat bila `habit_id` itu milik user yang sama, supaya log tidak bisa ditempelkan ke habit milik user lain dan mengacaukan perhitungan streak-nya. Tabel server-only (`subscriptions`, `whatsapp_link_codes`, `wa_messages`) tetap tanpa policy, dan `anon` dicabut semua hak akses tabel. |
| 2026-10-28 | Fase 2.3 | Klien OpenRouter, schema zod, dan prompt selesai. Setiap request memakai `temperature` 0.2, `response_format: { type: "json_object" }`, `provider.data_collection: "deny"`, dan timeout 30 detik. Output tidak valid dicoba ulang sekali, lalu melempar error supaya pemanggil menandai status `failed` (AI-2). |
| 2026-10-28 | Fase 2.3 | Alur krisis dibuat dua tahap setelah uji hidup menemukan masalah nyata: untuk entri bertanda krisis, model hanya mengisi sebagian field sehingga schema penuh menolaknya dan hari itu berakhir `failed`. Sekarang `risk_flag` dan `language` dibaca lebih dulu; bila `risk_flag` true, teks model dibuang dan aplikasi memakai teks tetap dari `crisis.ts` tanpa skor, sesuai `PRD.md` §7 dan `DESIGN.md` §9. |
| 2026-10-28 | Fase 2.3 | Uji hidup model `deepseek/deepseek-v4.1-flash` untuk 5 contoh entri: Indonesia, Inggris, campur, sangat pendek, dan tanda krisis. Hasil: bahasa mengikuti entri (entri campur dinilai `id` karena dominan Indonesia), entri sangat pendek mendapat skor dimensi 5, entri bertanda krisis mengembalikan `kind=crisis`. Harness uji hidup dihapus setelah dipakai agar `npm test` tidak pernah menembak jaringan. |
| 2026-10-28 | Fase 2.3 | Commit `3951886` memuat migrasi 1.2 dan modul AI. 59 tes unit lulus (32 tanggal, 17 skor, 10 schema), `tsc`, `lint`, dan `build` lulus. |
| 2026-10-28 | Fase 0.4 | Syarat "pastikan ada provider yang lolos `data_collection: deny`" terbukti terpenuhi tanpa membuka dashboard: seluruh uji hidup dikirim dengan `provider.data_collection: "deny"` dan dilayani tanpa error, jadi minimal satu provider untuk `deepseek/deepseek-v4.1-flash` memenuhi kebijakan itu. Kalau nanti muncul error "tidak ada provider", itu tanda untuk mengganti model atau provider, bukan alasan melonggarkan setelan (`AGENTS.md` §6). |
| 2026-10-28 | Fase 2.3 | Ditambahkan `src/lib/ai/openrouter.test.ts` (9 tes, `fetch` di-stub; mock hanya di file tes sesuai 2.3). Tes mengunci: bentuk request (`temperature` 0.2, `response_format: json_object`, `provider.data_collection: deny`), retry sekali saat output tidak valid, gagal setelah dua kali, jalur krisis yang tidak butuh schema penuh, error provider yang membawa status, dan env kosong yang melempar `AiConfigError` tanpa memanggil jaringan. |
| 2026-10-28 | Fase 2.3 | Total 68 tes unit lulus (32 tanggal, 17 skor, 10 schema, 9 klien). `tsc` dan `lint` lulus. |
| 2026-10-28 | Dokumen | `PRD.md` naik ke v1.4 dan `AGENTS.md` §6 bertambah dua aturan keamanan (klien tidak dipercaya; setiap endpoint memeriksa kepemilikan data di server). Keduanya ditulis user dan ikut ter-commit di `d38ed36`. Modul ASK pindah dari "Ide ditunda" ke MVP dengan catatan "dikerjakan setelah Fase 6", dan Fase 7 di `TASKS.md` juga dari user. |
| 2026-10-28 | Dokumen | Saya sempat menambahkan bagian Fase 7 kedua di `TASKS.md` tanpa memeriksa dulu bahwa user sudah membuatnya; bagian duplikat itu dihapus. Butir `PRD.md` yang belum tercantum di Fase 7 versi user ditambahkan sebagai klausa pada 7.2, 7.3, 7.4, dan 6.4, bukan sebagai tugas baru. |
| 2026-10-28 | Aturan baru | Aturan baru `AGENTS.md` §6 berlaku mulai pekerjaan berikutnya: respons API hanya memuat field yang dibutuhkan layar, pesan error ke user berupa kalimat umum tanpa stack trace, prompt dan ID model tidak sampai ke klien, dan source map produksi tidak diaktifkan. `openrouter.ts` sudah menyimpan ID model di server saja; tugas 2.5 wajib menerjemahkan `AiConfigError`, `AiProviderError`, dan `AiOutputError` menjadi kalimat umum. |
| 2026-10-28 | Fase 7 | Verifikasi katalog OpenRouter (464 model, 2026-10-28): **nol model embedding**, dan tidak ada embedding dari keluarga DeepSeek. Jadi usulan pgvector di `PRD.md` §11 tidak bisa dijalankan lewat OpenRouter; pilihannya full-text Postgres atau menambah penyedia embedding baru di luar keputusan terkunci. |
| 2026-10-28 | Fase 7 | Catatan teknis untuk keputusan itu: Postgres tidak punya konfigurasi pencarian teks `indonesian` bawaan, sehingga full-text untuk entri campur Indonesia-Inggris kemungkinan memakai konfigurasi `simple` dan lebih lemah untuk pertanyaan parafrase. Itu justru alasan pgvector menarik, dengan harga berupa penyedia embedding baru. |
| 2026-10-28 | Fase 1.4 | `cacheComponents` dimatikan di `next.config.ts` (sebelumnya menyala dari scaffold). Bukti: `next build` gagal dengan "Route /login: Next.js encountered uncached or runtime data during prerendering" karena setiap halaman membaca cookie sesi lewat layout `(app)`. Seluruh aplikasi ini per-user, tidak ada halaman yang boleh dirender sekali untuk semua orang, jadi mematikan Cache Components lebih jujur daripada menambahkan Suspense di setiap pembacaan cookie. |
| 2026-10-28 | Fase 1.4 | Migrasi `middleware.ts` → `proxy.ts` **selesai**: dokumentasi resmi (`nextjs.org/docs/messages/middleware-to-proxy`) menyatakan konvensinya hanya berganti nama, fungsi `middleware` menjadi `proxy`, dan `export const config` tetap. Setelah migrasi, peringatan deprecation hilang dari `next build` maupun `next dev`, dan 23 tes Playwright tetap lulus — termasuk dua tes AUTH-2 yang mengalir lewat proxy, jadi perilakunya benar-benar terverifikasi, bukan sekadar berhasil dikompilasi. Catatan: dokumentasi itu juga menyarankan memakai Proxy seperlunya, dan menyegarkan sesi Supabase memang pemakaian yang dianjurkan dokumentasi Supabase. |
| 2026-10-28 | Fase 1.4 | Dua klien Supabase server: `createSupabaseServerClient` untuk Server Component (tanpa `setAll`, sesuai dokumentasi @supabase/ssr bahwa middleware yang menulis) dan `createSupabaseActionClient` untuk Server Action dan Route Handler yang memang boleh menulis cookie. Tanpa pemisahan ini, login dan keluar akan tampak berhasil tetapi sesinya hilang, dan `AGENTS.md` §3 melarang menutupinya dengan `catch {}` kosong. |
| 2026-10-28 | Fase 1.7 | Tema disimpan di `localStorage` sebagai kelas `light`/`dark` pada `<html>`, tanpa kolom baru di `profiles`, karena `PRD.md` §9 mengunci bentuk tabel. Pilihan "Sistem" menghapus kedua kelas sehingga preferensi perangkat yang berlaku. |
| 2026-10-28 | Fase 1.7 | Membaca nilai dari browser (timezone dan tema) memakai `useSyncExternalStore`, bukan `useEffect` + `setState`: aturan lint `react-hooks/set-state-in-effect` di eslint-config-next 16 menolak pola itu, dan pola ini juga menghindari render ganda saat hidrasi. |
| 2026-10-28 | Fase 1.2 | Ditambahkan `src/lib/supabase/rls.test.ts` (7 tes): dua user sungguhan dibuat lewat Admin API, lalu dibuktikan user B tidak bisa membaca entri user A, tidak bisa menulis atas nama A, anon tidak punya akses tabel, tabel server-only tertutup, dan menghapus akun menghapus entrinya. Tes ini ter-skip tanpa env `LOCAL_SUPABASE_*`, sehingga `npm test` tetap tidak menyentuh jaringan. |
| 2026-10-28 | Lingkungan | Upaya menemukan region pooler sendiri: header API Supabase memuat `CF-Ray: ...-SIN` (edge Singapura), tetapi tiga kandidat host pooler (`aws-0/aws-1-ap-southeast-1`, `aws-0-ap-southeast-2`) menjawab "tenant/user not found". Menebak region dihentikan di tiga percobaan. Stack Supabase lokal sudah dinyalakan lewat Docker, tetapi penarikan image-nya macet berulang kali sehingga belum bisa dipakai sebagai jalur verifikasi. |
| 2026-10-28 | Fase 1.4 | Commit `5ebc257`: alur auth, onboarding, dan Akun. 92 tes lulus (7 tes RLS ter-skip), `tsc`, `lint`, dan `build` lulus dengan rute `/login`, `/onboarding`, `/settings`, `/auth/callback` sebagai rute dinamis. |
| 2026-10-28 | Lingkungan | Stack Supabase lokal akhirnya berhasil dijalankan lewat Docker (image selesai ditarik setelah beberapa kali percobaan). `.env.local` sekarang menunjuk ke stack lokal (`http://127.0.0.1:54321`) dan menimpa `.env` yang berisi project hosted, sehingga pengembangan dan tes tidak menyentuh data produksi. Playwright memakai `127.0.0.1:3000` karena `site_url` di `supabase/config.toml` mengizinkan host itu untuk redirect tautan masuk. |
| 2026-10-28 | Fase 1.4 | Tiga bug nyata ketemu saat menjalankan alur sungguhan, semuanya sudah diperbaiki: (1) Next 16 memblokir resource dev untuk origin `127.0.0.1` sehingga bundle klien tidak dimuat dan halaman tidak terhidrasi (form tersubmit native) — diperbaiki dengan `allowedDevOrigins`; (2) `request.url` dinormalkan Next dev ke host kanoniknya (`localhost`) sehingga redirect dan cookie berpindah host — diperbaiki dengan membangun origin dari header `Host`/`x-forwarded-*`, yang juga benar di balik proxy produksi; (3) matcher proxy tidak mengecualikan `_next/hmr`, sehingga socket hot reload ikut lewat pemeriksaan sesi. |
| 2026-10-28 | Fase 1.2 | Ekspektasi tes RLS diperbaiki: saat RLS menyembunyikan seluruh baris, PostgREST menjawab **200 dengan array kosong**, bukan error. Tes sekarang memastikan tidak ada baris yang bocor **dan** menolak tulisan ke tabel server-only, bukan sekadar mengharapkan status 4xx. Ditambah pengaman: tes RLS melewati diri kalau stack lokal tidak terjangkau, supaya `npm test` tetap lulus tanpa Docker. |
| 2026-10-28 | Fase 1.4 | `e2e/onboarding-flow.spec.ts` menjalankan alur penuh terhadap stack lokal: minta tautan email dari halaman login, ambil tautannya dari Mailpit, buka, sesi terbentuk, gerbang onboarding muncul dan tidak bisa dilewati, lalu mendarat di Akun dengan navigasi aktif. Bukti: `npm test` 99 tes lulus, `npm run test:ui` 24 tes lulus. Commit `d9d6087`. |
| 2026-10-28 | Rute `/` | Rute akar sebelumnya menampilkan teks bawaan scaffold ("Hello world!") karena landing page adalah tugas 6.4. Sekarang `/` mengalihkan ke `/today` bila sudah masuk dan ke `/login` bila belum, supaya tidak ada yang mendarat di teks scaffold. Pengalihan ini **sementara** sampai landing page dikerjakan di 6.4. |
| 2026-10-28 | Fase 2.1 | Aturan Next.js yang tertangkap build: berkas `"use server"` hanya boleh mengekspor fungsi async. Saya sempat mengekspor konstanta `MAX_CONTENT_LENGTH` dari `actions.ts`, dan akibatnya seluruh modul dianggap tidak punya ekspor sama sekali. Konstanta itu dipindah ke `src/lib/entries.ts` yang dipakai editor dan server action bersama. |
| 2026-10-28 | Lingkungan | **Temuan penting:** `e2e/smoke.spec.ts` dan `e2e/design-tokens.spec.ts` berstatus `ReparsePoint` (placeholder OneDrive) sehingga pemindai berkas Playwright melewatinya **tanpa pesan apa pun** — `npm run test:ui` hanya menjalankan 12 dari 24 tes dan tetap melaporkan "lulus". Terdeteksi setelah saya membandingkan `playwright test --list` dengan jumlah berkas di folder. Berkas dimaterialisasikan (salin, hapus asli, ganti nama) dan 24 tes kembali terkumpul. Kalau jumlah tes tiba-tiba menyusut, periksa dulu atribut berkas dengan `Get-ChildItem | Select-Object Name, Attributes`; tanda `ReparsePoint` berarti berkas itu belum diunduh dari OneDrive. |
| 2026-10-28 | Fase 2.1 | Uji sungguhan editor diary lewat browser: tulis satu kalimat → tunggu auto-save → status "Tersimpan" → reload → teks kembali utuh dari database; penghitung karakter muncul di 4.100 karakter; mode fokus menyembunyikan navigasi bawah di 360 px dan menampilkan tautan "Selesai". Bukti: `npm test` 101 tes lulus, `npm run test:ui` 24 tes lulus, `tsc`, `lint`, dan `build` lulus. Commit `426fabb`. |
| 2026-10-28 | Fase 1.5 | Cek visual saya sendiri (8 tangkapan layar alur sungguhan di HP 360 px, tablet 768 px, dan laptop 1280 px, terang dan gelap) menemukan satu bug copy: layar onboarding menulis "layanan seperti Healing119 di PRD kami", yaitu jargon internal yang bocor ke teks user. Diganti menjadi kalimat yang bisa dibaca user tanpa konteks dokumen. Sekaligus kalimat persetujuan usia dikembalikan persis ke frasa `PRD.md` AUTH-4 ("Saya berusia 18 tahun ke atas") dan label checkbox dibuat minimal 44 px sebagai area sentuh. |
| 2026-10-28 | Fase 1.6d | Kecurigaan bahwa navigasi bawah menutupi tombol "Keluar" diukur, bukan dikira-kira: setelah menggulir ke paling bawah pada 360 × 640, tombol berakhir di y = 528 dan navigasi mulai di y = 581, jadi tidak ada yang tertutup. Tangkapan layar sebelumnya hanya menampilkan posisi gulir di atas. |
| 2026-10-28 | Fase 1.6d | Navigasi responsif ditulis di `src/components/app-nav.tsx` sebagai tiga varian: bar bawah di HP (dengan padding safe-area), rail 72 px di tablet, dan sidebar 240 px di laptop. Item aktif ditandai warna `primary` **dan** `aria-current="page"`, karena `DESIGN.md` §13 melarang warna sebagai satu-satunya penanda. Hanya item "Akun" yang tampil karena hanya `/settings` yang ada; daftar ini bertambah saat halamannya lahir. |
| 2026-10-28 | Fase 1.4 | Ditambahkan `e2e/auth.spec.ts` (11 tes): halaman login di 360/768/1280 px mode terang dan gelap tanpa scroll horizontal dan tanpa pelanggaran axe serius, target sentuh minimal 44 px di 360 px, dua cara masuk dari AUTH-1 tampil, pesan jelas saat email kosong, dan AUTH-2 terbukti (`/settings` dan `/onboarding` mengarahkan ke `/login?next=…` saat belum masuk). |
| 2026-10-28 | Fase 1.6d | `npm run test:ui` sekarang 23 tes dan semuanya lulus (52,6 detik lalu 30,1 detik setelah migrasi proxy). `tsc`, `lint`, dan `build` juga lulus. Commit `96d5328`, `d22776f`, dan `1f5b4c4`. |
| 2026-10-28 | Fase 1.6d | **Batas verifikasi yang jujur:** navigasi berada di dalam grup `(app)`, dan halaman di grup itu mensyaratkan sesi yang valid, yang butuh tabel `profiles`. Karena itu navigasi baru terverifikasi lewat `tsc`, `lint`, dan `build` — belum lewat `npm run test:ui` dan belum lewat cek visual user. Keduanya menyusul begitu migrasi 1.2 diterapkan. |

| 2026-10-28 | Perapian | Atas permintaan user: README diganti panduan project; `.env` diganti nama menjadi `.env.hosted` (tidak dibaca Next.js) dan nilai OpenRouter serta ID model disalin ke `.env.local`, sehingga dev hanya memakai Supabase lokal; `.env.example` diberi catatan `SUPABASE_DB_URL`; `zod` didaftarkan langsung di `package.json` (sebelumnya hanya ikut terpasang lewat `shadcn`); `e2e/smoke.spec.ts` dihapus karena menguji halaman login yang sama dengan `auth.spec.ts`; `AGENTS.md` §1 dan §5 diberi aturan baris tugas pendek, struktur folder yang ada, dan aturan file env. Baris tugas di file ini dipendekkan dan tabel Terblokir diperbarui. |
| 2026-10-28 | Perapian | Belum selesai, butuh user: menghapus `.env.bak` (salinan lama yang rusak, nilainya tidak ada yang unik) dan `..\Life Tracker\.env` (subset `.env`). Penghapusan ditolak pengaman otomatis karena tidak bisa dibatalkan. Folder `..\Life Tracker` sendiri adalah jangkar sesi Cline lama dan boleh dihapus setelah sesi itu ditutup. |
| 2026-10-28 | Keamanan | Audit menemukan dan membuktikan di Supabase lokal bahwa user bisa menaikkan `plan` sendiri, mereset `regen_count`, menulis skor sendiri, dan menandai nomor WhatsApp terverifikasi lewat PostgREST. Ditutup oleh `supabase/migrations/20261028230000_restrict_client_writes.sql` (grant per kolom dan perintah); `daily_summaries` sekarang ditulis server lewat service role. 5 tes RLS baru mengunci perilaku ini; total 12 tes RLS lulus. Migrasi ini belum diterapkan ke project hosted (lihat 1.2). |
| 2026-10-28 | Keamanan | Kesalahan saya: saat membandingkan file env, pesan error Node menampilkan potongan `SUPABASE_DB_URL` dari `.env.bak`, termasuk yang tampak seperti password database. **User disarankan mengganti password database Supabase hosted** di dashboard → Project Settings → Database, lalu memperbarui `.env.hosted`. |
| 2026-10-28 | Fase 2.1, 2.5 | Server sekarang menolak menyimpan atau merangkum tanggal selain hari ini menurut timezone profil (DIARY-4, AI-1); editor berhenti mencoba ulang untuk penolakan yang tidak bisa diperbaiki. Status `failed` disimpan saat AI gagal (AI-2) tanpa menimpa ringkasan yang sudah ada. Kegagalan menyimpan ringkasan tidak lagi ditelan. Prompt diberi aturan bahwa isi entri adalah data, bukan perintah, dan `"""` di entri tidak bisa keluar dari pembatas (PRD §7), dengan tes. |
| 2026-10-28 | Fase 1.7 | Timezone di Akun dan onboarding divalidasi dengan `isValidTimeZone` (Intl), bukan sekadar panjang atau regex. Halaman `/today` dan `/history` jatuh ke `Asia/Jakarta` bila nilai tersimpan tidak valid. |
| 2026-10-28 | Fase 2.5 | Layar Hari Ini diselaraskan dengan `DESIGN.md`: tombol "Rangkum hari ini" tidak lagi dinonaktifkan saat kosong (§7.1); hasil tampil di atas dengan tulisan dilipat dan tautan "Ubah tulisan", tanpa tombol primary (§2, §7.4); hasil tanpa kartu dan tanpa ikon centang, judul bagian 14 px 600 "Yang sudah bagus" dan "Ruang untuk tumbuh", alasan skor 16 px, cincin 184 px dari 768 px (§6); "Coba lagi" menjadi tombol sekunder (§7.6); sisa rangkum ulang berkurang setelah dipakai. |
| 2026-10-28 | Komponen | `src/components/ui/button.tsx` (primary, sekunder, tautan; 44 px; ring fokus 2 px `primary`) menggantikan tombol tulis-tangan di login, onboarding, Akun, Hari Ini, dan layar krisis. `src/app/(app)/error.tsx` (memakai `retry()`, sesuai referensi error.js Next 16.4) dan `loading.tsx` memberi state error dan loading untuk semua halaman `(app)`. |
| 2026-10-28 | Fase 2.2 | `/history`: kalender bulan Senin-pertama dari `monthGrid`, titik untuk hari berentri, tepi `control` untuk hari ini, isi `primary` untuk hari terpilih, hari setelah hari ini tidak bisa dibuka, entri lampau hanya baca. Tujuh sel 44 px di 360 px tidak menyisakan jarak 8 px antar target (§5); aturan komponen kalender (§6) diikuti. Bug yang ketemu lewat tes: kalender memperlakukan `yyyy-MM` sebagai tanggal penuh dan halaman jatuh ke layar error; diperbaiki, dan tes sekarang gagal bila yang tampil layar error. |
| 2026-10-28 | Tes UI | `e2e/app-pages.spec.ts` menguji `/today` (menulis, hasil, krisis), `/settings`, `/history`, dan `/onboarding` di 360, 768, 1280 px, terang dan gelap, plus target sentuh dan perilaku §7 dan DIARY-4. User uji dibuat lewat Admin API; cookie sesi dibuat oleh `@supabase/ssr` sendiri (`e2e/support/test-users.ts`). Helper pemeriksaan layout dipusatkan di `e2e/support/layout-checks.ts`; checkbox diukur lewat label 44 px-nya (§6). |
| 2026-10-28 | Bukti | `npx tsc --noEmit` lulus, `npm run lint` lulus, `npm test` 120 lulus + 12 dilewati (RLS tanpa env), vitest dengan env lokal 132 dari 132 lulus, `npm run test:ui` 46 dari 46 lulus, `npm run build` lulus dengan rute `/history` baru. Belum di-commit. |
| 2026-10-28 | **Berhenti di sini** | User meminta berhenti. Langkah berikutnya: (1) user cek visual `/today`, `/history`, `/settings`, `/onboarding` di HP, terang dan gelap; (2) user memutuskan rate limit (tabel `rate_limits`) dan pintu masuk `/history`; (3) user menghapus `.env.bak` dan `..\Life Tracker\.env`, dan mengganti password database hosted; (4) setelah itu Fase 2 tinggal 2.6 (persetujuan teks krisis) sebelum laporan akhir fase. |

## Ide ditunda

- Pesan suara WhatsApp dengan transkripsi
- Catat expense dan habit lewat WhatsApp
- Scan struk
- Laporan tahunan oleh AI
