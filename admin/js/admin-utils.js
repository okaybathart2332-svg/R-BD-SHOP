/* ============================================================
   R BD SHOP — Admin Shared Utility Functions
   Path: admin/js/admin-utils.js
   Description: Reusable helpers used across admin panel —
                toast, confirm dialog, formatting, DOM,
                sidebar management, theme toggle.
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   ADMIN TOAST NOTIFICATIONS
══════════════════════════════════════════════════════════════ */

/**
 * Admin toast দেখায়
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration - ms
 */
export function adminShowToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `a-toast a-toast--${type}`;
  toast.innerHTML = `
    <span style="color:${type === 'success' ? 'var(--a-success)' : type === 'error' ? 'var(--a-danger)' : type === 'warning' ? 'var(--a-warning)' : 'var(--a-primary)'}">${icons[type] || icons.info}</span>
    <span class="a-toast__msg">${escapeAdminHtml(message)}</span>
  `;

  container.appendChild(toast);

  const timer = setTimeout(() => removeAdminToast(toast), duration);

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeAdminToast(toast);
  });
}

function removeAdminToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

/* ══════════════════════════════════════════════════════════════
   CONFIRM DIALOG (Promise-based)
══════════════════════════════════════════════════════════════ */

/**
 * Confirm dialog দেখায় — Promise return করে
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.confirmText
 * @param {string} options.cancelText
 * @param {'danger'|'warning'} options.type
 * @returns {Promise<boolean>}
 */
export function adminConfirm({
  title       = 'নিশ্চিত করুন',
  message     = 'এই কাজটি করতে চান?',
  confirmText = 'হ্যাঁ, নিশ্চিত',
  cancelText  = 'বাতিল',
  type        = 'danger'
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'a-modal-overlay';
    overlay.innerHTML = `
      <div class="a-modal a-modal--sm">
        <div class="confirm-dialog">
          <div class="confirm-dialog__icon confirm-dialog__icon--${type}">
            ${type === 'danger'
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            }
          </div>
          <h3 class="confirm-dialog__title">${escapeAdminHtml(title)}</h3>
          <p class="confirm-dialog__desc">${escapeAdminHtml(message)}</p>
          <div class="confirm-dialog__actions">
            <button class="a-btn a-btn--ghost" id="confirm-cancel">${escapeAdminHtml(cancelText)}</button>
            <button class="a-btn a-btn--${type}" id="confirm-ok">${escapeAdminHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const cleanup = () => {
      document.body.style.overflow = '';
      overlay.remove();
    };

    overlay.querySelector('#confirm-ok').addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    overlay.querySelector('#confirm-cancel').addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
        document.removeEventListener('keydown', escHandler);
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   STRING & FORMAT UTILITIES
══════════════════════════════════════════════════════════════ */

/**
 * HTML escape
 * @param {string} str
 * @returns {string}
 */
export function escapeAdminHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Price format (Admin)
 * @param {number} amount
 * @returns {string}
 */
export function formatAdminPrice(amount) {
  if (isNaN(amount) || amount === null) return '৳০';
  return `৳${Number(amount).toLocaleString('bn-BD')}`;
}

/**
 * Date format (Admin)
 * @param {*} timestamp
 * @param {string} format - 'short' | 'long' | 'datetime'
 * @returns {string}
 */
export function formatAdminDate(timestamp, format = 'short') {
  if (!timestamp) return '—';

  let date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return '—';

  if (format === 'datetime') {
    return date.toLocaleDateString('bn-BD', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  if (format === 'long') {
    return date.toLocaleDateString('bn-BD', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  return date.toLocaleDateString('bn-BD', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/**
 * Slug তৈরি করে
 * @param {string} text
 * @returns {string}
 */
export function createAdminSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Product code generate করে
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
 * Order number generate করে
 * @returns {string}
 */
export function generateOrderNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `ORD-${year}-${rand}`;
}

/* ══════════════════════════════════════════════════════════════
   DOM UTILITIES
══════════════════════════════════════════════════════════════ */

/**
 * querySelector shorthand
 */
export function aqs(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * querySelectorAll (returns Array)
 */
export function aqsa(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Element show
 */
export function aShow(el) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.classList.remove('a-hidden');
}

/**
 * Element hide
 */
export function aHide(el) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.classList.add('a-hidden');
}

/**
 * Set button loading state
 * @param {HTMLElement} btn
 * @param {boolean} loading
 * @param {string} originalText
 */
export function setBtnLoading(btn, loading, originalText = '') {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    if (originalText) btn.textContent = originalText;
    else if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
  }
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR MANAGEMENT
══════════════════════════════════════════════════════════════ */

/**
 * Admin sidebar initialize করে — toggle, overlay, active link
 */
export function initAdminSidebar() {
  const sidebar    = document.querySelector('.admin-sidebar');
  const hamburger  = document.querySelector('.admin-header__hamburger');
  const overlay    = document.querySelector('.sidebar-overlay');

  if (!sidebar) return;

  // Toggle
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    });
  }

  // Overlay click to close
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // Active link highlight
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const links = sidebar.querySelectorAll('.sidebar__link');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (href) {
      const linkPage = href.split('/').pop().split('?')[0];
      if (linkPage === currentPage) {
        link.classList.add('active');
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   ADMIN THEME TOGGLE
══════════════════════════════════════════════════════════════ */

/**
 * Admin theme system initialize করে
 */
export function initAdminTheme() {
  const THEME_KEY = 'rbd-theme';

  // Apply saved theme
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* */ }

  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (!saved) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Toggle buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-admin-theme-toggle]');
    if (!btn) return;

    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';

    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    try { localStorage.setItem(THEME_KEY, newTheme); } catch { /* */ }
  });
}

/* ══════════════════════════════════════════════════════════════
   ADMIN PAGE LOADER
══════════════════════════════════════════════════════════════ */

/**
 * Admin page loader hide করে
 */
export function hideAdminLoader() {
  const loader = document.getElementById('admin-page-loader');
  if (!loader) return;
  loader.classList.add('loaded');
  setTimeout(() => loader.remove(), 500);
}

/* ══════════════════════════════════════════════════════════════
   DEBOUNCE (Admin)
══════════════════════════════════════════════════════════════ */

/**
 * Debounce function
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function adminDebounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ══════════════════════════════════════════════════════════════
   TABLE HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Admin data table-এ empty state দেখায়
 * @param {string} message
 * @param {number} colspan
 * @returns {string} HTML
 */
export function tableEmptyRow(message = 'কোনো ডাটা পাওয়া যায়নি', colspan = 6) {
  return `
    <tr>
      <td colspan="${colspan}">
        <div class="a-empty" style="padding:var(--a-space-8) var(--a-space-4)">
          <div class="a-empty__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          </div>
          <p class="a-text-muted a-text-sm">${escapeAdminHtml(message)}</p>
        </div>
      </td>
    </tr>`;
}

/**
 * Admin table loading row
 * @param {number} colspan
 * @returns {string} HTML
 */
export function tableLoadingRow(colspan = 6) {
  return `
    <tr>
      <td colspan="${colspan}">
        <div class="a-flex-center" style="padding:var(--a-space-10)">
          <div class="a-spinner a-spinner--lg"></div>
        </div>
      </td>
    </tr>`;
}

/* ══════════════════════════════════════════════════════════════
   STATUS BADGE HELPER
══════════════════════════════════════════════════════════════ */

/**
 * Status অনুযায়ী badge HTML তৈরি করে
 * @param {string} status
 * @param {'product'|'order'|'review'} context
 * @returns {string} HTML
 */
export function statusBadge(status, context = 'product') {
  const map = {
    // Product statuses
    published:  { label: 'পাবলিশড',   cls: 'a-badge--success' },
    draft:      { label: 'ড্রাফট',     cls: 'a-badge--warning' },
    hidden:     { label: 'লুকানো',     cls: 'a-badge--neutral' },
    outofstock: { label: 'স্টক শেষ',   cls: 'a-badge--danger'  },

    // Order statuses
    pending:    { label: 'পেন্ডিং',    cls: 'a-badge--warning' },
    confirmed:  { label: 'কনফার্মড',   cls: 'a-badge--info'    },
    processing: { label: 'প্রসেসিং',   cls: 'a-badge--primary' },
    shipped:    { label: 'শিপড',       cls: 'a-badge--info'    },
    delivered:  { label: 'ডেলিভারড',   cls: 'a-badge--success' },
    cancelled:  { label: 'বাতিল',      cls: 'a-badge--danger'  },

    // Review statuses
    approved:   { label: 'অনুমোদিত',   cls: 'a-badge--success' },
    rejected:   { label: 'প্রত্যাখ্যাত', cls: 'a-badge--danger'  },

    // Customer statuses
    active:     { label: 'সক্রিয়',     cls: 'a-badge--success' },
    inactive:   { label: 'নিষ্ক্রিয়',  cls: 'a-badge--neutral' },
  };

  const info = map[status] || { label: status, cls: 'a-badge--neutral' };
  return `<span class="a-badge ${info.cls}">${info.label}</span>`;
}

/* ══════════════════════════════════════════════════════════════
   FILE SIZE FORMATTER
══════════════════════════════════════════════════════════════ */

/**
 * Bytes থেকে readable size (KB/MB)
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/* ══════════════════════════════════════════════════════════════
   ADMIN SIDEBAR HTML BUILDER
══════════════════════════════════════════════════════════════ */

/**
 * Admin sidebar HTML তৈরি করে
 * @param {object} admin - current admin data
 * @returns {string} HTML
 */
export function buildAdminSidebarHTML(admin = {}) {
  return `
  <aside class="admin-sidebar" id="admin-sidebar">
    <!-- Logo -->
    <div class="sidebar__header">
      <a href="dashboard.html" class="sidebar__logo">
        <div class="sidebar__logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
        </div>
        <div class="sidebar__logo-text">
          <span class="sidebar__logo-name"><span>R BD</span> SHOP</span>
          <span class="sidebar__logo-tag">Admin Panel</span>
        </div>
      </a>
    </div>

    <!-- Navigation -->
    <nav class="sidebar__nav">
      <span class="sidebar__section-label">প্রধান</span>

      <a href="dashboard.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/>
          <rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
        </svg>
        ড্যাশবোর্ড
      </a>

      <span class="sidebar__section-label">পণ্য</span>

      <a href="products.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        পণ্য তালিকা
      </a>

      <a href="add-product.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        পণ্য যোগ করুন
      </a>

      <a href="categories.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        ক্যাটাগরি
      </a>

      <a href="inventory.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8
                   a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        ইনভেন্টরি
      </a>

      <span class="sidebar__section-label">অর্ডার ও গ্রাহক</span>

      <a href="orders.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        অর্ডার
      </a>

      <a href="customers.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        গ্রাহক
      </a>

      <a href="reviews.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77
                           5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        রিভিউ
      </a>

      <span class="sidebar__section-label">রিপোর্ট</span>

      <a href="analytics.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        অ্যানালিটিক্স
      </a>

      <span class="sidebar__section-label">সেটিংস</span>

      <a href="settings.html" class="sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0
                   01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1
                   1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4
                   a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0
                   010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3
                   a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0
                   00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06
                   a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2
                   2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33
                   l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0
                   00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0
                   01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        সেটিংস
      </a>
    </nav>

    <!-- Logout -->
    <div class="sidebar__footer">
      <button class="sidebar__logout" id="admin-logout-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        লগআউট
      </button>
    </div>
  </aside>

  <!-- Sidebar Overlay (mobile) -->
  <div class="sidebar-overlay" id="sidebar-overlay"></div>`;
}

/**
 * Admin header HTML তৈরি করে
 * @param {string} pageTitle
 * @param {object} admin
 * @returns {string} HTML
 */
export function buildAdminHeaderHTML(pageTitle = 'ড্যাশবোর্ড', admin = {}) {
  const initial = (admin.name || admin.email || 'A').charAt(0).toUpperCase();
  const name    = admin.name || admin.email?.split('@')[0] || 'Admin';

  return `
  <header class="admin-header">
    <div class="admin-header__left">
      <button class="admin-header__hamburger" aria-label="মেনু">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <h1 class="admin-header__page-title">${escapeAdminHtml(pageTitle)}</h1>
    </div>

    <div class="admin-header__right">
      <!-- Theme Toggle -->
      <button class="admin-header__theme-btn" data-admin-theme-toggle title="থিম পরিবর্তন">
        <span class="icon-sun">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42
                     M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </span>
        <span class="icon-moon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </span>
      </button>

      <!-- User Badge -->
      <div class="admin-header__user">
        <div class="admin-header__avatar">${initial}</div>
        <span class="admin-header__user-name">${escapeAdminHtml(name)}</span>
      </div>
    </div>
  </header>`;
}
