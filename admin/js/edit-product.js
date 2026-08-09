/* ============================================================
   R BD SHOP — Edit Product (ImgBB Version)
   Path: admin/js/edit-product.js

   ✅ FIXED (৩টি বাগ):
   1. loadCategories()-এ where('status','==','active') + orderBy('name')
      কম্বিনেশন Firestore composite index চাইতো — index না থাকলে
      console-এ error আসতো এবং dropdown খালি থাকতো। এখন add-product.js-
      এর মতোই সব ক্যাটাগরি লোড করে client-side filter করা হয় (কোনো
      index লাগবে না), এবং status-field-বিহীন পুরনো ক্যাটাগরিও দেখাবে।
   2. Tag/Feature ইনপুটে Enter চাপার পর ফোকাস হারাতো — এখন input
      element ধ্বংস না করে fix করা হয়েছে।
   3. Discount ফিল্ডে "0" লিখলেও auto-calculate হয়ে যেত — এখন ফাঁকা
      vs "0" আলাদা করে চেক হয়।
   ============================================================ */

import { db, uploadToImgBB } from './firebase-config.js';
import {
  doc, getDoc, updateDoc, getDocs, collection,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, setBtnLoading,
  createAdminSlug, escapeAdminHtml, aqs
} from './admin-utils.js';

let productId = null, productData = null;
let mainImageFile = null, galleryFiles = [];
let features = [], tags = [], existingGallery = [];

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    document.getElementById('sidebar-root').innerHTML = buildAdminSidebarHTML(admin);
    document.getElementById('header-root').innerHTML = buildAdminHeaderHTML('পণ্য এডিট', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    productId = new URLSearchParams(window.location.search).get('id');
    if (!productId) {
      adminShowToast('পণ্য ID পাওয়া যায়নি', 'error');
      setTimeout(() => window.location.href = 'products.html', 1500);
      return;
    }

    await loadCategories();
    await loadProduct();
    setupImageUpload();
    setupSpecsRows();
    setupFormSubmit();
    hideAdminLoader();
  });
});

/* ✅ FIX: আগে where('status','==','active') + orderBy('name') ব্যবহার
   হতো, যেটায় Firestore composite index লাগে (না থাকলে silent fail)।
   এখন add-product.js-এর প্যাটার্ন অনুসরণ করে সব ক্যাটাগরি এনে
   client-side filter করা হচ্ছে — status-field-বিহীন পুরনো ক্যাটাগরিও
   এখন ঠিকঠাক দেখাবে, কোনো index দরকার নেই। */
async function loadCategories() {
  const select = aqs('#p-category');
  if (!select) return;
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
    snap.forEach((d) => {
      const cat = d.data();
      if (!cat.status || cat.status === 'active') {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        select.appendChild(opt);
      }
    });
  } catch (err) {
    console.error('[EditProduct] Category load error:', err);
    adminShowToast('ক্যাটাগরি লোড ব্যর্থ', 'error');
  }
}

async function loadProduct() {
  try {
    const snap = await getDoc(doc(db, 'products', productId));
    if (!snap.exists()) {
      adminShowToast('পণ্য পাওয়া যায়নি', 'error');
      setTimeout(() => window.location.href = 'products.html', 1500);
      return;
    }
    productData = snap.data();
    const p = productData;

    aqs('#p-name').value = p.name || '';
    aqs('#p-code').value = p.productCode || productId;
    aqs('#p-brand').value = p.brand || '';
    aqs('#p-short-desc').value = p.shortDescription || '';
    aqs('#p-full-desc').value = p.fullDescription || '';
    aqs('#p-price').value = p.price || 0;
    aqs('#p-old-price').value = p.oldPrice || '';
    aqs('#p-discount').value = p.discount || '';
    aqs('#p-stock').value = p.stockQuantity || 0;
    aqs('#p-warranty').value = p.warrantyInfo || '';
    aqs('#p-status').value = p.status || 'draft';
    aqs('#p-category').value = p.categoryName || '';
    aqs('#p-whatsapp').checked = p.whatsappOrderEnabled !== false;
    aqs('#p-telegram').checked = p.telegramOrderEnabled !== false;

    const nameEl = aqs('#edit-product-name');
    if (nameEl) nameEl.textContent = p.name || '—';

    features = [...(p.features || [])];
    renderTagsUI('features-input', 'feature-text-input', features);

    tags = [...(p.tags || [])];
    renderTagsUI('tags-input', 'tag-text-input', tags);

    const specsList = aqs('#specs-list');
    if (specsList && p.specifications) {
      specsList.innerHTML = '';
      Object.entries(p.specifications).forEach(([key, val]) => addSpecRow(key, val));
    }

    if (p.mainImage) {
      const preview = aqs('#main-image-preview');
      if (preview) preview.innerHTML = `<div class="image-preview-item main-image"><img src="${escapeAdminHtml(p.mainImage)}" alt="Main" /></div>`;
    }

    existingGallery = [...(p.galleryImages || [])];
    renderExistingGallery();

  } catch (err) {
    console.error('[EditProduct]', err);
    adminShowToast('পণ্য লোড ব্যর্থ', 'error');
  }
}

function renderExistingGallery() {
  const preview = aqs('#gallery-image-preview');
  if (!preview) return;
  preview.innerHTML = existingGallery.map((url, i) => `
    <div class="image-preview-item">
      <img src="${escapeAdminHtml(url)}" alt="Gallery ${i}" />
      <button type="button" class="image-preview-item__remove" data-existing-gal="${i}">✕</button>
    </div>`).join('');
  preview.querySelectorAll('[data-existing-gal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      existingGallery.splice(parseInt(btn.dataset.existingGal), 1);
      renderExistingGallery();
    });
  });
}

/* ─── TAGS / FEATURES ────────────────────────────────────────
   ✅ FIX: আগে প্রতিটা tag যোগ হলে container.innerHTML পুরো রিসেট
   হতো (input সহ), ফলে ফোকাস হারিয়ে যেত। এখন input element কখনো
   destroy হয় না — শুধু tag span-গুলো replace হয়, input অক্ষত থাকে
   এবং ফোকাস স্বাভাবিকভাবেই বজায় থাকে।
──────────────────────────────────────────────────────────── */
function renderTagsUI(containerId, inputId, array) {
  const container = aqs(`#${containerId}`);
  if (!container) return;

  function render() {
    const input = aqs(`#${inputId}`);

    const tagsHtml = array.map((t, i) => `
      <span class="tags-input__tag">${escapeAdminHtml(t)}
        <button type="button" class="tags-input__tag-remove" data-rm-idx="${i}">✕</button>
      </span>`).join('');

    container.querySelectorAll('.tags-input__tag').forEach((el) => el.remove());

    if (input) {
      input.insertAdjacentHTML('beforebegin', tagsHtml);
    } else {
      container.innerHTML = tagsHtml + `<input type="text" class="tags-input__input" id="${inputId}" placeholder="Enter চাপুন" />`;
      bindInput();
    }

    container.querySelectorAll('[data-rm-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        array.splice(parseInt(btn.dataset.rmIdx), 1);
        render();
      });
    });
  }

  function bindInput() {
    const input = container.querySelector(`#${inputId}`);
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value.trim();
        if (val && !array.includes(val)) {
          array.push(val);
          render();
          const freshInput = aqs(`#${inputId}`);
          if (freshInput) freshInput.focus();
        }
        input.value = '';
      }
    });
  }

  render();
  bindInput();
}

function setupImageUpload() {
  const mainArea = aqs('#main-image-upload');
  const mainInput = aqs('#main-image-file');
  if (mainArea && mainInput) {
    mainArea.addEventListener('click', () => mainInput.click());
    mainInput.addEventListener('change', () => {
      if (mainInput.files[0]) {
        mainImageFile = mainInput.files[0];
        const preview = aqs('#main-image-preview');
        if (preview) preview.innerHTML = `<div class="image-preview-item main-image"><img src="${URL.createObjectURL(mainImageFile)}" alt="New" /></div>`;
      }
    });
  }
  const galArea = aqs('#gallery-image-upload');
  const galInput = aqs('#gallery-image-file');
  if (galArea && galInput) {
    galArea.addEventListener('click', () => galInput.click());
    galInput.addEventListener('change', () => {
      for (const f of galInput.files) {
        if (galleryFiles.length + existingGallery.length >= 5) break;
        galleryFiles.push(f);
      }
      const preview = aqs('#gallery-image-preview');
      if (preview) {
        renderExistingGallery();
        galleryFiles.forEach((f) => {
          const div = document.createElement('div');
          div.className = 'image-preview-item';
          div.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="New" />`;
          preview.appendChild(div);
        });
      }
    });
  }
}

function setupSpecsRows() {
  aqs('#add-spec-row')?.addEventListener('click', () => addSpecRow('', ''));
}

function addSpecRow(key, val) {
  const list = aqs('#specs-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'key-value-row';
  row.innerHTML = `
    <input type="text" placeholder="নাম" value="${escapeAdminHtml(key)}" />
    <input type="text" placeholder="মান" value="${escapeAdminHtml(val)}" />
    <button type="button" class="key-value-row__remove" title="সরান"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
  list.appendChild(row);
  row.querySelector('.key-value-row__remove').addEventListener('click', () => row.remove());
}

function setupFormSubmit() {
  aqs('#product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateProduct();
  });
}

async function updateProduct() {
  const btn = aqs('#btn-update');
  const name = aqs('#p-name').value.trim();
  const price = parseInt(aqs('#p-price').value) || 0;
  if (!name) { adminShowToast('নাম দিন', 'error'); return; }
  if (!price) { adminShowToast('মূল্য দিন', 'error'); return; }

  setBtnLoading(btn, true);

  try {
    let mainImageURL = productData.mainImage || '';
    if (mainImageFile) {
      adminShowToast('প্রধান ছবি upload হচ্ছে...', 'info');
      mainImageURL = await uploadToImgBB(mainImageFile);
    }

    const newGalleryURLs = [...existingGallery];
    for (const f of galleryFiles) {
      adminShowToast('গ্যালারি ছবি upload হচ্ছে...', 'info');
      const url = await uploadToImgBB(f);
      newGalleryURLs.push(url);
    }

    const specs = {};
    document.querySelectorAll('#specs-list .key-value-row').forEach((row) => {
      const inputs = row.querySelectorAll('input');
      const k = inputs[0]?.value.trim();
      const v = inputs[1]?.value.trim();
      if (k && v) specs[k] = v;
    });

    const oldPrice = parseInt(aqs('#p-old-price').value) || 0;

    // ✅ FIX: "0" আর "ফাঁকা" আলাদা করে চেক — explicit 0 আর ইগনোর হবে না
    const discountRaw = aqs('#p-discount').value.trim();
    const discount = discountRaw !== ''
      ? (parseInt(discountRaw) || 0)
      : (oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0);

    const stock = parseInt(aqs('#p-stock').value) || 0;

    const updateData = {
      name,
      slug: createAdminSlug(name) || productData.slug,
      categoryName: aqs('#p-category').value,
      brand: aqs('#p-brand').value.trim(),
      mainImage: mainImageURL,
      galleryImages: newGalleryURLs,
      price, oldPrice, discount,
      stockQuantity: stock,
      shortDescription: aqs('#p-short-desc').value.trim(),
      fullDescription: aqs('#p-full-desc').value.trim(),
      features, specifications: specs,
      warrantyInfo: aqs('#p-warranty').value.trim(),
      tags,
      whatsappOrderEnabled: aqs('#p-whatsapp').checked,
      telegramOrderEnabled: aqs('#p-telegram').checked,
      status: aqs('#p-status').value,
      updatedAt: serverTimestamp(),
    };

    if (stock <= 0 && updateData.status === 'published') updateData.status = 'outofstock';

    await updateDoc(doc(db, 'products', productId), updateData);
    adminShowToast('আপডেট হয়েছে! ✅', 'success');
    setTimeout(() => window.location.href = 'products.html', 1000);

  } catch (err) {
    console.error('[EditProduct]', err);
    adminShowToast('আপডেট ব্যর্থ: ' + err.message, 'error');
    setBtnLoading(btn, false, '💾 আপডেট করুন');
  }
                     }
