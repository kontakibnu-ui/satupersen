# DESIGN.md — arah dan aturan desain Satu Persen

> Versi 4 · 2026-11-08. Baca file ini sebelum mengerjakan tugas UI apa pun. Isinya keputusan terkunci.
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
| Uang | Sisa uang bulan ini (total pengeluaran sampai ada pemasukan) | Tambah pengeluaran | Tambah pemasukan (tombol sekunder), perbandingan dan grafik masuk lawan keluar, daftar transaksi, kategori, sisa budget |
| Progres | Angka rata-rata periode dan garis grafik | Tidak ada | Batang dimensi, "sejak mulai", tautan laporan dan riwayat |
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

Lebar maksimum konten: 640 px untuk Hari Ini, Riwayat, Kebiasaan, Uang, dan Akun; 960 px untuk Progres. Header melebar sampai 1120 px. Konten rata kiri.

**Navigasi dan rute**

| Label | Rute | Isi |
| --- | --- | --- |
| Hari Ini | `/today` | Menulis, mood, energi, centang kebiasaan, hasil analisa |
| Riwayat | `/history` | Kalender dan tulisan hari-hari sebelumnya |
| Kebiasaan | `/habits` | Kelola kebiasaan |
| Uang | `/expenses` | Pengeluaran dan budget |
| Progres | `/dashboard` | Grafik; dari sini juga membuka `/reports` |
| (lingkaran profil) | `/settings` | Profil, timezone, mode malam, WhatsApp, langganan, export, hapus akun |

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
| Hari Ini Riwayat Kebiasaan Uang Progres |
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
| Progres                            |  34, Fraunces
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
|                                    |
| Laporan                         >  |
| Riwayat                         >  |
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

**Bottom sheet tambah pengeluaran:** nominal di atas (fokus otomatis, keypad angka), 6 chip kategori, catatan opsional, satu tombol "Simpan". Target: selesai dalam 3 ketukan setelah mengetik nominal.

## 9. Mode krisis

Saat `risk_flag` aktif, layar berubah total: latar `surface-muted`, **tanpa cincin skor, delta, streak, atau elemen gamifikasi**, tanpa animasi. Isinya teks respons krisis (dari `crisis.ts`), satu tombol primary untuk menelepon layanan (tautan `tel:`, instruksi extension ditulis sebagai teks di bawahnya), tautan ke situs layanan, dan tautan "Lanjut menulis".

## 10. Landing page

**Versi 2026-11-01 (dirombak atas permintaan user: "lebih menarik dan interaktif"; arah komposisi dari skill taste-skill, arahan `one-motif`, dengan token, font, dan komponen tetap dari file ini).** Satu motif menjalankan seluruh halaman: lingkaran stempel "1%" dari logo. Ia muncul raksasa dan terpotong tepi layar di hero, sebagai dial kalkulator, sebagai penanda poin privasi, sebagai pemilih lama paket, dan sebagai cap penutup di atas footer.

Urutan: (1) hero: judul "Jadi 1% lebih baik tiap hari" (Fraunces 300 sampai 80 px, tanpa baris kecil di atasnya), satu kalimat penjelas, tombol primary "Mulai gratis", tautan "Lihat harga", dan pratinjau hasil analisa berlabel "Contoh"; (2) **satu hal hidup**: dial "Satu persen itu kecil", penggeser 1 sampai 365 hari yang menghitung 1,01 pangkat jumlah hari (dan 0,99 sebagai pembanding), dengan catatan "Ilustrasi cara kebiasaan kecil menumpuk, bukan janji hasil"; (3) cara kerja: tiga bidang warna bersebelahan, tiap bidang satu kalimat dan satu potongan antarmuka (tulis, analisa, skor); (4) fitur sebagai kalimat yang diakhiri sakelar sungguhan (kebiasaan, mood dan energi, pengeluaran, laporan Senin); bidang menyala berwarna dan menampilkan akibatnya dalam angka; (5) curhat lewat WhatsApp dengan contoh chat; (6) privasi tiga poin; (7) harga: dua bidang yang bertemu di tepi keras, Gratis (lebih sempit) dan Premium (lebih lebar) dengan pemilih 1, 3, 6, 12 bulan dari `src/config/plans.ts`; (8) tanya jawab sebagai kartu indeks bertab, satu terbuka sekaligus (`<details name>`); (9) pita penutup `primary` dengan "Mulai gratis" kedua; (10) cap besar "1%" dan nama, lalu footer. Semua potongan antarmuka dibangun dari komponen asli, diberi label "Contoh", dan ditandai `data-ui`. Header: logo, tautan bagian (layar 768 px ke atas), sakelar mode, tombol sekunder "Masuk". Tanpa foto dan ilustrasi stok.

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
