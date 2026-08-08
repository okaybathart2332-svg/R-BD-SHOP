/* ============================================================
   R BD SHOP — Admin Authentication Module
   Path: admin/js/admin-auth.js
   Description: Firebase Auth login, logout, auth state guard,
                admin role verification from Firestore.
   ============================================================ */

import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
}                    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc
}                    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { adminShowToast } from './admin-utils.js';

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const LOGIN_PAGE  = 'index.html';        // Admin login page
const DASHBOARD   = 'dashboard.html';    // After login redirect
const ADMIN_COLLECTION = 'admins';       // Firestore collection

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let currentAdmin = null;

/**
 * বর্তমান logged-in admin object পড়ে
 * @returns {object|null}
 */
export function getCurrentAdmin() {
  return currentAdmin;
}

/* ─────────────────────────────────────────────────────────────
   LOGIN — Email + Password
───────────────────────────────────────────────────────────── */

/**
 * Admin login করে
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function adminLogin(email, password) {
  try {
    // 1. Firebase Auth দিয়ে sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Firestore-এ admins collection-এ check করো
    const adminDoc = await getDoc(doc(db, ADMIN_COLLECTION, user.uid));

    if (!adminDoc.exists()) {
      // এই user admin না — logout করো
      await signOut(auth);
      return {
        success: false,
        error: 'আপনি Admin হিসেবে অনুমোদিত নন। শুধু authorized admin লগইন করতে পারবেন।'
      };
    }

    const adminData = adminDoc.data();

    // 3. Role check (optional — superadmin, admin, editor)
    if (!adminData.role || !['superadmin', 'admin', 'editor'].includes(adminData.role)) {
      await signOut(auth);
      return {
        success: false,
        error: 'আপনার Admin role সঠিক নয়। সিস্টেম অ্যাডমিনের সাথে যোগাযোগ করুন।'
      };
    }

    // 4. Success — store admin data
    currentAdmin = {
      uid:   user.uid,
      email: user.email,
      name:  adminData.name || 'Admin',
      role:  adminData.role || 'admin',
    };

    return { success: true };

  } catch (error) {
    console.error('[R BD SHOP Admin] Login error:', error);

    let errorMessage = 'লগইন করতে সমস্যা হয়েছে।';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।';
        break;
      case 'auth/wrong-password':
        errorMessage = 'পাসওয়ার্ড ভুল হয়েছে।';
        break;
      case 'auth/invalid-email':
        errorMessage = 'ইমেইল ফরম্যাট সঠিক নয়।';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'অনেকবার ভুল চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'ইন্টারনেট সংযোগ নেই। চেক করুন।';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।';
        break;
      default:
        errorMessage = `লগইন ব্যর্থ: ${error.message}`;
    }

    return { success: false, error: errorMessage };
  }
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────────────────────── */

/**
 * Admin logout করে এবং login page-এ redirect করে
 */
export async function adminLogout() {
  try {
    await signOut(auth);
    currentAdmin = null;
    window.location.href = LOGIN_PAGE;
  } catch (error) {
    console.error('[R BD SHOP Admin] Logout error:', error);
    // Force redirect anyway
    window.location.href = LOGIN_PAGE;
  }
}

/* ─────────────────────────────────────────────────────────────
   AUTH GUARD — Protected pages-এ ব্যবহার করো
───────────────────────────────────────────────────────────── */

/**
 * Auth guard — protected page-এ প্রবেশের আগে চেক করে।
 * Login না থাকলে login page-এ redirect করে।
 *
 * @param {Function} onAuthReady - auth verified হলে call হবে
 *                                 (adminData object পাবে)
 * @returns {Function} unsubscribe function
 */
export function requireAdmin(onAuthReady) {
  const currentPage = window.location.pathname.split('/').pop() || '';

  // Login page-এ guard দরকার নেই
  if (currentPage === LOGIN_PAGE || currentPage === 'index.html' || currentPage === '') {
    return () => {};
  }

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Not logged in → redirect to login
      window.location.href = LOGIN_PAGE;
      return;
    }

    try {
      // Verify admin role
      const adminDoc = await getDoc(doc(db, ADMIN_COLLECTION, user.uid));

      if (!adminDoc.exists()) {
        console.warn('[R BD SHOP Admin] User is not admin, logging out.');
        await signOut(auth);
        window.location.href = LOGIN_PAGE;
        return;
      }

      const adminData = adminDoc.data();

      if (!adminData.role || !['superadmin', 'admin', 'editor'].includes(adminData.role)) {
        console.warn('[R BD SHOP Admin] Invalid admin role.');
        await signOut(auth);
        window.location.href = LOGIN_PAGE;
        return;
      }

      // ✅ Admin verified
      currentAdmin = {
        uid:   user.uid,
        email: user.email,
        name:  adminData.name || 'Admin',
        role:  adminData.role || 'admin',
      };

      // Callback with admin data
      if (typeof onAuthReady === 'function') {
        onAuthReady(currentAdmin);
      }

    } catch (error) {
      console.error('[R BD SHOP Admin] Auth guard error:', error);
      window.location.href = LOGIN_PAGE;
    }
  });

  return unsubscribe;
}

/* ─────────────────────────────────────────────────────────────
   LOGIN PAGE GUARD — logged-in admin login page-এ গেলে
   dashboard-এ redirect করবে
───────────────────────────────────────────────────────────── */

/**
 * Login page-এ ব্যবহার — already logged in হলে dashboard-এ পাঠাও
 * @param {Function} onNotLoggedIn - login না থাকলে call হবে
 */
export function redirectIfLoggedIn(onNotLoggedIn) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check if admin
      try {
        const adminDoc = await getDoc(doc(db, ADMIN_COLLECTION, user.uid));
        if (adminDoc.exists()) {
          // Already logged in admin → redirect to dashboard
          window.location.href = DASHBOARD;
          return;
        }
      } catch { /* ignore */ }
    }

    // Not logged in or not admin
    if (typeof onNotLoggedIn === 'function') {
      onNotLoggedIn();
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   HELPER: Get admin display info for header
───────────────────────────────────────────────────────────── */

/**
 * Admin-এর display name-এর প্রথম অক্ষর পায় (avatar-এর জন্য)
 * @returns {string}
 */
export function getAdminInitial() {
  if (!currentAdmin) return 'A';
  const name = currentAdmin.name || currentAdmin.email || 'Admin';
  return name.charAt(0).toUpperCase();
}

/**
 * Admin-এর display name পায়
 * @returns {string}
 */
export function getAdminDisplayName() {
  if (!currentAdmin) return 'Admin';
  return currentAdmin.name || currentAdmin.email?.split('@')[0] || 'Admin';
    }
