/* ═══════════════════════════════════════════════════════════════
   MIKYAJ KUWAIT — Main Application Logic
   Shared utilities, toast notifications, navigation
   ═══════════════════════════════════════════════════════════════ */

const MikyajApp = {
  // ─── Theme Toggle ─────────────────────────────────────────
  initTheme() {
    const savedTheme = localStorage.getItem('mikyaj_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.injectLayoutElements();
  },
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('mikyaj_theme', newTheme);
    return newTheme;
  },

  // ─── Language Management (Arabic / English) ───────────────
  currentLang: localStorage.getItem('mikyaj_lang') || 'en',
  initLanguage() {
    const saved = localStorage.getItem('mikyaj_lang') || 'en';
    this.currentLang = saved;
    document.documentElement.setAttribute('lang', saved);
    document.documentElement.setAttribute('dir', saved === 'ar' ? 'rtl' : 'ltr');
    this.updateLanguageUI();
  },
  toggleLanguage() {
    const next = this.currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem('mikyaj_lang', next);
    this.currentLang = next;
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    window.location.reload();
  },
  updateLanguageUI() {
    const isAr = this.currentLang === 'ar';
    document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">translate</span><span>${isAr ? 'English' : 'العربية'}</span>`;
    });
    document.querySelectorAll('.lang-indicator-en').forEach(el => {
      el.style.fontWeight = isAr ? 'normal' : 'bold';
      el.style.color = isAr ? 'var(--outline)' : 'var(--on-surface)';
    });
    document.querySelectorAll('.lang-indicator-ar').forEach(el => {
      el.style.fontWeight = isAr ? 'bold' : 'normal';
      el.style.color = isAr ? 'var(--on-surface)' : 'var(--outline)';
    });
  },

  // Clean product name helper — shows real Arabic or English names
  formatProductName(p) {
    if (!p) return '';
    const isAr = this.currentLang === 'ar';
    if (isAr) {
      return p.name_ar || p.name_en || 'منتج';
    }
    // English mode: show name_en if it contains real Latin text (not Buckwalter)
    const en = (p.name_en || '').trim();
    const hasBuckwalter = /[@`']/.test(en) && !/[A-Za-z]{4,}/.test(en.replace(/[@`']/g, ''));
    if (en && !hasBuckwalter && /[A-Za-z]/.test(en)) {
      return en;
    }
    // Fall back to Arabic name (always readable)
    return p.name_ar || en || 'Product';
  },

  formatProductSubtitle(p) {
    if (!p) return '';
    const isAr = this.currentLang === 'ar';
    const brandName = p.brand ? (typeof p.brand === 'string' ? p.brand : p.brand.name) : '';
    if (isAr) {
      return brandName || '';
    }
    // In English mode, show Arabic name as subtitle if we displayed an English name
    const en = (p.name_en || '').trim();
    const hasLatin = en && /[A-Za-z]/.test(en) && !/[@`']/.test(en);
    if (hasLatin && p.name_ar && p.name_ar !== en) {
      return p.name_ar;
    }
    return brandName || '';
  },

  injectLayoutElements() {
    this.initLanguage();

    // 1. Theme Button
    const themeBtn = document.createElement('button');
    themeBtn.className = 'btn btn-ghost btn-sm theme-toggle-btn';
    themeBtn.style.padding = '6px';
    themeBtn.title = 'Toggle Theme';
    themeBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${document.documentElement.getAttribute('data-theme') === 'light' ? 'dark_mode' : 'light_mode'}</span>`;
    themeBtn.onclick = () => {
      const newTheme = this.toggleTheme();
      themeBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${newTheme === 'light' ? 'dark_mode' : 'light_mode'}</span>`;
    };

    // 2. Language Toggle Button for Header
    const langBtn = document.createElement('button');
    langBtn.className = 'btn btn-ghost btn-sm lang-toggle-btn';
    langBtn.style.padding = '4px 8px';
    langBtn.style.fontSize = '12px';
    langBtn.style.display = 'inline-flex';
    langBtn.style.alignItems = 'center';
    langBtn.style.gap = '4px';
    langBtn.title = 'Switch Language / تغيير اللغة';
    langBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">translate</span><span>${this.currentLang === 'ar' ? 'English' : 'العربية'}</span>`;
    langBtn.onclick = () => this.toggleLanguage();

    // Inject Buttons (Settings button is strictly removed from storefront)
    const adminTopbar = document.querySelector('.admin-topbar .flex.gap-md') || document.querySelector('.admin-topbar .flex.gap-sm');
    if (adminTopbar) {
      adminTopbar.prepend(themeBtn);
    } else {
      const headerIcons = document.querySelector('header .flex.gap-md');
      if (headerIcons) {
        headerIcons.prepend(themeBtn);
        headerIcons.prepend(langBtn);
      }
    }

    // 3. Admin Sidebar Footer (View Storefront + Evolix)
    const adminSidebar = document.querySelector('.admin-sidebar');
    if (adminSidebar) {
      // Remove any existing hardcoded link to prevent duplicates
      const existingLink = Array.from(adminSidebar.querySelectorAll('div')).find(d => d.textContent.includes('View Storefront'));
      if (existingLink) existingLink.remove();

      const sidebarFooter = document.createElement('div');
      sidebarFooter.style.padding = '1rem 1.5rem';
      sidebarFooter.style.borderTop = '1px solid var(--outline-variant)';
      sidebarFooter.innerHTML = `
        <a href="../index.html" class="text-body-sm flex gap-xs" style="color:var(--on-surface-variant);align-items:center;margin-bottom:12px;text-decoration:none">
          <span class="material-symbols-outlined" style="font-size:16px">open_in_new</span>View Storefront
        </a>
        <div class="text-body-sm" style="color:var(--outline);font-size:11px;text-align:center">
          Developed by<br/><a href="https://evolix-studio.in" target="_blank" style="color:var(--secondary);font-weight:600;text-decoration:none">Evolix Studio</a>
        </div>
      `;
      adminSidebar.appendChild(sidebarFooter);
    }

    // 4. Storefront Footer (Evolix)
    const storefrontFooter = document.querySelector('footer');
    if (storefrontFooter) {
      const creditDiv = document.createElement('div');
      creditDiv.style.textAlign = 'center';
      creditDiv.style.padding = '1.5rem';
      creditDiv.style.borderTop = '1px solid var(--outline-variant)';
      creditDiv.style.marginTop = '2rem';
      creditDiv.className = 'text-body-sm';
      creditDiv.style.color = 'var(--on-surface-variant)';
      creditDiv.innerHTML = `Developed by <a href="https://evolix-studio.in" target="_blank" style="color:var(--secondary);font-weight:600;text-decoration:none">Evolix Studio</a>`;
      storefrontFooter.appendChild(creditDiv);
    }
  },

  // ─── Toast Notifications ───────────────────────────────────
  toastContainer: null,
  initToasts() {
    if (!document.querySelector('.toast-container')) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = 'toast-container';
      document.body.appendChild(this.toastContainer);
    } else {
      this.toastContainer = document.querySelector('.toast-container');
    }
  },
  showToast(message, type = 'info', duration = 3000) {
    if (!this.toastContainer) this.initToasts();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
    toast.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:20px;color:var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'})">${icons[type]}</span>
      <span style="flex:1;font-size:13px">${message}</span>
      <button onclick="this.parentElement.remove()" style="color:var(--outline);font-size:18px">&times;</button>
    `;
    this.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },

  // ─── Cart Badge Update ─────────────────────────────────────
  updateCartBadge() {
    const count = MikyajStore.getCartCount();
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  // ─── Add to Cart ───────────────────────────────────────────
  addToCart(product, variant = null) {
    const p = typeof product === 'string' ? (window.__productCache ? window.__productCache[product] : {id: product, name: 'Product'}) : product;
    MikyajStore.addToCart(p, 1, variant);
    this.updateCartBadge();
    this.showToast(`${this.formatProductName(p) || 'Product'} added to bag`, 'success');
  },

  // ─── Toggle Wishlist ───────────────────────────────────────
  toggleWishlist(productId, btn) {
    const added = MikyajStore.toggleWishlist(productId);
    if (btn) {
      btn.classList.toggle('active', added);
    }
    const p = window.__productCache ? window.__productCache[productId] : null;
    this.showToast(
      added ? `${this.formatProductName(p) || 'Product'} added to wishlist` : `Removed from wishlist`,
      added ? 'success' : 'info'
    );
  },

  // ─── Format Currency ──────────────────────────────────────
  formatKWD(amount) {
    return (amount || 0).toFixed(3) + ' KWD';
  },

  // ─── Format Date ──────────────────────────────────────────
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  // ─── Status Badge HTML ────────────────────────────────────
  statusBadge(status) {
    const map = {
      'pending': 'badge-warning',
      'processing': 'badge-info',
      'shipped': 'badge-primary',
      'delivered': 'badge-success',
      'cancelled': 'badge-error',
      'in-stock': 'badge-success',
      'out-of-stock': 'badge-error',
      'low-stock': 'badge-warning',
      'pre-order': 'badge-info'
    };
    return `<span class="badge ${map[status] || 'badge-outline'}">${status}</span>`;
  },

  // ─── Debounce ─────────────────────────────────────────────
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  },

  // ─── Image Upload Handler ─────────────────────────────────
  handleImageUpload(input, previewContainer, maxImages = 5) {
    const files = Array.from(input.files);
    files.slice(0, maxImages).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.innerHTML = `
          <img src="${e.target.result}" alt="Preview"/>
          <button class="remove-btn" onclick="this.parentElement.remove()">&times;</button>
        `;
        div.dataset.imageData = e.target.result;
        previewContainer.appendChild(div);
      };
      reader.readAsDataURL(file);
    });
  },

  // ─── Get Uploaded Images ──────────────────────────────────
  getUploadedImages(previewContainer) {
    return Array.from(previewContainer.querySelectorAll('.image-preview-item'))
      .map(item => item.dataset.imageData || item.querySelector('img')?.src)
      .filter(Boolean);
  },

  // ─── Confirm Dialog ───────────────────────────────────────
  confirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <h3 class="text-headline-sm">Confirm Action</h3>
          </div>
          <div class="modal-body">
            <p style="color:var(--on-surface-variant)">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline btn-sm" id="confirmNo">Cancel</button>
            <button class="btn btn-danger btn-sm" id="confirmYes">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirmYes').onclick = () => { overlay.remove(); resolve(true); };
      overlay.querySelector('#confirmNo').onclick = () => { overlay.remove(); resolve(false); };
    });
  },

  // ─── Init ─────────────────────────────────────────────────
  init() {
    this.initTheme();
    this.initToasts();
    this.updateCartBadge();
  }
};

// Init on load
document.addEventListener('DOMContentLoaded', () => MikyajApp.init());
