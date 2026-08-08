/* ============================================================
   R BD SHOP — Header JavaScript (Fixed)
   Path: frontend/js/header.js
   ============================================================ */

import { db }          from './firebase-config.js';
import {
  collection, query, where, orderBy,
  limit, getDocs
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  debounce, throttle,
  escapeHtml, formatPrice,
  getProductUrl, getPlaceholderImage,
  highlightText
}                      from './utils.js';

/* ─────────────────────────────────────────────────────────────
   1. Sticky Header
───────────────────────────────────────────────────────────── */
function initStickyHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  const handleScroll = throttle(() => {
    if (window.scrollY > 20) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }, 80);

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/* ─────────────────────────────────────────────────────────────
   2. Mobile Navigation Drawer — FIXED
───────────────────────────────────────────────────────────── */
function initMobileNav() {
  // Body-level delegation (works even if header injected later)
  document.addEventListener('click', (e) => {
    // Hamburger clicked
    if (e.target.closest('.hamburger')) {
      e.preventDefault();
      e.stopPropagation();
      openMobileNav();
      return;
    }

    // Close button clicked
    if (e.target.closest('.mobile-nav__close')) {
      e.preventDefault();
      closeMobileNav();
      return;
    }

    // Overlay clicked
    if (e.target.classList.contains('mobile-nav__overlay')) {
      closeMobileNav();
      return;
    }

    // Mobile nav link clicked
    if (e.target.closest('.mobile-nav__link')) {
      setTimeout(closeMobileNav, 150);
      return;
    }
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileNav();
      closeSearchOverlay();
    }
  });
}

function openMobileNav() {
  const mobileNav     = document.querySelector('.mobile-nav');
  const mobileOverlay = document.querySelector('.mobile-nav__overlay');
  const hamburger     = document.querySelector('.hamburger');

  if (!mobileNav) return;

  mobileNav.classList.add('open');
  if (mobileOverlay) mobileOverlay.classList.add('active');
  if (hamburger)     hamburger.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
  const mobileNav     = document.querySelector('.mobile-nav');
  const mobileOverlay = document.querySelector('.mobile-nav__overlay');
  const hamburger     = document.querySelector('.hamburger');

  if (!mobileNav) return;

  mobileNav.classList.remove('open');
  if (mobileOverlay) mobileOverlay.classList.remove('active');
  if (hamburger)     hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────────────────────
   3. Search Overlay
───────────────────────────────────────────────────────────── */
function openSearchOverlay() {
  const searchOverlay = document.querySelector('.search-overlay');
  if (!searchOverlay) return;
  searchOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const input = document.querySelector('#search-overlay-input');
    if (input) input.focus();
  }, 300);
}

function closeSearchOverlay() {
  const searchOverlay = document.querySelector('.search-overlay');
  if (!searchOverlay) return;
  searchOverlay.classList.remove('active');
  document.body.style.overflow = '';
  const results = document.querySelector('.search-overlay__results');
  const input   = document.querySelector('#search-overlay-input');
  if (results) results.innerHTML = '';
  if (input)   input.value = '';
}

function initSearchOverlay() {
  // Body-level delegation
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-search]')) {
      e.preventDefault();
      openSearchOverlay();
      return;
    }
    if (e.target.closest('.search-overlay__close')) {
      closeSearchOverlay();
      return;
    }
    if (e.target.classList.contains('search-overlay')) {
      closeSearchOverlay();
    }
  });

  // Overlay input — live search
  const searchOverlayInput = document.querySelector('#search-overlay-input');
  if (searchOverlayInput) {
    const debouncedSearch = debounce(async (val) => {
      const container = document.querySelector('.search-overlay__results');
      await performSearch(val, container, 'overlay');
    }, 350);

    searchOverlayInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const container = document.querySelector('.search-overlay__results');
      if (val.length < 2) {
        if (container) container.innerHTML = '';
        return;
      }
      debouncedSearch(val);
    });

    searchOverlayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchOverlayInput.value.trim();
        if (val) window.location.href = `search.html?q=${encodeURIComponent(val)}`;
      }
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   4. Inline Search
───────────────────────────────────────────────────────────── */
function initInlineSearch() {
  const inlineSearchInput   = document.querySelector('#header-search-input');
  const inlineSearchResults = document.querySelector('.header__search-results');
  if (!inlineSearchInput) return;

  const debouncedSearch = debounce(async (val) => {
    await performSearch(val, inlineSearchResults, 'inline');
  }, 350);

  inlineSearchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length < 2) { hideInlineResults(); return; }
    debouncedSearch(val);
  });

  inlineSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = inlineSearchInput.value.trim();
      if (val) window.location.href = `search.html?q=${encodeURIComponent(val)}`;
    }
    if (e.key === 'Escape') { hideInlineResults(); inlineSearchInput.blur(); }
  });

  document.addEventListener('click', (e) => {
    if (!inlineSearchInput.contains(e.target) && !inlineSearchResults?.contains(e.target)) {
      hideInlineResults();
    }
  });
}

function hideInlineResults() {
  const inlineSearchResults = document.querySelector('.header__search-results');
  if (!inlineSearchResults) return;
  inlineSearchResults.classList.remove('active');
  inlineSearchResults.innerHTML = '';
}

/* ─────────────────────────────────────────────────────────────
   5. Search Function
───────────────────────────────────────────────────────────── */
async function performSearch(queryText, resultsContainer, mode) {
  if (!resultsContainer || !queryText) return;

  resultsContainer.innerHTML = `<div class="search-no-result" style="padding:var(--space-6)"><div class="loader-spinner" style="margin:0 auto"></div></div>`;
  if (mode === 'inline') resultsContainer.classList.add('active');

  try {
    // Simple query — all published products, filter client-side
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'published'),
      limit(50)
    );
    const snap = await getDocs(q);

    const lowerQuery = queryText.toLowerCase();
    const products = [];
    snap.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      const haystack = [
        data.name, data.productCode, data.categoryName,
        data.brand, data.slug, data.shortDescription
      ].filter(Boolean).join(' ').toLowerCase();
      if (haystack.includes(lowerQuery)) products.push(data);
    });

    renderSearchResults(products.slice(0, 6), queryText, resultsContainer, mode);

  } catch (err) {
    console.error('[Search]', err);
    resultsContainer.innerHTML = `<div class="search-no-result">সার্চ ব্যর্থ</div>`;
    if (mode === 'inline') resultsContainer.classList.add('active');
  }
}

function renderSearchResults(products, queryText, container, mode) {
  if (!container) return;

  if (!products.length) {
    container.innerHTML = `
      <div class="search-no-result">
        "<strong>${escapeHtml(queryText)}</strong>" — কোনো পণ্য পাওয়া যায়নি
      </div>`;
    if (mode === 'inline') container.classList.add('active');
    return;
  }

  if (mode === 'inline') {
    const html = products.map((p) => `
      <a href="${getProductUrl(p.slug)}" class="header__search-result-item">
        <img src="${p.mainImage || getPlaceholderImage(80, 80)}" alt="${escapeHtml(p.name)}" class="header__search-result-img" loading="lazy" />
        <div>
          <div class="header__search-result-name">${highlightText(p.name, queryText)}</div>
          <div class="header__search-result-price">${formatPrice(p.price)}</div>
        </div>
      </a>`).join('');
    container.innerHTML = html + `<a href="search.html?q=${encodeURIComponent(queryText)}" class="header__search-result-view-all">সব ফলাফল দেখুন →</a>`;
    container.classList.add('active');
  } else {
    const html = products.map((p) => `
      <a href="${getProductUrl(p.slug)}" class="search-result-card">
        <img src="${p.mainImage || getPlaceholderImage(100, 100)}" alt="${escapeHtml(p.name)}" class="search-result-card__img" loading="lazy" />
        <div class="search-result-card__info">
          <div class="search-result-card__name">${highlightText(p.name, queryText)}</div>
          <div class="search-result-card__price">${formatPrice(p.price)}</div>
        </div>
      </a>`).join('');
    container.innerHTML = html + `<div style="grid-column:1/-1;text-align:center;padding:var(--space-3) 0;border-top:1px solid var(--border-primary);margin-top:var(--space-2)"><a href="search.html?q=${encodeURIComponent(queryText)}" class="btn btn--secondary btn--sm">সব ফলাফল দেখুন</a></div>`;
  }
}

/* ─────────────────────────────────────────────────────────────
   6. Active Nav Link
───────────────────────────────────────────────────────────── */
function initActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav__link[href], .mobile-nav__link[href]');
  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkPage = href.split('/').pop().split('?')[0];
    if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   Header HTML Builder
───────────────────────────────────────────────────────────── */
export function buildHeaderHTML(settings = {}) {
  const shopName = settings.shopName || 'R BD SHOP';

  return `
  <header class="header" id="site-header">
    <div class="header__inner">

      <a href="index.html" class="header__logo" aria-label="${escapeHtml(shopName)} হোম">
        <div class="header__logo-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
        </div>
        <div class="header__logo-text">
          <span class="header__logo-name"><span>R BD</span> SHOP</span>
          <span class="header__logo-tagline">আপনার বিশ্বস্ত শপ</span>
        </div>
      </a>

      <nav class="header__nav" aria-label="প্রধান নেভিগেশন">
        <a href="index.html" class="nav__link">হোম</a>
        <a href="search.html" class="nav__link">পণ্যসমূহ</a>
        <a href="category.html" class="nav__link">ক্যাটাগরি</a>
        <a href="#" class="nav__link" data-open-search>সার্চ</a>
        ${settings.whatsappNumber
          ? `<a href="https://wa.me/${settings.whatsappNumber.replace(/\D/g,'')}" class="nav__link" target="_blank" rel="noopener">সাপোর্ট</a>`
          : '<a href="#" class="nav__link">সাপোর্ট</a>'
        }
      </nav>

      <div class="header__search-inline" role="search">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="search" id="header-search-input" placeholder="পণ্য খুঁজুন..." autocomplete="off" aria-label="পণ্য সার্চ করুন" />
        <div class="header__search-results" id="header-search-results" role="listbox"></div>
      </div>

      <div class="header__actions">
        <button class="header__icon-btn" data-open-search aria-label="সার্চ করুন" title="সার্চ" id="mobile-search-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>

        <button class="header__icon-btn theme-toggle" data-theme-toggle aria-label="থিম পরিবর্তন করুন">
          <span class="icon-sun" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42 M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </span>
          <span class="icon-moon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          </span>
        </button>

        <a href="search.html" class="btn btn--primary header__cta">Shop Now</a>

        <button class="hamburger" aria-label="মেনু খুলুন" aria-expanded="false">
          <span class="hamburger__line"></span>
          <span class="hamburger__line"></span>
          <span class="hamburger__line"></span>
        </button>
      </div>
    </div>
  </header>

  <div class="search-overlay" role="dialog" aria-label="সার্চ">
    <div class="search-overlay__inner">
      <div class="search-overlay__top" style="max-width:var(--container-max);margin:0 auto var(--space-4)">
        <span class="search-overlay__title">পণ্য খুঁজুন</span>
        <button class="search-overlay__close" aria-label="সার্চ বন্ধ করুন">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="search-overlay__input-wrap">
        <svg class="search-overlay__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="search" id="search-overlay-input" class="search-overlay__input" placeholder="পণ্যের নাম, কোড, ক্যাটাগরি, ব্র্যান্ড..." autocomplete="off" />
      </div>
      <div class="search-overlay__results" id="search-overlay-results"></div>
    </div>
  </div>

  <div class="mobile-nav__overlay"></div>

  <nav class="mobile-nav" aria-label="মোবাইল নেভিগেশন">
    <div class="mobile-nav__header">
      <span class="mobile-nav__logo">R BD SHOP</span>
      <button class="mobile-nav__close" aria-label="মেনু বন্ধ করুন">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="mobile-nav__body">
      <ul class="mobile-nav__links">
        <li><a href="index.html" class="mobile-nav__link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          হোম
        </a></li>
        <li><a href="search.html" class="mobile-nav__link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          সব পণ্য
        </a></li>
        <li><a href="category.html" class="mobile-nav__link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          ক্যাটাগরি
        </a></li>
        <li><div class="mobile-nav__divider"></div></li>
        ${settings.whatsappNumber ? `
        <li><a href="https://wa.me/${settings.whatsappNumber.replace(/\D/g,'')}" class="mobile-nav__link" target="_blank" rel="noopener">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color:var(--clr-whatsapp)">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          </svg>
          WhatsApp সাপোর্ট
        </a></li>` : ''}
      </ul>
    </div>
    <div class="mobile-nav__footer">
      <a href="search.html" class="btn btn--primary btn--sm" style="width:100%;justify-content:center">Shop Now</a>
    </div>
  </nav>`;
}

/* ─────────────────────────────────────────────────────────────
   Main Init
───────────────────────────────────────────────────────────── */
export function initHeader() {
  initStickyHeader();
  initMobileNav();       // ✅ Now uses body-level delegation
  initSearchOverlay();
  initInlineSearch();
  initActiveNavLink();
        }
