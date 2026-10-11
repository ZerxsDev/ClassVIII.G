// =====================================================================
// firebase.js  ->  Konfigurasi & inisialisasi Firebase (v10 modular SDK)
// Ganti nilai di bawah dengan konfigurasi ASLI dari project Firebase Anda:
// Firebase Console -> Project Settings -> Your apps -> SDK setup and configuration
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ⚠️ GANTI DENGAN KONFIGURASI FIRESTORE ANDA (Firebase Console > Project Settings)
const firebaseConfig = {
  apiKey:            "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain:        "class-viii-g.firebaseapp.com",
  projectId:         "class-viii-g",
  storageBucket:     "class-viii-g.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:xxxxxxxxxxxxxxxx"
};

const app  = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const provider = new GoogleAuthProvider();

// Re-export API yang dipakai script.js agar cukup 1 module import
export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut,
  doc, setDoc, getDoc, getDocs,
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp
};
