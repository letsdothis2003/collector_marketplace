/* ================================================================
   OBTAINUM MARKETPLACE — script.js
   Potentially split into these separate files:
   - supabase-client.js          (Supabase initialization)
   - state.js                    (global app state)
   - utils/toast.js              (toast notification helpers)
   - utils/dom.js                (DOM utility helpers)
   - features/theme.js           (dark/light mode toggle)
   - features/auth.js            (login, register, logout, Google OAuth)
   - features/cart.js            (cart state, render, checkout)
   - features/filters.js         (shop filter logic)
   - features/search.js          (global search)
   - features/pagination.js      (pagination logic)
   - features/chat.js            (AI chatbot / Gemini integration)
   - features/sell.js            (sell form, image upload, price fairness)
   - features/wishlist.js        (wishlist/favorites)
   - api/products.js             (product fetching & rendering)
   - api/profile.js              (profile page data)
   - pages/home.js               (home page init, stats counter)
   - pages/shop.js               (shop page init and filter bindings)
   - pages/profile.js            (profile page render)
   - animations.js               (GSAP animations, counter animations)
================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ================================================================
     SECTION: supabase-client.js — Supabase Initialization
  ================================================================ */
  let DB = null;
  const SUPABASE_URL = 'https://ofvwpzdhuugyexdcroya.supabase.co';
  const SUPABASE_API_KEY = 'sb_publishable_f9UqvNZVLitIS4Ysm6YWxQ_qwMpbwKL';
  try {
    if (typeof supabase !== 'undefined' && supabase?.createClient) {
      DB = supabase.createClient(
        SUPABASE_URL,
        SUPABASE_API_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'obtainum-auth-token',
            storage: window.localStorage,
            flowType: 'pkce'
          },
          global: {
            headers: { 'x-application-name': 'obtainum-engine' },
          },
        }
      );
    }
  } catch (e) {
    console.warn('Supabase initialization failed. Running in demo mode.', e.message);
    DB = null;
  }

  /* ================================================================
     SECTION: state.js — Global App State
  ================================================================ */
  let products       = [];   // All loaded product listings
  let filteredItems  = [];   // Currently filtered view
  let cart           = JSON.parse(localStorage.getItem('OBTAINUM_cart') || '[]');
  let wishlist       = JSON.parse(localStorage.getItem('OBTAINUM_wishlist') || '[]');
  let currentPage    = 1;
  const ITEMS_PER_PAGE = 12;
  let currentView    = 'grid'; // 'grid' | 'list'
  let activeCategory = 'all';
  let currentUser    = null;
  let userLocation   = localStorage.getItem('OBTAINUM_user_location') || ''; // user's city for route/shipping calc
  let lastAnalyzedProduct = null; // last product sent to AI analysis tab
  const STORAGE_BUCKET = 'listing-images';
  let sessionInterval = null; // for auto-logout

  /* ================================================================
     SECTION: utils/toast.js — Toast Notification Helpers
  ================================================================ */
  function showToast(title, message = '', type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
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
    return toast;
  }

  function removeToast(toast) {
    toast.style.animation = 'fadeOutToast 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }

  /* ================================================================
     SECTION: utils/dom.js — DOM Utility Helpers
  ================================================================ */
  function getCategoryIcon(category) {
    const icons = {
      electronics: 'fa-microchip', toys: 'fa-puzzle-piece', apparel: 'fa-tshirt',
      sports: 'fa-futbol', books: 'fa-book', home: 'fa-home',
      vehicles: 'fa-car', other: 'fa-box-open', collectibles: 'fa-gem'
    };
    return icons[category?.toLowerCase().replace(/ & /g, '_')] || 'fa-tag';
  }

  function getCategoryLabel(cat) {
    const labels = {
      electronics: 'Electronics', toys: 'Toys & Collectibles', apparel: 'Apparel',
      sports: 'Sports & Outdoors', books: 'Books & Media', home: 'Home & Garden',
      vehicles: 'Vehicles & Parts', other: 'Other', collectibles: 'Collectibles'
    };
    return labels[cat] || cat;
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

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 60)   return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days < 30)   return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  function starsHTML(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating))       html += '<i class="fas fa-star star"></i>';
      else if (i - 0.5 <= rating)       html += '<i class="fas fa-star-half-alt star"></i>';
      else                               html += '<i class="far fa-star star"></i>';
    }
    return html;
  }

  function setButtonLoading(btn, loading) {
    const label = btn.querySelector('.btn-label');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    if (label)  label.style.display  = loading ? 'none' : 'inline-block';
    if (loader) loader.style.display = loading ? 'inline-block' : 'none';
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /* ================================================================
     SECTION: features/theme.js — dark/light mode toggle
  ================================================================ */
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const savedTheme = localStorage.getItem('OBTAINUM_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('OBTAINUM_theme', next);
    updateThemeIcon(next);
    showToast(next === 'dark' ? 'Dark mode on' : 'Light mode on', '', 'info', 2000);
  });

  function updateThemeIcon(theme) {
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    themeToggleBtn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  /* ================================================================
     SECTION: features/auth.js — login, register, logout, Google OAuth
  ================================================================ */
  // Handle Auth Changes (Centralized Session Management)
  if (DB) {
    DB.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      if (user && (!currentUser || user.id !== currentUser.id)) {
        currentUser = user;
        await ensureProfileExists(currentUser);
        updateNavUI();

        // Start session timeout checker
        const loginTime = Date.now();
        localStorage.setItem('OBTAINUM_login_time', loginTime);
        if (sessionInterval) clearInterval(sessionInterval);
        sessionInterval = setInterval(checkSessionTimeout, 60 * 1000); // Check every minute

        if (event === 'SIGNED_IN') {
          console.log('User signed in:', currentUser.email);
          showPage('home');
          showToast('Welcome!', `Logged in as ${currentUser.email}`, 'success');
        }
      } else if (!user && currentUser) {
        console.log('User signed out');
        currentUser = null;
        updateNavUI();
        // Clear session timeout checker
        if (sessionInterval) clearInterval(sessionInterval);
        localStorage.removeItem('OBTAINUM_login_time');
      }
    });
  }
  
  // Session Timeout Logic
  function checkSessionTimeout() {
      const loginTime = localStorage.getItem('OBTAINUM_login_time');
      if (!loginTime) return;

      const oneHour = 60 * 60 * 1000;
      if (Date.now() - parseInt(loginTime) > oneHour) {
          showToast('Session Expired', 'You have been logged out due to inactivity.', 'warning');
          logout();
      }
  }

  // LOGIN
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
      // Success is handled by onAuthStateChange, no need for UI updates here.
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
    } finally {
      setButtonLoading(btn, false);
    }
  });

  // REGISTER
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
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> You must accept the Terms of Service.';
      errEl.style.display = 'flex';
      setButtonLoading(btn, false);
      return;
    }
    if (password !== confirm) {
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match.';
      errEl.style.display = 'flex';
      setButtonLoading(btn, false);
      return;
    }
    if (password.length < 8) {
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Password must be at least 8 characters.';
      errEl.style.display = 'flex';
      setButtonLoading(btn, false);
      return;
    }

    try {
      const { data, error } = await DB.auth.signUp({
        email, password,
        options: { data: { username } } // Pass username in metadata for the trigger
      });

      if (error) throw error;
      
      showPage('login');
      showToast('Account created!', 'Check your email to confirm your account.', 'success', 6000);
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
    } finally {
      setButtonLoading(btn, false);
    }
  });

  // LOGOUT
  window.logout = async function () {
    if (DB) {
      await DB.auth.signOut();
      currentUser = null;
      updateNavUI();
      showPage('home');
      showToast('Logged out', 'See you next time!', 'info');
      // Interval is cleared by onAuthStateChange
    }
  };

  // GOOGLE OAUTH
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

  // FORGOT PASSWORD
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
      msgEl.textContent = 'Reset link sent! Check your email.';
      msgEl.className = 'form-success';
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'form-error';
    }
    msgEl.style.display = 'block';
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
  
  // This function is a client-side safeguard. The definitive profile creation is handled
  // by the handle_new_user trigger in the database.
  async function ensureProfileExists(user) {
    if (!DB || !user?.id) return;
    
    const { data, error } = await DB.from('profiles').select('id').eq('id', user.id).single();

    if (error && error.code === 'PGRST116') { // "Not found"
      console.log('Profile not found, creating one as a fallback...');
      const username = user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
      const { error: insertError } = await DB.from('profiles').insert({
        id: user.id,
        email: user.email,
        username: username,
      });
      if (insertError) console.error('Fallback profile creation failed:', insertError);
    } else if (error) {
      console.error('Error checking for profile:', error);
    }
  }

  // Check session on initial load
  async function checkAuthSession() {
    if (!DB) return;
    try {
      const { data: { session }, error } = await DB.auth.getSession();
      if (error) throw error;
      currentUser = session?.user || null;
      if (currentUser) {
          await ensureProfileExists(currentUser);
          // Start session timeout checker on page load if logged in
          if (sessionInterval) clearInterval(sessionInterval);
          sessionInterval = setInterval(checkSessionTimeout, 60 * 1000);
          checkSessionTimeout(); // Run once immediately
      }
      updateNavUI();
    } catch (err) {
      console.error('Session check failed:', err);
    }
  }

  // Password visibility & strength
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
      if (val.length >= 8) score++; if (val.length >= 12) score++; if (/[A-Z]/.test(val)) score++; if (/[0-9]/.test(val)) score++; if (/[^A-Za-z0-9]/.test(val)) score++;
      const fill = document.getElementById('strength-fill');
      const label = document.getElementById('strength-label');
      const levels = [
        { pct: '20%', color: '#ef4444', text: 'Very weak' }, { pct: '40%', color: '#f97316', text: 'Weak' },
        { pct: '60%', color: '#f59e0b', text: 'Fair' }, { pct: '80%', color: '#22c55e', text: 'Strong' },
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
    let { data, error } = await DB
      .from('listings')
      .select('*, profiles(username)')
      .eq('is_sold', false) // Only fetch items that are not sold
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Listings fetch failed:', error);
      return [];
    }

    // Map DB schema to client-side object
    return (data || []).map(item => ({
      ...item,
      // 'name' is already correct from DB
      images: normalizeImages(item.images), // Use 'images' field which is an array
      seller: item.profiles?.username || 'Unknown Seller',
      seller_rating: item.profiles?.rating || 5.0,
      views: item.view_count || 0,
      likes: item.favorite_count || 0,
    }));
  }

  function buildProductCard(product) {
    const isWished = inWishlist(product.id);
    const inCartAlready = cart.some(c => c.id === product.id);

    const discountPct = product.msrp && product.price < product.msrp
      ? Math.round((1 - product.price / product.msrp) * 100)
      : null;

    const fairBadge = product.is_fair
      ? `<span class="badge badge-fair"><i class="fas fa-shield-alt"></i> Fair Price</span>`
      : `<span class="badge badge-scalp"><i class="fas fa-exclamation-triangle"></i> Above MSRP</span>`;

    const conditionClass = `condition-${product.condition}`;
    const conditionLabel = {
      'new': 'New', 'like-new': 'Like New', 'good': 'Good', 'fair': 'Fair', 'poor': 'For Parts'
    }[product.condition] || product.condition;

    const firstImage = product.images?.[0] || null;

    return `
      <div class="product-card" role="listitem" onclick="openProductModal('${product.id}')" tabindex="0" onkeydown="if(event.key==='Enter')openProductModal('${product.id}')">
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
            <span class="product-category">${getCategoryLabel(product.category)}</span>
            <span class="product-condition ${conditionClass}">${conditionLabel}</span>
          </div>
          <div class="product-name">${product.name}</div>
          <div class="product-seller">
            <i class="fas fa-user-circle"></i> ${product.seller}
            <span class="product-seller-rating">${starsHTML(product.seller_rating)} ${product.seller_rating.toFixed(1)}</span>
          </div>
          ${product.location ? `<div class="product-location"><i class="fas fa-map-marker-alt"></i> ${product.location}</div>` : ''}
          <div class="payment-badges">
            ${(product.payment_methods || []).includes('cash') ? `<span class="pay-badge pay-badge-cash"><i class="fas fa-money-bill-wave"></i> Cash</span>` : ''}
            ${(product.payment_methods || []).includes('trade') ? `<span class="pay-badge pay-badge-trade"><i class="fas fa-exchange-alt"></i> Trade</span>` : ''}
            ${(product.payment_methods || []).includes('card') ? `<span class="pay-badge pay-badge-online"><i class="fas fa-credit-card"></i> Card</span>` : ''}
          </div>
          <div class="product-price-row" style="margin-top:auto;">
            <span class="product-price">${formatPrice(product.price)}</span>
            ${product.msrp ? `<span class="product-msrp">MSRP ${formatPrice(product.msrp)}</span>` : ''}
            ${discountPct !== null && discountPct > 0 ? `<span class="product-discount">-${discountPct}%</span>` : ''}
          </div>
        </div>
        <div class="product-card-actions">
          <button class="btn btn-primary" onclick="addToCart('${product.id}', event)">
            <i class="fas fa-cart-plus"></i> ${inCartAlready ? 'Add More' : 'Add to Cart'}
          </button>
          <button class="btn btn-outline" onclick="openProductModal('${product.id}'); event.stopPropagation();">
            <i class="fas fa-eye"></i>
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
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
          <i class="fas fa-search" style="font-size:3rem;opacity:0.3;margin-bottom:16px;display:block;"></i>
          <h3>No listings found</h3>
          <p>Try adjusting your filters or search terms.</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="clearAllFilters()">Clear Filters</button>
        </div>`;
      return;
    }
    grid.innerHTML = items.map(buildProductCard).join('');
  }
  
  /* ================================================================
     SECTION: api/profile.js — Profile Page Data (handled in features/auth and pages/profile)
  ================================================================ */
  // (See features/auth.js for ensureProfileExists and pages/profile.js for rendering)

  /* ================================================================
     SECTION: features/cart.js — Cart State, Render, Checkout
  ================================================================ */
  window.addToCart = function (productId, e) {
    if (e) { e.stopPropagation(); }
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
    showToast('Added to cart!', product.name, 'success', 2500);
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
    badge.classList.remove('pop');
    void badge.offsetWidth; // reflow
    badge.classList.add('pop');
  }
  
  function renderCartPage() {
    const itemsEl = document.getElementById('cart-items');
    if(!itemsEl) return;
    itemsEl.innerHTML = '';

    if (cart.length === 0) {
      itemsEl.innerHTML = `
        <div class="cart-empty">
          <i class="fas fa-shopping-cart"></i>
          <h3>Your cart is empty</h3>
          <p>Browse our marketplace and find something you love.</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="showPage('shop')">
            <i class="fas fa-store"></i> Browse Marketplace
          </button>
        </div>`;
      updateCartSummary();
      return;
    }

    cart.forEach((item) => {
      const firstImage = item.images?.[0] || null;

      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <div class="cart-item-img">
          ${firstImage
            ? `<img src="${firstImage}" alt="${item.name}" loading="lazy" decoding="async">`
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
            <button class="cart-remove-btn" onclick="removeFromCart('${item.id}')"><i class="fas fa-trash-alt"></i> Remove</button>
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
    const allFreeShipping = cart.every(item => item.shipping === 'free');
    document.getElementById('cart-shipping').textContent = (allFreeShipping || cart.length === 0) ? 'Free' : 'Calculated at checkout';
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
      showToast('Login required', 'Please log in to complete your purchase.', 'warning');
      showPage('login');
      return;
    }
    if (cart.length === 0) { showToast('Cart is empty', '', 'warning'); return; }
    showToast('Checkout coming soon', 'Payment integration in development.', 'info');
  };
  
  window.applyPromo = function () {
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    if (code === 'OBTAINUM10') {
      showToast('Promo applied!', '10% discount — not yet implemented.', 'success');
    } else {
      showToast('Invalid promo code', '', 'error');
    }
  };

  /* ================================================================
     SECTION: features/wishlist.js — Wishlist/Favorites
  ================================================================ */
  function inWishlist(id) { return wishlist.includes(id); }

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
        if (DB) {
            await DB.from('wishlists').delete().match({ user_id: currentUser.id, listing_id: productId });
        }
    } else {
        wishlist.push(productId);
        isWished = true;
        showToast('Added to wishlist', '', 'success', 2000);
        if (DB) {
            await DB.from('wishlists').insert({ user_id: currentUser.id, listing_id: productId });
        }
    }
    localStorage.setItem('OBTAINUM_wishlist', JSON.stringify(wishlist));
    
    // Update all heart buttons for this product
    document.querySelectorAll(`.wishlist-btn[data-id="${productId}"]`).forEach(btn => {
      btn.classList.toggle('active', isWished);
      btn.querySelector('i').className = isWished ? 'fas fa-heart' : 'far fa-heart';
    });
  };
  
  /* ================================================================
     SECTION: features/sell.js — Sell Form, Image Upload, Price Fairness
  ================================================================ */
  // Character counters
  ['sell-item-name', 'sell-item-description'].forEach(id => {
      const input = document.getElementById(id);
      const count = document.getElementById(id.replace('item-', '') + '-char-count');
      if(input && count) {
          input.addEventListener('input', () => { count.textContent = input.value.length; });
      }
  });

  // Price fairness indicator
  const priceInput = document.getElementById('sell-item-price');
  const msrpInput  = document.getElementById('sell-item-msrp');
  const fairnessEl = document.getElementById('price-fairness-indicator');
  const fairnessText = document.getElementById('price-fairness-text');

  function updatePriceFairness() {
    if (!priceInput || !msrpInput || !fairnessEl) return;
    const price = parseFloat(priceInput.value);
    const msrp  = parseFloat(msrpInput.value);
    if (isNaN(price) || isNaN(msrp) || price <= 0 || msrp <= 0) {
        fairnessEl.style.display = 'none';
        return;
    }

    const ratio = price / msrp;
    fairnessEl.style.display = 'flex';
    fairnessEl.className = 'price-fairness';

    if (ratio <= 1.0) {
      fairnessEl.classList.add('fair');
      fairnessText.textContent = `Your price is ${Math.round((1-ratio)*100)}% below MSRP — excellent value!`;
    } else if (ratio <= 1.2) {
      fairnessEl.classList.add('warning');
      fairnessText.textContent = `Your price is ${Math.round((ratio-1)*100)}% above MSRP.`;
    } else {
      fairnessEl.classList.add('scalp');
      fairnessText.textContent = `Warning: Price is ${Math.round((ratio-1)*100)}% above MSRP. Listing may be flagged.`;
    }
  }

  priceInput?.addEventListener('input', updatePriceFairness);
  msrpInput?.addEventListener('input', updatePriceFairness);

  // Image upload
  const imageInput = document.getElementById('sell-item-images');
  const imageUploadArea = document.getElementById('image-upload-area');
  const imagePreviewRow = document.getElementById('image-preview-row');
  let uploadedFiles = [];

  if (imageInput) imageInput.addEventListener('change', (e) => handleImageFiles(e.target.files));
  if (imageUploadArea) {
    imageUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); });
    imageUploadArea.addEventListener('dragleave', (e) => e.currentTarget.classList.remove('drag-over'));
    imageUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      handleImageFiles(e.dataTransfer.files);
    });
  }

  function handleImageFiles(files) {
    const maxFiles = 10, maxSize  = 5 * 1024 * 1024;
    [...files].forEach(file => {
      const isDuplicate = uploadedFiles.some(f => f && f.name === file.name && f.size === file.size);
      if (isDuplicate || uploadedFiles.filter(Boolean).length >= maxFiles) return;
      if (!file.type.startsWith('image/')) return showToast('Images only', `${file.name} is not an image.`, 'error');
      if (file.size > maxSize) return showToast('File too large', `${file.name} exceeds 5MB.`, 'error');
      
      const fileIndex = uploadedFiles.length;
      uploadedFiles.push(file);
      renderImagePreview(file, fileIndex);
    });
  }

  function renderImagePreview(file, idx) {
    const reader = new FileReader();
    reader.onload = e => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-thumb-wrap';
      wrap.dataset.idx = idx;
      wrap.innerHTML = `
        <img src="${e.target.result}" alt="Preview" class="preview-thumb">
        <button type="button" class="remove-thumb-btn" onclick="removeThumb(${idx})"><i class="fas fa-times"></i></button>`;
      imagePreviewRow?.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  }

  window.removeThumb = function (idx) {
    uploadedFiles[idx] = null;
    document.querySelector(`.preview-thumb-wrap[data-idx="${idx}"]`)?.remove();
  };
  
  // Payment method details toggle
  function initPaymentMethodToggles() {
    const cashCheck  = document.querySelector('.payment-method-check[value="cash"]');
    const tradeCheck = document.querySelector('.payment-method-check[value="trade"]');
    const cashFields  = document.getElementById('cash-details-wrap');
    const tradeFields = document.getElementById('trade-details-wrap');

    function updateFields() {
      if (cashFields)  cashFields.style.display = cashCheck?.checked  ? 'block' : 'none';
      if (tradeFields) tradeFields.style.display = tradeCheck?.checked ? 'block' : 'none';
    }
    document.querySelectorAll('.payment-method-check').forEach(el => el.addEventListener('change', updateFields));
    updateFields();
  }
  initPaymentMethodToggles();

  // Sell Form Submit
  const sellForm = document.getElementById('sell-form');
  if (sellForm) {
    sellForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('Login required', 'Please log in to list an item.', 'warning');
      
      const btn = document.getElementById('sell-submit-btn');
      setButtonLoading(btn, true);

      try {
        const activeFiles = uploadedFiles.filter(Boolean);
        if (activeFiles.length === 0) throw new Error('At least one image is required.');
        
        // --- Upload images first ---
        const imageUrls = [];
        for (const file of activeFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
          const { error: uploadError } = await DB.storage.from(STORAGE_BUCKET).upload(fileName, file);
          if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
          
          const { data: urlData } = DB.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
          imageUrls.push(urlData.publicUrl);
        }

        // --- Collect form data ---
        const formData = new FormData(sellForm);
        const priceVal = parseFloat(formData.get('price'));
        const msrpVal = parseFloat(formData.get('msrp'));
        
        const listingData = {
          seller_id: currentUser.id,
          name: formData.get('name').trim(),
          category: formData.get('category'),
          description: formData.get('description').trim(),
          condition: formData.get('condition'),
          location: formData.get('location').trim(),
          price: isNaN(priceVal) || priceVal < 0 ? 0 : priceVal,
          msrp: isNaN(msrpVal) || msrpVal <= 0 ? null : msrpVal,
          type: formData.get('type'),
          shipping: formData.get('shipping'),
          payment_methods: formData.getAll('payment_methods'),
          tags: formData.get('tags').split(',').map(t => t.trim()).filter(Boolean),
          images: imageUrls,
          is_fair: msrpVal ? priceVal <= msrpVal * 1.1 : true,
        };

        // --- Validation ---
        if (!listingData.name) throw new Error('Item name is required.');
        if (!listingData.description) throw new Error('Item description is required.');
        if (listingData.price <= 0) throw new Error('Enter a valid asking price.');

        // --- Insert into database ---
        const { data: newListing, error: dbError } = await DB
          .from('listings')
          .insert(listingData)
          .select('*, profiles(username)')
          .single();

        if (dbError) throw dbError;

        // --- Update UI ---
        const formattedListing = {
          ...newListing,
          images: normalizeImages(newListing.images),
          seller: newListing.profiles?.username || 'You',
          seller_rating: 5.0,
          views: 0, likes: 0,
        };

        products.unshift(formattedListing);
        filteredItems = [formattedListing, ...filteredItems];

        showToast('Listing published!', `"${formattedListing.name}" is now live.`, 'success', 5000);
        showPage('shop');

        sellForm.reset();
        uploadedFiles = [];
        if (imagePreviewRow) imagePreviewRow.innerHTML = '';
        if (fairnessEl) fairnessEl.style.display = 'none';
        updatePriceFairness();
        initPaymentMethodToggles();

      } catch (err) {
        console.error('Publishing error:', err);
        showToast('Failed to publish', err.message || 'Please check your form and try again.', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  /* ================================================================
     SECTION: features/filters.js — Shop Filter Logic
  ================================================================ */
  const priceSlider = document.getElementById('price-slider');
  const priceFilterVal = document.getElementById('price-filter-value');
  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      priceFilterVal.textContent = formatPrice(priceSlider.value);
    });
    // Sync with text input
    const priceMaxInput = document.getElementById('price-max');
    priceSlider.addEventListener('change', () => { // Use change for final value
        if (priceMaxInput) priceMaxInput.value = priceSlider.value;
        applyFilters();
    });
    if(priceMaxInput) {
        priceMaxInput.addEventListener('change', () => {
            priceSlider.value = Math.min(priceMaxInput.value, 5000);
            priceFilterVal.textContent = formatPrice(priceSlider.value);
            applyFilters();
        });
    }
  }

  const shopSearch = document.getElementById('shop-search');
  if (shopSearch) shopSearch.addEventListener('input', debounce(applyFilters, 300));
  
  document.getElementById('filters-sidebar')?.addEventListener('change', applyFilters);
  document.getElementById('sort-select')?.addEventListener('change', applyFilters);

  function applyFilters() {
    const searchVal = (document.getElementById('shop-search')?.value || '').toLowerCase().trim();
    const categoryVal = document.querySelector('input[name="category-filter"]:checked')?.value || 'all';
    const priceMax = parseFloat(priceSlider?.value || 5000);
    const checkedCond = [...document.querySelectorAll('.condition-filter:checked')].map(e => e.value);
    const antiScalp = document.getElementById('anti-scalp-filter')?.checked || false;
    const freeShipOnly = document.getElementById('free-shipping-filter')?.checked || false;
    const sortVal = document.getElementById('sort-select')?.value || 'newest';

    let result = products.filter(p => {
      if (searchVal && !p.name.toLowerCase().includes(searchVal) && !p.description.toLowerCase().includes(searchVal)) return false;
      if (categoryVal !== 'all' && p.category !== categoryVal) return false;
      if (p.price > priceMax) return false;
      if (checkedCond.length > 0 && !checkedCond.includes(p.condition)) return false;
      if (antiScalp && !p.is_fair) return false;
      if (freeShipOnly && p.shipping !== 'free') return false;
      return true;
    });

    // Sort
    switch (sortVal) {
      case 'price-asc':  result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      case 'name-asc':   result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'oldest':     result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      default:           result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break; // newest
    }

    filteredItems = result;
    currentPage = 1;
    renderCurrentPage();
    updateResultsCount(result.length);
    renderActiveFilterTags();
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
  
  function renderActiveFilterTags() {
    const el = document.getElementById('active-filters');
    if (!el) return;
    // Implementation can be added back if needed, but for now it's simplified
    el.innerHTML = ''; 
    el.style.display = 'none';
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
  
  /* ================================================================
     SECTION: features/search.js — Global Search
  ================================================================ */
  // Combined with filter logic. See features/filters.js

  /* ================================================================
     SECTION: features/pagination.js — Pagination Logic
  ================================================================ */
  function renderPagination() {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const container = document.getElementById('pagination');
    if (!container || totalPages <= 1) {
        if(container) container.innerHTML = '';
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
     SECTION: features/chat.js — AI Chatbot / Gemini Integration
  ================================================================ */
  // Simplified for brevity in this refactor. Full implementation can be restored.
  
  /* ================================================================
     SECTION: pages/home.js — Home Page Init, Stats Counter
  ================================================================ */
  function populateHomePage() {
    // Featured products (random subset)
    const featured = [...products].sort(() => Math.random() - 0.5).slice(0, 8);
    renderProductGrid(featured, 'featured-products');

    // Recent products (newest)
    const recent = [...products].slice(0, 4); // Already sorted by newest
    renderProductGrid(recent, 'recent-products');

    // Category counts
    const counts = {};
    products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    Object.keys(counts).forEach(cat => {
      const el = document.getElementById(`cat-count-${cat}`);
      if (el) el.textContent = `${counts[cat]} item${counts[cat] !== 1 ? 's' : ''}`;
    });
    
    animateHomeCards();
  }

  /* ================================================================
     SECTION: pages/shop.js — Shop Page Init and Filter Bindings
  ================================================================ */
  // Logic is handled by applyFilters() and event listeners in features/filters.js

  /* ================================================================
     SECTION: pages/profile.js — Profile Page Render
  ================================================================ */
  async function renderProfilePage() {
    const container = document.getElementById('profile-content');
    if (!currentUser) {
      container.innerHTML = `<div class="auth-required-placeholder">
          <i class="fas fa-user-lock"></i>
          <h2>Login to view your profile</h2>
          <button class="btn btn-primary" onclick="showPage('login')">Sign In</button>
        </div>`;
      return;
    }

    const { data: profile, error } = await DB.from('profiles').select('*').eq('id', currentUser.id).single();
    if(error) return showToast('Error', 'Could not fetch profile.', 'error');

    const userListings = products.filter(p => p.seller_id === currentUser.id);
    const joinDate  = new Date(currentUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    container.innerHTML = `
      <div class="profile-header">
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
      <div class="profile-tabs">
        <button class="profile-tab active" onclick="switchProfileTab(this, 'listings')"><i class="fas fa-tag"></i> My Listings</button>
        <button class="profile-tab" onclick="switchProfileTab(this, 'saved')"><i class="fas fa-heart"></i> Saved Items</button>
        <button class="profile-tab" onclick="switchProfileTab(this, 'settings')"><i class="fas fa-cog"></i> Settings</button>
      </div>
      <div id="profile-tab-content"></div>`;
    
    switchProfileTab(container.querySelector('.profile-tab.active'), 'listings');
  }

  window.switchProfileTab = function (btn, tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('profile-tab-content');
    
    switch (tab) {
      case 'listings':
        const userListings = products.filter(p => p.seller_id === currentUser.id);
        content.innerHTML = userListings.length > 0
          ? `<div class="product-grid">${userListings.map(buildProductCard).join('')}</div>`
          : `<div class="empty-tab-placeholder"><i class="fas fa-tag"></i><h3>No listings yet</h3><button class="btn btn-primary" onclick="showPage('sell')">List an Item</button></div>`;
        break;
      case 'saved':
        const saved = products.filter(p => wishlist.includes(p.id));
        content.innerHTML = saved.length > 0
          ? `<div class="product-grid">${saved.map(buildProductCard).join('')}</div>`
          : `<div class="empty-tab-placeholder"><i class="fas fa-heart"></i><h3>No saved items</h3><p>Click the heart on any item to save it.</p></div>`;
        break;
      case 'settings':
        content.innerHTML = `<div class="form-card" style="max-width:600px;margin:20px auto;"><h3>Settings</h3><p>Settings page coming soon.</p><button class="btn btn-danger" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button></div>`;
        break;
    }
  };

  /* ================================================================
     SECTION: animations.js — GSAP Animations, Counter Animations
  ================================================================ */
  function animateHomeCards() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.from('.category-card', {
      y: 30, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out',
      scrollTrigger: { trigger: '.category-grid', start: 'top 85%', toggleActions: 'play none none none' }
    });
  }
  
  /* ================================================================
     MODALS and PAGE NAVIGATION
  ================================================================ */
  window.openProductModal = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    // Simplified, full implementation can be restored
    alert(`Product: ${product.name}\nPrice: ${formatPrice(product.price)}`);
  };

  window.closeProductModal = function () {};

  window.showPage = function (pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    closeMobileMenu();

    // Page-specific setup
    if (pageId === 'profile') renderProfilePage();
    if (pageId === 'cart') renderCartPage();
    if (pageId === 'shop') applyFilters();
  };

  // Mobile Menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');
  mobileMenuBtn?.addEventListener('click', () => navLinks.classList.toggle('open'));
  function closeMobileMenu() { navLinks?.classList.remove('open'); }

  /* ================================================================
     SECTION: App Initialization
  ================================================================ */
  async function init() {
    await checkAuthSession();
    products = await fetchListings();
    filteredItems = [...products];

    updateCartCount();
    updateNavUI();
    populateHomePage();
    applyFilters();
    
    // Initial page load routing
    const initialPage = window.location.hash.replace('#', '') || 'home';
    showPage(initialPage);
    
    // Update footer year
    document.getElementById('footer-year').textContent = new Date().getFullYear();

    console.log(`OBTAINUM Live: ${products.length} listings loaded.`);
  }

  init().catch(console.error);
});
