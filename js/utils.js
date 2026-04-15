// ==================== UTILITY FUNCTIONS ====================

// HTML escaping
export function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// Toast notifications
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-msg">${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Modal handling
export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

export function closeOnOverlay(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

export function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

// Loading state
export function setLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="spinner"></span> ${text}` : text;
}

// Debounce function for performance
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Lazy load images
export function lazyLoadImages() {
  const images = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });
  images.forEach(img => imageObserver.observe(img));
}

// Format date
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format price
export function formatPrice(price) {
  return `$${parseFloat(price).toFixed(2)}`;
}

// Get category icon
export function getCategoryIcon(category) {
  const icons = {
    'Electronics': '📱',
    'Clothing & Accessories': '👕',
    'Collectibles': '🏆',
    'Toys & Figures': '🧸',
    'Sports & Outdoors': '⚽',
    'Books & Media': '📚',
    'Home & Garden': '🏠',
    'Tools & Equipment': '🔧',
    'Other': '📦'
  };
  return icons[category] || '📦';
}

// Payment method icons
export const paymentIcons = {
  'cash': '💵',
  'card': '💳',
  'paypal': '🅿️',
  'venmo': 'V',
  'zelle': 'Z',
  'crypto': '₿',
  'trade': '🔄'
};

// Condition labels
export const conditionLabels = {
  'new': '✨ New',
  'like-new': '🌟 Like New',
  'good': '👍 Good',
  'fair': '📦 Fair',
  'poor': '⚠️ Poor'
};

// Animate number counter
export function animateNumber(el, target) {
  const duration = 800;
  const start = performance.now();
  const startVal = parseInt(el.textContent) || 0;
  
  function step(timestamp) {
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (target - startVal) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Expose functions globally for onclick handlers
window.closeModal = closeModal;
window.openModal = openModal;
window.closeOnOverlay = closeOnOverlay;
window.closeMobileNav = closeMobileNav;
window.showToast = showToast;