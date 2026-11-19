# PRD Satu Persen

> Versi 1.4 · 2026-10-28 · Nama produk: Satu Persen (kode dan domain memakai `satupersen`).
> File ini = **apa yang dibangun dan kenapa**. Keputusan teknis dan aturan kerja AI ada di `AGENTS.md`. Progres ada di `TASKS.md`.
> Jika permintaan di chat bertentangan dengan PRD ini, ikuti PRD dan beri tahu user. Setiap kriteria punya ID (mis. `DIARY-2`) yang dirujuk `TASKS.md`.

## 1. Ringkasan

Satu Persen adalah web app life tracker untuk anak muda Indonesia. User menulis diary singkat tiap hari, lewat web atau lewat chat WhatsApp. AI meringkas hari itu (kelebihan, hal yang bisa diperbaiki, saran besok) dan memberi skor 0 sampai 100 beserta alasannya, lalu menunjukkan seberapa lebih baik user dibanding hari sebelumnya ("Kamu 2% lebih baik dibanding kemarin").

- **Masalah:** anak muda ingin berubah tapi tidak tahu apakah benar-benar maju. Diary biasa hanya menyimpan, tidak memberi umpan balik.
- **Pembeda:** (1) skor selalu disertai alasan, (2) insight lintas modul (diary, habit, mood, expense), (3) pendekatan Atomic Habits (identitas, bukan sekadar streak), (4) curhat lewat WhatsApp, (5) paham Bahasa Indonesia, bahasa Inggris, dan campuran.
- **Bisnis:** freemium. Fitur dasar gratis, premium untuk kedalaman AI dan riwayat.

## 2. Target user

Terutama usia 18 sampai 25: mahasiswa, pelajar, pekerja yang ingin berubah, pencari kerja. Akses terutama lewat HP. Menulis dengan bahasa campur Indonesia dan Inggris. Sensitif harga. Berhenti kalau input terasa ribet, jadi input harian harus selesai dalam 1 sampai 2 menit.

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
| Belajar: retrieval, spacing, dan elaborasi, terinspirasi buku *Make It Stick* (disetujui user 2026-11-15) | LEARN |
| Ruang baca di Belajar: unggah dan baca e-book, lalu jadikan bagiannya materi (disetujui user 2026-11-17) | READ |
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
- AUTH-1: Daftar dan masuk dengan email dan password, atau dengan Google. Daftar dan masuk satu form di `/login`, dua mode (keputusan user, 2026-11-01: magic link dihapus). Password baru minimal 8 karakter. Lupa password: AUTH-5.
- AUTH-2: Semua halaman di grup `(app)` mengarahkan ke `/login` jika belum login.
- AUTH-3: Login pertama membuat baris `profiles` otomatis dengan plan `free`. Onboarding mendeteksi timezone browser (mis. `Asia/Makassar` untuk WITA) dan menyimpannya; `Asia/Jakarta` hanya dipakai bila deteksi gagal. Timezone bisa diubah di Akun.
- AUTH-4: Onboarding satu layar sebelum masuk aplikasi: tombol "Mulai" dengan satu kalimat di bawahnya, "Dengan menekan Mulai, kamu setuju dengan Kebijakan Privasi", yang menautkan `/privacy`. Menekan Mulai mencatat waktu persetujuan; tanpa itu user tidak bisa lanjut. Layar tidak menyebut penyedia model AI; kebijakan privasi tetap menjelaskannya (PRD §7). (Pernyataan usia 18+ dihapus atas keputusan user, 2026-11-01; checkbox diganti kalimat atas keputusan user, 2026-11-19.)
- AUTH-5: Lupa password (disetujui user, 2026-11-14). Mode masuk di `/login` punya tautan "Lupa password?" ke `/forgot-password`, yang mengirim tautan reset lewat Supabase Auth dengan jawaban yang sama untuk email terdaftar maupun tidak. Tautan kembali lewat `/auth/callback` ke `/reset-password`, tempat password baru (minimal 8 karakter) disimpan, lalu user langsung masuk. Tautan yang kedaluwarsa, sudah dipakai, atau dibuka di browser lain menampilkan penjelasan dan tombol minta tautan baru. Parameter `next` di callback hanya menerima path di dalam aplikasi.

**DIARY**
- DIARY-1: `/today` menampilkan editor untuk tanggal hari ini menurut timezone user.
- DIARY-2: Draft tersimpan otomatis (debounce 2 detik). Satu baris `entries` per (user_id, date); menyimpan ulang = update, bukan baris baru.
- DIARY-3: Maksimal 5.000 karakter, ditolak di klien dan server dengan pesan jelas.
- DIARY-4: `/history` menampilkan kalender yang menandai tanggal yang punya entri. Entri tanggal lampau hanya bisa dibaca; hanya hari ini yang bisa diedit.

**AI** (ringkasan harian)
- AI-1: Tombol "Analisa hari ini" (sebelumnya "Rangkum hari ini"; istilah di UI diganti user 2026-10-31) menyimpan entri lalu memanggil `POST /api/ai/summarize`. Auto-save tidak pernah memanggil AI. Jika tulisan kosong, tampilkan petunjuk dan jangan memanggil AI. State layar mengikuti `DESIGN.md` §7.
- AI-2: Output divalidasi terhadap schema §5. Tidak valid: coba ulang 1x. Masih gagal: status `failed`, tombol "Coba lagi", entri tetap tersimpan.
- AI-3: Saat diproses tampil loading yang jelas. Tidak ada hasil palsu.
- AI-4: Analisa pertama tiap hari selalu boleh. Setelah itu, analisa ulang per hari: free 1x, premium 3x. Kuota dipakai bersama oleh web, perintah `selesai` di WhatsApp, dan ringkasan otomatis. Dicek di server.
- AI-5: Jika `risk_flag` true, ikuti §7.

**SCORE**
- SCORE-1: Skor dihitung di kode (`scoring.ts`), bukan oleh AI. AI hanya memberi `ai_dimension_score` 0 sampai 10.
- SCORE-2 (diubah user 2026-11-01): perbandingan harian = skor hari ini dikurangi skor hari berskor terakhir sebelumnya, dalam poin, ditampilkan sebagai kalimat "Kamu 2% lebih baik dibanding kemarin" (atau "hari Kamis", atau tanggalnya bila lebih dari seminggu). Angka skor 0 sampai 100 tidak ditampilkan di Hari Ini dan WhatsApp; grafik Progres tetap memakainya. `delta_pct` menyimpan poin itu, null bila belum ada hari berskor sebelumnya, dan UI menampilkan "Ini analisa pertamamu".
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
- EXP-5: Tambah pemasukan (nominal integer, kategori, catatan opsional) di tabel yang sama dengan pengeluaran, dibedakan kolom `type`. Kategori bawaan pemasukan: gaji, uang saku, usaha atau freelance, bonus atau hadiah, lainnya. Layar Uang menampilkan sisa uang bulan itu (masuk dikurangi keluar), total masuk, dan total keluar; jenis entri tidak bisa diubah setelah dibuat. Diputuskan user 2026-11-01.
- EXP-6: Perbandingan perkembangan: bulan ini lawan bulan sebelumnya (pengeluaran dan sisa uang; bulan yang masih berjalan dibandingkan dengan hari-hari yang sama di bulan lalu) dan grafik masuk lawan keluar untuk 6 bulan yang berakhir di bulan yang dibuka. Tanpa warna baik atau buruk.
- EXP-7: "Isi dari screenshot bank" (diputuskan user 2026-11-16: OCR di HP lalu DeepSeek). User memilih screenshot bukti transfer atau pembayaran dari bank atau e-wallet; gambar dibaca di perangkat (tesseract.js, bahasa Indonesia, mesin dan data bahasa dilayani dari situs sendiri) dan **tidak diunggah**. Hanya teksnya dikirim ke server, setelah deretan 10 angka atau lebih (nomor rekening, telepon, referensi) disamarkan di HP dan sekali lagi di server, dipotong maksimal 3.000 karakter. Model `AI_MODEL_DAILY` mengisi jenis, nominal, tanggal, kategori, dan catatan singkat; hasilnya divalidasi zod dan aturan server (nominal 1 sampai `MAX_AMOUNT`, kategori sesuai jenis, tanggal sesuai EXP-8; yang tidak lolos dikosongkan). Form terbuka terisi dan bisa diubah, termasuk jenis; **tidak ada yang tersimpan sebelum user menekan Simpan**. Teks screenshot dan hasil bacaan tidak disimpan dan tidak masuk log; yang dicatat hanya token di `ai_usage` (fitur `receipt`). Gambar tanpa tulisan dijawab tanpa memanggil server; tanpa nominal transaksi (misalnya layar saldo saja) dijawab "Nominal transaksi tidak ketemu…". Ikut rate limit (RATE-1) dan batas token bulanan (§8); tanpa filter krisis dan tanpa kuota harian terpisah.
- EXP-8: Entri baru punya tanggal, bawaannya hari ini menurut timezone profil, bisa diganti ke hari sebelumnya paling jauh 365 hari ke belakang, tidak pernah ke masa depan; dicek ulang di server. Entri yang sudah ada tetap tidak bisa dipindah tanggal atau jenisnya (EXP-2, EXP-5). Bila tanggalnya di bulan lain, layar memberi tahu dan menautkan ke bulan itu. Skor hari yang sudah dianalisa tidak dihitung ulang. Diputuskan user 2026-11-16.

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

**LEARN** (Belajar; modul terpisah dari diary, diputuskan user 2026-11-15, dikerjakan sebelum launch)

Tujuannya membantu materi yang dipelajari user benar-benar nempel memakai tiga teknik dari *Make It Stick*: **retrieval** (mengingat tanpa melihat), **spacing** (diulang dengan jarak yang makin panjang), dan **elaborasi** (menjelaskan dengan kata sendiri dan menghubungkannya). Menu "Belajar" di `/learn`.
- LEARN-1: `/learn` menampilkan materi milik user. Materi yang punya pertanyaan jatuh tempo hari ini (tanggal lokal user) tampil paling atas sebagai "Review hari ini". Tambah materi: judul (maksimal 120 karakter) dan bahan berupa teks yang ditempel atau ditulis (maksimal 5.000 karakter), ditolak di klien dan server dengan pesan jelas. Unggah PDF, foto, atau tautan sebagai bahan tidak didukung; e-book dibaca di Ruang baca (READ), dan bagian yang diblok di sana bisa dijadikan bahan lewat "Jadikan materi" (READ-7).
- LEARN-2: Langkah pertama, "Jelaskan dengan kata sendiri". Bahan tertutup secara bawaan (bisa dibuka). User menulis penjelasan (maksimal 3.000 karakter), lalu "Periksa penjelasan". AI membandingkan penjelasan **hanya dengan bahan** (keputusan user): yang sudah tepat, yang terlewat, dan yang keliru menurut bahan. Hal yang tidak ada di bahan tidak dinilai benar atau salah, tetapi disebut "tidak ada di bahanmu". Pemeriksaan pertama yang berhasil juga membuat 3 sampai 5 pertanyaan dari bahan, minimal satu pertanyaan elaborasi (kenapa, bagaimana, hubungkan, beri contoh), masing-masing dengan jawaban menurut bahan. Sejak itu materi aktif. Bahan hanya bisa diubah sebelum materi aktif, karena pertanyaannya dibuat dari bahan itu. Penjelasan bisa diulang dan diperiksa lagi selama kuota mengizinkan; pertanyaan dan jadwal tidak berubah.
- LEARN-3: Jadwal review dihitung di kode (`src/lib/study/schedule.ts`, dengan tes), tidak pernah oleh AI. Pertanyaan pertama kali jatuh tempo 1 hari setelah materi aktif. Jarak bertahap 1, 3, 7, 14, lalu 30 hari, dihitung dari tanggal review (tanggal lokal user). Penilaian user sendiri yang menentukan: **Ingat** naik ke jarak berikutnya (setelah jarak 30 hari pertanyaan selesai), **Ragu** mengulang jarak yang sama, **Lupa** kembali ke 1 hari. Materi selesai bila semua pertanyaannya selesai.
- LEARN-4: Sesi review per materi: semua pertanyaan yang jatuh tempo dijawab dari ingatan dulu (boleh kosong), lalu "Lihat jawaban" menampilkan jawaban menurut bahan, lalu user menilai tiap pertanyaan (Lupa, Ragu, Ingat) dan menyimpan. Setelah tersimpan, bila kuota mengizinkan, AI memberi umpan balik singkat per jawaban berdasarkan bahan. Review tetap tersimpan walau AI gagal, tidak dikonfigurasi, atau kuotanya habis.
- LEARN-5: Kuota, dicek di server (§8). Free maksimal **1 materi per akun**: menghapus materi tidak membuka slot, karena yang dihitung adalah jumlah materi yang pernah dibuat, dijaga trigger database. Premium tanpa batas materi. Pemeriksaan AI (1x = satu pemeriksaan penjelasan, atau satu sesi review yang semua jawabannya diperiksa sekaligus): free **1x per hari per akun**, premium **10x per materi per hari**, hari menurut tanggal lokal user. Pemeriksaan yang gagal tidak dihitung, dan dua permintaan bersamaan tidak bisa sama-sama lolos dari batas. Lewat batas token bulanan (§8), pemeriksaan AI Belajar berhenti sampai tanggal 1, sedangkan review dengan penilaian sendiri tetap jalan. Premium yang berakhir: semua materi tetap ada dan bisa direview, aturan free berlaku (SUB-3).
- LEARN-6: Output model divalidasi zod. Tidak valid: coba ulang 1x, lalu error dengan tombol "Coba lagi". Tidak ada umpan balik atau pertanyaan palsu. Bahan dibungkus pembatas dan diperlakukan sebagai data, bukan perintah. Umpan balik ditampilkan sebagai teks biasa dengan label bahwa itu diperiksa AI dari bahan.
- LEARN-7: Tanpa filter krisis (keputusan user 2026-11-15: isinya bahan pelajaran, bukan curhat, dan filter kata kunci salah tangkap bab psikologi, sejarah, atau biologi). Cerita pribadi tetap di diary dan WhatsApp yang punya penanganan krisis. Prompt tetap melarang nomor telepon, diagnosis, dan saran medis.
- LEARN-8: Materi, pertanyaan, dan riwayat review ikut export dan terhapus bersama akun. User bisa menghapus satu materi beserta pertanyaan dan riwayat reviewnya; untuk free, konfirmasinya menjelaskan bahwa slot tidak kembali. Isi bahan, penjelasan, dan jawaban tidak pernah masuk log.
- LEARN-9: Item Belajar di navigasi diberi penanda kecil (dengan teks untuk pembaca layar) saat ada pertanyaan yang jatuh tempo hari ini.

**READ** (Ruang baca di Belajar; diputuskan user 2026-11-17, dikerjakan sebelum launch)

Tempat membaca e-book milik user di dalam Satu Persen, supaya bagian penting dari buku bisa langsung dijadikan materi Belajar. Pembeda dari aplikasi baca lain adalah sambungan ke LEARN; AI tidak pernah membaca buku.
- READ-1: Di `/learn` ada lembaran "Ruang baca" berisi buku milik user (judul dari nama file, format, ukuran, posisi baca terakhir dalam persen) dan tautan "Unggah buku". Format yang diterima: PDF, EPUB, DOCX, dan TXT, maksimal 50 MB per file. Jenis file dicek dari isinya di HP sebelum diunggah, bukan hanya dari ekstensi; file lain ditolak dengan pesan jelas. Buku yang terkunci DRM tidak bisa dibuka dan dijawab dengan pesan jelas.
- READ-2: Kuota dicek di server, sama polanya dengan LEARN-5: free **1 buku per akun** (yang dihitung buku yang pernah selesai diunggah, jadi menghapus buku tidak membuka slot), premium **total 2 GB**. Unggahan yang gagal atau ditinggalkan tidak memakai slot. File diunggah langsung dari HP ke Supabase Storage dengan izin unggah sekali pakai dari server (batas isi request Vercel 4,5 MB), lalu server memeriksa ukuran file yang benar-benar tersimpan sebelum buku ditandai siap; yang melewati batas dihapus. Dua permintaan bersamaan tidak bisa sama-sama lolos dari batas. Premium yang berakhir: semua buku tetap ada dan bisa dibaca, aturan free berlaku untuk menambah buku (SUB-3).
- READ-3: Pembaca di `/read/[id]` menampilkan buku dengan tata letak dan huruf dari file penerbit lewat foliate-js (pilihan user 2026-11-17, dibandingkan di artifact contoh). DOCX diubah ke HTML dan TXT ke paragraf, dibersihkan, lalu dibuka di pembaca yang sama, sehingga semua format punya satu gaya baca. Cara baca **Gulir** atau **Geser** dipilih di panel Aa dan bisa diganti kapan saja tanpa kehilangan posisi; pilihannya disimpan di perangkat seperti mode malam, bukan di database. PDF dibaca per halaman (Geser) di versi pertama, karena foliate-js belum menyediakan mode gulir untuk tata letak tetap.
- READ-4: Pindah halaman di mode Geser tanpa tombol di layar: geser jari ke kiri atau kanan, ketuk sepertiga tepi kiri atau kanan, atau tombol panah keyboard. Panel Aa juga mengatur ukuran huruf (EPUB, DOCX, TXT). **Mode layar penuh** menyembunyikan semua kontrol; ketuk tengah layar memunculkannya lagi dan kontrol hilang sendiri setelah 4 detik; Esc atau tombol yang sama menutupnya. Di browser yang mendukung Fullscreen API, bar browser ikut disembunyikan; di browser lain hanya kontrol aplikasi yang hilang.
- READ-5: Mode siang menampilkan warna asli file. Mode malam menimpa warna teks dan latar buku dengan token mode malam Satu Persen; huruf dan tata letak tetap dari file. PDF tetap berwarna asli di versi pertama.
- READ-6: Posisi baca terakhir (penanda posisi foliate-js dan persentase) disimpan per buku, paling sering sekali tiap 2 detik, dan buku dibuka lagi di posisi itu, juga setelah cara baca diganti.
- READ-7: **"Jadikan materi"**: teks yang diblok, maksimal 5.000 karakter (dihitung di layar), dibawa ke form Materi baru (`/learn/new`) dengan judul usulan dari awal teks dan judul buku. User bisa mengubah judul dan bahannya, lalu LEARN-1 sampai LEARN-5 berlaku, termasuk batas 1 materi free. Teksnya tidak dikirim ke server sebelum user menekan "Simpan materi".
- READ-8: Keamanan. File privat per akun: bucket privat, kebijakan baca hanya untuk folder milik user, dan hanya service role yang menulis serta menghapus file. Isi buku dianggap tidak dipercaya: halaman pembaca selalu dimuat sebagai dokumen baru (bukan navigasi di sisi klien) dengan CSP tambahan berbasis nonce, sehingga script di dalam buku tidak jalan; dibuktikan dengan tes EPUB yang berisi script. foliate-js diambil dari repo pembuatnya dan dikunci di satu commit (paket npm bernama sama diterbitkan orang lain); foliate-js, pdf.js, pengubah DOCX, dan pembersih HTML dilayani dari situs sendiri.
- READ-9: Salinan buku disimpan di Cache Storage browser setelah dibuka pertama kali, terpisah per user, supaya buka ulang tidak mengunduh lagi. Salinan dihapus saat buku dihapus dan saat user keluar lewat tombol Keluar; salinan milik akun lain di perangkat yang sama dihapus saat pembaca dibuka.
- READ-10: Hapus buku dengan konfirmasi di tempat; file dan barisnya terhapus, dan untuk free konfirmasinya menjelaskan bahwa slot tidak kembali. Hapus akun menghapus semua file buku di Storage secara eksplisit, karena file tidak ikut terhapus bersama baris database. Export memuat daftar buku (judul, format, ukuran, tanggal, posisi), bukan filenya. Judul dan isi buku tidak pernah masuk log.

**WA, SUB, LAUNCH:** lihat §6, §8, dan `TASKS.md` Fase 6.

## 5. Skor dan aturan AI

Skor harian 0 sampai 100, separuh lebih berasal dari data objektif. Bobot adalah usulan awal.

| Dimensi | Bobot | Sumber |
| --- | --- | --- |
| Kebiasaan | 30% | Persentase habit aktif yang selesai hari itu |
| Produktivitas dan progres | 30% | `ai_dimension_score` (0 sampai 10, rubrik tetap) |
| Mood dan energi | 25% | Rata-rata mood dan energi yang diinput user |
| Keuangan | 15% | Jika ada pemasukan bulan itu: rasio tabungan bulan berjalan, (masuk dikurangi keluar sampai hari itu) dibagi masuk, penuh di 20% atau lebih dan 0 di 0% atau kurang (EXP-5). Jika tidak ada pemasukan: pengeluaran hari itu vs budget harian (budget bulanan dibagi hari; premium) |

Dimensi tanpa data (mis. user belum punya habit atau budget) dikeluarkan dan bobotnya dibagi ulang ke dimensi lain.

**Persen lebih baik**
- Harian = skor hari ini − skor hari berskor terakhir sebelumnya, dalam poin (keputusan user 2026-11-01, menggantikan rasio terhadap rata-rata 7 hari). Selisih poin dipilih agar angkanya tidak berlebihan: skor 30 lalu 60 tampil 30%, bukan 100%.
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
- Disclaimer "bukan pengganti terapi atau tenaga profesional" tidak dipasang di onboarding, footer, FAQ, maupun syarat layanan (keputusan user, 2026-11-01: Satu Persen diposisikan sebagai life tracker). Teks krisis di atas tetap berlaku.
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
- Tidak ada batas atau pernyataan usia di aplikasi (keputusan user, 2026-11-01; sebelumnya 18+). Risiko yang tetap berlaku: UU PDP Pasal 25 mewajibkan persetujuan orang tua atau wali untuk pemrosesan data anak, dan curhat dari anak jauh lebih sensitif. Ini bukan saran hukum; tinjau dengan ahli sebelum launch.
- Pesan WhatsApp melewati server Meta. User diberi tahu saat menghubungkan dan disarankan tidak mengirim data sangat sensitif (password, nomor kartu).
- Kebijakan privasi dan syarat layanan wajib ada sebelum launch (UU Pelindungan Data Pribadi). Draf dari AI wajib ditinjau manusia.
- Belajar (LEARN): bahan, penjelasan, dan jawaban review disimpan di database dan dikirim ke penyedia model saat diperiksa (persetujuan user 2026-11-15). Kebijakan privasi menyebutnya.
- Isi dari screenshot (EXP-7): gambar tidak pernah meninggalkan HP; teksnya, dengan deretan angka panjang disamarkan, dikirim ke penyedia model lalu dibuang, tidak disimpan dan tidak masuk log (persetujuan user 2026-11-16). Penyamaran hanya menangkap deretan angka; nama penerima dan merchant tetap ikut terkirim. Kebijakan privasi menyebutnya.
- Ruang baca (READ): file e-book disimpan privat di Supabase Storage dan tidak pernah dikirim ke penyedia model; salinannya disimpan di browser user (READ-9). Hanya teks yang user pilih sendiri lewat "Jadikan materi" yang bisa sampai ke penyedia model, lewat pemeriksaan LEARN. User hanya boleh mengunggah file yang berhak ia simpan; ketentuan layanan melarang file yang melanggar hak cipta dan menyediakan jalur laporan penurunan konten (kontaknya diisi manusia). Kebijakan privasi dan ketentuan menyebutnya; draf wajib ditinjau manusia (persetujuan fitur oleh user 2026-11-17).

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

**Rate limit (disetujui user 2026-11-15, "pasang tapi jangan sampai mengganggu penggunaan normal")**

Kuota mengatur berapa banyak, rate limit mengatur seberapa cepat. Rate limit menutup dua celah yang tidak ditutup kuota: banyak permintaan di detik yang sama yang semuanya melihat "jatah masih ada", dan percobaan gagal yang tidak memotong kuota tetapi tetap dibayar.
- RATE-1: Maksimal **5 panggilan AI per menit per user**, dihitung di tabel server `rate_limits` lewat satu fungsi database yang atomik (aman dipakai banyak instance Vercel sekaligus). Satu ember dipakai bersama oleh "Analisa hari ini", pemeriksaan Belajar, dan "Isi dari screenshot" (EXP-7). WhatsApp sudah punya batas banjir sendiri yang dihitung dari `wa_messages` (lebih dari 10 pesan per menit disimpan tanpa dibalas), jadi tidak memakai tabel ini.
- RATE-2: Yang dihitung adalah ketukan yang memanggil AI. Coba ulang otomatis karena format jawaban model salah (AI-2) tidak dihitung lagi. Menulis, simpan otomatis, menilai sendiri, dan membuka halaman tidak pernah dibatasi.
- RATE-3: Saat batas tercapai, layar menampilkan "Tunggu sebentar ya, kamu bisa coba lagi dalam N detik." dan tulisan tetap tersimpan. Bila hitungan tidak bisa dibaca, permintaan diloloskan dan kejadiannya dicatat di log (tanpa isi), supaya gangguan database tidak memblokir pemakaian normal.

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

**Paket premium (keputusan user 2026-11-01: dihitung dari biaya token AI; 1 tahun dibuat paling untung, 3 bulan tetap terasa hemat untuk yang mencoba; tanpa trial):**

| Paket | Harga | Per bulan | Hemat vs bulanan |
| --- | --- | --- | --- |
| 1 bulan | Rp 29.000 | Rp 29.000 | 0% |
| 3 bulan | Rp 74.000 | Rp 24.666 | 15% |
| 6 bulan | Rp 129.000 | Rp 21.500 | 26% |
| 12 bulan | Rp 199.000 | Rp 16.583 | 43% |

Sumber angka satu-satunya: `src/config/plans.ts` (landing, halaman Paket, dan cek server membaca file itu). **Gateway pembayaran ditunda** (§11); tombol bayar menunggu.

**Dasar hitungan biaya (2026-11-01):** harga publik OpenRouter untuk model di `AI_MODEL_*` dengan provider menengah yang lolos `data_collection: deny` (asumsi USD 0,30 per juta token input dan 1,20 per juta output, kurs Rp 16.500 per USD). Satu analisa harian sungguhan tercatat 659 token input dan 718 token output (termasuk token berpikir model), biaya USD 0,00059, sekitar Rp 10. Bulan premium normal sekitar 360 ribu token (sekitar Rp 2.500). Biaya gateway per transaksi belum diketahui, diasumsikan sekitar Rp 4.500; paket panjang hanya kena satu kali.

**Batas token AI bulanan (lunak, keputusan user 2026-11-01):** gratis 150.000 token, premium 1.200.000 token per bulan kalender lokal, dihitung dari token yang dilaporkan OpenRouter dan dicatat di `ai_usage`. Lewat batas: analisa pertama tiap hari tetap jalan; analisa ulang, balasan chat AI di WhatsApp, pemeriksaan AI Belajar, dan "Isi dari screenshot" (input manual tetap jalan) berhenti (satu pemberitahuan per hari untuk WhatsApp) sampai tanggal 1. Laporan terjadwal dan review Belajar dengan penilaian sendiri tetap jalan. Batas premium menjaga bulan terberat di bawah separuh harga efektif paket 12 bulan.

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
| Materi Belajar (LEARN-5, keputusan user 2026-11-15) | 1 materi per akun | Tanpa batas |
| Pemeriksaan AI Belajar | 1x per hari | 10x per materi per hari |
| Ruang baca (READ-2, keputusan user 2026-11-17) | 1 buku per akun | Total 2 GB |
| Ukuran satu file e-book | Maksimal 50 MB | Maksimal 50 MB |
| Kuota AI per bulan (batas lunak) | 150.000 token | 1.200.000 token |
| Export dan hapus data | Ya | Ya |

- **SUB-1:** Batas plan dicek di server, tidak hanya di UI.
- **SUB-2:** Status langganan berubah hanya lewat webhook gateway yang tanda tangannya terverifikasi.
- **SUB-3:** Saat langganan berakhir, data tetap utuh; hanya fitur premium yang terkunci. Tick terjadwal menurunkan `plan` ke `free` begitu `premium_until` lewat.
- **SUB-4:** Setiap panggilan AI dicatat di `ai_usage` (token dan biaya dari OpenRouter, tanpa isi), dan batas token bulanan dicek di server sebelum analisa ulang dan balasan chat.

## 9. Data model

Dua belas tabel inti, ditambah tabel Belajar dan rate limit di bawahnya. Semua tabel data user punya `user_id` dan RLS `user_id = auth.uid()`. Tabel bertanda (server) hanya ditulis lewat service role di server. Tanggal disimpan sebagai tipe `date` menurut timezone user, bukan timestamp UTC.

| Tabel | Kolom | Constraint |
| --- | --- | --- |
| profiles | id uuid, name text, timezone text, plan text, premium_until timestamptz, consented_at timestamptz, created_at | PK id = auth.users.id; plan in (free, premium); timezone default Asia/Jakarta |
| entries | id uuid, user_id, date, content text, mood smallint, energy smallint, updated_at | UNIQUE (user_id, date); mood dan energy 1 sampai 5 atau null; content maks 5000 |
| habits | id, user_id, name text, identity text, archived_at, created_at | |
| habit_logs | id, habit_id, user_id, date | UNIQUE (habit_id, date); baris ada = selesai, hapus baris = batal |
| expenses | id, user_id, date, type text, amount integer, category text, note text, created_at | amount > 0 (rupiah); type in (expense, income), default expense. Nama tabel tetap `expenses`; satu baris = satu catatan uang masuk atau keluar |
| budgets | user_id, month date, amount integer | PK (user_id, month); month = tanggal 1 |
| daily_summaries | id, user_id, date, status text, summary, strengths jsonb, improvements jsonb, tomorrow_tip, ai_dimension_score smallint, score smallint, score_dimensions jsonb, delta_pct numeric, score_reason, risk_flag boolean, model text, regen_count smallint | UNIQUE (user_id, date); status in (pending, done, failed) |
| reports | id, user_id, type text, period_start date, period_end date, content jsonb, created_at | UNIQUE (user_id, type, period_start); type in (weekly, monthly) |
| subscriptions (server) | id, user_id, provider text, provider_ref text, plan text, status text, current_period_end | UNIQUE provider_ref |
| ai_usage (server) | id, user_id, feature text, model text, prompt_tokens int, completion_tokens int, cost_usd numeric, created_at | feature in (daily, chat, report, study, receipt); satu baris per panggilan model termasuk percobaan ulang; user hanya membaca miliknya; jumlah bulanan lewat RPC `ai_tokens_since` |
| whatsapp_links | user_id, phone text, verified_at, opted_in boolean, reminder_time time, last_inbound_at timestamptz | PK user_id; UNIQUE phone; phone = format digit E.164 tanpa "+" seperti dikirim Meta |
| whatsapp_link_codes (server) | code text, user_id, expires_at | PK code |
| wa_messages (server) | id, user_id (nullable), wa_message_id text, direction text, kind text, body text, created_at | UNIQUE wa_message_id (idempotensi webhook); direction in (in, out); kind untuk pesan keluar in (ai_reply, notice, crisis, summary, reminder, help); jumlah `ai_reply` per tanggal lokal user = pemakaian batas harian |

**Tambahan untuk Belajar dan rate limit (disetujui user 2026-11-15).** Semua punya `user_id` dengan ON DELETE CASCADE dari `auth.users` dan RLS `user_id = auth.uid()` untuk membaca. Tabel bertanda (server) hanya ditulis service role. Selain itu `profiles` mendapat kolom server `study_materials_created integer` (jumlah materi yang pernah dibuat, dinaikkan trigger, tidak turun saat materi dihapus; dasar batas free LEARN-5).

| Tabel | Kolom | Constraint |
| --- | --- | --- |
| study_materials | id uuid, user_id, title text, source text, explanation text, feedback jsonb, status text, created_at, activated_at timestamptz, updated_at | title 1 sampai 120; source 1 sampai 5000; explanation maks 3000; status in (draft, active). User hanya boleh menulis `title` dan `source`, dan `source` dikunci trigger setelah status `active`. `explanation`, `feedback`, `status` ditulis server. Trigger insert menolak akun free yang sudah pernah membuat 1 materi |
| study_questions (server) | id uuid, material_id, user_id, position smallint, prompt text, answer text, kind text, step smallint, due_date date, created_at | ON DELETE CASCADE dari `study_materials`; kind in (recall, elaboration); step 0 sampai 5; `due_date` null = pertanyaan selesai; UNIQUE (material_id, position) |
| study_reviews (server) | id, user_id, material_id, question_id, reviewed_on date, answer text, rating text, feedback text, created_at | ON DELETE CASCADE dari materi dan pertanyaan; rating in (forgot, unsure, remembered); answer maks 1000; UNIQUE (question_id, reviewed_on) |
| study_checks (server) | id, user_id, material_id, date, kind text, created_at | Satu baris per pemeriksaan AI yang berhasil, dasar kuota LEARN-5; `material_id` ON DELETE SET NULL supaya hitungan hari itu tidak hilang saat materi dihapus; kind in (explanation, review); diambil lewat fungsi `reserve_study_check` yang mengunci per user |
| rate_limits (server) | user_id, bucket text, window_start timestamptz, count integer | PK (user_id, bucket, window_start); ditulis hanya lewat fungsi `take_rate_limit` (RATE-1); jendela lama milik user itu dihapus setiap kali fungsi dipanggil; tidak bisa dibaca user |

Penulisan Belajar yang menyentuh beberapa baris berjalan dalam satu transaksi lewat fungsi database yang hanya bisa dipanggil service role: `store_study_explanation_check` (umpan balik, pertanyaan, dan aktivasi materi), `save_study_review` (jawaban, penilaian, dan jadwal baru), dan `store_study_review_feedback` (umpan balik AI per jawaban). Nilainya (jadwal dari `schedule.ts`, output model yang sudah divalidasi) tetap dihitung di kode server.

**Tambahan untuk Ruang baca (disetujui user 2026-11-17).** `profiles` mendapat kolom server `books_created integer` (jumlah buku yang pernah selesai diunggah; tidak turun saat buku dihapus; dasar batas free READ-2).

| Tabel | Kolom | Constraint |
| --- | --- | --- |
| books | id uuid, user_id, title text, format text, size_bytes bigint, storage_path text, status text, location text, progress numeric, created_at, ready_at timestamptz, opened_at timestamptz | ON DELETE CASCADE dari `auth.users`; title 1 sampai 120; format in (pdf, epub, docx, txt); size_bytes 1 sampai 52.428.800; status in (uploading, ready); storage_path UNIQUE, `<user_id>/<id>`; location maks 2.000 karakter; progress 0 sampai 1. User hanya membaca bukunya sendiri dan hanya boleh mengubah `location`, `progress`, dan `opened_at`; selain itu ditulis server lewat `start_book_upload` dan `finish_book_upload`, yang mengunci per user |

File disimpan di bucket Storage privat `books` (maksimal 50 MB per file, hanya tipe PDF, EPUB, DOCX, dan TXT) dengan path `<user_id>/<book_id>`. Kebijakan Storage hanya mengizinkan user membaca file di foldernya sendiri; unggah memakai izin sekali pakai dari server, dan hapus hanya lewat service role.

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
- [x] Batas usia: tidak ada pernyataan usia (2026-11-01; sebelumnya 18 tahun ke atas, 2026-10-28)
- [x] Batas balasan AI WhatsApp untuk free: 1 per hari (2026-10-28)
- [ ] Domain
- [x] Harga paket premium 1/3/6/12 bulan, batas token lunak, tanpa trial (2026-11-01, §8)
- [ ] Gateway pembayaran (ditunda user 2026-11-01; `TASKS.md` 6.2 terblokir sampai diputuskan)
- [ ] Layanan krisis terverifikasi dan persetujuan teks respons (draf ada di §7)
- [ ] Teks template pengingat WhatsApp dan persetujuannya dari Meta
- [ ] Bobot skor final setelah diuji pada contoh entri nyata
- [ ] ASK: metode pencarian. Usulan AI: pgvector di Supabase (tanpa vector database terpisah), karena pertanyaan user biasanya berupa parafrase dan bahasa campur yang sulit ditangkap pencarian kata kunci. Syaratnya model embedding lolos `data_collection: deny` dan cukup baik berbahasa Indonesia, dibuktikan dengan uji pada contoh pertanyaan nyata. Jika tidak lolos, pakai full-text Postgres
- [ ] ASK: model embedding dan env baru (mis. `AI_MODEL_EMBEDDING`, belum ada di daftar env `AGENTS.md` §4). Keluarga DeepSeek yang sudah diputuskan mungkin tidak menyediakan model embedding; ini harus dicek, bukan diasumsikan
- [ ] ASK: kuota dan cakupan riwayat per plan (usulan di §8)
- [ ] ASK: persetujuan menyimpan indeks pencarian sebagai data turunan baru (§9) dan revisi teks privasi
- [x] Belajar (LEARN, 2026-11-15): modul terpisah bernama "Belajar"; AI menilai hanya berdasarkan bahan; free 1 materi per akun dan pemeriksaan AI 1x per hari; premium materi tanpa batas dan 10x per materi per hari; tanpa filter krisis; data Belajar disimpan di database; Riwayat dan Laporan pindah ke tab di Progres; dikerjakan sebelum launch
- [x] Rate limit dan tabel `rate_limits` (2026-11-15), dengan syarat tidak mengganggu pemakaian normal (RATE-1 sampai RATE-3)
- [x] Ruang baca (READ, 2026-11-17): di menu Belajar; format PDF, EPUB, DOCX, TXT; tata letak asli penerbit lewat foliate-js dengan pilihan Gulir atau Geser, geser tanpa tombol, dan mode layar penuh; mode malam ikut Satu Persen, mode siang warna asli; tersambung ke Belajar lewat "Jadikan materi"; batas ikut pola Belajar (free 1 buku per akun, premium total 2 GB, 50 MB per file); salinan di browser boleh dan dihapus saat keluar; dikerjakan sebelum launch
