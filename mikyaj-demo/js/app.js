/* ═══════════════════════════════════════════════════════════════
   MIKYAJ KUWAIT — Main Application Logic
   Shared utilities, toast notifications, navigation
   ═══════════════════════════════════════════════════════════════ */

const MikyajApp = {
  // ─── Theme Toggle ─────────────────────────────────────────
  initTheme() {
    const savedTheme = localStorage.getItem('mikyaj_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.injectThemeToggle();
  },
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('mikyaj_theme', newTheme);
    return newTheme;
  },
  injectThemeToggle() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm theme-toggle-btn';
    btn.style.padding = '6px';
    btn.title = 'Toggle Theme';
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${document.documentElement.getAttribute('data-theme') === 'light' ? 'dark_mode' : 'light_mode'}</span>`;
    btn.onclick = () => {
      const newTheme = this.toggleTheme();
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${newTheme === 'light' ? 'dark_mode' : 'light_mode'}</span>`;
    };

    // Try to append to admin topbar
    const adminTopbar = document.querySelector('.admin-topbar .flex.gap-md') || document.querySelector('.admin-topbar .flex.gap-sm');
    if (adminTopbar) {
      adminTopbar.prepend(btn);
    } else {
      // Try storefront header
      const headerIcons = document.querySelector('header .flex.gap-md');
      if (headerIcons) {
        headerIcons.prepend(btn);
      }
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
  addToCart(productId, variant = null) {
    MikyajStore.addToCart(productId, 1, variant);
    this.updateCartBadge();
    const product = MikyajStore.getProduct(productId);
    this.showToast(`${product?.name || 'Product'} added to bag`, 'success');
  },

  // ─── Toggle Wishlist ───────────────────────────────────────
  toggleWishlist(productId, btn) {
    const added = MikyajStore.toggleWishlist(productId);
    if (btn) {
      btn.classList.toggle('active', added);
    }
    const product = MikyajStore.getProduct(productId);
    this.showToast(
      added ? `${product?.name || 'Product'} added to wishlist` : `Removed from wishlist`,
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
