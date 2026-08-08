/* ============================================================
   R BD SHOP — Reviews Moderation
   Path: admin/js/reviews.js
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, getDocs,
  doc, updateDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, adminConfirm,
  escapeAdminHtml, formatAdminDate, statusBadge, aqs
} from './admin-utils.js';

let allReviews = [], currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    const sr = document.getElementById('sidebar-root');
    const hr = document.getElementById('header-root');
    if (sr) sr.innerHTML = buildAdminSidebarHTML(admin);
    if (hr) hr.innerHTML = buildAdminHeaderHTML('রিভিউ', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    await loadReviews();
    setupTabs();
    hideAdminLoader();
  });
});

async function loadReviews() {
  const grid = aqs('#reviews-grid');
  if (!grid) return;

  try {
    const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
    allReviews = [];
    snap.forEach((d) => allReviews.push({ id: d.id, ...d.data() }));
    renderReviews();
  } catch (err) {
    console.error('[Reviews] Load error:', err);
    grid.innerHTML = `<div class="a-empty" style="grid-column:1/-1"><p class="a-text-muted">রিভিউ লোড ব্যর্থ</p></div>`;
  }
}

function renderReviews() {
  const grid = aqs('#reviews-grid');
  if (!grid) return;

  let reviews = [...allReviews];
  if (currentFilter !== 'all') {
    reviews = reviews.filter((r) => r.status === currentFilter);
  }

  if (!reviews.length) {
    grid.innerHTML = `<div class="a-empty" style="grid-column:1/-1;padding:var(--a-space-10)">
      <div class="a-empty__icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      <h3 class="a-empty__title">কোনো রিভিউ নেই</h3>
    </div>`;
    return;
  }

  grid.innerHTML = reviews.map((r) => {
    const initial = (r.customerName || 'U').charAt(0).toUpperCase();
    const starsHtml = Array.from({ length: 5 }, (_, i) =>
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="${i < (r.rating || 0) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
    ).join('');

    const isPending  = r.status === 'pending';
    const isApproved = r.status === 'approved';

    return `
    <div class="review-mod-card">
      <div class="review-mod-card__top">
        <div class="review-mod-card__customer">
          <div class="review-mod-card__avatar">${initial}</div>
          <div>
            <div class="review-mod-card__name">${escapeAdminHtml(r.customerName || 'গ্রাহক')}</div>
            <div class="review-mod-card__product">${escapeAdminHtml(r.productName || '—')}</div>
          </div>
        </div>
        <div>
          <div class="review-mod-card__stars" style="color:#F59E0B">${starsHtml}</div>
          <div style="margin-top:4px">${statusBadge(r.status || 'pending', 'review')}</div>
        </div>
      </div>
      <div class="review-mod-card__text">${escapeAdminHtml(r.comment || 'কোনো মন্তব্য নেই')}</div>
      <div style="font-size:var(--a-font-xs);color:var(--a-text-muted);margin-bottom:var(--a-space-3)">${formatAdminDate(r.createdAt, 'datetime')}</div>
      <div class="review-mod-card__actions">
        ${isPending ? `
          <button class="a-btn a-btn--success a-btn--sm" data-approve="${r.id}">✅ অনুমোদন</button>
          <button class="a-btn a-btn--warning a-btn--sm" data-reject="${r.id}">❌ প্রত্যাখ্যান</button>
        ` : ''}
        ${isApproved ? `<button class="a-btn a-btn--warning a-btn--sm" data-reject="${r.id}">প্রত্যাখ্যান</button>` : ''}
        ${!isPending && !isApproved ? `<button class="a-btn a-btn--success a-btn--sm" data-approve="${r.id}">অনুমোদন</button>` : ''}
        <button class="a-btn a-btn--danger a-btn--sm" data-delete-rev="${r.id}">মুছুন</button>
      </div>
    </div>`;
  }).join('');

  // Approve
  grid.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'reviews', btn.dataset.approve), { status: 'approved' });
        const idx = allReviews.findIndex((r) => r.id === btn.dataset.approve);
        if (idx !== -1) allReviews[idx].status = 'approved';
        renderReviews();
        adminShowToast('রিভিউ অনুমোদিত হয়েছে ✅', 'success');
      } catch { adminShowToast('আপডেট ব্যর্থ', 'error'); }
    });
  });

  // Reject
  grid.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'reviews', btn.dataset.reject), { status: 'rejected' });
        const idx = allReviews.findIndex((r) => r.id === btn.dataset.reject);
        if (idx !== -1) allReviews[idx].status = 'rejected';
        renderReviews();
        adminShowToast('রিভিউ প্রত্যাখ্যাত হয়েছে', 'warning');
      } catch { adminShowToast('আপডেট ব্যর্থ', 'error'); }
    });
  });

  // Delete
  grid.querySelectorAll('[data-delete-rev]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await adminConfirm({ title: 'রিভিউ মুছবেন?', message: 'এটি স্থায়ীভাবে মুছে যাবে।', type: 'danger' });
      if (!ok) return;
      try {
        await deleteDoc(doc(db, 'reviews', btn.dataset.deleteRev));
        allReviews = allReviews.filter((r) => r.id !== btn.dataset.deleteRev);
        renderReviews();
        adminShowToast('রিভিউ মুছে ফেলা হয়েছে', 'success');
      } catch { adminShowToast('মুছতে ব্যর্থ', 'error'); }
    });
  });
}

function setupTabs() {
  aqs('#review-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.admin-tab');
    if (!tab) return;
    aqs('#review-tabs').querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderReviews();
  });
  }
