/* ============================================================
   R BD SHOP — Home Page JavaScript (Fixed)
   Path: frontend/js/home.js
   ============================================================ */

import { db }          from './firebase-config.js';
import {
  collection, getDocs, doc, getDoc
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initTheme }   from './theme.js';
import { buildHeaderHTML, initHeader } from './header.js';
import {
  hidePageLoader, initBackToTop, initLazyLoad,
  formatPrice, escapeHtml, renderProductCard,
  renderStars, renderProductSkeletons,
  getCategoryUrl
}                      from './utils.js';

const PRODUCTS_PER_PAGE = 8;
let allProducts    = [];
let displayedCount = 0;
let currentFilter  = 'all';
let shopSettings   = {};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadSettings();
  injectHeader();
  initHeader();

  await Promise.allSettled([
    loadCategories(),
    loadFeaturedProducts(),
    loadReviews(),
    loadStats(),
  ]);

  initLazyLoad();
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
    console.log('[Home] Settings loaded');
  } catch (err) {
    console.warn('[Home] Settings error:', err);
  }
}

function injectHeader() {
  const headerRoot = document.getElementById('header-root');
  if (!headerRoot) return;
  headerRoot.innerHTML = buildHeaderHTML(shopSettings);
}

/* ─── LOAD CATEGORIES (Fixed) ─── */
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  try {
    console.log('[Home] Loading categories...');

    // ✅ Simple query, no filter
    const snapshot = await getDocs(collection(db, 'categories'));
    console.log('[Home] Categories fetched:', snapshot.size);

    // Filter client-side
    const activeCategories = [];
    snapshot.forEach((docSnap) => {
      const cat = { id: docSnap.id, ...docSnap.data() };
      if (!cat.status || cat.status === 'active') {
        activeCategories.push(cat);
      }
    });

    // Sort by name
    activeCategories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    console.log('[Home] Active categories:', activeCategories.length);

    if (activeCategories.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:var(--space-10)">
          <p class="text-muted">এখনো কোনো ক্যাটাগরি নেই।</p>
        </div>`;
      return;
    }

    let html = '';
    const filterTabsContainer = document.getElementById('filter-tabs');

    activeCategories.slice(0, 12).forEach((cat) => {
      const catUrl = getCategoryUrl(cat.name);
      html += `
        <a href="${catUrl}" class="category-card animate-fade-up">
          <div class="category-card__icon">
            ${cat.imageURL
              ? `<img src="${escapeHtml(cat.imageURL)}" alt="${escapeHtml(cat.name)}" loading="lazy" />`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <rect x="3" y="3" width="7" height="7"/>
                   <rect x="14" y="3" width="7" height="7"/>
                   <rect x="14" y="14" width="7" height="7"/>
                   <rect x="3" y="14" width="7" height="7"/>
                 </svg>`
            }
          </div>
          <span class="category-card__name">${escapeHtml(cat.name)}</span>
          ${cat.productCount ? `<span class="category-card__count">${cat.productCount} পণ্য</span>` : ''}
        </a>`;

      if (filterTabsContainer) {
        const tabBtn = document.createElement('button');
        tabBtn.className = 'filter-tab';
        tabBtn.dataset.filter = cat.name;
        tabBtn.textContent = cat.name;
        tabBtn.addEventListener('click', () => filterProducts(cat.name, tabBtn));
        filterTabsContainer.appendChild(tabBtn);
      }
    });

    grid.innerHTML = html;

  } catch (err) {
    console.error('[Home] Categories error:', err);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:var(--space-10)">
        <p class="text-muted">ক্যাটাগরি লোড করতে সমস্যা: ${err.message}</p>
      </div>`;
  }
}

/* ─── LOAD PRODUCTS (Fixed) ─── */
async function loadFeaturedProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = renderProductSkeletons(PRODUCTS_PER_PAGE);

  try {
    console.log('[Home] Loading products...');

    // ✅ Simple query, no orderBy
    const snapshot = await getDocs(collection(db, 'products'));
    console.log('[Home] Products fetched:', snapshot.size);

    // Client-side status filter
    allProducts = [];
    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.status === 'published' || data.status === 'outofstock') {
        allProducts.push(data);
      }
    });

    console.log('[Home] Published products:', allProducts.length);

    // Sort by createdAt (newest first) client-side
    allProducts.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });

    const statProductsEl = document.getElementById('stat-products');
    if (statProductsEl) statProductsEl.textContent = `${allProducts.length}+`;

    if (allProducts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)">
          <div class="empty-state__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
          <h3 class="empty-state__title">কোনো পণ্য নেই</h3>
          <p class="empty-state__desc">শীঘ্রই নতুন পণ্য আসবে!</p>
        </div>`;
      return;
    }

    displayedCount = 0;
    renderProducts();

  } catch (err) {
    console.error('[Home] Products error:', err);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:var(--space-16)">
        <div class="empty-state__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        </div>
        <h3 class="empty-state__title">লোড করতে সমস্যা</h3>
        <p class="empty-state__desc">${err.message}</p>
      </div>`;
  }
}

function renderProducts() {
  const grid         = document.getElementById('products-grid');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  if (!grid) return;

  let filtered = allProducts;
  if (currentFilter !== 'all') {
    filtered = allProducts.filter((p) => p.categoryName === currentFilter);
  }

  const toShow = filtered.slice(0, displayedCount + PRODUCTS_PER_PAGE);
  displayedCount = toShow.length;

  if (toShow.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:var(--space-10)"><h3 class="empty-state__title">এই ক্যাটাগরিতে কোনো পণ্য নেই</h3></div>`;
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  grid.innerHTML = toShow.map((p) => renderProductCard(p)).join('');
  initLazyLoad();

  if (loadMoreWrap) {
    loadMoreWrap.style.display = displayedCount < filtered.length ? 'block' : 'none';
  }
}

function filterProducts(categoryName, clickedBtn) {
  currentFilter = categoryName;
  displayedCount = 0;
  document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
  clickedBtn.classList.add('active');
  renderProducts();
}

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-filter="all"]')) {
    currentFilter = 'all';
    displayedCount = 0;
    document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
    e.target.classList.add('active');
    renderProducts();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('#load-more-btn')) renderProducts();
});

/* ─── REVIEWS ─── */
async function loadReviews() {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  try {
    const snapshot = await getDocs(collection(db, 'reviews'));
    const approved = [];
    snapshot.forEach((d) => {
      const r = d.data();
      if (r.status === 'approved') approved.push(r);
    });

    if (approved.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:var(--space-8)"><p class="text-muted">এখনো কোনো রিভিউ নেই।</p></div>`;
      return;
    }

    approved.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    let html = '';
    approved.slice(0, 6).forEach((rev) => {
      const initial = (rev.customerName || 'U').charAt(0).toUpperCase();
      html += `
        <div class="review-card animate-fade-up">
          <div class="review-card__top">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div class="review-card__avatar">${initial}</div>
              <div>
                <div class="review-card__name">${escapeHtml(rev.customerName || 'গ্রাহক')}</div>
              </div>
            </div>
            <div>${renderStars(rev.rating || 5)}</div>
          </div>
          ${rev.productName ? `<span class="review-card__product">📦 ${escapeHtml(rev.productName)}</span>` : ''}
          <p class="review-card__text">${escapeHtml(rev.comment || '')}</p>
        </div>`;
    });
    grid.innerHTML = html;
  } catch (err) {
    console.warn('[Home] Reviews error:', err);
    grid.innerHTML = '';
  }
}

/* ─── STATS ─── */
async function loadStats() {
  try {
    const totalEl = document.getElementById('stat-total-products');
    if (totalEl && allProducts.length > 0) {
      totalEl.textContent = `${allProducts.length}+`;
    }
  } catch { /* ignore */ }
}

/* ─── FOOTER ─── */
function updateFooter() {
  const s = shopSettings;
  if (s.whatsappNumber) {
    const waNum = s.whatsappNumber.replace(/\D/g, '');
    const waUrl = `https://wa.me/${waNum}`;
    const supportWA = document.getElementById('support-whatsapp');
    if (supportWA) supportWA.href = waUrl;
    const footerWA = document.getElementById('footer-wa');
    if (footerWA) footerWA.href = waUrl;
  }
  if (s.telegramLink || s.telegramUsername) {
    const tgUrl = s.telegramLink || `https://t.me/${(s.telegramUsername || '').replace('@', '')}`;
    const supportTG = document.getElementById('support-telegram');
    if (supportTG) supportTG.href = tgUrl;
    const footerTG = document.getElementById('footer-tg');
    if (footerTG) footerTG.href = tgUrl;
  }

  const socialContainer = document.getElementById('footer-social');
  if (socialContainer) {
    let socialHtml = '';
    if (s.whatsappNumber) {
      const waNum = s.whatsappNumber.replace(/\D/g, '');
      socialHtml += `<a href="https://wa.me/${waNum}" class="footer__social-link" target="_blank" title="WhatsApp"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.875 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg></a>`;
    }
    if (s.telegramLink || s.telegramUsername) {
      const tgUrl = s.telegramLink || `https://t.me/${(s.telegramUsername || '').replace('@', '')}`;
      socialHtml += `<a href="${escapeHtml(tgUrl)}" class="footer__social-link" target="_blank" title="Telegram"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>`;
    }
    socialContainer.innerHTML = socialHtml;
  }
}
