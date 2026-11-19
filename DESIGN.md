# DESIGN.md — arah dan aturan desain Satu Persen

> Versi 5 · 2026-11-17. Baca file ini sebelum mengerjakan tugas UI apa pun. Isinya keputusan terkunci.
> Versi 5 "Meja Tulis" dipilih user (2026-11-17) dari tiga arah mockup (A Halaman Buku, B Meja Tulis, C Tinta Pekat), lalu dijabarkan menjadi wireframe 21 layar dan dikoreksi user. Palet satu tinta, huruf, dan aturan versi 4 tetap; yang baru adalah karakter dari benda dan coretan tangan: lembaran binder, catatan tempel, cap tinta, coretan pulpen, dan navigasi tab pembatas. **§14 menggantikan butir lama yang bertentangan dengannya**, dan memuat panduan untuk fitur atau menu baru (§14.6).
> Versi 4 "Buku tulis" dipilih user (2026-11-08) setelah audit UI dan perbandingan mockup (arah E2 di kanvas desain): user menilai versi 3 terasa generik, "terlalu warna warni", dan tidak suka angka tanggal besar Fraunces; yang dipertahankan atas permintaannya adalah menulis seperti di kertas bergaris dan ikon perasaan serta energi. Yang berubah: **satu tinta biru pulpen** untuk semua highlight (emas, sage, plum, dan lima warna mood dihapus; nama token lama tetap ada tetapi menunjuk ke tinta), kertas putih-gading dengan garis biru muda, huruf **Plus Jakarta Sans** (antarmuka dan judul) dan **Lora** (yang tertulis di kertas), kop "Hari / Tanggal" ala buku tulis sekolah menggantikan halaman kalender, mood dan energi tanpa kotak, kebiasaan bergaris tanpa chip api, dan hasil analisa satu lembar (angka selisih besar, strip 7 hari, analisa di garis buku). Keputusan user 2026-11-01 tetap: skor 0 sampai 100 tidak pernah tampil. Bagian di bawah yang menyebut emas, Fraunces, halaman kalender, atau warna per mood sudah diganti oleh catatan versi 4 di §3, §4, dan §6; layar selain Hari Ini menerima token dan huruf baru tetapi tata letaknya belum dirombak.
> Versi 3.1 dibuat atas permintaan user (2026-10-31: pengalaman menulis harus lebih nyaman dan fokus; kata "rangkum" diganti "analisa"; layar lain lebih sesuai fungsinya). Palet, font, dan arah visual versi 3 tetap. Panduan yang dipakai: skill `ui-ux-pro-max` (kategori produk "Diary & Journal App": kertas hangat, tinta redup, aksen per mood; aturan UX label terlihat, fokus tidak tertutup, panjang baris 65 sampai 75 karakter, AI diberi label jelas) dan referensi aplikasi menulis (mode fokus iA Writer, pertanyaan pemantik Apple Journal dan Stoic). Yang berubah: lembaran tulisan pindah ke atas, pemantik yang bisa diganti, bar menulis di HP, label "Analisa hari ini" pada hasil, Kebiasaan satu lembaran, Uang satu lembaran buku kas, dan Riwayat langsung melompat ke tulisan.
> Versi 3 dibuat atas permintaan user (2026-10-29: versi 2 "terlalu generik, tone warna terlalu kaku, typography terlalu biasa"; brand "minimalist namun aesthetic, ada kesan vintage, jangan terpaku"; profil di pojok kanan atas; mode siang dan malam yang bisa dinyalakan dan dimatikan, bawaannya siang). Panduan desain yang dipakai: skill resmi Anthropic `frontend-design` (hindari kombinasi bawaan seperti krem plus aksen terakota, kartu SaaS seragam, label kapital, dan animasi masuk di setiap bagian). Prinsip versi 1 dan 2 yang tetap: hari buruk tidak pernah merah, satu tombol primary per layar, aksesibilitas AA.
> Bila tugas UI bertentangan dengan file ini, ikuti file ini dan laporkan. Angka dan teks di wireframe hanya ilustrasi, bukan isi produk.

## 1. Arah desain

**Buku harian lama yang dicetak dua tinta.** Minimalis, tenang, dan sedikit vintage: kertas bertekstur halus, tinta biru-hitam seperti pulpen, dan satu tinta emas untuk hal yang patut diingat. Malam hari berganti menjadi langit indigo dengan teks krem seperti cahaya bulan dan emas yang sama. Bukan dashboard bank dan bukan game. User menulis hal yang rapuh, jadi tampilan tetap lembut dan tidak menghakimi.

Prinsip:

1. **Satu hal utama per layar.** Sisanya tenang (§2).
2. **Lembaran di atas kertas.** Bagian layar adalah lembaran kertas yang lebih terang, digambar dengan garis rambut tanpa bayangan. Lembaran tidak pernah di dalam lembaran.
3. **Satu elemen yang diingat.** Halaman kalender di atas Hari Ini (angka tanggal besar dalam Fraunces tipis) dan skor bergaya stempel. Selebihnya sengaja polos.
4. **Hari buruk tidak boleh terlihat seperti kegagalan.** Tidak ada merah untuk skor, delta, mood, atau status.
5. **Input secepat mungkin.** Selesai dalam 1 sampai 2 menit di HP, satu tangan: mood dan energi satu ketukan, tombol tambah langsung di bawah angka utama.
6. **Ramah dan manusiawi.** Sapaan sesuai waktu ("Selamat pagi"), pertanyaan yang memancing ("Gimana perasaanmu?"), dan ikon garis tipis yang membantu membaca.

Ciri visual: kertas `#EEEAE0` dengan butiran halus dan satu cahaya lembut di atas; lembaran `surface` bergaris rambut, radius 20 px; tinta biru-hitam sebagai `primary`; emas (`accent`) untuk streak, skor, dan penanda aktif; sage dan plum sebagai dua tinta pendamping yang tenang; judul, angka, dan tulisan diary dalam Fraunces; editor bergaris seperti buku tulis.

## 2. Hierarki dan penekanan

Aturan paling penting di file ini. Penekanan itu terbatas; kalau semua ditonjolkan, tidak ada yang menonjol.

**Anggaran per layar**
- Tepat **satu fokus**: elemen yang dilihat pertama. Selain judul layar dan halaman kalender di atas Hari Ini, hanya fokus yang boleh berukuran 34 px ke atas.
- Paling banyak **satu tombol primary** (latar `primary` penuh). Aksi lain berupa tombol sekunder atau tautan.
- Warna `primary` hanya untuk: fokus (bila fokusnya angka atau grafik), angka tanggal di Hari Ini, logo dan lingkaran profil, tombol primary, dan **penanda state kecil** (opsi terpilih, checkbox tercentang, tab aktif). Tidak untuk judul, ikon dekoratif, latar lembaran, atau teks biasa.
- Penekanan lewat ukuran dan huruf Fraunces, bukan tebal (§4). Isi teks 400.
- Sisanya netral: `text`, `text-muted`, `border`.
- Kalau ragu apakah sesuatu perlu ditonjolkan: **jangan**.

| Layar | Fokus (satu) | Tombol primary | Sengaja dibuat tenang |
| --- | --- | --- | --- |
| Hari Ini, menulis | Lembaran tulisan, langsung di bawah judul (lewat ukuran, posisi, dan ruang, bukan warna) | Analisa hari ini | Tanggal, pemantik, mood dan energi, daftar kebiasaan, status simpan |
| Hari Ini, hasil | Angka skor | Tidak ada | Delta, alasan, daftar, "Untuk besok", tautan ubah tulisan |
| Kebiasaan | Daftar centang hari ini | "Tambah kebiasaan" hanya saat daftar kosong; selain itu tautan | Streak, identitas |
| Uang | Sisa uang bulan ini (total pengeluaran sampai ada pemasukan) | Tambah pengeluaran | Tambah pemasukan (tombol sekunder), "Isi dari screenshot bank" (tautan), perbandingan dan grafik masuk lawan keluar, daftar transaksi, kategori, sisa budget |
| Progres (tab Grafik) | Angka rata-rata periode dan garis grafik | Tidak ada | Tab bagian, batang dimensi, "sejak mulai" |
| Progres (tab Riwayat, Laporan) | Kalender dan lembaran baca; laporan terbaru | Tidak ada | Tab bagian |
| Belajar | "Review hari ini" bila ada; selain itu daftar materi | "Tambah materi" hanya saat belum ada materi; selain itu tautan | Status tiap materi, batas paket, lembaran Ruang baca dan tautan "Unggah buku" |
| Materi, menjelaskan | Lembaran "Jelaskan dengan kata sendiri" | Periksa penjelasan | Bahan (tertutup), sisa pemeriksaan AI, ubah bahan, hapus |
| Materi, review | Daftar pertanyaan jatuh tempo | Lihat jawaban, lalu Simpan review (bergantian, satu per saat) | Umpan balik penjelasan, bahan, hapus |
| Materi, menunggu review | Umpan balik penjelasan | Tidak ada ("Jelaskan ulang" berupa tombol sekunder) | Daftar pertanyaan dan tanggal review, bahan, hapus |
| Pembaca (Ruang baca) | Halaman buku | "Jadikan materi", hanya saat ada teks yang diblok | Bar atas, panel Aa, posisi baca, hapus buku |
| Akun | Tidak ada | Tidak ada | Semuanya; "Hapus akun" berupa tautan kecil paling bawah |
| Mode krisis | Teks respons | Tombol telepon layanan | "Lanjut menulis" sebagai tautan |
| Landing | Judul hero | Mulai gratis (boleh diulang sekali di akhir halaman) | Semua bagian lain |

## 3. Token warna

Definisikan sebagai CSS variables di `globals.css` (siang dan malam, lewat `light-dark()`). **Dilarang menulis hex di komponen**, pakai token. Pengecualian yang dicatat: meta `theme-color` dan manifest PWA, yang hanya menerima warna harfiah (`THEME_COLOR` di `src/lib/theme.ts`).

**Mode siang dan malam.** Siang adalah bawaan untuk semua orang, **apa pun pilihan sistem**. Malam dipilih lewat sakelar di header (dan di Akun), disimpan di satu cookie `satupersen-theme` yang hanya berisi `light` atau `dark`, lalu server memasang kelas `dark` di `<html>` sejak byte pertama. Tidak ada kolom database untuk ini, karena ini preferensi tampilan, bukan data user.

**Versi 4: satu tinta.** Semua highlight memakai `primary` (tinta biru pulpen) atau `primary-soft`. Nama token lama `accent`, `plum`, `sage`, dan `mood-1..5` (beserta `-soft` dan `on-mood`) tetap ada di `globals.css` supaya layar lama tetap jalan, tetapi nilainya menunjuk ke `primary`, `primary-soft`, dan `primary-foreground`. Komponen baru memakai nama `primary` langsung.

| Token | Siang | Malam | Dipakai untuk |
| --- | --- | --- | --- |
| background | #F6F4EE | #14161B | Kertas halaman (dengan butiran `--grain` dan satu cahaya di atas) |
| surface | #FFFDF8 | #1C1F26 | Lembaran tulisan, sheet, dialog |
| surface-muted | #ECE9E1 | #262A33 | Track batang, skeleton, kontrol segmen, layar krisis |
| border | #E4E0D6 | #2F343E | Garis rambut lembaran dan pemisah baris (dekoratif saja) |
| rule | #D6DEEB | #2E3850 | Garis buku tulis (biru muda) di editor dan analisa, batang hari lain di strip minggu |
| rule-strong | #C5D0E3 | #3B4767 | Versi 5 (§14.5): garis margin lembaran binder, garis ganda kop dan kepala bagian, batang "Keluar", titik penanda tidak aktif. Dekoratif saja |
| control | #8A8577 | #7F8796 | Tepi checkbox, radio, input, tombol sekunder |
| text | #1F2330 | #E8E6E1 | Teks utama |
| text-muted | #5E6372 | #A3A8B5 | Teks pendukung, ikon tidak aktif |
| primary | #22355E | #A9BDE6 | Tinta: tombol primary, tulisan di kertas, pilihan terpilih, batang hari ini, logo. Lihat anggaran di §2 |
| primary-foreground | #FFFFFF | #14161B | Teks dan ikon di atas `primary` |
| primary-soft | #E9EDF5 | #263048 | Latar lembut: "Untuk besok", seleksi teks, chip |
| danger | #A3392B | #F0907F | **Hanya** hapus akun dan hapus data |

**Kontras yang sudah dihitung (WCAG 2.x, 2026-11-08, dengan skrip), siang / malam:** text di background 14,2 / 14,5 · text-muted di background 5,4 / 7,6, di surface 5,9 / 6,9, di surface-muted 4,9 / 6,0 · primary di surface 11,9 / 8,7, di background 11,0 / 9,6, di primary-soft 10,3 / 6,9 · text di primary-soft 13,3 / 10,5 · primary-foreground di primary 12,1 / 9,6 · control di background 3,3 / 5,0, di surface 3,6 / 4,6. Semua memenuhi AA. Token `border` dan `rule` sengaja rendah, jadi **dilarang** dipakai sebagai satu-satunya penanda batas kontrol interaktif; pakai `control`.

**Bayangan:** kertas tidak melayang. `shadow-card` hanya untuk kenop sakelar mode; `shadow-float` hanya untuk sheet, tooltip grafik, dan tombol "Selesai" yang menempel di mode fokus menulis. Lembaran dan tombol tanpa bayangan.

**Radius:** 16 px untuk input dan tile, 20 px untuk lembaran, 28 px untuk sheet, bulat penuh untuk tombol, chip, avatar, ikon, dan kontrol segmen.

## 4. Tipografi

- **Versi 4:** antarmuka, judul, dan angka besar: **Plus Jakarta Sans** (dirancang desainer Indonesia). Yang "tertulis di kertas" (tulisan diary, pemantik, isian kop Hari/Tanggal, teks analisa, "Untuk besok"): **Lora**. Keduanya lewat `next/font/google`, `display: swap`. Fraunces dan Instrument Sans sudah tidak dipakai. Pengecualian: **Newsreader** khusus untuk wordmark logo (§6, keputusan user 2026-11-10). Dilarang menambah font lain.
- Skala (px): 12 (label navigasi, kata di bawah ikon mood, label strip minggu), 14 (pendukung), 16 (isi, judul bagian), 18 (editor diary dan teks analisa, Lora, tinggi baris 34), 28 (judul layar, Plus Jakarta Sans 700), 44 (angka selisih di hasil analisa, Plus Jakarta Sans 700). Angka fokus di Progres dan Uang masih memakai token `text-focus` 48 px sampai layar itu dirombak. Tidak ada lagi angka tanggal 84 px.
- Berat: Plus Jakarta Sans 400 untuk isi, 600 untuk tombol dan label aktif, 700 untuk judul layar, judul bagian, dan angka besar. Lora 400; miring hanya untuk pemantik, isian kop Hari/Tanggal, dan "Untuk besok".
- Line-height 1,5 untuk UI, 1,2 untuk judul, 34 px untuk editor dan teks analisa (sama dengan jarak garis buku). Panjang baris teks bacaan maksimal sekitar 70 karakter.
- Angka uang dan angka di daftar memakai `tabular-nums`. Format rupiah: `Rp 25.000` (locale id-ID). Tanggal: "Selasa, 28 Oktober" (id-ID).
- **Semua input minimal 16 px**, agar Safari iOS tidak memperbesar layar saat input difokus.

## 5. Layout dan responsif

**Breakpoint** (default Tailwind)

Di semua ukuran ada **header**: logo di kiri; sakelar mode siang/malam dan **lingkaran profil (inisial nama) di pojok kanan atas**, yang membuka Akun. Header ditutup garis rambut.

| Lebar | Navigasi halaman | Konten |
| --- | --- | --- |
| Di bawah 1024 px (HP dan tablet) | Bar datar di bawah, 5 item ikon dan label, garis rambut di atasnya | Satu kolom, padding samping 16 px (24 px dari 768 px) |
| 1024 px ke atas (laptop) | Lima kata di tengah header | Satu kolom di tengah |

Lebar maksimum konten: 640 px untuk Hari Ini, Kebiasaan, Belajar, Uang, dan Akun; 960 px untuk ketiga tab Progres (Grafik, Riwayat, Laporan), supaya judul dan tab tidak bergeser saat berpindah tab. Di dalam tab Riwayat dan Laporan isinya tetap selebar 640 px, rata kiri. Header melebar sampai 1120 px. Konten rata kiri.

**Navigasi dan rute** (diubah 2026-11-15: Riwayat dan Laporan masuk ke tab Progres, slotnya untuk Belajar)

| Label | Rute | Isi |
| --- | --- | --- |
| Hari Ini | `/today` | Menulis, mood, energi, centang kebiasaan, hasil analisa |
| Kebiasaan | `/habits` | Kelola kebiasaan |
| Belajar | `/learn` | Materi, "Jelaskan dengan kata sendiri", review berjarak (PRD LEARN) |
| Uang | `/expenses` | Pengeluaran dan budget |
| Progres | `/dashboard`, `/history`, `/reports` | Tiga tab: Grafik, Riwayat (kalender dan tulisan lampau), Laporan |
| (lingkaran profil) | `/settings` | Profil, timezone, mode malam, WhatsApp, langganan, export, hapus akun |
| (dari Belajar) | `/read/[id]` | Pembaca Ruang baca (PRD READ), layar penuh tanpa header dan navigasi; dibuka sebagai dokumen baru, bukan navigasi di sisi klien, supaya CSP-nya sendiri berlaku |

Item Progres aktif di ketiga rutenya. Item Belajar mendapat **titik penanda** 8 px `primary` di pojok ikon (bar bawah) atau di samping kata (header) saat ada pertanyaan yang jatuh tempo hari ini, dengan teks tersembunyi ", ada review hari ini" untuk pembaca layar (LEARN-9). Titik ini penanda state kecil (§2), bukan angka dan bukan lencana.

Item aktif: teks `text` tebal **dan** `aria-current`, plus garis emas pendek (di atas ikon pada bar bawah, garis bawah pada header). Yang lain `text-muted`. Lingkaran profil aktif mendapat cincin emas.

**Aturan khusus HP**
- Pakai `min-h-dvh`, bukan `100vh`. Pasang `viewport-fit=cover` dan padding `env(safe-area-inset-*)` pada navigasi bawah dan tombol yang menempel.
- **Mode fokus menulis:** saat editor difokus di bawah 1024 px, navigasi bawah disembunyikan supaya keyboard tidak menutupi tulisan, dan **bar menulis** menempel di atas menutupi header: status simpan di kiri (14 px `text-muted`, "Tersimpan otomatis" sebelum ada perubahan) dan tautan "Selesai" di kanan untuk keluar dari editor. Bar berlatar `background` dengan garis rambut di bawah, tanpa bayangan dan tanpa blur. `scroll-padding-top` menjaga baris yang sedang ditulis tidak tertutup bar. Status di bar hanya untuk mata (`aria-hidden`); screen reader membaca status di bawah lembaran.
- Editor tumbuh mengikuti isi (auto-grow); yang di-scroll halaman, bukan textarea.
- Target sentuh minimal 44 × 44 px dengan jarak minimal 8 px antar target.
- Tidak ada interaksi yang hanya lewat hover. Hover hanya pemanis.
- Tidak boleh ada scroll horizontal di lebar 360 px.
- Orientasi landscape memakai layout HP yang sama dan tetap harus bisa dipakai.

**PWA:** manifest (nama "Satu Persen", ikon 192 dan 512 px plus maskable, `display: standalone`, `theme_color` warna kertas siang) agar bisa dipasang di layar utama HP. Meta `theme-color` halaman mengikuti mode yang sedang aktif. Tanpa mode offline di MVP.

## 6. Komponen

**Versi 4 (2026-11-08) untuk Hari Ini.** Butir-butir ini menggantikan butir lama dengan nama yang sama di bawah; butir lain tetap berlaku.

- **Kepala Hari Ini.** Tanpa halaman kalender dan tanpa angka tanggal besar. Judul layar "Gimana harimu, {nama}?" (Plus Jakarta Sans 28/700), di bawahnya satu baris 14 px `text-muted`: sapaan sesuai waktu dan, bila ada, "Sudah N hari kamu menulis beruntun." Tanpa chip api.
- **Kop Hari / Tanggal.** Di bagian atas lembaran tulisan, meniru kop buku tulis sekolah: label "Hari" dan "Tanggal" 14 px `text-muted`, isiannya Lora miring 18 px `primary` di atas garis titik-titik, ditutup garis `rule` 1,5 px. Ini satu-satunya tempat tanggal tampil di Hari Ini.
- **Lembaran tulisan.** Lembaran `surface` radius 20 dengan garis rambut, berisi kop, pemantik (Lora miring, tombol Shuffle 44 px), lalu editor: Lora 18 px berwarna `primary` di atas garis buku `rule` setiap 34 px, minimal 6 baris (8 dari 768 px). Status simpan di bawahnya. Fokus mengubah garis lembaran menjadi `primary`.
- **Mood dan energi.** Langsung di atas halaman, tanpa lembaran dan tanpa kotak per pilihan. Pertanyaan Plus Jakarta Sans 16/700 dengan kata terpilih di kanan (`primary`). Lima ikon garis lucide 24 px dengan kata 12 px di bawahnya; yang terpilih berada dalam lingkaran `primary` 40 px dengan ikon `primary-foreground` dan katanya tebal. Satu warna untuk semua tingkat.
- **Baris kebiasaan.** Judul bagian "Kebiasaan" 16/700 dengan "2 dari 3" di kanan, garis `border` di bawahnya. Baris 56 px dipisah garis rambut seperti buku, tanpa latar tercentang. Lingkaran centang 28 px: tepi `control`, tercentang berisi `primary`. Streak berupa teks 14 px `text-muted` ("5 hari"), tanpa chip dan tanpa api. Dipakai juga di halaman Kebiasaan.
- **Hasil analisa.** Satu lembaran, bukan tumpukan kartu: label "Analisa hari ini" dengan ikon Stamp; angka selisih dibanding hari berskor terakhir dalam Plus Jakarta Sans 44/700 `primary` ("+24%") berdampingan dengan kalimatnya ("Kamu 24% lebih baik dibanding kemarin"); **strip minggu** tujuh batang (enam hari sebelumnya `rule`, hari ini `primary`, hari tanpa analisa berupa garis tipis), tinggi mengikuti skor tetapi tanpa angka; alasan skor 16 px (SCORE-3); teks analisa, "Yang sudah bagus", dan "Ruang untuk tumbuh" ditulis di garis buku (Lora 18, `primary`, judul daftar Plus Jakarta Sans 14/700); "Untuk besok" di kotak `primary-soft` radius 16. Analisa pertama: ikon tunas dan kalimat "Ini analisa pertamamu…". Skor 0 sampai 100 tidak pernah tampil (keputusan user 2026-11-01). Stempel cincin tidak lagi dipakai di Hari Ini; landing masih memakainya sebagai contoh.
- **Tulisan yang dilipat.** Setelah dianalisa: judul "Tulisanmu" 16/700 dan tautan "Ubah tulisan" di kanan, lalu empat baris tulisan dalam Lora `primary`, tanpa lembaran.
- **Logo.** Wordmark saja, tanpa lingkaran "1%" (keputusan user 2026-11-10): "Satu Persen." dengan titik penutup, dalam **Newsreader** (token `font-wordmark`, satu-satunya pemakaian font ini) 22/500 di header, tracking -0,02em, warna `text`, titik ikut warna teks. Versi besar di atas footer landing memakai wordmark yang sama, 400, tanpa stempel. Tanpa ikon, gradasi, atau warna tambahan.

- **Lembaran (kartu).** `surface`, radius 20, garis rambut `border`, **tanpa bayangan**, padding 20 (24 dari 768 px). Kepala lembaran: ikon garis 18 px berwarna tinta plus judul 20 px Fraunces 500, item opsional di kanan.
- **Tombol.** Semua berbentuk pill dan minimal 48 px, **tanpa bayangan**. Primary: latar `primary`, teks `primary-foreground`. Sekunder: transparan dengan tepi `control`. Soft: `primary-soft` dengan teks `primary`, untuk aksi kedua yang tenang. Tautan: teks, garis bawah saat hover dan fokus. Ikon di dalam tombol boleh bila membantu (Plus, Stamp, Phone). Tanpa panah "→" di ujung teks tombol.
- **Header layar.** Judul 34 px Fraunces 400, satu kalimat penjelas opsional, satu baris kecil di atasnya bila perlu (tanggal). Tanpa label kapital.
- **Halaman kalender Hari Ini.** Pengganti header layar di Hari Ini: angka tanggal 84 px Fraunces 300 `primary`, nama hari miring 24 px, bulan dan tahun 14 px `text-muted`, chip streak di kanan, ditutup garis rambut. Di bawahnya sapaan ("Selamat sore, Ibnu.") lalu judul "Gimana harimu?". Ini satu-satunya animasi masuk di aplikasi.
- **Sakelar mode siang/malam.** Tombol `role="switch"` berlabel "Mode malam", area sentuh 44 px. Jalur 60 × 32 px `surface-muted` dengan matahari di kiri dan bulan di kanan; kenop 24 px `surface` dengan ikon emas bergeser ke pilihan aktif. Ada di header aplikasi, header landing, login, onboarding, halaman hukum, dan di Akun.
- **Lingkaran profil.** 36 px, latar `primary`, inisial nama (atau email) dalam Fraunces, di pojok kanan atas header. Nama aksesnya "Akun".
- **Judul hasil.** Di atas stempel, tengah: ikon Stamp emas 15 px dan "Analisa hari ini" 14 px `text-muted`, supaya jelas bahwa isinya dibuat AI.
- **Skor (stempel).** Diameter 160 px (HP) atau 184 px (desktop). Cincin luar 1 px emas, busur skor 7 px `accent` di atas track `surface-muted` **berapa pun skornya**, cincin dalam bertitik `control`. Di tengah: perubahan dibanding hari berskor terakhir, Fraunces 300 ("+2%" 48 px; empat karakter atau lebih 36 px), dengan "dari kemarin" miring di bawahnya. **Angka skor 0 sampai 100 tidak pernah tampil di stempel** (keputusan user 2026-11-01); busurnya saja yang mengikuti skor. Analisa pertama: ikon tunas dan "analisa pertama". Stempel kecil (di bawah 150 px) tanpa keterangan "dari ...". Stempel bersifat dekoratif (`aria-hidden`); kalimat di bawahnya yang dibaca pembaca layar. Animasi isi sekali, 600 ms.
- **Delta.** Chip 14 px di bawah stempel: naik berlatar `sage-soft` dengan panah `sage`, turun atau sama berlatar `surface-muted` dengan teks `text-muted`. Selalu berupa kalimat: "Kamu 2% lebih baik dibanding kemarin", "Turun 3% dibanding hari Kamis", "Stabil, sama seperti kemarin". Analisa pertama: "Ini analisa pertamamu. Mulai besok kamu bisa lihat perbandingannya."
- **Alasan skor.** Teks 16 px tepat di bawah delta, selalu terlihat (SCORE-3). Teks analisa di bawahnya dalam Fraunces 18 px.
- **Kelebihan dan ruang tumbuh.** Dua lembaran berdampingan dari 768 px: "Yang sudah bagus" dengan ikon jempol (`sage`), "Ruang untuk tumbuh" dengan ikon tunas (`plum`). Item 16 px dengan titik berwarna sama.
- **Blok "Untuk besok".** Latar `accent-soft` seperti stabilo, radius 20, ikon lampu dalam lingkaran `surface`, label Fraunces miring 18 px, kalimat 16 px.
- **Mood dan energi.** Satu lembaran, dua pertanyaan dalam Fraunces 18 px ("Gimana perasaanmu?", "Seberapa berenergi kamu?"), masing-masing lima tile 64 px dalam grid 5 kolom. Tile berisi ikon garis dan kata: Mood Berat (Frown), Kurang (Annoyed), Biasa (Meh), Baik (Smile), Senang (Laugh); Energi Habis (BatteryWarning), Lelah (BatteryLow), Cukup (BatteryMedium), Segar (BatteryFull), Penuh (Zap). Belum dipilih: garis rambut `border`, ikon `mood-n`. Terpilih: isi `mood-n`, ikon dan kata `on-mood`. Kata terpilih juga tampil di ujung baris pertanyaan. **Tanpa emoji dan tanpa wajah bergambar**; ikon garis lucide boleh.
- **Lembaran tulisan (editor diary).** Lembaran pertama di bawah "Gimana harimu?", tanpa judul lembaran (judul layar sudah bertanya). Di atasnya **pemantik**: satu pertanyaan Fraunces 18 px miring `text-muted` yang berganti tiap hari, dengan tombol ikon Shuffle 44 px berlabel "Pertanyaan lain" di kanan. Pemantik hanya petunjuk: tidak pernah masuk ke tulisan dan tidak ikut dianalisa. Editor tanpa kotak input sendiri, dengan garis buku tulis tipis (`paper-lines`, satu garis per baris), Fraunces 18 px berat 350, minimal 6 baris (8 dari 768 px), placeholder "Tulis bebas. Satu kalimat juga cukup untuk mulai." Fokus ditandai garis lembaran berubah menjadi `primary`. Di bawah editor: status simpan 14 px `text-muted` dengan centang saat "Tersimpan". Penghitung karakter hanya muncul setelah 4.000 karakter. Panjang baris di laptop sekitar 65 sampai 70 karakter (kolom 640 px).
- **Baris kebiasaan.** Lingkaran centang 28 px bertepi `control` di dalam baris 56 px; tercentang berisi `primary` dengan centang `primary-foreground`, dan barisnya berlatar `primary-soft` lembut. Nama 16 px 500, identitas 14 px `text-muted` di bawahnya, streak berupa chip `accent-soft` dengan ikon api kecil ("5 hari"). Tanpa coret.
- **Kemajuan kebiasaan.** Bukan lembaran sendiri: satu baris di bawah judul lembaran "Centang hari ini", berisi batang kemajuan polos `sage` 8 px dan teks 14 px "1/3 selesai" (atau "Semua beres hari ini"). Daftar centang tetap yang pertama terlihat.
- **Grafik garis.** Recharts, garis 2,5 px `primary` di atas area yang memudar dari `primary` 28% ke transparan, grid horizontal putus-putus `border`, titik hanya pada hari terakhir dan hari yang disentuh. Tooltip `surface`, radius 16, `shadow-float`.
- **Batang dimensi.** Track `surface-muted`, isi satu warna per bagian (kebiasaan `primary`, produktivitas `sage`, mood `plum`, keuangan `accent`), angka 14 px di kanan. Warna membedakan bagian, tidak menilai baik atau buruk.
- **Lembaran total Uang.** Lembaran biasa seperti buku kas: bulan dengan panah, "Sisa uang bulan ini" (masuk dikurangi keluar; "Total pengeluaran bulan ini" selama belum ada pemasukan) dengan angka 48 px Fraunces 300 `primary`, lalu "Masuk" dan "Keluar" 14 px di bawahnya, sisa budget dengan batang emas, dan tombol sekunder kecil "Atur budget". Tombol primary "Tambah pengeluaran" tepat di bawahnya.
- **Perkembangan uang.** Satu lembaran di bawah tombol tambah, tampil bila ada catatan dalam 6 bulan: dua kalimat perbandingan dengan bulan lalu (pengeluaran, sisa uang) berpanah naik atau turun dalam `text-muted`, tanpa merah atau hijau, lalu grafik batang Recharts: Masuk `primary`, Keluar `accent`, grid putus-putus `border`, tooltip seperti grafik garis. Legenda berupa teks; tabel tersembunyi menyajikan angka yang sama.
- **Daftar pengeluaran (buku kas).** Satu lembaran untuk seluruh bulan. Tiap hari satu bagian (judul hari 16 px 600 dan total hari di kanan), dipisah garis rambut, bukan lembaran per hari.
- **Input nominal.** Prefix "Rp", `inputmode="numeric"`, pemisah ribuan otomatis saat mengetik, `tabular-nums`.
- **Chip kategori.** Pilih satu, dengan ikon: Makan (Utensils), Transport (Bus), Kuliah atau kerja (GraduationCap), Hiburan (Clapperboard), Tagihan (Receipt), Lainnya (Ellipsis). Belum dipilih: tepi `control`. Terpilih: latar `primary-soft`, tepi dan teks `primary`. Di daftar, tiap pengeluaran memakai ikon yang sama dalam lingkaran lembut.
- **Kontrol segmen.** Wadah pill `surface-muted`; pilihan aktif menjadi pill `surface` dengan teks `primary` (periode Progres).
- **Bottom sheet (HP) dan dialog (768 px ke atas)** untuk form singkat. Radius 28, pegangan kecil di atas pada HP, judul 20 px Fraunces, satu tombol primary di bawah, latar belakang meredup dan kabur.
- **Navigasi.** Lihat §5: header di semua ukuran; di bawah 1024 px bar datar `background` 95% dengan garis rambut di atas; dari 1024 px lima kata di header.
- **Kalender riwayat.** Di dalam lembaran. Grid 7 kolom, sel 44 px bulat. Hari dengan entri: latar `primary-soft` dan titik `primary`. Hari ini: cincin 2 px `primary`. Hari terpilih: isi `primary`. Memilih tanggal langsung melompat ke lembaran baca di bawah kalender (`#entri`), yang berjudul tanggal dalam Fraunces 20 px; tulisan memakai huruf editor dengan panjang baris maksimal 65 karakter.
- **Batas premium.** Muncul hanya saat user mencoba fitur premium: teks singkat di tempat itu (boleh dalam lembaran dengan ikon gembok). Tanpa pop-up otomatis, banner permanen, atau hitung mundur.
- **Notifikasi.** Hindari toast. Tampilkan status di tempat aksi terjadi.

**Belajar dan tab Progres (2026-11-15).** Mengikuti versi 4: Plus Jakarta Sans untuk antarmuka, Lora berwarna `primary` di atas garis buku untuk apa pun yang ditulis user (penjelasan, jawaban) dan isi bahan.

- **Tab Progres.** Di bawah judul "Progres" pada ketiga rute: tiga tautan Grafik, Riwayat, Laporan dalam satu baris dengan garis rambut `border` di bawahnya. Tab aktif teks `text` 600 dengan garis bawah 2 px `primary` dan `aria-current="page"`; lainnya `text-muted`. Tinggi 44 px. Bentuknya sengaja beda dari kontrol segmen periode supaya dua pilihan itu tidak tertukar. Kartu "Laporan" dan "Riwayat" di bawah grafik dihapus karena digantikan tab.
- **Kepala Belajar.** Judul "Belajar", kalimat "Biar materi nempel, bukan cuma lewat."
- **Review hari ini.** Lembaran di atas daftar, hanya bila ada pertanyaan jatuh tempo. Tiap baris 56 px: judul materi 16/600 dan "3 pertanyaan menunggu" 14 `text-muted`, chevron di kanan, seluruh baris tautan ke materi.
- **Daftar materi.** Satu lembaran "Materimu", baris dipisah garis rambut. Status satu baris 14 `text-muted`: "Belum diperiksa", "Review berikutnya Kamis, 19 November", atau "Selesai, semua pertanyaan sudah nempel". Tanpa progress bar, lencana, atau persentase.
- **Keadaan kosong Belajar.** Lembaran berisi tiga langkah bernomor (tempel bahan, jelaskan dengan kata sendiri, jawab review dengan jarak 1, 3, 7, 14, lalu 30 hari) dan tombol primary "Tambah materi".
- **Batas materi free.** Teks 14 di tempat tautan "Tambah materi": "Paket gratis memuat 1 materi. Materi tanpa batas ada di Premium." dengan tautan "Lihat paket" ke `/settings/plan` (§6 Batas premium).
- **Form materi.** Label terlihat "Judul" dan "Bahan" (input 16 px). Bahan berupa textarea Lora bergaris yang tumbuh mengikuti isi, minimal 8 baris; penghitung "1.234 / 5.000" 14 `text-muted` selalu tampil. Satu tombol primary "Simpan materi".
- **Lembaran menjelaskan.** Judul "Jelaskan dengan kata sendiri", satu kalimat petunjuk 14 `text-muted`, lalu editor Lora bergaris seperti Hari Ini (minimal 6 baris). Di bawahnya tombol primary "Periksa penjelasan" dan satu baris sisa pemeriksaan AI hari ini. Saat memeriksa: tombol "Memeriksa…" nonaktif dan teks "Sedang membandingkan dengan bahanmu…", tanpa progress bar palsu.
- **Bahan tertutup.** `<details>` di lembaran sendiri berlabel "Lihat bahan", tertutup secara bawaan, isi Lora 16 dengan baris maksimal 65 karakter. Saat materi masih draf, ada tautan "Ubah bahan".
- **Umpan balik AI.** Satu lembaran. Label 14 `text-muted` "Diperiksa AI dari bahanmu" (tanpa ikon sparkles atau stempel), kalimat ringkas 16, lalu daftar "Sudah tepat", "Yang terlewat", "Perlu dicek lagi", dan "Tidak ada di bahanmu" (judul 14/700, titik `primary`, item 16), hanya yang berisi. Tanpa merah dan tanpa tanda silang: "Perlu dicek lagi" memakai titik yang sama.
- **Sesi review.** Satu lembaran "Review hari ini" berisi pertanyaan bernomor (16/600; pertanyaan elaborasi diberi keterangan 14 `text-muted` "Hubungkan dengan pemahamanmu"). Tiap pertanyaan punya textarea Lora bergaris berlabel "Jawabanmu" (minimal 3 baris). Setelah "Lihat jawaban": jawaban user jadi teks biasa, di bawahnya kotak `primary-soft` radius 16 "Menurut bahan", lalu radio "Seberapa ingat?" berbentuk kontrol segmen tiga pilihan Lupa, Ragu, Ingat (target 44 px, terpilih pill `surface` dengan teks `primary` dan tebal). Setelah tersimpan: tiap pertanyaan menulis tanggal review berikutnya ("Muncul lagi Kamis, 19 November" atau "Selesai"), lalu umpan balik AI per jawaban di bawah label "Diperiksa AI dari bahanmu".
- **Lembaran Ruang baca (2026-11-17, PRD READ).** Di bawah "Materimu", atau di bawah keadaan kosong Belajar. Judul "Ruang baca" dengan ikon `Library`. Tiap buku satu baris 56 px dipisah garis rambut: judul 16/600 satu baris, lalu "EPUB · 2,4 MB · 34%" 14 `text-muted` (persen hanya setelah pernah dibuka), chevron di kanan; seluruh baris tautan biasa ke `/read/[id]`. Di bawah daftar tautan "Unggah buku" (bukan primary) yang membuka pemilih file. Saat mengunggah, baris status 14 di tempat tautan: "Mengunggah Judul… 45%" dengan angka sungguhan, lalu "Memeriksa file…"; gagal: kalimat penyebab dan langkahnya, tanpa merah. Kosong: satu kalimat 14 `text-muted` "Unggah PDF, EPUB, DOCX, atau TXT untuk dibaca di sini, lalu jadikan bagian pentingnya materi." Batas free di tempat tautan: "Paket gratis memuat 1 buku. Buku lebih banyak ada di Premium." dengan tautan "Lihat paket"; premium yang hampir penuh: "Tersisa 120 MB dari 2 GB".
- **Pembaca.** Halaman setinggi layar (`h-dvh`) tanpa header dan navigasi aplikasi. **Bar atas** berlatar `surface` dengan garis rambut di bawah: tombol kembali ke Belajar, judul buku 14/600 satu baris dengan "EPUB · 2,4 MB" 12 `text-muted` di bawahnya, tombol layar penuh (ikon `Maximize`/`Minimize`), dan tombol "Aa"; semuanya 44 px. **Panel Aa** di bawah bar atas, latar `surface-muted`: baris "Cara baca" dengan kontrol segmen Gulir | Geser (terpilih berlatar `primary`; untuk PDF hanya Geser, dengan kalimat "PDF dibaca per halaman."), baris "Ukuran huruf" dengan tombol A− dan A+ (44 px, tepi `control`) dan angkanya, satu kalimat 12 `text-muted` "Pilihanmu diingat di perangkat ini.", dan paling bawah tautan kecil `danger` "Hapus buku" dengan konfirmasi di tempat seperti hapus materi. **Area buku** memenuhi sisa layar, tanpa tombol panah. **Bar bawah** berlatar `surface` dengan garis rambut di atas: posisi 12 `text-muted` ("Hlm 23 dari 212" atau "34%"); saat ada teks yang diblok, baris berganti "1.234 karakter terpilih" dan tombol primary "Jadikan materi" (di atas 5.000: "Terlalu panjang, maksimal 5.000 karakter" tanpa tombol). Tanpa blok teks, tidak ada tombol nonaktif.
- **Layar penuh.** Bar atas dan bawah bergeser keluar layar (250 ms, tanpa gerak bila `prefers-reduced-motion`); posisi baca 12 `text-muted` di pojok kanan bawah. Ketuk tengah memunculkan kedua bar selama 4 detik (tetap tampil selama panel Aa terbuka). Teks yang diblok memunculkan bar bawah saja.
- **Isi buku.** Mode siang: warna, huruf, dan tata letak dari file. Mode malam: teks `text` dan latar `background` mode malam disuntikkan ke buku (tautan `primary`); huruf dan tata letak tetap. DOCX dan TXT memakai Lora 18 bila tersedia, dengan cadangan serif perangkat. Halaman berpindah dengan animasi geser bawaan foliate-js, dimatikan bila `prefers-reduced-motion`.
- **State pembaca.** Memuat: "Membuka buku…" atau "Mengunduh buku… 45%" (angka sungguhan) di tengah, tanpa progress bar palsu. Gagal: "Buku ini tidak bisa dibuka. Mungkin filenya rusak atau terkunci DRM." dan tautan "Kembali ke Belajar". Buku tidak ada: "Buku ini tidak ada, atau sudah dihapus."
- **Hapus materi.** Tautan kecil `danger` paling bawah. Konfirmasi di tempat (bukan dialog): kalimat apa yang ikut terhapus, dan untuk free "Paket gratis hanya bisa membuat 1 materi, jadi setelah dihapus kamu tidak bisa menambah materi baru.", lalu tombol sekunder "Ya, hapus" dan tautan "Batal".

## 7. State layar Hari Ini

1. **Kosong:** pemantik dan placeholder editor. Jika "Analisa hari ini" ditekan saat tulisan kosong, tampilkan petunjuk di bawah tombol: "Tulis minimal satu kalimat dulu". Tombol tidak dinonaktifkan.
2. **Menulis (HP dan tablet):** mode fokus dengan bar menulis (§5).
3. **Menganalisa:** tombol berubah menjadi "Menganalisa…" dan tidak bisa ditekan; area hasil menampilkan skeleton dan teks "Sedang membaca harimu…". Tanpa progress bar palsu.
4. **Hasil:** analisa tampil di atas dengan judul "Analisa hari ini"; tulisan dilipat di bawahnya dalam mode baca dengan tautan "Ubah tulisan".
5. **Tulisan berubah setelah dianalisa:** baris 14 px `text-muted` "Tulisanmu berubah sejak dianalisa", plus tautan "Analisa ulang (sisa 1)". Jika kuota habis: "Analisa ulang hari ini sudah terpakai".
6. **Gagal:** "Analisa gagal dibuat. Tulisanmu aman." plus tombol sekunder "Coba lagi".
7. **Krisis:** §9.

## 8. Wireframe (lebar 360 px)

**Hari Ini, menulis**
```
+------------------------------------+
| Satu Persen.            [☀ ☾] (I) |  header: logo, sakelar, profil
|------------------------------------|
| 28  Selasa              (5 hari)   |  84 Fraunces 300 primary
|     Oktober 2026                   |  halaman kalender
|------------------------------------|
| Selamat sore, Ibnu.                |  16, text-muted
| Gimana harimu?                     |  34, Fraunces
| +--------------------------------+ |
| | Apa yang bikin harimu      [⇄] | |  pemantik, 18 miring, ganti
| | terasa lebih ringan?           | |
| | ______________________________ | |  editor bergaris, min 6 baris
| | ______________________________ | |
| | ______________________________ | |
| |                                | |
| | Tersimpan                      | |  14, text-muted
| +--------------------------------+ |
|                                    |
| Mood    (1)(2)(3)(4)(5)      Baik  |
| Energi  (1)(2)(3)(4)(5)            |
|                                    |
| Kebiasaan                          |  14, 600
| [x] Olahraga                5 hari |
| [ ] Baca 10 menit           2 hari |
|                                    |
| [        Analisa hari ini        ] |  satu-satunya primary
+------------------------------------+
| Hari Ini Kebiasaan Belajar Uang Progres |
+------------------------------------+
```

**Hari Ini, menulis (mode fokus di HP, keyboard terbuka)**
```
+------------------------------------+
| Tersimpan                  Selesai |  bar menulis, menutupi header
|------------------------------------|
| ...baris yang sedang ditulis_      |  tidak tertutup bar
|                                    |
|            [ keyboard ]            |  navigasi bawah disembunyikan
+------------------------------------+
```

**Hari Ini, hasil**
```
+------------------------------------+
|              ( +2% )               |  cincin emas, busur = skor, angka skor tidak tampil
|            dari kemarin            |
| ^ Kamu 2% lebih baik dibanding kemarin |  14, sage-soft (naik) / text-muted
|                                    |
| <score_reason>                     |  16
|                                    |
| Yang sudah bagus                   |  14, 600
|  . <strength>                      |
| Ruang untuk tumbuh                 |
|  . <improvement>                   |
|                                    |
| +--------------------------------+ |
| | Untuk besok                    | |  surface-muted, tanpa aksen
| | <tomorrow_tip>                 | |
| +--------------------------------+ |
|                                    |
| Tulisanmu hari ini   Ubah tulisan  |  tautan
+------------------------------------+
```

**Progres**
```
+------------------------------------+
| Progres                            |  28, judul layar
| Grafik   Riwayat   Laporan         |  tab bagian, aktif bergaris bawah primary
|------------------------------------|
| ( 7 hari | 30 hari | 1 tahun )     |  segmen, aktif = state kecil
|                                    |
| 74                                 |  40, fokus
| rata-rata 7 hari, 5% di atas       |  14, text-muted
| minggu lalu                        |
|   ___/\__/~~\___/~                 |  garis primary, satu-satunya warna
|                                    |
| Sejak mulai: 12% lebih baik        |  16, muncul setelah 14 hari berskor
|                                    |
| Kebiasaan  ########--  80          |  batang netral
| Mood       ######----  62          |
+------------------------------------+
```

**Uang**
```
+------------------------------------+
| Oktober                            |  14, text-muted
| Rp 1.245.000                       |  40, fokus
| Sisa budget Rp 255.000             |  14, text-muted (premium)
| [###################-----]         |  batang netral
|                                    |
| Hari ini                 Rp 45.000 |  14, 600
| Makan, makan siang       Rp 25.000 |
| Transport                Rp 20.000 |
| Kemarin                  Rp 80.000 |
|                                    |
| [       Tambah pengeluaran       ] |
+------------------------------------+
```
Lewat budget ditulis sebagai teks ("Lewat Rp 50.000 dari budget"), batang penuh tetap netral. Tidak merah.

**Bottom sheet tambah pengeluaran:** nominal di atas (fokus otomatis, keypad angka), 6 chip kategori, catatan opsional, tanggal (bawaannya hari ini, pemilih tanggal bawaan perangkat; EXP-8), satu tombol "Simpan". Target: selesai dalam 3 ketukan setelah mengetik nominal; tanggal hanya disentuh bila bukan hari ini. Bila tanggalnya di bulan lain, baris status di bawah lembaran total menulis "Tersimpan di Minggu, 15 November 2026." dengan tautan "Lihat bulan itu".

**Isi dari screenshot (EXP-7):** tautan dengan ikon ScanText di bawah dua tombol tambah, tidak bersaing dengan primary. Mengetuknya membuka pemilih gambar HP; sheet "Isi dari screenshot" lalu menampilkan status 16 px ("Menyiapkan pembaca gambar…", "Membaca tulisan di gambar… 45%" dengan angka progres sungguhan dari mesin OCR, "Merapikan hasilnya…"), dua garis skeleton `surface-muted`, dan satu kalimat 14 `text-muted` bahwa gambar tidak diunggah. Berhasil: sheet berganti judul "Cek hasil screenshot", kotak `surface-muted` radius 16 "Diisi dari screenshot. Cek nominal, jenis, dan tanggalnya dulu sebelum disimpan.", dua chip "Uang keluar" dan "Uang masuk", lalu form biasa yang sudah terisi dan satu tombol "Simpan". Gagal: kalimat penyebab dan langkahnya, tombol sekunder "Pilih gambar lain", dan tautan "Isi manual".

**Belajar**
```
+------------------------------------+
| Belajar                            |  28, judul layar
| Biar materi nempel, bukan cuma     |  16, text-muted
| lewat.                             |
| +--------------------------------+ |
| | Review hari ini                | |  fokus, hanya bila ada
| | Fotosintesis                 > | |  16/600
| | 3 pertanyaan menunggu          | |  14, text-muted
| +--------------------------------+ |
| +--------------------------------+ |
| | Materimu                       | |
| | Fotosintesis                 > | |
| | Review berikutnya Kamis, 19 Nov| |
| | Hukum Newton                 > | |
| | Belum diperiksa                | |
| +--------------------------------+ |
| Tambah materi                      |  tautan; primary hanya saat kosong
| +--------------------------------+ |
| | Ruang baca                     | |
| | Catatan Kecil tentang Ingatan> | |  16/600
| | EPUB · 2,4 MB · 34%            | |  14, text-muted
| +--------------------------------+ |
| Unggah buku                        |  tautan, membuka pemilih file
+------------------------------------+
```

**Pembaca (Ruang baca)**
```
+------------------------------------+
| <   Catatan Kecil tentang...  [] Aa|  bar atas, surface
|     EPUB · 2,4 MB                  |  12, text-muted
|------------------------------------|
| Cara baca        ( Gulir | Geser ) |  panel Aa, surface-muted
| Ukuran huruf      (A-)  17  (A+)   |  hanya saat dibuka
| Pilihanmu diingat di perangkat ini.|
| Hapus buku                         |  tautan kecil danger
|------------------------------------|
|                                    |
|   halaman buku, gaya penerbit      |  fokus; geser atau ketuk tepi
|                                    |
|------------------------------------|
| Hlm 23 dari 212                    |  bar bawah, 12, text-muted
+------------------------------------+
saat ada teks yang diblok:
| 214 karakter terpilih [Jadikan materi] |  satu-satunya primary
layar penuh: kedua bar disembunyikan, ketuk tengah untuk memunculkan
```

**Materi, menjelaskan (draf)**
```
+------------------------------------+
| < Belajar                          |  tautan kembali, 14
| Fotosintesis                       |  28
| Belum diperiksa                    |  14, text-muted
| +--------------------------------+ |
| | Jelaskan dengan kata sendiri   | |
| | Tutup bahannya, lalu tulis     | |  14, text-muted
| | seolah menjelaskan ke teman.   | |
| | ______________________________ | |  Lora bergaris, min 6 baris
| | ______________________________ | |
| | [     Periksa penjelasan     ] | |  satu-satunya primary
| | Sisa pemeriksaan AI hari ini: 1| |  14, text-muted
| +--------------------------------+ |
| +--------------------------------+ |
| | > Lihat bahan       Ubah bahan | |  details, tertutup
| +--------------------------------+ |
| Hapus materi                       |  tautan kecil danger
+------------------------------------+
```

**Materi, review**
```
+------------------------------------+
| Review hari ini                    |
| 1. Apa hasil fotosintesis?         |  16/600
|    ______________________________  |  Jawabanmu, Lora bergaris
| 2. Kenapa daun berwarna hijau?     |
|    Hubungkan dengan pemahamanmu    |  14, text-muted (elaborasi)
|    ______________________________  |
| [         Lihat jawaban          ] |  primary
+------------------------------------+
setelah "Lihat jawaban":
| 1. Apa hasil fotosintesis?         |
|    <jawabanmu>                     |
|  +------------------------------+  |
|  | Menurut bahan                |  |  primary-soft, radius 16
|  | Glukosa dan oksigen.         |  |
|  +------------------------------+  |
|  Seberapa ingat?                   |
|  ( Lupa | Ragu | Ingat )           |  kontrol segmen
| [         Simpan review          ] |  primary
setelah tersimpan:
|  Muncul lagi Kamis, 19 November    |  14, text-muted
|  Diperiksa AI dari bahanmu         |  14, text-muted
|  <umpan balik>                     |  16
```

## 9. Mode krisis

Saat `risk_flag` aktif, layar berubah total: latar `surface-muted`, **tanpa cincin skor, delta, streak, atau elemen gamifikasi**, tanpa animasi. Isinya teks respons krisis (dari `crisis.ts`), satu tombol primary untuk menelepon layanan (tautan `tel:`, instruksi extension ditulis sebagai teks di bawahnya), tautan ke situs layanan, dan tautan "Lanjut menulis".

## 10. Landing page

**Versi 2026-11-01 (dirombak atas permintaan user: "lebih menarik dan interaktif"; arah komposisi dari skill taste-skill, arahan `one-motif`, dengan token, font, dan komponen tetap dari file ini).** Satu motif menjalankan seluruh halaman: lingkaran stempel "1%" dari logo. Ia muncul raksasa dan terpotong tepi layar di hero, sebagai dial kalkulator, sebagai penanda poin privasi, sebagai pemilih lama paket, dan sebagai cap penutup di atas footer.

Urutan: (1) hero: judul "Jadi 1% lebih baik tiap hari" (Fraunces 300 sampai 80 px, tanpa baris kecil di atasnya), satu kalimat penjelas, tombol primary "Mulai gratis", tautan "Lihat harga", dan pratinjau hasil analisa berlabel "Contoh"; (2) **satu hal hidup**: dial "Satu persen itu kecil", penggeser 1 sampai 365 hari yang menghitung 1,01 pangkat jumlah hari (dan 0,99 sebagai pembanding), dengan catatan "Ilustrasi cara kebiasaan kecil menumpuk, bukan janji hasil"; (3) cara kerja: tiga bidang warna bersebelahan, tiap bidang satu kalimat dan satu potongan antarmuka (tulis, analisa, skor); (4) fitur sebagai kalimat yang diakhiri sakelar sungguhan (kebiasaan, mood dan energi, pengeluaran, laporan Senin); bidang menyala berwarna dan menampilkan akibatnya dalam angka; (5) curhat lewat WhatsApp dengan contoh chat; (6) privasi tiga poin; (7) harga: dua bidang yang bertemu di tepi keras, Gratis (lebih sempit) dan Premium (lebih lebar) dengan pemilih 1, 3, 6, 12 bulan dari `src/config/plans.ts`; (8) tanya jawab sebagai kartu indeks bertab, satu terbuka sekaligus (`<details name>`); (9) pita penutup `primary` dengan "Mulai gratis" kedua; (10) cap besar "1%" dan nama, lalu footer. Semua potongan antarmuka dibangun dari komponen asli, diberi label "Contoh", dan ditandai `data-ui`. Header: logo, tautan bagian (layar 768 px ke atas), sakelar mode, tombol sekunder "Masuk". Tanpa foto dan ilustrasi stok.

**Perbaikan 2026-11-14 (audit desain, disetujui user).** Butir ini menggantikan bagian di atas yang bertentangan dengannya:
- Huruf mengikuti versi 4 (§4): judul hero, judul bagian, kalimat langkah dan fitur, nama paket, harga, angka dial, dan angka stempel memakai Plus Jakarta Sans 700. Lora hanya untuk tulisan diary di contoh dan keterangan miring di stempel. Fraunces tidak dipakai lagi di landing.
- Cara kerja: tiga bidang tetap tiga warna di bawah satu tinta, yaitu `surface-muted`, `primary-soft`, dan `rule`.
- Fitur: keempat sakelar menyala sejak awal, sehingga pengunjung yang hanya menggulir membaca semua penjelasannya. Kalimat di bawah judul: "Semuanya bisa dipakai di paket gratis. Premium melonggarkan batasnya."
- Harga: dari 768 px kedua bidang berbagi baris (subgrid), sehingga nama paket dan harga sejajar. Isi paket berupa daftar pendek dengan centang `text-muted` (Premium diawali "Semua yang gratis, ditambah"), dan kuota token menautkan ke pertanyaan "Apa itu kuota AI bulanan?". Catatan "Pembayaran premium segera dibuka" berada tepat di bawah tombol "Pilih premium".
- Tanya jawab: rata kiri dengan bagian lain. Tab yang menjorok ke kanan hanya mulai 768 px.
- Footer: tautan Masuk, Privasi, dan Syarat layanan.

## 11. Nada tulisan

Pakai "kamu". Hangat, singkat, tidak menggurui. Tombol berupa kata kerja ("Analisa hari ini", "Coba lagi", "Simpan"). Fitur AI harian disebut **analisa** (menganalisa, dianalisa, analisa ulang), bukan "rangkum" atau "ringkasan". Pesan kosong mengajak: "Belum ada entri. Mulai dari satu kalimat saja." Pesan error berkata apa yang terjadi dan apa yang bisa dilakukan, tanpa menyalahkan user. Tanpa tanda seru beruntun, jargon motivasi, atau klaim berlebihan ("Ubah hidupmu dalam 7 hari").

## 12. Larangan UI (pencegah tampilan generik)

- Merah untuk skor, delta, mood, budget, atau status. Merah hanya untuk hapus akun dan hapus data.
- Gradien di teks, tombol, atau lembaran. Yang boleh hanya cahaya lembut di atas kertas dan area di bawah garis grafik.
- Glassmorphism: blur hanya untuk bar navigasi bawah dan latar sheet.
- Emoji, ilustrasi stok, maskot, elemen 3D, dan pola latar mencolok. Butiran kertas `--grain` yang nyaris tak terlihat adalah satu-satunya tekstur.
- Ikon sparkles atau robot dan label "AI-powered". Elemen AI memakai ikon stempel (Stamp) hanya di tombol "Analisa hari ini", status "Sedang membaca harimu", dan judul "Analisa hari ini" di atas hasil.
- Lembaran di dalam lembaran, dan deretan 3 sampai 4 kartu statistik kecil di atas layar.
- Lebih dari satu tombol primary atau lebih dari satu angka fokus per layar.
- Bayangan pada lembaran atau tombol (§3).
- Teks kapital semua dengan jarak huruf lebar, string meta yang disambung titik tengah ("A · B · C"), dan panah "→" di ujung tombol atau tautan.
- Lorem ipsum, data contoh tanpa label "Contoh", angka palsu, testimoni palsu, atau jumlah pengguna palsu.
- Gamifikasi yang menekan: lencana, level, konfeti, papan peringkat, atau pesan yang menyalahkan saat streak putus. Chip streak dengan ikon api kecil boleh, karena aturan "jangan bolos dua kali" sudah memaafkan satu hari terlewat.
- Animasi berulang atau berdenyut, parallax, dan scroll yang dibajak. Di dalam aplikasi, hanya halaman kalender Hari Ini yang naik sekali (360 ms). **Pengecualian landing (user, 2026-11-01):** tiap bagian landing naik sekali saat masuk layar (transform dan opacity, berjeda 60 sampai 160 ms), stempel hero "dicap" sekali saat halaman dibuka, kartu terangkat saat disentuh pointer atau fokus, dan busur dial mengikuti penggeser. Konten tidak pernah tersembunyi tanpa JavaScript. Semua gerak mati saat `prefers-reduced-motion`.
- Mengubah token, font, atau komponen di file ini tanpa persetujuan user.

## 13. Aksesibilitas, gerak, dan verifikasi

- Semua kontrol punya label yang terbaca screen reader. Fokus keyboard terlihat jelas (ring 2 px `primary`).
- Informasi tidak boleh hanya lewat warna: delta selalu punya teks dan ikon, kontrol terpilih punya perubahan isi.
- Transisi UI maksimal 200 ms ease-out, tanpa pantulan. Cincin skor 600 ms. Semua animasi mati saat `prefers-reduced-motion`.
- Mode siang adalah bawaan, apa pun pilihan sistem. Mode malam lewat sakelar di header dan di Akun (§3), diingat di cookie.

**Verifikasi tugas UI (wajib, lihat juga `AGENTS.md` §2)**
1. `npm run test:ui` (Playwright + axe) di halaman yang disentuh, ukuran 360 × 640, 768 × 1024, dan 1280 × 800, mode terang dan gelap:
   - tidak ada scroll horizontal (`scrollWidth` tidak melebihi lebar layar);
   - axe tanpa pelanggaran `serious` atau `critical` (termasuk kontras dan label);
   - di 360 px, setiap tombol, tautan, dan input minimal 44 × 44 px.
2. AI **tidak boleh mengklaim tampilan sudah rapi** tanpa hasil tes di atas. Tampilan akhir dicek oleh user di HP-nya sendiri.

## 14. Versi 5 "Meja Tulis" (2026-11-17)

Dipilih user dari tiga arah mockup, lalu dijabarkan menjadi wireframe 21 layar HP dan dikoreksi user. Wireframe acuan: https://claude.ai/artifact/DdKUfohKNt5JupsTwBxiS2 (privat, milik user). Bila wireframe dan teks ini berbeda, **teks ini yang berlaku**. Angka dan teks di wireframe hanya ilustrasi.

Tetap dari versi 4: palet satu tinta (§3), Plus Jakarta Sans untuk antarmuka, Lora untuk yang tertulis, Newsreader hanya untuk wordmark (§4), skor 0 sampai 100 tidak pernah tampil, hari buruk tidak pernah merah, satu tombol primary per layar (§2), dan aksesibilitas (§13).

### 14.1 Prinsip

1. **Karakter dari benda dan coretan tangan, bukan dari warna.** Kertas bertumpuk, catatan tempel, cap tinta, dan coretan pulpen, semuanya dalam satu tinta.
2. **Kertas hanya untuk yang ditulis atau dibaca sebagai catatan.** Grafik, pengaturan, dan isi buku tidak pernah diletakkan di atas kertas (user, 2026-11-17: grafik di atas kertas "aneh", Akun "jangan terlalu banyak kertas, yang relevan saja").
3. **Coretan hanya untuk poin highlight**: angka atau frasa kunci, **tidak pernah judul**. Paling banyak satu garis bawah coretan per blok, dan tidak pernah di teks yang sudah punya garis di bawahnya (user, 2026-11-17: garis di bawah judul "nabrak").
4. **Isi buku di Ruang baca tampil apa adanya dari file** (user, 2026-11-17: "itu perjanjian kita"). Gaya Satu Persen hanya berlaku di luar buku: bar atas, panel Aa, dan bar bawah.

### 14.2 Kapan memakai apa

| Wadah | Dipakai untuk | Tidak dipakai untuk |
| --- | --- | --- |
| Lembaran binder | Tulisan Hari Ini (termasuk mode fokus), hasil analisa, "Centang hari ini" di Kebiasaan, buku kas dan daftar catatan Uang, "Review hari ini" di Belajar, menjelaskan dan review materi, tulisan lampau di Riwayat, laporan terbaru | Grafik, Akun, Paket, WhatsApp, isi buku, sheet bawah, mode krisis |
| Kartu polos (`surface`, garis rambut, radius 14, tanpa lubang dan garis buku) | Grup status atau alat yang bukan catatan: kalender Riwayat, Perkembangan uang, kuota AI, nomor WhatsApp, bahan tertutup, paket Gratis di landing | Tulisan user |
| Langsung di halaman, dengan kepala bagian (§14.3) | Mood dan energi, kebiasaan di Hari Ini, Materimu, Ruang baca, Kelola kebiasaan, profil dan pengaturan Akun, isi Premium, laporan sebelumnya, grafik | |
| Catatan tempel | Pemantik, "Untuk besok", "Menurut bahan", "Fokus minggu ini" atau "Fokus bulan ini", pilihan paket premium | Tombol, peringatan, error |
| Cap tinta | Selisih di hasil analisa Hari Ini dan contohnya di landing | Angka lain |

### 14.3 Komponen

Butir-butir ini menggantikan butir §6 dengan nama yang sama.

- **Lembaran binder.** `surface`, garis rambut `border`, radius 14, padding 18 px (kiri 52 px), tanpa bayangan. Di kiri tiga lubang binder 14 px (isi `background`, tepi `border`): 64 px dari atas, di tengah, dan 64 px dari bawah. Garis margin ganda `rule-strong` (dua garis 1 px berjarak 2 px) 40 px dari tepi kiri. Di bawahnya dua lembar mengintip (masuk 5 dan 10 px dari sisi, turun 5 dan 10 px), `surface` bergaris rambut. Garis buku (`paper-lines`) dan garis ganda pemisah menembus sampai tepi lembaran. Fokus pada editor tetap mengubah garis lembaran menjadi `primary`. Menggantikan "Lembaran tulisan" versi 4 (radius 20).
- **Kop Hari / Tanggal.** Grid dua kolom di atas lembaran: label 14 `text-muted`, isian Lora miring 18 `primary` di atas garis titik `control`, ditutup garis ganda `rule-strong` 3 px. Varian Laporan: "Laporan / Periode".
- **Kepala bagian.** Judul 16/700 `text` di kiri, info 14 `text-muted` di kanan ("2 dari 3", "1 buku"), garis ganda `rule-strong` 3 px di bawah. Baris di bawahnya minimal 56 px, dipisah garis `rule` 1 px. Pola ini dipakai untuk semua bagian yang langsung di halaman.
- **Catatan tempel.** `primary-soft`, radius 3, miring -1°, padding 14 × 16 px, selotip `rule` 48 × 15 px (opasitas 85%, miring 2°) di tengah atas. Judul 14/700 `primary`, isi Lora miring 18 `text` (atau 16 `text` biasa untuk "Menurut bahan"). Tanpa bayangan. Di deret yang bisa digeser, kemiringan bergantian -1° dan +1°.
- **Cap tinta.** 112 px, miring -8°: cincin luar `primary` 2,5 px, cincin dalam titik-titik `primary` 1 px, selisih ("+4%") Plus Jakarta Sans 32/700 `primary`, "dari kemarin" Lora miring 13 `primary`. Kalimat delta 17/600 di sampingnya, dengan garis bawah coretan di bagian angkanya ("4% lebih baik"). Cap bersifat `aria-hidden`; kalimatnya yang dibaca. Analisa pertama: ikon tunas dan "Ini analisa pertamamu…", tanpa cap. Menggantikan angka 44 px di hasil analisa versi 4.
- **Coretan tangan.** SVG garis `primary`, ujung bulat, selalu dari bentuk di bawah. Jangan menggambar bentuk baru tanpa persetujuan user.

  | Bentuk | viewBox | path | Dipakai untuk |
  | --- | --- | --- | --- |
  | Garis bawah | `0 0 100 9`, `preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"` | `M1 6C18 2 30 7.5 49 4.5S82 2.5 99 5.5` | Angka atau frasa kunci. Tebal 1,6 sampai 2, tinggi 7 sampai 8 px, 3 px lebih lebar di tiap sisi, 5 px di bawah teks |
  | Lingkaran pilihan | `0 0 52 52` | `M27 4C15 3 5 12 4.5 25.5 4 39 13.5 48.5 26.5 48 39 47.5 48 38.5 48 26 48 13.5 39.5 5.5 25 3.5` | Mood dan energi terpilih (52 px), titik hari ini di grafik. Tebal 1,8 |
  | Centang | `0 0 32 30` | `M5 17c2.5 2 4.5 4.5 6 7.5C14.5 16 20 9 28 4` | Kotak kebiasaan, "Yang sudah bagus", isi Premium, poin privasi. Tebal 2,6 sampai 3 |
  | Lingkaran kecil | `0 0 24 24` | `M12.5 5C8 4.5 5 8 5 12s3 7.5 7.5 7 7-3.5 6.5-8S15.5 4.5 11 5.5` | "Ruang untuk tumbuh", "Pola yang terlihat", "Kaitan antar bagian". Tebal 2 |
  | Turus | `0 0 20 18` | 1 sampai 4 garis tegak `M3 2.5v13`, `M7 2v13.5`, `M11 2.5v13`, `M15 2v13.5`; hari kelima garis miring `M1 12.5 17.5 5` | Streak kebiasaan, di samping "5 hari" (warna `text-muted`, tebal 1,5) |

- **Mood dan energi.** Langsung di halaman. Ikon garis 24 px dan kata 12 px `text-muted`; terpilih: ikon dan kata `primary` 700, dilingkari coretan. Tanpa lingkaran berisi `primary`. Kata terpilih juga tampil di kanan pertanyaan dalam Lora miring `primary`.
- **Baris kebiasaan.** Kotak 26 px radius 6, tepi `control` 1,5 px. Tercentang: centang coretan `primary` yang keluar dari kotak (kotaknya tetap kosong). Nama 16 px; di halaman Kebiasaan, identitas Lora miring 14 `text-muted` di bawahnya. Di kanan turus dan "5 hari" 14 `text-muted`. Target sentuh seluruh baris, minimal 56 px.
- **Navigasi bawah: tab pembatas.** Garis `border` di atas bar. Item aktif berupa tab `surface` dengan tepi `border` di kiri, kanan, dan bawah, radius bawah 14, ikon dan teks `primary` 700, `aria-current`. Item lain `text-muted` 500. Titik penanda Belajar (§5) tetap. Menggantikan garis emas pendek di bar bawah. Lingkaran profil aktif mendapat cincin `primary` 2 px berjarak 2 px.
- **Tulisan yang belum terkirim (2026-11-18).** Setiap perubahan tulisan juga disimpan di browser sampai server menerimanya. Saat koneksi putus, status simpan menulis "Belum terkirim, aman di perangkat ini" (atau "Koneksi terputus, mencoba lagi" bila browser menolak menyimpan), lalu mencoba lagi sendiri dan langsung saat koneksi kembali. Saat Hari Ini dibuka dan tulisan di server masih sama dengan saat draf ditulis, draf langsung dipakai tanpa pemberitahuan. Bila tulisan hari ini sudah diubah di tempat lain, sebuah kartu polos muncul di atas lembaran tulisan: judul "Ada tulisan yang belum terkirim" 16/700, penjelasan 14 `text-muted`, cuplikan draf Lora 16 `text` (paling banyak 6 baris), tombol sekunder "Pakai tulisan ini" dan tautan "Tetap pakai yang tersimpan". Tidak ada tulisan yang dibuang tanpa user memilih.
- **Hasil analisa.** Satu lembaran binder, berurutan: label "Analisa hari ini" dengan ikon Stamp; cap tinta dengan kalimat delta; strip minggu (batang `rule`, hari ini `primary`, radius atas 3, hari tanpa analisa garis 2 px); alasan skor 16 px; garis ganda; teks analisa Lora 18 di garis buku; "Yang sudah bagus" (centang coretan) dan "Ruang untuk tumbuh" (lingkaran kecil), judul 14/700 di garis buku; lalu catatan tempel "Untuk besok". Di bawah lembaran: kepala bagian "Tulisanmu" dengan tautan "Ubah tulisan", lalu empat baris tulisan Lora `primary`.
- **Grafik.** Tidak pernah di atas kertas. Angka fokus 44/700 `primary`, kalimat perbandingan 14 `text-muted` dengan garis bawah coretan di angkanya ("5% di atas"). Garis 2,5 px `primary`, area di bawah garis `primary` 7% rata (tanpa gradasi), kisi putus-putus `border`, sumbu bawah `control`, titik hari ini 4 px dengan lingkaran coretan dan label "hari ini" Lora miring 14 `primary`. Batang dimensi: track `surface-muted`, isi `primary`, angka 14 `text-muted` di kanan. Grafik batang uang: Masuk `primary`, Keluar `rule-strong`; karena kontras batang Keluar rendah, legenda teks dan tabel tersembunyi tetap wajib (§6 Perkembangan uang).
- **Uang.** Buku kas di lembaran binder: bulan dengan panah 44 px, "Sisa uang bulan ini" 14 `text-muted`, angka rupiah 36/700 `primary` dengan garis bawah coretan, baris Masuk dan Keluar di bawah garis ganda, sisa budget dengan track, tautan "Atur budget". Lalu tombol primary "Tambah pengeluaran", sekunder "Tambah pemasukan", dan tautan "Isi dari screenshot bank". Perkembangan di kartu polos. Daftar catatan bulan ini di lembaran binder, satu kepala bagian per hari (total hari di kanan), ikon kategori dalam lingkaran `primary-soft` 36 px.
- **Pilihan paket premium (Akun > Paket dan landing).** Deret catatan tempel 262 px yang digeser ke samping (scroll-snap ke tengah); catatan berikutnya mengintip di tepi. Urutan 12, 6, 3, lalu 1 bulan. Isi catatan: lama paket Lora miring 20 `primary`, harga 34/700 `primary`, "Rp 16.583 sebulan, hemat 43%" 14 `text-muted` dengan coretan di "hemat 43%", lalu kalimat `note` paket. Harga, harga per bulan, dan persen hemat diambil dari `src/config/plans.ts` (`PREMIUM_PACKAGES`, `packageValue`), tidak ditulis tangan. Di bawahnya titik penanda 8 px (aktif `primary`, lainnya `rule-strong`) dan **satu** tombol primary yang labelnya mengikuti catatan yang tampil ("Pilih 12 bulan"), lalu "Pembayaran premium segera dibuka." Judul "Premium" polos. Di Paket, isi Premium berupa daftar centang coretan langsung di halaman di bawah tombol; di landing, paket Gratis berupa kartu polos dengan tombol sekunder "Mulai gratis".
- **Akun, Paket, WhatsApp.** Tanpa lembaran binder dan tanpa garis buku. Profil berupa form langsung di halaman dengan input biasa (Plus Jakarta Sans, bukan Lora), tombol sekunder "Simpan". Kuota AI dan nomor WhatsApp di kartu polos. "Hapus akun" tetap tautan kecil `danger` paling bawah.
- **Pembaca.** Area buku memakai warna, huruf, dan tata letak file, tanpa kertas, garis buku, Lora, atau warna tinta; seleksi teks memakai sorotan bawaan perangkat. Bar atas, panel Aa, dan bar bawah memakai gaya versi 5. Panel Aa tetap `surface-muted`.
- **Sheet bawah.** `surface`, radius atas 28, pegangan 40 × 4 px, latar meredup. Label terlihat 14/600, input radius 12 minimal 52 px tinggi, satu tombol primary, tautan "Batal" bila perlu.
- **Mode krisis.** Seperti §9: `surface-muted`, tanpa lembaran binder, catatan tempel, cap, coretan, atau turus.

### 14.4 Radius dan ukuran versi 5

Lembaran binder dan kartu polos 14, input 12, catatan tempel 3, kotak kebiasaan 6, sheet bawah 28 (atas), tombol dan chip bulat penuh. Judul layar 28/700; judul bagian 16/700; angka fokus 44/700 (rupiah 36/700, harga paket 34/700); teks 16; pendukung 14; label navigasi dan strip 12. Tombol primary 56 px, sekunder dan soft 48 px, target sentuh minimal 44 px.

### 14.5 Token tambahan

`rule-strong` (siang `#C5D0E3`, malam `#3B4767`) masuk ke tabel §3. Dekoratif saja, sama seperti `border` dan `rule`: dilarang sebagai satu-satunya penanda batas kontrol interaktif. Warna lain di wireframe yang tidak ada di §3 dipetakan ke token terdekat: garis bar navigasi dan tepi tab ke `border`, lubang binder ke `background` dan `border`, pegangan sheet ke `border`.

### 14.6 Untuk fitur atau menu baru

Sebelum menggambar atau menulis kode layar baru, jawab berurutan:

1. **Apakah user menulis, atau membaca catatan yang ditulis?** Ya: lembaran binder (kop Hari/Tanggal bila terikat ke tanggal). Grup status atau pengaturan: kartu polos, atau langsung di halaman dengan kepala bagian. Grafik dan data: langsung di halaman.
2. **Ada satu hal yang perlu diingat (saran, kutipan, fokus, jawaban acuan)?** Catatan tempel, paling banyak satu per blok.
3. **Apa angka atau frasa terpenting?** Boleh satu garis bawah coretan per blok, bukan di judul.
4. **Memilih satu dari beberapa?** Pilihan pendek: kontrol segmen. Pilihan yang masing-masing punya penjelasan dan harga: deret catatan tempel yang digeser, dengan satu tombol yang labelnya mengikuti.
5. **Daftar?** Kepala bagian lalu baris 56 px bergaris `rule`. Status selesai: centang coretan. Hitungan beruntun: turus.
6. Pakai token §3 dan komponen di atas. **Jangan menambah warna, font, bentuk coretan, atau wadah baru** tanpa persetujuan user. Tetap ikuti §2 (satu fokus, satu primary), §12, dan §13.

### 14.7 Larangan dan pengecualian versi 5

Menambah dan melonggarkan §12:
- Miring hanya untuk catatan tempel (±1°) dan cap tinta (-8°). Kemiringannya diam, tidak beranimasi.
- Lubang binder, garis margin, dan selotip hanya ada di lembaran binder dan catatan tempel; tidak pernah menjadi pola latar.
- Coretan tangan selalu SVG dari bentuk §14.3, bukan font tulisan tangan, gambar, atau emoji.
- Lembaran binder tidak boleh di dalam lembaran atau kartu lain. Catatan tempel boleh di dalam lembaran binder.
- Garis bawah coretan tidak boleh di judul atau di teks yang sudah bergaris bawah.

### 14.8 Belum diputuskan

Jangan dikerjakan atau ditebak sampai user memutuskan:
- Layar Masuk dan Onboarding masih memakai lembaran binder di wireframe. Belum diputuskan apakah ikut prinsip 2 (kertas hanya untuk catatan). (Contoh hasil di hero landing sudah diputuskan, lihat §14.9.)
- Garis bawah coretan pada frasa kunci di "Untuk besok" butuh AI menandai frasanya, yang berarti mengubah skema output AI (PRD). Sampai diputuskan, "Untuk besok" tanpa coretan.
- §6 "Isi buku" menyuntikkan warna mode malam ke buku, sedangkan prinsip 4 meminta isi buku tidak diubah. User perlu memilih salah satu.
- Mode malam versi 5 (lubang binder, selotip, cap, tab pembatas) dan tampilan laptop belum digambar.
- Layar yang belum digambar di wireframe: lupa dan reset password, form tambah materi, isi dari screenshot, tambah pemasukan, atur budget, halaman privasi dan syarat, serta keadaan kosong, memuat, dan gagal. Saat dibuat, ikuti §14.6.

### 14.9 Landing (keputusan user 2026-11-17)

User meminta landing "sesuai dengan wireframe". Untuk landing, **artboard Landing di wireframe yang berlaku**, menggantikan susunan §10 (stempel raksasa, dial bertombol, bidang warna cara kerja, kartu indeks tanya jawab, dan animasi masuk). Termasuk tiga hal yang di bagian lain §14 dibatasi:
- contoh hasil di hero berada di lembaran binder, dengan cap tinta "+4%" dan satu baris Lora di garis buku;
- judul hero "Jadi 1% lebih baik tiap hari" memakai garis bawah coretan di "1% lebih baik" (pengecualian prinsip 3, hanya di judul hero ini);
- "Satu persen itu kecil" memakai cap tinta ("37,8×", "setelah 365 hari") dengan satu penggeser hari. Cap ini miring **ke kanan 6°** (permintaan user 2026-11-17), pengecualian dari -8° di §14.7; cap hasil analisa tetap -8°.

Urutan: header (logo, sakelar mode, tombol sekunder "Masuk"), hero, Satu persen itu kecil, Cara kerja (kepala bagian, tiga baris dengan turus), Yang ikut dicatat (baris dengan sakelar sungguhan yang memperlihatkan penjelasannya), Curhat lewat WhatsApp (kartu polos berisi contoh chat), Privasi (centang coretan), Harga (Gratis di kartu polos, Premium berupa deret catatan tempel §14.3), Tanya jawab (baris yang terbuka di tempat), pita penutup `primary`, lalu wordmark besar dan tautan Masuk, Privasi, Syarat layanan. Teks yang di wireframe masih tanda kurung siku diisi dari landing sebelumnya; angka paket dari `src/config/plans.ts`.

**Lebar layar (user 2026-11-17: "plek ketiplek wireframe di HP jadi paksa di web padahal kamu sesuaikan aja").** Wireframe hanya menggambar HP. Di bawah 768 px landing mengikuti wireframe apa adanya. Dari 768 px potongan yang sama ditata untuk layar lebar dalam bingkai 1080 px: header dengan tautan bagian; hero dua kolom (judul sampai 60 px di kiri, contoh lembaran di kanan); cap "37,8×" 240 px di kiri dengan kalimat, penggeser, dan catatan di kanan; Cara kerja dan Privasi tiga kolom; Yang ikut dicatat dua kolom; WhatsApp teks dan contoh chat berdampingan; Harga: Gratis dan Premium berdampingan dari 1024 px, di baris yang sama (CSS subgrid) sehingga judul keduanya sejajar dan kartu Gratis setinggi grid catatan, berisi "Rp 0", daftar isi paket bercentang coretan (angka dari `plans.ts`), dan tombol di bawah (user 2026-11-17: kartu kecil "kaya aneh"); di bawah 1024 px kartu Gratis tetap seperti wireframe; tanya jawab selebar 760 px; pita penutup dan footer satu baris. Pilihan paket premium (di landing dan Akun > Paket) dari 768 px berupa grid 2 × 2 yang dipilih dengan mengetuk catatannya (catatan terpilih diberi cincin `primary`), karena di layar lebar tidak ada catatan "di tengah"; di HP tetap digeser. Setiap catatan berisi radio sungguhan.
