/* =====================================================================
   script.js — Logika utama ClassVIII.G (ES Module)
   Aturan: TIDAK membuat kotak/HTML baru dari JS — hanya mengubah TEKS,
   kelas (aktif/hidden), nilai input, dan isi sel tabel yang SUDAH ADA di HTML.
   Fitur nyata (no simulasi): Firebase Auth+Firestore, Apps Script Spreadsheet,
   html5-qrcode, Geolocation, localStorage reset 07.29, SweetAlert2.
   ===================================================================== */
import {
  auth, db, GoogleAuthProvider, signInWithPopup, fbSignOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence,
  doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp
} from "./firebase.js";
import { WEB_APP_URL, kirimHadir, kirimTidakHadir, ambilStatusHariIni } from "./backend.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ====== KONFIGURASI LOKASI & JAM SCAN ====== */
const SMP18 = { lat: -0.9406, lng: 100.3645, radiusKm: 1.5 }; // sesuaikan koordinat GPS SMPN 18 Padang
const JAM_MULAI = 7.5;   // 07.30
const JAM_SELESAI = 8.0; // 08.00

let userAktif = null;      // {nama,email,hp,tglLahir}
let presensiHariIni = {};  // nama -> status (realtime dari Firestore + sheet)

/* =============================================================
   1) SPLASH → CEK SESI → LOGIN / LANGSUNG MASUK
   ============================================================= */
window.addEventListener("load", () => {
  setTimeout(() => { $("#splash").classList.add("hide"); }, 1800);
});

await setPersistence(auth, browserLocalPersistence); // sesi tersimpan → tidak login ulang

onAuthStateChanged(auth, async (u) => {
  if (u) {
    const ok = await validasiAkunFirebase(u);       // akun HARUS ada di Firestore
    if (ok) { masukAplikasi(u); return; }
    await fbSignOut(auth); // tidak terdaftar → keluar lagi
  }
  tampilLogin();
});

function tampilLogin() {
  $("#app").classList.add("hidden");
  $("#loginPage").classList.remove("hidden");
  initLoginUI();
}

/* ---- form login ---- */
let loginSiap = false;
function initLoginUI() {
  $("#chkPrivasi").addEventListener("change", (e) => {
    loginSiap = e.target.checked;
    $("#btnGoogle").disabled = !loginSiap;
  });
  $("#linkPrivasi").addEventListener("click", (ev) => {
    ev.preventDefault();
    Swal.fire({
      title: "Kebijakan Privasi", icon: "info", confirmButtonColor: "#0891b2",
      html: `<p style="text-align:left;font-size:14px">Website ClassVIII.G hanya menyimpan data akun (nama, email) dan data presensi siswa pada Firebase & Google Spreadsheet milik kelas. Data tidak dibagikan ke pihak ketiga.</p>`
    });
  });
  $("#btnEye").addEventListener("click", () => {
    const p = $("#inpPass"); p.type = p.type === "password" ? "text" : "password";
    $("#btnEye i").className = p.type === "password" ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
  });
  $("#btnGoogle").addEventListener("click", loginGoogle);
}

async function loginGoogle() {
  const email = $("#inpEmail").value.trim(), pass = $("#inpPass").value.trim();
  if (!email || !pass) {
    return Swal.fire({ icon: "warning", title: "Peringatan", text: "Email atau password kosong!", confirmButtonColor: "#0891b2" });
  }
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: email });
    const cred = await signInWithPopup(auth, provider);
    if (cred.user.email.toLowerCase() !== email.toLowerCase()) {
      await fbSignOut(auth);
      return Swal.fire({ icon: "error", title: "Gagal", text: "Email tidak sama dengan yang diinput.", confirmButtonColor: "#dc2626" });
    }
    const ok = await validasiAkunFirebase(cred.user);
    if (!ok) {
      await fbSignOut(auth);
      return Swal.fire({ icon: "error", title: "Login Gagal", text: "Email atau password salah / akun belum ditambahkan di Firebase.", confirmButtonColor: "#dc2626" });
    }
    Swal.fire({ icon: "success", title: "Berhasil masuk", timer: 1200, showConfirmButton: false });
  } catch (err) {
    Swal.fire({ icon: "error", title: "Login Gagal", text: "Email atau password yang salah/kosong. (" + err.code + ")", confirmButtonColor: "#dc2626" });
  }
}

/* cek collection `akun` di Firestore — ID dokumen = email */
async function validasiAkunFirebase(u) {
  try {
    const dSnap = await getDoc(doc(db, "akun", u.email));
    if (dSnap.exists()) { userAktif = { ...(dSnap.data() || {}), email: u.email, foto: u.photoURL, displayName: u.displayName }; return true; }
    const q = query(collection(db, "akun"), where("email", "==", u.email));
    const s = await getDocs(q);
    if (!s.empty) { userAktif = { ...s.docs[0].data(), email: u.email, foto: u.photoURL, displayName: u.displayName }; return true; }
  } catch (e) { console.warn("Firestore:", e.code || e.message); }
  return false;
}

/* =============================================================
   2) MASUK APLIKASI + NAVBAR/SIDEBAR ROUTING
   ============================================================= */
function masukAplikasi(u) {
  $("#loginPage").classList.add("hidden");
  $("#app").classList.remove("hidden");
  isiProfil(u);
  bukaSidebarLipat();
  jalankanPresensiRealtime();
  renderTabelAbsensi();
  renderManualNama();
  clockScan();
}

function bukaSidebarLipat() {
  const sb = $("#sidebar"), ov = $("#overlay");
  const toggle = (show) => {
    sb.classList.toggle("translate-x-full", !show);
    ov.classList.toggle("hidden", !show);
  };
  $("#btnToggle").onclick = () => toggle(true);
  $("#btnCloseSidebar").onclick = () => toggle(false);
  ov.onclick = () => toggle(false);

  $$(".menu-btn").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".menu-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const m = b.dataset.menu;
      $$(".page").forEach((p) => p.classList.add("hidden"));
      $("#page-" + m).classList.remove("hidden");
      toggle(false);
      window.scrollTo({ top: 0 });
      if (m === "presensi") refreshRekap();
    })
  );
}

/* =============================================================
   3) BERANDA — typewriter 5 kalimat (hanya ubah teks)
   ============================================================= */
const KALIMAT = [
  "Ini adalah website buatan sendiri",
  "Presensi kini cepat dengan scan QR",
  "Jadwal piket selalu ter-update",
  "Kenangan kelas tersimpan rapi",
  "Selamat belajar bersama VIII.G"
];
(function typewriter() {
  const el = $("#typewriter"); let i = 0, j = 0, hapus = false;
  (function loop() {
    const s = KALIMAT[i];
    el.textContent = s.slice(0, j);
    if (!hapus && j < s.length) { j++; setTimeout(loop, 70); }
    else if (!hapus) { hapus = true; setTimeout(loop, 1400); }
    else if (j > 0) { j--; setTimeout(loop, 35); }
    else { hapus = false; i = (i + 1) % KALIMAT.length; setTimeout(loop, 300); }
  })();
})();

$("#btnSelengkapnya").addEventListener("click", () => {
  $("#kotakVisi").scrollIntoView({ behavior: "smooth" });
});
$("#btnUmpanBalik").addEventListener("click", async () => {
  const { value: msg } = await Swal.fire({
    title: "Umpan Balik", input: "textarea", inputPlaceholder: "Tulis saran / kritik untuk kelas VIII.G…",
    showCancelButton: true, confirmButtonColor: "#0891b2"
  });
  if (msg) {
    Swal.fire({ icon: "success", title: "Terima kasih!", text: "Umpan balik terkirim.", timer: 1500 });
  }
});

/* visi & misi dipisah — klik kotak membuka isinya (toggle class saja) */
["#kotakVisi", "#kotakMisi"].forEach((sel) => {
  $(sel).addEventListener("click", () => {
    const body = $(sel + " .vm-body"), ic = $(sel + " .teks-toggle");
    body.classList.toggle("hidden");
    ic.classList.toggle("rotate-180");
  });
});

/* =============================================================
   4) JADWAL PIKET — tampilkan hari (pindahkan node HTML existing)
   ============================================================= */
$$(".hari-btn").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".hari-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const hari = b.dataset.hari;
    const src = document.querySelector(`#dataPiketHtml div[data-hari="${hari}"]`);
    const ul = $("#isiPiket");
    ul.innerHTML = "";
    [...src.children].forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML = `<i class="fa-solid fa-user-check mr-1 text-cyan-600"></i>${p.innerHTML}`;
      ul.appendChild(li);
    });
    $("#judulPiket").textContent = "Petugas Piket Hari " + hari.charAt(0).toUpperCase() + hari.slice(1);
    $("#detailPiket").classList.remove("hidden");
  })
);

/* =============================================================
   5) ALBUM — unduh foto kenangan
   ============================================================= */
$$(".btn-download").forEach((b) =>
  b.addEventListener("click", async () => {
    try {
      const res = await fetch(b.dataset.src);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = b.dataset.name || "kenangan.jpg";
      a.click();
      URL.revokeObjectURL(a.href);
      Swal.fire({ icon: "success", title: "Terdunduh", timer: 1200, showConfirmButton: false });
    } catch {
      window.open(b.dataset.src, "_blank"); // fallback CORS
    }
  })
);

/* =============================================================
   6) PRESENSI — tab scan/manual, jam, lokasi, operator, QR,
      localStorage reset 07.29, realtime Firestore + Sheet
   ============================================================= */
$("#tabScan").addEventListener("click", () => gantiMode("scan"));
$("#tabManual").addEventListener("click", () => gantiMode("manual"));
function gantiMode(m) {
  $("#tabScan").classList.toggle("active", m === "scan");
  $("#tabManual").classList.toggle("active", m === "manual");
  $("#panelScan").classList.toggle("hidden", m !== "scan");
  $("#panelManual").classList.toggle("hidden", m !== "manual");
  if (m !== "scan") hentikanKamera();
}

const jamDesimal = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
function dalamJamScan() { const h = jamDesimal(); return h >= JAM_MULAI && h < JAM_SELESAI; }

function clockScan() {
  setInterval(() => {
    const t = new Date().toLocaleTimeString("id-ID");
    $("#jamNow").textContent = t;
    $("#areaStatus").textContent = dalamJamScan()
      ? "✅ jendela scan terbuka (07.30–08.00)"
      : "⛔ di luar jam → gunakan Manual (status Terlambat/Sakit/Izin)";
  }, 1000);
}

/* ---- localStorage: key per tanggal → otomatis kedaluwarsa besok 07.29 ---- */
function kunciTanggal() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `viiig_presensi_${d.getFullYear()}-${mm}-${dd}`;
}
function bersihkanLSLama() {
  Object.keys(localStorage).filter((k) => k.startsWith("viiig_presensi_"))
    .forEach((k) => { if (k !== kunciTanggal()) localStorage.removeItem(k); });
}
bersihkanLSLama();
setInterval(bersihkanLSLama, 60000); // tiap menit cek → reset tepat setelah berganti hari (≈07.29 rule)

function sudahScanHariIni(nama) {
  try { return JSON.parse(localStorage.getItem(kunciTanggal()) || "[]").includes(nama); } catch { return false; }
}
function catatScanLS(nama) {
  const arr = JSON.parse(localStorage.getItem(kunciTanggal()) || "[]");
  arr.push(nama);
  localStorage.setItem(kunciTanggal(), JSON.stringify(arr));
}

/* ---- kamera & QR ---- */
let qrScanner = null, kameraAktif = false;
$("#btnStartCam").addEventListener("click", nyalakanKamera);

async function nyalakanKamera() {
  /* 1. jam */
  if (!dalamJamScan()) {
    return Swal.fire({ icon: "error", title: "Scan Ditutup", text: "Scan QR hanya aktif 07.30–08.00. Setelah jam 08.00 silakan presensi MANUAL (Terlambat/Sakit/Izin).", confirmButtonColor: "#dc2626" });
  }
  /* 2. operator — email harus ada di sheet OPERATOR */
  const opOk = await cekOperator(userAktif.email);
  if (!opOk) {
    return Swal.fire({ icon: "error", title: "Bukan Operator", text: "Akun Anda tidak terdaftar sebagai operator scan pada spreadsheet OPERATOR.", confirmButtonColor: "#dc2626" });
  }
  /* 3. lokasi wajib SMP 18 PADANG */
  const diLokasi = await cekLokasi();
  if (!diLokasi) {
    return Swal.fire({ icon: "error", title: "Di Luar Area", text: "Scan wajib dilakukan di lokasi SMP Negeri 18 Padang.", confirmButtonColor: "#dc2626" });
  }
  /* 4. nyalakan kamera */
  try {
    qrScanner = new Html5Qrcode("qr-reader");
    await qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, onQRDetected, () => {});
    kameraAktif = true;
    $("#camOff").classList.add("hidden");
    $("#scanline").classList.add("on");
  } catch (e) {
    Swal.fire({ icon: "error", title: "Kamera Gagal", text: "Izinkan akses kamera (butuh HTTPS). Error: " + e, confirmButtonColor: "#dc2626" });
  }
}

function hentikanKamera() {
  if (qrScanner && kameraAktif) { qrScanner.stop().catch(() => {}); kameraAktif = false; $("#scanline").classList.remove("on"); $("#camOff").classList.remove("hidden"); }
}

async function onQRDetected(teksQR) {
  if (!dalamJamScan()) { hentikanKamera(); return; }
  const siswa = DATA_QR.find((d) => d.qr === teksQR.trim()); // daftar QR dari data.js
  if (!siswa) {
    Swal.fire({ icon: "error", title: "QR Tidak Dikenal", text: "Kode \"" + teksQR + "\" tidak ada di data.js.", timer: 1800 });
    return;
  }
  if (sudahScanHariIni(siswa.nama)) {
    Swal.fire({ icon: "warning", title: "Sudah Presensi", text: `${siswa.nama} sudah scan hari ini (1×/hari).`, timer: 1800 });
    return;
  }
  await simpanPresensi(siswa.nama, siswa.qr, "SCAN QR", "Hadir");
  Swal.fire({ icon: "success", title: "Berhasil!", html: `<b>${siswa.nama}</b> tercatat HADIR ✅`, timer: 1800 });
  hentikanKamera();
}

/* ---- geolocation ---- */
function cekLokasi() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: la, longitude: lo } = pos.coords;
        const R = 6371, rad = Math.PI / 180;
        const dLa = (la - SMP18.lat) * rad, dLo = (lo - SMP18.lng) * rad;
        const a = Math.sin(dLa / 2) ** 2 + Math.cos(SMP18.lat * rad) * Math.cos(la * rad) * Math.sin(dLo / 2) ** 2;
        const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        res(km <= SMP18.radiusKm);
      },
      () => res(false),
      { enableHighAccuracy: true, timeout: 9000 }
    );
  });
}

/* ---- operator via Apps Script ---- */
async function cekOperator(email) {
  try {
    const r = await fetch(`${WEB_APP_URL}?action=isOperator&email=${encodeURIComponent(email)}`);
    const j = await r.json();
    return !!(j && j.ok);
  } catch { return false; }
}

/* ---- simpan presensi: localStorage + Firestore(realtime) + Spreadsheet ---- */
async function simpanPresensi(nama, kode, metode, status, alasan = "") {
  const jam = new Date().toLocaleTimeString("id-ID");
  const tgl = new Date().toISOString().slice(0, 10);
  if (status === "Hadir") {
    catatLS(nama);
    kirimHadir({ nama, kode, metode, jam, operator: userAktif?.email || "" });
    try { await setDocSafe(tgl, nama, { nama, status: "Hadir", metode, jam, kode }); } catch {}
  } else {
    catatLS(nama);
    kirimTidakHadir({ nama, kode, status, alasan, jam });
    try { await setDocSafe(tgl, nama, { nama, status, metode, jam, kode, alasan }); } catch {}
  }
  presensiHariIni[nama] = status;
  renderTabelAbsensi();
}
function catatLS(nama) { catatScanLS(nama); }
async function setDocSafe(tgl, nama, data) {
  const ref = doc(db, "presensi", tgl, "catatan", slug(nama));
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/* ---- realtime: dengar collection presensi hari berjalan ---- */
function jalankanPresensiRealtime() {
  const tgl = new Date().toISOString().slice(0, 10);
  try {
    onSnapshot(collection(db, "presensi", tgl, "catatan"), (snap) => {
      snap.forEach((d) => { presensiHariIni[d.data().nama] = d.data().status; });
      renderTabelAbsensi();
      updateStatusProfil();
    });
  } catch (e) { console.warn("realtime:", e.code); }
  // sinkron juga dari spreadsheet (hadir/absen real)
  refreshRekap();
  setInterval(refreshRekap, 60000);
}

async function refreshRekap() {
  const st = await ambilStatusHariIni();
  Object.assign(presensiHariIni, st);
  renderTabelAbsensi();
  updateStatusProfil();
}

/* ---- render tabel: hanya ubah TEKS sel yang barisnya dibuat sekali ---- */
let barisDibuat = false;
function renderTabelAbsensi() {
  const tbody = $("#isiTabelAbsensi");
  if (!barisDibuat) {
    DATA_QR.forEach((d) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-100 baris-" + slug(d.nama);
      tr.innerHTML = `<td class="py-2 pr-3 font-semibold">${d.nama}</td>` +
        `<td class="py-2 text-center c-senin"></td><td class="py-2 text-center c-selasa"></td>
         <td class="py-2 text-center c-rabu"></td><td class="py-2 text-center c-kamis"></td>
         <td class="py-2 text-center c-jumat"></td>`;
      tbody.appendChild(tr);
    });
    barisDibuat = true;
  }
  const idx = ["senin", "selasa", "rabu", "kamis", "jumat"];
  let adaHariIni = false;
  const hariSekarang = Math.min(Math.max(new Date().getDay() - 1, 0), 4);
  DATA_QR.forEach((d) => {
    const st = presensiHariIni[d.nama];
    const tr = tbody.querySelector(".baris-" + slug(d.nama));
    if (!tr) return;
    idx.forEach((h, i) => {
      const td = tr.querySelector(".c-" + h);
      if (i === hariSekarang && st === "Hadir") { td.textContent = "✓"; td.className = "py-2 text-center hadir-t"; adaHariIni = true; }
      else if (i === hariSekarang && st && st !== "Hadir") { td.textContent = "×"; td.className = "py-2 text-center tidak-t"; adaHariIni = true; }
      else if (td.textContent !== "✓" && td.textContent !== "×") { td.textContent = ""; }
    });
  });
  $("#kosongScan").classList.toggle("hidden", adaHariIni);
  renderLanggar(idx, hariSekarang);
}

/* kotak langgar: hitung absen/libur dari status */
function renderLanggar(idx, hariSekarang) {
  const tb = $("#isiLanggar");
  const rows = [];
  DATA_QR.forEach((d) => {
    const st = presensiHariIni[d.nama];
    if (st && st !== "Hadir") {
      const libur = st === "Izin" || st === "Sakit" ? 1 : 0;
      rows.push(`<tr class="border-b border-red-50"><td class="py-2 pr-3 font-semibold">${d.nama}</td>
        ${idx.map((_, i) => `<td class="py-2 text-center">${i === hariSekarang ? `<span class="tidak-t">${st}</span>` : ""}</td>`).join("")}
        <td class="py-2 text-center tidak-t">1</td><td class="py-2 text-center">${libur}</td></tr>`);
    }
  });
  tb.innerHTML = rows.join("") || `<tr><td colspan="8" class="py-3 text-center text-slate-400 italic">Tidak ada catatan absen minggu ini.</td></tr>`;
}

/* =============================================================
   7) PRESENSI MANUAL (nama dari data.js + kode + hadir/tidak)
   ============================================================= */
function renderManualNama() {
  const sel = $("#manualNama");
  sel.innerHTML = `<option value="">— pilih nama —</option>` + DATA_QR.map((d) => `<option value="${d.qr}">${d.nama}</option>`).join("");
}
$("#manualNama").addEventListener("change", (e) => {
  const opt = e.target.selectedOptions[0];
  $("#manualKode").value = opt ? opt.value : "";
});
$("#btnHadir").addEventListener("click", async () => {
  const { valid, nama, kode } = await validasiManual();
  if (!valid) return;
  if (sudahScanHariIni(nama)) return Swal.fire({ icon: "warning", title: "Sudah presensi hari ini", confirmButtonColor: "#f59e0b" });
  await simpanPresensi(nama, kode, "MANUAL", "Hadir");
  $("#boxAlasan").classList.add("hidden");
  Swal.fire({ icon: "success", title: `${nama} HADIR`, timer: 1500, showConfirmButton: false });
});
$("#btnTidak").addEventListener("click", () => $("#boxAlasan").classList.remove("hidden"));
$("#btnKirimSurat").addEventListener("click", async () => {
  const { valid, nama, kode } = await validasiManual();
  if (!valid) return;
  const alasan = $("#manualAlasan").value.trim();
  const status = $("#manualStatus").value;
  if (!alasan) return Swal.fire({ icon: "warning", title: "Alasan wajib diisi (surat)", confirmButtonColor: "#f59e0b" });
  if (sudahScanHariIni(nama)) return Swal.fire({ icon: "warning", title: "Sudah presensi hari ini", confirmButtonColor: "#f59e0b" });
  await simpanPresensi(nama, kode, "MANUAL", status, alasan);
  Swal.fire({ icon: "success", title: "Surat terkirim", text: `${nama} → ${status}`, timer: 1600, showConfirmButton: false });
  $("#manualAlasan").value = "";
  $("#boxAlasan").classList.add("hidden");
});
async function validasiManual() {
  const sel = $("#manualNama"), nama = sel.selectedOptions[0]?.textContent || "";
  const kode = $("#manualKode").value.trim();
  if (!nama || sel.value === "") { Swal.fire({ icon: "warning", title: "Pilih nama siswa!" }); return { valid: false }; }
  const cocok = DATA_QR.find((d) => d.nama === nama);
  if (!cocok || cocok.qr !== kode) { Swal.fire({ icon: "error", title: "Kode tidak sesuai data.js!", confirmButtonColor: "#dc2626" }); return { valid: false }; }
  return { valid: true, nama, kode };
}

/* =============================================================
   8) PROFIL — status dicocokkan dari spreadsheet/firestore
   ============================================================= */
function isiProfil(u) {
  const nama = userAktif?.nama || u.displayName || "Pengguna VIII.G";
  $("#pfAvatar").textContent = nama.charAt(0).toUpperCase();
  $("#pfNama").textContent = nama;
  $("#pfEmail").textContent = u.email;
  $("#pfNamaAkun").textContent = nama;
  $("#pfEmailDetail").textContent = u.email;
  $("#pfHp").textContent = userAktif?.hp || "Belum diisi di Firebase";
  $("#pfTgl").textContent = userAktif?.tglLahir || "Belum diisi di Firebase";
}
function updateStatusProfil() {
  const nama = userAktif?.nama;
  if (!nama) return;
  const st = presensiHariIni[nama];
  $("#pfStatus").textContent = "Status hari ini: " + (st || "Belum presensi");
}
$("#btnGantiAkun").addEventListener("click", async () => {
  const yes = await Swal.fire({ icon: "question", title: "Ganti akun?", text: "Anda akan keluar dan kembali ke form login.", showCancelButton: true, confirmButtonColor: "#dc2626" });
  if (yes.isConfirmed) { hentikanKamera(); await fbSignOut(auth); location.reload(); }
});
