/* ============================================================
   R BD SHOP — Search Page JavaScript
   Path: frontend/js/search.js
   Description: Main entry for search.html — loads products,
                categories, handles search input, filters,
                sort, pagination. Works for both search
                results and "all products" browsing.
   ============================================================ */

import { db }          from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initTheme }   from './theme.js';
import { buildHeaderHTML, initHeader } from './header.js';
import {
  fetchAllProducts, fetchCategories,
  applyFiltersAndSort, initFilterUI,
  setSort, setCategoryFilter, setPriceFilter,
  setStockFilter, resetAllFilters,
  showLoading, getFilterState
}                      from './products.js';
import {
  hidePageLoader, initBackToTop, initLazyLoad,
  getQueryParam, escapeHtml, debounce,
  showToast, show, hide, updateMetaTags
}                      from './utils.js';

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let shopSettings = {};

/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  await loadSettings();
  injectHeader();
  initHeader();

  const searchQuery = getQueryParam('q');
  const catQuery    = getQueryParam('cat');

  // Update page title/subtitle
  updatePageHeader(searchQuery, catQuery);

  // Load categories for sidebar
  await loadFilterCategories(catQuery);

  // Set search input value
  const searchInput = document.getElementById('search-input');
  if (searchInput && searchQuery) {
    searchInput.value = searchQuery;
  }

  // If category from URL, pre-set filter
  if (catQuery) {
    setCategoryFilter(catQuery);
  }

  // Show loading skeleton
  showLoading();

  // Fetch products
  await fetchAllProducts({
    searchQuery: searchQuery || null,
  });

  // Apply filters and render
  applyFiltersAndSort();

  // Init filter UI events
  initFilterUI(() => {
    applyFiltersAndSort();
    updateActiveFilters();
  });

  // Search input handler
  initSearchInput();

  // View toggle
  initViewToggle();

  // Other
  initBackToTop();
  initLazyLoad();
  updateFooter();
  updateActiveFilters();

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  hidePageLoader();
});

/* ─────────────────────────────────────────────────────────────
   SETTINGS
───────────────────────────────────────────────────────────── */
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'shopSettings'));
    if (snap.exists()) shopSettings = snap.data();
  } catch (err) {
    console.warn('[R BD SHOP] Settings error:', err);
  }
}

function injectHeader() {
  const root = document.getElementById('header-root');
  if (root) root.innerHTML = buildHeaderHTML(shopSettings);
}

/* ─────────────────────────────────────────────────────────────
   PAGE HEADER UPDATE
───────────────────────────────────────────────────────────── */
function updatePageHeader(searchQuery, catQuery) {
  const titleEl    = document.getElementById('search-page-title');
  const subtitleEl = document.getElementById('search-page-subtitle');

  if (searchQuery) {
    if (titleEl) titleEl.textContent = 'সার্চ ফলাফল';
    if (subtitleEl) subtitleEl.innerHTML = `"<strong>${escapeHtml(searchQuery)}</strong>" — এর জন্য ফলাফল`;
    updateMetaTags({
      title: `"${searchQuery}" সার্চ ফলাফল`,
      description: `R BD SHOP-এ "${searchQuery}" খোঁজার ফলাফল।`,
    });
  } else if (catQuery) {
    if (titleEl) titleEl.textContent = catQuery;
    if (subtitleEl) subtitleEl.innerHTML = `<strong>${escapeHtml(catQuery)}</strong> ক্যাটাগরির সব পণ্য`;
    updateMetaTags({
      title: `${catQuery} — ক্যাটাগরি`,
      description: `R BD SHOP — ${catQuery} ক্যাটাগরির সব পণ্য দেখুন।`,
    });
  } else {
    if (titleEl) titleEl.textContent = 'সব পণ্যসমূহ';
    if (subtitleEl) subtitleEl.textContent = 'আমাদের সকল পণ্য ব্রাউজ করুন';
  }
}

/* ─────────────────────────────────────────────────────────────
   CATEGORIES — Sidebar filter list
───────────────────────────────────────────────────────────── */
async function loadFilterCategories(preSelectedCat) {
  const container = document.getElementById('filter-categories');
  if (!container) return;

  try {
    const categories = await fetchCategories();

    if (categories.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">কোনো ক্যাটাগরি নেই</p>';
      return;
    }

    container.innerHTML = categories.map((cat) => {
      const checked = preSelectedCat === cat.name ? 'checked' : '';
      return `
        <label class="filter-check">
          <input type="checkbox"
                 class="filter-cat-check"
                 value="${escapeHtml(cat.name)}"
                 ${checked} />
          <span class="filter-check__label">${escapeHtml(cat.name)}</span>
          ${cat.productCount
            ? `<span class="filter-check__count">${cat.productCount}</span>`
            : ''
          }
        </label>`;
    }).join('');

  } catch (err) {
    console.error('[R BD SHOP] Load filter categories error:', err);
    container.innerHTML = '<p class="text-muted text-sm">ক্যাটাগরি লোড ব্যর্থ</p>';
  }
}

/* ─────────────────────────────────────────────────────────────
   SEARCH INPUT — live search with debounce
───────────────────────────────────────────────────────────── */
function initSearchInput() {
  const searchInput = document.getElementById('search-input');
  const clearBtn    = document.getElementById('search-clear');
  if (!searchInput) return;

  const debouncedSearch = debounce(async (query) => {
    showLoading();

    // Reset filters for fresh search
    resetAllFilters();

    // Fetch with search
    await fetchAllProducts({ searchQuery: query || null });
    applyFiltersAndSort();
    updateActiveFilters();

    // Update title
    const titleEl    = document.getElementById('search-page-title');
    const subtitleEl = document.getElementById('search-page-subtitle');

    if (query) {
      if (titleEl) titleEl.textContent = 'সার্চ ফলাফল';
      if (subtitleEl) subtitleEl.innerHTML = `"<strong>${escapeHtml(query)}</strong>" — এর জন্য ফলাফল`;
    } else {
      if (titleEl) titleEl.textContent = 'সব পণ্যসমূহ';
      if (subtitleEl) subtitleEl.textContent = 'আমাদের সকল পণ্য ব্রাউজ করুন';
    }

    // Update URL without reload
    const newUrl = query
      ? `search.html?q=${encodeURIComponent(query)}`
      : 'search.html';
    window.history.replaceState({}, '', newUrl);
  }, 500);

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();

    // Show/hide clear button
    if (clearBtn) {
      if (val.length > 0) show(clearBtn);
      else hide(clearBtn);
    }

    if (val.length === 0 || val.length >= 2) {
      debouncedSearch(val || null);
    }
  });

  // Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.value.trim();
      debouncedSearch(val || null);
    }
  });

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      hide(clearBtn);
      debouncedSearch(null);
      searchInput.focus();
    });

    // Show clear if already has value
    if (searchInput.value.trim()) show(clearBtn);
  }
}

/* ─────────────────────────────────────────────────────────────
   ACTIVE FILTER TAGS
───────────────────────────────────────────────────────────── */
function updateActiveFilters() {
  const container = document.getElementById('active-filters');
  if (!container) return;

  const state = getFilterState();
  const tags  = [];

  if (state.category) {
    tags.push({ label: `ক্যাটাগরি: ${state.category}`, type: 'category' });
  }
  if (state.priceMin) {
    tags.push({ label: `সর্বনিম্ন: ৳${state.priceMin}`, type: 'priceMin' });
  }
  if (state.priceMax) {
    tags.push({ label: `সর্বোচ্চ: ৳${state.priceMax}`, type: 'priceMax' });
  }
  if (state.stockOnly) {
    tags.push({ label: 'শুধু স্টকে আছে', type: 'stock' });
  }

  if (tags.length === 0) {
    hide(container);
    container.innerHTML = '';
    return;
  }

  show(container);
  container.innerHTML = tags.map((tag) => `
    <span class="active-filter-tag">
      ${escapeHtml(tag.label)}
      <button class="active-filter-tag__remove" data-remove="${tag.type}" aria-label="সরান">✕</button>
    </span>
  `).join('');

  // Remove tag click
  container.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.remove;

      switch (type) {
        case 'category':
          setCategoryFilter(null);
          // Uncheck category checkboxes
          document.querySelectorAll('.filter-cat-check').forEach((cb) => { cb.checked = false; });
          break;
        case 'priceMin':
          setPriceFilter(null, getFilterState().priceMax);
          const minInput = document.getElementById('filter-price-min');
          if (minInput) minInput.value = '';
          break;
        case 'priceMax':
          setPriceFilter(getFilterState().priceMin, null);
          const maxInput = document.getElementById('filter-price-max');
          if (maxInput) maxInput.value = '';
          break;
        case 'stock':
          setStockFilter(false);
          const stockCb = document.getElementById('filter-stock-only');
          if (stockCb) stockCb.checked = false;
          break;
      }

      applyFiltersAndSort();
      updateActiveFilters();
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   VIEW TOGGLE (Grid / List)
───────────────────────────────────────────────────────────── */
function initViewToggle() {
  const gridBtn = document.querySelector('[data-view="grid"]');
  const listBtn = document.querySelector('[data-view="list"]');
  const grid    = document.getElementById('products-grid');
  if (!gridBtn || !listBtn || !grid) return;

  gridBtn.addEventListener('click', () => {
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
    grid.style.gridTemplateColumns = '';
    grid.classList.remove('list-view');
  });

  listBtn.addEventListener('click', () => {
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
    grid.style.gridTemplateColumns = '1fr';
    grid.classList.add('list-view');
  });
}

/* ─────────────────────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────────────────────── */
function updateFooter() {
  const s = shopSettings;
  if (s.whatsappNumber) {
    const el = document.getElementById('footer-wa');
    if (el) el.href = `https://wa.me/${s.whatsappNumber.replace(/\D/g, '')}`;
  }
  if (s.telegramLink || s.telegramUsername) {
    const tgUrl = s.telegramLink || `https://t.me/${(s.telegramUsername || '').replace('@', '')}`;
    const el = document.getElementById('footer-tg');
    if (el) el.href = tgUrl;
  }
}
