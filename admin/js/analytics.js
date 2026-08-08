/* ============================================================
   R BD SHOP — Analytics
   Path: admin/js/analytics.js
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, orderBy, limit,
  getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, escapeAdminHtml, formatAdminPrice, aqs
} from './admin-utils.js';

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    document.getElementById('sidebar-root').innerHTML = buildAdminSidebarHTML(admin);
    document.getElementById('header-root').innerHTML = buildAdminHeaderHTML('অ্যানালিটিক্স', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    await Promise.allSettled([loadOrdersChart(), loadStockChart(), loadTopProducts()]);
    hideAdminLoader();
  });
});

async function loadOrdersChart() {
  const body = aqs('#chart-orders-body');
  if (!body) return;
  try {
    const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    const colors   = ['var(--a-warning)', 'var(--a-info)', 'var(--a-primary)', '#7C3AED', 'var(--a-success)', 'var(--a-danger)'];
    const labels   = ['পেন্ডিং', 'কনফার্মড', 'প্রসেসিং', 'শিপড', 'ডেলিভারড', 'বাতিল'];
    const counts   = await Promise.all(statuses.map((s) => getCountFromServer(query(collection(db, 'orders'), where('status', '==', s)))));
    const values   = counts.map((c) => c.data().count);
    const max      = Math.max(...values, 1);

    body.innerHTML = `
      <div style="width:100%">
        <div class="simple-bar-chart" style="height:180px;padding-bottom:28px">
          ${values.map((v, i) => `
            <div class="simple-bar-chart__bar" style="height:${(v / max) * 100}%;background:${colors[i]};min-height:4px">
              <span class="simple-bar-chart__bar-value">${v}</span>
              <span class="simple-bar-chart__bar-label">${labels[i]}</span>
            </div>`).join('')}
        </div>
        <div class="chart-legend" style="margin-top:var(--a-space-6)">
          ${labels.map((l, i) => `<span class="chart-legend__item"><span class="chart-legend__dot" style="background:${colors[i]}"></span>${l}: ${values[i]}</span>`).join('')}
        </div>
      </div>`;
  } catch { body.innerHTML = '<p class="a-text-muted a-text-sm">চার্ট লোড ব্যর্থ</p>'; }
}

async function loadStockChart() {
  const body = aqs('#chart-stock-body');
  if (!body) return;
  try {
    const [inStock, outOfStock, totalSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'products'), where('status', '==', 'published'))),
      getCountFromServer(query(collection(db, 'products'), where('stockQuantity', '<=', 0))),
      getCountFromServer(query(collection(db, 'products'))),
    ]);
    const inVal  = inStock.data().count;
    const outVal = outOfStock.data().count;
    const total  = totalSnap.data().count;
    const inPct  = total > 0 ? Math.round((inVal / total) * 100) : 0;
    const outPct = total > 0 ? Math.round((outVal / total) * 100) : 0;

    const circumference = 2 * Math.PI * 70;
    const inDash  = (inPct / 100) * circumference;
    const outDash = (outPct / 100) * circumference;

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--a-space-8);width:100%;flex-wrap:wrap;justify-content:center">
        <div class="donut-chart-container">
          <svg viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="var(--a-border)" stroke-width="12"/>
            <circle cx="80" cy="80" r="70" fill="none" stroke="var(--a-success)" stroke-width="12"
                    stroke-dasharray="${inDash} ${circumference}" stroke-linecap="round"/>
            <circle cx="80" cy="80" r="70" fill="none" stroke="var(--a-danger)" stroke-width="12"
                    stroke-dasharray="${outDash} ${circumference}" stroke-dashoffset="${-inDash}" stroke-linecap="round"/>
          </svg>
          <div class="donut-chart-center">
            <span class="donut-chart-center__value">${total}</span>
            <span class="donut-chart-center__label">মোট পণ্য</span>
          </div>
        </div>
        <div>
          <div class="chart-legend" style="flex-direction:column;gap:var(--a-space-3)">
            <span class="chart-legend__item"><span class="chart-legend__dot" style="background:var(--a-success)"></span>স্টকে আছে: ${inVal} (${inPct}%)</span>
            <span class="chart-legend__item"><span class="chart-legend__dot" style="background:var(--a-danger)"></span>স্টক শেষ: ${outVal} (${outPct}%)</span>
            <span class="chart-legend__item"><span class="chart-legend__dot" style="background:var(--a-border)"></span>অন্যান্য: ${total - inVal - outVal}</span>
          </div>
        </div>
      </div>`;
  } catch { body.innerHTML = '<p class="a-text-muted a-text-sm">চার্ট লোড ব্যর্থ</p>'; }
}

async function loadTopProducts() {
  const container = aqs('#top-products');
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('totalSold', 'desc'), limit(5)));
    if (snap.empty) { container.innerHTML = '<p class="a-text-muted a-text-sm">ডাটা নেই</p>'; return; }

    let html = '<div style="display:flex;flex-direction:column;gap:var(--a-space-3)">';
    let rank = 1;
    snap.forEach((d) => {
      const p = d.data();
      html += `
        <div style="display:flex;align-items:center;gap:var(--a-space-4);padding:var(--a-space-3);background:var(--a-input-bg);border-radius:var(--a-radius-sm)">
          <span style="font-size:var(--a-font-lg);font-weight:800;color:var(--a-primary);width:28px;text-align:center">#${rank++}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--a-text-primary);font-size:var(--a-font-sm)">${escapeAdminHtml(p.name || '—')}</div>
            <div style="font-size:var(--a-font-xs);color:var(--a-text-muted)">${escapeAdminHtml(p.categoryName || '')} • ${formatAdminPrice(p.price)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:var(--a-text-primary)">${p.totalSold || 0} বিক্রি</div>
            <div style="font-size:var(--a-font-xs);color:var(--a-text-muted)">স্টক: ${p.stockQuantity || 0}</div>
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch { container.innerHTML = '<p class="a-text-muted a-text-sm">লোড ব্যর্থ</p>'; }
      }
