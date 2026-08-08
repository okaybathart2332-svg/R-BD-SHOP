/* ============================================================
   R BD SHOP — Shared Utility Functions
   Path: frontend/js/utils.js
   Description: Reusable helpers used across the entire
                customer website. Import what you need.
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATION SYSTEM
══════════════════════════════════════════════════════════════ */

/**
 * টোস্ট নোটিফিকেশন দেখায়
 * @param {string} message  - যে বার্তা দেখাবে
 * @param {'success'|'error'|'warning'|'info'} type - টাইপ
 * @param {number} duration - মিলিসেকেন্ডে কতক্ষণ থাকবে (default 3500)
 */
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');

  // Container না থাকলে তৈরি করো
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Auto remove
  const removeTimer = setTimeout(() => removeToast(toast), duration);

  // Click to dismiss
  toast.addEventListener('click', () => {
    clearTimeout(removeTimer);
    removeToast(toast);
  });
}

/**
 * Toast সরিয়ে দেয় (animation সহ)
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('toast--removing');
  toast.addEventListener('animationend', () => {
    toast.remove();
  }, { once: true });
}

/* ══════════════════════════════════════════════════════════════
   PRICE FORMATTING
══════════════════════════════════════════════════════════════ */

/**
 * টাকা ফরম্যাট করে — ৳ চিহ্ন সহ
 * @param {number} amount
 * @param {boolean} showSymbol - ৳ চিহ্ন দেখাবে কিনা
 * @returns {string}
 */
export function formatPrice(amount, showSymbol = true) {
  if (isNaN(amount) || amount === null || amount === undefined) return '০';
  const formatted = Number(amount).toLocaleString('bn-BD');
  return showSymbol ? `৳${formatted}` : formatted;
}

/**
 * ডিসকাউন্ট পার্সেন্টেজ বের করে
 * @param {number} oldPrice
 * @param {number} newPrice
 * @returns {number}
 */
export function calcDiscount(oldPrice, newPrice) {
  if (!oldPrice || oldPrice <= 0 || newPrice >= oldPrice) return 0;
  return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
}

/**
 * সেভ হওয়া টাকার পরিমাণ বের করে
 * @param {number} oldPrice
 * @param {number} newPrice
 * @returns {number}
 */
export function calcSavings(oldPrice, newPrice) {
  if (!oldPrice || oldPrice <= newPrice) return 0;
  return oldPrice - newPrice;
}

/* ══════════════════════════════════════════════════════════════
   STRING UTILITIES
══════════════════════════════════════════════════════════════ */

/**
 * Text থেকে URL-safe slug তৈরি করে
 * @param {string} text
 * @returns {string}
 */
export function createSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')       // space/underscore → hyphen
    .replace(/[^\w\-]+/g, '')      // non-word chars বাদ
    .replace(/\-\-+/g, '-')        // multiple hyphens → single
    .replace(/^-+/, '')            // শুরুর hyphen বাদ
    .replace(/-+$/, '');           // শেষের hyphen বাদ
}

/**
 * HTML entities escape করে (XSS prevention)
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Long text truncate করে
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Search highlight — matching text-কে bold/mark করে
 * @param {string} text - মূল text
 * @param {string} query - যা খোঁজা হচ্ছে
 * @returns {string} - HTML string
 */
export function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escaped.replace(regex, '<mark class="highlight">$1</mark>');
}

/**
 * Product code তৈরি করে (RBD-XXXXX)
 * @returns {string}
 */
export function generateProductCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'RBD-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Order number তৈরি করে (ORD-2024-XXXXX)
 * @returns {string}
 */
export function generateOrderNumber() {
  const year  = new Date().getFullYear();
  const rand  = Math.floor(Math.random() * 90000) + 10000;
  return `ORD-${year}-${rand}`;
}

/* ══════════════════════════════════════════════════════════════
   DATE & TIME UTILITIES
══════════════════════════════════════════════════════════════ */

/**
 * Firebase Timestamp বা Date object থেকে readable date বের করে
 * @param {object|Date} timestamp
 * @param {'short'|'long'|'relative'} format
 * @returns {string}
 */
export function formatDate(timestamp, format = 'short') {
  if (!timestamp) return 'অজানা';

  let date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return 'অজানা';

  if (format === 'relative') {
    return getRelativeTime(date);
  }

  if (format === 'long') {
    return date.toLocaleDateString('bn-BD', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // short (default)
  return date.toLocaleDateString('bn-BD', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/**
 * Relative time (কতক্ষণ আগে)
 * @param {Date} date
 * @returns {string}
 */
function getRelativeTime(date) {
  const now      = new Date();
  const diffMs   = now - date;
  const diffSec  = Math.floor(diffMs / 1000);
  const diffMin  = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay  = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth= Math.floor(diffDay / 30);

  if (diffSec < 60)   return 'এইমাত্র';
  if (diffMin < 60)   return `${diffMin} মিনিট আগে`;
  if (diffHour < 24)  return `${diffHour} ঘণ্টা আগে`;
  if (diffDay < 7)    return `${diffDay} দিন আগে`;
  if (diffWeek < 4)   return `${diffWeek} সপ্তাহ আগে`;
  if (diffMonth < 12) return `${diffMonth} মাস আগে`;
  return `${Math.floor(diffMonth / 12)} বছর আগে`;
}

/* ══════════════════════════════════════════════════════════════
   IMAGE LAZY LOADING
══════════════════════════════════════════════════════════════ */

/**
 * Intersection Observer দিয়ে lazy load setup করে
 * data-src attribute থেকে src-এ load করে
 */
export function initLazyLoad() {
  const images = document.querySelectorAll('img[data-src]');
  if (!images.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.getAttribute('data-src');
        if (!src) return;

        img.src = src;
        img.removeAttribute('data-src');
        img.onload  = () => img.classList.add('loaded');
        img.onerror = () => {
          img.src = getPlaceholderImage();
          img.classList.add('loaded');
        };
        observer.unobserve(img);
      });
    },
    { rootMargin: '200px 0px', threshold: 0.01 }
  );

  images.forEach((img) => observer.observe(img));
}

/**
 * Placeholder image URL (SVG-based, no external dependency)
 * @param {number} w - width
 * @param {number} h - height
 * @returns {string}
 */
export function getPlaceholderImage(w = 400, h = 400) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <rect width='${w}' height='${h}' fill='%23EFF4FF'/>
    <text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'
      font-family='Inter,sans-serif' font-size='14' fill='%2394A3B8'>No Image</text>
  </svg>`;
  return `data:image/svg+xml,${svg}`;
}

/* ══════════════════════════════════════════════════════════════
   WHATSAPP & TELEGRAM ORDER LINKS
══════════════════════════════════════════════════════════════ */

/**
 * WhatsApp order link তৈরি করে
 * @param {string} whatsappNumber - "880XXXXXXXXXX" format (no + sign, no spaces)
 * @param {object} product - { name, productCode, price, quantity }
 * @returns {string} WhatsApp URL
 */
export function buildWhatsAppOrderLink(whatsappNumber, product) {
  const { name, productCode, price, quantity = 1 } = product;
  const message = [
    `🛒 *অর্ডার — R BD SHOP*`,
    ``,
    `📦 পণ্যের নাম: *${name}*`,
    `🔖 পণ্য কোড: ${productCode}`,
    `💵 মূল্য: ৳${Number(price).toLocaleString('bn-BD')}`,
    `🔢 পরিমাণ: ${quantity}টি`,
    `💰 মোট: ৳${(Number(price) * quantity).toLocaleString('bn-BD')}`,
    ``,
    `🌐 ওয়েবসাইট: R BD SHOP`,
  ].join('\n');

  const encodedMsg = encodeURIComponent(message);
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodedMsg}`;
}

/**
 * Telegram order link তৈরি করে (direct chat, no bot)
 * @param {string} telegramUsername - "@username" or "username"
 * @param {object} product - { name, productCode, price, quantity }
 * @returns {string} Telegram URL
 */
export function buildTelegramOrderLink(telegramUsername, product) {
  const { name, productCode, price, quantity = 1 } = product;
  const message = [
    `🛒 অর্ডার — R BD SHOP`,
    ``,
    `📦 পণ্যের নাম: ${name}`,
    `🔖 পণ্য কোড: ${productCode}`,
    `💵 মূল্য: ৳${Number(price).toLocaleString('bn-BD')}`,
    `🔢 পরিমাণ: ${quantity}টি`,
    `💰 মোট: ৳${(Number(price) * quantity).toLocaleString('bn-BD')}`,
    ``,
    `🌐 ওয়েবসাইট: R BD SHOP`,
  ].join('\n');

  const encodedMsg = encodeURIComponent(message);
  const username   = telegramUsername.replace('@', '');
  return `https://t.me/${username}?text=${encodedMsg}`;
}

/* ══════════════════════════════════════════════════════════════
   STOCK STATUS HELPER
══════════════════════════════════════════════════════════════ */

/**
 * Stock quantity থেকে status object বের করে
 * @param {number} stock
 * @returns {{ label: string, cssClass: string, inStock: boolean }}
 */
export function getStockStatus(stock) {
  if (stock <= 0) {
    return { label: 'স্টক শেষ', cssClass: 'out', inStock: false };
  }
  if (stock <= 10) {
    return {
      label: `মাত্র ${stock}টি বাকি!`,
      cssClass: 'low',
      inStock: true
    };
  }
  return {
    label: `স্টকে ${stock.toLocaleString('bn-BD')}টি আছে`,
    cssClass: 'in',
    inStock: true
  };
}

/* ══════════════════════════════════════════════════════════════
   DOM UTILITIES
══════════════════════════════════════════════════════════════ */

/**
 * Element show করে
 * @param {HTMLElement|string} el - element বা selector
 */
export function show(el) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.classList.remove('hidden');
}

/**
 * Element hide করে
 * @param {HTMLElement|string} el
 */
export function hide(el) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.classList.add('hidden');
}

/**
 * Element toggle করে
 * @param {HTMLElement|string} el
 */
export function toggle(el) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.classList.toggle('hidden');
}

/**
 * querySelector shorthand
 * @param {string} selector
 * @param {HTMLElement} context
 * @returns {HTMLElement|null}
 */
export function qs(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * querySelectorAll shorthand (returns Array)
 * @param {string} selector
 * @param {HTMLElement} context
 * @returns {Array<HTMLElement>}
 */
export function qsa(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Event listener shorthand
 * @param {HTMLElement|string} el
 * @param {string} event
 * @param {Function} handler
 * @param {object} options
 */
export function on(el, event, handler, options = {}) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.addEventListener(event, handler, options);
}

/* ══════════════════════════════════════════════════════════════
   URL & ROUTING UTILITIES
══════════════════════════════════════════════════════════════ */

/**
 * URL query parameter পড়ে
 * @param {string} key
 * @returns {string|null}
 */
export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Multiple query params একসাথে পড়ে
 * @param {string[]} keys
 * @returns {object}
 */
export function getQueryParams(keys) {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  keys.forEach((k) => { result[k] = params.get(k); });
  return result;
}

/**
 * Product page URL তৈরি করে
 * @param {string} slug
 * @returns {string}
 */
export function getProductUrl(slug) {
  // frontend root-এ product.html আছে, slug query param হিসেবে পাঠানো হবে
  return `product.html?slug=${encodeURIComponent(slug)}`;
}

/**
 * Category page URL তৈরি করে
 * @param {string} slug
 * @returns {string}
 */
export function getCategoryUrl(slug) {
  return `category.html?cat=${encodeURIComponent(slug)}`;
}

/**
 * Search page URL তৈরি করে
 * @param {string} query
 * @returns {string}
 */
export function getSearchUrl(query) {
  return `search.html?q=${encodeURIComponent(query)}`;
}

/* ══════════════════════════════════════════════════════════════
   STAR RATING RENDERER
══════════════════════════════════════════════════════════════ */

/**
 * Rating number থেকে star HTML তৈরি করে
 * @param {number} rating - 0 to 5
 * @param {boolean} large - বড় star দেখাবে কিনা
 * @returns {string} HTML
 */
export function renderStars(rating = 0, large = false) {
  const sizeClass = large ? 'stars--lg' : '';
  const fullStars = Math.floor(rating);
  const hasHalf   = rating % 1 >= 0.5;
  const emptyStars= 5 - fullStars - (hasHalf ? 1 : 0);

  const starFull = `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>`;

  const starHalf = `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77V2z" opacity="0.3"/>
    <path d="M12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2v15.77z"/>
  </svg>`;

  const starEmpty = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>`;

  let html = `<span class="stars ${sizeClass}">`;
  for (let i = 0; i < fullStars;  i++) html += starFull;
  if (hasHalf)                         html += starHalf;
  for (let i = 0; i < emptyStars; i++) html += starEmpty;
  html += '</span>';
  return html;
}

/* ══════════════════════════════════════════════════════════════
   DEBOUNCE & THROTTLE
══════════════════════════════════════════════════════════════ */

/**
 * Debounce — শেষ call-এর পরে delay দিয়ে execute করে
 * (search input-এ ব্যবহৃত)
 * @param {Function} fn
 * @param {number} delay - ms
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle — নির্দিষ্ট interval-এ একবারই execute করে
 * (scroll event-এ ব্যবহৃত)
 * @param {Function} fn
 * @param {number} interval - ms
 * @returns {Function}
 */
export function throttle(fn, interval = 100) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/* ══════════════════════════════════════════════════════════════
   CLIPBOARD
══════════════════════════════════════════════════════════════ */

/**
 * Text clipboard-এ copy করে
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers / non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-999px;top:-999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    return true;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════
   LOCAL STORAGE (safe wrapper)
══════════════════════════════════════════════════════════════ */

/**
 * localStorage-এ save করে (JSON stringify সহ)
 * @param {string} key
 * @param {*} value
 */
export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full বা disabled */ }
}

/**
 * localStorage থেকে পড়ে (JSON parse সহ)
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function lsGet(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * localStorage key মুছে দেয়
 * @param {string} key
 */
export function lsRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/* ══════════════════════════════════════════════════════════════
   PAGE LOADER
══════════════════════════════════════════════════════════════ */

/**
 * Page loader লুকায় (page load শেষ হলে call করো)
 */
export function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  loader.classList.add('loaded');
  setTimeout(() => loader.remove(), 500);
}

/**
 * Back to top button setup করে
 */
export function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  const handleScroll = throttle(() => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, 100);

  window.addEventListener('scroll', handleScroll, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ══════════════════════════════════════════════════════════════
   SEO / META TAG UPDATER
══════════════════════════════════════════════════════════════ */

/**
 * Page-এর meta tags dynamically update করে
 * @param {object} meta
 * @param {string} meta.title
 * @param {string} meta.description
 * @param {string} meta.image
 * @param {string} meta.url
 * @param {string} meta.price
 */
export function updateMetaTags({ title, description, image, url, price } = {}) {
  const siteTitle = 'R BD SHOP';

  if (title) {
    document.title = `${title} | ${siteTitle}`;
    setMeta('og:title',       `${title} | ${siteTitle}`);
    setMeta('twitter:title',  `${title} | ${siteTitle}`);
  }

  if (description) {
    setMeta('description',          description);
    setMeta('og:description',       description);
    setMeta('twitter:description',  description);
  }

  if (image) {
    setMeta('og:image',       image);
    setMeta('twitter:image',  image);
  }

  if (url) {
    setMeta('og:url', url);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = url;
  }

  if (price) {
    setMeta('product:price:amount',   price);
    setMeta('product:price:currency', 'BDT');
  }
}

/**
 * Meta tag value set করে (helper)
 * @param {string} name
 * @param {string} content
 */
function setMeta(name, content) {
  let el = document.querySelector(
    `meta[name="${name}"], meta[property="${name}"]`
  );
  if (!el) {
    el = document.createElement('meta');
    const isOg = name.startsWith('og:') || name.startsWith('product:');
    el.setAttribute(isOg ? 'property' : 'name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/* ══════════════════════════════════════════════════════════════
   SKELETON LOADER HELPER
══════════════════════════════════════════════════════════════ */

/**
 * Product card skeleton HTML তৈরি করে
 * @param {number} count - কতটা skeleton দেখাবে
 * @returns {string} HTML
 */
export function renderProductSkeletons(count = 8) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="product-card">
        <div class="product-card__image-wrap">
          <div class="skeleton" style="width:100%;height:100%;position:absolute;inset:0"></div>
        </div>
        <div class="product-card__body">
          <div class="skeleton" style="height:12px;width:60%;margin-bottom:8px"></div>
          <div class="skeleton" style="height:16px;width:90%;margin-bottom:6px"></div>
          <div class="skeleton" style="height:16px;width:70%;margin-bottom:12px"></div>
          <div class="skeleton" style="height:20px;width:50%;margin-bottom:12px"></div>
          <div class="skeleton" style="height:36px;width:100%"></div>
        </div>
      </div>`;
  }
  return html;
}

/* ══════════════════════════════════════════════════════════════
   PRODUCT CARD RENDERER
══════════════════════════════════════════════════════════════ */

/**
 * Single product card HTML তৈরি করে
 * @param {object} product - Firestore product document data
 * @returns {string} HTML
 */
export function renderProductCard(product) {
  const {
    name, slug, categoryName, brand,
    mainImage, price, oldPrice, discount,
    stockQuantity, status, productCode,
    averageRating, reviewCount
  } = product;

  const stockStatus = getStockStatus(stockQuantity || 0);
  const discountVal = discount || calcDiscount(oldPrice, price);
  const productUrl  = getProductUrl(slug);
  const imgSrc      = mainImage || getPlaceholderImage();
  const isOutOfStock= status === 'outofstock' || stockQuantity <= 0;

  const badgesHtml = [
    discountVal > 0 ? `<span class="badge badge--discount">-${discountVal}%</span>` : '',
    isOutOfStock    ? `<span class="badge badge--outofstock">স্টক শেষ</span>` : '',
  ].filter(Boolean).join('');

  const ratingHtml = reviewCount > 0
    ? `<div class="rating-row" style="margin-bottom:var(--space-2)">
         ${renderStars(averageRating || 0)}
         <span class="rating-count">(${reviewCount})</span>
       </div>`
    : '';

  const oldPriceHtml = oldPrice && oldPrice > price
    ? `<span class="product-card__old-price">${formatPrice(oldPrice)}</span>`
    : '';

  return `
    <article class="product-card animate-fade-up" data-product-id="${productCode}">
      <a href="${productUrl}" class="product-card__image-wrap" aria-label="${escapeHtml(name)}">
        <img
          class="product-card__image"
          data-src="${escapeHtml(imgSrc)}"
          src="${getPlaceholderImage(400, 300)}"
          alt="${escapeHtml(name)}"
          loading="lazy"
        />
        ${badgesHtml ? `<div class="product-card__badges">${badgesHtml}</div>` : ''}
      </a>

      <div class="product-card__body">
        ${categoryName ? `<p class="product-card__category">${escapeHtml(categoryName)}</p>` : ''}

        <h3 class="product-card__title">
          <a href="${productUrl}">${escapeHtml(name)}</a>
        </h3>

        ${ratingHtml}

        <div class="product-card__price-row">
          <span class="product-card__price">${formatPrice(price)}</span>
          ${oldPriceHtml}
        </div>

        <p class="product-card__stock product-card__stock--${stockStatus.cssClass}">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <circle cx="4" cy="4" r="4"/>
          </svg>
          ${escapeHtml(stockStatus.label)}
        </p>

        <div class="product-card__actions">
          <a href="${productUrl}"
             class="btn btn--secondary btn--sm"
             style="flex:1">
            বিস্তারিত
          </a>
          ${!isOutOfStock
            ? `<a href="${productUrl}#order"
                  class="btn btn--primary btn--sm"
                  style="flex:1">
                অর্ডার করুন
               </a>`
            : `<button class="btn btn--ghost btn--sm" disabled style="flex:1">
                স্টক শেষ
               </button>`
          }
        </div>
      </div>
    </article>`;
}
