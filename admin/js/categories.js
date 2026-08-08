/* ============================================================
   R BD SHOP — Categories Management JavaScript
   Path: admin/js/categories.js
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, getDocs,
  addDoc, doc, updateDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, adminConfirm,
  escapeAdminHtml, formatAdminDate, statusBadge,
  tableEmptyRow, tableLoadingRow, createAdminSlug, aqs
} from './admin-utils.js';

let allCategories = [];

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    const sr = document.getElementById('sidebar-root');
    const hr = document.getElementById('header-root');
    if (sr) sr.innerHTML = buildAdminSidebarHTML(admin);
    if (hr) hr.innerHTML = buildAdminHeaderHTML('ক্যাটাগরি', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    await loadCategories();

    aqs('#btn-add-category')?.addEventListener('click', () => showCategoryModal());

    hideAdminLoader();
  });
});

/* ── LOAD ── */
async function loadCategories() {
  const tbody = aqs('#categories-tbody');
  if (tbody) tbody.innerHTML = tableLoadingRow(6);

  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
    allCategories = [];
    snap.forEach((d) => allCategories.push({ id: d.id, ...d.data() }));
    renderTable();
  } catch (err) {
    console.error('[Categories] Load error:', err);
    if (tbody) tbody.innerHTML = tableEmptyRow('লোড ব্যর্থ', 6);
  }
}

function renderTable() {
  const tbody = aqs('#categories-tbody');
  if (!tbody) return;

  if (allCategories.length === 0) {
    tbody.innerHTML = tableEmptyRow('কোনো ক্যাটাগরি নেই', 6);
    return;
  }

  tbody.innerHTML = allCategories.map((cat) => `
    <tr>
      <td><strong>${escapeAdminHtml(cat.name)}</strong></td>
      <td><code class="a-text-xs a-text-muted">${escapeAdminHtml(cat.slug || '—')}</code></td>
      <td>${cat.productCount || 0}</td>
      <td>${statusBadge(cat.status || 'active')}</td>
      <td><span class="a-text-xs a-text-muted">${formatAdminDate(cat.createdAt)}</span></td>
      <td>
        <div class="table-actions" style="justify-content:flex-end">
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="এডিট" data-edit-cat="${cat.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="মুছুন" data-delete-cat="${cat.id}" style="color:var(--a-danger)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');

  // Events
  tbody.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = allCategories.find((c) => c.id === btn.dataset.editCat);
      if (cat) showCategoryModal(cat);
    });
  });

  tbody.querySelectorAll('[data-delete-cat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cat = allCategories.find((c) => c.id === btn.dataset.deleteCat);
      if (!cat) return;
      const ok = await adminConfirm({
        title: 'ক্যাটাগরি মুছবেন?',
        message: `"${cat.name}" মুছে ফেলা হবে।`,
        type: 'danger',
      });
      if (!ok) return;
      try {
        await deleteDoc(doc(db, 'categories', cat.id));
        allCategories = allCategories.filter((c) => c.id !== cat.id);
        renderTable();
        adminShowToast('ক্যাটাগরি মুছে ফেলা হয়েছে', 'success');
      } catch (err) {
        adminShowToast('মুছতে সমস্যা হয়েছে', 'error');
      }
    });
  });
}

/* ── MODAL ── */
function showCategoryModal(existingCat = null) {
  const isEdit = !!existingCat;
  const root   = aqs('#modal-root');
  if (!root) return;

  root.innerHTML = `
    <div class="a-modal-overlay" id="cat-modal-overlay">
      <div class="a-modal a-modal--sm">
        <div class="a-card__header">
          <h3 class="a-card__title">${isEdit ? '✏️ ক্যাটাগরি এডিট' : '➕ নতুন ক্যাটাগরি'}</h3>
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" id="close-cat-modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="a-card__body">
          <div class="a-form-group">
            <label class="a-form-label a-form-label--required">ক্যাটাগরির নাম</label>
            <input type="text" id="cat-name" placeholder="ক্যাটাগরি নাম" value="${isEdit ? escapeAdminHtml(existingCat.name) : ''}" />
          </div>
          <div class="a-form-group">
            <label class="a-form-label">বিবরণ</label>
            <textarea id="cat-desc" rows="2" placeholder="ঐচ্ছিক বিবরণ">${isEdit ? escapeAdminHtml(existingCat.description || '') : ''}</textarea>
          </div>
          <div class="a-form-group">
            <label class="a-form-label">স্ট্যাটাস</label>
            <select id="cat-status">
              <option value="active" ${isEdit && existingCat.status === 'active' ? 'selected' : ''}>সক্রিয়</option>
              <option value="inactive" ${isEdit && existingCat.status === 'inactive' ? 'selected' : ''}>নিষ্ক্রিয়</option>
            </select>
          </div>
        </div>
        <div class="a-card__footer">
          <button class="a-btn a-btn--ghost" id="cancel-cat-modal">বাতিল</button>
          <button class="a-btn a-btn--primary" id="save-cat-btn">${isEdit ? 'আপডেট' : 'যোগ করুন'}</button>
        </div>
      </div>
    </div>`;

  const closeModal = () => { root.innerHTML = ''; };

  aqs('#close-cat-modal')?.addEventListener('click', closeModal);
  aqs('#cancel-cat-modal')?.addEventListener('click', closeModal);
  aqs('#cat-modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'cat-modal-overlay') closeModal(); });

  aqs('#save-cat-btn')?.addEventListener('click', async () => {
    const name   = aqs('#cat-name').value.trim();
    const desc   = aqs('#cat-desc').value.trim();
    const status = aqs('#cat-status').value;

    if (!name) { adminShowToast('ক্যাটাগরি নাম দিন', 'error'); return; }

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'categories', existingCat.id), {
          name,
          slug: createAdminSlug(name),
          description: desc,
          status,
        });
        adminShowToast('ক্যাটাগরি আপডেট হয়েছে', 'success');
      } else {
        await addDoc(collection(db, 'categories'), {
          name,
          slug: createAdminSlug(name),
          description: desc,
          status,
          productCount: 0,
          createdAt: serverTimestamp(),
        });
        adminShowToast('ক্যাটাগরি যোগ হয়েছে', 'success');
      }

      closeModal();
      await loadCategories();

    } catch (err) {
      console.error('[Categories] Save error:', err);
      adminShowToast('সেভ ব্যর্থ', 'error');
    }
  });
                                                }
