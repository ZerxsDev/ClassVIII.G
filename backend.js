/* =====================================================================
   backend.js — Penghubung website ↔ Google Apps Script (Spreadsheet)
   ⚙️ GANTI WEB_APP_URL dengan URL deployment Apps Script Anda
   (Extensions → Apps Script → Deploy → New deployment → Web app → /exec)
   ===================================================================== */

const WEB_APP_URL = "https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec";

/**
 * Kirim data ke Apps Script (POST, mode no-cors agar tidak diblokir CORS).
 * @param {string} action  : saveHadir | saveIzin | getStatus | getRekap
 * @param {object} payload : data yang dikirim
 */
async function kirimKeBackend(action, payload = {}) {
  const body = new FormData();
  body.append("action", action);
  body.append("payload", JSON.stringify(payload));
  try {
    await fetch(WEB_APP_URL, { method: "POST", body });
    return true;
  } catch (e) {
    console.warn("Backend offline:", e);
    return false;
  }
}

/** Presensi HADIR (dari scan QR maupun manual tombol Hadir) */
function kirimHadir({ nama, kode, metode, jam, operator }) {
  return kirimKeBackend("saveHadir", { nama, kode, metode, jam, operator });
}

/** Presensi TIDAK HADIR (Sakit/Izin/Terlambat + alasan = "surat") */
function kirimTidakHadir({ nama, kode, status, alasan, jam }) {
  return kirimKeBackend("saveIzin", { nama, kode, status, alasan, jam });
}

/** Ambil status hari ini per siswa → { "Nama Siswa": "Hadir"|"Sakit"|... } */
async function ambilStatusHariIni() {
  try {
    const res = await fetch(`${WEB_APP_URL}?action=getStatus&tanggal=${hariIni()}`);
    const json = await res.json();
    return json && json.status ? json.status : {};
  } catch (e) {
    return {};
  }
}

/** Rekap mingguan utk tabel absensi & kotak langgar */
async function ambilRekapMingguan() {
  try {
    const res = await fetch(`${WEB_APP_URL}?action=getRekap`);
    const json = await res.json();
    return json || { hadir: {}, tidak: {} };
  } catch (e) {
    return { hadir: {}, tidak: {} };
  }
}

function hariIni() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export { WEB_APP_URL, kirimHadir, kirimTidakHadir, ambilStatusHariIni, ambilRekapMingguan, hariIni };
