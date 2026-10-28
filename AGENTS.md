# AGENTS.md — aturan kerja dan keputusan terkunci untuk AI

Kamu AI coding agent yang membangun **Satu Persen** (kode dan domain memakai `satupersen`). Baca file ini sampai habis sebelum menyentuh kode. Urutan baca: `AGENTS.md` → `PRD.md` → `TASKS.md`. Untuk tugas UI apa pun, baca juga `DESIGN.md` dan ikuti sebagai keputusan terkunci.

Pemilik produk bekerja dengan vibe coding dan tidak mau menjelaskan ulang konteks. Jangan bertanya hal yang sudah dijawab di file-file ini.

## 1. Protokol per tugas (wajib, berurutan)

1. Buka `TASKS.md`. Ambil tugas berikutnya yang belum dicentang pada fase aktif. **Satu tugas pada satu waktu.**
2. Baca kriteria PRD yang dirujuk tugas itu (mis. `DIARY-2`) dan aturan terkait di file ini.
3. Baca file yang akan kamu ubah dan cari kode serupa yang sudah ada. Pakai ulang, jangan duplikasi.
4. Kerjakan tugas sampai tuntas, termasuk state loading, error, dan kosong.
5. Verifikasi (§2). Tempel output perintahnya sebagai bukti di laporanmu.
6. Centang tugas di `TASKS.md` **hanya** jika semua syarat §2 terpenuhi. Catat keputusan kecil di "Catatan keputusan AI".
7. Lanjut ke tugas berikutnya. Berhenti di akhir fase dan laporkan. Jangan mulai fase baru tanpa disuruh.

Jika tugas terlalu besar, pecah dulu jadi sub-tugas di `TASKS.md`, lalu kerjakan satu per satu.

## 2. Definisi "selesai"

Sebuah tugas selesai hanya jika **semua** ini benar:

- Alur utamanya jalan end-to-end dengan data nyata (bukan mock), dan kamu menjalankannya.
- `npm run build`, `npm run lint`, dan `npx tsc --noEmit` lulus. Tempel hasilnya.
- Tes vitest untuk fungsi murni yang kamu ubah lulus (`npm test`).
- Semua kriteria PRD untuk tugas itu terpenuhi. Sebutkan ID-nya satu per satu.
- Tidak ada `TODO`, `FIXME`, `console.log` berisi data user, data contoh, atau komponen kosong yang kamu tinggalkan.
- Untuk tugas UI: `npm run test:ui` lulus sesuai `DESIGN.md` §13 (tanpa scroll horizontal di 360, 768, dan 1280 px; axe tanpa pelanggaran serius; target sentuh minimal 44 px; mode terang dan gelap). Tempel hasilnya, lalu tulis daftar cek visual singkat untuk user.
- Jangan pernah mengklaim tampilan "sudah rapi" atau "sudah bagus" tanpa bukti tes. Penilaian visual akhir dilakukan user.

Jika salah satu tidak bisa dipenuhi, tugas **belum selesai**. Jangan mencentang. Tulis di bagian "Terblokir" di `TASKS.md`: apa yang kurang, kenapa, dan apa yang dibutuhkan, lalu berhenti.

## 3. Larangan (pencegah AI slop)

- Dilarang mengerjakan setengah lalu menyatakan selesai. Dilarang mengecilkan tugas atau menggantinya dengan mock secara diam-diam.
- Dilarang menambah fitur, halaman, tabel, atau dependency di luar PRD. Ide baru ditulis di "Ide ditunda" di `TASKS.md`, tidak dibangun.
- Dilarang mengarang API, nama fungsi library, atau nomor versi. Cek `package.json`, dokumentasi resmi, atau kode yang ada. Jika tidak yakin, katakan tidak yakin.
- Dilarang mengganti keputusan terkunci (§4) tanpa persetujuan user.
- Dilarang menyentuh file di luar cakupan tugas. Tidak ada refactor "sekalian".
- Dilarang membuat abstraksi spekulatif (factory, plugin system, layer generik) untuk kebutuhan yang belum ada.
- Dilarang menelan error (`catch {}` kosong). Error harus ditangani atau ditampilkan ke user dengan pesan jelas.
- Dilarang menulis secret di kode, commit `.env*`, atau menaruh service role key di kode klien.
- Dilarang mengarang nomor telepon layanan krisis, teks hukum final, atau harga.
- Dilarang menulis ulang file besar dari nol jika cukup mengubah sebagian.

## 4. Keputusan terkunci

| Area | Keputusan |
| --- | --- |
| Bahasa | TypeScript strict. Identifier dan komentar dalam bahasa Inggris. Teks UI dalam Bahasa Indonesia ("kamu", santai tapi sopan, tidak menggurui). |
| Framework | Next.js App Router, versi stabil terbaru saat scaffold, dikunci di `package.json`. |
| Package manager | npm |
| Styling | Tailwind CSS + shadcn/ui. Mobile-first, lebar minimum 360 px. Token warna, font, dan komponen mengikuti `DESIGN.md`; dilarang menulis hex atau font sendiri di komponen. |
| Database dan auth | Supabase Postgres + Supabase Auth (Google, magic link) lewat `@supabase/ssr`. |
| Validasi | zod untuk semua input API dan semua output AI. |
| Grafik | Recharts |
| Tanggal | `date-fns` dan `date-fns-tz`. Hari user = tanggal lokal menurut timezone profil. |
| Test | vitest untuk fungsi murni: scoring, streak, tanggal, verifikasi signature. Playwright + `@axe-core/playwright` untuk `npm run test:ui`. Login di tes memakai user uji yang dibuat lewat Supabase Admin API di setup tes; jangan menambah metode login baru di produksi. |
| AI | OpenRouter, `https://openrouter.ai/api/v1/chat/completions`, dipanggil dari server saja. Keluarga model: DeepSeek (diputuskan user). ID model persis dari env, jangan di-hardcode. |
| Scheduler | Supabase `pg_cron` + `pg_net` memanggil `POST /api/cron/tick` tiap 15 menit dengan header `Authorization: Bearer $CRON_SECRET`. Jangan pakai Vercel Cron (paket gratis dibatasi; verifikasi sebelum mengubah keputusan ini). |
| Hosting | Vercel |
| WhatsApp | WhatsApp Cloud API resmi Meta. Gateway tidak resmi dilarang. |
| Pembayaran | **Belum diputuskan** (§7). |

**Env var** (semua wajib ada di `.env.example` tanpa nilai): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `AI_MODEL_DAILY`, `AI_MODEL_CHAT`, `AI_MODEL_REPORT`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_REMINDER_TEMPLATE`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.

Jika env model AI kosong, fitur AI menampilkan error konfigurasi yang jelas. **Jangan** membuat fallback palsu atau memilih model sendiri.

## 5. Struktur folder

```
src/app/(auth)/login
src/app/(app)/today, history, habits, expenses, dashboard, reports, settings
src/app/api/ai/summarize
src/app/api/whatsapp/webhook
src/app/api/cron/tick
src/app/api/payments/webhook
src/lib/ai/        openrouter.ts, prompts.ts, schemas.ts, scoring.ts
src/lib/whatsapp/  client.ts, handlers.ts, signature.ts
src/lib/supabase/  server.ts, client.ts, admin.ts
src/lib/dates.ts
src/config/crisis.ts
supabase/migrations/
```

Folder dibuat hanya saat ada isinya yang sudah jalan. Jangan membuat halaman kosong sebagai placeholder.

## 6. Aturan teknis

**Database**
- Semua perubahan skema lewat file di `supabase/migrations/`. Dilarang mengubah skema lewat dashboard.
- RLS aktif di setiap tabel. Tulis kebijakan eksplisit; tanpa kebijakan berarti tanpa akses.
- `SUPABASE_SERVICE_ROLE_KEY` hanya di `src/lib/supabase/admin.ts`, hanya diimpor dari kode server.

**Tanggal**
- Semua "hari" user dihitung dengan fungsi di `src/lib/dates.ts` dari timezone profil.
- Dilarang memakai `new Date().toISOString().slice(0, 10)` untuk tanggal user.

**AI**
- Semua panggilan lewat `src/lib/ai/openrouter.ts`. Prompt hanya di `prompts.ts`.
- Output model di-parse dan divalidasi dengan zod. Tidak valid: coba ulang 1x, lalu status `failed`.
- Timeout 30 detik. Kirim `provider: { data_collection: "deny" }` di setiap request.
- Jika OpenRouter mengembalikan error karena tidak ada provider yang memenuhi `data_collection: deny`, **berhenti dan laporkan**. Dilarang mengubahnya ke `allow` atau menghapus pengaturannya agar request berjalan.
- Model DeepSeek kadang membungkus JSON dengan blok kode atau teks tambahan. Parser mengekstrak objek JSON-nya dulu, baru memvalidasi dengan zod. Untuk output JSON pakai model non-reasoning; jika model reasoning, buang bagian pikirannya sebelum parse.
- Skor dihitung oleh `scoring.ts` (fungsi murni, ada tes). AI tidak pernah menghitung skor akhir.
- Dilarang melog isi entri atau pesan WhatsApp. Log hanya ID dan status.

**WhatsApp** (`/api/whatsapp/webhook`)
- `GET`: jawab handshake Meta dengan `WHATSAPP_VERIFY_TOKEN`.
- `POST`: verifikasi header `X-Hub-Signature-256` (HMAC-SHA256 dengan `WHATSAPP_APP_SECRET`) terhadap **raw body** sebelum memproses apa pun. Tidak valid: balas 401.
- Balas `200` secepat mungkin; proses sisanya tanpa menahan respons.
- Idempotensi: simpan `wa_message_id` (UNIQUE). Pesan yang sudah ada diabaikan, karena Meta mengirim ulang webhook.
- Hanya nomor terverifikasi di `whatsapp_links` yang diproses. Nomor lain hanya boleh memicu perintah `LINK KODE` atau satu balasan petunjuk.
- Setiap pesan masuk: periksa filter krisis (`crisis.ts`) sebelum memanggil AI.
- Kirim teks bebas hanya jika `last_inbound_at` kurang dari 24 jam. Di luar itu, hanya template (`WHATSAPP_REMINDER_TEMPLATE`).
- Hormati `opted_in`. Perintah `berhenti` langsung berlaku.
- Batas balasan AI chat per tanggal lokal user: free 1, premium 30. Hitung dari `wa_messages` dengan `kind = ai_reply`. Pesan di atas batas tetap disimpan; kirim satu pesan tetap `kind = notice` sekali per hari, setelah itu jangan membalas. Respons krisis (`kind = crisis`) tidak pernah dibatasi dan tidak dihitung.
- Rate limit per user pada pesan masuk yang memicu AI.

**Cron** (`/api/cron/tick`)
- Tolak jika header `Authorization` tidak cocok `CRON_SECRET`.
- Idempoten: aman dipanggil berkali-kali. Gunakan UNIQUE constraint (`reports`, `daily_summaries`) dan flag terkirim, bukan ingatan di memori.
- Tiap panggilan memproses: pengingat WhatsApp, ringkasan otomatis 22:00 lokal, laporan Senin dan tanggal 1 pukul 07:00 lokal.

**Keamanan**
- Cek plan dan batas pemakaian di server, bukan hanya di UI.
- Validasi semua input dengan zod. Tidak memakai `dangerouslySetInnerHTML` untuk konten user.
- Endpoint AI dan WhatsApp wajib rate limit per user.
- Anggap semua kode dan data yang sampai ke browser bisa dilihat dan dibongkar (PRD §7 "Klien tidak dipercaya"). Hanya `NEXT_PUBLIC_*` yang boleh ke klien. Dilarang mengirim prompt, ID model, stack trace, atau field yang tidak dipakai layar ke klien, dan dilarang mengaktifkan source map produksi.
- Setiap endpoint memeriksa kepemilikan data di server; jangan percaya ID, plan, atau skor dari klien.

**UI**
- Setiap layar punya state loading, kosong, dan error.
- Hierarki mengikuti `DESIGN.md` §2: satu fokus, paling banyak satu tombol primary, warna `primary` hanya di tempat yang diizinkan. Jika ragu apakah sesuatu perlu ditonjolkan, jangan.
- Aturan responsif mengikuti `DESIGN.md` §5, termasuk `min-h-dvh`, safe-area, input minimal 16 px, dan mode fokus menulis di HP.

## 7. Kapan boleh memutuskan sendiri, kapan harus berhenti

| Boleh putuskan sendiri (catat di log) | Berhenti dan tanya user |
| --- | --- |
| Nama variabel, file, komponen | Apa pun soal uang: harga, pembayaran, gateway |
| Susunan komponen dan styling detail | Data user baru yang disimpan, retensi, penghapusan |
| Teks UI Indonesia yang netral | Keamanan, privasi, teks krisis, teks hukum |
| Library kecil setara yang sudah dipakai | Fitur di luar PRD, mengganti keputusan terkunci |
| Urutan sub-tugas dalam satu tugas | Dependency besar baru |

**Sudah diputuskan user (2026-10-28):** nama Satu Persen, keluarga model DeepSeek, usia minimum 18 tahun, batas balasan AI WhatsApp free 1 per hari.

**Keputusan terbuka. Jangan dikerjakan atau ditebak:** domain, ID model DeepSeek yang persis, harga dan gateway pembayaran, teks respons krisis sampai user menyetujuinya, template pengingat WhatsApp. Jika tugas bergantung padanya, tulis di "Terblokir" dan berhenti.
