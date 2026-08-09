/* ============================================================
   R BD SHOP — Products Listing Module (Fixed)
   Path: frontend/js/products.js
   ============================================================ */

import { db }          from './firebase-config.js';
import {
  collection, query, where,
  limit, getDocs
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  renderProductCard, renderProductSkeletons,
  initLazyLoad, showToast
}                      from './utils.js';

const PRODUCTS_PER_PAGE = 12;

let allFetchedProducts = [];
let filteredProducts   = [];
let currentPage        = 1;
let totalPages         = 1;

let currentSort        = 'newest';
let activeCategory     = null;
let priceMin           = null;
let priceMax           = null;
let stockOnly          = false;

/* ─── FETCH ALL PRODUCTS (Simplified, No orderBy) ─── */
export async function fetchAllProducts({ category = null, searchQuery = null } = {}) {
  try {
    console.log('[Products] Fetching...', { category, searchQuery });

    // ✅ SIMPLE QUERY: only status filter, no orderBy
    let q;
    if (category) {
      q = query(
        collection(db, 'products'),
        where('categoryName', '==', category),
        limit(200)
      );
    } else {
      q = query(
        collection(db, 'products'),
        limit(200)
      );
    }

    const snapshot = await getDocs(q);
    console.log('[Products] Docs fetched:', snapshot.size);

    let products = [];
    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      // ✅ Client-side filter: published OR outofstock
      if (data.status === 'published' || data.status === 'outofstock') {
        products.push(data);
      }
    });

    console.log('[Products] After status filter:', products.length);

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter((p) => {
        const haystack = [
          p.name, p.productCode, p.categoryName,
          p.brand, p.slug, p.shortDescription,
          ...(p.tags || [])
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    allFetchedProducts = products;
    return products;

  } catch (err) {
    console.error('[Products] Fetch error:', err);
    showToast('পণ্য লোড করতে সমস্যা হয়েছে: ' + err.message, 'error');
    allFetchedProducts = [];
    return [];
  }
}

/* ─── FETCH CATEGORIES (No status filter) ─── */
export async function fetchCategories() {
  try {
    console.log('[Categories] Fetching...');

    // ✅ Simple query, no filter
    const snapshot = await getDocs(collection(db, 'categories'));
    console.log('[Categories] Docs fetched:', snapshot.size);

    const categories = [];
    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      // Show if status is active OR status not set
      if (!data.status || data.status === 'active') {
        categories.push(data);
      }
    });

    // Sort by name
    categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    console.log('[Categories] Active:', categories.length);
    return categories;

  } catch (err) {
    console.error('[Categories] Fetch error:', err);
    return [];
  }
}

/* ─── APPLY FILTERS & RENDER ─── */
export function applyFiltersAndSort({
  gridSelector       = '#products-grid',
  paginationSelector = '#pagination',
  countSelector      = '#result-count'
} = {}) {

  const grid    = document.querySelector(gridSelector);
  const pagEl   = document.querySelector(paginationSelector);
  const countEl = document.querySelector(countSelector);
  if (!grid) return;

  let products = [...allFetchedProducts];

  if (activeCategory) {
    products = products.filter((p) => p.categoryName === activeCategory);
  }
  if (priceMin !== null && priceMin > 0) {
    products = products.filter((p) => (p.price || 0) >= priceMin);
  }
  if (priceMax !== null && priceMax > 0) {
    products = products.filter((p) => (p.price || 0) <= priceMax);
  }
  if (stockOnly) {
    products = products.filter((p) => (p.stockQuantity || 0) > 0);
  }

  // ✅ Sort
  switch (currentSort) {
    case 'newest':
      products.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      break;
    case 'oldest':
      products.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tA - tB;
      });
      break;
    case 'price-asc':
      products.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price-desc':
      products.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'name-asc':
      products.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bn'));
      break;
  }

  filteredProducts = products;

  if (countEl) {
    countEl.innerHTML = `মোট <strong>${products.length}</strong> পণ্য পাওয়া গেছে`;
  }

  totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  if (currentPage > totalPages) currentPage = 1;

  const startIdx = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIdx   = startIdx + PRODUCTS_PER_PAGE;
  const pageProducts = products.slice(startIdx, endIdx);

  if (pageProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)">
        <div class="empty-state__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <h3 class="empty-state__title">কোনো পণ্য পাওয়া যায়নি</h3>
        <p class="empty-state__desc">ফিল্টার পরিবর্তন করুন বা অন্য কিছু খুঁজুন।</p>
      </div>`;
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  grid.innerHTML = pageProducts.map((p) => renderProductCard(p)).join('');
  initLazyLoad();

  if (pagEl) renderPagination(pagEl);
}

function renderPagination(container) {
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  html += `<button class="pagination__btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>`;
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
  if (startPage > 1) {
    html += `<button class="pagination__btn" data-page="1">1</button>`;
    if (startPage > 2) html += '<span class="pagination__ellipsis">...</span>';
  }
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination__btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span class="pagination__ellipsis">...</span>';
    html += `<button class="pagination__btn" data-page="${totalPages}">${totalPages}</button>`;
  }
  html += `<button class="pagination__btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>`;
  container.innerHTML = html;
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (isNaN(page) || page < 1 || page > totalPages || page === currentPage) return;
      currentPage = page;
      applyFiltersAndSort();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

export function setSort(sortValue)          { currentSort = sortValue; currentPage = 1; }
export function setCategoryFilter(category) { activeCategory = category; currentPage = 1; }
export function setPriceFilter(min, max)    { priceMin = min; priceMax = max; currentPage = 1; }
export function setStockFilter(onlyInStock) { stockOnly = onlyInStock; currentPage = 1; }

export function resetAllFilters() {
  activeCategory = null;
  priceMin = null;
  priceMax = null;
  stockOnly = false;
  currentSort = 'newest';
  currentPage = 1;
}

export function getFilterState() {
  return {
    category: activeCategory,
    priceMin, priceMax, stockOnly,
    sort: currentSort,
    page: currentPage,
    totalPages,
    totalResults: filteredProducts.length,
  };
}

export function initFilterUI(onFilterChange) {
  const sortSelect = document.querySelector('#sort-select');
  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', () => {
      setSort(sortSelect.value);
      onFilterChange();
    });
  }
  const stockCheck = document.querySelector('#filter-stock-only');
  if (stockCheck) {
    stockCheck.checked = stockOnly;
    stockCheck.addEventListener('change', () => {
      setStockFilter(stockCheck.checked);
      onFilterChange();
    });
  }
  const priceMinInput = document.querySelector('#filter-price-min');
  const priceMaxInput = document.querySelector('#filter-price-max');
  const priceApplyBtn = document.querySelector('#filter-price-apply');
  if (priceApplyBtn) {
    priceApplyBtn.addEventListener('click', () => {
      const min = priceMinInput ? parseInt(priceMinInput.value, 10) || null : null;
      const max = priceMaxInput ? parseInt(priceMaxInput.value, 10) || null : null;
      setPriceFilter(min, max);
      onFilterChange();
    });
  }
  const catCheckboxes = document.querySelectorAll('.filter-cat-check');
  catCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        catCheckboxes.forEach((other) => { if (other !== cb) other.checked = false; });
        setCategoryFilter(cb.value);
      } else {
        setCategoryFilter(null);
      }
      onFilterChange();
    });
  });
  const clearBtn = document.querySelector('#clear-all-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      resetAllFilters();
      if (sortSelect)    sortSelect.value = 'newest';
      if (stockCheck)    stockCheck.checked = false;
      if (priceMinInput) priceMinInput.value = '';
      if (priceMaxInput) priceMaxInput.value = '';
      catCheckboxes.forEach((cb) => { cb.checked = false; });
      onFilterChange();
    });
  }
  const filterToggle  = document.querySelector('#filter-drawer-toggle');
  const filterSidebar = document.querySelector('.search-page__filters');
  const filterOverlay = document.querySelector('.filter-drawer-overlay');
  if (filterToggle && filterSidebar) {
    filterToggle.addEventListener('click', () => {
      filterSidebar.classList.toggle('open');
      if (filterOverlay) filterOverlay.classList.toggle('active');
      document.body.style.overflow = filterSidebar.classList.contains('open') ? 'hidden' : '';
    });
    if (filterOverlay) {
      filterOverlay.addEventListener('click', () => {
        filterSidebar.classList.remove('open');
        filterOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  }
}

export function showLoading(gridSelector = '#products-grid') {
  const grid = document.querySelector(gridSelector);
  if (grid) grid.innerHTML = renderProductSkeletons(PRODUCTS_PER_PAGE);
           }
