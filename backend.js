// =====================================================================
// backend.js  ->  Jembatan ke Google Apps Script (Google Spreadsheet)
// Spreadsheet memiliki 3 sheet: "HADIR", "TIDAK HADIR", "OPERATOR"
// ⚠️ Ganti WEB_APP_URL dengan URL Deployment Apps Script Anda
//    (Web App -> Execute as: Me -> Who has access: Anyone)
// =====================================================================

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbXXXXXXXXXXXXXXXXXXXX/exec";

/**
 * Kirim presensi HADIR ke sheet "HADIR".
 */
export async function kirimHadir({ nama, kode, metode, waktu, operator, lokasi }) {
  const body = new URLSearchParams({
    action: "hadir",
    nama, kode, metode, waktu,
    operator: operator || "",
    lokasi:   lokasi || ""
  });
  return post(body);
}

/**
 * Kirim presensi TIDAK HADIR (sakit/izin/terlambat) ke sheet "TIDAK HADIR".
 * Status terlambat otomatis bila scan/manual lewat jam 08.00.
 */
export async function kirimTidakHadir({ nama, kode, status, alasan, metode, waktu, operator }) {
  const body = new URLSearchParams({
    action: "tidakhadir",
    nama, kode, status,
    alasan: alasan || "",
    metode, waktu,
    operator: operator || ""
  });
  return post(body);
}

/**
 * Ambil daftar OPERATOR yang boleh melakukan scan QR.
 * Mengembalikan array email/nama operator dari sheet "OPERATOR".
 */
export async function ambilOperator() {
  try {
    const res  = await fetch(WEB_APP_URL + "?action=operator", { method: "GET" });
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (e) {
    console.warn("Gagal mengambil data operator:", e);
    return [];
  }
}

/**
 * Ambil rekap absensi real-time untuk tabel & kotak langgar.
 * tipe: "hadir" | "tidakhadir"
 */
export async function ambilRekap(tipe) {
  try {
    const res  = await fetch(WEB_APP_URL + "?action=rekap&tipe=" + tipe, { method: "GET" });
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (e) {
    console.warn("Gagal mengambil rekap " + tipe + ":", e);
    return [];
  }
}

async function post(body) {
  try {
    // mode no-cors dipakai karena Apps Script Web App tidak mengirim header CORS;
    // respons tidak bisa dibaca, tapi data TETAP masuk ke Spreadsheet (real).
    await fetch(WEB_APP_URL, { method: "POST", mode: "no-cors", body });
    return { ok: true };
  } catch (e) {
    console.error("Gagal mengirim ke backend:", e);
    return { ok: false, error: e.message };
  }
}
