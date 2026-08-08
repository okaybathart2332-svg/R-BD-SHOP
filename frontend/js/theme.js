/* ============================================================
   R BD SHOP — Dark / Light Theme Manager
   Path: frontend/js/theme.js
   Description: System preference detection, localStorage save,
                smooth toggle, button icon swap
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const THEME_KEY     = 'rbd-theme';   // localStorage key
const DARK_VALUE    = 'dark';
const LIGHT_VALUE   = 'light';

/* ─────────────────────────────────────────────────────────────
   Core Functions
───────────────────────────────────────────────────────────── */

/**
 * বর্তমান active theme পড়ে
 * @returns {'dark'|'light'}
 */
export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === DARK_VALUE
    ? DARK_VALUE
    : LIGHT_VALUE;
}

/**
 * Theme apply করে — DOM attribute set + localStorage save
 * @param {'dark'|'light'} theme
 */
export function applyTheme(theme) {
  const root = document.documentElement;

  if (theme === DARK_VALUE) {
    root.setAttribute('data-theme', DARK_VALUE);
  } else {
    root.removeAttribute('data-theme');
  }

  // localStorage-এ preference save করো
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* storage disabled */ }

  // সব toggle button-এর icon update করো
  updateAllToggleIcons(theme);

  // Custom event dispatch (অন্য modules শুনতে পারবে)
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

/**
 * Theme toggle করে (dark ↔ light)
 */
export function toggleTheme() {
  const current = getCurrentTheme();
  applyTheme(current === DARK_VALUE ? LIGHT_VALUE : DARK_VALUE);
}

/**
 * সব theme toggle button-এর icon আপডেট করে
 * @param {'dark'|'light'} theme
 */
function updateAllToggleIcons(theme) {
  const buttons = document.querySelectorAll('[data-theme-toggle]');
  buttons.forEach((btn) => {
    const sunIcon  = btn.querySelector('.icon-sun');
    const moonIcon = btn.querySelector('.icon-moon');
    const label    = btn.querySelector('.theme-label');

    if (theme === DARK_VALUE) {
      // Dark mode চলছে — Sun icon দেখাও (click করলে light হবে)
      if (sunIcon)  sunIcon.style.opacity  = '1';
      if (moonIcon) moonIcon.style.opacity = '0';
      if (label)    label.textContent      = 'লাইট মোড';
      btn.setAttribute('aria-label', 'Switch to Light Mode');
      btn.setAttribute('title', 'লাইট মোডে যান');
    } else {
      // Light mode চলছে — Moon icon দেখাও (click করলে dark হবে)
      if (sunIcon)  sunIcon.style.opacity  = '0';
      if (moonIcon) moonIcon.style.opacity = '1';
      if (label)    label.textContent      = 'ডার্ক মোড';
      btn.setAttribute('aria-label', 'Switch to Dark Mode');
      btn.setAttribute('title', 'ডার্ক মোডে যান');
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   Initialization — page load-এ একবার call করো
───────────────────────────────────────────────────────────── */

/**
 * Theme system initialize করে:
 * 1. localStorage-এ saved preference চেক করে
 * 2. না থাকলে system (OS) preference দেখে
 * 3. Theme apply করে
 * 4. সব toggle button-এ event listener যোগ করে
 */
export function initTheme() {
  // Priority 1: localStorage-এ saved preference
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch { /* ignore */ }

  let theme;

  if (savedTheme === DARK_VALUE || savedTheme === LIGHT_VALUE) {
    // User-এর আগের পছন্দ আছে
    theme = savedTheme;
  } else {
    // System preference দেখো
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? DARK_VALUE : LIGHT_VALUE;
  }

  // Flash of wrong theme prevent করতে — transition off করে apply করো
  document.documentElement.style.transition = 'none';
  applyTheme(theme);

  // 1 frame পরে transition আবার enable করো
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.style.transition = '';
    });
  });

  // System preference change-এ auto update (যদি user-এর কোনো saved preference না থাকে)
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
    if (!stored) {
      // User কোনো preference save করেনি — system follow করো
      applyTheme(e.matches ? DARK_VALUE : LIGHT_VALUE);
    }
  });

  // সব [data-theme-toggle] button-এ click listener যোগ করো
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-theme-toggle]');
    if (toggleBtn) {
      e.preventDefault();
      toggleTheme();

      // Small bounce animation on button
      toggleBtn.style.transform = 'scale(0.88)';
      setTimeout(() => { toggleBtn.style.transform = ''; }, 180);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   Inline Script (বা <head>-এ যোগ করো FOUC prevent করতে)
   এই code সরাসরি <head>-এর <script> tag-এ paste করো —
   module load-এর আগেই theme apply হয়ে যাবে।
───────────────────────────────────────────────────────────── */
export const FOUC_PREVENTION_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('rbd-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (!saved) {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {}
})();
`;
