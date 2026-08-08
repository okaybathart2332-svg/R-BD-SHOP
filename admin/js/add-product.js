/* ============================================================
   R BD SHOP — Add Product JavaScript
   Path: admin/js/add-product.js
   ============================================================ */

import { db, storage } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query,
  where, orderBy, serverTimestamp, doc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import { requireAdmin, adminLogout } from './admin-auth.js';
import {
  initAdminTheme, initAdminSidebar,
  buildAdminSidebarHTML, buildAdminHeaderHTML,
  hideAdminLoader, adminShowToast, setBtnLoading,
  createAdminSlug, generateProductCode,
  escapeAdminHtml, aqs
} from './admin-utils.js';

/* ── STATE ── */
let mainImageFile   = null;
let galleryFiles    = [];
let features        = [];
let tags            = [];

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  requireAdmin(async (admin) => {
    const sr = document.getElementById('sidebar-root');
    const hr = document.getElementById('header-root');
    if (sr) sr.innerHTML = buildAdminSidebarHTML(admin);
    if (hr) hr.innerHTML = buildAdminHeaderHTML('পণ্য যোগ করুন', admin);
    initAdminSidebar();
    document.addEventListener('click', (e) => { if (e.target.closest('#admin-logout-btn')) { e.preventDefault(); adminLogout(); } });

    // Generate product code
    aqs('#p-code').value = generateProductCode();

    // Load categories
    await loadCategories();

    // Setup all handlers
    setupImageUpload();
    setupTagsInput();
    setupFeaturesInput();
    setupSpecsRows();
    setupFormSubmit();

    hideAdminLoader();
  });
});

/* ── CATEGORIES ── */
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
  } catch (err) { console.warn('Categories load fail:', err); }
}

/* ── IMAGE UPLOAD ── */
function setupImageUpload() {
  // Main image
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

  // Gallery images
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
    for (const f of files) {
      if (galleryFiles.length >= 5) break;
      galleryFiles.push(f);
    }
    renderGalleryPreview();
  }

  function renderGalleryPreview() {
    if (!galPreview) return;
    galPreview.innerHTML = galleryFiles.map((f, i) => {
      const url = URL.createObjectURL(f);
      return `<div class="image-preview-item">
        <img src="${url}" alt="Gallery ${i}" />
        <button type="button" class="image-preview-item__remove" data-gal-idx="${i}">✕</button>
      </div>`;
    }).join('');
    galPreview.querySelectorAll('[data-gal-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        galleryFiles.splice(parseInt(btn.dataset.galIdx), 1);
        renderGalleryPreview();
      });
    });
  }
}

/* ── TAGS INPUT ── */
function setupTagsInput() {
  setupGenericTags('tag-text-input', 'tags-input', tags);
}

function setupFeaturesInput() {
  setupGenericTags('feature-text-input', 'features-input', features);
}

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
        renderTags(container, array, inputId);
      }
      input.value = '';
    }
  });

  function renderTags(cont, arr, iid) {
    const tagsHtml = arr.map((t, i) => `
      <span class="tags-input__tag">
        ${escapeAdminHtml(t)}
        <button type="button" class="tags-input__tag-remove" data-tag-idx="${i}" data-tag-group="${iid}">✕</button>
      </span>`).join('');
    const inputEl = cont.querySelector(`#${iid}`);
    cont.innerHTML = tagsHtml;
    cont.appendChild(inputEl || document.createElement('input'));
    // Re-get input
    const newInput = cont.querySelector(`#${iid}`);
    if (!newInput) {
      const ni = document.createElement('input');
      ni.type = 'text'; ni.className = 'tags-input__input';
      ni.id = iid; ni.placeholder = 'Enter চাপুন';
      cont.appendChild(ni);
      setupGenericTags(iid, containerId, arr);
    }
    cont.querySelectorAll('[data-tag-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        arr.splice(parseInt(btn.dataset.tagIdx), 1);
        renderTags(cont, arr, iid);
      });
    });
  }
}

/* ── SPECS ROWS ── */
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

  // Initial row remove
  document.querySelectorAll('.key-value-row__remove').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.key-value-row').remove());
  });
}

/* ── FORM SUBMIT ── */
function setupFormSubmit() {
  const form = aqs('#product-form');
  const publishBtn = aqs('#btn-publish');
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

  const name  = aqs('#p-name').value.trim();
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

    // Upload main image
    let mainImageURL = '';
    if (mainImageFile) {
      const path = `products/${productCode}/main_${Date.now()}`;
      const imgRef = ref(storage, path);
      await uploadBytes(imgRef, mainImageFile);
      mainImageURL = await getDownloadURL(imgRef);
    }

    // Upload gallery images
    const galleryURLs = [];
    for (let i = 0; i < galleryFiles.length; i++) {
      const path = `products/${productCode}/gallery_${i}_${Date.now()}`;
      const imgRef = ref(storage, path);
      await uploadBytes(imgRef, galleryFiles[i]);
      const url = await getDownloadURL(imgRef);
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
      name,
      slug,
      productCode,
      categoryName:        category,
      brand:               aqs('#p-brand').value.trim(),
      mainImage:           mainImageURL,
      galleryImages:       galleryURLs,
      price,
      oldPrice:            oldPrice,
      discount,
      stockQuantity:       stock,
      shortDescription:    aqs('#p-short-desc').value.trim(),
      fullDescription:     aqs('#p-full-desc').value.trim(),
      features,
      specifications:      specs,
      warrantyInfo:        aqs('#p-warranty').value.trim(),
      tags,
      whatsappOrderEnabled: aqs('#p-whatsapp').checked,
      telegramOrderEnabled: aqs('#p-telegram').checked,
      status:              aqs('#p-status').value,
      averageRating:       0,
      reviewCount:         0,
      totalSold:           0,
      createdAt:           serverTimestamp(),
      updatedAt:           serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'products'), productData);

    // Update category product count
    try {
      const catSnap = await getDocs(query(collection(db, 'categories'), where('name', '==', category)));
      catSnap.forEach(async (catDoc) => {
        await updateDoc(doc(db, 'categories', catDoc.id), { productCount: increment(1) });
      });
    } catch { /* ignore */ }

    adminShowToast('পণ্য সফলভাবে যোগ হয়েছে! ✅', 'success');

    setTimeout(() => {
      window.location.href = 'products.html';
    }, 1000);

  } catch (err) {
    console.error('[AddProduct] Error:', err);
    adminShowToast('পণ্য সেভ করতে সমস্যা হয়েছে: ' + err.message, 'error');
    setBtnLoading(btn, false, '🚀 পাবলিশ করুন');
  }
      }
