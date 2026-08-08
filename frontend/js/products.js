/* ============================================================
   R BD SHOP — Products Listing Module
   Path: frontend/js/products.js
   Description: Fetch published products from Firestore,
                filter by category/price/stock, sort,
                paginate, render product cards.
                Used by search.html and category.html.
   ============================================================ */

import { db }          from './firebase-config.js';
import {
  collection, query, where, orderBy,
  limit, getDocs, startAfter,
  getCountFromServer
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  renderProductCard, renderProductSkeletons,
  initLazyLoad, getStockStatus, escapeHtml,
  showToast, debounce, getQueryParam
}                      from './utils.js';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const PRODUCTS_PER_PAGE = 12;

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let allFetchedProducts = [];
let filteredProducts   = [];
let currentPage        = 1;
let totalPages         = 1;

let currentSort        = 'newest';     // newest, oldest, price-asc, price-desc, name-asc
let activeCategory     = null;
let priceMin           = null;
let priceMax           = null;
let stockOnly          = false;        // শুধু in-stock দেখাবে কিনা

/* ─────────────────────────────────────────────────────────────
   EXPORTED: fetchAllProducts — সব published products আনে
───────────────────────────────────────────────────────────── */

/**
 * Firestore থেকে সব published products fetch করে
 * @param {object} options
 * @param {string} options.category - নির্দিষ্ট category filter
 * @param {string} options.searchQuery - search keyword
 * @returns {Promise<Array>}
 */
export async function fetchAllProducts({ category = null, searchQuery = null } = {}) {
  try {
    let constraints = [
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
    ];

    if (category) {
      constraints = [
        where('status', '==', 'published'),
        where('categoryName', '==', category),
        orderBy('createdAt', 'desc'),
      ];
    }

    const prodQuery = query(
      collection(db, 'products'),
      ...constraints,
      limit(200) // practical max
    );

    const snapshot = await getDocs(prodQuery);

    let products = [];
    snapshot.forEach((docSnap) => {
      products.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Client-side search filter (Firestore-এ full-text search নেই)
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
    console.error('[R BD SHOP] Fetch products error:', err);
    showToast('পণ্য লোড করতে সমস্যা হয়েছে', 'error');
    allFetchedProducts = [];
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────
   EXPORTED: fetchCategories — সব active categories আনে
───────────────────────────────────────────────────────────── */

/**
 * Firestore থেকে active categories fetch করে
 * @returns {Promise<Array>}
 */
export async function fetchCategories() {
  try {
    const catQuery = query(
      collection(db, 'categories'),
      where('status', '==', 'active'),
      orderBy('name')
    );

    const snapshot = await getDocs(catQuery);
    const categories = [];
    snapshot.forEach((docSnap) => {
      categories.push({ id: docSnap.id, ...docSnap.data() });
    });
    return categories;

  } catch (err) {
    console.error('[R BD SHOP] Fetch categories error:', err);
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────
   applyFiltersAndSort — Filter, Sort, Paginate & Render
───────────────────────────────────────────────────────────── */

/**
 * সব filter apply করে, sort করে, paginate করে
 * @param {object} options
 * @param {string} options.gridSelector - product grid container selector
 * @param {string} options.paginationSelector - pagination container selector
 * @param {string} options.countSelector - result count display selector
 */
export function applyFiltersAndSort({
  gridSelector       = '#products-grid',
  paginationSelector = '#pagination',
  countSelector      = '#result-count'
} = {}) {

  const grid       = document.querySelector(gridSelector);
  const pagEl      = document.querySelector(paginationSelector);
  const countEl    = document.querySelector(countSelector);
  if (!grid) return;

  // 1. Start with all fetched products
  let products = [...allFetchedProducts];

  // 2. Category filter
  if (activeCategory) {
    products = products.filter((p) => p.categoryName === activeCategory);
  }

  // 3. Price range filter
  if (priceMin !== null && priceMin > 0) {
    products = products.filter((p) => p.price >= priceMin);
  }
  if (priceMax !== null && priceMax > 0) {
    products = products.filter((p) => p.price <= priceMax);
  }

  // 4. Stock filter
  if (stockOnly) {
    products = products.filter((p) => (p.stockQuantity || 0) > 0);
  }

  // 5. Sort
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
    default:
      break;
  }

  filteredProducts = products;

  // 6. Update count
  if (countEl) {
    countEl.innerHTML = `মোট <strong>${products.length}</strong> পণ্য পাওয়া গেছে`;
  }

  // 7. Pagination
  totalPages  = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  if (currentPage > totalPages) currentPage = 1;

  const startIdx = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIdx   = startIdx + PRODUCTS_PER_PAGE;
  const pageProducts = products.slice(startIdx, endIdx);

  // 8. Render
  if (pageProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)">
        <div class="empty-state__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <h3 class="empty-state__title">কোনো পণ্য পাওয়া যায়নি</h3>
        <p class="empty-state__desc">ফিল্টার পরিবর্তন করুন বা অন্য কিছু খুঁজুন।</p>
      </div>`;
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  grid.innerHTML = pageProducts.map((p) => renderProductCard(p)).join('');

  // 9. Lazy load images
  initLazyLoad();

  // 10. Pagination render
  if (pagEl) renderPagination(pagEl);
}

/* ─────────────────────────────────────────────────────────────
   PAGINATION RENDERER
───────────────────────────────────────────────────────────── */
function renderPagination(container) {
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Previous
  html += `
    <button class="pagination__btn" data-page="${currentPage - 1}"
            ${currentPage === 1 ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage    = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage      = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="pagination__btn" data-page="1">1</button>`;
    if (startPage > 2) html += '<span class="pagination__ellipsis">...</span>';
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="pagination__btn ${i === currentPage ? 'active' : ''}"
              data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span class="pagination__ellipsis">...</span>';
    html += `<button class="pagination__btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next
  html += `
    <button class="pagination__btn" data-page="${currentPage + 1}"
            ${currentPage === totalPages ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>`;

  container.innerHTML = html;

  // Pagination click events
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

/* ─────────────────────────────────────────────────────────────
   EXPORTED: setters for filter state
───────────────────────────────────────────────────────────── */

/**
 * Sort order সেট করে
 * @param {string} sortValue
 */
export function setSort(sortValue) {
  currentSort = sortValue;
  currentPage = 1;
}

/**
 * Category filter সেট করে
 * @param {string|null} category
 */
export function setCategoryFilter(category) {
  activeCategory = category;
  currentPage    = 1;
}

/**
 * Price range সেট করে
 * @param {number|null} min
 * @param {number|null} max
 */
export function setPriceFilter(min, max) {
  priceMin    = min;
  priceMax    = max;
  currentPage = 1;
}

/**
 * Stock filter toggle
 * @param {boolean} onlyInStock
 */
export function setStockFilter(onlyInStock) {
  stockOnly   = onlyInStock;
  currentPage = 1;
}

/**
 * সব filter reset
 */
export function resetAllFilters() {
  activeCategory = null;
  priceMin       = null;
  priceMax       = null;
  stockOnly      = false;
  currentSort    = 'newest';
  currentPage    = 1;
}

/**
 * Current filter state পড়ে (for UI sync)
 * @returns {object}
 */
export function getFilterState() {
  return {
    category: activeCategory,
    priceMin,
    priceMax,
    stockOnly,
    sort: currentSort,
    page: currentPage,
    totalPages,
    totalResults: filteredProducts.length,
  };
}

/* ─────────────────────────────────────────────────────────────
   EXPORTED: initFilterUI — Sidebar filter events সেটআপ করে
───────────────────────────────────────────────────────────── */

/**
 * Search/Category page-এর sidebar filter events সেটআপ
 * @param {Function} onFilterChange - filter পরিবর্তন হলে call হবে
 */
export function initFilterUI(onFilterChange) {

  // Sort dropdown
  const sortSelect = document.querySelector('#sort-select');
  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', () => {
      setSort(sortSelect.value);
      onFilterChange();
    });
  }

  // Stock filter checkbox
  const stockCheck = document.querySelector('#filter-stock-only');
  if (stockCheck) {
    stockCheck.checked = stockOnly;
    stockCheck.addEventListener('change', () => {
      setStockFilter(stockCheck.checked);
      onFilterChange();
    });
  }

  // Price filter
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

  // Category checkboxes
  const catCheckboxes = document.querySelectorAll('.filter-cat-check');
  catCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      // শুধু একটা category select — radio-style behavior
      if (cb.checked) {
        catCheckboxes.forEach((other) => {
          if (other !== cb) other.checked = false;
        });
        setCategoryFilter(cb.value);
      } else {
        setCategoryFilter(null);
      }
      onFilterChange();
    });
  });

  // Clear all button
  const clearBtn = document.querySelector('#clear-all-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      resetAllFilters();

      // UI reset
      if (sortSelect)    sortSelect.value = 'newest';
      if (stockCheck)    stockCheck.checked = false;
      if (priceMinInput) priceMinInput.value = '';
      if (priceMaxInput) priceMaxInput.value = '';
      catCheckboxes.forEach((cb) => { cb.checked = false; });

      onFilterChange();
    });
  }

  // Mobile filter drawer
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

/* ─────────────────────────────────────────────────────────────
   EXPORTED: showLoading — grid-এ skeleton দেখায়
───────────────────────────────────────────────────────────── */

/**
 * Product grid-এ loading skeleton দেখায়
 * @param {string} gridSelector
 */
export function showLoading(gridSelector = '#products-grid') {
  const grid = document.querySelector(gridSelector);
  if (grid) grid.innerHTML = renderProductSkeletons(PRODUCTS_PER_PAGE);
}
