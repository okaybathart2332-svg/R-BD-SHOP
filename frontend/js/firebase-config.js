/* ============================================================
   R BD SHOP — Firebase Configuration (Frontend)
   Path: frontend/js/firebase-config.js
   ============================================================ */

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence }
                                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage }           from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

/* ─────────────────────────────────────────────────────────────
   Firebase Project Config — R BD SHOP
───────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyC9ddd7qqkhN7_xp4T9g5FmKgIF5eRWFfc",
  authDomain:        "r-bd-shop.firebaseapp.com",
  projectId:         "r-bd-shop",
  storageBucket:     "r-bd-shop.firebasestorage.app",
  messagingSenderId: "815196600307",
  appId:             "1:815196600307:web:2fa85789ac40314ed10486"
};

/* ─────────────────────────────────────────────────────────────
   Initialize Firebase
───────────────────────────────────────────────────────────── */
const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

/* Offline persistence */
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('[R BD SHOP] Firestore persistence: multiple tabs.');
  } else if (err.code === 'unimplemented') {
    console.warn('[R BD SHOP] Firestore persistence not supported.');
  }
});

export const APP_INFO = {
  name:    'R BD SHOP',
  tagline: 'আপনার বিশ্বস্ত অনলাইন শপ',
  version: '1.0.0',
};

export default app;
