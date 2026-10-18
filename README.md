# PT. Fath Indah - Enterprise Internal Web Portal
### Pure Web Application (Bebas Google Apps Script) & Dual Database (Supabase + Google Sheets)

Aplikasi web portal internal modern dan komprehensif untuk operasional **PT. Fath Indah Tour & Travel**. Sistem ini telah dimigrasikan secara penuh menjadi **aplikasi web murni (Pure Web App)** tanpa ketergantungan pada runtime Google Apps Script (`google.script.run`), sehingga dapat dijalankan secara mandiri di komputer lokal, server Node.js, maupun di-host gratis di **GitHub Pages**, **Vercel**, atau **Netlify**.

---

## 🌟 Fitur Utama

1. **Aplikasi Web Murni (Bebas Apps Script)**
   - Dapat dibuka langsung di browser manapun tanpa memerlukan script editor Google Apps Script.
   - Dilengkapi runtime adapter bawaan (`dual-db-engine.js`) yang memetakan seluruh modul secara dinamis.
   - Arsitektur berbasis **Tailwind CSS**, **Alpine.js**, **Chart.js**, **SweetAlert2**, dan **SheetJS / XLSX**.

2. **Dukungan Dual Database (Bisa Beralih Kapan Saja)**
   - **Supabase (PostgreSQL Cloud)**:
     - Project URL: `https://utqexpkwtatwzknjftpx.supabase.co`
     - Mendukung tabel `users` (34 akun resmi karyawan) dan `absensi` (465+ riwayat presensi GPS realtime).
   - **Google Sheets (Live Spreadsheet)**:
     - Target Spreadsheet ID: `1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s`
     - DashProg Spreadsheet ID: `1kItrJaXUdzvq6WlM6xoslUk7LWTWQGokmBQLBxAIqCg` (GID: 1483869261)
     - Data dibaca secara realtime via Google Visualization JSONP / API Proxy.
   - **Peralihan 1-Klik**:
     - Pengguna dapat memilih database aktif langsung melalui pill indikator di bar atas (`🟢 Supabase` / `📊 Google Sheets`) maupun di layar login.

3. **Mode Mobile Phone (Responsif Penuh untuk Smartphone)**
   - **Slide-over Drawer Menu**: Sidebar berubah menjadi drawer sentuh halus dengan tombol hamburger di ponsel.
   - **Bottom Navigation Bar**: Tombol akses cepat di bagian bawah layar ponsel untuk Dashboard, Presensi GPS, Data Jamaah, Cuti, dan Menu.
   - **Mobile Card View**: Data absensi dan data jamaah dilengkapi tombol beralih antara tampilan Tabel Lebar dan Kartu Stream yang nyaman dibaca di smartphone.
   - Area sentuh minimal 44px dengan fluid typography.

4. **Format Tanggal Normal (Tanpa Zone/WIB)**
   - Seluruh tanggal dan jam menggunakan format lokal standar (`YYYY-MM-DD`, `DD MMMM YYYY`, atau `HH:mm:ss`) tanpa pergeseran zona waktu atau paksaan label WIB yang membingungkan.

5. **Kesiapan GitHub & Server Lokal**
   - Disertai `server.js` ringan tanpa dependensi external untuk dijalankan langsung via `npm start`.
   - Siap di-push ke GitHub dan diaktifkan melalui **GitHub Pages** hanya dalam beberapa klik.

---

## 🚀 Panduan Menjalankan Secara Lokal

### Prasyarat
- Komputer telah terpasang **Node.js** (versi 16 atau lebih baru).

### Langkah Menjalankan:
1. Buka terminal / command prompt pada folder proyek:
   ```bash
   cd "d:\PROJECT AI\PrjMenuFathIndah"
   ```
2. Jalankan server lokal:
   ```bash
   npm start
   ```
   *(Atau bisa juga langsung mengetik: `node server.js`)*
3. Buka browser dan akses tautan lokal:
   ```
   http://localhost:3000
   ```
4. **Untuk mencoba di smartphone melalui jaringan Wi-Fi lokal**:
   - Cari IP lokal komputer Anda (misal `192.168.1.15`).
   - Buka browser di smartphone Anda dan ketik: `http://192.168.1.15:3000`.

---

## 🐙 Panduan Install & Deploy ke GitHub (GitHub Pages)

Aplikasi ini dirancang sebagai SPA statis murni sehingga dapat di-hosting secara gratis di **GitHub Pages**:

1. **Buat Repository Baru di GitHub**:
   - Buka [github.com](https://github.com/) dan buat repository baru (contoh: `fath-indah-portal`).
   - Pilih visibilitas **Public** atau **Private**.

2. **Inisialisasi Git dan Push dari Komputer**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Pure Web App Dual DB (Supabase & Google Sheets)"
   git branch -M main
   git remote add origin https://github.com/<USERNAME-GITHUB-ANDA>/fath-indah-portal.git
   git push -u origin main
   ```

3. **Aktifkan GitHub Pages**:
   - Masuk ke tab **Settings** di repository GitHub Anda.
   - Pilih menu **Pages** di sebelah kiri.
   - Pada bagian **Build and deployment > Source**, pilih **Deploy from a branch**.
   - Pilih branch `main` dan folder `/ (root)`, lalu klik **Save**.
   - Dalam 1-2 menit, GitHub akan memberikan link website aktif Anda (misal: `https://<username>.github.io/fath-indah-portal/`).

---

## 🔑 Akun Login Bawaan

### 1. Akun Administrator (Google Sheets & Local Master)
| Username | Password | Role | Keterangan |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | Administrator | Akses penuh seluruh 35 modul |
| `manager` | `manager123` | Manager | Akses manajemen & persetujuan |

### 2. Akun Karyawan Resmi di Supabase (34 Karyawan)
Saat mode database **Supabase** aktif, Anda dapat langsung login menggunakan `User ID` karyawan resmi PT Fath Indah:
| User ID | Nama Karyawan | Jabatan | Password Default |
| :--- | :--- | :--- | :--- |
| `Miftah` | MIFTAHUL MAULANA | HRD, Legal, IS QA | `0811145185` |
| `Kadari` | H. KADARI DAMIN | Direktur Utama | `0811145185` |
| `Tiyo` | PRASTIYO | Direktur Operasional | `0811145185` |
| `Siska` | SISKA KARTIKA | Sales Operation | `0811145185` |
| `Imam` | IMAM BUKHORI | Marketing | `0811145185` |
| `Amir` | AMIR YUSUF FAISAL | Ope & Handling | `0811145185` |
| `Rian` | RIAN PURNAMA RASYID | Pricing Officer | `0811145185` |
| `Bagas` | BAGAS RAHMAT DANI | Staf Pengadaan | `0811145185` |
| *(dan seluruh 34 karyawan lainnya)* | | | *(Nomor telepon masing-masing)* |

---

## 📁 Struktur Berkas Proyek

```
PrjMenuFathIndah/
├── index.html            # Aplikasi Web Utama (Standalone & Lengkap 35 Modul)
├── dual-db-engine.js     # Engine Dual Database (Supabase + Google Sheets & GAS Bridge)
├── server.js             # Local Web Server Node.js (Zero-dependency http://localhost:3000)
├── package.json          # Konfigurasi npm script (npm start, npm run dev)
├── .gitignore            # Konfigurasi ignore file saat push ke GitHub
├── README.md             # Dokumentasi Lengkap Proyek
└── [Views & Managers]    # Berkas sumber komponen modular (tersinkronisasi ke index.html)
```

---

## 🛠️ Modul yang Tersedia (35 Modul)

1. **Dashboard & HR Analytics**: Ringkasan karyawan, rasio gender, statistik umur, status aktif.
2. **Presensi Kehadiran GPS**: Absen Datang, Absen Pulang, Izin, dan Riwayat Koordinat Google Maps.
3. **Rekap & Data Absensi**: Matriks kehadiran bulanan (H, S, I, A, P, C) dan stream kartu absensi.
4. **Data Jamaah Umrah & Haji**: Formulir pendaftaran, rekapitulasi data jamaah, ekspor excel.
5. **Rooming List & Penempatan**: Alokasi kamar hotel Makkah & Madinah (Quad, Triple, Double).
6. **Pembayaran & Cetak Kwitansi**: Riwayat pembayaran cicilan jamaah, sisa saldo, kwitansi PDF.
7. **Input Hotel & Katalog Brosur**: Master harga beli/jual kamar hotel di Makkah & Madinah.
8. **Input Data Penerbangan (Flight)**: PNR code, alokasi block seat, maskapai, jadwal keberangkatan.
9. **Cost Structure Paket**: Simulasi perhitungan HPP, faedah keuntungan, dan harga jual paket umrah.
10. **Pengajuan & Rekap Cuti**: Pengajuan cuti tahunan, sakit, melahirkan, serta kalender cuti bersama.
11. **Slip Gaji Karyawan**: Tinjauan dokumen slip gaji karyawan berdasarkan role.
12. **Program Umrah (DashProg)**: Monitoring kuota seat program dari kanwil dan cabang.
13. **Angsuran Haji & SPPH**: Input porsi SPPH haji khusus, jadwal angsuran bank, dan status BIPIH.
14. **Manajemen Pengguna & Registry Modul**: Kontrol hak akses role dan pengaktifan modul.

---

## 📄 Hak Cipta
&copy; 2026 PT. Fath Indah Tour & Travel. Dikembangkan oleh Tim IT & HRD.
