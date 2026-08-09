/* ============================================================
   R BD SHOP — Category Page JavaScript (Fixed)
   Path: frontend/js/category.js
   ============================================================ */

import { db }          from './firebase-config.js';
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initTheme }   from './theme.js';
import { buildHeaderHTML, initHeader } from './header.js';
import {
  fetchAllProducts,
  applyFiltersAndSort, setSort
}                      from './products.js';
import {
  hidePageLoader, initBackToTop, initLazyLoad,
  getQueryParam, escapeHtml, getCategoryUrl,
  show, hide, updateMetaTags, renderProductSkeletons
}                      from './utils.js';

let shopSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadSettings();
  injectHeader();
  initHeader();

  const catParam = getQueryParam('cat');
  if (catParam) {
    await showSingleCategory(catParam);
  } else {
    await showAllCategories();
  }

  initBackToTop();
  updateFooter();
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  hidePageLoader();
});

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'shopSettings'));
    if (snap.exists()) shopSettings = snap.data();
  } catch { /* ignore */ }
}

function injectHeader() {
  const root = document.getElementById('header-root');
  if (root) root.innerHTML = buildHeaderHTML(shopSettings);
}

/* ─── ALL CATEGORIES (Fixed) ─── */
async function showAllCategories() {
  const allView    = document.getElementById('all-categories-view');
  const singleView = document.getElementById('single-category-view');
  const grid       = document.getElementById('all-categories-grid');

  if (allView)    show(allView);
  if (singleView) hide(singleView);
  if (!grid) return;

  const bcCurrent = document.getElementById('breadcrumb-current');
  if (bcCurrent) bcCurrent.textContent = 'সব ক্যাটাগরি';

  updateMetaTags({ title: 'সব ক্যাটাগরি', description: 'R BD SHOP — সকল ক্যাটাগরি।' });

  try {
    console.log('[Category] Loading all categories...');

    // ✅ Simple query, no filter
    const snapshot = await getDocs(collection(db, 'categories'));
    console.log('[Category] Fetched:', snapshot.size);

    const activeCategories = [];
    snapshot.forEach((docSnap) => {
      const cat = { id: docSnap.id, ...docSnap.data() };
      if (!cat.status || cat.status === 'active') {
        activeCategories.push(cat);
      }
    });

    activeCategories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    console.log('[Category] Active:', activeCategories.length);

    if (activeCategories.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)">
          <div class="empty-state__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <h3 class="empty-state__title">কোনো ক্যাটাগরি নেই</h3>
        </div>`;
      return;
    }

    grid.innerHTML = activeCategories.map((cat) => {
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
    console.error('[Category] Error:', err);
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:var(--space-10)"><p class="text-muted">ক্যাটাগরি লোড ব্যর্থ: ${err.message}</p></div>`;
  }
}

/* ─── SINGLE CATEGORY ─── */
async function showSingleCategory(categoryName) {
  const allView    = document.getElementById('all-categories-view');
  const singleView = document.getElementById('single-category-view');

  if (allView)    hide(allView);
  if (singleView) show(singleView);

  const bcCurrent = document.getElementById('breadcrumb-current');
  if (bcCurrent) bcCurrent.textContent = categoryName;

  const catNameEl  = document.getElementById('category-name');
  const catCountEl = document.getElementById('category-count');
  if (catNameEl) catNameEl.textContent = categoryName;

  updateMetaTags({ title: `${categoryName} — ক্যাটাগরি`, description: `R BD SHOP — ${categoryName}` });

  const grid = document.getElementById('cat-products-grid');
  if (grid) grid.innerHTML = renderProductSkeletons(12);

  try {
    const products = await fetchAllProducts({ category: categoryName });
    if (catCountEl) catCountEl.textContent = `${products.length} পণ্য পাওয়া গেছে`;

    applyFiltersAndSort({
      gridSelector:       '#cat-products-grid',
      paginationSelector: '#cat-pagination',
      countSelector:      '#cat-result-count',
    });

    initLazyLoad();

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
    console.error('[Category] Products error:', err);
    if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)"><h3 class="empty-state__title">সমস্যা হয়েছে</h3><p class="empty-state__desc">${err.message}</p></div>`;
  }
}

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
