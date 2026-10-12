# ClassVIII.G — Website Edukasi Kelas VIII.G (SMP Negeri 18 Padang)

Website **white modern techno style** dengan login Google (Firebase v10 modular), sidebar slide kanan,
presensi QR **real-time** ke Google Spreadsheet, dan rekap absensi. Semua fitur nyata — tanpa simulasi.

## 📁 Struktur File
| File | Isi |
|---|---|
| `index.html` | Seluruh layout/kotak **murni HTML** (dummy data hanya di HTML) + `<footer>` di tiap menu |
| `style.css`  | White modern techno: animasi dots splash, typewriter caret, scanline kamera, **hover semua kotak** |
| `firebase.js`| Firebase v10 module (Auth Google + Firestore realtime) — ⚙️ paste config Anda |
| `backend.js` | Penghubung ke Google Apps Script (`WEB_APP_URL`) |
| `script.js`  | Logika murni: routing sesi, sidebar, presensi — **hanya mengubah teks/class**, tidak membuat kotak dari JS |
| `data.js`    | **HANYA data QR**: `{ qr:"KODE", nama:"Nama Siswa" }` — selain itu tidak ada |
| `kode.gs`    | Apps Script backend — saat RUN langsung **otomatis create Spreadsheet** |

Library: Tailwind CDN · Font Awesome 6 (ikon google `fa-brands fa-google`) · Firebase v10 · SweetAlert2 · html5-qrcode · font Urbanist.

---

## 🔄 ALUR WEBSITE
1. **Splash loading dots** ±1,8 detik → cek sesi Firebase (`browserLocalPersistence`):
   - sudah pernah login → **langsung masuk, TANPA form login lagi**;
   - belum → halaman login: desktop = banner kiri `height:100vh` + kotak form kanan; mobile = banner atas 50vh + form bawah.
2. Form login email+password gaya umum → centang **Kebijakan Privasi** (bisa klik popup isi kebijakan) → tombol **Masuk dengan Google** aktif → popup OAuth Google (akun Google Classroom). Email harus cocok dengan input & **harus terdaftar di collection `akun` Firestore** — jika tidak → peringatan *"Email atau password yang salah/kosong / akun belum ditambahkan"* (SweetAlert).
3. Masuk → **navbar** judul kiri + **toggle kanan** → **sidebar slide dari kanan** berisi 9 menu active-menu (layout tiap menu berbeda, footer di bawah tiap menu).
4. **Beranda**: kotak `height:100vh` — "Selamat datang di kelas VIII.G" + animasi ketik-hapus 5 kalimat, penjelasan, tombol *Lihat Selengkapnya* & *Umpan Balik* (style beda semua; desktop center, mobile rata kiri). Di bawahnya bagian **Tentang** + **kotak Visi dan Misi terpisah** yang bisa ditekan (expand).
5. **Presensi**: tab **Scan QR** / **Manual**. Scan hanya boleh: jam **07.30–08.00** + email ada di sheet **OPERATOR** + GPS di radius **SMPN 18 Padang**. Kode QR dicocokkan dengan `data.js`; 1 siswa = 1×/hari (localStorage key per tanggal → reset otomatis besok ≈07.29). Lewat 08.00 → wajib Manual (Terlambat/Sakit/Izin + alasan surat → sheet). Hasil tersimpan: localStorage + Firestore (realtime ✓/×) + Spreadsheet. Tabel absensi Sen–Jum & Kotak Langgar (total absen/libur) ter-update real-time.
6. **Profil**: avatar huruf, nama akun, email, telepon, tgl lahir, **status dicocokkan dari spreadsheet**, tombol Ganti Akun (signOut → kembali ke login).

---

## ⚙️ KONFIGURASI WAJIB

### 1. Firebase (console.firebase.google.com)
1. Buat project → **Authentication → Sign-in method → Google: ENABLE**.
2. **Firestore Database → Create database**.
3. Collection **`akun`**: dokumen ID = email pengguna, mis. `andi@gmail.com` berisi field:
   `nama`, `hp`, `tglLahir` → **hanya akun di sini yang bisa login**.
4. Project Settings → Web app → salin **config** → tempel ke `firebase.js` (blok `firebaseConfig`).
5. Domain website masuk **Authorized domains** (otomatis untuk preview Firebase Hosting).
6. Rules Firestore (uji coba): `allow read, write: if request.auth != null;`

### 2. Google Spreadsheet + Apps Script (`kode.gs`)
1. script.google.com → **New project** → hapus isi → **tempel `kode.gs`** → Save.
2. **Run → pilih fungsi `setupAwal` → Run** → izinkan akses (Review permissions → Advanced → Allow).
   👉 Saat run ini spreadsheet **"ABSENSI ClassVIII.G" OTOMATIS DIBUAT** dengan 3 sheet:
   - **YANG HADIR** : Tanggal | Nama | Kode QR | Metode | Jam | Operator
   - **YANG TIDAK HADIR** : Tanggal | Nama | Kode QR | Status | Alasan Surat | Jam
   - **OPERATOR** : Nama | Email ← *isi email akun yang boleh SCAN QR* (baris default = email Anda)
3. ID spreadsheet disimpan otomatis di PropertiesService → web app langsung memakai spreadsheet itu.
4. **Deploy → New deployment → Web app** → Execute as **Me**, Who has access **Anyone** → salin URL `/exec`.
5. Tempel URL tsb ke `WEB_APP_URL` di **`backend.js`**.

### 3. Lokasi & Jam Scan (`script.js`)
- `SMP18 = { lat:-0.9406, lng:100.3645, radiusKm:1.5 }` → sesuaikan koordinat persis SMPN 18 Padang (klik kanan titik di Google Maps).
- Jendela scan: `JAM_MULAI=7.5` (07.30) s/d `JAM_SELESAI=8.0` (08.00).
- localStorage scan memakai key `viiig_presensi_YYYY-MM-DD` → data lama terhapus otomatis saat hari berganti (reset ≈ pukul 07.29 agar bisa scan lagi esoknya); setelah 08.00 sistem mengunci scan → manual (status Terlambat/Sakit/Izin).

### 4. data.js
Hanya daftar QR: `{ qr:"VIII.G-01", nama:"Andi Pratama" }` dst. Cetak QR asli berisi teks kode tsb untuk tiap siswa.

### 5. Menjalankan
Wajib server + HTTPS (kamera & geolocation browser):
```bash
python3 -m http.server 8080   # dev lokal (http hanya cukup utk localhost)
# produksi: Firebase Hosting / GitHub Pages / Vercel (HTTPS otomatis)
```

---

## 🔧 RINGKASAN PERUBAHAN VERSI INI
- Splash dots → login persist (tidak login ulang bila sesi ada) → navbar + sidebar slide kanan 9 menu.
- Beranda hero 100vh + typewriter 5 kalimat + Tentang + Visi/Misi **dipisah** & bisa ditekan.
- Struktur, Anggota (scroll-x desktop/flex-wrap mobile + WA), Piket (5 hari), Album (unduh foto), Lagu (Spotify) — semua kotak hover, semua dummy **di HTML**.
- Presensi: tab Scan/Manual, kamera besar + scanline, validasi **jam + operator(sheet) + lokasi GPS**, 1×/hari via localStorage reset harian, kirim ke **Apps Script (3 sheet)** + **Firestore realtime**, tabel ✓/× dan Kotak Langgar.
- Profil: status diambil & dicocokkan dari spreadsheet; Ganti Akun = signOut.
- `kode.gs`: auto-create spreadsheet saat run pertama (`setupAwal`) + endpoint `isOperator`, `getStatus`, `getRekap`, `saveHadir`, `saveIzin`.
