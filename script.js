/* ================================================================
   OBTAINUM MARKETPLACE — script.js (COMPLETE WITH ANIMATIONS)
   
   ORGANIZATION:
   1. supabase-client.js
   2. state.js
   3. utils/toast.js
   4. utils/dom.js
   5. features/theme.js
   6. features/auth.js
   7. api/products.js
   8. features/cart.js
   9. features/wishlist.js
   10. features/sell.js
   11. features/filters.js
   12. features/pagination.js
   13. pages/home.js
   14. pages/shop.js
   15. pages/profile.js
   16. features/ai-analysis.js
   17. animations.js
   18. app.js
================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ================================================================
     SECTION: supabase-client.js — Supabase Initialization
  ================================================================ */
  let DB = null;
  const SUPABASE_URL = 'https://gotzmuobwuubsugnowxq.supabase.co';
  const SUPABASE_API_KEY = 'sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs';
  const STORAGE_BUCKET = 'listing-images';

  try {
    if (typeof supabase !== 'undefined' && supabase?.createClient) {
      DB = supabase.createClient(SUPABASE_URL, SUPABASE_API_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'obtainum-auth-token',
          storage: window.localStorage,
          flowType: 'pkce'
        },
        global: { headers: { 'x-application-name': 'obtainum-engine' } },
      });
    }
  } catch (e) {
    console.warn('Supabase initialization failed. Running in demo mode.', e.message);
    DB = null;
  }

  /* ================================================================
     SECTION: state.js — Global App State
  ================================================================ */
  let products = [];
  let filteredItems = [];
  let cart = JSON.parse(localStorage.getItem('OBTAINUM_cart') || '[]');
  let wishlist = JSON.parse(localStorage.getItem('OBTAINUM_wishlist') || '[]');
  let currentPage = 1;
  const ITEMS_PER_PAGE = 12;
  let currentView = 'grid';
  let activeCategory = '';
  let currentUser = null;
  let sessionInterval = null;
  let lastAnalyzedProduct = null;
  let geminiApiKey = localStorage.getItem('OBTAINUM_gemini_key') || '';
  let mapsApiKey = localStorage.getItem('OBTAINUM_maps_key') || '';

  /* ================================================================
     SECTION: utils/toast.js — Toast Notification Helpers
  ================================================================ */
  function showToast(title, message = '', type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = { 
      success: 'fa-check-circle', 
      error: 'fa-times-circle', 
      warning: 'fa-exclamation-triangle', 
      info: 'fa-info-circle' 
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type} animate-fade-in-left`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-msg">${message}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close notification"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    setTimeout(() => removeToast(toast), duration);
  }

  function removeToast(toast) {
    toast.classList.remove('animate-fade-in-left');
    toast.classList.add('animate-fade-in-right');
    toast.style.animation = 'fadeOutToast 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }

  /* ================================================================
     SECTION: utils/dom.js — DOM Utility Helpers
  ================================================================ */
  function getCategoryIcon(category) {
    const map = {
      'Electronics': 'fa-microchip',
      'Clothing & Accessories': 'fa-tshirt',
      'Collectibles': 'fa-gem',
      'Sports & Outdoors': 'fa-futbol',
      'Books & Media': 'fa-book',
      'Home & Garden': 'fa-home',
      'Vehicles': 'fa-car',
      'Other': 'fa-box-open'
    };
    return map[category] || 'fa-tag';
  }

  function formatPrice(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function normalizeImages(images) {
    if (!images) return [];
    if (Array.isArray(images)) return images.filter(Boolean);
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [images];
      } catch (_) {
        return [images];
      }
    }
    return [];
  }

  function starsHTML(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) html += '<i class="fas fa-star star"></i>';
      else if (i - 0.5 <= rating) html += '<i class="fas fa-star-half-alt star"></i>';
      else html += '<i class="far fa-star star"></i>';
    }
    return html;
  }

  function setButtonLoading(btn, loading) {
    btn.disabled = loading;
    const label = btn.querySelector('.btn-label') || btn;
    if (label) label.style.opacity = loading ? '0.6' : '1';
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  function addAnimation(element, animationName, duration = 600, callback) {
    if (!element) return;
    element.classList.add(`animate-${animationName}`);
    setTimeout(() => {
      element.classList.remove(`animate-${animationName}`);
      if (callback) callback();
    }, duration);
  }

  function addStaggerAnimation(elements, animationName, baseDelay = 100) {
    elements.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add(`animate-${animationName}`);
        setTimeout(() => el.classList.remove(`animate-${animationName}`), 600);
      }, index * baseDelay);
    });
  }

  /* ================================================================
     SECTION: features/theme.js — Dark/Light Mode Toggle with Animations
  ================================================================ */
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const htmlElement = document.documentElement;
  const savedTheme = localStorage.getItem('OBTAINUM_theme') || 'light';

  htmlElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = htmlElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';

    htmlElement.style.opacity = '0.95';

    setTimeout(() => {
      htmlElement.setAttribute('data-theme', next);
      localStorage.setItem('OBTAINUM_theme', next);
      updateThemeIcon(next);

      themeIcon.classList.add('animate-spin');
      setTimeout(() => themeIcon.classList.remove('animate-spin'), 600);

      htmlElement.style.opacity = '1';

      const themeName = next === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode';
      showToast('Theme Changed', `Switched to ${themeName}`, 'info', 2000);
    }, 100);
  });

  function updateThemeIcon(theme) {
    themeIcon.className = theme === 'dark'
      ? 'fas fa-sun'
      : 'fas fa-moon';
    themeToggleBtn.title = theme === 'dark'
      ? 'Switch to light mode (☀️)'
      : 'Switch to dark mode (🌙)';

    themeIcon.classList.add('animate-fade-in');
    setTimeout(() => themeIcon.classList.remove('animate-fade-in'), 600);
  }

  /* ================================================================
     SECTION: features/auth.js — Authentication with Animations
  ================================================================ */
  if (DB) {
    DB.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      if (user && (!currentUser || user.id !== currentUser.id)) {
        currentUser = user;
        await ensureProfileExists(currentUser);
        updateNavUI();
        if (event === 'SIGNED_IN') {
          showToast('Welcome! 👋', `Logged in as ${currentUser.email}`, 'success', 3000);
          showPage('home');
        }
        const loginTime = Date.now();
        localStorage.setItem('OBTAINUM_login_time', loginTime);
        if (sessionInterval) clearInterval(sessionInterval);
        sessionInterval = setInterval(checkSessionTimeout, 60000);
      } else if (!user && currentUser) {
        currentUser = null;
        updateNavUI();
        if (sessionInterval) clearInterval(sessionInterval);
        localStorage.removeItem('OBTAINUM_login_time');
      }
    });
  }

  function checkSessionTimeout() {
    const loginTime = localStorage.getItem('OBTAINUM_login_time');
    if (!loginTime) return;
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - parseInt(loginTime) > oneHour) {
      showToast('Session Expired', 'Logged out due to inactivity.', 'warning');
      logout();
    }
  }

  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!DB) return showToast('Database not configured', 'Cannot log in.', 'error');

    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    setButtonLoading(btn, true);
    errEl.style.display = 'none';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const { error } = await DB.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
      addAnimation(errEl, 'bounce');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!DB) return showToast('Database not configured', 'Cannot register.', 'error');

    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    setButtonLoading(btn, true);
    errEl.style.display = 'none';

    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm-password').value;
    const username = document.getElementById('register-username').value.trim();
    const terms = document.getElementById('register-terms').checked;

    if (!terms) {
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Accept the Terms.';
      errEl.style.display = 'flex';
      addAnimation(errEl, 'bounce');
      setButtonLoading(btn, false);
      return;
    }
    if (password !== confirm) {
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match.';
      errEl.style.display = 'flex';
      addAnimation(errEl, 'bounce');
      setButtonLoading(btn, false);
      return;
    }

    try {
      const { error } = await DB.auth.signUp({
        email, password,
        options: { data: { username } }
      });
      if (error) throw error;
      showPage('login');
      showToast('Account created! 🎉', 'Check your email to confirm.', 'success', 6000);
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
      addAnimation(errEl, 'bounce');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  window.logout = async function () {
    if (DB) await DB.auth.signOut();
    currentUser = null;
    updateNavUI();
    showPage('home');
    showToast('Logged out', 'See you next time! 👋', 'info');
  };

  window.loginWithGoogle = async function () {
    if (!DB) return showToast('Database not configured', '', 'error');
    try {
      const { error } = await DB.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });
      if (error) throw error;
    } catch (err) {
      showToast('OAuth Error', err.message, 'error');
    }
  };

  const forgotForm = document.getElementById('forgot-form');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const msgEl = document.getElementById('forgot-msg');
    if (!DB) {
      msgEl.textContent = 'Database not configured.';
      msgEl.className = 'form-error';
      msgEl.style.display = 'block';
      return;
    }
    try {
      const { error } = await DB.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      msgEl.textContent = 'Reset link sent! Check your email. ✉️';
      msgEl.className = 'form-success';
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'form-error';
    }
    msgEl.style.display = 'block';
    addAnimation(msgEl, 'fade-in-up');
  });

  function updateNavUI() {
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');
    const profileLink = document.getElementById('profile-link');
    const sellLink = document.querySelector('.nav-link[data-page="sell"]');

    if (currentUser) {
      loginLink.style.display = 'none';
      logoutLink.style.display = 'flex';
      profileLink.style.display = 'flex';
      sellLink.style.display = 'flex';
    } else {
      loginLink.style.display = 'flex';
      logoutLink.style.display = 'none';
      profileLink.style.display = 'none';
      sellLink.style.display = 'none';
    }
  }

  async function ensureProfileExists(user) {
    if (!DB || !user?.id) return;
    const { error } = await DB.from('profiles').select('id').eq('id', user.id).single();
    if (error && error.code === 'PGRST116') {
      const username = user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
      await DB.from('profiles').insert({
        id: user.id,
        email: user.email,
        username: username,
      });
    }
  }

  async function checkAuthSession() {
    if (!DB) return;
    try {
      const { data: { session }, error } = await DB.auth.getSession();
      if (error) throw error;
      currentUser = session?.user || null;
      if (currentUser) {
        await ensureProfileExists(currentUser);
        if (sessionInterval) clearInterval(sessionInterval);
        sessionInterval = setInterval(checkSessionTimeout, 60000);
      }
      updateNavUI();
    } catch (err) {
      console.error('Session check failed:', err);
    }
  }

  window.togglePasswordVisibility = function (inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  };

  const regPass = document.getElementById('register-password');
  if (regPass) {
    regPass.addEventListener('input', () => {
      const val = regPass.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (val.length >= 12) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      const fill = document.getElementById('strength-fill');
      const label = document.getElementById('strength-label');
      const levels = [
        { pct: '20%', color: '#ef4444', text: 'Very weak' },
        { pct: '40%', color: '#f97316', text: 'Weak' },
        { pct: '60%', color: '#f59e0b', text: 'Fair' },
        { pct: '80%', color: '#22c55e', text: 'Strong' },
        { pct: '100%', color: '#10b981', text: 'Very strong' },
      ];
      const lvl = levels[Math.max(0, score - 1)] || levels[0];
      fill.style.width = val.length ? lvl.pct : '0%';
      fill.style.background = lvl.color;
      label.textContent = val.length ? lvl.text : '';
      label.style.color = lvl.color;
    });
  }

  /* ================================================================
     SECTION: api/products.js — Product Fetching & Rendering
  ================================================================ */
  async function fetchListings() {
    if (!DB) return [];
    const { data, error } = await DB
      .from('listings')
      .select('*, profiles(username, rating)')
      .eq('is_sold', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Listings fetch failed:', error);
      return [];
    }

    return (data || []).map(item => ({
      ...item,
      images: normalizeImages(item.images),
      seller: item.profiles?.username || 'Unknown Seller',
      seller_rating: item.profiles?.rating || 0,
      views: item.view_count || 0,
      likes: item.favorite_count || 0,
    }));
  }

  function buildProductCard(product) {
    const isWished = inWishlist(product.id);
    const inCart = cart.some(c => c.id === product.id);
    const discountPct = product.msrp && product.price < product.msrp
      ? Math.round((1 - product.price / product.msrp) * 100)
      : null;

    const fairBadge = product.is_fair
      ? `<span class="badge badge-fair"><i class="fas fa-shield-alt"></i> Fair Price</span>`
      : `<span class="badge badge-scalp"><i class="fas fa-exclamation-triangle"></i> Above MSRP</span>`;

    const conditionLabel = {
      'new': 'New',
      'like-new': 'Like New',
      'good': 'Good',
      'fair': 'Fair',
      'poor': 'For Parts'
    }[product.condition] || product.condition;

    const firstImage = product.images?.[0] || null;

    return `
      <div class="product-card animate-fade-in-up" role="listitem" onclick="openProductModal('${product.id}')" tabindex="0">
        <div class="product-card-img">
          ${firstImage
            ? `<img src="${firstImage}" alt="${product.name}" loading="lazy" decoding="async">`
            : `<i class="fas ${getCategoryIcon(product.category)}"></i>`}
          <div class="product-card-badges">${fairBadge}</div>
          <button class="wishlist-btn ${isWished ? 'active' : ''}" data-id="${product.id}"
            onclick="toggleWishlist('${product.id}', event)" aria-label="Toggle wishlist">
            <i class="${isWished ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
        <div class="product-card-body">
          <div class="product-meta">
            <span class="product-category">${product.category}</span>
            <span class="product-condition condition-${product.condition}">${conditionLabel}</span>
          </div>
          <div class="product-name">${product.name}</div>
          <div class="product-seller">
            <i class="fas fa-user-circle"></i> ${product.seller}
            <span class="product-seller-rating">${starsHTML(product.seller_rating)}</span>
          </div>
          ${product.location ? `<div class="product-location"><i class="fas fa-map-marker-alt"></i> ${product.location}</div>` : ''}
          <div class="product-price-row">
            <span class="product-price">${formatPrice(product.price)}</span>
            ${product.msrp ? `<span class="product-msrp">MSRP ${formatPrice(product.msrp)}</span>` : ''}
            ${discountPct ? `<span class="product-discount">-${discountPct}%</span>` : ''}
          </div>
        </div>
        <div class="product-card-actions">
          <button class="btn btn-primary" onclick="addToCart('${product.id}', event)">
            <i class="fas fa-cart-plus"></i> ${inCart ? 'Add More' : 'Add'}
          </button>
          <button class="btn btn-outline" onclick="event.stopPropagation(); analyzeProductWithAI('${product.id}');" title="AI Analysis">
            <i class="fas fa-brain"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderProductGrid(items, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);" class="animate-fade-in">
          <i class="fas fa-search" style="font-size:3rem;opacity:0.3;margin-bottom:16px;display:block;"></i>
          <h3>No listings found</h3>
          <p>Try adjusting your filters or search terms.</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="clearAllFilters()">Clear Filters</button>
        </div>`;
      return;
    }
    
    grid.innerHTML = items.map(buildProductCard).join('');
    
    // Stagger animations
    const cards = grid.querySelectorAll('.product-card');
    addStaggerAnimation(Array.from(cards), 'fade-in-up', 60);
  }

  /* ================================================================
     SECTION: features/cart.js — Shopping Cart with Animations
  ================================================================ */
  window.addToCart = function (productId, e) {
    if (e) e.stopPropagation();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingIdx = cart.findIndex(c => c.id === productId);
    if (existingIdx >= 0) {
      cart[existingIdx].qty = (cart[existingIdx].qty || 1) + 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }

    saveCart();
    updateCartCount();
    showToast('Added to cart! 🛒', product.name, 'success', 2500);
    animateCartBadge();
  };

  function saveCart() {
    localStorage.setItem('OBTAINUM_cart', JSON.stringify(cart));
  }

  function updateCartCount() {
    const total = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    const badge = document.getElementById('cart-count');
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }

  function animateCartBadge() {
    const badge = document.getElementById('cart-count');
    badge.classList.remove('animate-scale-in', 'animate-bounce');
    void badge.offsetWidth;
    badge.classList.add('animate-scale-in');
    
    setTimeout(() => {
      badge.classList.remove('animate-scale-in');
      badge.classList.add('animate-bounce');
      setTimeout(() => badge.classList.remove('animate-bounce'), 600);
    }, 400);
  }

  function renderCartPage() {
    const itemsEl = document.getElementById('cart-items');
    if (!itemsEl) return;
    itemsEl.innerHTML = '';

    if (cart.length === 0) {
      itemsEl.innerHTML = `
        <div class="cart-empty animate-fade-in">
          <i class="fas fa-shopping-cart"></i>
          <h3>Your cart is empty</h3>
          <p>Browse our marketplace and find something you love.</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="showPage('shop')">
            <i class="fas fa-store"></i> Browse
          </button>
        </div>`;
      updateCartSummary();
      return;
    }

    cart.forEach((item, index) => {
      const firstImage = item.images?.[0] || null;
      const el = document.createElement('div');
      el.className = 'cart-item animate-fade-in-up';
      el.style.animationDelay = `${index * 50}ms`;
      el.innerHTML = `
        <div class="cart-item-img">
          ${firstImage
            ? `<img src="${firstImage}" alt="${item.name}" loading="lazy">`
            : `<i class="fas ${getCategoryIcon(item.category)}"></i>`}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-seller"><i class="fas fa-user-circle"></i> ${item.seller}</div>
          <div class="cart-item-actions">
            <div class="qty-control">
              <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
              <span class="qty-display">${item.qty || 1}</span>
              <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
            </div>
            <button class="cart-remove-btn" onclick="removeFromCart('${item.id}')">
              <i class="fas fa-trash-alt"></i> Remove
            </button>
          </div>
        </div>
        <div class="cart-item-price">${formatPrice(item.price * (item.qty || 1))}</div>
      `;
      itemsEl.appendChild(el);
    });

    updateCartSummary();
  }

  function updateCartSummary() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * (item.qty || 1), 0);
    const fee = subtotal * 0.02;
    document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
    document.getElementById('cart-fee').textContent = formatPrice(fee);
    document.getElementById('cart-total').textContent = formatPrice(subtotal + fee);
  }

  window.changeQty = function (id, delta) {
    const idx = cart.findIndex(c => c.id === id);
    if (idx < 0) return;
    cart[idx].qty = Math.max(1, (cart[idx].qty || 1) + delta);
    saveCart();
    updateCartCount();
    renderCartPage();
  };

  window.removeFromCart = function (id) {
    cart = cart.filter(c => c.id !== id);
    saveCart();
    updateCartCount();
    renderCartPage();
    showToast('Removed from cart', '', 'info', 2000);
  };

  window.handleCheckout = function () {
    if (!currentUser) {
      showToast('Login required', 'Please log in to checkout.', 'warning');
      showPage('login');
      return;
    }
    if (cart.length === 0) {
      showToast('Cart is empty', '', 'warning');
      return;
    }
    showToast('Checkout coming soon', 'Payment integration in development.', 'info');
  };

  /* ================================================================
     SECTION: features/wishlist.js — Wishlist Management
  ================================================================ */
  function inWishlist(id) {
    return wishlist.includes(id);
  }

  window.toggleWishlist = async function (productId, e) {
    if (e) e.stopPropagation();
    if (!currentUser) {
      showToast('Login Required', 'Please log in to save items.', 'warning');
      showPage('login');
      return;
    }

    const idx = wishlist.indexOf(productId);
    let isWished;

    if (idx >= 0) {
      wishlist.splice(idx, 1);
      isWished = false;
      showToast('Removed from wishlist', '', 'info', 2000);
      if (DB) await DB.from('wishlists').delete().match({ user_id: currentUser.id, listing_id: productId });
    } else {
      wishlist.push(productId);
      isWished = true;
      showToast('Added to wishlist ❤️', '', 'success', 2000);
      if (DB) await DB.from('wishlists').insert({ user_id: currentUser.id, listing_id: productId });
    }
    localStorage.setItem('OBTAINUM_wishlist', JSON.stringify(wishlist));

    document.querySelectorAll(`.wishlist-btn[data-id="${productId}"]`).forEach(btn => {
      btn.classList.toggle('active', isWished);
      btn.querySelector('i').className = isWished ? 'fas fa-heart animate-heartbeat' : 'far fa-heart';
      
      if (isWished) {
        setTimeout(() => btn.querySelector('i').classList.remove('animate-heartbeat'), 1300);
      }
    });
  };

  /* ================================================================
     SECTION: features/sell.js — Sell Form with Image Upload
  ================================================================ */
  ['sell-name', 'sell-description'].forEach(id => {
    const input = document.getElementById(id);
    const count = document.getElementById(id.replace('sell-', '') + '-char-count');
    if (input && count) {
      input.addEventListener('input', () => {
        count.textContent = input.value.length;
      });
    }
  });

  const priceInput = document.getElementById('sell-price');
  const msrpInput = document.getElementById('sell-msrp');
  const fairnessEl = document.getElementById('price-fairness-indicator');
  const fairnessText = document.getElementById('price-fairness-text');

  function updatePriceFairness() {
    if (!priceInput || !msrpInput || !fairnessEl) return;
    const price = parseFloat(priceInput.value);
    const msrp = parseFloat(msrpInput.value);
    if (isNaN(price) || isNaN(msrp) || price <= 0 || msrp <= 0) {
      fairnessEl.style.display = 'none';
      return;
    }

    const ratio = price / msrp;
    fairnessEl.style.display = 'flex';
    fairnessEl.className = 'price-fairness animate-fade-in';
    fairnessEl.innerHTML = '';

    if (ratio <= 1.0) {
      fairnessEl.classList.add('fair');
      fairnessText.textContent = `✓ ${Math.round((1-ratio)*100)}% below MSRP — great value!`;
    } else if (ratio <= 1.2) {
      fairnessEl.classList.add('warning');
      fairnessText.textContent = `~ ${Math.round((ratio-1)*100)}% above MSRP.`;
    } else {
      fairnessEl.classList.add('scalp');
      fairnessText.textContent = `✗ ${Math.round((ratio-1)*100)}% above MSRP — may be flagged.`;
    }
  }

  priceInput?.addEventListener('input', updatePriceFairness);
  msrpInput?.addEventListener('input', updatePriceFairness);

  const imageInput = document.getElementById('sell-images');
  const imageUploadArea = document.getElementById('image-upload-area');
  const imagePreviewRow = document.getElementById('image-preview-row');
  let uploadedFiles = [];

  if (imageInput) imageInput.addEventListener('change', (e) => handleImageFiles(e.target.files));
  if (imageUploadArea) {
    imageUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.currentTarget.classList.add('drag-over');
    });
    imageUploadArea.addEventListener('dragleave', (e) => e.currentTarget.classList.remove('drag-over'));
    imageUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      handleImageFiles(e.dataTransfer.files);
    });
  }

  function handleImageFiles(files) {
    const maxFiles = 10;
    const maxSize = 5 * 1024 * 1024;
    [...files].forEach(file => {
      if (uploadedFiles.filter(Boolean).length >= maxFiles) return;
      if (!file.type.startsWith('image/')) {
        showToast('Images only', `${file.name} is not an image.`, 'error');
        return;
      }
      if (file.size > maxSize) {
        showToast('File too large', `${file.name} exceeds 5MB.`, 'error');
        return;
      }

      const fileIndex = uploadedFiles.length;
      uploadedFiles.push(file);
      renderImagePreview(file, fileIndex);
    });
  }

  function renderImagePreview(file, idx) {
    const reader = new FileReader();
    reader.onload = e => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-thumb-wrap animate-scale-in';
      wrap.dataset.idx = idx;
      wrap.innerHTML = `
        <img src="${e.target.result}" alt="Preview" class="preview-thumb">
        <button type="button" class="remove-thumb-btn" onclick="removeThumb(${idx})">
          <i class="fas fa-times"></i>
        </button>`;
      imagePreviewRow?.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  }

  window.removeThumb = function (idx) {
    uploadedFiles[idx] = null;
    const thumb = document.querySelector(`.preview-thumb-wrap[data-idx="${idx}"]`);
    if (thumb) {
      thumb.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => thumb.remove(), 300);
    }
  };

  const sellForm = document.getElementById('sell-form');
  if (sellForm) {
    sellForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) {
        showToast('Login required', 'Please log in to list an item.', 'warning');
        return;
      }

      const btn = document.getElementById('sell-submit-btn');
      setButtonLoading(btn, true);

      try {
        const activeFiles = uploadedFiles.filter(Boolean);
        if (activeFiles.length === 0) throw new Error('At least one image is required.');

        const imageUrls = [];
        for (const file of activeFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
          const { error: uploadError } = await DB.storage.from(STORAGE_BUCKET).upload(fileName, file);
          if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

          const { data: urlData } = DB.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
          imageUrls.push(urlData.publicUrl);
        }

        const price = parseFloat(document.getElementById('sell-price').value);
        const msrp = parseFloat(document.getElementById('sell-msrp').value) || null;

        const listingData = {
          seller_id: currentUser.id,
          name: document.getElementById('sell-name').value.trim(),
          category: document.getElementById('sell-category').value,
          description: document.getElementById('sell-description').value.trim(),
          condition: document.getElementById('sell-condition').value,
          location: document.getElementById('sell-location').value.trim(),
          price: price,
          msrp: msrp,
          type: document.getElementById('sell-type').value,
          shipping: document.getElementById('sell-shipping').value,
          payment_methods: [...document.querySelectorAll('.payment-method-check:checked')].map(e => e.value),
          tags: document.getElementById('sell-tags').value.split(',').map(t => t.trim()).filter(Boolean),
          images: imageUrls,
          is_fair: msrp ? price <= msrp * 1.1 : true,
        };

        if (!listingData.name) throw new Error('Item name is required.');
        if (listingData.price <= 0) throw new Error('Enter a valid price.');

        const { data: newListing, error: dbError } = await DB
          .from('listings')
          .insert(listingData)
          .select('*, profiles(username, rating)')
          .single();

        if (dbError) throw dbError;

        const formattedListing = {
          ...newListing,
          images: normalizeImages(newListing.images),
          seller: newListing.profiles?.username || 'You',
          seller_rating: newListing.profiles?.rating || 0,
          views: 0,
          likes: 0,
        };

        products.unshift(formattedListing);
        filteredItems.unshift(formattedListing);

        showToast('Listing published! 🎉', `"${formattedListing.name}" is now live.`, 'success', 5000);
        showPage('shop');

        sellForm.reset();
        uploadedFiles = [];
        imagePreviewRow.innerHTML = '';
        fairnessEl.style.display = 'none';

      } catch (err) {
        console.error('Publishing error:', err);
        showToast('Failed to publish', err.message || 'Check your form and try again.', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  /* ================================================================
     SECTION: features/filters.js — Shop Filtering with Animations
  ================================================================ */
  const priceSlider = document.getElementById('price-slider');
  const priceFilterVal = document.getElementById('price-filter-value');
  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      priceFilterVal.textContent = formatPrice(priceSlider.value);
    });
  }

  const shopSearch = document.getElementById('shop-search');
  if (shopSearch) shopSearch.addEventListener('input', debounce(applyFilters, 300));

  document.getElementById('filters-sidebar')?.addEventListener('change', applyFilters);
  document.getElementById('sort-select')?.addEventListener('change', applyFilters);

  function applyFilters() {
    const searchVal = (document.getElementById('shop-search')?.value || '').toLowerCase().trim();
    const categoryVal = document.querySelector('input[name="category-filter"]:checked')?.value || '';
    const priceMax = parseFloat(priceSlider?.value || 5000);
    const checkedCond = [...document.querySelectorAll('.condition-filter:checked')].map(e => e.value);
    const antiScalp = document.getElementById('anti-scalp-filter')?.checked || false;
    const sortVal = document.getElementById('sort-select')?.value || 'newest';

    let result = products.filter(p => {
      if (searchVal && !p.name.toLowerCase().includes(searchVal) && !p.description.toLowerCase().includes(searchVal)) return false;
      if (categoryVal && p.category !== categoryVal) return false;
      if (p.price > priceMax) return false;
      if (checkedCond.length > 0 && !checkedCond.includes(p.condition)) return false;
      if (antiScalp && !p.is_fair) return false;
      return true;
    });

    switch (sortVal) {
      case 'price-asc': result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'oldest': result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      default: result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
    }

    filteredItems = result;
    currentPage = 1;
    renderCurrentPage();
    updateResultsCount(result.length);
  }

  function renderCurrentPage() {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page = filteredItems.slice(start, start + ITEMS_PER_PAGE);
    renderProductGrid(page, 'product-grid');
    renderPagination();
  }

  function updateResultsCount(n) {
    const el = document.getElementById('results-count');
    if (el) el.textContent = `${n.toLocaleString()} listing${n !== 1 ? 's' : ''}`;
  }

  window.clearAllFilters = function () {
    document.getElementById('filters-sidebar')?.reset();
    if (priceSlider) {
      priceSlider.value = 5000;
      priceFilterVal.textContent = '$5,000';
    }
    applyFilters();
    showToast('Filters cleared', '', 'info', 2000);
  };

  window.setView = function (view) {
    currentView = view;
    const grid = document.getElementById('product-grid');
    grid.className = `product-grid ${view}-view`;
    document.getElementById('grid-view-btn').classList.toggle('active', view === 'grid');
    document.getElementById('list-view-btn').classList.toggle('active', view === 'list');
  };

  /* ================================================================
     SECTION: features/pagination.js — Pagination Logic
  ================================================================ */
  function renderPagination() {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const container = document.getElementById('pagination');
    if (!container || totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        html += `<span class="page-ellipsis">…</span>`;
      }
    }
    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
  }

  window.goToPage = function (page) {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderCurrentPage();
    document.querySelector('#page-shop .shop-products')?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ================================================================
     SECTION: pages/home.js — Home Page with Animations
  ================================================================ */
  function populateHomePage() {
    const featured = [...products].sort(() => Math.random() - 0.5).slice(0, 8);
    renderProductGrid(featured, 'featured-products');

    const recent = [...products].slice(0, 4);
    renderProductGrid(recent, 'recent-products');

    const counts = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    
    Object.keys(counts).forEach(cat => {
      const el = document.getElementById(`cat-count-${cat}`);
      if (el) el.textContent = `${counts[cat]} item${counts[cat] !== 1 ? 's' : ''}`;
    });

    // Animate home page elements
    setTimeout(() => {
      const heroContent = document.querySelector('.hero-content');
      const categoryCards = document.querySelectorAll('.category-card');
      const trustItems = document.querySelectorAll('.trust-item');
      const stepCards = document.querySelectorAll('.step-card');

      if (heroContent) addAnimation(heroContent, 'fade-in-left');
      if (categoryCards.length) addStaggerAnimation(Array.from(categoryCards), 'fade-in-up', 80);
      if (trustItems.length) addStaggerAnimation(Array.from(trustItems), 'fade-in-up', 100);
      if (stepCards.length) addStaggerAnimation(Array.from(stepCards), 'fade-in-up', 120);
    }, 300);
  }

  /* ================================================================
     SECTION: pages/profile.js — Profile Page with Animations
  ================================================================ */
  async function renderProfilePage() {
    const container = document.getElementById('profile-content');
    if (!currentUser) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;" class="animate-fade-in">
          <i class="fas fa-user-lock" style="font-size:3rem;color:var(--text-muted);margin-bottom:16px;display:block;"></i>
          <h2>Login to view your profile</h2>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="showPage('login')">Sign In</button>
        </div>`;
      return;
    }

    const { data: profile, error } = await DB.from('profiles').select('*').eq('id', currentUser.id).single();
    if (error) return showToast('Error', 'Could not fetch profile.', 'error');

    const userListings = products.filter(p => p.seller_id === currentUser.id);
    const joinDate = new Date(currentUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    container.innerHTML = `
      <div class="profile-header animate-fade-in-down">
        <div class="profile-avatar">${(profile.username[0] || 'U').toUpperCase()}</div>
        <div class="profile-info">
          <div class="profile-name">${profile.username}</div>
          <div class="profile-joined"><i class="fas fa-calendar-alt"></i> Member since ${joinDate}</div>
        </div>
        <div class="profile-stats-row">
          <div class="pstat"><span>${userListings.length}</span><small>Listings</small></div>
          <div class="pstat"><span>${wishlist.length}</span><small>Saved</small></div>
          <div class="pstat"><span>${profile.rating.toFixed(1)}</span><small>Rating</small></div>
        </div>
      </div>
      <div class="profile-tabs animate-fade-in-up">
        <button class="profile-tab active" onclick="switchProfileTab(this, 'listings')">
          <i class="fas fa-tag"></i> My Listings
        </button>
        <button class="profile-tab" onclick="switchProfileTab(this, 'saved')">
          <i class="fas fa-heart"></i> Saved Items
        </button>
      </div>
      <div id="profile-tab-content"></div>`;

    switchProfileTab(container.querySelector('.profile-tab.active'), 'listings');
  }

  window.switchProfileTab = function (btn, tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('profile-tab-content');

    content.style.animation = 'fadeOut 0.2s ease-out';

    setTimeout(() => {
      switch (tab) {
        case 'listings':
          const userListings = products.filter(p => p.seller_id === currentUser.id);
          content.innerHTML = userListings.length > 0
            ? `<div class="product-grid animate-fade-in">${userListings.map(buildProductCard).join('')}</div>`
            : `<div style="text-align:center;padding:40px;color:var(--text-muted);" class="animate-fade-in">
                <i class="fas fa-tag" style="font-size:2rem;opacity:0.3;margin-bottom:12px;display:block;"></i>
                <h3>No listings yet</h3>
                <button class="btn btn-primary" style="margin-top:12px;" onclick="showPage('sell')">List an Item</button>
              </div>`;
          break;
        case 'saved':
          const saved = products.filter(p => wishlist.includes(p.id));
          content.innerHTML = saved.length > 0
            ? `<div class="product-grid animate-fade-in">${saved.map(buildProductCard).join('')}</div>`
            : `<div style="text-align:center;padding:40px;color:var(--text-muted);" class="animate-fade-in">
                <i class="fas fa-heart" style="font-size:2rem;opacity:0.3;margin-bottom:12px;display:block;"></i>
                <h3>No saved items</h3>
                <p>Click the heart on any item to save it.</p>
              </div>`;
          break;
      }
      content.style.animation = 'fadeIn 0.4s ease-out';
    }, 150);
  };

  /* ================================================================
     SECTION: features/ai-analysis.js — AI Product Analysis
  ================================================================ */
  window.analyzeProductWithAI = async function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (!geminiApiKey) {
      showToast('API key required', 'Please set up your Gemini API key.', 'warning');
      showPage('assistant');
      return;
    }

    lastAnalyzedProduct = product;
    showPage('assistant');

    const placeholder = document.getElementById('analysis-placeholder');
    const resultEl = document.getElementById('analysis-result');
    placeholder.style.display = 'flex';
    resultEl.style.display = 'none';

    try {
      const analysis = await getProductAnalysisFromAI(product);
      placeholder.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        placeholder.style.display = 'none';
        resultEl.style.display = 'flex';
        resultEl.style.animation = 'fadeIn 0.4s ease-out';
        resultEl.innerHTML = analysis;
      }, 300);
    } catch (err) {
      showToast('Analysis failed', err.message, 'error');
    }
  };

  async function getProductAnalysisFromAI(product) {
    const marketValue = product.msrp || estimateMarketValue(product);
    const priceRatio = product.price / marketValue;
    let dealScore = 100;
    let dealClass = 'deal-great';

    if (priceRatio > 1.5) {
      dealScore = 30;
      dealClass = 'deal-poor';
    } else if (priceRatio > 1.2) {
      dealScore = 50;
      dealClass = 'deal-fair';
    } else if (priceRatio > 1.0) {
      dealScore = 70;
      dealClass = 'deal-good';
    }

    const conditionLabel = {
      'new': 'Brand new',
      'like-new': 'Like new',
      'good': 'Good condition',
      'fair': 'Fair condition',
      'poor': 'For parts only'
    }[product.condition] || product.condition;

    return `
      <div class="analysis-product-header animate-fade-in-down">
        <div class="analysis-product-thumb" style="background:var(--primary-bg);color:var(--primary);">
          <i class="fas ${getCategoryIcon(product.category)}"></i>
        </div>
        <div class="analysis-product-title">
          <h3>${product.name}</h3>
          <p>${product.category}</p>
        </div>
        <div class="deal-score-badge ${dealClass} animate-scale-in">
          <span class="score-num">${dealScore}</span>
          SCORE
        </div>
      </div>
      <div class="analysis-sections animate-fade-in-up">
        <div class="analysis-section">
          <div class="analysis-section-title">
            <i class="fas fa-tag"></i> Market Value
          </div>
          <div class="analysis-body">
            <strong>Market Value:</strong> ${formatPrice(marketValue)}<br>
            <strong>Listed Price:</strong> ${formatPrice(product.price)}<br>
            <strong>Comparison:</strong> 
            ${priceRatio < 1 
              ? `<span class="highlight-good">✓ ${Math.round((1 - priceRatio) * 100)}% BELOW</span>` 
              : `<span class="highlight-bad">✗ ${Math.round((priceRatio - 1) * 100)}% ABOVE</span>`}
          </div>
        </div>
        <div class="analysis-section">
          <div class="analysis-section-title">
            <i class="fas fa-info-circle"></i> Details
          </div>
          <div class="analysis-body">
            <strong>Condition:</strong> ${conditionLabel}<br>
            <strong>Location:</strong> ${product.location || 'Not specified'}<br>
            <strong>Seller:</strong> ${product.seller} ${starsHTML(product.seller_rating)}
          </div>
        </div>
      </div>
    `;
  }

  function estimateMarketValue(product) {
    const baseValues = {
      'Electronics': 500,
      'Clothing & Accessories': 80,
      'Collectibles': 120,
      'Sports & Outdoors': 150,
      'Books & Media': 30,
      'Home & Garden': 100,
      'Vehicles': 5000,
      'Other': 100
    };

    let base = baseValues[product.category] || 100;
    const conditionMultiplier = {
      'new': 1.0,
      'like-new': 0.85,
      'good': 0.7,
      'fair': 0.55,
      'poor': 0.3
    }[product.condition] || 0.5;

    if (product.msrp) {
      base = product.msrp * conditionMultiplier;
    } else {
      base = base * conditionMultiplier;
    }

    return Math.round(base * 100) / 100;
  }

  window.switchAITab = function (tab) {
    document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    const chatContainer = document.getElementById('chat-container');
    const analysisPanel = document.getElementById('product-analysis-panel');

    if (tab === 'chat') {
      chatContainer.style.display = 'block';
      analysisPanel.style.display = 'none';
    } else {
      chatContainer.style.display = 'none';
      analysisPanel.style.display = 'block';
    }
  };

  /* ================================================================
     SECTION: app.js — Main App Navigation & Modal Functions
  ================================================================ */
  window.openProductModal = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const firstImage = product.images?.[0] || null;
    const conditionLabel = {
      'new': 'New',
      'like-new': 'Like New',
      'good': 'Good',
      'fair': 'Fair',
      'poor': 'For Parts'
    }[product.condition] || product.condition;

    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-product-content');

    content.innerHTML = `
      <div class="modal-img-col">
        ${firstImage
          ? `<img src="${firstImage}" alt="${product.name}" loading="lazy">`
          : `<i class="fas ${getCategoryIcon(product.category)}"></i>`}
      </div>
      <div class="modal-info-col">
        <div class="modal-badges animate-fade-in-down">
          ${product.is_fair
            ? `<span class="badge badge-fair"><i class="fas fa-shield-alt"></i> Fair Price</span>`
            : `<span class="badge badge-scalp"><i class="fas fa-exclamation-triangle"></i> Above MSRP</span>`}
        </div>
        <h2 class="modal-title animate-fade-in-down">${product.name}</h2>
        <div class="modal-price-row animate-fade-in-down">
          <span class="modal-price">${formatPrice(product.price)}</span>
          ${product.msrp ? `<span style="color:var(--text-muted);text-decoration:line-through;">MSRP ${formatPrice(product.msrp)}</span>` : ''}
        </div>
        <div class="modal-seller-info animate-fade-in-up">
          <div class="seller-avatar">${(product.seller[0] || 'U').toUpperCase()}</div>
          <div>
            <div style="color:var(--text);font-weight:700;font-size:0.9rem;">${product.seller}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${starsHTML(product.seller_rating)}</div>
          </div>
        </div>
        <div class="modal-desc animate-fade-in-up">${product.description}</div>
        <div class="modal-actions animate-fade-in-up">
          <button class="btn btn-primary btn-block" onclick="addToCart('${product.id}', null); closeProductModal();">
            <i class="fas fa-cart-plus"></i> Add to Cart
          </button>
          <button class="btn btn-outline btn-block" onclick="toggleWishlist('${product.id}', null)">
            <i class="fas fa-heart"></i> Save Item
          </button>
          <button class="btn btn-outline btn-block" onclick="closeProductModal(); analyzeProductWithAI('${product.id}');">
            <i class="fas fa-brain"></i> AI Analysis
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    modal.classList.add('animate-fade-in');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeProductModal();
    });
  };

  window.closeProductModal = function () {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('animate-fade-in');
    modal.classList.add('animate-fade-out');
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('animate-fade-out');
    }, 300);
  };

  window.showPage = function (pageId) {
    const currentActive = document.querySelector('.page-view.active');
    const nextPage = document.getElementById('page-' + pageId);

    if (currentActive && nextPage && currentActive !== nextPage) {
      currentActive.classList.remove('active');
      currentActive.style.animation = 'fadeOut 0.3s ease-out forwards';

      setTimeout(() => {
        nextPage.classList.add('active');
        nextPage.style.animation = 'fadeIn 0.4s ease-out';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
    } else if (nextPage) {
      nextPage.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    closeMobileMenu();

    if (pageId === 'profile') renderProfilePage();
    if (pageId === 'cart') renderCartPage();
    if (pageId === 'shop') applyFilters();
  };

  window.filterAndGoShop = function (category) {
    const radio = document.querySelector(`input[name="category-filter"][value="${category}"]`);
    if (radio) radio.checked = true;
    applyFilters();
    showPage('shop');
  };

  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');
  mobileMenuBtn?.addEventListener('click', () => navLinks.classList.toggle('open'));

  function closeMobileMenu() {
    navLinks?.classList.remove('open');
  }

  window.clearChat = function () {
    document.getElementById('chat-history').innerHTML = `
      <div class="chat-msg bot-msg animate-fade-in">
        <div class="chat-msg-avatar bot-avatar"><i class="fas fa-robot"></i></div>
        <div class="chat-msg-bubble">
          <p>Chat cleared. What can I help you with?</p>
        </div>
        <span class="chat-msg-time">Just now</span>
      </div>
    `;
  };

  window.sendMessageToBot = function () {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const history = document.getElementById('chat-history');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user-msg animate-fade-in-up';
    userMsg.innerHTML = `
      <div class="chat-msg-avatar user-avatar"><i class="fas fa-user"></i></div>
      <div class="chat-msg-bubble">${msg}</div>
      <span class="chat-msg-time">Just now</span>
    `;
    history.appendChild(userMsg);
    input.value = '';

    setTimeout(() => {
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-msg bot-msg animate-fade-in-up';
      botMsg.innerHTML = `
        <div class="chat-msg-avatar bot-avatar"><i class="fas fa-robot"></i></div>
        <div class="chat-msg-bubble">
          <p>That's a great question! I can help with pricing analysis, shipping estimates, or finding safe meetup spots. What would you like to know?</p>
        </div>
        <span class="chat-msg-time">Just now</span>
      `;
      history.appendChild(botMsg);
      history.scrollTop = history.scrollHeight;
    }, 600);

    history.scrollTop = history.scrollHeight;
  };

  window.sendSuggestedPrompt = function (btn) {
    document.getElementById('chat-input').value = btn.textContent;
    sendMessageToBot();
  };

  /* ================================================================
     SECTION: App Initialization & Setup
  ================================================================ */
  async function init() {
    await checkAuthSession();
    products = await fetchListings();
    filteredItems = [...products];

    updateCartCount();
    updateNavUI();
    populateHomePage();
    applyFilters();

    const initialPage = window.location.hash.replace('#', '') || 'home';
    showPage(initialPage);

    document.getElementById('footer-year').textContent = new Date().getFullYear();

    console.log(`✨ Obtainum Marketplace: ${products.length} listings loaded.`);
  }

  init().catch(console.error);
});
