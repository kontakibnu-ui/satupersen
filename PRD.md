# PRD Satu Persen

> Versi 1.4 · 2026-10-28 · Nama produk: Satu Persen (kode dan domain memakai `satupersen`).
> File ini = **apa yang dibangun dan kenapa**. Keputusan teknis dan aturan kerja AI ada di `AGENTS.md`. Progres ada di `TASKS.md`.
> Jika permintaan di chat bertentangan dengan PRD ini, ikuti PRD dan beri tahu user. Setiap kriteria punya ID (mis. `DIARY-2`) yang dirujuk `TASKS.md`.

## 1. Ringkasan

Satu Persen adalah web app life tracker untuk anak muda Indonesia. User menulis diary singkat tiap hari, lewat web atau lewat chat WhatsApp. AI meringkas hari itu (kelebihan, hal yang bisa diperbaiki, saran besok) dan memberi skor 0 sampai 100 beserta alasannya, lalu menunjukkan seberapa lebih baik user dibanding rata-rata 7 hari terakhir.

- **Masalah:** anak muda ingin berubah tapi tidak tahu apakah benar-benar maju. Diary biasa hanya menyimpan, tidak memberi umpan balik.
- **Pembeda:** (1) skor selalu disertai alasan, (2) insight lintas modul (diary, habit, mood, expense), (3) pendekatan Atomic Habits (identitas, bukan sekadar streak), (4) curhat lewat WhatsApp, (5) paham Bahasa Indonesia, bahasa Inggris, dan campuran.
- **Bisnis:** freemium. Fitur dasar gratis, premium untuk kedalaman AI dan riwayat.

## 2. Target user

Usia 18 sampai 25 (produk hanya untuk 18 tahun ke atas): mahasiswa, pelajar, pekerja yang ingin berubah, pencari kerja. Akses terutama lewat HP. Menulis dengan bahasa campur Indonesia dan Inggris. Sensitif harga. Berhenti kalau input terasa ribet, jadi input harian harus selesai dalam 1 sampai 2 menit.

## 3. Scope

**Masuk MVP**

| Modul | ID |
| --- | --- |
| Login dan onboarding | AUTH |
| Diary harian | DIARY |
| Ringkasan AI harian | AI |
| Skor dan persen lebih baik | SCORE |
| Habit tracker | HABIT |
| Mood dan energi | MOOD |
| Expense | EXP |
| Dashboard progres | DASH |
| Laporan mingguan dan bulanan | REPORT |
| Tanya diary-mu (tanya jawab AI atas riwayat diary sendiri) | ASK |
| Curhat lewat WhatsApp | WA |
| Langganan dan pembayaran | SUB |
| Landing page, privasi, export dan hapus akun, PWA (bisa dipasang di layar utama HP, tanpa mode offline) | LAUNCH |

**Ditunda (jangan dibangun, catat di `TASKS.md` bagian "Ide ditunda")**

Pesan suara WhatsApp, catat expense atau habit lewat WhatsApp, scan struk, aplikasi native, goals/OKR, tidur dan olahraga, fitur sosial, wearable, laporan tahunan oleh AI.

**Batasan keras**

- Hanya fitur di tabel "Masuk MVP". Fitur lain ditolak, bukan "sekalian dibuatkan".
- Tidak ada fitur setengah jadi. Fitur yang belum lengkap tidak di-merge atau disembunyikan di balik env flag yang default mati.
- Tidak ada data palsu, mock, atau placeholder di jalur produksi.

## 4. Fitur dan kriteria penerimaan

Setiap baris adalah kriteria yang bisa diuji. Fitur dianggap selesai hanya jika semua kriteria modulnya terpenuhi (aturan lengkap di `AGENTS.md` §2).

**AUTH**
- AUTH-1: Login dengan Google dan magic link email.
- AUTH-2: Semua halaman di grup `(app)` mengarahkan ke `/login` jika belum login.
- AUTH-3: Login pertama membuat baris `profiles` otomatis dengan plan `free`. Onboarding mendeteksi timezone browser (mis. `Asia/Makassar` untuk WITA) dan menyimpannya; `Asia/Jakarta` hanya dipakai bila deteksi gagal. Timezone bisa diubah di Akun.
- AUTH-4: Onboarding satu layar: disclaimer "bukan pengganti terapi atau tenaga profesional" dan dua checkbox wajib sebelum masuk aplikasi: persetujuan kebijakan privasi, dan pernyataan "Saya berusia 18 tahun ke atas". Tanpa keduanya user tidak bisa lanjut.

**DIARY**
- DIARY-1: `/today` menampilkan editor untuk tanggal hari ini menurut timezone user.
- DIARY-2: Draft tersimpan otomatis (debounce 2 detik). Satu baris `entries` per (user_id, date); menyimpan ulang = update, bukan baris baru.
- DIARY-3: Maksimal 5.000 karakter, ditolak di klien dan server dengan pesan jelas.
- DIARY-4: `/history` menampilkan kalender yang menandai tanggal yang punya entri. Entri tanggal lampau hanya bisa dibaca; hanya hari ini yang bisa diedit.

**AI** (ringkasan harian)
- AI-1: Tombol "Rangkum hari ini" menyimpan entri lalu memanggil `POST /api/ai/summarize`. Auto-save tidak pernah memanggil AI. Jika tulisan kosong, tampilkan petunjuk dan jangan memanggil AI. State layar mengikuti `DESIGN.md` §7.
- AI-2: Output divalidasi terhadap schema §5. Tidak valid: coba ulang 1x. Masih gagal: status `failed`, tombol "Coba lagi", entri tetap tersimpan.
- AI-3: Saat diproses tampil loading yang jelas. Tidak ada hasil palsu.
- AI-4: Ringkasan pertama tiap hari selalu boleh. Setelah itu, rangkum ulang per hari: free 1x, premium 3x. Kuota dipakai bersama oleh web, perintah `selesai` di WhatsApp, dan ringkasan otomatis. Dicek di server.
- AI-5: Jika `risk_flag` true, ikuti §7.

**SCORE**
- SCORE-1: Skor dihitung di kode (`scoring.ts`), bukan oleh AI. AI hanya memberi `ai_dimension_score` 0 sampai 10.
- SCORE-2: `delta_pct` bernilai null jika kurang dari 3 entri berskor dalam 7 hari sebelumnya, atau jika rata-ratanya di bawah 1 (mencegah pembagian dengan nol). UI menampilkan "Persen muncul setelah 3 hari menulis".
- SCORE-3: Skor tidak pernah tampil tanpa alasannya.

**HABIT**
- HABIT-1: Buat, ubah, dan arsipkan habit (nama, identitas terkait opsional seperti "aku orang yang rutin olahraga"). Arsip, bukan hapus.
- HABIT-2: Centang atau batalkan habit hari ini. Streak mengikuti aturan "jangan bolos dua kali" (§5), dihitung di kode dan dites.
- HABIT-3: Free maksimal 3 habit aktif, dicek di server.

**MOOD**
- MOOD-1: Mood 1 sampai 5 dan energi 1 sampai 5, satu ketukan, bisa diubah selama hari yang sama.

**EXP**
- EXP-1: Tambah pengeluaran dengan dua field wajib (nominal rupiah integer, kategori) dan catatan opsional.
- EXP-2: Daftar per hari, total harian dan bulanan, edit dan hapus.
- EXP-3: Kategori bawaan: makan, transport, kuliah atau kerja, hiburan, tagihan, lainnya.
- EXP-4: Budget bulanan (premium), menjadi input dimensi keuangan skor.

**DASH**
- DASH-1: Menampilkan rata-rata skor periode terpilih, persen vs periode sebelumnya, dan "sejak mulai" (§5). Hierarki tampilan mengikuti `DESIGN.md` §2.
- DASH-2: Grafik skor 7 dan 30 hari (free), 365 hari agregasi bulanan tanpa AI (premium).
- DASH-3: Setiap grafik punya state loading, kosong, dan error.

**REPORT**
- REPORT-1: Laporan mingguan dibuat Senin 07:00 waktu user, bulanan tanggal 1 pukul 07:00.
- REPORT-2: Idempoten: tidak pernah dobel untuk (user_id, type, period_start).
- REPORT-3: Isi: tren skor, 2 sampai 3 pola, satu fokus untuk periode berikutnya. Insight lintas modul (mis. pengeluaran vs mood) hanya jika kedua modul punya data minimal 5 hari.
- REPORT-4: Mingguan versi ringkas untuk free, lengkap dan bulanan untuk premium.

**ASK** (Tanya diary-mu; dikerjakan setelah Fase 6, guardrail lengkap di §7)
- ASK-1: User mengetik satu pertanyaan bebas (maksimal 300 karakter) tentang riwayat diary-nya sendiri. `POST /api/ai/ask` mencari bagian entri yang relevan milik user itu saja, lalu AI menjawab hanya dari bagian tersebut.
- ASK-2: Jawaban selalu menyertakan sumber: daftar tanggal entri yang dipakai, masing-masing bisa dibuka di `/history`. Kode memeriksa setiap tanggal sumber terhadap hasil pencarian; tanggal yang tidak ada di hasil dibuang.
- ASK-3: Jika pencarian tidak menemukan bagian yang relevan, jawabannya tetap "tidak menemukan di diary-mu" dan AI tidak dipanggil.
- ASK-4: Output model divalidasi zod terhadap schema di §7. Tidak valid: coba ulang 1x, lalu tampilkan error dengan tombol "Coba lagi". Tidak ada jawaban palsu.
- ASK-5: Pertanyaan diperiksa filter krisis (`crisis.ts`) sebelum AI dipanggil. Terdeteksi atau `risk_flag` true: pakai teks tetap §7, bukan jawaban AI. Krisis tidak dihitung ke kuota.
- ASK-6: Kuota harian dan cakupan riwayat per plan dicek di server (§8). Angkanya masih usulan.
- ASK-7: Pertanyaan dan jawaban tidak disimpan dan tidak masuk log. Yang tercatat hanya hitungan pemakaian per hari.
- ASK-8: Mengedit atau menghapus entri, atau menghapus akun, ikut memperbarui atau menghapus indeks pencariannya.

**WA, SUB, LAUNCH:** lihat §6, §8, dan `TASKS.md` Fase 6.

## 5. Skor dan aturan AI

Skor harian 0 sampai 100, separuh lebih berasal dari data objektif. Bobot adalah usulan awal.

| Dimensi | Bobot | Sumber |
| --- | --- | --- |
| Kebiasaan | 30% | Persentase habit aktif yang selesai hari itu |
| Produktivitas dan progres | 30% | `ai_dimension_score` (0 sampai 10, rubrik tetap) |
| Mood dan energi | 25% | Rata-rata mood dan energi yang diinput user |
| Keuangan | 15% | Pengeluaran hari itu vs budget harian (budget bulanan dibagi hari) |

Dimensi tanpa data (mis. user belum punya habit atau budget) dikeluarkan dan bobotnya dibagi ulang ke dimensi lain.

**Persen lebih baik**
- Harian = (skor hari ini − rata-rata skor 7 hari sebelumnya) / rata-rata tersebut × 100. Pembanding rata-rata 7 hari, bukan kemarin, agar satu hari yang buruk tidak membuat angka melompat.
- Mingguan = rata-rata minggu ini vs minggu lalu. Minggu = Senin sampai Minggu.
- Bulanan = rata-rata bulan ini vs bulan lalu.
- **Sejak mulai** = rata-rata 7 hari berskor terakhir vs rata-rata 7 hari berskor pertama. Muncul setelah minimal 14 hari berskor, tersedia untuk semua plan. Inilah jawaban "berapa persen lebih baik dalam sebulan atau setahun".

**Streak "jangan bolos dua kali"** (prinsip Atomic Habits). Berlaku untuk streak kebiasaan dan streak menulis. Satu hari terlewat tidak memutus streak; dua hari berturut-turut terlewat memutusnya. Hari yang terlewat tidak ikut dihitung dalam angka streak.

**Schema output AI (ringkasan harian)**

| Field | Tipe | Aturan |
| --- | --- | --- |
| summary | string | 2 sampai 3 kalimat |
| strengths | string[] | 2 sampai 3 item |
| improvements | string[] | 2 sampai 3 item, dibingkai sebagai ruang tumbuh |
| tomorrow_tip | string | 1 kalimat, kecil dan bisa dilakukan |
| ai_dimension_score | integer 0 sampai 10 | Berdasarkan rubrik: progres terhadap tujuan, fokus, penyelesaian tugas |
| score_reason | string | Wajib merujuk kejadian nyata dari entri |
| risk_flag | boolean | true jika ada tanda krisis (§7) |
| language | "id", "en", atau "mixed" | Bahasa dominan entri |

**Aturan perilaku AI**
1. Balas dalam bahasa dominan entri. Pahami bahasa campur dan slang (gabut, mager, overthinking, burnout, healing).
2. Nada hangat, jujur, tidak menghakimi. Kelebihan disebut dulu. Maksimal sekitar 120 kata.
3. Dilarang mengarang kejadian yang tidak ada di entri atau data.
4. Entri sangat pendek (kurang dari 20 kata): `ai_dimension_score` 5 dan ajak user menambah detail.
5. Temperature 0.2 sampai 0.3 untuk ringkasan agar skor stabil.
6. Dilarang memberi diagnosis, saran medis, atau obat.

## 6. Curhat lewat WhatsApp

**Tujuan:** user curhat lewat chat seperti ngobrol, tanpa membuka web. Setiap pesan masuk ke diary hari itu dan AI membalas singkat dan empatik.

**Provider:** WhatsApp Cloud API resmi dari Meta. Gateway tidak resmi dilarang (nomor bisa diblokir, melanggar ToS, tidak pantas untuk data sensitif).

**Alur**
1. **Hubungkan.** Di `/settings/whatsapp`, user mencentang persetujuan bahwa pesan diproses lewat server Meta, lalu melihat kode 6 karakter (berlaku 15 menit) dan tombol `wa.me` dengan pesan terisi `LINK KODE`. Pesan `LINK KODE` dari nomor mana pun menghubungkan nomor itu ke akun. Nomor tak dikenal yang mengirim pesan lain dibalas satu kalimat petunjuk menghubungkan.
2. **Curhat.** Tiap pesan teks dari nomor terhubung disimpan di `wa_messages` dan ditambahkan ke `entries.content` hari itu (menurut timezone user, dipisah baris kosong). Bot membalas dengan satu pesan.
3. **Balasan AI.** Bahasa mengikuti pesan. Maksimal 80 kata, empatik, paling banyak satu pertanyaan, tanpa skor, tanpa diagnosis. Konteks = 10 pesan terakhir hari itu.
4. **Perintah.** `selesai` membuat ringkasan dan skor lalu mengirim versi singkat plus tautan dashboard. `berhenti` mematikan pengingat dan balasan otomatis. `mulai` mengaktifkannya lagi. `bantuan` menampilkan daftar perintah.
5. **Pengingat harian.** Template message yang disetujui Meta, pada jam pilihan user (default 20:00 waktu user). Hanya untuk user yang opt-in.
6. **Ringkasan otomatis** pukul 22:00 waktu user jika ada entri tapi belum dirangkum. Dikirim ke WhatsApp hanya jika jendela 24 jam sejak pesan terakhir user masih terbuka; jika tidak, tersedia di web.
7. **Pesan non-teks** (suara, gambar, stiker) dibalas satu kalimat bahwa baru teks yang didukung.
8. **Krisis:** ikuti §7.

**Batas balasan AI per hari** (hari menurut timezone user): free **1**, premium 30 (angka premium masih usulan). Ringkasan lewat perintah `selesai` dihitung terpisah, mengikuti kuota ringkasan harian. Setelah batas tercapai, pesan tetap disimpan ke diary; bot mengirim satu pesan tetap tentang batas harian (sekali per hari), lalu tidak membalas lagi hari itu. **Respons krisis tidak pernah dibatasi** dan tidak dihitung ke kuota, untuk semua plan.

**Di luar scope:** pesan suara, catat expense atau habit lewat chat, grup, gambar.

**Ketergantungan non-kode (dikerjakan manusia, sering jadi penghambat jadwal):** akun Meta Business dan verifikasi bisnis, nomor khusus untuk bot, pembuatan dan persetujuan template pengingat, pendaftaran webhook URL. Selama verifikasi belum selesai, pengembangan memakai nomor uji dari Meta.

**Asumsi biaya (verifikasi di dokumentasi Meta sebelum menetapkan harga):** balasan dalam jendela 24 jam setelah user menulis tidak dikenai biaya per pesan, sedangkan template di luar jendela berbayar.

## 7. Keamanan konten dan privasi

**Krisis (web dan WhatsApp)**
- Ringkasan harian memakai field `risk_flag`. Untuk balasan WhatsApp, panggilan AI mengembalikan `{reply, risk_flag}`.
- Setiap pesan WhatsApp masuk juga diperiksa filter kata kunci krisis (Indonesia dan Inggris) di `src/config/crisis.ts` **sebelum** memanggil AI.
- Jika terdeteksi: skor dan persen tidak ditampilkan, balasan AI dibuang, dan user menerima **teks tetap** yang sudah ditulis manusia (empatik, mengajak bicara dengan orang tepercaya atau profesional, memuat layanan krisis). Bukan hasil generasi AI.
- Nomor dan nama layanan krisis diisi dan diverifikasi manusia di `src/config/crisis.ts`. AI dilarang mengarang nomor telepon.
- Disclaimer "bukan pengganti terapi atau tenaga profesional" ada di onboarding dan footer.
- Kandidat layanan (belum diverifikasi manusia): Healing119 dari Kemenkes, telepon 119 ext. 8 atau `healing119.id` (situsnya punya opsi chat WhatsApp), dan 119 untuk bahaya langsung. Sumber: [FAQ Healing119 Kemenkes](https://kesprimkom.kemkes.go.id/assets/uploads/contents/others/FAQ_Cegah_Bunuh_Diri%2C_Dukung_Kesehatan_Jiwa__Kenali_Layanan_Healing119.id.pdf). Cek ulang nomor dan jam layanan di `healing119.id` sebelum launch.

**Draf teks respons krisis** (status: menunggu persetujuan user; setelah disetujui disimpan di `crisis.ts`). Pakai versi yang sesuai bahasa pesan user.

> **ID:** Terima kasih sudah cerita. Yang kamu rasakan terdengar sangat berat, dan kamu tidak harus menghadapinya sendirian.
> Kalau kamu sedang berpikir untuk menyakiti diri sendiri, tolong hubungi orang yang kamu percaya sekarang, atau layanan ini: Healing119 Kemenkes (telepon 119 ext. 8, atau healing119.id). Kalau kamu dalam bahaya langsung, hubungi 119 atau datang ke IGD terdekat.
> Aku bukan pengganti tenaga profesional, tapi aku di sini kalau kamu mau lanjut cerita.

> **EN:** Thank you for telling me. What you're feeling sounds really heavy, and you don't have to face it alone.
> If you're thinking about hurting yourself, please reach out to someone you trust right now, or to this service: Healing119 by the Indonesian Ministry of Health (call 119 ext. 8, or healing119.id). If you're in immediate danger, call 119 or go to the nearest emergency room.
> I'm not a replacement for a professional, but I'm here if you want to keep talking.

**Privasi**
- Row Level Security di semua tabel data user: baris hanya bisa dibaca pemiliknya.
- Seluruh lalu lintas HTTPS. Isi diary dan pesan tidak boleh masuk log.
- User bisa export data (JSON) dan menghapus akun beserta seluruh datanya, tanpa syarat premium.
- Panggilan ke OpenRouter memakai `data_collection: deny`, sehingga hanya provider yang tidak mengumpulkan data yang dipakai. Jika tidak ada provider yang memenuhi untuk model terpilih, OpenRouter mengembalikan error. Itu tanda untuk memilih model atau provider lain, bukan alasan mematikan pengaturan ini.
- Usia minimum 18 tahun, dengan pernyataan wajib saat onboarding. Alasan: UU PDP Pasal 25 mewajibkan persetujuan orang tua atau wali untuk pemrosesan data anak, dan curhat dari anak jauh lebih sensitif. Ini bukan saran hukum; tinjau dengan ahli sebelum menurunkan batas.
- Pesan WhatsApp melewati server Meta. User diberi tahu saat menghubungkan dan disarankan tidak mengirim data sangat sensitif (password, nomor kartu).
- Kebijakan privasi dan syarat layanan wajib ada sebelum launch (UU Pelindungan Data Pribadi). Draf dari AI wajib ditinjau manusia.

**Klien tidak dipercaya: tidak ada yang penting di sisi browser**

Semua yang dikirim ke browser bisa dilihat lewat Inspect, tab Network, bundle JavaScript, atau reverse engineering. Itu tidak bisa dicegah, jadi aturannya: **kalau seluruh sisi klien dibongkar, penyerang tidak mendapat secret, logika yang bisa dimanipulasi, atau data user lain.** Tidak ada sistem yang bisa dijanjikan 100% bebas celah; tujuan aturan ini membuat hasil terburuk dari membongkar klien tetap tidak berarti.

1. **Secret hanya di server.** Satu-satunya nilai yang boleh sampai ke klien adalah `NEXT_PUBLIC_*`. URL dan anon key Supabase memang publik, dan keamanannya sepenuhnya dari RLS. `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, token dan app secret WhatsApp, `CRON_SECRET`, dan kunci gateway pembayaran tidak pernah masuk kode klien, respons API, atau log.
2. **Logika yang menentukan hasil ada di server.** Skor, kuota, batas plan, status langganan, dan pembuatan prompt dihitung dan dicek di server. Klien hanya menampilkan hasilnya. Nilai dari klien (plan, skor, ID user) tidak pernah dipercaya.
3. **Prompt, ID model, dan detail internal tidak dikirim ke klien.** Respons API hanya berisi field yang dibutuhkan layar. Pesan error ke user berupa kalimat umum, tanpa stack trace, query, atau nama tabel; detailnya hanya di log server (tanpa isi diary).
4. **Kepemilikan dicek di setiap endpoint**, bukan hanya mengandalkan UUID yang sulit ditebak. Ini mencegah user mengganti ID di request untuk mengakses data orang lain.
5. **Source map produksi tidak diaktifkan**, dan tidak ada `console.log` di klien yang memuat data user.
6. **Header keamanan** di produksi: Content-Security-Policy, HSTS, `X-Content-Type-Options: nosniff`, pembatasan framing, dan Referrer-Policy.
7. **Dependency** diperiksa dengan `npm audit` sebelum launch, dan temuan serius diselesaikan.
8. **Dibuktikan, bukan diklaim.** Checklist launch (`TASKS.md` 6.5) memuat: pencarian nama dan nilai tiap secret di hasil build (`.next/static`), uji RLS memakai anon key saja, uji akses ke data user lain lewat penggantian ID, dan pengecekan header produksi.

**Tanya diary-mu: guardrail AI dan keamanan** (berlaku untuk ASK; prinsip prompt injection dan render teks juga berlaku untuk ringkasan harian dan balasan WhatsApp)

*Guardrail AI*
1. **Hanya dari entri.** Prompt hanya berisi potongan entri hasil pencarian. AI dilarang memakai pengetahuan luar atau menyimpulkan kejadian yang tidak tertulis. Bukti kurang: `found` false dan jawabannya mengatakan tidak menemukan.
2. **Selalu ada sumber** (ASK-2). Jawaban tanpa sumber yang valid ditolak.
3. **Tidak mendiagnosis dan tidak menghakimi.** Pertanyaan seperti "apakah aku depresi?" dijawab dengan menolak mendiagnosis secara halus, lalu menawarkan merangkum apa yang user sendiri tulis. Tidak ada saran medis, hukum, atau keuangan. Tidak ada skor di jawaban.
4. **Krisis** mengikuti ASK-5 dan teks tetap di atas.
5. **Isi entri adalah data, bukan perintah.** Potongan entri dibungkus pembatas, dan instruksi sistem menyatakan bahwa perintah di dalamnya diabaikan. Model tidak diberi tool atau akses apa pun selain teks yang dikirim. Ini mengurangi risiko, bukan menghilangkannya, jadi dampaknya dibatasi lewat desain: konteks hanya berisi data user itu sendiri, dan output hanya bisa berupa teks terstruktur.
6. **Output terstruktur** (zod): `answer` string (maksimal sekitar 150 kata), `found` boolean, `sources` array berisi `date`, `risk_flag` boolean. Bahasa mengikuti pertanyaan. Temperature rendah (0.2).
7. **Output ditampilkan sebagai teks biasa**, tanpa HTML dan tanpa tautan aktif buatan model.

*Keamanan*
1. **Isolasi data.** Pencarian berjalan dengan sesi user (RLS), bukan service role. Fungsi pencarian memakai hak pemanggil dan tetap memfilter `user_id` secara eksplisit. Wajib ada tes: pertanyaan user A tidak pernah memunculkan potongan entri user B.
2. **Batas input dan konteks.** Panjang pertanyaan, jumlah potongan (usulan 8), dan total karakter konteks dibatasi, divalidasi zod.
3. **Rate limit per user dan kuota plan** dicek di server (ASK-6).
4. **Penyedia AI.** Semua panggilan, termasuk pembuatan embedding jika dipakai, memakai `data_collection: deny`. Jika tidak ada penyedia yang lolos untuk model embedding, berhenti dan laporkan; jangan ubah pengaturannya.
5. **Indeks pencarian setara sensitifnya dengan diary.** RLS aktif, tidak pernah ikut respons API, tidak ikut export (data turunan), dan terhapus bersama entri atau akun.
6. **Kapan entri diindeks.** Tidak pernah saat auto-save (selaras AI-1). Diindeks setelah dirangkum atau setelah harinya berakhir lewat tick, karena entri lampau hanya-baca (DIARY-4).
7. **Privasi.** Kebijakan privasi wajib menyebut bahwa isi entri dikirim ke penyedia model dan embedding. Tinjauan manusia seperti butir lain di atas.
8. **Log** hanya berisi ID dan status, tidak pernah pertanyaan, jawaban, atau potongan entri.

## 8. Monetisasi

Harga usulan: Rp 29.000 per bulan atau Rp 249.000 per tahun, trial premium 7 hari tanpa kartu. **Harga dan gateway belum final** (§11).

| Fitur | Gratis | Premium |
| --- | --- | --- |
| Diary | Tanpa batas | Tanpa batas |
| Ringkasan AI harian dan skor | Ya | Ya |
| Buat ulang ringkasan | 1x per hari | 3x per hari |
| Balasan AI di WhatsApp | 1 per hari | 30 per hari |
| Habit aktif | 3 | Tanpa batas |
| Expense | Input dan total bulanan | Budget dan kategori kustom |
| Riwayat grafik | 30 hari | 365 hari |
| Laporan mingguan | Ringkas | Lengkap |
| Laporan bulanan | Tidak | Ya |
| Tanya diary-mu (usulan, belum final) | 3 per hari, 30 hari terakhir | 20 per hari, seluruh riwayat |
| Export dan hapus data | Ya | Ya |

- **SUB-1:** Batas plan dicek di server, tidak hanya di UI.
- **SUB-2:** Status langganan berubah hanya lewat webhook gateway yang tanda tangannya terverifikasi.
- **SUB-3:** Saat langganan berakhir, data tetap utuh; hanya fitur premium yang terkunci.

## 9. Data model

Dua belas tabel. Semua tabel data user punya `user_id` dan RLS `user_id = auth.uid()`. Tabel bertanda (server) hanya ditulis lewat service role di server. Tanggal disimpan sebagai tipe `date` menurut timezone user, bukan timestamp UTC.

| Tabel | Kolom | Constraint |
| --- | --- | --- |
| profiles | id uuid, name text, timezone text, plan text, premium_until timestamptz, consented_at timestamptz, created_at | PK id = auth.users.id; plan in (free, premium); timezone default Asia/Jakarta |
| entries | id uuid, user_id, date, content text, mood smallint, energy smallint, updated_at | UNIQUE (user_id, date); mood dan energy 1 sampai 5 atau null; content maks 5000 |
| habits | id, user_id, name text, identity text, archived_at, created_at | |
| habit_logs | id, habit_id, user_id, date | UNIQUE (habit_id, date); baris ada = selesai, hapus baris = batal |
| expenses | id, user_id, date, amount integer, category text, note text, created_at | amount > 0 (rupiah) |
| budgets | user_id, month date, amount integer | PK (user_id, month); month = tanggal 1 |
| daily_summaries | id, user_id, date, status text, summary, strengths jsonb, improvements jsonb, tomorrow_tip, ai_dimension_score smallint, score smallint, score_dimensions jsonb, delta_pct numeric, score_reason, risk_flag boolean, model text, regen_count smallint | UNIQUE (user_id, date); status in (pending, done, failed) |
| reports | id, user_id, type text, period_start date, period_end date, content jsonb, created_at | UNIQUE (user_id, type, period_start); type in (weekly, monthly) |
| subscriptions (server) | id, user_id, provider text, provider_ref text, plan text, status text, current_period_end | UNIQUE provider_ref |
| whatsapp_links | user_id, phone text, verified_at, opted_in boolean, reminder_time time, last_inbound_at timestamptz | PK user_id; UNIQUE phone; phone = format digit E.164 tanpa "+" seperti dikirim Meta |
| whatsapp_link_codes (server) | code text, user_id, expires_at | PK code |
| wa_messages (server) | id, user_id (nullable), wa_message_id text, direction text, kind text, body text, created_at | UNIQUE wa_message_id (idempotensi webhook); direction in (in, out); kind untuk pesan keluar in (ai_reply, notice, crisis, summary, reminder, help); jumlah `ai_reply` per tanggal lokal user = pemakaian batas harian |

**Tambahan untuk ASK (usulan).** Dua tabel ini menambah data baru yang disimpan, jadi baru dibuat setelah user menyetujuinya (§11). Keduanya punya `user_id` dan RLS `user_id = auth.uid()`.

| Tabel | Kolom | Constraint |
| --- | --- | --- |
| entry_embeddings (hanya jika pgvector dipilih) | entry_id uuid, user_id, embedding vector(N), model text, content_hash text, created_at | PK entry_id, ON DELETE CASCADE dari `entries`; N mengikuti model embedding terpilih |
| ask_usage (server) | user_id, date, count smallint | PK (user_id, date); `date` = tanggal lokal user |

Jika pencarian memakai full-text Postgres, tidak ada `entry_embeddings`; cukup kolom `tsvector` turunan di `entries` dan satu indeks.

## 10. Metrik sukses

Target angka ditetapkan setelah 2 minggu data awal.

| Metrik | Cara ukur |
| --- | --- |
| Aktivasi | Persentase user baru yang menulis entri pertama dalam 24 jam |
| Retensi minggu pertama | Persentase user dengan minimal 3 entri di 7 hari pertama |
| Kebiasaan menulis | Rata-rata entri per user aktif per minggu |
| Pemakaian WhatsApp | Persentase user aktif yang menghubungkan WhatsApp |
| Konversi | Persentase user gratis menjadi premium |
| Biaya AI | Biaya model dan WhatsApp per pengguna aktif per bulan |

## 11. Keputusan terbuka (belum diputuskan manusia)

Tugas yang bergantung pada hal ini harus berhenti dan ditulis di `TASKS.md` bagian "Terblokir". AI tidak boleh memutuskan atau menebak.

- [x] Nama: Satu Persen (2026-10-28)
- [x] Keluarga model: DeepSeek lewat OpenRouter (2026-10-28). ID model persisnya masih harus dipilih dan diuji (`TASKS.md` 0.4)
- [x] Batas usia: 18 tahun ke atas (2026-10-28)
- [x] Batas balasan AI WhatsApp untuk free: 1 per hari (2026-10-28)
- [ ] Domain
- [ ] Harga final dan gateway pembayaran (belum daftar; `TASKS.md` 6.2 terblokir sampai diputuskan)
- [ ] Layanan krisis terverifikasi dan persetujuan teks respons (draf ada di §7)
- [ ] Teks template pengingat WhatsApp dan persetujuannya dari Meta
- [ ] Bobot skor final setelah diuji pada contoh entri nyata
- [ ] ASK: metode pencarian. Usulan AI: pgvector di Supabase (tanpa vector database terpisah), karena pertanyaan user biasanya berupa parafrase dan bahasa campur yang sulit ditangkap pencarian kata kunci. Syaratnya model embedding lolos `data_collection: deny` dan cukup baik berbahasa Indonesia, dibuktikan dengan uji pada contoh pertanyaan nyata. Jika tidak lolos, pakai full-text Postgres
- [ ] ASK: model embedding dan env baru (mis. `AI_MODEL_EMBEDDING`, belum ada di daftar env `AGENTS.md` §4). Keluarga DeepSeek yang sudah diputuskan mungkin tidak menyediakan model embedding; ini harus dicek, bukan diasumsikan
- [ ] ASK: kuota dan cakupan riwayat per plan (usulan di §8)
- [ ] ASK: persetujuan menyimpan indeks pencarian sebagai data turunan baru (§9) dan revisi teks privasi
