/* =====================================================================
   firebase.js — Firebase v10 (modular ES import)
   Auth Google + Firestore Realtime Database
   ⚙️ GANTI nilai config di bawah dengan config project Anda:
   Console Firebase → Project Settings → General → Your apps → Web app
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* 👇 PASTE CONFIG FIREBASE ANDA DI SINI */
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "classviii-g.firebaseapp.com",
  projectId: "classviii-g",
  storageBucket: "classviii-g.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  GoogleAuthProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp
};
