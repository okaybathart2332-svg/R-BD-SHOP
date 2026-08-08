/* ============================================================
   R BD SHOP — Header JavaScript
   Path: frontend/js/header.js
   Description: Sticky scroll, mobile nav drawer, search overlay,
                inline search with live results, active nav link
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
   Header Elements
───────────────────────────────────────────────────────────── */
const header          = document.querySelector('.header');
const hamburger       = document.querySelector('.hamburger');
const mobileNav       = document.querySelector('.mobile-nav');
const mobileOverlay   = document.querySelector('.mobile-nav__overlay');
const mobileNavClose  = document.querySelector('.mobile-nav__close');

// Search — overlay (mobile + icon click)
const searchOverlay   = document.querySelector('.search-overlay');
const searchOverlayClose = document.querySelector('.search-overlay__close');
const searchOverlayInput = document.querySelector('#search-overlay-input');
const searchOverlayResults = document.querySelector('.search-overlay__results');

// Search — inline (desktop header)
const inlineSearchInput   = document.querySelector('#header-search-input');
const inlineSearchResults = document.querySelector('.header__search-results');

/* ─────────────────────────────────────────────────────────────
   1. Sticky Header — scroll-এ shadow/bg update
───────────────────────────────────────────────────────────── */
function initStickyHeader() {
  if (!header) return;

  const handleScroll = throttle(() => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, 80);

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // initial check
}

/* ─────────────────────────────────────────────────────────────
   2. Mobile Navigation Drawer
───────────────────────────────────────────────────────────── */
function openMobileNav() {
  if (!mobileNav) return;
  mobileNav.classList.add('open');
  if (mobileOverlay) mobileOverlay.classList.add('active');
  if (hamburger)     hamburger.classList.add('open');
  document.body.style.overflow = 'hidden'; // scroll lock
}

function closeMobileNav() {
  if (!mobileNav) return;
  mobileNav.classList.remove('open');
  if (mobileOverlay) mobileOverlay.classList.remove('active');
  if (hamburger)     hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

function initMobileNav() {
  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mobileNav?.classList.contains('open')) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });
  }

  if (mobileNavClose) {
    mobileNavClose.addEventListener('click', closeMobileNav);
  }

  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileNav);
  }

  // Escape key দিয়ে close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileNav();
      closeSearchOverlay();
    }
  });

  // Mobile nav links click করলে close
  const mobileNavLinks = document.querySelectorAll('.mobile-nav__link');
  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      setTimeout(closeMobileNav, 100);
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   3. Search Overlay (full-screen, mobile & tablet)
───────────────────────────────────────────────────────────── */
function openSearchOverlay() {
  if (!searchOverlay) return;
  searchOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    if (searchOverlayInput) searchOverlayInput.focus();
  }, 300);
}

function closeSearchOverlay() {
  if (!searchOverlay) return;
  searchOverlay.classList.remove('active');
  document.body.style.overflow = '';
  if (searchOverlayResults) searchOverlayResults.innerHTML = '';
  if (searchOverlayInput)   searchOverlayInput.value = '';
}

function initSearchOverlay() {
  // Search icon button click
  const searchIconBtns = document.querySelectorAll('[data-open-search]');
  searchIconBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openSearchOverlay();
    });
  });

  if (searchOverlayClose) {
    searchOverlayClose.addEventListener('click', closeSearchOverlay);
  }

  // Overlay background click to close
  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) closeSearchOverlay();
    });
  }

  // Overlay input — live search
  if (searchOverlayInput) {
    const debouncedSearch = debounce(async (query) => {
      await performSearch(query, searchOverlayResults, 'overlay');
    }, 350);

    searchOverlayInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val.length < 2) {
        if (searchOverlayResults) searchOverlayResults.innerHTML = '';
        return;
      }
      debouncedSearch(val);
    });

    // Enter key → search page-এ redirect
    searchOverlayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchOverlayInput.value.trim();
        if (val) {
          window.location.href = `search.html?q=${encodeURIComponent(val)}`;
        }
      }
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   4. Inline Search (desktop header)
───────────────────────────────────────────────────────────── */
function initInlineSearch() {
  if (!inlineSearchInput) return;

  const debouncedSearch = debounce(async (query) => {
    await performSearch(query, inlineSearchResults, 'inline');
  }, 350);

  inlineSearchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length < 2) {
      hideInlineResults();
      return;
    }
    debouncedSearch(val);
  });

  // Enter key → search page
  inlineSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = inlineSearchInput.value.trim();
      if (val) {
        window.location.href = `search.html?q=${encodeURIComponent(val)}`;
      }
    }
    if (e.key === 'Escape') {
      hideInlineResults();
      inlineSearchInput.blur();
    }
  });

  // Click outside — hide results
  document.addEventListener('click', (e) => {
    if (!inlineSearchInput.contains(e.target) &&
        !inlineSearchResults?.contains(e.target)) {
      hideInlineResults();
    }
  });
}

function hideInlineResults() {
  if (!inlineSearchResults) return;
  inlineSearchResults.classList.remove('active');
  inlineSearchResults.innerHTML = '';
}

/* ─────────────────────────────────────────────────────────────
   5. Live Search — Firestore Query
───────────────────────────────────────────────────────────── */

/**
 * Firestore থেকে product search করে
 * @param {string} queryText - user-এর input
 * @param {HTMLElement} resultsContainer - কোথায় দেখাবে
 * @param {'overlay'|'inline'} mode
 */
async function performSearch(queryText, resultsContainer, mode) {
  if (!resultsContainer || !queryText) return;

  // Loading state
  resultsContainer.innerHTML = `
    <div class="search-no-result" style="padding:var(--space-6)">
      <div class="loader-spinner" style="margin:0 auto"></div>
    </div>`;

  if (mode === 'inline') {
    resultsContainer.classList.add('active');
  }

  try {
    const lowerQuery = queryText.toLowerCase();

    // Firestore-এ full-text search নেই।
    // Strategy: name (slug prefix), productCode exact, category match
    // Published products only।

    // Query 1: productCode exact match
    const codeQuery = query(
      collection(db, 'products'),
      where('status', '==', 'published'),
      where('productCode', '==', queryText.toUpperCase()),
      limit(3)
    );

    // Query 2: slug/name-এর prefix match (Firestore limitation workaround)
    // slug-এর prefix দিয়ে range query
    const slugStart = lowerQuery;
    const slugEnd   = lowerQuery + '\uf8ff';
    const slugQuery = query(
      collection(db, 'products'),
      where('status', '==', 'published'),
      where('slug', '>=', slugStart),
      where('slug', '<=', slugEnd),
      orderBy('slug'),
      limit(5)
    );

    // Query 3: category name match
    const catQuery = query(
      collection(db, 'products'),
      where('status', '==', 'published'),
      where('categoryName', '>=', queryText),
      where('categoryName', '<=', queryText + '\uf8ff'),
      orderBy('categoryName'),
      limit(3)
    );

    // Parallel execution
    const [codeSnap, slugSnap, catSnap] = await Promise.allSettled([
      getDocs(codeQuery),
      getDocs(slugQuery),
      getDocs(catQuery),
    ]);

    // Results merge (dedup by id)
    const seenIds = new Set();
    const products = [];

    const addResults = (snap) => {
      if (snap.status !== 'fulfilled') return;
      snap.value.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          products.push(data);
        }
      });
    };

    addResults(codeSnap);
    addResults(slugSnap);
    addResults(catSnap);

    // Client-side name filter (partial match যা Firestore এ করা যায় না)
    const nameFiltered = products.filter((p) => {
      const searchIn = [
        p.name, p.productCode,
        p.categoryName, p.brand,
        p.slug
      ].filter(Boolean).join(' ').toLowerCase();
      return searchIn.includes(lowerQuery);
    });

    // Deduplicate again after filter merge
    const finalResults = [...new Map(nameFiltered.map((p) => [p.id, p])).values()].slice(0, 6);

    renderSearchResults(finalResults, queryText, resultsContainer, mode);

  } catch (error) {
    console.error('[R BD SHOP] Search error:', error);
    resultsContainer.innerHTML = `
      <div class="search-no-result">
        সার্চ করতে সমস্যা হয়েছে। একটু পরে চেষ্টা করুন।
      </div>`;
    if (mode === 'inline') resultsContainer.classList.add('active');
  }
}

/**
 * Search results render করে
 */
function renderSearchResults(products, queryText, container, mode) {
  if (!container) return;

  if (!products.length) {
    container.innerHTML = `
      <div class="search-no-result">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" style="margin:0 auto var(--space-3);color:var(--txt-muted)">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        "<strong>${escapeHtml(queryText)}</strong>" — কোনো পণ্য পাওয়া যায়নি
      </div>`;
    if (mode === 'inline') container.classList.add('active');
    return;
  }

  if (mode === 'inline') {
    // Inline compact results
    const html = products.map((p) => `
      <a href="${getProductUrl(p.slug)}" class="header__search-result-item">
        <img
          src="${p.mainImage || getPlaceholderImage(80, 80)}"
          alt="${escapeHtml(p.name)}"
          class="header__search-result-img"
          loading="lazy"
        />
        <div>
          <div class="header__search-result-name">
            ${highlightText(p.name, queryText)}
          </div>
          <div class="header__search-result-price">
            ${formatPrice(p.price)}
          </div>
        </div>
      </a>`).join('');

    const viewAllLink = `
      <a href="search.html?q=${encodeURIComponent(queryText)}"
         class="header__search-result-view-all">
        সব ফলাফল দেখুন →
      </a>`;

    container.innerHTML = html + viewAllLink;
    container.classList.add('active');

  } else {
    // Overlay grid results
    const html = products.map((p) => {
      const stockOk = p.stockQuantity > 0 && p.status === 'published';
      return `
        <a href="${getProductUrl(p.slug)}" class="search-result-card">
          <img
            src="${p.mainImage || getPlaceholderImage(100, 100)}"
            alt="${escapeHtml(p.name)}"
            class="search-result-card__img"
            loading="lazy"
          />
          <div class="search-result-card__info">
            <div class="search-result-card__name">
              ${highlightText(p.name, queryText)}
            </div>
            <div class="search-result-card__price">${formatPrice(p.price)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--txt-muted);margin-top:2px">
              ${p.productCode} • ${stockOk ? 'স্টকে আছে' : 'স্টক শেষ'}
            </div>
          </div>
        </a>`;
    }).join('');

    const viewAll = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--space-3) 0;
                  border-top:1px solid var(--border-primary);margin-top:var(--space-2)">
        <a href="search.html?q=${encodeURIComponent(queryText)}"
           class="btn btn--secondary btn--sm">
          সব ফলাফল দেখুন (${products.length}+)
        </a>
      </div>`;

    container.innerHTML = html + viewAll;
  }
}

/* ─────────────────────────────────────────────────────────────
   6. Active Navigation Link Highlighter
───────────────────────────────────────────────────────────── */
function initActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Desktop nav links
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
   7. Header HTML Injector
   প্রতিটি page-এ একই header inject করার জন্য
───────────────────────────────────────────────────────────── */

/**
 * Header HTML তৈরি করে
 * @param {object} settings - Firestore settings doc data
 * @returns {string} HTML
 */
export function buildHeaderHTML(settings = {}) {
  const shopName = settings.shopName || 'R BD SHOP';

  return `
  <header class="header" id="site-header">
    <div class="header__inner">

      <!-- Logo -->
      <a href="index.html" class="header__logo" aria-label="${escapeHtml(shopName)} হোম">
        <div class="header__logo-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
        </div>
        <div class="header__logo-text">
          <span class="header__logo-name">
            <span>R BD</span> SHOP
          </span>
          <span class="header__logo-tagline">আপনার বিশ্বস্ত শপ</span>
        </div>
      </a>

      <!-- Desktop Navigation -->
      <nav class="header__nav" aria-label="প্রধান নেভিগেশন">
        <a href="index.html"    class="nav__link">হোম</a>
        <a href="search.html"  class="nav__link">পণ্যসমূহ</a>
        <a href="category.html"class="nav__link">ক্যাটাগরি</a>
        <a href="search.html"  class="nav__link" data-open-search>সার্চ</a>
        ${settings.whatsappNumber
          ? `<a href="https://wa.me/${settings.whatsappNumber.replace(/\D/g,'')}"
                class="nav__link" target="_blank" rel="noopener">সাপোর্ট</a>`
          : '<a href="#" class="nav__link">সাপোর্ট</a>'
        }
      </nav>

      <!-- Inline Search (desktop) -->
      <div class="header__search-inline" role="search">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search"
          id="header-search-input"
          placeholder="পণ্য খুঁজুন..."
          autocomplete="off"
          aria-label="পণ্য সার্চ করুন"
        />
        <div class="header__search-results" id="header-search-results" role="listbox">
        </div>
      </div>

      <!-- Header Action Buttons -->
      <div class="header__actions">

        <!-- Search icon (mobile) -->
        <button
          class="header__icon-btn"
          data-open-search
          aria-label="সার্চ করুন"
          title="সার্চ"
          style="display:none"
          id="mobile-search-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>

        <!-- Theme Toggle -->
        <button
          class="header__icon-btn theme-toggle"
          data-theme-toggle
          aria-label="থিম পরিবর্তন করুন"
          title="ডার্ক/লাইট মোড"
        >
          <!-- Sun icon (dark mode-এ দেখা যাবে) -->
          <span class="icon-sun" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42
                       M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </span>
          <!-- Moon icon (light mode-এ দেখা যাবে) -->
          <span class="icon-moon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          </span>
        </button>

        <!-- Shop Now CTA -->
        <a href="search.html" class="btn btn--primary header__cta">
          Shop Now
        </a>

        <!-- Hamburger (mobile) -->
        <button class="hamburger" aria-label="মেনু খুলুন" aria-expanded="false">
          <span class="hamburger__line"></span>
          <span class="hamburger__line"></span>
          <span class="hamburger__line"></span>
        </button>

      </div>
    </div>
  </header>

  <!-- Search Overlay -->
  <div class="search-overlay" role="dialog" aria-label="সার্চ">
    <div class="search-overlay__inner">
      <div class="search-overlay__top" style="max-width:var(--container-max);margin:0 auto var(--space-4)">
        <span class="search-overlay__title">পণ্য খুঁজুন</span>
        <button class="search-overlay__close" aria-label="সার্চ বন্ধ করুন">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="search-overlay__input-wrap">
        <svg class="search-overlay__search-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search"
          id="search-overlay-input"
          class="search-overlay__input"
          placeholder="পণ্যের নাম, কোড, ক্যাটাগরি, ব্র্যান্ড..."
          autocomplete="off"
          aria-label="পণ্য সার্চ"
        />
      </div>

      <div class="search-overlay__results" id="search-overlay-results"></div>
    </div>
  </div>

  <!-- Mobile Nav Overlay -->
  <div class="mobile-nav__overlay"></div>

  <!-- Mobile Nav Drawer -->
  <nav class="mobile-nav" aria-label="মোবাইল নেভিগেশন">
    <div class="mobile-nav__header">
      <span class="mobile-nav__logo">R BD SHOP</span>
      <button class="mobile-nav__close" aria-label="মেনু বন্ধ করুন">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="mobile-nav__body">
      <ul class="mobile-nav__links">
        <li>
          <a href="index.html" class="mobile-nav__link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            হোম
          </a>
        </li>
        <li>
          <a href="search.html" class="mobile-nav__link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            সব পণ্য
          </a>
        </li>
        <li>
          <a href="category.html" class="mobile-nav__link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            ক্যাটাগরি
          </a>
        </li>
        <li>
          <div class="mobile-nav__divider"></div>
        </li>
        ${settings.whatsappNumber ? `
        <li>
          <a href="https://wa.me/${settings.whatsappNumber.replace(/\D/g,'')}"
             class="mobile-nav__link" target="_blank" rel="noopener">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"
                 style="color:var(--clr-whatsapp)">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
                       -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463
                       -2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606
                       .134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371
                       -.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51
                       -.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016
                       -1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487
                       .709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719
                       2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.847L0 24l6.335-1.508
                       A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818
                       a9.826 9.826 0 01-5.031-1.38l-.361-.214-3.761.895.952-3.67-.235-.377
                       A9.818 9.818 0 012.182 12C2.182 6.589 6.589 2.182 12 2.182S21.818 6.589
                       21.818 12 17.411 21.818 12 21.818z"/>
            </svg>
            WhatsApp সাপোর্ট
          </a>
        </li>` : ''}
      </ul>
    </div>

    <div class="mobile-nav__footer">
      <button class="btn btn--ghost btn--sm flex-1"
              data-theme-toggle
              style="justify-content:center;gap:var(--space-2)">
        <span class="icon-moon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </span>
        <span class="icon-sun" style="display:none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42
                     M1 12h2M21 12h2"/>
          </svg>
        </span>
        <span class="theme-label">ডার্ক মোড</span>
      </button>
      <a href="search.html" class="btn btn--primary btn--sm flex-1"
         style="justify-content:center">
        Shop Now
      </a>
    </div>
  </nav>`;
}

/* ─────────────────────────────────────────────────────────────
   Main Init — সব page-এ call করো
───────────────────────────────────────────────────────────── */

/**
 * Header সম্পূর্ণ initialize করে
 * প্রতিটি page-এর <script>-এ import করে initHeader() call করো
 */
export function initHeader() {
  initStickyHeader();
  initMobileNav();
  initSearchOverlay();
  initInlineSearch();
  initActiveNavLink();

  // Mobile search btn — only show on small screens via CSS
  const mobileSearchBtn = document.getElementById('mobile-search-btn');
  if (mobileSearchBtn) {
    mobileSearchBtn.style.display = '';
  }
}
