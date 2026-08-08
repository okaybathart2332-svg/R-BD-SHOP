/* ============================================================
   R BD SHOP — Customers Management
   Path: admin/js/customers.js
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, getDocs, doc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, adminConfirm,
  escapeAdminHtml, formatAdminPrice, formatAdminDate,
  statusBadge, tableEmptyRow, tableLoadingRow,
  adminDebounce, aqs
} from './admin-utils.js';

let allCustomers = [], filtered = [];

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    const sr = document.getElementById('sidebar-root');
    const hr = document.getElementById('header-root');
    if (sr) sr.innerHTML = buildAdminSidebarHTML(admin);
    if (hr) hr.innerHTML = buildAdminHeaderHTML('গ্রাহক', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    await loadCustomers();
    setupSearch();
    hideAdminLoader();
  });
});

async function loadCustomers() {
  const tbody = aqs('#customers-tbody');
  if (tbody) tbody.innerHTML = tableLoadingRow(8);

  try {
    const snap = await getDocs(query(collection(db, 'customers'), orderBy('createdAt', 'desc')));
    allCustomers = [];
    snap.forEach((d) => allCustomers.push({ id: d.id, ...d.data() }));
    filtered = [...allCustomers];
    renderTable();
  } catch (err) {
    console.error('[Customers] Load error:', err);
    if (tbody) tbody.innerHTML = tableEmptyRow('গ্রাহক লোড ব্যর্থ', 8);
  }
}

function renderTable() {
  const tbody = aqs('#customers-tbody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = tableEmptyRow('কোনো গ্রাহক নেই', 8);
    return;
  }

  tbody.innerHTML = filtered.map((c) => {
    const initial = (c.name || 'U').charAt(0).toUpperCase();
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:var(--a-space-3)">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--a-primary-glow);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--a-primary);font-size:var(--a-font-sm);flex-shrink:0">${initial}</div>
          <strong style="color:var(--a-text-primary)">${escapeAdminHtml(c.name || '—')}</strong>
        </div>
      </td>
      <td>${escapeAdminHtml(c.phone || '—')}</td>
      <td><span class="a-text-sm a-text-muted">${escapeAdminHtml(c.address || '—')}</span></td>
      <td><strong>${c.totalOrders || 0}</strong></td>
      <td>${formatAdminPrice(c.totalPurchase || 0)}</td>
      <td><span class="a-text-xs a-text-muted">${formatAdminDate(c.lastOrderAt || c.createdAt)}</span></td>
      <td>${statusBadge(c.status || 'active')}</td>
      <td>
        <div class="table-actions" style="justify-content:flex-end">
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" data-del-cust="${c.id}" style="color:var(--a-danger)" title="মুছুন">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-del-cust]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await adminConfirm({ title: 'গ্রাহক মুছবেন?', message: 'এটি স্থায়ীভাবে মুছে যাবে।', type: 'danger' });
      if (!ok) return;
      try {
        await deleteDoc(doc(db, 'customers', btn.dataset.delCust));
        allCustomers = allCustomers.filter((c) => c.id !== btn.dataset.delCust);
        filtered = [...allCustomers];
        renderTable();
        adminShowToast('গ্রাহক মুছে ফেলা হয়েছে', 'success');
      } catch { adminShowToast('মুছতে ব্যর্থ', 'error'); }
    });
  });
}

function setupSearch() {
  const input = aqs('#customer-search');
  if (!input) return;
  const d = adminDebounce((v) => {
    if (!v) { filtered = [...allCustomers]; }
    else {
      const q = v.toLowerCase();
      filtered = allCustomers.filter((c) => [c.name, c.phone, c.address].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    renderTable();
  }, 300);
  input.addEventListener('input', (e) => d(e.target.value.trim()));
  }
