/* ============================================================
   R BD SHOP — Firebase Configuration (Admin Panel)
   Path: admin/js/firebase-config.js
   ============================================================ */

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

/* ─────────────────────────────────────────────────────────────
   Firebase Config — R BD SHOP
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
   ImgBB API Key (Free Image Hosting - Firebase Storage-এর বিকল্প)
───────────────────────────────────────────────────────────── */
export const IMGBB_API_KEY = "ec81f44c9c2770f022b28fb2bafc0564";

/**
 * ImgBB-এ ছবি upload করে URL return করে
 * @param {File} file - image file
 * @returns {Promise<string>} - image URL
 */
export async function uploadToImgBB(file) {
  if (!file) throw new Error('কোনো ফাইল নেই');

  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    throw new Error('ImgBB upload failed: ' + response.status);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error('ImgBB upload ব্যর্থ');
  }

  return data.data.url;
}

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
