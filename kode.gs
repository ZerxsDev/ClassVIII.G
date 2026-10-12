/* =====================================================================
   kode.gs — Google Apps Script untuk ClassVIII.G
   Saat pertama kali di-RUN (fungsi setupAwal) → OTOMATIS membuat:
   1. Spreadsheet baru "ABSENSI ClassVIII.G" + 3 sheet:
      - "YANG HADIR"      (Hasil scan QR / manual hadir)
      - "YANG TIDAK HADIR"(Sakit / Izin / Terlambat + alasan surat)
      - "OPERATOR"        (Daftar email yang boleh melakukan SCAN)
   2. Simpan ID spreadsheet ke PropertiesService → semua doPost/doGet
      otomatis memakai spreadsheet tsb (tanpa konfigurasi manual).
   3. Deploy sebagai Web App (Execute as: Me, Access: Anyone) → salin
      URL /exec ke backend.js pada WEB_APP_URL.

   ⚙️ Setelah deploy, buka menu Extensions → Apps Script, jalankan
      fungsi "setupAwal" satu kali (Run → setupAwal → izinkan akses).
   ===================================================================== */

const NAMA_SPREADSHEET = "ABSENSI ClassVIII.G";
const PROP_KEY = "SPREADSHEET_ID";

/* ---------- AUTO CREATE SPREADSHEET SAAT RUN ---------- */
function setupAwal() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_KEY);
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create(NAMA_SPREADSHEET);
    props.setProperty(PROP_KEY, ss.getId());
  }
  ensureSheet_(ss, "YANG HADIR", ["Tanggal","Nama","Kode QR","Metode","Jam","Operator"]);
  ensureSheet_(ss, "YANG TIDAK HADIR", ["Tanggal","Nama","Kode QR","Status","Alasan Surat","Jam"]);
  const op = ensureSheet_(ss, "OPERATOR", ["Nama","Email"]);
  // isi default 1 operator (email akun Apps Script ini) — hapus/sesuaikan
  if (op.getLastRow() <= 1) {
    op.appendRow(["Pemilik Web", Session.getActiveUser().getEmail() || "operator@contoh.com"]);
  }
  Logger.log("Spreadsheet siap: https://docs.google.com/spreadsheets/d/" + ss.getId());
  return ss.getId();
}
function ensureSheet_(ss, nama, header) {
  let sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);
  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
    sh.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#e8f0fe");
    sh.setFrozenRows(1);
  }
  return sh;
}
function getSS_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_KEY);
  if (!id) { setupAwal(); id = props.getProperty(PROP_KEY); }
  return SpreadsheetApp.openById(id);
}

/* ---------- ROUTING WEB APP ---------- */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";
  try {
    if (action === "getStatus")   return json_({ status: statusHariIni_(e.parameter.tanggal) });
    if (action === "getRekap")    return json_({ hadir: rekapHadir__(), tidak: rekapTidak__() });
    if (action === "isOperator")  return json_({ ok: isOperator_(e.parameter.email) });
    return json_({ ok: true });
  } catch (err) { return json_({ error: String(err) }); }
}

function doPost(e) {
  try {
    const action = e.parameter.action;
    const p = JSON.parse(e.parameter.payload || "{}");
    const ss = getSS_();
    if (action === "saveHadir") simpanHadir_(ss, p);
    if (action === "saveIzin")  simpanIzin_(ss, p);
    return json_({ ok: true });
  } catch (err) { return json_({ error: String(err) }); }
}

/* ---------- VALIDASI OPERATOR (hanya email di sheet OPERATOR boleh scan) ---------- */
function isOperator_(email) {
  const sh = getSS_().getSheetByName("OPERATOR");
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === String(email).trim().toLowerCase()) return true;
  }
  return false;
}

/* ---------- SIMPAN PRESENSI ---------- */
function simpanHadir_(ss, p) {
  const sh = ss.getSheetByName("YANG HADIR");
  // cegah duplikat nama+tanggal
  if (sudahAda_(sh, p.tanggal || today_(), p.nama)) return;
  sh.appendRow([p.tanggal || today_(), p.nama, p.kode, p.metode || "SCAN QR", p.jam || nowStr_(), p.operator || ""]);
}
function simpanIzin_(ss, p) {
  const sh = ss.getSheetByName("YANG TIDAK HADIR");
  if (sudahAda_(sh, p.tanggal || today_(), p.nama)) return;
  sh.appendRow([p.tanggal || today_(), p.nama, p.kode, p.status, p.alasan, p.jam || nowStr_()]);
}
function sudahAda_(sh, tgl, nama) {
  const d = sh.getDataRange().getValues();
  for (let i = 1; i < d.length; i++)
    if (String(d[i][0]) === String(tgl) && String(d[i][1]).trim() === String(nama).trim()) return true;
  return false;
}

/* ---------- BACA STATUS (real-time utk website & menu profil) ---------- */
function statusHariIni_(tgl) {
  tgl = tgl || today_();
  const ss = getSS_();
  const out = {};
  const h = ss.getSheetByName("YANG HADIR"), d1 = h.getDataRange().getValues();
  for (let i = 1; i < d1.length; i++) if (String(d1[i][0]) === tgl) out[d1[i][1]] = "Hadir";
  const t = ss.getSheetByName("YANG TIDAK HADIR"), d2 = t.getDataRange().getValues();
  for (let i = 1; i < d2.length; i++) if (String(d2[i][0]) === tgl) out[d2[i][1]] = d2[i][3]; // Sakit/Izin/Terlambat
  return out;
}
function rekapHadir__() { return rekap_("YANG HADIR", "Hadir"); }
function rekapTidak__() { return rekap_("YANG TIDAK HADIR", null); }
function rekap_(namaSheet, nilaiStatis) {
  const sh = getSS_().getSheetByName(namaSheet);
  const d = sh.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < d.length; i++) {
    const tgl = new Date(d[i][0]);
    if (isNaN(tgl)) continue;
    const hariIdx = tgl.getDay(); // 1=Senin..5=Jumat
    if (hariIdx < 1 || hariIdx > 5) continue;
    const key = d[i][1];
    if (!map[key]) map[key] = [ "", "", "", "", "" ];
    map[key][hariIdx - 1] = nilaiStatis || d[i][3];
  }
  return map;
}
/* getter utk doGet dipakai via rekapHadir__() & rekapTidak__() */

/* ---------- UTIL ---------- */
function today_() {
  const d = new Date();
  return Utilities.formatDate(d, "Asia/Jakarta", "yyyy-MM-dd");
}
function nowStr_() {
  return Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
