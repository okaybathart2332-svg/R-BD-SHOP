/* ============================================================
   R BD SHOP — Settings Management
   Path: admin/js/settings.js
   ============================================================ */

import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, setBtnLoading, aqs
} from './admin-utils.js';

const SETTINGS_DOC = 'shopSettings';

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    document.getElementById('sidebar-root').innerHTML = buildAdminSidebarHTML(admin);
    document.getElementById('header-root').innerHTML = buildAdminHeaderHTML('সেটিংস', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    await loadSettings();

    aqs('#btn-save-settings')?.addEventListener('click', saveSettings);
    aqs('#settings-form')?.addEventListener('submit', (e) => { e.preventDefault(); saveSettings(); });

    hideAdminLoader();
  });
});

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC));
    if (!snap.exists()) return;
    const s = snap.data();

    aqs('#s-shop-name').value     = s.shopName || 'R BD SHOP';
    aqs('#s-email').value         = s.contactEmail || '';
    aqs('#s-address').value       = s.contactAddress || '';
    aqs('#s-whatsapp').value      = s.whatsappNumber || '';
    aqs('#s-telegram-user').value = s.telegramUsername || '';
    aqs('#s-telegram-link').value = s.telegramLink || '';
    aqs('#s-support-wa').value    = s.supportWhatsapp || '';
    aqs('#s-facebook').value      = s.facebookLink || '';
    aqs('#s-youtube').value       = s.youtubeLink || '';
    aqs('#s-delivery').value      = s.deliveryInfo || '';

  } catch (err) {
    console.error('[Settings] Load error:', err);
    adminShowToast('সেটিংস লোড ব্যর্থ', 'error');
  }
}

async function saveSettings() {
  const btn = aqs('#btn-save-settings');
  setBtnLoading(btn, true);

  try {
    const data = {
      shopName:         aqs('#s-shop-name').value.trim() || 'R BD SHOP',
      contactEmail:     aqs('#s-email').value.trim(),
      contactAddress:   aqs('#s-address').value.trim(),
      whatsappNumber:   aqs('#s-whatsapp').value.trim(),
      telegramUsername: aqs('#s-telegram-user').value.trim(),
      telegramLink:     aqs('#s-telegram-link').value.trim(),
      supportWhatsapp:  aqs('#s-support-wa').value.trim(),
      facebookLink:     aqs('#s-facebook').value.trim(),
      youtubeLink:      aqs('#s-youtube').value.trim(),
      deliveryInfo:     aqs('#s-delivery').value.trim(),
      updatedAt:        serverTimestamp(),
    };

    await setDoc(doc(db, 'settings', SETTINGS_DOC), data, { merge: true });

    adminShowToast('সেটিংস সেভ হয়েছে! ✅', 'success');
  } catch (err) {
    console.error('[Settings] Save error:', err);
    adminShowToast('সেভ ব্যর্থ: ' + err.message, 'error');
  } finally {
    setBtnLoading(btn, false, '💾 সেভ করুন');
  }
    }
