// =====================================================================
// kode.gs — GOOGLE APPS SCRIPT BACKEND untuk ClassVIII.G
// CARA PAKAI:
// 1. Buka Google Spreadsheet kelas → Extensions → Apps Script
// 2. Tempel seluruh file ini, simpan
// 3. Deploy → New deployment → Web app
//    - Execute as : Me
//    - Who has access : Anyone
// 4. Salin URL .../exec → tempel ke WEB_APP_URL di backend.js
//
// STRUKTUR SPREADSHEET (WAJIB 3 SHEET):
//  Sheet "HADIR"       : Tanggal | Nama | Kode QR | Metode | Waktu | Operator | Lokasi
//  Sheet "TIDAK HADIR" : Tanggal | Nama | Kode QR | Status | Alasan | Metode | Waktu | Operator
//  Sheet "OPERATOR"    : Nama | Email
// =====================================================================

var SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e){
  var action = (e && e.parameter && e.parameter.action) || "";
  if(action === "operator") return jsonOut({ data: getOperatorList() });
  if(action === "rekap"){
    var tipe = (e.parameter.tipe || "hadir").toLowerCase();
    var sheetName = tipe === "tidakhadir" ? "TIDAK HADIR" : "HADIR";
    var sh = getOrCreate(sheetName);
    var rows = sh.getDataRange().getValues();
    var out = [];
    for(var i=1;i<rows.length;i++){
      var r = rows[i];
      if(tipe === "tidakhadir"){
        out.push({ tanggal:String(r[0]), nama:r[1], kode:r[2], status:r[3], alasan:r[4], metode:r[5], waktu:r[6] });
      }else{
        out.push({ tanggal:String(r[0]), nama:r[1], kode:r[2], metode:r[3], waktu:r[4], operator:r[5], lokasi:r[6], status:"Hadir" });
      }
    }
    return jsonOut({ data: out });
  }
  return jsonOut({ error:"action tidak dikenal" });
}

function doPost(e){
  var p = e.parameter || {};
  var action = p.action || "";
  var tz = Session.getScriptTimeZone() || "Asia/Jakarta";
  var today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  if(action === "hadir"){
    var sh = getOrCreate("HADIR");
    if(sh.getLastRow() === 0){
      sh.appendRow(["Tanggal","Nama","Kode QR","Metode","Waktu","Operator","Lokasi"]);
      sh.getRange(1,1,1,7).setFontWeight("bold").setBackground("#0ea5e9").setFontColor("#ffffff");
    }
    // cegah duplikat satu kode per hari
    var exists = sh.createTextFinder(p.kode).findNext() && rowHasDate(sh, today, p.kode);
    if(!exists){
      sh.appendRow([today, p.nama, p.kode, p.metode, p.waktu, p.operator, p.lokasi]);
    }
    return jsonOut({ ok:true, message:"Hadir tercatat" });
  }

  if(action === "tidakhadir"){
    var sh2 = getOrCreate("TIDAK HADIR");
    if(sh2.getLastRow() === 0){
      sh2.appendRow(["Tanggal","Nama","Kode QR","Status","Alasan","Metode","Waktu","Operator"]);
      sh2.getRange(1,1,1,8).setFontWeight("bold").setBackground("#ef4444").setFontColor("#ffffff");
    }
    if(!rowHasDate(sh2, today, p.kode)){
      sh2.appendRow([today, p.nama, p.kode, p.status, p.alasan, p.metode, p.waktu, p.operator]);
    }
    return jsonOut({ ok:true, message:"Surat "+p.status+" terkirim" });
  }

  return jsonOut({ ok:false, error:"action tidak dikenal" });
}

/* ---------- helper ---------- */
function getOrCreate(name){
  var sh = SS.getSheetByName(name);
  if(!sh) sh = SS.insertSheet(name);
  return sh;
}
function getOperatorList(){
  var sh = getOrCreate("OPERATOR");
  if(sh.getLastRow() < 2) return [];
  var rows = sh.getDataRange().getValues();
  var out = [];
  for(var i=1;i<rows.length;i++){
    if(rows[i][1]) out.push({ nama:rows[i][0], email:String(rows[i][1]).trim().toLowerCase() });
  }
  return out;
}
function rowHasDate(sh, dateStr, kode){
  var rows = sh.getDataRange().getValues();
  for(var i=1;i<rows.length;i++){
    if(String(rows[i][0]).indexOf(dateStr) === 0 && String(rows[i][2]) === String(kode)) return true;
  }
  return false;
}
function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
