/* ============================================================
   R BD SHOP — Firebase Configuration (Frontend)
   Path: frontend/js/firebase-config.js
   Description: Firebase SDK initialization for customer site.
                Real-time Firestore + Storage access.
   ============================================================ */

/**
 * ⚠️  IMPORTANT SECURITY NOTICE
 * ---------------------------------------------------------------------------
 * এই ফাইলের Firebase config values GitHub-এ public থাকবে।
 * Firebase Web API Key publicly safe — কিন্তু Firestore Security Rules
 * অবশ্যই সঠিকভাবে set করতে হবে (সেকশন ৩৬-এ বলা আছে)।
 *
 * নিচের প্রতিটি "এখানে আপনার তথ্য বসান" — Firebase Console থেকে
 * নিজের প্রজেক্টের config paste করুন।
 *
 * পাওয়ার উপায়:
 * Firebase Console → আপনার Project → Project Settings →
 * Your apps → Web App → SDK setup and configuration → Config
 * ---------------------------------------------------------------------------
 */

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence }
                                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage }           from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

/* ─────────────────────────────────────────────────────────────
   Firebase Project Config
   নিচের values Firebase Console থেকে copy করুন
───────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "এখানে আপনার Firebase API Key বসান",
  authDomain:        "এখানে আপনার authDomain বসান",       // example: your-project.firebaseapp.com
  projectId:         "এখানে আপনার Project ID বসান",        // example: r-bd-shop
  storageBucket:     "এখানে আপনার Storage Bucket বসান",    // example: r-bd-shop.appspot.com
  messagingSenderId: "এখানে আপনার Sender ID বসান",
  appId:             "এখানে আপনার App ID বসান",
  measurementId:     "এখানে আপনার Measurement ID বসান"    // optional (Analytics)
};

/* ─────────────────────────────────────────────────────────────
   Firebase App Initialization
───────────────────────────────────────────────────────────── */
const app = initializeApp(firebaseConfig);

/* ─────────────────────────────────────────────────────────────
   Firebase Services
───────────────────────────────────────────────────────────── */
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

/* ─────────────────────────────────────────────────────────────
   Offline Persistence (optional — improves UX on slow connections)
   IndexedDB cache — page reload without internet still shows data
───────────────────────────────────────────────────────────── */
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence can only be enabled in one tab at a time
    console.warn('[R BD SHOP] Firestore persistence: multiple tabs detected.');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support persistence
    console.warn('[R BD SHOP] Firestore persistence: not supported in this browser.');
  }
});

/* ─────────────────────────────────────────────────────────────
   App Info (used across the site if settings not yet loaded)
───────────────────────────────────────────────────────────── */
export const APP_INFO = {
  name:    'R BD SHOP',
  tagline: 'আপনার বিশ্বস্ত অনলাইন শপ',
  version: '1.0.0',
};

export default app;
