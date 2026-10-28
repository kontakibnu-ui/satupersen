# DESIGN.md — arah dan aturan desain Satu Persen

> Versi 1.1 · 2026-10-28. Baca file ini sebelum mengerjakan tugas UI apa pun. Isinya keputusan terkunci.
> Bila tugas UI bertentangan dengan file ini, ikuti file ini dan laporkan. Angka dan teks di wireframe hanya ilustrasi, bukan isi produk.

## 1. Arah desain

**Minimalis yang tenang dan hangat**, seperti buku jurnal pribadi. Bukan dashboard bank, bukan game. User menulis hal yang rapuh, jadi tampilan harus lapang dan tidak menghakimi.

Prinsip:

1. **Satu hal utama per layar.** Sisanya sengaja dibuat tenang (§2).
2. **Ruang kosong adalah alat utama.** Pisahkan bagian dengan jarak dan tipografi, bukan kotak dan garis.
3. **Hari buruk tidak boleh terlihat seperti kegagalan.** Tidak ada merah untuk skor, delta, atau status.
4. **Input secepat mungkin.** Selesai dalam 1 sampai 2 menit di HP, satu tangan.

Ciri visual: latar kertas hangat, satu warna aksen (hijau), tulisan diary bernuansa serif, hampir tanpa bayangan.

## 2. Hierarki dan penekanan

Aturan paling penting di file ini. Penekanan itu terbatas; kalau semua ditonjolkan, tidak ada yang menonjol.

**Anggaran per layar**
- Tepat **satu fokus**: elemen yang dilihat pertama. Hanya fokus yang boleh berukuran 28 px ke atas.
- Paling banyak **satu tombol primary** (latar `primary` penuh). Aksi lain berupa tombol sekunder atau tautan.
- Warna `primary` hanya untuk: fokus (bila fokusnya angka atau grafik), tombol primary, dan **penanda state kecil** (opsi terpilih, checkbox tercentang, tab aktif, item navigasi aktif). Tidak untuk judul, ikon dekoratif, latar kartu, atau teks biasa.
- Tebal (600) hanya untuk judul layar, judul bagian, dan angka fokus. Isi teks 400.
- Sisanya netral: `text`, `text-muted`, `border`.
- Kalau ragu apakah sesuatu perlu ditonjolkan: **jangan**.

| Layar | Fokus (satu) | Tombol primary | Sengaja dibuat tenang |
| --- | --- | --- | --- |
| Hari Ini, menulis | Area tulisan (lewat ukuran dan ruang, bukan warna) | Rangkum hari ini | Tanggal, mood dan energi, daftar kebiasaan, status simpan |
| Hari Ini, hasil | Angka skor | Tidak ada | Delta, alasan, daftar, "Untuk besok", tautan ubah tulisan |
| Kebiasaan | Daftar centang hari ini | "Tambah kebiasaan" hanya saat daftar kosong; selain itu tautan | Streak, identitas |
| Uang | Total bulan ini | Tambah pengeluaran | Daftar transaksi, kategori, sisa budget |
| Progres | Angka rata-rata periode dan garis grafik | Tidak ada | Batang dimensi, "sejak mulai", tautan laporan dan riwayat |
| Akun | Tidak ada | Tidak ada | Semuanya; "Hapus akun" berupa tautan kecil paling bawah |
| Mode krisis | Teks respons | Tombol telepon layanan | "Lanjut menulis" sebagai tautan |
| Landing | Judul hero | Mulai gratis (boleh diulang sekali di akhir halaman) | Semua bagian lain |

## 3. Token warna

Definisikan sebagai CSS variables bertema shadcn di `globals.css` (light dan dark). **Dilarang menulis hex di komponen**, pakai token. Hanya ada satu hue aksen.

| Token | Light | Dark | Dipakai untuk |
| --- | --- | --- | --- |
| background | #FBF8F3 | #16130F | Latar halaman |
| surface | #FFFFFF | #1F1B16 | Bottom sheet, dialog, menu |
| surface-muted | #F3EEE6 | #2A251F | Blok "Untuk besok", track batang, latar mode krisis |
| border | #E6DFD3 | #3A332B | Garis pemisah dekoratif saja |
| control | #8F8579 | #7A7064 | Garis tepi checkbox, radio, input, tombol sekunder |
| text | #221E1A | #F1EBE2 | Teks utama |
| text-muted | #6B635A | #A89F92 | Teks pendukung, ikon tidak aktif |
| primary | #2E6B4F | #6FBF95 | Lihat anggaran di §2 |
| primary-foreground | #FFFFFF | #0F1F17 | Teks dan ikon di atas `primary` |
| primary-soft | #E3F0E8 | #1E3328 | Latar chip kategori terpilih |
| danger | #B3412F | #E07A66 | **Hanya** hapus akun dan hapus data |
| danger-foreground | #FFFFFF | #1A0E0B | Teks di atas `danger` |

**Kontras yang sudah dihitung (WCAG 2.x, 2026-10-28):** text di background 15,6:1 · text-muted di background 5,6:1 (dark 7,1:1) · text-muted di surface-muted 5,1:1 (dark 5,8:1) · primary di background 6,0:1 (dark 8,4:1) · primary-foreground di primary 6,3:1 (dark 7,8:1) · control di background 3,4:1 (dark 3,8:1) · danger di background 5,3:1 (dark 6,3:1). Semua memenuhi AA. Token `border` sengaja rendah (1,25:1), jadi **dilarang** dipakai sebagai satu-satunya penanda batas kontrol interaktif; pakai `control`.

**Radius:** 10 px untuk tombol dan input, 12 px untuk blok dan sheet, penuh (pill) hanya untuk chip dan kontrol segmen.

## 4. Tipografi

- UI: **Plus Jakarta Sans**. Tulisan diary, judul layar, dan angka fokus: **Newsreader** (serif). Keduanya lewat `next/font/google`, `display: swap`. Dilarang menambah font lain.
- Skala (px): 12 (hanya label sumbu grafik dan label navigasi), 14 (pendukung), 16 (isi), 18 (editor diary), 24 (judul layar, Newsreader), 40 (angka fokus di Progres dan Uang, Newsreader), 56 (angka skor, Newsreader).
- Berat: 400 dan 600 saja. Line-height 1,5 untuk UI, 1,7 untuk editor. Panjang baris teks bacaan maksimal sekitar 70 karakter.
- Angka uang dan angka di daftar memakai `tabular-nums`. Format rupiah: `Rp 25.000` (locale id-ID). Tanggal: "Selasa, 28 Oktober" (id-ID).
- **Semua input minimal 16 px**, agar Safari iOS tidak memperbesar layar saat input difokus.

## 5. Layout dan responsif

**Breakpoint** (default Tailwind)

| Lebar | Navigasi | Konten |
| --- | --- | --- |
| Di bawah 768 px (HP) | Navigasi bawah 5 item, ikon dan label | Satu kolom, padding samping 16 px |
| 768 sampai 1023 px (tablet) | Rail kiri 72 px, ikon dan label kecil | Satu kolom di tengah |
| 1024 px ke atas (laptop) | Sidebar kiri 240 px | Satu kolom di tengah |

Lebar maksimum konten: 680 px untuk Hari Ini, Kebiasaan, Uang, dan Akun; 960 px untuk Progres. Jarak antar bagian 32 px di HP, 48 px di desktop.

**Navigasi dan rute**

| Label | Rute | Isi |
| --- | --- | --- |
| Hari Ini | `/today` | Menulis, mood, energi, centang kebiasaan, hasil ringkasan |
| Kebiasaan | `/habits` | Kelola kebiasaan |
| Uang | `/expenses` | Pengeluaran dan budget |
| Progres | `/dashboard` | Grafik; dari sini membuka `/history` dan `/reports` |
| Akun | `/settings` | Profil, timezone, tema, WhatsApp, langganan, export, hapus akun |

Item navigasi hanya muncul untuk halaman yang sudah jadi. Item aktif memakai `primary` untuk ikon dan label; yang lain `text-muted`.

**Aturan khusus HP**
- Pakai `min-h-dvh`, bukan `100vh`. Pasang `viewport-fit=cover` dan padding `env(safe-area-inset-*)` pada navigasi bawah dan tombol yang menempel.
- **Mode fokus menulis:** saat editor difokus di HP, navigasi bawah dan tombol yang menempel disembunyikan supaya keyboard tidak menutupi tulisan. Tampilkan tautan kecil "Selesai" di kanan atas untuk keluar dari editor.
- Editor tumbuh mengikuti isi (auto-grow); yang di-scroll halaman, bukan textarea.
- Target sentuh minimal 44 × 44 px dengan jarak minimal 8 px antar target.
- Tidak ada interaksi yang hanya lewat hover. Hover hanya pemanis.
- Tidak boleh ada scroll horizontal di lebar 360 px.
- Orientasi landscape memakai layout HP yang sama dan tetap harus bisa dipakai.

**PWA:** manifest (nama "Satu Persen", ikon 192 dan 512 px plus maskable, `display: standalone`, `theme_color` mengikuti mode) agar bisa dipasang di layar utama HP. Tanpa mode offline di MVP.

## 6. Komponen

- **Tombol.** Primary: latar `primary`, teks `primary-foreground`. Sekunder: tepi 1 px `control`, teks `text`. Tautan: teks `text`, garis bawah saat hover dan fokus. Tinggi 44 px di HP.
- **Cincin skor.** Diameter 160 px (HP) atau 184 px (desktop), garis 8 px. Track `border`, busur `primary` **berapa pun skornya**. Angka Newsreader 56 px warna `text`, dengan "/100" 14 px `text-muted`. Animasi isi sekali, 600 ms.
- **Delta.** Satu baris teks 14 px `text-muted` di bawah skor, **tanpa latar chip**. Ikon panah 16 px: naik berwarna `primary`, turun berwarna `text-muted`. Teks: "8% di atas rata-rata 7 harimu" atau "3% di bawah rata-rata 7 harimu". Jika `delta_pct` null: "Persen muncul setelah 3 hari menulis (2/3)".
- **Alasan skor.** Teks 16 px tepat di bawah delta, selalu terlihat (SCORE-3).
- **Kelebihan dan ruang tumbuh.** Judul bagian 14 px 600, item 16 px dengan titik kecil. Tanpa ikon centang hijau atau silang.
- **Blok "Untuk besok".** Latar `surface-muted`, radius 12, padding 16, label 14 px `text-muted`, kalimat 16 px. Tanpa warna aksen.
- **Mood dan energi.** Masing-masing satu baris: label 14 px, lalu 5 lingkaran 44 px berisi angka 1 sampai 5. Belum dipilih: tepi `control`, angka `text-muted`. Terpilih: isi `primary`, angka `primary-foreground`. Setelah dipilih, kata keterangan muncul di ujung baris dengan 14 px `text-muted`. Mood: Berat, Kurang, Biasa, Baik, Senang. Energi: Habis, Lelah, Cukup, Segar, Penuh. **Tidak memakai wajah, emoji, atau ilustrasi.**
- **Editor diary.** Tanpa kotak, langsung di atas latar. Newsreader 18 px. Placeholder `text-muted`: "Mulai dari satu kalimat: apa satu hal yang terjadi hari ini?". Fokus ditandai garis bawah 1 px `control`. Status simpan 14 px `text-muted`: "Menyimpan…", "Tersimpan", atau "Belum tersimpan, mencoba lagi". Penghitung karakter hanya muncul setelah 4.000 karakter.
- **Baris kebiasaan.** Checkbox 24 px di dalam area sentuh 44 px, tepi `control`; tercentang berisi `primary` dengan tanda centang `primary-foreground`. Nama 16 px, identitas 14 px `text-muted` di bawahnya, streak 14 px `text-muted` di kanan ("5 hari"). Tanpa coret dan tanpa ikon api.
- **Grafik garis.** Recharts, garis 2 px `primary`, tanpa area atau gradient, garis grid horizontal tipis `border`, titik hanya pada hari terakhir dan hari yang disentuh. Tooltip latar `surface`, tepi `border`.
- **Batang dimensi.** Track `surface-muted`, isi `text-muted` (netral, bukan `primary`), angka 14 px di kanan.
- **Input nominal.** Prefix "Rp", `inputmode="numeric"`, pemisah ribuan otomatis saat mengetik, `tabular-nums`.
- **Chip kategori.** Pilih satu. Belum dipilih: tepi `control`. Terpilih: latar `primary-soft`, teks `text`.
- **Bottom sheet (HP) dan dialog (768 px ke atas)** untuk form singkat. Judul 16 px 600, satu tombol primary di bawah. Hanya overlay yang boleh berbayangan.
- **Kalender riwayat.** Grid 7 kolom, sel 44 px. Hari dengan entri: titik 4 px `text-muted` di bawah angka. Hari ini: lingkaran tepi `control`. Hari terpilih: isi `primary`. Hari tanpa entri tanpa tanda apa pun.
- **Batas premium.** Muncul hanya saat user mencoba fitur premium: teks singkat di tempat itu plus tautan "Lihat Premium". Tanpa pop-up otomatis, banner permanen, atau hitung mundur.
- **Notifikasi.** Hindari toast. Tampilkan status di tempat aksi terjadi.

## 7. State layar Hari Ini

1. **Kosong:** placeholder editor. Jika "Rangkum hari ini" ditekan saat tulisan kosong, tampilkan petunjuk di bawah tombol: "Tulis minimal satu kalimat dulu". Tombol tidak dinonaktifkan.
2. **Menulis (HP):** mode fokus (§5).
3. **Merangkum:** tombol berubah menjadi "Merangkum…" dan tidak bisa ditekan; area hasil menampilkan skeleton dan teks "Sedang membaca harimu…". Tanpa progress bar palsu.
4. **Hasil:** hasil tampil di atas; tulisan dilipat di bawahnya dalam mode baca dengan tautan "Ubah tulisan".
5. **Tulisan berubah setelah dirangkum:** baris 14 px `text-muted` "Tulisanmu berubah sejak dirangkum", plus tautan "Rangkum ulang (sisa 1)". Jika kuota habis: "Rangkum ulang hari ini sudah terpakai".
6. **Gagal:** "Ringkasan gagal dibuat. Tulisanmu aman." plus tombol sekunder "Coba lagi".
7. **Krisis:** §9.

## 8. Wireframe (lebar 360 px)

**Hari Ini, menulis**
```
+------------------------------------+
| Selasa, 28 Oktober                 |  14, text-muted
| Gimana harimu?                     |  24, Newsreader
|                                    |
| Mood    (1)(2)(3)(4)(5)      Baik  |
| Energi  (1)(2)(3)(4)(5)            |
|                                    |
| Mulai dari satu kalimat: apa satu  |  editor tanpa kotak
| hal yang terjadi hari ini?         |
|                                    |
|                                    |
| Tersimpan                          |  14, text-muted
|                                    |
| Kebiasaan                          |  14, 600
| [x] Olahraga                5 hari |
| [ ] Baca 10 menit           2 hari |
|                                    |
| [        Rangkum hari ini        ] |  satu-satunya primary
+------------------------------------+
| Hari Ini  Kebiasaan  Uang  Progres  Akun |
+------------------------------------+
```

**Hari Ini, hasil**
```
+------------------------------------+
|              ( 78 )                |  cincin primary, angka text
|               /100                 |
|  ^ 8% di atas rata-rata 7 harimu   |  14, text-muted
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
| Progres                            |  24, Newsreader
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

Satu halaman: (1) hero dengan judul "Jadi 1% lebih baik tiap hari", satu kalimat penjelas, tombol "Mulai gratis"; (2) cara kerja dalam 3 langkah: tulis, dirangkum AI, lihat progresmu; (3) satu contoh hasil ringkasan berlabel "Contoh", teksnya ditulis manusia; (4) curhat lewat WhatsApp; (5) privasi dalam tiga poin; (6) harga gratis vs premium, hanya setelah harga final; (7) FAQ singkat dan footer dengan disclaimer. Visual memakai tangkapan layar asli produk setelah fiturnya jadi, bukan ilustrasi atau mockup karangan.

## 11. Nada tulisan

Pakai "kamu". Hangat, singkat, tidak menggurui. Tombol berupa kata kerja ("Rangkum hari ini", "Coba lagi", "Simpan"). Pesan kosong mengajak: "Belum ada entri. Mulai dari satu kalimat saja." Pesan error berkata apa yang terjadi dan apa yang bisa dilakukan, tanpa menyalahkan user. Tanpa tanda seru beruntun, jargon motivasi, atau klaim berlebihan ("Ubah hidupmu dalam 7 hari").

## 12. Larangan UI (pencegah tampilan generik)

- Gradient (di latar, tombol, atau teks), glassmorphism, blob, pola latar, ilustrasi stok, dan elemen 3D.
- Emoji dekoratif. Ikon sparkles, bintang, atau robot untuk menandai AI; label "AI-powered".
- Ikon di depan setiap judul atau setiap baris. Ikon hanya bila membawa makna (navigasi, panah delta, aksi). Satu set ikon: `lucide-react`, garis 1,5, ukuran 20.
- Membungkus setiap bagian dengan kartu, atau kartu di dalam kartu.
- Deretan 3 sampai 4 kartu statistik di atas layar.
- Lebih dari satu tombol primary atau lebih dari satu elemen 28 px ke atas per layar.
- Merah untuk skor, delta, budget, atau status. Merah hanya untuk hapus akun dan hapus data.
- Bayangan selain pada overlay (bottom sheet, dialog, menu).
- Teks kapital semua dengan jarak huruf lebar.
- Lorem ipsum, data contoh, angka palsu, testimoni palsu, atau jumlah pengguna palsu.
- Gamifikasi: lencana, level, konfeti, ikon api streak.
- Animasi berulang atau berdenyut, parallax, scroll yang dibajak.
- Mengubah token, font, atau komponen di file ini tanpa persetujuan user.

## 13. Aksesibilitas, gerak, dan verifikasi

- Semua kontrol punya label yang terbaca screen reader. Fokus keyboard terlihat jelas (ring 2 px `primary`).
- Informasi tidak boleh hanya lewat warna: delta selalu punya teks dan ikon, kontrol terpilih punya perubahan isi.
- Transisi UI maksimal 200 ms ease-out, tanpa pantulan. Cincin skor 600 ms. Semua animasi mati saat `prefers-reduced-motion`.
- Dark mode mengikuti sistem, dengan pilihan manual (Sistem, Terang, Gelap) di Akun.

**Verifikasi tugas UI (wajib, lihat juga `AGENTS.md` §2)**
1. `npm run test:ui` (Playwright + axe) di halaman yang disentuh, ukuran 360 × 640, 768 × 1024, dan 1280 × 800, mode terang dan gelap:
   - tidak ada scroll horizontal (`scrollWidth` tidak melebihi lebar layar);
   - axe tanpa pelanggaran `serious` atau `critical` (termasuk kontras dan label);
   - di 360 px, setiap tombol, tautan, dan input minimal 44 × 44 px.
2. AI **tidak boleh mengklaim tampilan sudah rapi** tanpa hasil tes di atas. Tampilan akhir dicek oleh user di HP-nya sendiri.
