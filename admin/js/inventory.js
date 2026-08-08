/* ============================================================
   R BD SHOP — Inventory Management
   Path: admin/js/inventory.js
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, getDocs, doc, updateDoc,
  addDoc, serverTimestamp, where, limit
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout, getCurrentAdmin } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast,
  escapeAdminHtml, formatAdminDate,
  tableEmptyRow, tableLoadingRow, adminDebounce, aqs, aShow, aHide
} from './admin-utils.js';

let allProducts = [], filtered = [];

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    document.getElementById('sidebar-root').innerHTML = buildAdminSidebarHTML(admin);
    document.getElementById('header-root').innerHTML = buildAdminHeaderHTML('ইনভেন্টরি', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    await loadProducts();
    setupSearch();
    aqs('#close-history')?.addEventListener('click', () => aHide('#history-section'));
    hideAdminLoader();
  });
});

async function loadProducts() {
  const tbody = aqs('#inv-tbody');
  if (tbody) tbody.innerHTML = tableLoadingRow(6);
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    allProducts = [];
    snap.forEach((d) => allProducts.push({ id: d.id, ...d.data() }));
    filtered = [...allProducts];
    renderTable();
  } catch (err) {
    if (tbody) tbody.innerHTML = tableEmptyRow('লোড ব্যর্থ', 6);
  }
}

function renderTable() {
  const tbody = aqs('#inv-tbody');
  if (!tbody) return;
  if (!filtered.length) { tbody.innerHTML = tableEmptyRow('কোনো পণ্য নেই', 6); return; }

  tbody.innerHTML = filtered.map((p) => {
    const stock = p.stockQuantity || 0;
    const color = stock <= 0 ? 'var(--a-danger)' : stock <= 10 ? 'var(--a-warning)' : 'var(--a-success)';
    const statusText = stock <= 0 ? 'স্টক শেষ' : stock <= 10 ? 'কম স্টক' : 'স্টকে আছে';

    return `
    <tr>
      <td><strong>${escapeAdminHtml(p.name || '—')}</strong></td>
      <td><code class="a-text-xs a-text-muted">${escapeAdminHtml(p.productCode || p.id)}</code></td>
      <td><strong style="color:${color};font-size:var(--a-font-lg)">${stock}</strong></td>
      <td>
        <div class="inventory-adjust">
          <button class="inventory-adjust__btn inventory-adjust__btn--minus" data-adj="${p.id}" data-dir="-1" title="কমান">−</button>
          <input class="inventory-adjust__input" type="number" value="1" min="1" id="adj-val-${p.id}" />
          <button class="inventory-adjust__btn" data-adj="${p.id}" data-dir="1" title="বাড়ান">+</button>
          <select id="adj-reason-${p.id}" style="height:32px;font-size:var(--a-font-xs);min-width:90px;border-radius:var(--a-radius-sm)">
            <option value="Restocked">Restocked</option>
            <option value="Sold">Sold</option>
            <option value="Returned">Returned</option>
            <option value="Damaged">Damaged</option>
            <option value="Adjusted">Adjusted</option>
          </select>
        </div>
      </td>
      <td><span class="a-badge ${stock<=0?'a-badge--danger':stock<=10?'a-badge--warning':'a-badge--success'}">${statusText}</span></td>
      <td style="text-align:right">
        <button class="a-btn a-btn--ghost a-btn--sm" data-history="${p.id}" data-name="${escapeAdminHtml(p.name)}">
          📋 হিস্ট্রি
        </button>
      </td>
    </tr>`;
  }).join('');

  // Adjust buttons
  tbody.querySelectorAll('[data-adj]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.adj;
      const dir = parseInt(btn.dataset.dir);
      const valInput = aqs(`#adj-val-${id}`);
      const reasonSel = aqs(`#adj-reason-${id}`);
      const amount = parseInt(valInput?.value) || 1;
      const reason = reasonSel?.value || 'Adjusted';

      const product = allProducts.find((p) => p.id === id);
      if (!product) return;

      const prevStock = product.stockQuantity || 0;
      const change = dir * amount;
      const newStock = Math.max(0, prevStock + change);

      try {
        // Update product stock
        const updateData = { stockQuantity: newStock, updatedAt: serverTimestamp() };
        if (newStock <= 0) updateData.status = 'outofstock';
        else if (product.status === 'outofstock') updateData.status = 'published';

        await updateDoc(doc(db, 'products', id), updateData);

        // Log history
        const admin = getCurrentAdmin();
        await addDoc(collection(db, 'inventoryHistory'), {
          productId: id,
          productName: product.name,
          previousStock: prevStock,
          newStock: newStock,
          change: change,
          reason: reason,
          adminId: admin?.uid || '',
          createdAt: serverTimestamp(),
        });

        // Update local
        product.stockQuantity = newStock;
        if (newStock <= 0) product.status = 'outofstock';
        renderTable();
        adminShowToast(`স্টক আপডেট: ${prevStock} → ${newStock}`, 'success');
      } catch (err) {
        adminShowToast('স্টক আপডেট ব্যর্থ', 'error');
      }
    });
  });

  // History buttons
  tbody.querySelectorAll('[data-history]').forEach((btn) => {
    btn.addEventListener('click', () => loadHistory(btn.dataset.history, btn.dataset.name));
  });
}

async function loadHistory(productId, productName) {
  const section = aqs('#history-section');
  const titleEl = aqs('#history-title');
  const listEl  = aqs('#history-list');

  if (titleEl) titleEl.textContent = `📋 ${productName} — স্টক হিস্ট্রি`;
  aShow(section);

  if (listEl) listEl.innerHTML = '<div class="a-flex-center" style="padding:var(--a-space-6)"><div class="a-spinner"></div></div>';

  try {
    const snap = await getDocs(
      query(collection(db, 'inventoryHistory'), where('productId', '==', productId), orderBy('createdAt', 'desc'), limit(20))
    );

    if (snap.empty) {
      listEl.innerHTML = '<p class="a-text-muted a-text-sm a-text-center" style="padding:var(--a-space-6)">কোনো হিস্ট্রি নেই</p>';
      return;
    }

    listEl.innerHTML = '';
    snap.forEach((d) => {
      const h = d.data();
      const isPlus = h.change > 0;
      listEl.innerHTML += `
        <div class="stock-history-item">
          <span class="stock-history-item__change stock-history-item__change--${isPlus ? 'plus' : 'minus'}">${isPlus ? '+' : ''}${h.change}</span>
          <span class="stock-history-item__info">${h.previousStock} → ${h.newStock} (${escapeAdminHtml(h.reason || '—')})</span>
          <span class="stock-history-item__date">${formatAdminDate(h.createdAt, 'datetime')}</span>
        </div>`;
    });

    // Scroll to history
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch {
    listEl.innerHTML = '<p class="a-text-muted a-text-sm a-text-center">হিস্ট্রি লোড ব্যর্থ</p>';
  }
}

function setupSearch() {
  const input = aqs('#inv-search');
  if (!input) return;
  const d = adminDebounce((v) => {
    if (!v) filtered = [...allProducts];
    else {
      const q = v.toLowerCase();
      filtered = allProducts.filter((p) => [p.name, p.productCode].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    renderTable();
  }, 300);
  input.addEventListener('input', (e) => d(e.target.value.trim()));
                              }
