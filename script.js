/* ================================================================
   OBTAINIUM MARKETPLACE — script.js
   Organization: Each section can be split into its own file later
================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ================================================================
     SECTION: supabase-client.js
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
    console.warn('Supabase init failed:', e.message);
    DB = null;
  }

  /* ================================================================
     SECTION: state.js
  ================================================================ */
  let products = [];
  let filteredItems = [];
  let cart = JSON.parse(localStorage.getItem('OBTAINUM_cart') || '[]');
  let wishlist = JSON.parse(localStorage.getItem('OBTAINUM_wishlist') || '[]');
  let currentPage = 1;
  const ITEMS_PER_PAGE = 12;
  let currentView = 'grid';
  let currentUser = null;
  let sessionInterval = null;

  /* ================================================================
     SECTION: utils/toast.js
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
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-msg">${message}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    setTimeout(() => removeToast(toast), duration);
  }

  function removeToast(toast) {
    toast.style.animation = 'fadeOutToast 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }

  /* ================================================================
     SECTION: utils/dom.js
  ================================================================ */
  function getCategoryIcon(category) {
    const icons = {
      'Electronics': 'fa-microchip',
      'Clothing & Accessories': 'fa-tshirt',
      'Collectibles': 'fa-gem',
      'Books & Media': 'fa-book',
      'Home & Garden': 'fa-home',
      'Sports & Outdoors': 'fa-futbol',
      'Vehicles': 'fa-car',
      'Other': 'fa-box-open'
    };
    return icons[category] || 'fa-tag';
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

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /* ================================================================
     SECTION: features/theme.js
  ================================================================ */
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const savedTheme = localStorage.getItem('OBTAINUM_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('OBTAINUM_theme', next);
    updateThemeIcon(next);
    showToast(next === 'dark' ? 'Dark mode' : 'Light mode', '', 'info', 2000);
  });

  function updateThemeIcon(theme) {
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    themeToggle.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }

  /* ================================================================
     SECTION: features/auth.js
  ================================================================ */
  if (DB) {
    DB.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      if (user && (!currentUser || user.id !== currentUser.id)) {
        currentUser = user;
        await ensureProfileExists(currentUser);
        updateNavUI();
        if (event === 'SIGNED_IN') {
          showToast('Welcome!', `Logged in as ${currentUser.email}`, 'success');
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
    if (!DB) return showToast('Error', 'Database not configured.', 'error');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    try {
      const { error } = await DB.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
    }
  });

  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!DB) return showToast('Error', 'Database not configured.', 'error');

    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const username = document.getElementById('register-username').value.trim();
    const terms = document.getElementById('register-terms').checked;
    const errEl = document.getElementById('register-error');

    if (!terms) {
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Accept Terms.';
      errEl.style.display = 'flex';
      return;
    }

    if (password !== confirm) {
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords don\'t match.';
      errEl.style.display = 'flex';
      return;
    }

    try {
      const { error } = await DB.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
      if (error) throw error;
      showPage('login');
      showToast('Account created!', 'Check your email to confirm.', 'success', 6000);
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
    }
  });

  window.logout = async function () {
    if (DB) await DB.auth.signOut();
    currentUser = null;
    updateNavUI();
    showPage('home');
    showToast('Logged out', '', 'info');
  };

  window.loginWithGoogle = async function () {
    if (!DB) return showToast('Error', 'Database not configured.', 'error');
    try {
      await DB.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });
    } catch (err) {
      showToast('OAuth Error', err.message, 'error');
    }
  };

  function updateNavUI() {
    document.getElementById('login-link').style.display = currentUser ? 'none' : 'flex';
    document.getElementById('logout-link').style.display = currentUser ? 'flex' : 'none';
    document.getElementById('profile-link').style.display = currentUser ? 'flex' : 'none';
    document.querySelector('.nav-link[data-page="sell"]').style.display = currentUser ? 'flex' : 'none';
  }

  async function ensureProfileExists(user) {
    if (!DB || !user?.id) return;
    const { error } = await DB.from('profiles').select('id').eq('id', user.id).single();
    if (error && error.code === 'PGRST116') {
      const username = user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
      await DB.from('profiles').insert({ id: user.id, email: user.email, username });
    }
  }

  async function checkAuthSession() {
    if (!DB) return;
    try {
      const { data: { session } } = await DB.auth.getSession();
      currentUser = session?.user || null;
      if (currentUser) await ensureProfileExists(currentUser);
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

  /* ================================================================
     SECTION: api/products.js
  ================================================================ */
  async function fetchListings() {
    if (!DB) return [];
    const { data, error } = await DB
      .from('listings')
      .select('*, profiles(username, rating)')
      .eq('is_sold', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch failed:', error);
      return [];
    }

    return (data || []).map(item => ({
      ...item,
      images: normalizeImages(item.images),
      seller: item.profiles?.username || 'Unknown',
      seller_rating: item.profiles?.rating || 0,
    }));
  }

  function buildProductCard(product) {
    const inCart = cart.some(c => c.id === product.id);
    const inWish = wishlist.includes(product.id);
    const firstImage = product.images?.[0] || null;

    const discountPct = product.msrp && product.price < product.msrp
      ? Math.round((1 - product.price / product.msrp) * 100)
      : null;

    const conditionLabel = {
      'new': 'New',
      'like-new': 'Like New',
      'good': 'Good',
      'fair': 'Fair',
      'poor': 'For Parts'
    }[product.condition] || product.condition;

    return `
      <div class="product-card" role="listitem" onclick="openProductModal('${product.id}')">
        <div class="product-card-img">
          ${firstImage ? `<img src="${firstImage}" alt="${product.name}" loading="lazy">` : `<i class="fas ${getCategoryIcon(product.category)}"></i>`}
          <div class="product-card-badges">
            ${product.is_fair ? `<span class="badge badge-fair"><i class="fas fa-shield-alt"></i> Fair</span>` : `<span class="badge badge-scalp">Above MSRP</span>`}
          </div>
          <button class="wishlist-btn ${inWish ? 'active' : ''}" onclick="toggleWishlist('${product.id}', event)">
            <i class="${inWish ? 'fas' : 'far'} fa-heart"></i>
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
          <i class="fas fa-search" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:16px;"></i>
          <h3>No listings found</h3>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="clearAllFilters()">Clear Filters</button>
        </div>`;
      return;
    }
    grid.innerHTML = items.map(buildProductCard).join('');
  }

  /* ================================================================
     SECTION: features/cart.js
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
    showToast('Added to cart!', product.name, 'success', 2500);
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

  function renderCartPage() {
    const itemsEl = document.getElementById('cart-items');
    if (!itemsEl) return;
    itemsEl.innerHTML = '';

    if (cart.length === 0) {
      itemsEl.innerHTML = `
        <div class="cart-empty">
          <i class="fas fa-shopping-cart"></i>
          <h3>Your cart is empty</h3>
          <button class="btn btn-primary" onclick="showPage('shop')">Browse Marketplace</button>
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
          ${firstImage ? `<img src="${firstImage}" alt="${item.name}" loading="lazy">` : `<i class="fas ${getCategoryIcon(item.category)}"></i>`}
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
            <button class="cart-remove-btn" onclick="removeFromCart('${item.id}')"><i class="fas fa-trash"></i></button>
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
    showToast('Checkout', 'Payment processing coming soon.', 'info');
  };

  /* ================================================================
     SECTION: features/wishlist.js
  ================================================================ */
  window.toggleWishlist = async function (productId, e) {
    if (e) e.stopPropagation();
    if (!currentUser) {
      showToast('Login required', 'Please log in to save items.', 'warning');
      showPage('login');
      return;
    }

    const idx = wishlist.indexOf(productId);
    if (idx >= 0) {
      wishlist.splice(idx, 1);
      if (DB) await DB.from('wishlists').delete().match({ user_id: currentUser.id, listing_id: productId });
      showToast('Removed from wishlist', '', 'info', 2000);
    } else {
      wishlist.push(productId);
      if (DB) await DB.from('wishlists').insert({ user_id: currentUser.id, listing_id: productId });
      showToast('Added to wishlist', '', 'success', 2000);
    }
    localStorage.setItem('OBTAINUM_wishlist', JSON.stringify(wishlist));

    document.querySelectorAll(`.wishlist-btn[data-id="${productId}"]`).forEach(btn => {
      btn.classList.toggle('active', wishlist.includes(productId));
      btn.querySelector('i').className = wishlist.includes(productId) ? 'fas fa-heart' : 'far fa-heart';
    });
  };

  /* ================================================================
     SECTION: features/sell.js
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
    fairnessEl.className = 'price-fairness';

    if (ratio <= 1.0) {
      fairnessEl.classList.add('fair');
      fairnessEl.textContent = `${Math.round((1-ratio)*100)}% below MSRP — great value!`;
    } else if (ratio <= 1.2) {
      fairnessEl.classList.add('warning');
      fairnessEl.textContent = `${Math.round((ratio-1)*100)}% above MSRP.`;
    } else {
      fairnessEl.classList.add('scalp');
      fairnessEl.textContent = `${Math.round((ratio-1)*100)}% above MSRP — may be flagged.`;
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

  const sellForm = document.getElementById('sell-form');
  if (sellForm) {
    sellForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) {
        showToast('Login required', 'Please log in to list an item.', 'warning');
        return;
      }

      const btn = document.getElementById('sell-submit-btn');
      btn.disabled = true;

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

        const listingData = {
          seller_id: currentUser.id,
          name: document.getElementById('sell-name').value.trim(),
          category: document.getElementById('sell-category').value,
          description: document.getElementById('sell-description').value.trim(),
          condition: document.getElementById('sell-condition').value,
          location: document.getElementById('sell-location').value.trim() || null,
          price: parseFloat(document.getElementById('sell-price').value),
          msrp: parseFloat(document.getElementById('sell-msrp').value) || null,
          type: 'buy-now',
          shipping: 'paid',
          payment_methods: [...document.querySelectorAll('.payment-method-check:checked')].map(e => e.value),
          tags: [],
          images: imageUrls,
          is_fair: true,
        };

        if (!listingData.name) throw new Error('Item name is required.');
        if (listingData.price <= 0) throw new Error('Enter a valid price.');
        if (listingData.payment_methods.length === 0) throw new Error('Select at least one payment method.');

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
        };

        products.unshift(formattedListing);
        filteredItems.unshift(formattedListing);

        showToast('Listing published!', `"${formattedListing.name}" is now live.`, 'success', 5000);
        showPage('shop');

        sellForm.reset();
        uploadedFiles = [];
        imagePreviewRow.innerHTML = '';
        fairnessEl.style.display = 'none';

      } catch (err) {
        console.error('Publishing error:', err);
        showToast('Failed to publish', err.message || 'Check your form and try again.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ================================================================
     SECTION: features/filters.js
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
    const categoryVal = document.querySelector('input[name="category-filter"]:checked')?.value || 'all';
    const priceMax = parseFloat(priceSlider?.value || 5000);
    const checkedCond = [...document.querySelectorAll('.condition-filter:checked')].map(e => e.value);
    const antiScalp = document.getElementById('anti-scalp-filter')?.checked || false;
    const sortVal = document.getElementById('sort-select')?.value || 'newest';

    let result = products.filter(p => {
      if (searchVal && !p.name.toLowerCase().includes(searchVal) && !p.description.toLowerCase().includes(searchVal)) return false;
      if (categoryVal !== 'all' && p.category !== categoryVal) return false;
      if (p.price > priceMax) return false;
      if (checkedCond.length > 0 && !checkedCond.includes(p.condition)) return false;
      if (antiScalp && !p.is_fair) return false;
      return true;
    });

    switch (sortVal) {
      case 'price-asc': result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
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
     SECTION: features/pagination.js
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
        html += `<span>…</span>`;
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
    document.querySelector('.shop-products')?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ================================================================
     SECTION: pages/home.js
  ================================================================ */
  function populateHomePage() {
    const featured = [...products].sort(() => Math.random() - 0.5).slice(0, 8);
    renderProductGrid(featured, 'featured-products');

    const recent = [...products].slice(0, 4);
    renderProductGrid(recent, 'recent-products');
  }

  /* ================================================================
     SECTION: pages/profile.js
  ================================================================ */
  async function renderProfilePage() {
    const container = document.getElementById('profile-content');
    if (!currentUser) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <i class="fas fa-user-lock" style="font-size:3rem;color:var(--text-muted);display:block;margin-bottom:16px;"></i>
          <h2>Login to view your profile</h2>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="showPage('login')">Sign In</button>
        </div>`;
      return;
    }

    const { data: profile } = await DB.from('profiles').select('*').eq('id', currentUser.id).single();
    const userListings = products.filter(p => p.seller_id === currentUser.id);

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${(profile?.username[0] || 'U').toUpperCase()}</div>
        <div class="profile-info">
          <div class="profile-name">${profile?.username}</div>
          <div class="profile-stats-row">
            <div class="pstat"><span>${userListings.length}</span><small>Listings</small></div>
            <div class="pstat"><span>${wishlist.length}</span><small>Saved</small></div>
            <div class="pstat"><span>${(profile?.rating || 0).toFixed(1)}</span><small>Rating</small></div>
          </div>
        </div>
      </div>
      <h3 style="margin-top:32px;margin-bottom:16px;">My Listings</h3>
      <div class="product-grid">${userListings.length > 0 ? userListings.map(buildProductCard).join('') : '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);">No listings yet</p>'}</div>
    `;
  }

  /* ================================================================
     SECTION: app.js — Main Initialization & Navigation
  ================================================================ */
  window.openProductModal = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const firstImage = product.images?.[0] || null;
    const conditionLabel = {
      'new': 'New', 'like-new': 'Like New', 'good': 'Good', 'fair': 'Fair', 'poor': 'For Parts'
    }[product.condition] || product.condition;

    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-product-content');

    content.innerHTML = `
      <div class="modal-img-col">
        ${firstImage ? `<img src="${firstImage}" alt="${product.name}">` : `<i class="fas ${getCategoryIcon(product.category)}"></i>`}
      </div>
      <div class="modal-info-col">
        <h2 class="modal-title">${product.name}</h2>
        <div class="modal-price">${formatPrice(product.price)}</div>
        ${product.msrp ? `<small style="color:var(--text-muted);">MSRP ${formatPrice(product.msrp)}</small>` : ''}
        <div style="margin-top:16px;">
          <strong>Condition:</strong> ${conditionLabel}<br>
          <strong>Seller:</strong> ${product.seller} ${starsHTML(product.seller_rating)}<br>
          ${product.location ? `<strong>Location:</strong> ${product.location}` : ''}
        </div>
        <p style="margin-top:16px;color:var(--text-muted);font-size:0.9rem;line-height:1.6;">${product.description}</p>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button class="btn btn-primary btn-block" onclick="addToCart('${product.id}', null); closeProductModal();">Add to Cart</button>
          <button class="btn btn-outline" onclick="toggleWishlist('${product.id}', null);"><i class="fas fa-heart"></i></button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  };

  window.closeProductModal = function () {
    document.getElementById('product-modal').style.display = 'none';
  };

  window.showPage = function (pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    document.getElementById('nav-links').classList.remove('open');

    if (pageId === 'profile') renderProfilePage();
    if (pageId === 'cart') renderCartPage();
    if (pageId === 'shop') applyFilters();
    if (pageId === 'home') populateHomePage();
  };

  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');
  mobileMenuBtn?.addEventListener('click', () => navLinks.classList.toggle('open'));

  document.getElementById('close-banner').addEventListener('click', () => {
    document.getElementById('announcement-banner').style.display = 'none';
  });

  async function init() {
    await checkAuthSession();
    products = await fetchListings();
    filteredItems = [...products];

    updateCartCount();
    updateNavUI();
    populateHomePage();

    document.getElementById('footer-year').textContent = new Date().getFullYear();

    console.log(`Obtainum: ${products.length} listings loaded.`);
  }

  init().catch(console.error);
});
