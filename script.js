/* ================================================================
   OBTAINUM MARKETPLACE — script.js
   Fixed version with proper page navigation and Supabase integration
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
        }
      });
    }
  } catch (e) {
    console.warn('Supabase initialization failed:', e.message);
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
  let currentUser = null;
  const categories = ['Electronics', 'Clothing & Accessories', 'Collectibles', 'Sports & Outdoors', 'Books & Media', 'Home & Garden', 'Vehicles', 'Other'];

  /* ================================================================
     SECTION: utils/toast.js — Toast Notifications
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
      <button class="toast-close" aria-label="Close"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    toast.querySelector('.toast-close').onclick = () => toast.remove();
    setTimeout(() => toast.remove(), duration);
  }

  /* ================================================================
     SECTION: utils/dom.js — DOM Helpers
  ================================================================ */
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
      if (i <= Math.floor(rating)) html += '<i class="fas fa-star"></i>';
      else html += '<i class="far fa-star"></i>';
    }
    return html;
  }

  /* ================================================================
     SECTION: features/theme.js — Theme Toggle
  ================================================================ */
  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('OBTAINUM_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('OBTAINUM_theme', next);
    document.getElementById('theme-icon').className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  });

  /* ================================================================
     SECTION: features/auth.js — Authentication
  ================================================================ */
  if (DB) {
    DB.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      updateNavUI();
      if (currentUser && event === 'SIGNED_IN') {
        showToast('Welcome!', `Logged in as ${currentUser.email}`, 'success');
      }
    });
  }

  async function checkAuthSession() {
    if (!DB) return;
    try {
      const { data: { session } } = await DB.auth.getSession();
      currentUser = session?.user || null;
      updateNavUI();
    } catch (err) {
      console.error('Session check failed:', err);
    }
  }

  window.logout = async function () {
    if (DB) await DB.auth.signOut();
    currentUser = null;
    updateNavUI();
    showPage('home');
    showToast('Logged out', 'See you next time!', 'info');
  };

  window.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
  };

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

  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!DB) return showToast('Error', 'Database not configured', 'error');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    try {
      const { error } = await DB.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showPage('home');
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
    }
  });

  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!DB) return showToast('Error', 'Database not configured', 'error');

    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const username = document.getElementById('register-username').value.trim();
    const errEl = document.getElementById('register-error');

    if (password !== confirm) {
      errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match';
      errEl.style.display = 'flex';
      return;
    }

    try {
      const { error } = await DB.auth.signUp({
        email, password,
        options: { data: { username } }
      });
      if (error) throw error;
      showToast('Account created!', 'Check your email to confirm', 'success');
      showPage('login');
    } catch (err) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      errEl.style.display = 'flex';
    }
  });

  /* ================================================================
     SECTION: api/products.js — Product Fetching
  ================================================================ */
  async function fetchListings() {
    if (!DB) return [];
    try {
      const { data, error } = await DB
        .from('listings')
        .select('*, profiles(username, rating)')
        .eq('is_sold', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        images: normalizeImages(item.images),
        seller: item.profiles?.username || 'Unknown',
        seller_rating: item.profiles?.rating || 0,
      }));
    } catch (err) {
      console.error('Fetch listings error:', err);
      return [];
    }
  }

  function buildProductCard(product) {
    const firstImage = product.images?.[0] || null;
    const conditionLabel = { 'new': 'New', 'like-new': 'Like New', 'good': 'Good', 'fair': 'Fair', 'poor': 'For Parts' }[product.condition] || product.condition;

    return `
      <div class="product-card" onclick="openProductModal('${product.id}')">
        <div class="product-card-img">
          ${firstImage ? `<img src="${firstImage}" alt="${product.name}" loading="lazy">` : `<i class="fas fa-box"></i>`}
          <div class="product-card-badges">
            <span class="badge badge-${product.is_fair ? 'fair' : 'scalp'}">
              <i class="fas fa-${product.is_fair ? 'check' : 'exclamation-triangle'}"></i> 
              ${product.is_fair ? 'Fair' : 'Above MSRP'}
            </span>
          </div>
        </div>
        <div class="product-card-body">
          <div class="product-category">${product.category}</div>
          <div class="product-name">${product.name}</div>
          <div class="product-seller"><i class="fas fa-user"></i> ${product.seller}</div>
          <div class="product-condition condition-${product.condition}">${conditionLabel}</div>
          <div class="product-price-row">
            <span class="product-price">${formatPrice(product.price)}</span>
            ${product.msrp ? `<span class="product-msrp">MSRP ${formatPrice(product.msrp)}</span>` : ''}
          </div>
        </div>
        <div class="product-card-actions">
          <button class="btn btn-primary btn-sm" onclick="addToCart('${product.id}'); event.stopPropagation();">
            <i class="fas fa-cart-plus"></i> Add to Cart
          </button>
        </div>
      </div>
    `;
  }

  function renderProductGrid(items, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = items.length === 0 
      ? '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);"><i class="fas fa-search" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:16px;"></i><h3>No listings found</h3></div>'
      : items.map(buildProductCard).join('');
  }

  /* ================================================================
     SECTION: features/cart.js — Cart Management
  ================================================================ */
  window.addToCart = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const existing = cart.find(c => c.id === productId);
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    localStorage.setItem('OBTAINUM_cart', JSON.stringify(cart));
    showToast('Added to cart!', product.name, 'success', 2000);
  };

  /* ================================================================
     SECTION: features/filters.js — Product Filtering
  ================================================================ */
  const priceSlider = document.getElementById('price-slider');
  const priceFilterVal = document.getElementById('price-filter-value');
  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      priceFilterVal.textContent = formatPrice(priceSlider.value);
    });
  }

  document.getElementById('sort-select')?.addEventListener('change', applyFilters);
  document.querySelectorAll('.condition-filter').forEach(el => el.addEventListener('change', applyFilters));

  window.applyFilters = function () {
    const priceMax = parseFloat(priceSlider?.value || 5000);
    const checkedCond = [...document.querySelectorAll('.condition-filter:checked')].map(e => e.value);

    let result = products.filter(p => {
      if (p.price > priceMax) return false;
      if (checkedCond.length > 0 && !checkedCond.includes(p.condition)) return false;
      return true;
    });

    const sortVal = document.getElementById('sort-select')?.value || 'newest';
    switch (sortVal) {
      case 'price-asc': result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      default: result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    filteredItems = result;
    currentPage = 1;
    renderCurrentPage();
    document.getElementById('results-count').textContent = `${result.length} listing${result.length !== 1 ? 's' : ''}`;
  };

  function renderCurrentPage() {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page = filteredItems.slice(start, start + ITEMS_PER_PAGE);
    renderProductGrid(page, 'product-grid');
    renderPagination();
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const container = document.getElementById('pagination');
    if (!container || totalPages <= 1) return;

    let html = `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
      }
    }
    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
    container.innerHTML = html;
  }

  window.goToPage = function (page) {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderCurrentPage();
  };

  /* ================================================================
     SECTION: features/sell.js — Sell Form
  ================================================================ */
  ['sell-name', 'sell-description'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    const count = document.getElementById(id.split('-')[1] + '-char-count');
    input.addEventListener('input', () => { count.textContent = input.value.length; });
  });

  const imageInput = document.getElementById('sell-images');
  const imageUploadArea = document.getElementById('image-upload-area');
  const imagePreviewRow = document.getElementById('image-preview-row');
  let uploadedFiles = [];

  if (imageInput) imageInput.addEventListener('change', (e) => handleImageFiles(e.target.files));
  if (imageUploadArea) {
    imageUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      imageUploadArea.classList.add('drag-over');
    });
    imageUploadArea.addEventListener('dragleave', () => imageUploadArea.classList.remove('drag-over'));
    imageUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      imageUploadArea.classList.remove('drag-over');
      handleImageFiles(e.dataTransfer.files);
    });
  }

  function handleImageFiles(files) {
    [...files].forEach(file => {
      if (!file.type.startsWith('image/')) return showToast('Error', `${file.name} is not an image`, 'error');
      if (file.size > 5 * 1024 * 1024) return showToast('Error', `${file.name} exceeds 5MB`, 'error');
      
      const idx = uploadedFiles.length;
      uploadedFiles.push(file);
      renderImagePreview(file, idx);
    });
  }

  function renderImagePreview(file, idx) {
    const reader = new FileReader();
    reader.onload = e => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-thumb-wrap';
      wrap.dataset.idx = idx;
      wrap.innerHTML = `
        <img src="${e.target.result}" class="preview-thumb">
        <button type="button" class="remove-thumb-btn" onclick="removeThumb(${idx})"><i class="fas fa-times"></i></button>`;
      imagePreviewRow.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  }

  window.removeThumb = function (idx) {
    uploadedFiles[idx] = null;
    document.querySelector(`.preview-thumb-wrap[data-idx="${idx}"]`)?.remove();
  };

  const sellForm = document.getElementById('sell-form');
  sellForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return showToast('Error', 'You must be logged in to sell', 'error');

    const activeFiles = uploadedFiles.filter(Boolean);
    if (activeFiles.length === 0) return showToast('Error', 'At least one image is required', 'error');

    const btn = document.getElementById('sell-submit-btn');
    btn.disabled = true;

    try {
      const imageUrls = [];
      for (const file of activeFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const { error: uploadError } = await DB.storage.from(STORAGE_BUCKET).upload(fileName, file);
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: urlData } = DB.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
      }

      const listingData = {
        seller_id: currentUser.id,
        name: document.getElementById('sell-name').value.trim(),
        category: document.getElementById('sell-category').value,
        description: document.getElementById('sell-description').value.trim(),
        condition: document.getElementById('sell-condition').value,
        price: parseFloat(document.getElementById('sell-price').value),
        msrp: parseFloat(document.getElementById('sell-msrp').value) || null,
        images: imageUrls,
        payment_methods: ['cash'],
        is_fair: true,
        type: 'buy-now',
        shipping: 'local',
      };

      const { error: dbError } = await DB.from('listings').insert(listingData);
      if (dbError) throw dbError;

      showToast('Success!', 'Your listing is now live', 'success');
      showPage('shop');
      sellForm.reset();
      uploadedFiles = [];
      imagePreviewRow.innerHTML = '';
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* ================================================================
     SECTION: pages/home.js — Home Page
  ================================================================ */
  function populateHomePage() {
    const featured = [...products].slice(0, 8);
    renderProductGrid(featured, 'featured-products');

    const categoryGrid = document.getElementById('category-grid');
    categoryGrid.innerHTML = categories.map(cat => `
      <button class="category-card" onclick="filterByCategory('${cat}')">
        <span>${cat}</span>
      </button>
    `).join('');
  }

  window.filterByCategory = function (category) {
    document.querySelector(`input[value="${category}"]`)?.click();
    applyFilters();
    showPage('shop');
  };

  /* ================================================================
     SECTION: pages/profile.js — Profile Page
  ================================================================ */
  async function renderProfilePage() {
    const container = document.getElementById('profile-content');
    if (!currentUser) {
      container.innerHTML = '<p style="text-align:center;padding:60px;">Please log in to view your profile.</p>';
      return;
    }

    const { data: profile } = await DB.from('profiles').select('*').eq('id', currentUser.id).single();
    const userListings = products.filter(p => p.seller_id === currentUser.id);

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${(profile?.username[0] || 'U').toUpperCase()}</div>
        <div>
          <div class="profile-name">${profile?.username || 'User'}</div>
          <div class="profile-stats-row">
            <div><strong>${userListings.length}</strong><small>Listings</small></div>
            <div><strong>${profile?.rating || 0}</strong><small>Rating</small></div>
          </div>
        </div>
      </div>
      <h3 style="margin-top:32px;margin-bottom:16px;">My Listings</h3>
      <div class="product-grid">${userListings.length ? userListings.map(buildProductCard).join('') : '<p style="grid-column:1/-1;">No listings yet</p>'}</div>
    `;
  }

  /* ================================================================
     SECTION: pages/shop.js — Shop Page
  ================================================================ */
  function populateShopFilters() {
    const categoryList = document.getElementById('category-filter-list');
    if (!categoryList) return;

    categoryList.innerHTML = categories.map(cat => `
      <label class="filter-checkbox">
        <input type="radio" name="category-filter" value="${cat}" onchange="applyFilters()">
        <span>${cat}</span>
      </label>
    `).join('');

    const categorySelect = document.getElementById('sell-category');
    if (categorySelect) {
      categorySelect.innerHTML = `<option value="">Select category</option>` + categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
  }

  /* ================================================================
     SECTION: components/modal.css — Product Modal
  ================================================================ */
  window.openProductModal = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const firstImage = product.images?.[0] || null;
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-product-content');

    content.innerHTML = `
      <div class="modal-product-inner">
        <div class="modal-img-col">
          ${firstImage ? `<img src="${firstImage}" alt="${product.name}">` : '<i class="fas fa-box" style="font-size:3rem;color:var(--text-subtle);"></i>'}
        </div>
        <div class="modal-info-col">
          <h2 class="modal-title">${product.name}</h2>
          <div class="modal-price">${formatPrice(product.price)}</div>
          <div class="modal-seller-info">
            <strong>${product.seller}</strong> ${starsHTML(product.seller_rating)}
          </div>
          <p style="color:var(--text-muted);font-size:0.9rem;">${product.description}</p>
          <div class="modal-actions">
            <button class="btn btn-primary btn-block" onclick="addToCart('${product.id}'); closeProductModal();">Add to Cart</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  };

  window.closeProductModal = function () {
    document.getElementById('product-modal').style.display = 'none';
  };

  /* ================================================================
     SECTION: app.js — Navigation & Initialization
  ================================================================ */
  window.showPage = function (pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    if (pageId === 'profile') renderProfilePage();
    if (pageId === 'shop') applyFilters();
  };

  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');
  mobileMenuBtn?.addEventListener('click', () => navLinks.classList.toggle('open'));

  // Initialize
  async function init() {
    await checkAuthSession();
    populateShopFilters();
    
    products = await fetchListings();
    filteredItems = [...products];

    populateHomePage();
    applyFilters();

    document.getElementById('footer-year').textContent = new Date().getFullYear();
    console.log(`Obtainum initialized: ${products.length} listings loaded`);
  }

  init().catch(console.error);
});
