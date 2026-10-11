# ClassVIII.G — Website Edukasi Kelas VIII.G (SMP Negeri 18 Padang)

Website edukasi **white modern techno style** dengan login Google (Firebase v10 modular),
sidebar slide kanan, presensi QR real-time ke Google Spreadsheet, dan rekap absensi.

## 📁 Struktur File
| File | Fungsi |
|---|---|
| `index.html` | Seluruh layout/kotak **murni HTML** (dummy data hanya di HTML) + footer tiap menu |
| `style.css`  | White modern techno, animasi dots splash, typewriter, hover semua kotak, scanline kamera |
| `firebase.js`| Konfigurasi Firebase v10 module (Auth Google + Firestore realtime) |
| `backend.js` | Penghubung ke Google Apps Script (Spreadsheet) |
| `script.js`  | Logika: routing login persist, sidebar, presensi, tabel — hanya mengubah teks/status |
| `data.js`    | **HANYA data QR**: `{ qr:"KODE", nama:"Siswa" }` |
| `kode.gs`    | Kode Google Apps Script untuk Spreadsheet (3 sheet) |

## ⚙️ KONFIGURASI WAJIB (agar fitur ASLI bekerja, bukan simulasi)
### 1. Firebase (console.firebase.google.com)
1. Buat project → **Authentication → Sign-in method → Google: Aktifkan**.
2. **Firestore Database → Create**.
3. Tambahkan collection **`akun`**, dokumen ID = email siswa (contoh: `andi@siswa.padang.sch.id`)
   berisi `{nama:"..."}` → *hanya akun yang ada di sini yang bisa login; selain itu LOGIN GAGAL*.
4. Project Settings → Web app → salin config → tempel ke **`firebase.js`**.
5. Hosting domain harus terdaftar di *Authorized domains*.
6. Rules Firestore awal (untuk uji coba): `allow read, write: if request.auth != null;`

### 2. Google Spreadsheet + Apps Script
1. Buat Spreadsheet → pastikan ada 3 sheet: **HADIR**, **TIDAK HADIR**, **OPERATOR**
   (header dibuat otomatis oleh `kode.gs`). Sheet OPERATOR isi: `Nama | Email` operator yang boleh scan.
2. Extensions → **Apps Script** → tempel isi **`kode.gs`** → Deploy → *New deployment* → *Web app*
   → Execute as **Me**, Who has access **Anyone** → salin URL `/exec`.
3. Tempel URL ke **`WEB_APP_URL`** di `backend.js`.

### 3. Lokasi & Waktu Scan
- `script.js` → `SMP18 = { lat:-0.9167, lng:100.4077, radiusKm:1.5 }` → sesuaikan koordinat GPS SMPN 18 Padang (ambil dari Google Maps).
- Jendela scan terkunci **07.30–08.00**; lewat 08.00 hanya menu **Manual** (status Terlambat/Sakit/Izin).
- localStorage scan memakai key per tanggal → otomatis "reset pukul 07.29" (data hari-hari lama dihapus saat load).

### 4. Menjalankan Website
Karena memakai ES Module + kamera, **wajib via server / HTTPS**:
```bash
python3 -m http.server 8080     # lalu buka http://localhost:8080
```
(HTTPS dibutuhkan browser agar kamera & geolocation diizinkan — gunakan Firebase Hosting/GitHub Pages/Vercel.)

## 🔄 ALUR WEBSITE
1. **Splash dots** ±1,8 detik → cek sesi Firebase:
   - sudah pernah login → **langsung masuk tanpa form login**;
   - belum → halaman login (banner kiri 100vh desktop / atas 50vh mobile + kotak form kanan/bawah).
2. Centang **Kebijakan Privasi** → tombol **Masuk dengan Google** aktif (ikon fa-google) → popup Google.
   Akun harus ada di collection `akun` Firestore, jika tidak → peringatan login gagal.
3. Masuk → **navbar** (judul kiri, toggle kanan) → **sidebar slide kanan** (9 menu active-menu, layout beda tiap menu, footer di tiap menu).
4. **Presensi**: tab Scan QR (kamera besar + scanline, wajib operator + lokasi + jam) atau tab Manual
   (dropdown nama dari data.js + kode + Hadir/Tidak Hadir→alasan→kirim surat ke sheet).
   Hasil scan/manual → localStorage + POST ke Apps Script (sheet) + Firestore (realtime) → tabel ✓/× dan Kotak Langgar ter-update.
5. **Profil**: foto/huruf, nama, email, telepon, tgl lahir, status dicocokkan dari spreadsheet, tombol Ganti Akun (signOut).

## 🖌️ Library
Tailwind CDN · Font Awesome 6 · Firebase v10 modular · SweetAlert2 · html5-qrcode · Leaflet · font Urbanist.
