/* 
  Mikyaj Kuwait - Mobile First JS
*/

const isMobile = window.matchMedia('(max-width: 767px)');
let scrollPosition = 0;

function lockScroll() {
  scrollPosition = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollPosition}px`;
  document.body.style.width = '100%';
  document.body.classList.add('drawer-open');
}

function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.classList.remove('drawer-open');
  window.scrollTo(0, scrollPosition);
}

function trapFocus(element) {
  const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  
  element.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault(); } }
      else { if (document.activeElement === last) { first.focus(); e.preventDefault(); } }
    }
  });
  first.focus();
}

function runMobileSetup() {
  try { setupMobileDrawer(); } catch (e) { console.error(e); }
  try { setupSearchOverlay(); } catch (e) { console.error(e); }
  try { setupFooterAccordions(); } catch (e) { console.error(e); }
  try { syncCartBadge(); } catch (e) { console.error(e); }
  try { setupProductStickyATC(); } catch (e) { console.error(e); }
  try { setupMobileFilters(); } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', runMobileSetup);
isMobile.addEventListener('change', runMobileSetup);

function syncCartBadge() {
  const mainBadge = document.getElementById('cartBadge') || document.getElementById('cartItemCount');
  const mobileBadge = document.getElementById('mobileCartBadge');
  if (!mainBadge || !mobileBadge) return;
  
  mobileBadge.textContent = mainBadge.textContent;
  mobileBadge.style.display = mainBadge.style.display;
  
  const observer = new MutationObserver(() => {
    mobileBadge.textContent = mainBadge.textContent;
    mobileBadge.style.display = mainBadge.style.display;
  });
  observer.observe(mainBadge, { childList: true, characterData: true, subtree: true, attributes: true });
}

function setupMobileDrawer() {
  const overlay = document.getElementById('mobileDrawerOverlay');
  const drawer = document.getElementById('mobileDrawer');
  const closeBtn = document.getElementById('closeDrawerBtn');
  if (!drawer || !overlay) return;
  
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-hidden', 'true');

  const closeDrawer = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('active');
    unlockScroll();
    document.removeEventListener('keydown', handleEsc);
  };
  
  const handleEsc = (e) => { if (e.key === 'Escape') closeDrawer(); };

  const openDrawer = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('active');
    lockScroll();
    document.addEventListener('keydown', handleEsc);
    setTimeout(() => trapFocus(drawer), 300);
  };

  // Close triggers
  if (closeBtn) {
    closeBtn.onclick = closeDrawer;
  }
  overlay.onclick = closeDrawer;
  
  // Close when clicking any nav link inside the drawer
  drawer.querySelectorAll('.drawer-link').forEach(link => {
    link.addEventListener('click', () => {
      closeDrawer();
    });
  });

  // Open triggers: specific IDs, classes, and hamburger icons
  const openButtons = document.querySelectorAll('#openDrawerBtn, .mobile-menu-btn, button[aria-label="Open Navigation Menu"]');
  openButtons.forEach(btn => {
    btn.onclick = openDrawer;
  });

  document.querySelectorAll('header .material-symbols-outlined').forEach(el => {
    if (el.textContent.trim() === 'menu') {
      const parent = el.closest('button') || el.parentElement;
      if (parent) parent.onclick = openDrawer;
    }
  });
}

function setupSearchOverlay() {
  const overlay = document.getElementById('searchOverlay');
  const closeBtn = document.getElementById('closeSearchBtn');
  const searchInput = overlay ? overlay.querySelector('input') : null;
  if (!overlay) return;
  
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');

  const searchIcon = Array.from(document.querySelectorAll('.material-symbols-outlined')).find(el => el.textContent.trim() === 'search' && !el.closest('.bottom-app-bar'));
  
  const closeSearch = () => { 
    overlay.style.transform = 'translateY(-100%)'; 
    overlay.setAttribute('aria-hidden', 'true');
    unlockScroll();
    document.removeEventListener('keydown', handleSearchEsc);
  };
  const handleSearchEsc = (e) => { if (e.key === 'Escape') closeSearch(); };

  if (searchIcon) {
    searchIcon.parentElement.onclick = (e) => {
      e.preventDefault();
      overlay.style.transform = 'translateY(0)';
      overlay.setAttribute('aria-hidden', 'false');
      lockScroll();
      document.addEventListener('keydown', handleSearchEsc);
      if (searchInput) setTimeout(() => { searchInput.focus(); trapFocus(overlay); }, 300);
    };
  }
  
  if (closeBtn) closeBtn.onclick = closeSearch;
}

function setupFooterAccordions() {
  const toggles = document.querySelectorAll('.footer-accordion-toggle');
  toggles.forEach(toggle => {
    toggle.setAttribute('aria-expanded', 'false');
    const list = toggle.nextElementSibling;
    if (list && list.tagName === 'DIV' && list.classList.contains('flex')) {
      list.classList.add('footer-accordion-content');
      toggle.onclick = () => {
        const isActive = toggle.classList.contains('active');
        toggles.forEach(t => { 
          t.classList.remove('active'); 
          t.setAttribute('aria-expanded', 'false');
          if (t.nextElementSibling) t.nextElementSibling.style.maxHeight = null; 
        });
        if (!isActive) { 
          toggle.classList.add('active'); 
          toggle.setAttribute('aria-expanded', 'true');
          list.style.maxHeight = list.scrollHeight + "px"; 
        }
      };
    }
  });
}

function setupProductStickyATC() {
  const mainAtcBtn = document.querySelector('.product-details .btn-primary');
  if (!mainAtcBtn) return;
  
  // Wait for product rendering if not yet available
  const observer = new MutationObserver(() => {
    if (document.querySelector('.product-details .text-headline-md')) {
      initStickyATC();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  initStickyATC();
}

function initStickyATC() {
  const mainAtcBtn = document.querySelector('.product-details .btn-primary');
  const priceElem = document.querySelector('.product-details .text-headline-md');
  if (!mainAtcBtn || !priceElem || document.querySelector('.sticky-atc-bar')) return;
  
  const stickyBar = document.createElement('div');
  stickyBar.className = 'sticky-atc-bar';
  
  // Sync state and delegate clicks
  const cloneBtn = document.createElement('button');
  cloneBtn.className = 'btn btn-primary';
  cloneBtn.textContent = mainAtcBtn.textContent || 'Add to Bag';
  cloneBtn.onclick = () => mainAtcBtn.click();
  
  const priceSpan = document.createElement('span');
  priceSpan.className = 'atc-price';
  priceSpan.textContent = priceElem.textContent;
  
  const priceBlock = document.createElement('div');
  priceBlock.className = 'atc-price-block';
  priceBlock.appendChild(priceSpan);
  
  stickyBar.appendChild(priceBlock);
  stickyBar.appendChild(cloneBtn);
  document.body.appendChild(stickyBar);
  
  // Sync changes to price/state
  const mainObserver = new MutationObserver(() => {
    priceSpan.textContent = priceElem.textContent;
    cloneBtn.textContent = mainAtcBtn.textContent;
    cloneBtn.disabled = mainAtcBtn.disabled;
  });
  mainObserver.observe(priceElem, { characterData: true, childList: true, subtree: true });
  mainObserver.observe(mainAtcBtn, { attributes: true, childList: true, subtree: true });

  const visObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        stickyBar.classList.add('visible');
        document.body.classList.add('has-sticky-atc');
      } else {
        stickyBar.classList.remove('visible');
        document.body.classList.remove('has-sticky-atc');
      }
    });
  }, { threshold: 0 });
  visObserver.observe(mainAtcBtn);
}

function setupMobileFilters() {
  const filtersPanel = document.querySelector('.mobile-filters-collapse');
  const filterBtn = document.querySelector('button[onclick*="mobile-filters-collapse"]');
  if (!filtersPanel || !filterBtn) return;
  
  filtersPanel.className = 'bottom-sheet';
  filtersPanel.setAttribute('role', 'dialog');
  filtersPanel.setAttribute('aria-modal', 'true');
  filtersPanel.setAttribute('aria-hidden', 'true');
  
  let overlay = document.querySelector('.bottom-sheet-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'bottom-sheet-overlay';
    document.body.appendChild(overlay);
  }
  
  if (!filtersPanel.querySelector('.bottom-sheet-header')) {
    const header = document.createElement('div');
    header.className = 'bottom-sheet-header';
    header.innerHTML = `<h3 class="text-headline-sm" style="margin:0">Filters</h3><button class="btn-icon" id="closeFiltersBtn"><span class="material-symbols-outlined">close</span></button>`;
    filtersPanel.insertBefore(header, filtersPanel.firstChild);
  }
  
  const closeSheet = () => {
    filtersPanel.classList.remove('expanded');
    filtersPanel.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('active');
    unlockScroll();
    document.removeEventListener('keydown', handleEsc);
  };
  const handleEsc = (e) => { if (e.key === 'Escape') closeSheet(); };

  filterBtn.onclick = (e) => {
    e.preventDefault();
    filtersPanel.classList.add('expanded');
    filtersPanel.setAttribute('aria-hidden', 'false');
    overlay.classList.add('active');
    lockScroll();
    document.addEventListener('keydown', handleEsc);
    setTimeout(() => trapFocus(filtersPanel), 300);
  };
  
  const closeBtn = document.getElementById('closeFiltersBtn');
  if (closeBtn) closeBtn.onclick = closeSheet;
  overlay.onclick = closeSheet;
}
