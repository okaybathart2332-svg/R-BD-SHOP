/* ============================================================
   R BD SHOP — Category Page JavaScript
   Path: frontend/js/category.js
   Description: Shows all categories grid OR products
                within a specific category based on ?cat= param.
   ============================================================ */

import { db }          from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initTheme }   from './theme.js';
import { buildHeaderHTML, initHeader } from './header.js';
import {
  fetchAllProducts, fetchCategories,
  applyFiltersAndSort, setSort, showLoading
}                      from './products.js';
import {
  hidePageLoader, initBackToTop, initLazyLoad,
  getQueryParam, escapeHtml, getCategoryUrl,
  getPlaceholderImage, showToast,
  show, hide, updateMetaTags, renderProductSkeletons
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

  const catParam = getQueryParam('cat');

  if (catParam) {
    // Single category → show products
    await showSingleCategory(catParam);
  } else {
    // All categories grid
    await showAllCategories();
  }

  initBackToTop();
  updateFooter();

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
   VIEW 1: ALL CATEGORIES GRID
───────────────────────────────────────────────────────────── */
async function showAllCategories() {
  const allView    = document.getElementById('all-categories-view');
  const singleView = document.getElementById('single-category-view');
  const grid       = document.getElementById('all-categories-grid');

  if (allView)    show(allView);
  if (singleView) hide(singleView);
  if (!grid) return;

  // Update breadcrumb
  const bcCurrent = document.getElementById('breadcrumb-current');
  if (bcCurrent) bcCurrent.textContent = 'সব ক্যাটাগরি';

  updateMetaTags({
    title: 'সব ক্যাটাগরি',
    description: 'R BD SHOP — আমাদের সকল ক্যাটাগরি ব্রাউজ করুন।',
  });

  try {
    const categories = await fetchCategories();

    if (categories.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)">
          <div class="empty-state__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <h3 class="empty-state__title">কোনো ক্যাটাগরি নেই</h3>
          <p class="empty-state__desc">এখনো কোনো ক্যাটাগরি তৈরি করা হয়নি।</p>
        </div>`;
      return;
    }

    grid.innerHTML = categories.map((cat) => {
      const catUrl = getCategoryUrl(cat.name);
      const hasImg = cat.imageURL && cat.imageURL.trim() !== '';

      return `
        <a href="${catUrl}" class="category-browse-card animate-fade-up">
          <div class="category-browse-card__icon">
            ${hasImg
              ? `<img src="${escapeHtml(cat.imageURL)}" alt="${escapeHtml(cat.name)}" loading="lazy" />`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <rect x="3" y="3" width="7" height="7"/>
                   <rect x="14" y="3" width="7" height="7"/>
                   <rect x="14" y="14" width="7" height="7"/>
                   <rect x="3" y="14" width="7" height="7"/>
                 </svg>`
            }
          </div>
          <h3 class="category-browse-card__name">${escapeHtml(cat.name)}</h3>
          <span class="category-browse-card__count">
            ${cat.productCount ? `${cat.productCount} পণ্য` : 'পণ্য দেখুন'}
          </span>
        </a>`;
    }).join('');

    initLazyLoad();

  } catch (err) {
    console.error('[R BD SHOP] Categories error:', err);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:var(--space-10)">
        <p class="text-muted">ক্যাটাগরি লোড করতে সমস্যা হয়েছে।</p>
      </div>`;
  }
}

/* ─────────────────────────────────────────────────────────────
   VIEW 2: SINGLE CATEGORY PRODUCTS
───────────────────────────────────────────────────────────── */
async function showSingleCategory(categoryName) {
  const allView    = document.getElementById('all-categories-view');
  const singleView = document.getElementById('single-category-view');

  if (allView)    hide(allView);
  if (singleView) show(singleView);

  // Breadcrumb
  const bcCurrent = document.getElementById('breadcrumb-current');
  if (bcCurrent) bcCurrent.textContent = categoryName;

  // Category hero
  const catNameEl  = document.getElementById('category-name');
  const catCountEl = document.getElementById('category-count');
  if (catNameEl) catNameEl.textContent = categoryName;

  updateMetaTags({
    title: `${categoryName} — ক্যাটাগরি`,
    description: `R BD SHOP — ${categoryName} ক্যাটাগরির সব পণ্য দেখুন।`,
  });

  // Show loading
  const grid = document.getElementById('cat-products-grid');
  if (grid) grid.innerHTML = renderProductSkeletons(12);

  try {
    // Fetch products for this category
    const products = await fetchAllProducts({ category: categoryName });

    if (catCountEl) {
      catCountEl.textContent = `${products.length} পণ্য পাওয়া গেছে`;
    }

    // Apply and render
    applyFiltersAndSort({
      gridSelector:       '#cat-products-grid',
      paginationSelector: '#cat-pagination',
      countSelector:      '#cat-result-count',
    });

    initLazyLoad();

    // Sort select
    const sortSelect = document.getElementById('cat-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        setSort(sortSelect.value);
        applyFiltersAndSort({
          gridSelector:       '#cat-products-grid',
          paginationSelector: '#cat-pagination',
          countSelector:      '#cat-result-count',
        });
      });
    }

  } catch (err) {
    console.error('[R BD SHOP] Category products error:', err);
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)">
          <h3 class="empty-state__title">পণ্য লোড করতে সমস্যা</h3>
          <p class="empty-state__desc">পেজ রিফ্রেশ করে আবার চেষ্টা করুন।</p>
        </div>`;
    }
  }
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
