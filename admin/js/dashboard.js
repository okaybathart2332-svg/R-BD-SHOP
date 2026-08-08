/* ============================================================
   R BD SHOP — Admin Dashboard JavaScript
   Path: admin/js/dashboard.js
   Description: Loads dashboard stats from Firestore,
                renders stat cards, extended stats,
                recent activity feed.
   ============================================================ */

import { db }          from './firebase-config.js';
import {
  collection, query, where, orderBy,
  limit, getDocs, getCountFromServer,
  Timestamp
}                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast,
  formatAdminPrice, formatAdminDate,
  escapeAdminHtml, statusBadge
}                      from './admin-utils.js';

/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();

  requireAdmin(async (admin) => {
    injectLayout(admin);
    initAdminSidebar();
    setupLogout();

    await loadDashboardData();

    hideAdminLoader();
  });
});

/* ─────────────────────────────────────────────────────────────
   LAYOUT INJECTION
───────────────────────────────────────────────────────────── */
function injectLayout(admin) {
  const sidebarRoot = document.getElementById('sidebar-root');
  const headerRoot  = document.getElementById('header-root');

  if (sidebarRoot) sidebarRoot.innerHTML = buildAdminSidebarHTML(admin);
  if (headerRoot)  headerRoot.innerHTML  = buildAdminHeaderHTML('ড্যাশবোর্ড', admin);
}

function setupLogout() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#admin-logout-btn')) {
      e.preventDefault();
      adminLogout();
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   LOAD DASHBOARD DATA
───────────────────────────────────────────────────────────── */
async function loadDashboardData() {
  await Promise.allSettled([
    loadMainStats(),
    loadExtendedStats(),
    loadRecentActivity(),
  ]);
}

/* ─────────────────────────────────────────────────────────────
   MAIN STATS (Top 4 cards)
───────────────────────────────────────────────────────────── */
async function loadMainStats() {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;

  try {
    // Parallel queries
    const [productsSnap, ordersSnap, customersSnap, outOfStockSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'products'))),
      getCountFromServer(query(collection(db, 'orders'))),
      getCountFromServer(query(collection(db, 'customers'))),
      getCountFromServer(query(collection(db, 'products'), where('stockQuantity', '<=', 0))),
    ]);

    const totalProducts  = productsSnap.data().count;
    const totalOrders    = ordersSnap.data().count;
    const totalCustomers = customersSnap.data().count;
    const outOfStock     = outOfStockSnap.data().count;

    grid.innerHTML = `
      ${statCard('মোট পণ্য', totalProducts, 'primary', 'products')}
      ${statCard('মোট অর্ডার', totalOrders, 'info', 'orders')}
      ${statCard('মোট গ্রাহক', totalCustomers, 'success', 'customers')}
      ${statCard('স্টক শেষ', outOfStock, 'danger', 'outofstock')}
    `;

  } catch (err) {
    console.error('[Dashboard] Stats error:', err);
    grid.innerHTML = `
      <div class="admin-stat-card" style="grid-column:1/-1">
        <p class="a-text-muted a-text-sm" style="padding:var(--a-space-6);text-align:center;width:100%">
          পরিসংখ্যান লোড করতে সমস্যা হয়েছে।
        </p>
      </div>`;
  }
}

function statCard(label, value, color, type) {
  const icons = {
    products:  '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
    orders:    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    customers: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    outofstock:'<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  };

  return `
    <div class="admin-stat-card">
      <div class="admin-stat-card__icon admin-stat-card__icon--${color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${icons[type] || icons.products}
        </svg>
      </div>
      <div class="admin-stat-card__info">
        <span class="admin-stat-card__value">${value}</span>
        <span class="admin-stat-card__label">${escapeAdminHtml(label)}</span>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   EXTENDED STATS
───────────────────────────────────────────────────────────── */
async function loadExtendedStats() {
  const container = document.getElementById('extended-stats');
  if (!container) return;

  try {
    const [
      activeSnap, pendingOrdersSnap, completedOrdersSnap,
      cancelledOrdersSnap, todayProductsSnap
    ] = await Promise.all([
      getCountFromServer(query(collection(db, 'products'), where('status', '==', 'published'))),
      getCountFromServer(query(collection(db, 'orders'), where('status', '==', 'pending'))),
      getCountFromServer(query(collection(db, 'orders'), where('status', '==', 'delivered'))),
      getCountFromServer(query(collection(db, 'orders'), where('status', '==', 'cancelled'))),
      getTodayCount('products'),
    ]);

    const activeProducts   = activeSnap.data().count;
    const pendingOrders    = pendingOrdersSnap.data().count;
    const completedOrders  = completedOrdersSnap.data().count;
    const cancelledOrders  = cancelledOrdersSnap.data().count;
    const todayProducts    = todayProductsSnap;

    // Calculate total sales (simplified — sum of delivered order totals)
    let totalSales = 0;
    try {
      const salesSnap = await getDocs(
        query(collection(db, 'orders'), where('status', '==', 'delivered'), limit(500))
      );
      salesSnap.forEach((doc) => {
        totalSales += doc.data().totalPrice || 0;
      });
    } catch { /* ignore */ }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--a-space-4)">
        ${miniStat('সক্রিয় পণ্য', activeProducts, 'var(--a-success)')}
        ${miniStat('পেন্ডিং অর্ডার', pendingOrders, 'var(--a-warning)')}
        ${miniStat('সম্পন্ন অর্ডার', completedOrders, 'var(--a-success)')}
        ${miniStat('বাতিল অর্ডার', cancelledOrders, 'var(--a-danger)')}
        ${miniStat('আজ যোগ হয়েছে', todayProducts, 'var(--a-primary)')}
        ${miniStat('মোট বিক্রয়', formatAdminPrice(totalSales), 'var(--a-info)')}
      </div>`;

  } catch (err) {
    console.warn('[Dashboard] Extended stats error:', err);
    container.innerHTML = '<p class="a-text-muted a-text-sm a-text-center">ডাটা লোড ব্যর্থ</p>';
  }
}

function miniStat(label, value, color) {
  return `
    <div style="display:flex;align-items:center;gap:var(--a-space-3);padding:var(--a-space-3);
                background:var(--a-input-bg);border-radius:var(--a-radius-sm)">
      <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--a-font-xs);color:var(--a-text-muted)">${escapeAdminHtml(label)}</div>
        <div style="font-size:var(--a-font-md);font-weight:700;color:var(--a-text-primary)">${value}</div>
      </div>
    </div>`;
}

async function getTodayCount(collectionName) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const snap = await getCountFromServer(
      query(collection(db, collectionName), where('createdAt', '>=', todayTimestamp))
    );
    return snap.data().count;
  } catch {
    return 0;
  }
}

/* ─────────────────────────────────────────────────────────────
   RECENT ACTIVITY
───────────────────────────────────────────────────────────── */
async function loadRecentActivity() {
  const container = document.getElementById('recent-activity');
  if (!container) return;

  try {
    // Get recent orders
    const ordersSnap = await getDocs(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5))
    );

    // Get recent products
    const productsSnap = await getDocs(
      query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(3))
    );

    const activities = [];

    ordersSnap.forEach((doc) => {
      const d = doc.data();
      activities.push({
        type: 'order',
        text: `নতুন অর্ডার <strong>${escapeAdminHtml(d.orderNumber || d.id)}</strong> — ${escapeAdminHtml(d.customerName || 'গ্রাহক')}`,
        time: d.createdAt,
        status: d.status,
      });
    });

    productsSnap.forEach((doc) => {
      const d = doc.data();
      activities.push({
        type: 'product',
        text: `পণ্য যোগ হয়েছে: <strong>${escapeAdminHtml(d.name || '—')}</strong>`,
        time: d.createdAt,
        status: d.status,
      });
    });

    // Sort by time descending
    activities.sort((a, b) => {
      const tA = a.time?.seconds || 0;
      const tB = b.time?.seconds || 0;
      return tB - tA;
    });

    if (activities.length === 0) {
      container.innerHTML = '<p class="a-text-muted a-text-sm a-text-center" style="padding:var(--a-space-6)">কোনো কার্যকলাপ নেই</p>';
      return;
    }

    container.innerHTML = `
      <div class="activity-feed">
        ${activities.slice(0, 8).map((a) => `
          <div class="activity-item">
            <div class="activity-item__dot activity-item__dot--${a.type}"></div>
            <div class="activity-item__content">
              <p class="activity-item__text">${a.text}
                ${a.status ? ` ${statusBadge(a.status, a.type === 'order' ? 'order' : 'product')}` : ''}
              </p>
              <span class="activity-item__time">${formatAdminDate(a.time, 'datetime')}</span>
            </div>
          </div>
        `).join('')}
      </div>`;

  } catch (err) {
    console.warn('[Dashboard] Activity error:', err);
    container.innerHTML = '<p class="a-text-muted a-text-sm a-text-center">কার্যকলাপ লোড ব্যর্থ</p>';
  }
}
