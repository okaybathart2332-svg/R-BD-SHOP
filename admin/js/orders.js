/* ============================================================
   R BD SHOP — Orders Management
   Path: admin/js/orders.js
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, getDocs, addDoc,
  doc, updateDoc, deleteDoc, serverTimestamp,
  getCountFromServer, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, adminConfirm,
  escapeAdminHtml, formatAdminPrice, formatAdminDate,
  statusBadge, tableEmptyRow, tableLoadingRow,
  generateOrderNumber, adminDebounce, aqs
} from './admin-utils.js';

const PER_PAGE = 15;
let allOrders = [], filteredOrders = [], currentPage = 1, totalPages = 1;
let currentFilter = 'all', searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    const sr = document.getElementById('sidebar-root');
    const hr = document.getElementById('header-root');
    if (sr) sr.innerHTML = buildAdminSidebarHTML(admin);
    if (hr) hr.innerHTML = buildAdminHeaderHTML('অর্ডার', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    await Promise.all([loadOrders(), loadOrderStats()]);
    setupSearch();
    setupFilters();
    aqs('#btn-add-order')?.addEventListener('click', () => showOrderModal());
    hideAdminLoader();
  });
});

/* ── STATS ── */
async function loadOrderStats() {
  const grid = aqs('#order-stats');
  if (!grid) return;
  try {
    const [total, pending, delivered, cancelled] = await Promise.all([
      getCountFromServer(query(collection(db, 'orders'))),
      getCountFromServer(query(collection(db, 'orders'), where('status', '==', 'pending'))),
      getCountFromServer(query(collection(db, 'orders'), where('status', '==', 'delivered'))),
      getCountFromServer(query(collection(db, 'orders'), where('status', '==', 'cancelled'))),
    ]);
    grid.innerHTML = `
      ${miniStatCard('মোট অর্ডার', total.data().count, 'primary')}
      ${miniStatCard('পেন্ডিং', pending.data().count, 'warning')}
      ${miniStatCard('ডেলিভারড', delivered.data().count, 'success')}
      ${miniStatCard('বাতিল', cancelled.data().count, 'danger')}`;
  } catch { grid.innerHTML = ''; }
}

function miniStatCard(label, value, color) {
  return `<div class="admin-stat-card">
    <div class="admin-stat-card__icon admin-stat-card__icon--${color}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    </div>
    <div class="admin-stat-card__info">
      <span class="admin-stat-card__value">${value}</span>
      <span class="admin-stat-card__label">${escapeAdminHtml(label)}</span>
    </div>
  </div>`;
}

/* ── LOAD ORDERS ── */
async function loadOrders() {
  const tbody = aqs('#orders-tbody');
  if (tbody) tbody.innerHTML = tableLoadingRow(9);
  try {
    const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    allOrders = [];
    snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
    applyAndRender();
  } catch (err) {
    console.error('[Orders] Load error:', err);
    if (tbody) tbody.innerHTML = tableEmptyRow('লোড ব্যর্থ', 9);
  }
}

function applyAndRender() {
  let orders = [...allOrders];
  if (currentFilter !== 'all') orders = orders.filter((o) => o.status === currentFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    orders = orders.filter((o) => [o.orderNumber, o.customerName, o.customerPhone, o.productName].filter(Boolean).join(' ').toLowerCase().includes(q));
  }
  filteredOrders = orders;
  totalPages = Math.ceil(orders.length / PER_PAGE);
  if (currentPage > totalPages) currentPage = 1;
  renderTable();
  renderPagination();
}

function renderTable() {
  const tbody = aqs('#orders-tbody');
  if (!tbody) return;
  if (!filteredOrders.length) { tbody.innerHTML = tableEmptyRow('কোনো অর্ডার নেই', 9); return; }

  const start = (currentPage - 1) * PER_PAGE;
  const page = filteredOrders.slice(start, start + PER_PAGE);

  tbody.innerHTML = page.map((o) => `
    <tr>
      <td><strong style="color:var(--a-primary)">${escapeAdminHtml(o.orderNumber || o.id)}</strong></td>
      <td>
        <div>${escapeAdminHtml(o.customerName || '—')}</div>
        <div class="a-text-xs a-text-muted">${escapeAdminHtml(o.customerPhone || '')}</div>
      </td>
      <td><span class="a-text-sm">${escapeAdminHtml(o.productName || '—')}</span></td>
      <td>${o.quantity || 1}</td>
      <td><strong>${formatAdminPrice(o.totalPrice || 0)}</strong></td>
      <td><span class="a-badge a-badge--neutral">${escapeAdminHtml(o.source || '—')}</span></td>
      <td>
        <select class="product-status-select" data-order-id="${o.id}" data-status="${o.status}" style="height:30px;font-size:var(--a-font-xs);min-width:110px">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>পেন্ডিং</option>
          <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>কনফার্মড</option>
          <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>প্রসেসিং</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>শিপড</option>
          <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>ডেলিভারড</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>বাতিল</option>
        </select>
      </td>
      <td><span class="a-text-xs a-text-muted">${formatAdminDate(o.createdAt)}</span></td>
      <td>
        <div class="table-actions" style="justify-content:flex-end">
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="মুছুন" data-delete-order="${o.id}" style="color:var(--a-danger)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');

  // Status change
  tbody.querySelectorAll('[data-order-id]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await updateDoc(doc(db, 'orders', sel.dataset.orderId), { status: sel.value, updatedAt: serverTimestamp() });
        const idx = allOrders.findIndex((o) => o.id === sel.dataset.orderId);
        if (idx !== -1) allOrders[idx].status = sel.value;
        adminShowToast('স্ট্যাটাস আপডেট হয়েছে', 'success');
        loadOrderStats();
      } catch { adminShowToast('আপডেট ব্যর্থ', 'error'); }
    });
  });

  // Delete
  tbody.querySelectorAll('[data-delete-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await adminConfirm({ title: 'অর্ডার মুছবেন?', message: 'এই অর্ডারটি স্থায়ীভাবে মুছে যাবে।', type: 'danger' });
      if (!ok) return;
      try {
        await deleteDoc(doc(db, 'orders', btn.dataset.deleteOrder));
        allOrders = allOrders.filter((o) => o.id !== btn.dataset.deleteOrder);
        applyAndRender();
        loadOrderStats();
        adminShowToast('অর্ডার মুছে ফেলা হয়েছে', 'success');
      } catch { adminShowToast('মুছতে ব্যর্থ', 'error'); }
    });
  });
}

function renderPagination() {
  const info = aqs('#order-pagination-info');
  const btns = aqs('#order-pagination-btns');
  if (info) {
    const s = filteredOrders.length ? (currentPage - 1) * PER_PAGE + 1 : 0;
    const e = Math.min(currentPage * PER_PAGE, filteredOrders.length);
    info.textContent = `${s}-${e} / ${filteredOrders.length}`;
  }
  if (!btns || totalPages <= 1) { if (btns) btns.innerHTML = ''; return; }
  let html = `<button class="table-pagination__btn" data-p="${currentPage-1}" ${currentPage===1?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>`;
  for (let i = 1; i <= totalPages; i++) html += `<button class="table-pagination__btn ${i===currentPage?'active':''}" data-p="${i}">${i}</button>`;
  html += `<button class="table-pagination__btn" data-p="${currentPage+1}" ${currentPage===totalPages?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>`;
  btns.innerHTML = html;
  btns.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { const p = parseInt(b.dataset.p); if (p >= 1 && p <= totalPages) { currentPage = p; renderTable(); renderPagination(); } }));
}

function setupSearch() {
  const input = aqs('#order-search');
  if (!input) return;
  const d = adminDebounce((v) => { searchQuery = v; currentPage = 1; applyAndRender(); }, 300);
  input.addEventListener('input', (e) => d(e.target.value.trim()));
}

function setupFilters() {
  aqs('#order-status-filters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.table-filter-btn');
    if (!btn) return;
    aqs('#order-status-filters').querySelectorAll('.table-filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    currentPage = 1;
    applyAndRender();
  });
}

/* ── ADD ORDER MODAL ── */
function showOrderModal() {
  const root = aqs('#modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="a-modal-overlay" id="order-modal-overlay">
      <div class="a-modal">
        <div class="a-card__header">
          <h3 class="a-card__title">➕ নতুন অর্ডার যোগ</h3>
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" id="close-order-modal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div class="a-card__body">
          <div class="a-form-grid-2">
            <div class="a-form-group"><label class="a-form-label a-form-label--required">গ্রাহকের নাম</label><input type="text" id="o-name" required /></div>
            <div class="a-form-group"><label class="a-form-label a-form-label--required">ফোন</label><input type="tel" id="o-phone" required /></div>
          </div>
          <div class="a-form-group"><label class="a-form-label">ঠিকানা</label><textarea id="o-address" rows="2"></textarea></div>
          <div class="a-form-grid-2">
            <div class="a-form-group"><label class="a-form-label a-form-label--required">পণ্যের নাম</label><input type="text" id="o-product" required /></div>
            <div class="a-form-group"><label class="a-form-label">পণ্য কোড</label><input type="text" id="o-code" /></div>
          </div>
          <div class="a-form-grid-3">
            <div class="a-form-group"><label class="a-form-label">পরিমাণ</label><input type="number" id="o-qty" value="1" min="1" /></div>
            <div class="a-form-group"><label class="a-form-label">একক মূল্য (৳)</label><input type="number" id="o-price" min="0" /></div>
            <div class="a-form-group"><label class="a-form-label">সোর্স</label>
              <select id="o-source"><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option><option value="manual">Manual</option></select>
            </div>
          </div>
          <div class="a-form-group"><label class="a-form-label">নোট</label><textarea id="o-notes" rows="2"></textarea></div>
        </div>
        <div class="a-card__footer">
          <button class="a-btn a-btn--ghost" id="cancel-order-modal">বাতিল</button>
          <button class="a-btn a-btn--primary" id="save-order-btn">অর্ডার সেভ</button>
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  aqs('#close-order-modal')?.addEventListener('click', close);
  aqs('#cancel-order-modal')?.addEventListener('click', close);
  aqs('#order-modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'order-modal-overlay') close(); });

  aqs('#save-order-btn')?.addEventListener('click', async () => {
    const name = aqs('#o-name').value.trim();
    const phone = aqs('#o-phone').value.trim();
    const product = aqs('#o-product').value.trim();
    if (!name || !phone || !product) { adminShowToast('নাম, ফোন ও পণ্যের নাম দিন', 'error'); return; }

    const qty = parseInt(aqs('#o-qty').value) || 1;
    const unitPrice = parseInt(aqs('#o-price').value) || 0;

    try {
      const orderData = {
        orderNumber: generateOrderNumber(),
        customerName: name,
        customerPhone: phone,
        customerAddress: aqs('#o-address').value.trim(),
        productName: product,
        productCode: aqs('#o-code').value.trim(),
        quantity: qty,
        unitPrice,
        totalPrice: qty * unitPrice,
        source: aqs('#o-source').value,
        status: 'pending',
        notes: aqs('#o-notes').value.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'orders'), orderData);

      // Also add/update customer
      try {
        await addDoc(collection(db, 'customers'), {
          name, phone, address: orderData.customerAddress,
          totalOrders: 1, totalPurchase: orderData.totalPrice,
          lastOrderAt: serverTimestamp(), status: 'active', createdAt: serverTimestamp(),
        });
      } catch { /* ignore */ }

      close();
      adminShowToast('অর্ডার যোগ হয়েছে ✅', 'success');
      await loadOrders();
      loadOrderStats();
    } catch (err) {
      adminShowToast('সেভ ব্যর্থ: ' + err.message, 'error');
    }
  });
               }
