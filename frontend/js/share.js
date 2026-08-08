/* ============================================================
   R BD SHOP — Social Sharing Module
   Path: frontend/js/share.js
   Description: Share product to Facebook, Messenger, Telegram,
                and Copy Link functionality.
   ============================================================ */

import { copyToClipboard, showToast, escapeHtml } from './utils.js';

/**
 * Share buttons render করে এবং click events সেটআপ করে
 * @param {object} options
 * @param {string} options.title - Product/page title
 * @param {string} options.url   - Full URL to share
 * @param {string} options.image - Image URL (OG preview)
 * @param {string} options.price - Display price (e.g. "৳1,500")
 * @param {HTMLElement} options.container - যেখানে buttons বসবে
 */
export function initShareButtons({ title, url, image, price, container }) {
  if (!container) return;

  const pageUrl      = encodeURIComponent(url || window.location.href);
  const pageTitle    = encodeURIComponent(title || 'R BD SHOP');
  const shareText    = encodeURIComponent(`${title || ''} — ${price || ''}\n\nR BD SHOP-এ দেখুন:`);

  // Facebook share URL
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`;

  // Messenger share URL (mobile → app, desktop → web)
  const messengerUrl = `https://www.facebook.com/dialog/send?link=${pageUrl}&app_id=&redirect_uri=${pageUrl}`;
  // Fallback for mobile Messenger deep link
  const messengerMobileUrl = `fb-messenger://share?link=${pageUrl}`;

  // Telegram share URL (no bot needed)
  const telegramUrl = `https://t.me/share/url?url=${pageUrl}&text=${shareText}`;

  // Build buttons HTML
  container.innerHTML = `
    <!-- Facebook -->
    <a href="${facebookUrl}"
       class="share-btn share-btn--facebook"
       target="_blank"
       rel="noopener noreferrer"
       aria-label="Facebook-এ শেয়ার করুন"
       title="Facebook-এ শেয়ার করুন"
       data-share="facebook">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
      </svg>
      Facebook
    </a>

    <!-- Messenger -->
    <a href="${messengerUrl}"
       class="share-btn share-btn--messenger"
       target="_blank"
       rel="noopener noreferrer"
       aria-label="Messenger-এ শেয়ার করুন"
       title="Messenger-এ শেয়ার করুন"
       data-share="messenger"
       data-mobile-url="${messengerMobileUrl}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.2 5.42 3.15 7.2.16.14.25.34.27.55
                 l.05 1.73c.02.53.55.88 1.04.68l1.93-.85c.16-.07.34-.1.52-.06.9.25 1.87.38
                 2.88.38h.16c5.64 0 10-4.13 10-9.7S17.64 2 12 2z"/>
        <path d="M7.87 14.17l2.5-3.97a.75.75 0 011.03-.21l1.99 1.49a.3.3 0 00.36 0l2.69-2.04
                 c.36-.27.83.14.59.52l-2.5 3.97a.75.75 0 01-1.03.21l-1.99-1.49a.3.3 0 00-.36
                 0l-2.69 2.04c-.36.27-.83-.14-.59-.52z"
              fill="rgba(0,0,0,0)" stroke="currentColor" stroke-width="0"/>
      </svg>
      Messenger
    </a>

    <!-- Telegram -->
    <a href="${telegramUrl}"
       class="share-btn share-btn--telegram"
       target="_blank"
       rel="noopener noreferrer"
       aria-label="Telegram-এ শেয়ার করুন"
       title="Telegram-এ শেয়ার করুন"
       data-share="telegram">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0
                 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0
                 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627
                 -.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693
                 -1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247
                 -2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c
                 -.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008
                 -1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325
                 -.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386
                 4.025-1.627 4.476-1.635z"/>
      </svg>
      Telegram
    </a>

    <!-- Copy Link -->
    <button class="share-btn share-btn--copy"
            aria-label="লিংক কপি করুন"
            title="লিংক কপি করুন"
            data-share="copy">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg>
      <span class="copy-label">লিংক কপি</span>
    </button>
  `;

  // ── Event Listeners ──

  // Copy link button
  const copyBtn = container.querySelector('[data-share="copy"]');
  if (copyBtn) {
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const currentUrl = url || window.location.href;

      // Build YouTube-friendly text (for description copy)
      const copyText = `${title || 'R BD SHOP'}\n${price ? `মূল্য: ${price}\n` : ''}${currentUrl}`;

      const ok = await copyToClipboard(copyText);
      if (ok) {
        showToast('লিংক কপি হয়েছে! ✅', 'success');
        const label = copyBtn.querySelector('.copy-label');
        if (label) {
          label.textContent = 'কপি হয়েছে!';
          setTimeout(() => { label.textContent = 'লিংক কপি'; }, 2000);
        }
      } else {
        showToast('কপি করতে সমস্যা হয়েছে', 'error');
      }
    });
  }

  // Messenger — mobile detection
  const messengerBtn = container.querySelector('[data-share="messenger"]');
  if (messengerBtn) {
    messengerBtn.addEventListener('click', (e) => {
      // Check if mobile
      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
      if (isMobile) {
        const mobileUrl = messengerBtn.dataset.mobileUrl;
        if (mobileUrl) {
          e.preventDefault();
          // Try deep link first, fallback to web
          const timeout = setTimeout(() => {
            window.open(messengerBtn.href, '_blank');
          }, 1500);

          window.location.href = mobileUrl;

          window.addEventListener('blur', () => {
            clearTimeout(timeout);
          }, { once: true });
        }
      }
    });
  }

  // Track share clicks (optional, for analytics)
  container.querySelectorAll('[data-share]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const platform = btn.dataset.share;
      if (platform !== 'copy') {
        console.log(`[R BD SHOP] Shared to: ${platform}`);
      }
    });
  });
}

/**
 * Web Share API ব্যবহার করে native share dialog দেখায়
 * (এটি mobile-এ fallback হিসেবে ব্যবহার করা যেতে পারে)
 * @param {object} data - { title, text, url }
 * @returns {Promise<boolean>}
 */
export async function nativeShare({ title, text, url }) {
  if (!navigator.share) return false;

  try {
    await navigator.share({
      title: title || 'R BD SHOP',
      text:  text || '',
      url:   url || window.location.href,
    });
    return true;
  } catch (err) {
    // User cancelled or not supported
    if (err.name !== 'AbortError') {
      console.warn('[R BD SHOP] Native share error:', err);
    }
    return false;
  }
}
