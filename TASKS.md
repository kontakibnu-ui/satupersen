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
- [ ] 0.4 Pilih varian DeepSeek di [openrouter.ai/models](https://openrouter.ai/models): untuk output JSON pilih yang non-reasoning, dan pastikan ada provider yang lolos `data_collection: deny`. Uji 10 contoh entri (Indonesia, Inggris, campur, pendek, curhat berat), lalu isi `AI_MODEL_DAILY`, `AI_MODEL_CHAT`, `AI_MODEL_REPORT` (Sebagian 2026-10-28: model dipilih `deepseek/deepseek-v4.1-flash` dan sudah diisi ke `.env`; 5 dari 10 contoh entri sudah diuji hidup dengan hasil baik. Syarat `data_collection: deny` **sudah terbukti terpenuhi** tanpa perlu membuka dashboard: tujuh panggilan hidup dikirim dengan `provider.data_collection: "deny"` dan semuanya dilayani tanpa error, jadi ada provider yang lolos. Sisa: uji 5 contoh entri lagi.)
- [ ] 0.5 Mulai verifikasi Meta Business, buat app WhatsApp Cloud API, siapkan nomor uji (jangan tunggu fase lain)
- [ ] 0.6 Pilih gateway pembayaran (Midtrans atau Xendit) dan mulai aktivasi merchant
- [ ] 0.7 Setujui atau ubah draf teks respons krisis di `PRD.md` §7, lalu verifikasi sendiri nomor Healing119 di healing119.id
- [ ] 0.8 Buat akun Vercel dan siapkan domain
- [ ] 0.9 Baca `DESIGN.md` dan setujui arahnya (palet, font, wireframe), atau minta perubahan sebelum Fase 1.6

**Syarat mulai Fase 1:** minimal 0.2 selesai. Item lain boleh menyusul, tetapi tugas yang bergantung padanya akan terblokir.

---

## Fase 1 — Fondasi dan deploy awal

- [x] 1.1 `git init` jika belum ada repo. Scaffold Next.js (TypeScript strict, Tailwind, shadcn/ui, vitest, Playwright, `@axe-core/playwright`). Script `npm test` dan `npm run test:ui` jalan. `.gitignore` mencakup `.env*`. `.env.example` berisi semua nama env dari `AGENTS.md` §4. (Selesai 2026-10-28, bukti di laporan: build, lint, tsc, vitest, test:ui 7/7 lulus; commit 7f1073a.)
- [ ] 1.2 Migrasi SQL 12 tabel sesuai PRD §9, RLS di semua tabel, dan trigger yang membuat `profiles` saat user baru (AUTH-3). Buktikan isolasi: tulis hasil query yang menunjukkan user A tidak bisa membaca data user B.
- [x] 1.3 `src/lib/dates.ts` dan tes vitest (timezone Asia/Jakarta, pergantian hari, WITA dan WIT) (Selesai 2026-10-28: 32 tes lulus, commit a46d5c4.)
- [ ] 1.4 Login Google dan magic link, middleware proteksi grup `(app)` (AUTH-1, AUTH-2). (Kode selesai 2026-10-28: `/login` dengan tombol Google dan tautan email, rute `/auth/callback` penukar kode, dan `src/middleware.ts` yang menyegarkan sesi sekaligus menjaga halaman di luar daftar publik. Belum dicentang karena login sungguhan belum diuji ke database.)
- [ ] 1.5 Onboarding: disclaimer, persetujuan privasi, pernyataan usia 18 tahun ke atas, dan deteksi timezone browser (AUTH-3, AUTH-4). (Kode selesai 2026-10-28: halaman `/onboarding` dengan disclaimer dan dua checkbox wajib, timezone dideteksi di browser dan divalidasi di server sebelum disimpan ke `profiles`. Belum dicentang karena alurnya belum diuji ke database.)
- [x] 1.6a Token warna light dan dark di `globals.css` sesuai `DESIGN.md` §3 (semua token, termasuk `control` dan `primary-foreground`), radius, dan pemetaan token ke nama token shadcn agar komponen bawaan shadcn ikut patuh. (Selesai 2026-10-28, commit 5cdd519. Bukti: `e2e/design-tokens.spec.ts` mencocokkan nilai rgb setiap token di mode terang dan gelap.)
- [x] 1.6b Font Plus Jakarta Sans dan Newsreader lewat `next/font/google`, skala dan berat tipografi `DESIGN.md` §4, dan `lang="id"` pada `<html>`. (Selesai 2026-10-28, commit 5cdd519. Font Geist bawaan preset shadcn sudah dihapus.)
- [ ] 1.6c Shell responsif: `min-h-dvh`, `viewport-fit=cover`, padding safe-area, lebar konten maksimum 680 px (960 px untuk Progres), padding samping 16 px di HP. Verifikasi `npm run test:ui` di 360, 768, dan 1280 px mode terang dan gelap. (Sebagian selesai 2026-10-28: `min-h-dvh`, `viewport-fit=cover`, verifikasi `npm run test:ui`, plus kontainer `max-w-[680px]` dan padding safe-area di `src/app/(app)/layout.tsx`. Sisa: kontainer 960 px untuk Progres (baru perlu di 3.5) dan navigasi di 1.6d.)
- [ ] 1.6d Navigasi bawah di HP, rail di tablet, sidebar di laptop. (Kode selesai 2026-10-28: `src/components/app-nav.tsx` dengan tiga varian sesuai `DESIGN.md` §5 — bar bawah di HP, rail 72 px di tablet, sidebar 240 px di laptop; item aktif memakai `primary` **dan** `aria-current`, target sentuh minimal 44 px, dan padding safe-area di bar bawah. Baru berisi satu item, "Akun", karena hanya itu halaman yang ada; sisanya menyusul saat halamannya lahir. **Menunggu cek visual user** sesuai aturan di kepala file ini.)
- [ ] 1.7 Halaman Akun dasar (`/settings`): nama, timezone, tema (Sistem, Terang, Gelap), keluar. (Kode selesai 2026-10-28: nama dan timezone disimpan lewat Server Action yang divalidasi zod, tema disimpan di localStorage tanpa kolom baru di database, dan tombol keluar memakai client yang bisa menulis cookie. Belum dicentang karena belum diuji ke database.)
- [ ] 1.8 Deploy ke Vercel dengan env production. Login berhasil di URL production.

**Selesai bila:** user baru bisa login di URL production, melewati onboarding, dan melihat layout; build dan tes lulus; isolasi RLS terbukti.

---

## Fase 2 — Diary, ringkasan AI, skor

- [ ] 2.1 Editor `/today` dengan auto-save, auto-grow, dan mode fokus menulis di HP (DIARY-1, DIARY-2, DIARY-3, `DESIGN.md` §5 sampai §7)
- [ ] 2.2 `/history` kalender, entri lampau hanya baca (DIARY-4)
- [x] 2.3 Klien OpenRouter, schema zod, prompts (AI-2). Mock hanya boleh di file tes. (Selesai 2026-10-28: `src/lib/ai/openrouter.ts`, `schemas.ts`, `prompts.ts`. Diuji hidup dengan model sungguhan untuk 5 contoh entri, termasuk jalur krisis. Ditambah 9 tes klien ber-mock yang mengunci bentuk request, retry sekali, jalur krisis, error provider, dan env kosong. Commit 3951886.)
- [x] 2.4 `scoring.ts` dan tes: pembobotan, dimensi tanpa data dikeluarkan lalu bobot dibagi ulang, `delta_pct` null jika data kurang (SCORE-1, SCORE-2) (Selesai 2026-10-28 lebih dulu dari 2.1-2.3 karena ketiganya terblokir kredensial. 17 tes baru, total 49 tes lulus, commit cbc3222.)
- [ ] 2.5 `POST /api/ai/summarize` dan UI hasil dengan tombol "Rangkum hari ini": ringkasan, cincin skor, delta, alasan, kuota rangkum ulang, dan ketujuh state di `DESIGN.md` §7 (AI-1, AI-3, AI-4, SCORE-3)
- [ ] 2.6 Penanganan krisis: `crisis.ts` (filter kata kunci, teks tetap), tampilan khusus tanpa skor (AI-5, PRD §7). (Sebagian selesai 2026-10-28: `src/config/crisis.ts` berisi filter 31 frasa Indonesia dan Inggris, teks tetap versi ID dan EN, plus 24 tes. **Teks masih draf `PRD.md` §7 dan menunggu persetujuan user (0.7)**; nomor Healing119 wajib diverifikasi manusia sebelum launch. Tampilan khusus tanpa skor belum dibuat karena butuh halaman hasil ringkasan dari 2.5.)

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
| 1.2 | Kredensial Supabase sudah ada dan terverifikasi, tetapi connection string "Direct connection" hanya punya alamat IPv6 (`db.<ref>.supabase.co`), sedangkan mesin ini hanya IPv4; `supabase db push` gagal dengan `getaddrinfo ENOTFOUND` | Ambil URI **Session pooler** (IPv4) di dashboard → Connect, lalu isi sebagai `SUPABASE_DB_URL`. Alternatif: jalankan Docker Desktop agar saya pakai Supabase lokal, atau jalankan isi file migrasi sekali di SQL Editor dashboard |
| 1.4 | Kodenya sudah selesai, tetapi login sungguhan belum bisa diuji karena tabel dari 1.2 belum terpasang. Selain itu butuh OAuth client Google di Supabase Auth dan pengiriman email untuk magic link (layanan email bawaan Supabase sangat dibatasi) | Setelah 1.2: buat OAuth client Google dan daftarkan di Supabase → Authentication → Providers; tentukan SMTP |
| 1.5, 1.7 | Bergantung pada 1.2 dan 1.4 | Menyusul otomatis setelah keduanya selesai |
| 1.8 | Akun Vercel dan domain belum disiapkan (Fase 0.8) | Selesaikan 0.8, lalu beri URL production ke AI |
| 1.6c (sisa) dan 1.6d | Belum ada halaman di grup `(app)` yang bisa dibungkus kontainer dan ditautkan navigasinya; membuat halaman kosong dilarang `AGENTS.md` §5 | Tidak ada dari manusia. Selesai otomatis begitu 1.7 mengerjakan `/settings`, yang menunggu kredensial Supabase pada baris di atas |
| 2.1, 2.2 | Butuh tabel `entries` dan user yang bisa login (1.2 dan 1.4), yang keduanya menunggu kredensial Supabase | Isi tiga variabel Supabase di `.env.local` |
| 2.3, 2.5 | Butuh `OPENROUTER_API_KEY` dan ID model DeepSeek (Fase 0.3 dan 0.4); tanpa kunci, klien AI tidak bisa dijalankan end-to-end dengan model sungguhan | Buat akun dan API key OpenRouter, lalu pilih varian DeepSeek |
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
| 2026-10-28 | Fase 1.4 | `middleware.ts` di Next 16 sudah memunculkan saran migrasi ke `proxy.ts` (build menampilkan "To migrate automatically, run: npx @next/codemod@canary middleware-to-proxy"). Masih berfungsi dan terdaftar sebagai Proxy di keluaran build; migrasi ditunda karena API barunya belum saya verifikasi dari dokumentasi resmi. |
| 2026-10-28 | Fase 1.4 | Dua klien Supabase server: `createSupabaseServerClient` untuk Server Component (tanpa `setAll`, sesuai dokumentasi @supabase/ssr bahwa middleware yang menulis) dan `createSupabaseActionClient` untuk Server Action dan Route Handler yang memang boleh menulis cookie. Tanpa pemisahan ini, login dan keluar akan tampak berhasil tetapi sesinya hilang, dan `AGENTS.md` §3 melarang menutupinya dengan `catch {}` kosong. |
| 2026-10-28 | Fase 1.7 | Tema disimpan di `localStorage` sebagai kelas `light`/`dark` pada `<html>`, tanpa kolom baru di `profiles`, karena `PRD.md` §9 mengunci bentuk tabel. Pilihan "Sistem" menghapus kedua kelas sehingga preferensi perangkat yang berlaku. |
| 2026-10-28 | Fase 1.7 | Membaca nilai dari browser (timezone dan tema) memakai `useSyncExternalStore`, bukan `useEffect` + `setState`: aturan lint `react-hooks/set-state-in-effect` di eslint-config-next 16 menolak pola itu, dan pola ini juga menghindari render ganda saat hidrasi. |
| 2026-10-28 | Fase 1.2 | Ditambahkan `src/lib/supabase/rls.test.ts` (7 tes): dua user sungguhan dibuat lewat Admin API, lalu dibuktikan user B tidak bisa membaca entri user A, tidak bisa menulis atas nama A, anon tidak punya akses tabel, tabel server-only tertutup, dan menghapus akun menghapus entrinya. Tes ini ter-skip tanpa env `LOCAL_SUPABASE_*`, sehingga `npm test` tetap tidak menyentuh jaringan. |
| 2026-10-28 | Lingkungan | Upaya menemukan region pooler sendiri: header API Supabase memuat `CF-Ray: ...-SIN` (edge Singapura), tetapi tiga kandidat host pooler (`aws-0/aws-1-ap-southeast-1`, `aws-0-ap-southeast-2`) menjawab "tenant/user not found". Menebak region dihentikan di tiga percobaan. Stack Supabase lokal sudah dinyalakan lewat Docker, tetapi penarikan image-nya macet berulang kali sehingga belum bisa dipakai sebagai jalur verifikasi. |
| 2026-10-28 | Fase 1.4 | Commit `5ebc257`: alur auth, onboarding, dan Akun. 92 tes lulus (7 tes RLS ter-skip), `tsc`, `lint`, dan `build` lulus dengan rute `/login`, `/onboarding`, `/settings`, `/auth/callback` sebagai rute dinamis. |
| 2026-10-28 | Fase 1.6d | Navigasi responsif ditulis di `src/components/app-nav.tsx` sebagai tiga varian: bar bawah di HP (dengan padding safe-area), rail 72 px di tablet, dan sidebar 240 px di laptop. Item aktif ditandai warna `primary` **dan** `aria-current="page"`, karena `DESIGN.md` §13 melarang warna sebagai satu-satunya penanda. Hanya item "Akun" yang tampil karena hanya `/settings` yang ada; daftar ini bertambah saat halamannya lahir. |
| 2026-10-28 | Fase 1.4 | Ditambahkan `e2e/auth.spec.ts` (11 tes): halaman login di 360/768/1280 px mode terang dan gelap tanpa scroll horizontal dan tanpa pelanggaran axe serius, target sentuh minimal 44 px di 360 px, dua cara masuk dari AUTH-1 tampil, pesan jelas saat email kosong, dan AUTH-2 terbukti (`/settings` dan `/onboarding` mengarahkan ke `/login?next=…` saat belum masuk). |
| 2026-10-28 | Fase 1.6d | `npm run test:ui` sekarang 23 tes dan semuanya lulus (52,6 detik). `tsc`, `lint`, dan `build` juga lulus. Commit `96d5328` dan `d22776f`. Catatan: peringatan deprecation `middleware` → `proxy` juga muncul saat `next dev`, bukan hanya saat build. |

## Ide ditunda

- Pesan suara WhatsApp dengan transkripsi
- Catat expense dan habit lewat WhatsApp
- Scan struk
- Laporan tahunan oleh AI
