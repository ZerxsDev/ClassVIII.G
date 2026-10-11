// =====================================================================
// script.js — Logika utama ClassVIII.G
// (hanya mengubah teks/status/atribut, tidak membuat kotak HTML baru)
// =====================================================================
import {
  auth, provider, db,
  signInWithPopup, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, collection, query, where, getDocs, onSnapshot
} from "./firebase.js";
import { kirimHadir, kirimTidakHadir, ambilOperator, ambilRekap } from "./backend.js";

const $ = (id) => document.getElementById(id);
const QR_DATA = window.QR_DATA || [];
const HARI    = ["Senin","Selasa","Rabu","Kamis","Jumat"];
const SMP18   = { lat: -0.9167, lng: 100.4077, radiusKm: 1.5 }; // koordinat & radius (km) SMPN 18 Padang — sesuaikan!

let currentUser = null;
let operatorList = [];        // dari sheet OPERATOR via Apps Script
let userIsOperator = false;
let lokasiOK = null;          // null=cek, true/false
let html5QrCode = null, scanning = false;

/* ==================== UTIL WAKTU & STORAGE ==================== */
function nowWIB(){ return new Date(); }
function isScanWindow(d=nowWIB()){ const m=d.getHours()*60+d.getMinutes(); return m>=450 && m<480; } // 07:30–08:00
function afterCutoff(d=nowWIB()){ return d.getHours()*60+d.getMinutes() >= 480; }                  // >= 08:00
function dateKey(d=nowWIB()){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function dayName(d=nowWIB()){ return HARI[(d.getDay()+6)%7]; } // Senin=0..Jumat=4

function getScans(){ try{ return JSON.parse(localStorage.getItem("viiig_scans_"+dateKey())||"[]"); }catch(e){ return []; } }
function saveScan(obj){ const a=getScans(); if(!a.find(x=>x.kode===obj.kode)) a.push(obj); localStorage.setItem("viiig_scans_"+dateKey(),JSON.stringify(a)); }
function hasScannedToday(kode){ return getScans().some(x=>x.kode===kode); }

// Reset otomatis tiap hari pada pukul 07.29: hapus data scan kemarin
(function autoReset(){
  for(let i=1;i<=7;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    localStorage.removeItem("viiig_scans_"+dateKey(d));
  }
})();

/* ==================== SPLASH → LOGIN/APP ==================== */
window.addEventListener("load", () => {
  setTimeout(() => { $("splash").style.display="none"; route(); }, 1800);
});

function route(){
  // jika sudah pernah login (sesi Firebase aktif) → langsung masuk, tanpa form login
  onAuthStateChanged(auth, (user) => {
    if(user){
      currentUser=user; enterApp(user);
    }else{
      $("loginPage").classList.remove("hidden");
      $("app").classList.add("hidden");
    }
  });
}

/* ==================== LOGIN GOOGLE ==================== */
$("privasiCheck").addEventListener("change", e => { $("btnLoginGoogle").disabled = !e.target.checked; });

$("linkPrivasi").addEventListener("click", e => {
  e.preventDefault();
  Swal.fire({ title:"Kebijakan Privasi", icon:"info", confirmButtonColor:"#0ea5e9",
    html:`<p style="text-align:left;font-size:14px">Website ClassVIII.G hanya mengumpulkan data akun Google (nama, email, foto), data presensi (kode QR, waktu, lokasi scan) dan preferensi sesi pada localStorage. Data presensi disimpan pada Google Spreadsheet & Firebase Firestore kelas dan tidak dibagikan ke pihak ketiga.</p>` });
});

$("btnLoginGoogle").addEventListener("click", async () => {
  const msg=$("loginMsg"); msg.classList.add("hidden");
  try{
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;
    // verifikasi akun terdaftar di Firestore (collection "akun") — jika belum ada → login gagal
    const snap = await getDoc(doc(db,"akun",user.email.replace(/[.#$]/g,"_")));
    if(!snap.exists()){
      await signOut(auth);
      showLoginError("Akun Google Anda belum ditambahkan ke database kelas. Login gagal — hubungi operator VIII.G.");
      return;
    }
    // isi field email/password seperti form login umumnya (dari akun google)
    $("loginEmail").value = user.email || "";
    $("loginPassword").value = "••••••••••";
    enterApp(user);
  }catch(err){
    console.error(err);
    if(String(err.code||"").includes("popup-closed")) showLoginError("Popup login ditutup. Coba lagi.");
    else if(String(err.code||"").includes("redirect")){ await signInWithRedirect(auth,provider); return; }
    else showLoginError("Email atau password salah / kosong. Pastikan memakai akun Google yang terdaftar.");
  }
});
function showLoginError(t){ const m=$("loginMsg"); m.textContent="⚠ "+t; m.classList.remove("hidden"); }

/* ==================== MASUK APLIKASI ==================== */
async function enterApp(user){
  $("loginPage").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("splash").style.display="none";

  const nama = user.displayName || user.email.split("@")[0];
  const huruf= (nama[0]||"?").toUpperCase();
  $("miniName").textContent = nama;
  $("miniEmail").textContent= user.email||"—";
  $("miniAvatar").textContent = huruf;
  $("profNama").textContent = nama;
  $("profEmail").textContent= user.email||"—";
  $("profHuruf").textContent= huruf;
  if(user.photoURL){ $("profFoto").src=user.photoURL; $("profFoto").classList.remove("hidden"); $("profHuruf").classList.add("hidden"); }
  else { $("profFoto").classList.add("hidden"); $("profHuruf").classList.remove("hidden"); $("profHuruf").style.display="flex"; }

  // simpan profil ke firestore (realtime db) + muat info tambahan
  try{ await setDoc(doc(db,"profil",user.email.replace(/[.#$]/g,"_")), { nama, email:user.email||"", terakhirLogin:new Date().toISOString() }, { merge:true }); }catch(e){ console.warn(e); }
  loadProfilEkstra(user.email);
  cekOperator(user.email);
  renderChipsHariIni();
  renderTabel();
  startJam();
}

/* ---- Profil: telepon & tanggal lahir dicocokkan dari spreadsheet ---- */
async function loadProfilEkstra(email){
  try{
    const s = await getDoc(doc(db,"profil",email.replace(/[.#$]/g,"_")));
    const d = s.exists()? s.data() : {};
    $("profPhone").textContent   = d.telepon   || "Belum diisi";
    $("profTglLahir").textContent= d.tanggalLahir || "Belum diisi";
  }catch(e){
    $("profPhone").textContent="—"; $("profTglLahir").textContent="—";
  }
  // status dari sheet (HADIR/TIDAK HADIR) dicocokkan dengan email/nama akun
  const nama=(email||"").split("@")[0];
  try{
    const hadir = await ambilRekap("hadir");
    const rec = hadir.find(r=>String(r.nama||"").toLowerCase().includes(nama.toLowerCase()) || String(r.email||"").toLowerCase()===String(email).toLowerCase());
    const st=$("profStatus");
    if(rec){ st.textContent="Status: Hadir ("+(rec.waktu||"hari ini")+")"; st.className="mt-2 inline-block text-xs font-bold rounded-full px-3 py-1 bg-emerald-100 text-emerald-700"; }
    else  { st.textContent="Status: Belum tercatat hadir"; st.className="mt-2 inline-block text-xs font-bold rounded-full px-3 py-1 bg-rose-100 text-rose-600"; }
  }catch(e){ $("profStatus").textContent="Status: gagal memuat spreadsheet"; }
}

/* ---- Operator check dari sheet OPERATOR ---- */
async function cekOperator(email){
  operatorList = await ambilOperator();
  const el=$("statusOperatorPresensi");
  userIsOperator = operatorList.some(o=>String(o.email||o).toLowerCase()===String(email||"").toLowerCase());
  if(operatorList.length===0){
    el.innerHTML='<i class="fa-solid fa-triangle-exclamation mr-1"></i>Daftar operator belum dapat dimuat dari spreadsheet — scan dinonaktifkan.';
    el.className="mt-3 text-xs font-bold rounded-lg px-3 py-2 inline-block bg-amber-100 text-amber-700";
  }else if(userIsOperator){
    el.innerHTML='<i class="fa-solid fa-shield-halved mr-1"></i>Anda/operator VIII.G — hak scan QR aktif.';
    el.className="mt-3 text-xs font-bold rounded-lg px-3 py-2 inline-block bg-emerald-100 text-emerald-700";
  }else{
    el.innerHTML='<i class="fa-solid fa-user-lock mr-1"></i>Akun Anda tidak terdaftar sebagai operator — scan QR dikunci, gunakan input manual.';
    el.className="mt-3 text-xs font-bold rounded-lg px-3 py-2 inline-block bg-rose-100 text-rose-600";
  }
}

/* ==================== SIDEBAR & MENU ==================== */
$("btnToggleSidebar").addEventListener("click", ()=> openSide(true));
$("btnCloseSidebar").addEventListener("click", ()=> openSide(false));
$("sidebarOverlay").addEventListener("click",  ()=> openSide(false));
function openSide(v){ $("sidebar").classList.toggle("sidebar-open",v); $("sidebarOverlay").classList.toggle("overlay-show",v); }

document.querySelectorAll(".side-btn").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".side-btn").forEach(x=>x.classList.remove("active-side"));
    b.classList.add("active-side");
    document.querySelectorAll(".menu-panel").forEach(p=>p.classList.add("hidden"));
    $("menu-"+b.dataset.menu).classList.remove("hidden");
    window.scrollTo({top:0});
    openSide(false);
    if(b.dataset.menu==="presensi") initManualSelect();
  });
});

/* ==================== BERANDA: typewriter ==================== */
const KALIMAT=[
  "Ini adalah website buatan sendiri.",
  "Kelas VIII.G paling kompak se-sekolah!",
  "Presensi kini cukup scan QR code.",
  "Kenangan kelas tersimpan dalam album.",
  "Belajar teknologi sejak bangku SMP.",
  "Selamat datang, selamat menjelajah!"
];
(function typeLoop(){
  const el=$("typedText"); let ki=0, ci=0, menghapus=false;
  (function tick(){
    const t=KALIMAT[ki];
    el.textContent = t.slice(0, ci);
    if(!menghapus && ci<t.length){ ci++; setTimeout(tick,70); }
    else if(!menghapus){ menghapus=true; setTimeout(tick,1500); }
    else if(ci>0){ ci--; setTimeout(tick,35); }
    else { menghapus=false; ki=(ki+1)%KALIMAT.length; setTimeout(tick,300); }
  })();
})();

$("btnLihatSelengkapnya").addEventListener("click", ()=>{
  Swal.fire({ title:"ClassVIII.G", icon:"info", confirmButtonColor:"#0ea5e9", width:600,
    html:`<div style="text-align:left;font-size:14px;line-height:1.7">Website edukasi ini memiliki <b>9 menu</b>: Beranda, Struktur Kelas, Anggota Kelas, Jadwal Piket, Album Kenangan, Lagu Favorit, Presensi (scan QR real-time + manual), Dokumen, dan Profil.<br><br>Sistem presensi terhubung ke <b>Google Spreadsheet</b> (sheet HADIR, TIDAK HADIR, OPERATOR) melalui Google Apps Script, serta <b>Firebase Firestore</b> untuk autentikasi & data realtime.</div>`});
});
$("btnUmpanBalik").addEventListener("click", async ()=>{
  const { value:txt } = await Swal.fire({
    title:"Umpan Balik", input:"textarea", inputPlaceholder:"Tulis saran/kritik untuk kelas VIII.G…",
    showCancelButton:true, confirmButtonText:"Kirim", confirmButtonColor:"#6366f1", cancelButtonColor:"#94a3b8"
  });
  if(txt){
    try{ await setDoc(doc(db,"umpanbalik",Date.now()+"_"+(currentUser?.uid||"guest")), { teks:txt, oleh:currentUser?.email||"-", waktu:new Date().toISOString() }); }catch(e){ console.warn(e); }
    Swal.fire({ icon:"success", title:"Terima kasih!", text:"Umpan balik Anda tersimpan realtime di Firestore.", timer:2000, showConfirmButton:false });
  }
});

/* Visi & Misi bisa ditekan (kotak terpisah) */
["kotakVisi","kotakMisi"].forEach(id=>{
  $(id).addEventListener("click", ()=>{
    const extra=$(id).querySelector(".vm-extra");
    extra.classList.toggle("hidden");
    $(id).querySelector(".vm-more").innerHTML = extra.classList.contains("hidden")
      ? 'Klik untuk selengkapnya <i class="fa-solid fa-chevron-down ml-1"></i>'
      : 'Tutup <i class="fa-solid fa-chevron-up ml-1"></i>';
  });
});

/* ==================== JADWAL PIKET ==================== */
document.querySelectorAll(".hari-btn").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".piket-detail").forEach(p=>p.classList.add("hidden"));
    $("piket-"+b.dataset.hari).classList.remove("hidden");
  });
});

/* ==================== PRESENSI: jam & tab ==================== */
function startJam(){
  const upd=()=>{
    const d=nowWIB();
    $("jamPresensi").innerHTML='<i class="fa-regular fa-clock mr-1"></i>'+d.toLocaleTimeString("id-ID")+' · '+dayName(d);
    if(isScanWindow()) $("jamPresensi").className="ml-auto self-center text-sm font-bold text-emerald-600";
    else if(afterCutoff()) $("jamPresensi").className="ml-auto self-center text-sm font-bold text-rose-500";
    else $("jamPresensi").className="ml-auto self-center text-sm font-bold text-slate-500";
  };
  upd(); setInterval(upd,1000);
}

$("tabScanQR").addEventListener("click", ()=>{ $("panelScan").classList.remove("hidden"); $("panelManual").classList.add("hidden"); setTabUI(true); });
$("tabManual").addEventListener("click", ()=>{ $("panelScan").classList.add("hidden"); $("panelManual").classList.remove("hidden"); stopScanner(); setTabUI(false); });
function setTabUI(scan){
  $("tabScanQR").className="mode-tab rounded-xl px-5 py-3 font-bold "+(scan?"bg-sky-500 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200");
  $("tabManual").className="mode-tab rounded-xl px-5 py-3 font-bold "+(!scan?"bg-indigo-500 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200");
}

/* ---- Verifikasi lokasi via GPS ---- */
function cekLokasi(){
  return new Promise(res=>{
    if(!navigator.geolocation) return res(false);
    navigator.geolocation.getCurrentPosition(p=>{
      const R=6371, la1=SMP18.lat*Math.PI/180, la2=p.coords.latitude*Math.PI/180;
      const dLa=la2-la1, dLo=((p.coords.longitude-SMP18.lng))*Math.PI/180;
      const a=Math.sin(dLa/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLo/2)**2;
      const km=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      lokasiOK = km<=SMP18.radiusKm;
      $("lokInfo").innerHTML = lokasiOK
        ? '<i class="fa-solid fa-location-dot mr-1 text-emerald-500"></i>Lokasi terverifikasi: ±'+km.toFixed(2)+" km dari SMPN 18 Padang ✅"
        : '<i class="fa-solid fa-location-dot mr-1 text-rose-500"></i>Luar jangkauan: ±'+km.toFixed(2)+" km dari SMPN 18 Padang ❌";
      res(lokasiOK);
    }, ()=>{ $("lokInfo").innerHTML='<i class="fa-solid fa-location-dot mr-1 text-rose-500"></i>Izin lokasi ditolak — wajib aktifkan GPS di lokasi sekolah.'; lokasiOK=false; res(false); }, {enableHighAccuracy:true,timeout:10000});
  });
}

/* ---- Scanner QR ---- */
$("btnStartScan").addEventListener("click", async ()=>{
  if(scanning) return;
  if(!userIsOperator){ Swal.fire({icon:"error",title:"Bukan operator",text:"Hanya akun operator (sheet OPERATOR) yang boleh melakukan scan QR."}); return; }
  if(!isScanWindow()){
    Swal.fire({icon:"warning",title:"Scan ditutup",
      text: afterCutoff() ? "Sudah lewat pukul 08.00 — presensi hanya bisa lewat menu Manual (terlambat/sakit/izin)." : "Scan QR hanya dibuka pukul 07.30–08.00 pagi."});
    return;
  }
  const ok = await cekLokasi();
  if(!ok){ Swal.fire({icon:"error",title:"Di luar lokasi",text:"Scan wajib dilakukan di lokasi SMP Negeri 18 Padang."}); return; }

  if(typeof Html5Qrcode==="undefined"){ Swal.fire({icon:"error",title:"Pustaka scanner gagal dimuat"}); return; }
  html5QrCode = new Html5Qrcode("reader");
  try{
    await html5QrCode.start({facingMode:"environment"},{fps:10,qrbox:260}, onQrFound, ()=>{});
    scanning=true;
    Swal.fire({icon:"success",title:"Kamera aktif",text:"Arahkan QR siswa ke kamera.",timer:1800,showConfirmButton:false});
  }catch(e){ console.error(e); Swal.fire({icon:"error",title:"Kamera tidak dapat diakses",text:String(e.message||e)}); }
});
$("btnStopScan").addEventListener("click", stopScanner);
async function stopScanner(){ if(html5QrCode&&scanning){ try{ await html5QrCode.stop(); }catch(e){} scanning=false; } }

async function onQrFound(text){
  text=(text||"").trim();
  const siswa = QR_DATA.find(s=>s.qr===text);
  if(!siswa){ beep(); Swal.fire({icon:"error",title:"QR tidak dikenali",text:"Kode '"+text+"' tidak ada pada data.js."}); return; }
  if(hasScannedToday(siswa.qr)){ beep(); Swal.fire({icon:"warning",title:"Sudah presensi",text:siswa.nama+" sudah dipindai hari ini (1x/hari)."}); return; }
  if(!isScanWindow()){ stopScanner(); Swal.fire({icon:"warning",title:"Waktu habis",text:"Scan hanya 07.30–08.00. Gunakan menu Manual."}); return; }

  const w=nowWIB().toLocaleTimeString("id-ID");
  saveScan({ kode:siswa.qr, nama:siswa.nama, waktu:w, metode:"Scan QR", hari:dayName() });
  beep();
  await kirimHadir({ nama:siswa.nama, kode:siswa.qr, metode:"Scan QR", waktu:w+" "+dateKey(), operator:currentUser?.email||"", lokasi:"SMP 18 Padang" });
  try{ await setDoc(doc(collection(db,"presensi"),dateKey()+"_"+siswa.qr), { nama:siswa.nama, kode:siswa.qr, status:"Hadir", metode:"Scan QR", waktu:w, hari:dayName(), tanggal:dateKey(), operator:currentUser?.email||"" }); }catch(e){ console.warn(e); }
  Swal.fire({icon:"success",title:"Berhasil!",html:`<b>${siswa.nama}</b> tercatat HADIR pukul ${w}.`});
  renderChipsHariIni(); renderTabel();
}
function beep(){ try{ const c=new (AudioContext||webkitAudioContext)(); const o=c.createOscillator(); o.connect(c.destination); o.frequency.value=1200; o.start(); setTimeout(()=>o.stop(),120);}catch(e){} }

/* ==================== MANUAL ==================== */
let manualState={ pilih:"hadir", status:"" };
function initManualSelect(){
  const sel=$("manualNama");
  if(sel.options.length) return; // jangan duplikat
  QR_DATA.forEach(s=>{ const o=document.createElement("option"); o.value=s.nama; o.textContent=s.nama+" ("+s.qr+")"; sel.appendChild(o); });
}
$("btnPilihHadir").addEventListener("click", ()=>{ manualState.pilih="hadir"; $("boxAlasan").classList.add("hidden"); markPill(); });
$("btnPilihTidak").addEventListener("click", ()=>{ manualState.pilih="tidakhadir"; $("boxAlasan").classList.remove("hidden"); markPill(); });
function markPill(){
  $("btnPilihHadir").className="radio-pill rounded-full px-5 py-2 font-bold "+(manualState.pilih==="hadir"?"bg-emerald-500 text-white":"bg-slate-200 text-slate-600");
  $("btnPilihTidak").className="radio-pill rounded-full px-5 py-2 font-bold "+(manualState.pilih==="tidakhadir"?"bg-rose-500 text-white":"bg-slate-200 text-slate-600");
}
document.querySelectorAll("#statusPills .status-pill").forEach(p=>{
  p.addEventListener("click", ()=>{
    manualState.status=p.dataset.status;
    document.querySelectorAll("#statusPills .status-pill").forEach(x=>x.classList.remove("pill-active"));
    p.classList.add("pill-active");
  });
});

$("btnKirimManual").addEventListener("click", async ()=>{
  const nama=$("manualNama").value, kode=$("manualKode").value.trim();
  if(!nama||!kode){ Swal.fire({icon:"error",title:"Data kosong",text:"Pilih nama siswa dan isi kode sesuai data.js."}); return; }
  const siswa=QR_DATA.find(s=>s.nama===nama && s.qr===kode);
  if(!siswa){ Swal.fire({icon:"error",title:"Kode tidak cocok",text:"Nama & kode harus sesuai pasangan pada data.js."}); return; }
  if(hasScannedToday(siswa.qr)){ Swal.fire({icon:"warning",title:"Sudah tercatat",text:siswa.nama+" sudah presensi hari ini (1x/hari)."}); return; }

  const w=nowWIB().toLocaleTimeString("id-ID"), terlambat=afterCutoff();

  if(manualState.pilih==="hadir"){
    if(terlambat){
      Swal.fire({icon:"warning",title:"Lewat jam 08.00",text:"Sudah lewat pukul 08.00 — hadir manual tidak berlaku, pilih Tidak Hadir dengan status Terlambat/Sakit/Izin."});
      return;
    }
    saveScan({ kode:siswa.qr, nama:siswa.nama, waktu:w, metode:"Manual", hari:dayName() });
    await kirimHadir({ nama:siswa.nama, kode:siswa.qr, metode:"Manual", waktu:w+" "+dateKey(), operator:currentUser?.email||"" });
    try{ await setDoc(doc(collection(db,"presensi"),dateKey()+"_"+siswa.qr), { nama:siswa.nama, kode:siswa.qr, status:"Hadir", metode:"Manual", waktu:w, hari:dayName(), tanggal:dateKey() }); }catch(e){ console.warn(e); }
    Swal.fire({icon:"success",title:"Hadir!",html:`<b>${siswa.nama}</b> tercatat HADIR via manual.`});
  }else{
    const alasan=$("manualAlasan").value.trim();
    let status=manualState.status||(terlambat?"Terlambat":"");
    if(!status){ Swal.fire({icon:"error",title:"Status belum dipilih",text:"Pilih Sakit / Izin / Terlambat."}); return; }
    if(status==="Terlambat" && !terlambat){ /* masih boleh: siswa datang telat sebelum 8? tetap valid */ }
    if((status==="Sakit"||status==="Izin") && !alasan){ Swal.fire({icon:"error",title:"Alasan kosong",text:"Tulis alasan untuk surat ke spreadsheet."}); return; }
    saveScan({ kode:siswa.qr, nama:siswa.nama, waktu:w, metode:"Manual", hari:dayName(), status });
    await kirimTidakHadir({ nama:siswa.nama, kode:siswa.qr, status, alasan, metode:"Manual", waktu:w+" "+dateKey(), operator:currentUser?.email||"" });
    try{ await setDoc(doc(collection(db,"presensi"),dateKey()+"_"+siswa.qr), { nama:siswa.nama, kode:siswa.qr, status, alasan, metode:"Manual", waktu:w, hari:dayName(), tanggal:dateKey() }); }catch(e){ console.warn(e); }
    Swal.fire({icon:"info",title:"Surat terkirim",html:`Data <b>${siswa.nama}</b> (${status}) dikirim ke sheet <b>TIDAK HADIR</b>.`});
  }
  renderChipsHariIni(); renderTabel();
});

/* ==================== RENDER CHIPS & TABEL ==================== */
function renderChipsHariIni(){
  const scans=getScans();
  const wrap=$("chipsHadirHariIni");
  wrap.textContent=""; // clear
  const hadirOnly=scans.filter(s=>!s.status||s.status==="Hadir");
  $("belumAdaPresensi").style.display = scans.length? "none":"block";
  const kotakSaya=$("kotakHadiriSaya");
  if(currentUser){
    const me=scans.find(s=>s.nama && (currentUser.email||"").split("@")[0].toLowerCase().includes(s.nama.split(" ")[0].toLowerCase()));
    if(me){ kotakSaya.classList.remove("hidden"); $("namaSayaHadir").textContent=me.nama; $("waktuSayaHadir").textContent=me.metode+" · "+me.waktu+" · "+dateKey(); }
    else kotakSaya.classList.add("hidden");
  }
  hadirOnly.forEach(s=>{
    const chip=document.createElement("span");
    chip.className="chip-hadir";
    chip.innerHTML='<i class="fa-solid fa-circle-check"></i>'+s.nama+" · "+s.waktu;
    wrap.appendChild(chip);
  });
}

// Realtime: dengarkan koleksi presensi di Firestore
try{
  onSnapshot(collection(db,"presensi"), snap=>{ window.__fsPresensi = snap.docs.map(d=>d.data()); renderTabel(); });
}catch(e){ console.warn(e); }

function recordsForTable(){
  // gabungan: firestore realtime + localStorage hari ini (fallback)
  const fsRec = window.__fsPresensi||[];
  const local = getScans().map(s=>({ ...s, tanggal:dateKey() }));
  const map={};
  [...fsRec,...local].forEach(r=>{ if(r.nama&&r.tanggal) map[r.nama+"|"+r.tanggal]=r; });
  return Object.values(map);
}
function mondayOf(d){ const x=new Date(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }

function renderTabel(){
  const recs=recordsForTable();
  const mon=mondayOf(nowWIB());
  const weekKeys=[...Array(5)].map((_,i)=>{ const d=new Date(mon); d.setDate(d.getDate()+i); return dateKey(d); });

  const tb=$("tbodyAbsen"); tb.textContent="";
  const tl=$("tbodyLanggar"); tl.textContent="";

  QR_DATA.forEach(s=>{
    const tr=document.createElement("tr");
    let absenCnt=0,sakitCnt=0,izinCnt=0, any=false;
    const cells=[s.nama];
    weekKeys.forEach(k=>{
      const r=recs.find(x=>x.nama===s.nama && x.tanggal===k);
      let cls="-", cc="text-slate-300";
      if(r){ any=true;
        if(r.status==="Hadir"||(!r.status&&r.metode)){ cls="✓"; cc="hadir-tick"; }
        else if(r.status==="Sakit"){ cls="S"; cc="absen-cross"; sakitCnt++; }
        else if(r.status==="Izin"){ cls="I"; cc="absen-cross"; izinCnt++; }
        else if(r.status){ cls=r.status[0]; cc="absen-cross"; absenCnt++; }
      }
      cells.push('<td class="border border-slate-200 px-3 py-2 text-center font-bold '+cc+'">'+cls+'</td>');
    });
    tr.innerHTML='<td class="border border-slate-200 px-3 py-2 font-semibold">'+cells.shift()+"</td>"+cells.join("");
    tb.appendChild(tr);

    if(any){
      const tidakHadir = recs.some(x=>x.nama===s.nama && weekKeys.includes(x.tanggal) && x.status && x.status!=="Hadir");
      if(tidakHadir){
        const row=document.createElement("tr");
        const perDay=weekKeys.map(k=>{
          const r=recs.find(x=>x.nama===s.nama&&x.tanggal===k);
          if(!r||r.status==="Hadir") return '<td class="border border-rose-100 px-3 py-2 text-center">-</td>';
          return '<td class="border border-rose-100 px-3 py-2 text-center absen-cross">'+(r.status||"×")+'</td>';
        }).join("");
        row.innerHTML='<td class="border border-rose-100 px-3 py-2 font-semibold">'+s.nama+"</td>"+perDay+
          '<td class="border border-rose-100 px-3 py-2 text-center font-extrabold text-rose-600">'+absenCnt+"</td>"+
          '<td class="border border-rose-100 px-3 py-2 text-center font-extrabold text-amber-600">'+sakitCnt+"</td>"+
          '<td class="border border-rose-100 px-3 py-2 text-center font-extrabold text-indigo-600">'+izinCnt+"</td>";
        tl.appendChild(row);
      }
    }
  });
  if(!tl.children.length) tl.innerHTML='<tr><td colspan="9" class="px-3 py-4 text-center text-slate-400 italic">Tidak ada pelanggaran minggu ini 🎉</td></tr>';
}

/* ==================== PROFIL: ganti akun ==================== */
$("btnGantiAkun").addEventListener("click", async ()=>{
  const r=await Swal.fire({ icon:"question", title:"Ganti akun?", text:"Keluar dari sesi saat ini?",
    showCancelButton:true, confirmButtonText:"Ya, keluar", confirmButtonColor:"#f43f5e", cancelButtonColor:"#94a3b8" });
  if(r.isConfirmed){ await signOut(auth); location.reload(); }
});
