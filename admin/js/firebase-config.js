/* ============================================================
   R BD SHOP — Firebase Configuration (Admin Panel)
   Path: admin/js/firebase-config.js
   Description: Firebase SDK initialization for admin panel.
                Same config as frontend, separate file for
                modularity and independent deployment.
   ============================================================ */

/**
 * ⚠️  IMPORTANT
 * ---------------------------------------------------------------------------
 * এই ফাইলের config values frontend/js/firebase-config.js-এর সাথে
 * হুবহু একই হতে হবে — একই Firebase Project ব্যবহার হবে।
 *
 * Firebase Console → Project Settings → Your apps → Web App → Config
 * থেকে values নিয়ে নিচে বসান।
 * ---------------------------------------------------------------------------
 */

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

/* ─────────────────────────────────────────────────────────────
   Firebase Config — আপনার তথ্য বসান
───────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "এখানে আপনার Firebase API Key বসান",
  authDomain:        "এখানে আপনার authDomain বসান",
  projectId:         "এখানে আপনার Project ID বসান",
  storageBucket:     "এখানে আপনার Storage Bucket বসান",
  messagingSenderId: "এখানে আপনার Sender ID বসান",
  appId:             "এখানে আপনার App ID বসান",
  measurementId:     "এখানে আপনার Measurement ID বসান"
};

/* ─────────────────────────────────────────────────────────────
   Initialize Firebase
───────────────────────────────────────────────────────────── */
const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

export const ADMIN_APP_INFO = {
  name:    'R BD SHOP Admin',
  version: '1.0.0',
};

export default app;
