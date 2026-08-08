/* ============================================================
   R BD SHOP — Admin Product List JavaScript
   Path: admin/js/product-list.js
   Description: Loads all products from Firestore, renders
                table, search, filter by status, pagination,
                delete, publish/unpublish, duplicate actions.
   ============================================================ */

import { db, storage } from './firebase-config.js';
import {
  collection, query, orderBy, getDocs,
  doc, deleteDoc, updateDoc, addDoc,
  Timestamp, serverTimestamp
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref, deleteObject
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, adminConfirm,
  escapeAdminHtml, formatAdminPrice, formatAdminDate,
  statusBadge, tableEmptyRow, tableLoadingRow,
  adminDebounce
}                      from './admin-utils.js';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & STATE
───────────────────────────────────────────────────────────── */
const PRODUCTS_PER_PAGE = 15;

let allProducts     = [];
let filteredProducts= [];
let currentPage     = 1;
let totalPages      = 1;
let currentFilter   = 'all';
let searchQuery     = '';

/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();

  requireAdmin(async (admin) => {
    injectLayout(admin);
    initAdminSidebar();
    setupLogout();
    setupSearch();
    setupFilters();

    await loadProducts();
    hideAdminLoader();
  });
});

function injectLayout(admin) {
  const sr = document.getElementById('sidebar-root');
  const hr = document.getElementById('header-root');
  if (sr) sr.innerHTML = buildAdminSidebarHTML(admin);
  if (hr) hr.innerHTML = buildAdminHeaderHTML('পণ্য তালিকা', admin);
}

function setupLogout() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#admin-logout-btn')) {
      e.preventDefault();
      adminLogout();
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   LOAD ALL PRODUCTS
───────────────────────────────────────────────────────────── */
async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  if (tbody) tbody.innerHTML = tableLoadingRow(8);

  try {
    const prodQuery = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(prodQuery);
    allProducts = [];
    snapshot.forEach((docSnap) => {
      allProducts.push({ id: docSnap.id, ...docSnap.data() });
    });

    applyFiltersAndRender();

  } catch (err) {
    console.error('[ProductList] Load error:', err);
    if (tbody) tbody.innerHTML = tableEmptyRow('পণ্য লোড করতে সমস্যা হয়েছে।', 8);
    adminShowToast('পণ্য লোড করতে সমস্যা হয়েছে', 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   FILTER + SEARCH + RENDER
───────────────────────────────────────────────────────────── */
function applyFiltersAndRender() {
  let products = [...allProducts];

  // Status filter
  if (currentFilter !== 'all') {
    products = products.filter((p) => p.status === currentFilter);
  }

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    products = products.filter((p) => {
      const haystack = [
        p.name, p.productCode, p.categoryName, p.brand, p.slug
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  filteredProducts = products;
  totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  if (currentPage > totalPages) currentPage = 1;

  renderTable();
  renderPagination();
}

/* ─────────────────────────────────────────────────────────────
   RENDER TABLE
───────────────────────────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (filteredProducts.length === 0) {
    tbody.innerHTML = tableEmptyRow('কোনো পণ্য পাওয়া যায়নি।', 8);
    return;
  }

  const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const end   = start + PRODUCTS_PER_PAGE;
  const page  = filteredProducts.slice(start, end);

  tbody.innerHTML = page.map((p) => {
    const imgSrc = p.mainImage || '';
    const stockClass = (p.stockQuantity || 0) <= 0 ? 'color:var(--a-danger);font-weight:700'
                     : (p.stockQuantity || 0) <= 10 ? 'color:var(--a-warning);font-weight:700'
                     : 'color:var(--a-success)';

    return `
      <tr data-id="${p.id}">
        <td>
          <div class="table-product-cell">
            ${imgSrc
              ? `<img class="table-product-cell__img" src="${escapeAdminHtml(imgSrc)}" alt="" loading="lazy" />`
              : `<div class="table-product-cell__img" style="display:flex;align-items:center;justify-content:center;color:var(--a-text-muted);font-size:10px">N/A</div>`
            }
            <div>
              <div class="table-product-cell__name">${escapeAdminHtml(p.name || '—')}</div>
            </div>
          </div>
        </td>
        <td><code style="font-size:var(--a-font-xs);color:var(--a-text-muted)">${escapeAdminHtml(p.productCode || p.id)}</code></td>
        <td><span class="a-text-sm">${escapeAdminHtml(p.categoryName || '—')}</span></td>
        <td><strong style="color:var(--a-primary)">${formatAdminPrice(p.price)}</strong></td>
        <td><span style="${stockClass}">${p.stockQuantity ?? 0}</span></td>
        <td>${statusBadge(p.status || 'draft')}</td>
        <td><span class="a-text-xs a-text-muted">${formatAdminDate(p.createdAt)}</span></td>
        <td>
          <div class="table-actions" style="justify-content:flex-end">
            <a href="edit-product.html?id=${p.id}" class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="এডিট">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </a>
            <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="ডুপ্লিকেট" data-action="duplicate" data-id="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
            ${p.status === 'published'
              ? `<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="আনপাবলিশ" data-action="unpublish" data-id="${p.id}">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                     <line x1="1" y1="1" x2="23" y2="23"/>
                   </svg>
                 </button>`
              : `<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="পাবলিশ" data-action="publish" data-id="${p.id}">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                     <circle cx="12" cy="12" r="3"/>
                   </svg>
                 </button>`
            }
            <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" title="মুছুন" data-action="delete" data-id="${p.id}" style="color:var(--a-danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────
   PAGINATION
───────────────────────────────────────────────────────────── */
function renderPagination() {
  const infoEl  = document.getElementById('pagination-info');
  const btnsEl  = document.getElementById('pagination-btns');

  if (infoEl) {
    const start = filteredProducts.length > 0 ? (currentPage - 1) * PRODUCTS_PER_PAGE + 1 : 0;
    const end   = Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length);
    infoEl.textContent = `${start}-${end} / মোট ${filteredProducts.length}`;
  }

  if (!btnsEl) return;

  if (totalPages <= 1) {
    btnsEl.innerHTML = '';
    return;
  }

  let html = `
    <button class="table-pagination__btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
    </button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === currentPage - 3 || i === currentPage + 3) html += '<span style="padding:0 4px;color:var(--a-text-muted)">...</span>';
      continue;
    }
    html += `<button class="table-pagination__btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  html += `
    <button class="table-pagination__btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
    </button>`;

  btnsEl.innerHTML = html;

  btnsEl.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page, 10);
      if (isNaN(p) || p < 1 || p > totalPages || p === currentPage) return;
      currentPage = p;
      renderTable();
      renderPagination();
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   SEARCH
───────────────────────────────────────────────────────────── */
function setupSearch() {
  const input = document.getElementById('product-search');
  if (!input) return;

  const debouncedSearch = adminDebounce((val) => {
    searchQuery = val;
    currentPage = 1;
    applyFiltersAndRender();
  }, 300);

  input.addEventListener('input', (e) => {
    debouncedSearch(e.target.value.trim());
  });
}

/* ─────────────────────────────────────────────────────────────
   STATUS FILTERS
───────────────────────────────────────────────────────────── */
function setupFilters() {
  const container = document.getElementById('status-filters');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.table-filter-btn');
    if (!btn) return;

    container.querySelectorAll('.table-filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    currentFilter = btn.dataset.status;
    currentPage   = 1;
    applyFiltersAndRender();
  });
}

/* ─────────────────────────────────────────────────────────────
   TABLE ACTIONS (Delete, Publish, Unpublish, Duplicate)
───────────────────────────────────────────────────────────── */
document.addEventListener('click', async (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const id     = actionBtn.dataset.id;
  if (!action || !id) return;

  const product = allProducts.find((p) => p.id === id);
  if (!product) return;

  switch (action) {
    case 'delete':
      await handleDelete(product);
      break;
    case 'publish':
      await handleStatusChange(product, 'published');
      break;
    case 'unpublish':
      await handleStatusChange(product, 'draft');
      break;
    case 'duplicate':
      await handleDuplicate(product);
      break;
  }
});

/* ── Delete ── */
async function handleDelete(product) {
  const confirmed = await adminConfirm({
    title:   'পণ্য মুছে ফেলবেন?',
    message: `"${product.name}" স্থায়ীভাবে মুছে যাবে। এটি আর ফেরানো সম্ভব নয়।`,
    confirmText: 'হ্যাঁ, মুছে ফেলুন',
    type: 'danger',
  });

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'products', product.id));

    // Try to delete images from storage (best effort)
    try {
      if (product.mainImage) {
        const imgRef = ref(storage, product.mainImage);
        await deleteObject(imgRef).catch(() => {});
      }
      if (product.galleryImages?.length) {
        for (const url of product.galleryImages) {
          const gRef = ref(storage, url);
          await deleteObject(gRef).catch(() => {});
        }
      }
    } catch { /* ignore storage errors */ }

    // Remove from local array
    allProducts = allProducts.filter((p) => p.id !== product.id);
    applyFiltersAndRender();

    adminShowToast(`"${product.name}" মুছে ফেলা হয়েছে`, 'success');

  } catch (err) {
    console.error('[ProductList] Delete error:', err);
    adminShowToast('মুছতে সমস্যা হয়েছে', 'error');
  }
}

/* ── Publish / Unpublish ── */
async function handleStatusChange(product, newStatus) {
  try {
    await updateDoc(doc(db, 'products', product.id), {
      status:    newStatus,
      updatedAt: serverTimestamp(),
    });

    // Update local
    const idx = allProducts.findIndex((p) => p.id === product.id);
    if (idx !== -1) allProducts[idx].status = newStatus;

    applyFiltersAndRender();

    const label = newStatus === 'published' ? 'পাবলিশ' : 'আনপাবলিশ';
    adminShowToast(`"${product.name}" ${label} হয়েছে`, 'success');

  } catch (err) {
    console.error('[ProductList] Status change error:', err);
    adminShowToast('স্ট্যাটাস পরিবর্তন ব্যর্থ', 'error');
  }
}

/* ── Duplicate ── */
async function handleDuplicate(product) {
  try {
    const newProduct = { ...product };
    delete newProduct.id;
    newProduct.name        = `${product.name} (কপি)`;
    newProduct.slug        = `${product.slug || 'copy'}-copy-${Date.now()}`;
    newProduct.productCode = `RBD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    newProduct.status      = 'draft';
    newProduct.createdAt   = serverTimestamp();
    newProduct.updatedAt   = serverTimestamp();
    newProduct.totalSold   = 0;
    newProduct.reviewCount = 0;
    newProduct.averageRating = 0;

    const newRef = await addDoc(collection(db, 'products'), newProduct);

    // Add to local
    allProducts.unshift({
      ...newProduct,
      id: newRef.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    applyFiltersAndRender();
    adminShowToast(`"${product.name}" ডুপ্লিকেট হয়েছে (ড্রাফট)`, 'success');

  } catch (err) {
    console.error('[ProductList] Duplicate error:', err);
    adminShowToast('ডুপ্লিকেট করতে সমস্যা হয়েছে', 'error');
  }
  }
