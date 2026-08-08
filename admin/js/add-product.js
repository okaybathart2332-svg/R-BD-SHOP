/* ============================================================
   R BD SHOP — Add Product (ImgBB Version)
   Path: admin/js/add-product.js
   ============================================================ */

import { db, uploadToImgBB } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query,
  where, orderBy, serverTimestamp, doc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, setBtnLoading,
  createAdminSlug, generateProductCode,
  escapeAdminHtml, aqs
} from './admin-utils.js';

let mainImageFile = null;
let galleryFiles  = [];
let features      = [];
let tags          = [];

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    document.getElementById('sidebar-root').innerHTML = buildAdminSidebarHTML(admin);
    document.getElementById('header-root').innerHTML = buildAdminHeaderHTML('পণ্য যোগ করুন', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    aqs('#p-code').value = generateProductCode();
    await loadCategories();
    setupImageUpload();
    setupTagsInput();
    setupFeaturesInput();
    setupSpecsRows();
    setupFormSubmit();
    hideAdminLoader();
  });
});

async function loadCategories() {
  const select = aqs('#p-category');
  if (!select) return;
  try {
    const snap = await getDocs(query(collection(db, 'categories'), where('status', '==', 'active'), orderBy('name')));
    snap.forEach((d) => {
      const cat = d.data();
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  } catch { /* ignore */ }
}

function setupImageUpload() {
  const mainArea = aqs('#main-image-upload');
  const mainInput = aqs('#main-image-file');
  const mainPreview = aqs('#main-image-preview');

  if (mainArea && mainInput) {
    mainArea.addEventListener('click', () => mainInput.click());
    mainArea.addEventListener('dragover', (e) => { e.preventDefault(); mainArea.classList.add('dragging'); });
    mainArea.addEventListener('dragleave', () => mainArea.classList.remove('dragging'));
    mainArea.addEventListener('drop', (e) => {
      e.preventDefault(); mainArea.classList.remove('dragging');
      if (e.dataTransfer.files[0]) { mainImageFile = e.dataTransfer.files[0]; showMainPreview(); }
    });
    mainInput.addEventListener('change', () => {
      if (mainInput.files[0]) { mainImageFile = mainInput.files[0]; showMainPreview(); }
    });
  }

  function showMainPreview() {
    if (!mainPreview || !mainImageFile) return;
    const url = URL.createObjectURL(mainImageFile);
    mainPreview.innerHTML = `
      <div class="image-preview-item main-image">
        <img src="${url}" alt="Main" />
        <button type="button" class="image-preview-item__remove" id="remove-main-img">✕</button>
      </div>`;
    aqs('#remove-main-img')?.addEventListener('click', () => { mainImageFile = null; mainPreview.innerHTML = ''; });
  }

  const galArea = aqs('#gallery-image-upload');
  const galInput = aqs('#gallery-image-file');
  const galPreview = aqs('#gallery-image-preview');

  if (galArea && galInput) {
    galArea.addEventListener('click', () => galInput.click());
    galArea.addEventListener('dragover', (e) => { e.preventDefault(); galArea.classList.add('dragging'); });
    galArea.addEventListener('dragleave', () => galArea.classList.remove('dragging'));
    galArea.addEventListener('drop', (e) => {
      e.preventDefault(); galArea.classList.remove('dragging');
      addGalleryFiles(e.dataTransfer.files);
    });
    galInput.addEventListener('change', () => addGalleryFiles(galInput.files));
  }

  function addGalleryFiles(files) {
    for (const f of files) { if (galleryFiles.length >= 5) break; galleryFiles.push(f); }
    renderGalleryPreview();
  }

  function renderGalleryPreview() {
    if (!galPreview) return;
    galPreview.innerHTML = galleryFiles.map((f, i) => `
      <div class="image-preview-item">
        <img src="${URL.createObjectURL(f)}" alt="Gallery ${i}" />
        <button type="button" class="image-preview-item__remove" data-gal-idx="${i}">✕</button>
      </div>`).join('');
    galPreview.querySelectorAll('[data-gal-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        galleryFiles.splice(parseInt(btn.dataset.galIdx), 1);
        renderGalleryPreview();
      });
    });
  }
}

function setupTagsInput()     { setupGenericTags('tag-text-input', 'tags-input', tags); }
function setupFeaturesInput() { setupGenericTags('feature-text-input', 'features-input', features); }

function setupGenericTags(inputId, containerId, array) {
  const input = aqs(`#${inputId}`);
  const container = aqs(`#${containerId}`);
  if (!input || !container) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !array.includes(val)) {
        array.push(val);
        renderTags();
      }
      input.value = '';
    }
  });

  function renderTags() {
    const tagsHtml = array.map((t, i) => `
      <span class="tags-input__tag">${escapeAdminHtml(t)}
        <button type="button" class="tags-input__tag-remove" data-tag-idx="${i}">✕</button>
      </span>`).join('');
    container.innerHTML = tagsHtml + `<input type="text" class="tags-input__input" id="${inputId}" placeholder="Enter চাপুন" />`;
    container.querySelectorAll('[data-tag-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        array.splice(parseInt(btn.dataset.tagIdx), 1);
        renderTags();
      });
    });
    setupGenericTags(inputId, containerId, array);
  }
}

function setupSpecsRows() {
  aqs('#add-spec-row')?.addEventListener('click', () => {
    const list = aqs('#specs-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'key-value-row';
    row.innerHTML = `
      <input type="text" placeholder="নাম" />
      <input type="text" placeholder="মান" />
      <button type="button" class="key-value-row__remove" title="সরান"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    list.appendChild(row);
    row.querySelector('.key-value-row__remove').addEventListener('click', () => row.remove());
  });
  document.querySelectorAll('.key-value-row__remove').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.key-value-row').remove());
  });
}

function setupFormSubmit() {
  const form = aqs('#product-form');
  const draftBtn = aqs('#btn-draft');
  if (draftBtn) {
    draftBtn.addEventListener('click', () => {
      aqs('#p-status').value = 'draft';
      form.requestSubmit();
    });
  }
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProduct();
  });
}

async function saveProduct() {
  const btn = aqs('#btn-publish');
  const name = aqs('#p-name').value.trim();
  const price = parseInt(aqs('#p-price').value) || 0;
  const stock = parseInt(aqs('#p-stock').value) || 0;
  const category = aqs('#p-category').value;

  if (!name) { adminShowToast('পণ্যের নাম দিন', 'error'); return; }
  if (!price) { adminShowToast('মূল্য দিন', 'error'); return; }
  if (!category) { adminShowToast('ক্যাটাগরি নির্বাচন করুন', 'error'); return; }

  setBtnLoading(btn, true);

  try {
    const productCode = aqs('#p-code').value || generateProductCode();
    const slug = createAdminSlug(name) || `product-${Date.now()}`;

    // Upload main image to ImgBB
    let mainImageURL = '';
    if (mainImageFile) {
      adminShowToast('প্রধান ছবি upload হচ্ছে...', 'info');
      mainImageURL = await uploadToImgBB(mainImageFile);
    }

    // Upload gallery images to ImgBB
    const galleryURLs = [];
    for (let i = 0; i < galleryFiles.length; i++) {
      adminShowToast(`গ্যালারি ছবি ${i + 1} upload হচ্ছে...`, 'info');
      const url = await uploadToImgBB(galleryFiles[i]);
      galleryURLs.push(url);
    }

    // Specifications
    const specs = {};
    document.querySelectorAll('#specs-list .key-value-row').forEach((row) => {
      const inputs = row.querySelectorAll('input');
      const key = inputs[0]?.value.trim();
      const val = inputs[1]?.value.trim();
      if (key && val) specs[key] = val;
    });

    const oldPrice = parseInt(aqs('#p-old-price').value) || 0;
    const discount = parseInt(aqs('#p-discount').value) || (oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0);

    const productData = {
      name, slug, productCode,
      categoryName: category,
      brand: aqs('#p-brand').value.trim(),
      mainImage: mainImageURL,
      galleryImages: galleryURLs,
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
      averageRating: 0, reviewCount: 0, totalSold: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'products'), productData);

    try {
      const catSnap = await getDocs(query(collection(db, 'categories'), where('name', '==', category)));
      catSnap.forEach(async (catDoc) => {
        await updateDoc(doc(db, 'categories', catDoc.id), { productCount: increment(1) });
      });
    } catch { /* ignore */ }

    adminShowToast('পণ্য সফলভাবে যোগ হয়েছে! ✅', 'success');
    setTimeout(() => window.location.href = 'products.html', 1000);

  } catch (err) {
    console.error('[AddProduct]', err);
    adminShowToast('সেভ ব্যর্থ: ' + err.message, 'error');
    setBtnLoading(btn, false, '🚀 পাবলিশ করুন');
  }
   }
