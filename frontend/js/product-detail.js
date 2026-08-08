/* ============================================================
   R BD SHOP — Product Detail Page JavaScript
   Path: frontend/js/product-detail.js
   Description: Loads single product from Firestore by slug,
                renders gallery, info, tabs, order links,
                reviews, related products, SEO tags.
   ============================================================ */

import { db }          from './firebase-config.js';
import {
  collection, query, where, orderBy,
  limit, getDocs, doc, getDoc
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initTheme }   from './theme.js';
import { buildHeaderHTML, initHeader } from './header.js';
import { initShareButtons } from './share.js';
import {
  hidePageLoader, initBackToTop, initLazyLoad,
  formatPrice, calcDiscount, calcSavings,
  getStockStatus, escapeHtml, renderStars,
  renderProductCard, renderProductSkeletons,
  getQueryParam, getProductUrl, getCategoryUrl,
  buildWhatsAppOrderLink, buildTelegramOrderLink,
  updateMetaTags, copyToClipboard, showToast, show, hide
}                      from './utils.js';

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let product      = null;
let shopSettings = {};
let quantity     = 1;

/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  await loadSettings();
  injectHeader();
  initHeader();

  const slug = getQueryParam('slug');
  if (!slug) {
    showProductNotFound();
    hidePageLoader();
    return;
  }

  await loadProduct(slug);

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
   LOAD PRODUCT by slug
───────────────────────────────────────────────────────────── */
async function loadProduct(slug) {
  try {
    const prodQuery = query(
      collection(db, 'products'),
      where('slug', '==', slug),
      where('status', 'in', ['published', 'outofstock']),
      limit(1)
    );

    const snapshot = await getDocs(prodQuery);

    if (snapshot.empty) {
      showProductNotFound();
      return;
    }

    product = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    renderProduct();
    renderTabs();
    initGallery();
    initQuantity();
    initOrderButtons();
    initTabs();
    initProductCode();
    initMobileBar();
    updateSEO();

    await Promise.allSettled([
      loadProductReviews(),
      loadRelatedProducts(),
    ]);

    initLazyLoad();

  } catch (err) {
    console.error('[R BD SHOP] Load product error:', err);
    showProductNotFound();
  }
}

/* ─────────────────────────────────────────────────────────────
   RENDER PRODUCT INFO
───────────────────────────────────────────────────────────── */
function renderProduct() {
  if (!product) return;

  const p = product;
  const isOutOfStock = p.status === 'outofstock' || (p.stockQuantity || 0) <= 0;

  // Breadcrumb
  const bcCat     = document.getElementById('breadcrumb-category');
  const bcProduct = document.getElementById('breadcrumb-product');
  if (bcCat) {
    bcCat.innerHTML = p.categoryName
      ? `<a href="${getCategoryUrl(p.categoryName)}">${escapeHtml(p.categoryName)}</a>`
      : '—';
  }
  if (bcProduct) bcProduct.textContent = p.name || '—';

  // Product Code
  const codeText = document.getElementById('product-code-text');
  if (codeText) codeText.textContent = p.productCode || p.id;

  // Title
  const title = document.getElementById('product-title');
  if (title) title.textContent = p.name || '—';

  // Category + Brand
  const catLink = document.getElementById('product-category-link');
  if (catLink && p.categoryName) {
    catLink.textContent = p.categoryName;
    catLink.href = getCategoryUrl(p.categoryName);
  }
  const brandEl = document.getElementById('product-brand');
  if (brandEl) brandEl.textContent = p.brand ? `ব্র্যান্ড: ${p.brand}` : '';

  // Rating
  if (p.reviewCount && p.reviewCount > 0) {
    const ratingEl = document.getElementById('product-rating');
    const starsEl  = document.getElementById('product-stars');
    const countEl  = document.getElementById('product-review-count');
    if (ratingEl) ratingEl.style.display = 'flex';
    if (starsEl)  starsEl.innerHTML = renderStars(p.averageRating || 0, true);
    if (countEl)  countEl.textContent = `(${p.reviewCount} রিভিউ)`;
  }

  // Price
  const priceEl    = document.getElementById('product-price');
  const oldPriceEl = document.getElementById('product-old-price');
  const discountEl = document.getElementById('product-discount-badge');
  const savingsEl  = document.getElementById('product-savings');

  if (priceEl) priceEl.textContent = formatPrice(p.price);

  if (p.oldPrice && p.oldPrice > p.price) {
    if (oldPriceEl) {
      oldPriceEl.textContent = formatPrice(p.oldPrice);
      show(oldPriceEl);
    }
    const disc = p.discount || calcDiscount(p.oldPrice, p.price);
    if (discountEl && disc > 0) {
      discountEl.textContent = `-${disc}%`;
      show(discountEl);
    }
    const saved = calcSavings(p.oldPrice, p.price);
    if (savingsEl && saved > 0) {
      savingsEl.textContent = `আপনি সাশ্রয় করবেন ${formatPrice(saved)}`;
      show(savingsEl);
    }
  }

  // Stock
  const stockEl = document.getElementById('product-stock');
  if (stockEl) {
    const stock = getStockStatus(p.stockQuantity || 0);
    stockEl.innerHTML = `
      <span class="stock-status stock-status--${stock.cssClass}">
        <span class="stock-status__dot"></span>
        ${escapeHtml(stock.label)}
      </span>`;
  }

  // Short Description
  const shortDesc = document.getElementById('product-short-desc');
  if (shortDesc) shortDesc.textContent = p.shortDescription || '';

  // Out of stock handling
  const orderSection  = document.getElementById('order-section');
  const outOfStockMsg = document.getElementById('out-of-stock-msg');
  const qtySelector   = document.getElementById('quantity-selector');

  if (isOutOfStock) {
    if (orderSection)  hide(orderSection);
    if (qtySelector)   hide(qtySelector);
    if (outOfStockMsg) show(outOfStockMsg);
  } else {
    if (orderSection)  show(orderSection);
    if (qtySelector)   show(qtySelector);
    if (outOfStockMsg) hide(outOfStockMsg);
  }

  // Gallery
  renderGallery();

  // Share buttons
  initShareButtons({
    title:     p.name,
    url:       window.location.href,
    image:     p.mainImage || '',
    price:     formatPrice(p.price),
    container: document.getElementById('share-buttons'),
  });

  // Show content, hide skeleton
  hide(document.getElementById('product-info-skeleton'));
  show(document.getElementById('product-info-content'));
}

/* ─────────────────────────────────────────────────────────────
   GALLERY
───────────────────────────────────────────────────────────── */
function renderGallery() {
  if (!product) return;

  const mainImg  = document.getElementById('gallery-main-img');
  const thumbs   = document.getElementById('gallery-thumbs');
  const badges   = document.getElementById('gallery-badges');

  const allImages = [product.mainImage, ...(product.galleryImages || [])].filter(Boolean);
  const firstImg  = allImages[0] || '';

  if (mainImg) {
    mainImg.src = firstImg;
    mainImg.alt = product.name || 'পণ্যের ছবি';
  }

  // Badges
  if (badges) {
    let badgeHtml = '';
    const disc = product.discount || calcDiscount(product.oldPrice, product.price);
    if (disc > 0) badgeHtml += `<span class="badge badge--discount">-${disc}%</span>`;
    if ((product.stockQuantity || 0) <= 0) badgeHtml += `<span class="badge badge--outofstock">স্টক শেষ</span>`;
    badges.innerHTML = badgeHtml;
  }

  // Thumbnails
  if (thumbs && allImages.length > 1) {
    thumbs.innerHTML = allImages.map((img, i) => `
      <button class="gallery__thumb ${i === 0 ? 'active' : ''}"
              data-img="${escapeHtml(img)}" aria-label="ছবি ${i + 1}">
        <img src="${escapeHtml(img)}" alt="Thumbnail ${i + 1}" loading="lazy" />
      </button>
    `).join('');
  } else if (thumbs) {
    thumbs.innerHTML = '';
  }
}

function initGallery() {
  // Thumbnail click
  const thumbs  = document.getElementById('gallery-thumbs');
  const mainImg = document.getElementById('gallery-main-img');
  if (!thumbs || !mainImg) return;

  thumbs.addEventListener('click', (e) => {
    const thumb = e.target.closest('.gallery__thumb');
    if (!thumb) return;

    const imgUrl = thumb.dataset.img;
    if (!imgUrl) return;

    mainImg.src = imgUrl;

    thumbs.querySelectorAll('.gallery__thumb').forEach((t) => t.classList.remove('active'));
    thumb.classList.add('active');
  });

  // Zoom on main image click
  const galleryMain = document.getElementById('gallery-main');
  if (galleryMain) {
    galleryMain.addEventListener('click', () => {
      if (!mainImg.src) return;
      openZoom(mainImg.src);
    });
  }
}

function openZoom(src) {
  const root = document.getElementById('zoom-modal-root');
  if (!root) return;

  root.innerHTML = `
    <div class="zoom-modal" id="zoom-modal">
      <img src="${escapeHtml(src)}" alt="Zoomed" />
    </div>`;

  const modal = document.getElementById('zoom-modal');
  if (modal) {
    modal.addEventListener('click', () => {
      root.innerHTML = '';
    });
  }

  document.addEventListener('keydown', function closeZoom(e) {
    if (e.key === 'Escape') {
      root.innerHTML = '';
      document.removeEventListener('keydown', closeZoom);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   QUANTITY SELECTOR
───────────────────────────────────────────────────────────── */
function initQuantity() {
  const minusBtn = document.getElementById('qty-minus');
  const plusBtn  = document.getElementById('qty-plus');
  const valueEl = document.getElementById('qty-value');
  if (!minusBtn || !plusBtn || !valueEl) return;

  const maxStock = product ? (product.stockQuantity || 999) : 999;
  quantity = 1;
  valueEl.textContent = quantity;
  updateQtyButtons();

  minusBtn.addEventListener('click', () => {
    if (quantity > 1) {
      quantity--;
      valueEl.textContent = quantity;
      updateQtyButtons();
      updateOrderLinks();
    }
  });

  plusBtn.addEventListener('click', () => {
    if (quantity < maxStock) {
      quantity++;
      valueEl.textContent = quantity;
      updateQtyButtons();
      updateOrderLinks();
    }
  });

  function updateQtyButtons() {
    minusBtn.disabled = quantity <= 1;
    plusBtn.disabled  = quantity >= maxStock;
  }
}

/* ─────────────────────────────────────────────────────────────
   ORDER BUTTONS (WhatsApp + Telegram)
───────────────────────────────────────────────────────────── */
function initOrderButtons() {
  updateOrderLinks();

  // "এখনই অর্ডার করুন" → WhatsApp-এ redirect
  const orderNow = document.getElementById('btn-order-now');
  if (orderNow) {
    orderNow.addEventListener('click', (e) => {
      e.preventDefault();
      const waLink = getWhatsAppLink();
      if (waLink) window.open(waLink, '_blank');
      else showToast('WhatsApp নম্বর কনফিগার করা হয়নি', 'warning');
    });
  }
}

function updateOrderLinks() {
  if (!product) return;

  const productData = {
    name:        product.name,
    productCode: product.productCode || product.id,
    price:       product.price,
    quantity:     quantity,
  };

  // WhatsApp
  const waLink = getWhatsAppLink();
  const waBtn  = document.getElementById('btn-whatsapp');
  const mWaBtn = document.getElementById('mobile-btn-whatsapp');
  if (waBtn)  waBtn.href  = waLink || '#';
  if (mWaBtn) mWaBtn.href = waLink || '#';

  // Telegram
  const tgLink = getTelegramLink();
  const tgBtn  = document.getElementById('btn-telegram');
  const mTgBtn = document.getElementById('mobile-btn-telegram');
  if (tgBtn)  tgBtn.href  = tgLink || '#';
  if (mTgBtn) mTgBtn.href = tgLink || '#';

  // Mobile order button
  const mOrderBtn = document.getElementById('mobile-btn-order');
  if (mOrderBtn) {
    mOrderBtn.href = waLink || '#';
    mOrderBtn.addEventListener('click', (e) => {
      if (!waLink) {
        e.preventDefault();
        showToast('WhatsApp নম্বর কনফিগার করা হয়নি', 'warning');
      }
    });
  }

  // Hide buttons if not enabled
  if (!product.whatsappOrderEnabled && waBtn) hide(waBtn);
  if (!product.telegramOrderEnabled && tgBtn) hide(tgBtn);
}

function getWhatsAppLink() {
  if (!shopSettings.whatsappNumber || !product) return null;
  return buildWhatsAppOrderLink(shopSettings.whatsappNumber, {
    name:        product.name,
    productCode: product.productCode || product.id,
    price:       product.price,
    quantity:    quantity,
  });
}

function getTelegramLink() {
  const tgUser = shopSettings.telegramUsername || shopSettings.telegramLink;
  if (!tgUser || !product) return null;
  return buildTelegramOrderLink(tgUser, {
    name:        product.name,
    productCode: product.productCode || product.id,
    price:       product.price,
    quantity:    quantity,
  });
}

/* ─────────────────────────────────────────────────────────────
   PRODUCT CODE COPY
───────────────────────────────────────────────────────────── */
function initProductCode() {
  const codeEl = document.getElementById('product-code');
  if (!codeEl) return;

  codeEl.addEventListener('click', async () => {
    const code = product?.productCode || product?.id || '';
    const ok   = await copyToClipboard(code);
    showToast(ok ? `কোড "${code}" কপি হয়েছে!` : 'কপি করতে সমস্যা হয়েছে', ok ? 'success' : 'error');
  });
}

/* ─────────────────────────────────────────────────────────────
   TABS
───────────────────────────────────────────────────────────── */
function renderTabs() {
  if (!product) return;

  // Description
  const descEl = document.getElementById('description-content');
  if (descEl) {
    descEl.innerHTML = product.fullDescription
      ? `<div>${product.fullDescription.replace(/\n/g, '<br/>')}</div>`
      : '<p class="text-muted">কোনো বিবরণ যোগ করা হয়নি।</p>';
  }

  // Warranty
  if (product.warrantyInfo) {
    const warBox  = document.getElementById('warranty-box');
    const warText = document.getElementById('warranty-text');
    if (warBox && warText) {
      warText.innerHTML = `<strong>ওয়ারেন্টি:</strong> ${escapeHtml(product.warrantyInfo)}`;
      show(warBox);
    }
  }

  // Features
  const featEl = document.getElementById('features-list');
  if (featEl && product.features && product.features.length > 0) {
    featEl.innerHTML = product.features.map((f) => `
      <div class="features-list__item">
        <svg class="features-list__icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <span>${escapeHtml(f)}</span>
      </div>
    `).join('');
  }

  // Specifications
  const specEl = document.getElementById('specifications-content');
  if (specEl && product.specifications && Object.keys(product.specifications).length > 0) {
    const rows = Object.entries(product.specifications).map(([key, val]) => `
      <tr>
        <td>${escapeHtml(key)}</td>
        <td>${escapeHtml(String(val))}</td>
      </tr>
    `).join('');
    specEl.innerHTML = `<table class="spec-table">${rows}</table>`;
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.product-tab-btn');
  const tabContents = document.querySelectorAll('.product-tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(`tab-${tabId}`);
      if (target) target.classList.add('active');
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   REVIEWS (Product-specific)
───────────────────────────────────────────────────────────── */
async function loadProductReviews() {
  if (!product) return;

  const listEl  = document.getElementById('reviews-list');
  const countEl = document.getElementById('tab-review-count');
  if (!listEl) return;

  try {
    const revQuery = query(
      collection(db, 'reviews'),
      where('productId', '==', product.id),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(revQuery);

    if (snapshot.empty) {
      listEl.innerHTML = '<p class="text-muted" style="padding:var(--space-6)">এই পণ্যে এখনো কোনো রিভিউ নেই।</p>';
      if (countEl) countEl.textContent = '';
      return;
    }

    if (countEl) countEl.textContent = `(${snapshot.size})`;

    let html = '';
    snapshot.forEach((docSnap) => {
      const rev     = docSnap.data();
      const initial = (rev.customerName || 'U').charAt(0).toUpperCase();

      html += `
        <div class="review-card">
          <div class="review-card__top">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div class="review-card__avatar">${initial}</div>
              <div>
                <div class="review-card__name">${escapeHtml(rev.customerName || 'গ্রাহক')}</div>
              </div>
            </div>
            ${renderStars(rev.rating || 5)}
          </div>
          <p class="review-card__text">${escapeHtml(rev.comment || '')}</p>
        </div>`;
    });

    listEl.innerHTML = html;

  } catch (err) {
    console.warn('[R BD SHOP] Reviews error:', err);
  }
}

/* ─────────────────────────────────────────────────────────────
   RELATED PRODUCTS
───────────────────────────────────────────────────────────── */
async function loadRelatedProducts() {
  if (!product) return;

  const grid = document.getElementById('related-grid');
  if (!grid) return;

  grid.innerHTML = renderProductSkeletons(4);

  try {
    const relQuery = query(
      collection(db, 'products'),
      where('status', '==', 'published'),
      where('categoryName', '==', product.categoryName || '__none__'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const snapshot = await getDocs(relQuery);

    const related = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.id !== product.id) {
        related.push({ id: docSnap.id, ...docSnap.data() });
      }
    });

    if (related.length === 0) {
      const section = document.getElementById('related-products');
      if (section) section.style.display = 'none';
      return;
    }

    grid.innerHTML = related.slice(0, 4).map((p) => renderProductCard(p)).join('');
    initLazyLoad();

  } catch (err) {
    console.warn('[R BD SHOP] Related products error:', err);
    grid.innerHTML = '';
  }
}

/* ─────────────────────────────────────────────────────────────
   MOBILE STICKY BAR
───────────────────────────────────────────────────────────── */
function initMobileBar() {
  const bar = document.getElementById('product-mobile-bar');
  if (!bar || !product) return;

  const isOut = product.status === 'outofstock' || (product.stockQuantity || 0) <= 0;
  if (isOut) {
    bar.style.display = 'none';
    return;
  }

  // Show bar on mobile when user scrolls past CTA section
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          bar.style.display = 'none';
        } else {
          bar.style.display = 'flex';
        }
      });
    },
    { threshold: 0 }
  );

  const orderSection = document.getElementById('order-section');
  if (orderSection) observer.observe(orderSection);
}

/* ─────────────────────────────────────────────────────────────
   SEO TAGS UPDATE
───────────────────────────────────────────────────────────── */
function updateSEO() {
  if (!product) return;

  updateMetaTags({
    title:       product.name,
    description: product.shortDescription || `${product.name} — ${formatPrice(product.price)} — R BD SHOP`,
    image:       product.mainImage || '',
    url:         window.location.href,
    price:       String(product.price),
  });

  // JSON-LD
  const jsonLd = {
    '@context':    'https://schema.org',
    '@type':       'Product',
    name:          product.name,
    description:   product.shortDescription || product.fullDescription || '',
    image:         product.mainImage || '',
    sku:           product.productCode || product.id,
    brand:         product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: {
      '@type':         'Offer',
      price:           product.price,
      priceCurrency:   'BDT',
      availability:    (product.stockQuantity || 0) > 0
                         ? 'https://schema.org/InStock'
                         : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name:    'R BD SHOP',
      },
    },
  };

  if (product.averageRating && product.reviewCount) {
    jsonLd.aggregateRating = {
      '@type':      'AggregateRating',
      ratingValue:  product.averageRating,
      reviewCount:  product.reviewCount,
    };
  }

  const scriptEl = document.getElementById('product-jsonld');
  if (scriptEl) scriptEl.textContent = JSON.stringify(jsonLd);
}

/* ─────────────────────────────────────────────────────────────
   PRODUCT NOT FOUND
───────────────────────────────────────────────────────────── */
function showProductNotFound() {
  const layout = document.getElementById('product-layout');
  const tabs   = document.getElementById('product-tabs');
  const related= document.getElementById('related-products');

  if (layout) {
    layout.innerHTML = `
      <div class="empty-state" style="width:100%;padding:var(--space-20) var(--space-4)">
        <div class="empty-state__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </div>
        <h2 class="empty-state__title">পণ্য পাওয়া যায়নি</h2>
        <p class="empty-state__desc">এই পণ্যটি আর উপলব্ধ নেই অথবা URL ভুল হয়েছে।</p>
        <a href="index.html" class="btn btn--primary" style="margin-top:var(--space-4)">
          ← হোমে ফিরে যান
        </a>
      </div>`;
  }
  if (tabs)    tabs.style.display = 'none';
  if (related) related.style.display = 'none';
}

/* ─────────────────────────────────────────────────────────────
   FOOTER UPDATE
───────────────────────────────────────────────────────────── */
function updateFooter() {
  const s = shopSettings;
  if (s.whatsappNumber) {
    const waUrl = `https://wa.me/${s.whatsappNumber.replace(/\D/g, '')}`;
    const el = document.getElementById('footer-wa');
    if (el) el.href = waUrl;
  }
  if (s.telegramLink || s.telegramUsername) {
    const tgUrl = s.telegramLink || `https://t.me/${(s.telegramUsername || '').replace('@', '')}`;
    const el = document.getElementById('footer-tg');
    if (el) el.href = tgUrl;
  }
}
