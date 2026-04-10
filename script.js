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

  /* ==============================================================
     SECTION: supabase-client.js — Supabase Initialization
     Replace the URL and ANON KEY below with your own project's values.
     Get them at: https://supabase.com/dashboard → Project → Settings → API
  ============================================================== */
const SUPABASE_URL  = 'REPLACE_URL';
const SUPABASE_ANON = 'REPLACE_KEY';
  let DB = null;

  try {
    DB = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  } catch (e) {
    console.warn('Supabase init failed. Running in demo mode.', e);
  }


  /* ==============================================================
     SECTION: state.js — Global App State
  ============================================================== */
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


  /* ==============================================================
     SECTION: api/products.js — Mock Product Data
     In production: replace with Supabase queries.
     e.g. const { data } = await DB.from('listings').select('*');
  ============================================================== */
  const MOCK_PRODUCTS = [
    {
      id: 1, name: 'Nintendo Switch OLED – White Edition', category: 'electronics',
      price: 299.99, msrp: 349.99, condition: 'like-new', seller: 'GameGuru99', seller_rating: 4.8,
      location: 'Austin, TX', description: 'Purchased new last year, used lightly for about 3 months. Comes with original box, dock, all cables, and two Joy-Cons. No scratches on screen.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['nintendo', 'gaming', 'console'], is_fair: true,
      created_at: '2026-04-01T10:00:00Z', views: 342, likes: 28
    },
    {
      id: 2, name: 'Funko Pop! Exclusive: Iron Man Mark L Metallic', category: 'toys',
      price: 45.00, msrp: 15.00, condition: 'new', seller: 'CollectorJane', seller_rating: 4.9,
      location: 'New York, NY', description: 'SDCC 2024 exclusive Funko Pop! Still in original box, never displayed. Comes with protector case.',
      images: [], type: 'offers', shipping: 'paid', tags: ['funko', 'marvel', 'sdcc', 'exclusive'], is_fair: false,
      created_at: '2026-04-03T14:30:00Z', views: 1204, likes: 87
    },
    {
      id: 3, name: 'Bose QuietComfort 45 – Noise Cancelling Headphones', category: 'electronics',
      price: 189.99, msrp: 329.00, condition: 'good', seller: 'AudioPhile_TX', seller_rating: 4.7,
      location: 'Seattle, WA', description: 'Used for about 6 months for remote work. Works perfectly. Slight scuff on the headband. Includes case and cables.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['bose', 'headphones', 'noise-cancelling'], is_fair: true,
      created_at: '2026-04-05T09:15:00Z', views: 521, likes: 41
    },
    {
      id: 4, name: 'Supreme Box Logo Hoodie – FW23 Black L', category: 'apparel',
      price: 350.00, msrp: 168.00, condition: 'new', seller: 'StreetWearKing', seller_rating: 4.5,
      location: 'Los Angeles, CA', description: 'Brand new with tags. Purchased during FW23 drop. Size Large. Authentic with receipt available.',
      images: [], type: 'buy-now', shipping: 'paid', tags: ['supreme', 'hoodie', 'streetwear'], is_fair: false,
      created_at: '2026-04-02T16:45:00Z', views: 2100, likes: 154
    },
    {
      id: 5, name: 'Pokémon Scarlet & Violet Booster Box (36 Packs)', category: 'toys',
      price: 110.00, msrp: 143.64, condition: 'new', seller: 'PokeTrader', seller_rating: 5.0,
      location: 'Chicago, IL', description: 'Sealed booster box from Scarlet & Violet base set. Ships in protective box for safety.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['pokemon', 'tcg', 'cards', 'sealed'], is_fair: true,
      created_at: '2026-04-06T08:00:00Z', views: 890, likes: 63
    },
    {
      id: 6, name: 'Sony WH-1000XM5 Wireless Headphones – Black', category: 'electronics',
      price: 249.99, msrp: 399.99, condition: 'like-new', seller: 'TechResell', seller_rating: 4.6,
      location: 'Miami, FL', description: 'Like new, used for 2 months. Comes with all accessories and original box. Minor cosmetic marks on headband only.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['sony', 'headphones', 'wireless'], is_fair: true,
      created_at: '2026-04-04T11:30:00Z', views: 678, likes: 49
    },
    {
      id: 7, name: 'LEGO Technic Bugatti Chiron #42083 – Retired', category: 'toys',
      price: 380.00, msrp: 349.99, condition: 'new', seller: 'BrickMaster', seller_rating: 4.9,
      location: 'Denver, CO', description: 'Sealed, retired set. Includes original box and all parts. This set is no longer in production and is a rare find.',
      images: [], type: 'buy-now', shipping: 'paid', tags: ['lego', 'technic', 'bugatti', 'retired'], is_fair: true,
      created_at: '2026-04-07T13:00:00Z', views: 1432, likes: 112
    },
    {
      id: 8, name: 'Vintage Levi\'s 501 Jeans – 32x30 – Distressed', category: 'apparel',
      price: 75.00, msrp: 98.00, condition: 'good', seller: 'ThriftKing', seller_rating: 4.8,
      location: 'Portland, OR', description: 'Authentic vintage 501s from the early 90s. Natural distressing, no holes. Size 32x30.',
      images: [], type: 'offers', shipping: 'free', tags: ['levis', 'vintage', 'denim', 'jeans'], is_fair: true,
      created_at: '2026-04-08T10:00:00Z', views: 304, likes: 31
    },
    {
      id: 9, name: 'Apple iPad Pro 12.9" M2 – 256GB WiFi + Cellular', category: 'electronics',
      price: 899.99, msrp: 1299.00, condition: 'like-new', seller: 'AppleReseller', seller_rating: 4.7,
      location: 'San Francisco, CA', description: 'Used for 4 months. Immaculate condition. Comes with original box, USB-C cable. No Apple Pencil or keyboard included.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['apple', 'ipad', 'tablet', 'm2'], is_fair: true,
      created_at: '2026-04-09T14:00:00Z', views: 756, likes: 58
    },
    {
      id: 10, name: 'NBA Topps Chrome Refractor – LeBron James RC PSA 9', category: 'sports',
      price: 4500.00, msrp: 2.99, condition: 'new', seller: 'CardShark', seller_rating: 4.9,
      location: 'Houston, TX', description: 'Graded PSA 9 LeBron James rookie card. 2003-04 Topps Chrome Refractor. Authenticated and graded. Comes in protective slab.',
      images: [], type: 'offers', shipping: 'paid', tags: ['nba', 'topps', 'lebron', 'rookie', 'psa'], is_fair: true,
      created_at: '2026-04-05T17:00:00Z', views: 3200, likes: 241
    },
    {
      id: 11, name: 'The Legend of Zelda: Tears of the Kingdom – Collector\'s Edition', category: 'electronics',
      price: 110.00, msrp: 129.99, condition: 'new', seller: 'ZeldaFan', seller_rating: 4.8,
      location: 'Nashville, TN', description: 'Sealed collector\'s edition. Includes steelbook, artbook, and digital DLC. For Nintendo Switch.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['zelda', 'nintendo', 'switch', 'collector'], is_fair: true,
      created_at: '2026-04-08T09:00:00Z', views: 612, likes: 55
    },
    {
      id: 12, name: 'Patagonia Better Sweater Fleece Jacket – Navy M', category: 'apparel',
      price: 85.00, msrp: 139.00, condition: 'good', seller: 'OutdoorGear', seller_rating: 4.6,
      location: 'Boulder, CO', description: 'Classic Patagonia Better Sweater, size Medium. Light pilling on sleeves, otherwise great condition. Very warm.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['patagonia', 'fleece', 'jacket', 'outdoors'], is_fair: true,
      created_at: '2026-04-06T15:00:00Z', views: 289, likes: 24
    },
    {
      id: 13, name: 'IKEA KALLAX Shelving Unit 4x4 – White', category: 'home',
      price: 90.00, msrp: 199.00, condition: 'good', seller: 'HomeDecor', seller_rating: 4.5,
      location: 'Atlanta, GA', description: 'KALLAX 4x4 in white. Some scuff marks, one backing corner slightly bent but fully functional. Pickup only.',
      images: [], type: 'buy-now', shipping: 'local', tags: ['ikea', 'shelving', 'storage', 'kallax'], is_fair: true,
      created_at: '2026-04-07T12:00:00Z', views: 183, likes: 17
    },
    {
      id: 14, name: 'Magic: The Gathering Collector Booster Box – MH3', category: 'toys',
      price: 225.00, msrp: 264.00, condition: 'new', seller: 'MTGTrader', seller_rating: 4.9,
      location: 'Phoenix, AZ', description: 'Sealed MTG Modern Horizons 3 Collector Booster Box. Best chance for serialized cards and full art cards.',
      images: [], type: 'buy-now', shipping: 'free', tags: ['mtg', 'magic', 'collector', 'sealed'], is_fair: true,
      created_at: '2026-04-09T11:00:00Z', views: 978, likes: 72
    },
    {
      id: 15, name: 'Canon EOS R6 Mark II Body Only (Low Shutter Count)', category: 'electronics',
      price: 1999.00, msrp: 2499.00, condition: 'like-new', seller: 'PhotoPro', seller_rating: 4.8,
      location: 'Boston, MA', description: 'Only 1,800 shutter actuations. Comes with battery, charger, and body cap. No scratches on sensor or body. Great for stills and video.',
      images: [], type: 'buy-now', shipping: 'paid', tags: ['canon', 'camera', 'mirrorless', 'r6'], is_fair: true,
      created_at: '2026-04-04T10:00:00Z', views: 1120, likes: 89
    },
    {
      id: 16, name: 'Star Wars The Mandalorian – LEGO UCS 75331 Razor Crest', category: 'toys',
      price: 480.00, msrp: 499.99, condition: 'new', seller: 'LEGOuniverse', seller_rating: 4.9,
      location: 'Columbus, OH', description: 'Sealed, purchased from LEGO store at launch. 6,187 pieces. Includes exclusive Grogu minifigure.',
      images: [], type: 'buy-now', shipping: 'paid', tags: ['lego', 'star-wars', 'mandalorian', 'ucs'], is_fair: true,
      created_at: '2026-04-03T09:00:00Z', views: 1876, likes: 138
    },
  ];


  /* ==============================================================
     SECTION: utils/dom.js — DOM Utilities
  ============================================================== */

  // Get category icon class
  function getCategoryIcon(category) {
    const icons = {
      electronics: 'fa-microchip', toys: 'fa-puzzle-piece', apparel: 'fa-tshirt',
      sports: 'fa-futbol', books: 'fa-book', home: 'fa-home',
      vehicles: 'fa-car', other: 'fa-box-open'
    };
    return icons[category] || 'fa-tag';
  }

  // Get category label
  function getCategoryLabel(cat) {
    const labels = {
      electronics: 'Electronics', toys: 'Toys & Collectibles', apparel: 'Apparel',
      sports: 'Sports & Outdoors', books: 'Books & Media', home: 'Home & Garden',
      vehicles: 'Vehicles & Parts', other: 'Other'
    };
    return labels[cat] || cat;
  }

  // Format currency
  function formatPrice(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Relative time
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

  // Stars HTML
  function starsHTML(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating))       html += '<i class="fas fa-star star"></i>';
      else if (i - 0.5 <= rating)       html += '<i class="fas fa-star-half-alt star"></i>';
      else                               html += '<i class="far fa-star star"></i>';
    }
    return html;
  }

  // Is in wishlist?
  function inWishlist(id) { return wishlist.includes(id); }


  /* ==============================================================
     SECTION: utils/toast.js — Toast Notifications
  ============================================================== */
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


  /* ==============================================================
     SECTION: features/theme.js — Dark / Light Mode Toggle
  ============================================================== */
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  // Load saved theme
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


  /* ==============================================================
     SECTION: features/auth.js — Authentication (Supabase)
  ============================================================== */

  // LOGIN
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    setButtonLoading(btn, true);
    errEl.style.display = 'none';

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!DB) {
      // Demo mode: simulate login
      currentUser = { email, user_metadata: { username: email.split('@')[0] } };
      updateNavUI();
      showPage('home');
      showToast('Logged in!', `Welcome back, ${currentUser.user_metadata.username}`, 'success');
      setButtonLoading(btn, false);
      return;
    }

    const { data, error } = await DB.auth.signInWithPassword({ email, password });
    setButtonLoading(btn, false);
    if (error) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.message}`;
      errEl.style.display = 'flex';
    } else {
      currentUser = data.user;
      updateNavUI();
      showPage('home');
      showToast('Welcome back!', `Logged in as ${currentUser.email}`, 'success');
    }
  });

  // REGISTER
  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    setButtonLoading(btn, true);
    errEl.style.display = 'none';

    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm  = document.getElementById('register-confirm-password').value;
    const username = document.getElementById('register-username').value.trim();
    const terms    = document.getElementById('register-terms').checked;
    const firstName= document.getElementById('register-first-name').value.trim();
    const lastName = document.getElementById('register-last-name').value.trim();

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

    if (!DB) {
      // Demo mode
      showPage('login');
      showToast('Registration simulated', 'In demo mode — check your Supabase config.', 'warning');
      setButtonLoading(btn, false);
      return;
    }

    const { data, error } = await DB.auth.signUp({
      email, password,
      options: { data: { username, first_name: firstName, last_name: lastName } }
    });

    setButtonLoading(btn, false);
    if (error) {
      errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.message}`;
      errEl.style.display = 'flex';
    } else {
      showPage('login');
      showToast('Account created!', 'Check your email to confirm your account.', 'success', 6000);
    }
  });

  // LOGOUT
  window.logout = async function () {
    if (DB) await DB.auth.signOut();
    currentUser = null;
    updateNavUI();
    showPage('home');
    showToast('Logged out', 'See you next time!', 'info');
  };

  // GOOGLE OAUTH
  window.loginWithGoogle = async function () {
    if (!DB) { showToast('Demo mode', 'Google login requires Supabase config.', 'warning'); return; }
    const { error } = await DB.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
    if (error) showToast('OAuth Error', error.message, 'error');
  };

  // FORGOT PASSWORD
  const forgotForm = document.getElementById('forgot-form');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const msgEl = document.getElementById('forgot-msg');
    if (!DB) {
      msgEl.textContent = 'Demo mode — password reset requires Supabase config.';
      msgEl.style.display = 'block';
      return;
    }
    const { error } = await DB.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) {
      msgEl.textContent = error.message;
      msgEl.className = 'form-error';
    } else {
      msgEl.textContent = 'Reset link sent! Check your email.';
      msgEl.className = 'form-success';
    }
    msgEl.style.display = 'block';
  });

  // Loading state helper
  function setButtonLoading(btn, loading) {
    const label = btn.querySelector('.btn-label');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    if (label)  label.style.display  = loading ? 'none' : 'inline';
    if (loader) loader.style.display = loading ? 'inline' : 'none';
  }

  // Update nav links based on auth
  function updateNavUI() {
    const loginLink   = document.getElementById('login-link');
    const logoutLink  = document.getElementById('logout-link');
    const profileLink = document.getElementById('profile-link');

    if (currentUser) {
      loginLink.style.display   = 'none';
      logoutLink.style.display  = 'flex';
      profileLink.style.display = 'flex';
    } else {
      loginLink.style.display   = 'flex';
      logoutLink.style.display  = 'none';
      profileLink.style.display = 'none';
    }
  }

  // Check session on load
  async function checkAuthSession() {
    if (!DB) return;
    const { data: { user } } = await DB.auth.getUser();
    if (user) { currentUser = user; updateNavUI(); }
    DB.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateNavUI();
    });
  }

  // Toggle password visibility
  window.togglePasswordVisibility = function (inputId, btn) {
    const input = document.getElementById(inputId);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  };

  // Password strength indicator
  const regPass = document.getElementById('register-password');
  if (regPass) {
    regPass.addEventListener('input', () => {
      const val = regPass.value;
      let score = 0;
      if (val.length >= 8)  score++;
      if (val.length >= 12) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      const fill = document.getElementById('strength-fill');
      const label= document.getElementById('strength-label');
      const levels = [
        { pct: '20%', color: '#ef4444', text: 'Very weak' },
        { pct: '40%', color: '#f97316', text: 'Weak' },
        { pct: '60%', color: '#f59e0b', text: 'Fair' },
        { pct: '80%', color: '#22c55e', text: 'Strong' },
        { pct: '100%', color: '#10b981', text: 'Very strong' },
      ];
      const lvl = levels[Math.max(0, score - 1)] || levels[0];
      fill.style.width  = val.length ? lvl.pct  : '0%';
      fill.style.background = lvl.color;
      label.textContent = val.length ? lvl.text : '';
      label.style.color = lvl.color;
    });
  }


  /* ==============================================================
     SECTION: features/cart.js — Cart Management
  ============================================================== */

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
      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <div class="cart-item-img">
          ${item.images && item.images.length > 0
            ? `<img src="${item.images[0]}" alt="${item.name}" loading="lazy">`
            : `<i class="fas ${getCategoryIcon(item.category)}"></i>`}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-seller"><i class="fas fa-user-circle"></i> ${item.seller}</div>
          <div class="cart-item-actions">
            <div class="qty-control">
              <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
              <span class="qty-display">${item.qty || 1}</span>
              <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
            </div>
            <button class="cart-remove-btn" onclick="removeFromCart(${item.id})"><i class="fas fa-trash-alt"></i> Remove</button>
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
      showToast('Promo applied!', '10% discount — not yet implemented in demo.', 'success');
    } else {
      showToast('Invalid promo code', '', 'error');
    }
  };


  /* ==============================================================
     SECTION: features/wishlist.js — Wishlist / Favorites
  ============================================================== */

  window.toggleWishlist = function (productId, e) {
    if (e) e.stopPropagation();
    const idx = wishlist.indexOf(productId);
    if (idx >= 0) {
      wishlist.splice(idx, 1);
      showToast('Removed from wishlist', '', 'info', 2000);
    } else {
      wishlist.push(productId);
      showToast('Added to wishlist', '', 'success', 2000);
    }
    localStorage.setItem('OBTAINUM_wishlist', JSON.stringify(wishlist));
    // Update all heart buttons with this product id
    document.querySelectorAll(`.wishlist-btn[data-id="${productId}"]`).forEach(btn => {
      btn.classList.toggle('active', wishlist.includes(productId));
      btn.querySelector('i').className = wishlist.includes(productId) ? 'fas fa-heart' : 'far fa-heart';
    });
  };


  /* ==============================================================
     SECTION: api/products.js — Product Rendering
  ============================================================== */

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

    return `
      <div class="product-card" role="listitem" onclick="openProductModal(${product.id})" tabindex="0" onkeydown="if(event.key==='Enter')openProductModal(${product.id})">
        <div class="product-card-img">
          ${product.images && product.images.length > 0
            ? `<img src="${product.images[0]}" alt="${product.name}" loading="lazy">`
            : `<i class="fas ${getCategoryIcon(product.category)}"></i>`}
          <div class="product-card-badges">${fairBadge}</div>
          <button class="wishlist-btn ${isWished ? 'active' : ''}" data-id="${product.id}"
            onclick="toggleWishlist(${product.id}, event)" aria-label="Toggle wishlist">
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
            ${(product.payment_methods || ['cash']).includes('cash')   ? `<span class="pay-badge pay-badge-cash"><i class="fas fa-money-bill-wave"></i> Cash</span>` : ''}
            ${(product.payment_methods || []).includes('trade')  ? `<span class="pay-badge pay-badge-trade"><i class="fas fa-exchange-alt"></i> Trade</span>` : ''}
            ${(product.payment_methods || []).includes('online') ? `<span class="pay-badge pay-badge-online"><i class="fas fa-credit-card"></i> Online</span>` : ''}
          </div>
          <div class="product-price-row">
            <span class="product-price">${formatPrice(product.price)}</span>
            ${product.msrp ? `<span class="product-msrp">MSRP ${formatPrice(product.msrp)}</span>` : ''}
            ${discountPct !== null && discountPct > 0 ? `<span class="product-discount">-${discountPct}%</span>` : ''}
          </div>
        </div>
        <div class="product-card-actions">
          <button class="btn btn-primary" onclick="addToCart(${product.id}, event)">
            <i class="fas fa-cart-plus"></i> ${inCartAlready ? 'Add More' : 'Add to Cart'}
          </button>
          <button class="btn btn-outline" onclick="openProductModal(${product.id}); event.stopPropagation();">
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


  /* ==============================================================
     SECTION: components/modal.css — Product Detail Modal
  ============================================================== */

  window.openProductModal = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const modal   = document.getElementById('product-modal');
    const content = document.getElementById('modal-product-content');

    const discountPct = product.msrp && product.price < product.msrp
      ? Math.round((1 - product.price / product.msrp) * 100)
      : null;

    const conditionLabel = {
      'new': 'New', 'like-new': 'Like New', 'good': 'Good', 'fair': 'Fair', 'poor': 'For Parts'
    }[product.condition] || product.condition;

    content.innerHTML = `
      <div class="modal-img-col">
        ${product.images && product.images.length > 0
          ? `<img src="${product.images[0]}" alt="${product.name}">`
          : `<i class="fas ${getCategoryIcon(product.category)}"></i>`}
      </div>
      <div class="modal-info-col">
        <div class="modal-badges">
          ${product.is_fair
            ? `<span class="badge badge-fair"><i class="fas fa-shield-alt"></i> Fair Price</span>`
            : `<span class="badge badge-scalp"><i class="fas fa-exclamation-triangle"></i> Above MSRP</span>`}
          <span class="product-condition condition-${product.condition}">${conditionLabel}</span>
          <span class="badge badge-new"><i class="fas fa-tag"></i> ${getCategoryLabel(product.category)}</span>
        </div>
        <h2 class="modal-title" id="modal-product-name">${product.name}</h2>
        <div class="modal-price-row">
          <span class="modal-price">${formatPrice(product.price)}</span>
          ${product.msrp ? `<span class="product-msrp">MSRP ${formatPrice(product.msrp)}</span>` : ''}
          ${discountPct !== null && discountPct > 0 ? `<span class="product-discount">-${discountPct}%</span>` : ''}
        </div>
        <div class="modal-seller-info">
          <div class="seller-avatar"><i class="fas fa-user"></i></div>
          <div>
            <div class="seller-name">${product.seller}</div>
            <div class="seller-stats">
              ${starsHTML(product.seller_rating)} ${product.seller_rating.toFixed(1)} · ${product.location || 'Unknown location'}
            </div>
          </div>
        </div>
        <div class="modal-desc">${product.description}</div>
        <div style="font-size:0.82rem;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;">
          <span><i class="fas fa-eye"></i> ${product.views} views</span>
          <span><i class="fas fa-heart"></i> ${product.likes} saves</span>
          <span><i class="fas fa-clock"></i> Listed ${timeAgo(product.created_at)}</span>
          <span><i class="fas fa-shipping-fast"></i> ${product.shipping === 'free' ? 'Free shipping' : product.shipping === 'local' ? 'Local pickup only' : 'Paid shipping'}</span>
        </div>
        ${product.tags && product.tags.length > 0
          ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${product.tags.map(t => `<span style="background:var(--surface-3);color:var(--text-muted);padding:2px 10px;border-radius:999px;font-size:0.78rem;">#${t}</span>`).join('')}</div>`
          : ''}
        ${product.payment_methods && product.payment_methods.length > 0 ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;">
            <i class="fas fa-hand-holding-usd" style="color:var(--primary);"></i> Accepted Payment Methods
          </div>
          <div class="payment-badges">
            ${product.payment_methods.includes('cash')   ? `<span class="pay-badge pay-badge-cash"><i class="fas fa-money-bill-wave"></i> Cash In-Person${product.meetup_spot ? ' · ' + product.meetup_spot : ''}</span>` : ''}
            ${product.payment_methods.includes('trade')  ? `<span class="pay-badge pay-badge-trade"><i class="fas fa-exchange-alt"></i> Trade${product.trade_for ? ' · Looking for: ' + product.trade_for : ''}</span>` : ''}
            ${product.payment_methods.includes('online') ? `<span class="pay-badge pay-badge-online"><i class="fas fa-credit-card"></i> Online Payment</span>` : ''}
          </div>
          ${product.payment_methods.includes('cash') && product.meetup_hours ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;"><i class="fas fa-clock" style="color:var(--primary);"></i> Meetup hours: ${product.meetup_hours}</div>` : ''}
        </div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-primary btn-lg" onclick="addToCart(${product.id}, event)">
            <i class="fas fa-cart-plus"></i> Add to Cart
          </button>
          <button class="btn btn-outline" onclick="toggleWishlist(${product.id}, event)">
            <i class="${inWishlist(product.id) ? 'fas' : 'far'} fa-heart"></i> 
            ${inWishlist(product.id) ? 'Saved' : 'Save'}
          </button>
        </div>
        <button class="analyze-ai-btn" onclick="analyzeProductWithAI(${product.id})">
          <i class="fas fa-robot"></i> Analyze with AI — Get Deal Score &amp; Route
        </button>
      </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.closeProductModal = function () {
    const modal = document.getElementById('product-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  document.getElementById('product-modal').addEventListener('click', function (e) {
    if (e.target === this) closeProductModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProductModal();
  });


  /* ==============================================================
     SECTION: features/filters.js — Shop Filters
  ============================================================== */

  // Price slider
  const priceSlider = document.getElementById('price-slider');
  const priceFilterVal = document.getElementById('price-filter-value');
  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      priceFilterVal.textContent = formatPrice(priceSlider.value);
      const maxInput = document.getElementById('price-max');
      if (maxInput) maxInput.value = priceSlider.value;
    });
  }

  // Price max input syncs to slider
  const priceMaxInput = document.getElementById('price-max');
  if (priceMaxInput) {
    priceMaxInput.addEventListener('input', () => {
      if (priceSlider) {
        priceSlider.value = Math.min(priceMaxInput.value, 5000);
        priceFilterVal.textContent = formatPrice(priceSlider.value);
      }
    });
  }

  // Filter inputs trigger live update
  const shopSearch = document.getElementById('shop-search');
  if (shopSearch) {
    shopSearch.addEventListener('input', debounce(applyFilters, 300));
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);

  document.querySelectorAll('input[name="category-filter"]').forEach(el =>
    el.addEventListener('change', applyFilters)
  );
  document.querySelectorAll('.condition-filter').forEach(el =>
    el.addEventListener('change', applyFilters)
  );
  document.querySelectorAll('input[name="rating-filter"]').forEach(el =>
    el.addEventListener('change', applyFilters)
  );
  const antiScalpFilter = document.getElementById('anti-scalp-filter');
  if (antiScalpFilter) antiScalpFilter.addEventListener('change', applyFilters);
  const freeShipping = document.getElementById('free-shipping-filter');
  if (freeShipping) freeShipping.addEventListener('change', applyFilters);
  document.querySelectorAll('.listing-type-filter').forEach(el =>
    el.addEventListener('change', applyFilters)
  );

  document.getElementById('apply-filters-btn')?.addEventListener('click', applyFilters);

  function applyFilters() {
    const searchVal      = (document.getElementById('shop-search')?.value || '').toLowerCase().trim();
    const categoryVal    = document.querySelector('input[name="category-filter"]:checked')?.value || 'all';
    const priceMax       = parseFloat(priceSlider?.value || 5000);
    const priceMin       = parseFloat(document.getElementById('price-min')?.value || 0) || 0;
    const checkedCond    = [...document.querySelectorAll('.condition-filter:checked')].map(e => e.value);
    const locationVal    = (document.getElementById('location-filter')?.value || '').toLowerCase().trim();
    const minRating      = parseFloat(document.querySelector('input[name="rating-filter"]:checked')?.value || 0);
    const antiScalp      = antiScalpFilter?.checked || false;
    const freeShipOnly   = freeShipping?.checked || false;
    const checkedTypes   = [...document.querySelectorAll('.listing-type-filter:checked')].map(e => e.value);
    const sortVal        = sortSelect?.value || 'newest';

    let result = products.filter(p => {
      if (searchVal && !p.name.toLowerCase().includes(searchVal) &&
          !p.description.toLowerCase().includes(searchVal) &&
          !(p.tags || []).some(t => t.includes(searchVal))) return false;
      if (categoryVal !== 'all' && p.category !== categoryVal) return false;
      if (p.price > priceMax) return false;
      if (p.price < priceMin) return false;
      if (checkedCond.length > 0 && !checkedCond.includes(p.condition)) return false;
      if (locationVal && p.location && !p.location.toLowerCase().includes(locationVal)) return false;
      if (minRating > 0 && p.seller_rating < minRating) return false;
      if (antiScalp && !p.is_fair) return false;
      if (freeShipOnly && p.shipping !== 'free') return false;
      if (checkedTypes.length > 0 && !checkedTypes.includes(p.type)) return false;
      return true;
    });

    // Sort
    switch (sortVal) {
      case 'price-asc':  result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      case 'name-asc':   result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc':  result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'oldest':     result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      default:           result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
    }

    filteredItems = result;
    currentPage = 1;
    renderCurrentPage();
    updateResultsCount(result.length);
    renderActiveFilterTags();
  }

  function renderCurrentPage() {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page  = filteredItems.slice(start, start + ITEMS_PER_PAGE);
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

    const tags = [];
    const category = document.querySelector('input[name="category-filter"]:checked')?.value;
    if (category && category !== 'all') tags.push({ label: getCategoryLabel(category), key: 'category' });

    const conds = [...document.querySelectorAll('.condition-filter:checked')].map(e => e.value);
    conds.forEach(c => tags.push({ label: c.replace('-', ' '), key: 'condition:' + c }));

    const searchVal = document.getElementById('shop-search')?.value?.trim();
    if (searchVal) tags.push({ label: `"${searchVal}"`, key: 'search' });

    if (antiScalpFilter?.checked) tags.push({ label: 'Fair price only', key: 'antiscalp' });
    if (freeShipping?.checked)    tags.push({ label: 'Free shipping', key: 'freeship' });

    el.innerHTML = tags.map(t =>
      `<span class="active-filter-tag" onclick="removeActiveFilter('${t.key}')">
        ${t.label} <i class="fas fa-times"></i>
      </span>`
    ).join('');
    el.style.display = tags.length > 0 ? 'flex' : 'none';
  }

  window.removeActiveFilter = function (key) {
    if (key === 'category') {
      const all = document.querySelector('input[name="category-filter"][value="all"]');
      if (all) all.checked = true;
    } else if (key.startsWith('condition:')) {
      const val = key.split(':')[1];
      const el  = document.querySelector(`.condition-filter[value="${val}"]`);
      if (el) el.checked = false;
    } else if (key === 'search') {
      const el = document.getElementById('shop-search');
      if (el) el.value = '';
    } else if (key === 'antiscalp') {
      if (antiScalpFilter) antiScalpFilter.checked = false;
    } else if (key === 'freeship') {
      if (freeShipping) freeShipping.checked = false;
    }
    applyFilters();
  };

  window.clearAllFilters = function () {
    const allCat = document.querySelector('input[name="category-filter"][value="all"]');
    if (allCat) allCat.checked = true;
    document.querySelectorAll('.condition-filter').forEach(e => e.checked = false);
    document.querySelectorAll('.listing-type-filter').forEach(e => e.checked = true);
    const allRating = document.querySelector('input[name="rating-filter"][value="all"]');
    if (allRating) allRating.checked = true;
    if (priceSlider) { priceSlider.value = 5000; priceFilterVal.textContent = '$5,000'; }
    const pMin = document.getElementById('price-min');
    const pMax = document.getElementById('price-max');
    if (pMin) pMin.value = '';
    if (pMax) pMax.value = '';
    const shopSrch = document.getElementById('shop-search');
    if (shopSrch) shopSrch.value = '';
    const locFilt = document.getElementById('location-filter');
    if (locFilt) locFilt.value = '';
    if (antiScalpFilter) antiScalpFilter.checked = false;
    if (freeShipping) freeShipping.checked = false;
    applyFilters();
    showToast('Filters cleared', '', 'info', 2000);
  };

  // Quick filter from category grid on home page
  window.filterAndGoShop = function (category) {
    activeCategory = category;
    const radio = document.querySelector(`input[name="category-filter"][value="${category}"]`);
    if (radio) radio.checked = true;
    showPage('shop');
    applyFilters();
  };


  /* ==============================================================
     SECTION: features/pagination.js — Pagination
  ============================================================== */

  function renderPagination() {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const container  = document.getElementById('pagination');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
      <i class="fas fa-chevron-left"></i>
    </button>`;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || i === totalPages ||
        (i >= currentPage - 2 && i <= currentPage + 2)
      ) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
      } else if (i === currentPage - 3 || i === currentPage + 3) {
        html += `<span style="padding:0 4px;color:var(--text-muted);">…</span>`;
      }
    }

    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
      <i class="fas fa-chevron-right"></i>
    </button>`;

    container.innerHTML = html;
  }

  window.goToPage = function (page) {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderCurrentPage();
    document.querySelector('#page-shop .shop-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


  /* ==============================================================
     SECTION: features/search.js — Global Search Bar
  ============================================================== */
  const globalSearch = document.getElementById('global-search');
  const searchClearBtn = document.getElementById('search-clear-btn');

  if (globalSearch) {
    globalSearch.addEventListener('input', debounce(() => {
      const val = globalSearch.value.trim();
      searchClearBtn.style.display = val ? 'block' : 'none';
      if (val.length >= 2) {
        const shopSrch = document.getElementById('shop-search');
        if (shopSrch) shopSrch.value = val;
        showPage('shop');
        applyFilters();
      }
    }, 350));

    globalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const shopSrch = document.getElementById('shop-search');
        if (shopSrch) shopSrch.value = globalSearch.value.trim();
        showPage('shop');
        applyFilters();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      globalSearch.value = '';
      searchClearBtn.style.display = 'none';
    });
  }


  /* ==============================================================
     SECTION: features/chat.js — AI Assistant (Gemini)
  ============================================================== */

  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  // Check if key saved
  let geminiKey = localStorage.getItem('OBTAINUM_gemini_key') || '';

  function checkGeminiKeySetup() {
    const setupCard   = document.getElementById('gemini-key-setup');
    const chatContainer = document.getElementById('chat-container');
    if (!geminiKey) {
      setupCard.style.display = 'block';
      chatContainer.style.display = 'none';
    } else {
      setupCard.style.display = 'none';
      chatContainer.style.display = 'flex';
    }
  }

  window.saveGeminiKey = function () {
    const input = document.getElementById('gemini-api-key-input');
    const key = input.value.trim();
    if (!key) { showToast('Please enter a key', '', 'warning'); return; }
    geminiKey = key;
    localStorage.setItem('OBTAINUM_gemini_key', geminiKey);
    checkGeminiKeySetup();
    showToast('Gemini key saved!', 'AI Assistant is ready.', 'success');
    input.value = '';
  };

  window.changeGeminiKey = function () {
    const setupCard     = document.getElementById('gemini-key-setup');
    const chatContainer = document.getElementById('chat-container');
    setupCard.style.display   = 'block';
    chatContainer.style.display = 'none';
  };

  window.clearChat = function () {
    const history = document.getElementById('chat-history');
    history.innerHTML = `
      <div class="chat-msg bot-msg">
        <div class="chat-msg-avatar bot-avatar"><i class="fas fa-robot"></i></div>
        <div class="chat-msg-bubble"><p>Chat cleared! Ask me anything about the OBTAINUM marketplace.</p></div>
        <span class="chat-msg-time">Just now</span>
      </div>`;
    chatMessages = [];
  };

  let chatMessages = []; // Conversation history for Gemini

  const chatInput = document.getElementById('chat-input');
  const chatCharCount = document.getElementById('chat-char-count');

  if (chatInput) {
    chatInput.addEventListener('input', () => {
      const remaining = 2000 - chatInput.value.length;
      if (chatCharCount) chatCharCount.textContent = remaining;
      // Auto-resize textarea
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessageToBot();
      }
    });
  }

  window.sendSuggestedPrompt = function (btn) {
    const text = btn.textContent.trim();
    if (chatInput) chatInput.value = text;
    sendMessageToBot();
    // Hide suggested prompts after first use
    document.getElementById('suggested-prompts').style.display = 'none';
  };

  window.sendMessageToBot = async function () {
    if (!geminiKey) {
      showToast('API key required', 'Please save your Gemini API key first.', 'warning');
      return;
    }

    const input   = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    appendChatMessage(message, 'user');
    input.value = '';
    input.style.height = 'auto';
    if (chatCharCount) chatCharCount.textContent = '2000';
    chatMessages.push({ role: 'user', parts: [{ text: message }] });

    const typingId = showTypingIndicator();

    try {
      // Build context-aware system prompt
      const systemContext = `You are the OBTAINUM AI Shopping Assistant, an expert on collectibles, electronics, apparel, and fair marketplace pricing.
You help users find good deals, identify scalping, and navigate the OBTAINUM marketplace.
Current marketplace stats: ${products.length} listings, categories: electronics, toys & collectibles, apparel, sports, books, home, vehicles.
Always be helpful, concise, and honest. If a price seems unfair (above MSRP), say so. Give specific, actionable advice.
Format responses with markdown-like plain text. Keep responses under 300 words.`;

      const payload = {
        system_instruction: { parts: [{ text: systemContext }] },
        contents: chatMessages,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
      };

      const response = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      removeTypingIndicator(typingId);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      const data   = await response.json();
      const reply  = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
      chatMessages.push({ role: 'model', parts: [{ text: reply }] });
      appendChatMessage(reply, 'bot');

    } catch (error) {
      removeTypingIndicator(typingId);
      appendChatMessage(`Sorry, I ran into an error: ${error.message}. Check your Gemini API key and try again.`, 'bot');
    }
  };

  function appendChatMessage(text, role) {
    const history = document.getElementById('chat-history');
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${role === 'user' ? 'user-msg' : 'bot-msg'}`;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Convert basic markdown-like text to HTML
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^- (.+)/gm, '<li>$1</li>')
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    msgEl.innerHTML = `
      <div class="chat-msg-avatar ${role === 'user' ? 'user-avatar' : 'bot-avatar'}">
        <i class="fas ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
      </div>
      <div class="chat-msg-bubble"><p>${formatted}</p></div>
      <span class="chat-msg-time">${now}</span>
    `;

    history.appendChild(msgEl);
    history.scrollTop = history.scrollHeight;
  }

  function showTypingIndicator() {
    const history = document.getElementById('chat-history');
    const id = 'typing-' + Date.now();
    const el = document.createElement('div');
    el.className = 'chat-msg bot-msg typing-indicator';
    el.id = id;
    el.innerHTML = `
      <div class="chat-msg-avatar bot-avatar"><i class="fas fa-robot"></i></div>
      <div class="chat-msg-bubble">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>`;
    history.appendChild(el);
    history.scrollTop = history.scrollHeight;
    return id;
  }

  function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
  }


  /* ==============================================================
     SECTION: features/sell.js — Sell Form & Image Upload
  ============================================================== */

  // Character counters
  const sellName = document.getElementById('sell-item-name');
  const nameCount = document.getElementById('name-char-count');
  if (sellName && nameCount) {
    sellName.addEventListener('input', () => { nameCount.textContent = sellName.value.length; });
  }

  const sellDesc = document.getElementById('sell-item-description');
  const descCount = document.getElementById('desc-char-count');
  if (sellDesc && descCount) {
    sellDesc.addEventListener('input', () => { descCount.textContent = sellDesc.value.length; });
  }

  // Price fairness indicator
  const priceInput = document.getElementById('sell-item-price');
  const msrpInput  = document.getElementById('sell-item-msrp');
  const fairnessEl = document.getElementById('price-fairness-indicator');
  const fairnessText = document.getElementById('price-fairness-text');

  function updatePriceFairness() {
    if (!priceInput || !msrpInput || !fairnessEl) return;
    const price = parseFloat(priceInput.value);
    const msrp  = parseFloat(msrpInput.value);
    if (!price || !msrp) { fairnessEl.style.display = 'none'; return; }

    const ratio = price / msrp;
    fairnessEl.style.display = 'flex';
    fairnessEl.className = 'price-fairness';

    if (ratio <= 1.0) {
      fairnessEl.classList.add('fair');
      fairnessText.textContent = `Your price is ${Math.round((1-ratio)*100)}% below MSRP — excellent value for buyers.`;
    } else if (ratio <= 1.2) {
      fairnessEl.classList.add('warning');
      fairnessText.textContent = `Your price is ${Math.round((ratio-1)*100)}% above MSRP — consider lowering it to avoid the scalp flag.`;
    } else {
      fairnessEl.classList.add('scalp');
      fairnessText.textContent = `Warning: Price is ${Math.round((ratio-1)*100)}% above MSRP. Listing may be flagged as scalped.`;
    }
  }

  priceInput?.addEventListener('input', updatePriceFairness);
  msrpInput?.addEventListener('input', updatePriceFairness);

  // Image upload
  const imageInput = document.getElementById('sell-item-images');
  const imageUploadArea = document.getElementById('image-upload-area');
  const imagePreviewRow = document.getElementById('image-preview-row');
  let uploadedFiles = [];

  if (imageInput) {
    imageInput.addEventListener('change', (e) => handleImageFiles(e.target.files));
  }

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
    const maxFiles = 8;
    const maxSize  = 5 * 1024 * 1024; // 5MB
    [...files].forEach((file) => {
      if (uploadedFiles.length >= maxFiles) {
        showToast('Max 8 photos', 'Remove some to add more.', 'warning');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast('Images only', `${file.name} is not an image.`, 'error');
        return;
      }
      if (file.size > maxSize) {
        showToast('File too large', `${file.name} exceeds 5MB.`, 'error');
        return;
      }
      uploadedFiles.push(file);
      renderImagePreview(file, uploadedFiles.length - 1);
    });
  }

  function renderImagePreview(file, idx) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-thumb-wrap';
      wrap.dataset.idx = idx;
      wrap.innerHTML = `
        <img src="${e.target.result}" alt="Preview" class="preview-thumb">
        <button class="remove-thumb-btn" onclick="removeThumb(${idx})" aria-label="Remove photo">
          <i class="fas fa-times"></i>
        </button>`;
      imagePreviewRow?.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  }

  window.removeThumb = function (idx) {
    uploadedFiles[idx] = null;
    document.querySelector(`.preview-thumb-wrap[data-idx="${idx}"]`)?.remove();
  };

  // Sell Form Submit
  const sellForm = document.getElementById('sell-form');
  if (sellForm) {
    sellForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser && DB) {
        showToast('Login required', 'Please log in to list an item.', 'warning');
        showPage('login');
        return;
      }

      const btn = document.getElementById('sell-submit-btn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

      const newListing = {
        id:          Date.now(),
        name:        document.getElementById('sell-item-name').value.trim(),
        category:    document.getElementById('sell-item-category').value,
        description: document.getElementById('sell-item-description').value.trim(),
        condition:   document.getElementById('sell-item-condition').value,
        location:    document.getElementById('sell-item-location').value.trim(),
        price:       parseFloat(document.getElementById('sell-item-price').value),
        msrp:        parseFloat(document.getElementById('sell-item-msrp').value) || null,
        type:        document.getElementById('sell-item-type').value,
        shipping:    document.getElementById('sell-item-shipping').value,
        tags:        document.getElementById('sell-item-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        seller:      currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0] || 'Anonymous',
        seller_rating: 5.0,
        images:      [],
        is_fair:     true,
        created_at:  new Date().toISOString(),
        views:       0,
        likes:       0,
        payment_methods: Array.from(document.querySelectorAll('input[name="payment-method"]:checked')).map(el => el.value),
        meetup_spot:  document.getElementById('sell-meetup-spot')?.value.trim() || '',
        meetup_hours: document.getElementById('sell-meetup-hours')?.value.trim() || '',
        trade_for:    document.getElementById('sell-trade-for')?.value.trim() || ''
      };

      // Compute is_fair
      if (newListing.msrp) {
        newListing.is_fair = newListing.price <= newListing.msrp * 1.1;
      }

      // TODO: In production, upload images to Supabase Storage and save listing to DB
      // const { data, error } = await DB.from('listings').insert([newListing]);

      // For now: add to local products array
      products.unshift(newListing);
      filteredItems = products.slice();

      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publish Listing';
      sellForm.reset();
      uploadedFiles = [];
      if (imagePreviewRow) imagePreviewRow.innerHTML = '';
      if (fairnessEl) fairnessEl.style.display = 'none';
      if (nameCount)  nameCount.textContent = '0';
      if (descCount)  descCount.textContent = '0';

      showToast('Listing published!', `"${newListing.name}" is now live on the marketplace.`, 'success', 5000);
      showPage('shop');
      renderProductGrid(products.slice(0, ITEMS_PER_PAGE), 'product-grid');
      updateResultsCount(products.length);
    });
  }


  /* ==============================================================
     SECTION: pages/profile.js — Profile Page Render
  ============================================================== */

  async function renderProfilePage() {
    if (!DB) {
      // Demo mode
      if (!currentUser) {
        document.getElementById('profile-content').innerHTML = `
          <div style="text-align:center;padding:80px 0;">
            <i class="fas fa-user-lock" style="font-size:4rem;color:var(--text-subtle);margin-bottom:20px;display:block;"></i>
            <h2>Login to view your profile</h2>
            <p style="color:var(--text-muted);margin-bottom:20px;">Create an account or log in to access your profile.</p>
            <button class="btn btn-primary" onclick="showPage('login')">Sign In</button>
          </div>`;
        return;
      }
    }

    if (!currentUser) {
      document.getElementById('profile-content').innerHTML = `
        <div style="text-align:center;padding:80px 0;">
          <i class="fas fa-user-lock" style="font-size:4rem;color:var(--text-subtle);margin-bottom:20px;display:block;"></i>
          <h2>Login to view your profile</h2>
          <button class="btn btn-primary" onclick="showPage('login')">Sign In</button>
        </div>`;
      return;
    }

    const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'User';
    const firstName = currentUser.user_metadata?.first_name || '';
    const fullName  = firstName ? `${firstName} ${currentUser.user_metadata?.last_name || ''}`.trim() : username;
    const joinDate  = new Date(currentUser.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const userListings = products.filter(p => p.seller === username);

    document.getElementById('profile-content').innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${(fullName[0] || username[0]).toUpperCase()}</div>
        <div class="profile-info">
          <div class="profile-name">${fullName}</div>
          <div class="profile-username">@${username}</div>
          <div class="profile-joined"><i class="fas fa-calendar-alt"></i> Member since ${joinDate}</div>
        </div>
        <div class="profile-stats-row">
          <div class="pstat"><span>${userListings.length}</span><small>Listings</small></div>
          <div class="pstat"><span>${cart.length}</span><small>In Cart</small></div>
          <div class="pstat"><span>${wishlist.length}</span><small>Saved</small></div>
          <div class="pstat"><span>5.0</span><small>Rating</small></div>
        </div>
      </div>

      <div class="profile-tabs">
        <button class="profile-tab active" onclick="switchProfileTab(this, 'listings')"><i class="fas fa-tag"></i> My Listings (${userListings.length})</button>
        <button class="profile-tab" onclick="switchProfileTab(this, 'purchases')"><i class="fas fa-shopping-bag"></i> Purchases</button>
        <button class="profile-tab" onclick="switchProfileTab(this, 'saved')"><i class="fas fa-heart"></i> Saved (${wishlist.length})</button>
        <button class="profile-tab" onclick="switchProfileTab(this, 'settings')"><i class="fas fa-cog"></i> Settings</button>
      </div>

      <div id="profile-tab-content">
        ${renderProfileListings(userListings)}
      </div>
    `;
  }

  function renderProfileListings(listings) {
    if (listings.length === 0) {
      return `<div style="text-align:center;padding:60px 0;color:var(--text-muted);">
        <i class="fas fa-tag" style="font-size:3rem;opacity:0.3;margin-bottom:16px;display:block;"></i>
        <h3>No listings yet</h3>
        <p>Start selling today — it's free!</p>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="showPage('sell')">List an Item</button>
      </div>`;
    }
    return `<div class="product-grid">${listings.map(buildProductCard).join('')}</div>`;
  }

  window.switchProfileTab = function (btn, tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('profile-tab-content');
    const username = currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0];

    switch (tab) {
      case 'listings':
        content.innerHTML = renderProfileListings(products.filter(p => p.seller === username));
        break;
      case 'purchases':
        content.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--text-muted);">
          <i class="fas fa-shopping-bag" style="font-size:3rem;opacity:0.3;margin-bottom:16px;display:block;"></i>
          <h3>No purchases yet</h3>
          <p>Your purchase history will appear here.</p>
        </div>`;
        break;
      case 'saved':
        const saved = products.filter(p => wishlist.includes(p.id));
        content.innerHTML = saved.length === 0
          ? `<div style="text-align:center;padding:60px 0;color:var(--text-muted);">
              <i class="fas fa-heart" style="font-size:3rem;opacity:0.3;margin-bottom:16px;display:block;"></i>
              <h3>No saved items</h3>
              <p>Click the heart icon on any listing to save it.</p>
            </div>`
          : `<div class="product-grid">${saved.map(buildProductCard).join('')}</div>`;
        break;
      case 'settings':
        content.innerHTML = `
          <div class="form-card" style="max-width:600px;margin:0 auto;">
            <h3 style="margin-bottom:24px;">Account Settings</h3>
            <div class="form-group">
              <label>Email</label>
              <input type="email" value="${currentUser?.email || ''}" readonly style="background:var(--surface-3);cursor:not-allowed;">
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" value="${currentUser?.user_metadata?.username || ''}" placeholder="Your display name">
            </div>
            <div class="form-group">
              <label>Bio</label>
              <textarea placeholder="Tell buyers about yourself..." rows="3"></textarea>
            </div>
            <div style="display:flex;gap:12px;margin-top:8px;">
              <button class="btn btn-primary" onclick="showToast('Settings saved','',success,2000)">Save Changes</button>
              <button class="btn btn-danger" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>
          </div>`;
        break;
    }
  };


  /* ==============================================================
     SECTION: utils/ui.js — Page Navigation
  ============================================================== */
  window.showPage = function (pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (!target) return;

    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update active nav link
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    // Close mobile menu
    closeMobileMenu();

    // Page-specific setup
    if (pageId === 'profile') renderProfilePage();
    if (pageId === 'cart') renderCartPage();
    if (pageId === 'assistant') checkGeminiKeySetup();
    if (pageId === 'shop') {
      applyFilters();
    }
  };


  /* ==============================================================
     SECTION: Mobile Menu (components/nav.css companion)
  ============================================================== */
  const mobileMenuBtn  = document.getElementById('mobile-menu-btn');
  const navLinks       = document.getElementById('nav-links');
  const mobileOverlay  = document.getElementById('mobile-overlay');

  mobileMenuBtn?.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    mobileMenuBtn.classList.toggle('open', isOpen);
    mobileOverlay.classList.toggle('active', isOpen);
    mobileMenuBtn.setAttribute('aria-expanded', isOpen);
  });

  mobileOverlay?.addEventListener('click', closeMobileMenu);

  function closeMobileMenu() {
    navLinks?.classList.remove('open');
    mobileMenuBtn?.classList.remove('open');
    mobileOverlay?.classList.remove('active');
    mobileMenuBtn?.setAttribute('aria-expanded', 'false');
  }

  // Mobile filter toggle
  document.getElementById('mobile-filter-btn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('filters-sidebar');
    sidebar?.classList.toggle('open');
  });


  /* ==============================================================
     SECTION: View Toggle (grid/list)
  ============================================================== */
  window.setView = function (view) {
    currentView = view;
    const grid = document.getElementById('product-grid');
    grid?.classList.toggle('list-view', view === 'list');
    grid?.classList.toggle('grid-view', view === 'grid');
    document.getElementById('grid-view-btn')?.classList.toggle('active', view === 'grid');
    document.getElementById('list-view-btn')?.classList.toggle('active', view === 'list');
  };


  /* ==============================================================
     SECTION: Announcement Banner
  ============================================================== */
  document.getElementById('close-banner')?.addEventListener('click', () => {
    document.getElementById('announcement-banner').style.display = 'none';
  });


  /* ==============================================================
     SECTION: Footer — Newsletter & Year
  ============================================================== */
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  window.subscribeNewsletter = function (e) {
    e.preventDefault();
    const input = e.target.querySelector('input[type="email"]');
    showToast('Subscribed!', `You'll receive alerts at ${input.value}`, 'success');
    input.value = '';
  };


  /* ==============================================================
     SECTION: animations.js — GSAP Animations & Counters
  ============================================================== */

  function animateCounters() {
    document.querySelectorAll('.stat-number[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      const duration = 1.5;
      gsap.to({ val: 0 }, {
        val: target,
        duration,
        ease: 'power2.out',
        onUpdate: function () { el.textContent = Math.round(this.targets()[0].val).toLocaleString(); }
      });
    });
  }

  // Animate cards in on home page
  function animateHomeCards() {
    if (typeof gsap === 'undefined') return;
    gsap.from('.category-card', {
      y: 30, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out',
      scrollTrigger: { trigger: '.category-grid', start: 'top 85%' }
    });
  }

  // Stagger product cards
  function animateProductCards(gridId) {
    if (typeof gsap === 'undefined') return;
    gsap.from(`#${gridId} .product-card`, {
      y: 20, opacity: 0, duration: 0.4, stagger: 0.07, ease: 'power2.out'
    });
  }


  /* ==============================================================
     SECTION: pages/home.js — Home Page Setup
  ============================================================== */

  function populateHomePage() {
    // Featured products (random subset)
    const featured = [...products].sort(() => Math.random() - 0.5).slice(0, 8);
    renderProductGrid(featured, 'featured-products');
    animateProductCards('featured-products');

    // Recent products (newest)
    const recent = [...products].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
    renderProductGrid(recent, 'recent-products');

    // Category counts
    const counts = {};
    products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    Object.keys(counts).forEach(cat => {
      const el = document.getElementById(`cat-count-${cat}`);
      if (el) el.textContent = `${counts[cat]} item${counts[cat] !== 1 ? 's' : ''}`;
    });

    // Animate counters
    animateCounters();
  }


  /* ==============================================================
     SECTION: Utility Helpers
  ============================================================== */

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }


  /* ==============================================================
     SECTION: features/ai-tabs.js — AI Mode Tabs (Chat / Product Analysis)
  ============================================================== */

  window.switchAITab = function (tab) {
    // Tab buttons use id="tab-chat" / id="tab-analyze"
    document.querySelectorAll('.ai-tab').forEach(btn => btn.classList.remove('active'));

    // Panels: chat-container / product-analysis-panel
    const chatPanel     = document.getElementById('chat-container');
    const analysisPanel = document.getElementById('product-analysis-panel');

    if (tab === 'chat') {
      document.getElementById('tab-chat')?.classList.add('active');
      if (chatPanel)     chatPanel.style.display     = 'flex';
      if (analysisPanel) analysisPanel.style.display = 'none';
    } else {
      document.getElementById('tab-analyze')?.classList.add('active');
      if (chatPanel)     chatPanel.style.display     = 'none';
      if (analysisPanel) analysisPanel.style.display = 'block';
      // Show badge
      const badge = document.getElementById('analyze-tab-badge');
      if (badge) badge.style.display = 'inline-flex';
    }
  };


  /* ==============================================================
     SECTION: features/product-analysis.js — AI Product Analysis
  ============================================================== */

  window.analyzeProductWithAI = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    lastAnalyzedProduct = product;
    closeProductModal();
    showPage('ai');

    // Switch to analysis tab
    setTimeout(() => {
      switchAITab('analysis');
      runProductAnalysis(product);
    }, 100);
  };

  async function runProductAnalysis(product) {
    const panel = document.getElementById('product-analysis-panel');

    if (!geminiKey) {
      if (panel) {
        panel.innerHTML = `
          <div class="analysis-placeholder">
            <div class="analysis-placeholder-icon"><i class="fas fa-key"></i></div>
            <h3>Gemini API Key Required</h3>
            <p>Enter your Gemini API key in the "Chat &amp; Advice" tab first to enable product analysis.</p>
            <button class="btn btn-primary" onclick="switchAITab('chat')">
              <i class="fas fa-key"></i> Enter API Key
            </button>
          </div>`;
      }
      return;
    }

    if (!panel) return;

    // Show loading state
    panel.innerHTML = `
      <div class="analysis-loading">
        <div class="spinner"></div>
        <p>Analyzing "${product.name}"…</p>
        <small>Comparing prices, routes, and deal quality</small>
      </div>`;

    const payMethods = (product.payment_methods || ['cash']).join(', ');
    const tradeNote  = product.trade_for ? `Seller wants to trade for: ${product.trade_for}` : 'No trade specified';
    const userLoc    = userLocation || 'Not specified';

    const prompt = `
You are an anti-scalp collector marketplace assistant for OBTAINUM. Analyze this product listing and return a structured JSON object with your analysis.

LISTING DETAILS:
- Product: ${product.name}
- Category: ${product.category}
- Price: $${product.price}
- MSRP / Original Retail: ${product.msrp ? '$' + product.msrp : 'Unknown'}
- Condition: ${product.condition}
- Seller Location: ${product.location || 'Unknown'}
- Buyer Location: ${userLoc}
- Payment Methods: ${payMethods}
- Trade details: ${tradeNote}
- Shipping: ${product.shipping}
- Is Fair Priced: ${product.is_fair}

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "deal_score": <number 0-100>,
  "deal_label": "<Great Deal|Good Deal|Fair Deal|Poor Deal>",
  "price_analysis": "<2-3 sentences comparing price to market, MSRP, and typical resale value>",
  "alternatives": "<1-2 sentences about where to find similar items — in this marketplace and outside it>",
  "pickup_route": "<1-2 sentences about the local pickup route if both locations are known, or shipping options if not local>",
  "area_safety": "<1 sentence about meeting in public places safely, relevant to the seller's city>",
  "shipping_eta": "<1 sentence about estimated shipping time based on locations, or 'N/A — local pickup only'>",
  "verdict": "<1 bold sentence summarizing whether the buyer should go for it>"
}`;

    try {
      const res = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let analysis;
      try {
        // Strip any accidental code fences
        const cleaned = rawText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        analysis = JSON.parse(cleaned);
      } catch {
        throw new Error('AI returned unexpected format. Try again.');
      }

      renderAnalysisResult(product, analysis);

    } catch (err) {
      const errPanel = document.getElementById('product-analysis-panel');
      if (errPanel) {
        errPanel.innerHTML = `
          <div class="analysis-placeholder">
            <div class="analysis-placeholder-icon" style="background:#fff0f5;color:var(--danger);"><i class="fas fa-exclamation-triangle"></i></div>
            <h3>Analysis Failed</h3>
            <p style="color:var(--danger);">${err.message}</p>
            <button class="btn btn-primary" onclick="window.runProductAnalysis(window.lastAnalyzedProduct)">
              <i class="fas fa-redo"></i> Try Again
            </button>
          </div>`;
      }
    }
  }
  window.runProductAnalysis = runProductAnalysis;
  window.lastAnalyzedProduct = null;

  function renderAnalysisResult(product, a) {
    const panel = document.getElementById('product-analysis-panel');
    if (!panel) return;

    const scoreClass = a.deal_score >= 75 ? 'deal-great' : a.deal_score >= 55 ? 'deal-good' : a.deal_score >= 35 ? 'deal-fair' : 'deal-poor';

    panel.innerHTML = `
      <div class="analysis-result">
        <div class="analysis-product-header">
          <div class="analysis-product-thumb"><i class="fas ${getCategoryIcon(product.category)}"></i></div>
          <div class="analysis-product-title">
            <h3>${product.name}</h3>
            <p>${formatPrice(product.price)} · ${product.condition} · ${product.location || 'Unknown location'}</p>
          </div>
          <div class="deal-score-badge ${scoreClass}">
            <span class="score-num">${a.deal_score}</span>
            <span style="font-size:0.7rem;">${a.deal_label}</span>
          </div>
        </div>
        <div class="analysis-sections">
          <div class="analysis-section">
            <div class="analysis-section-title"><i class="fas fa-chart-line"></i> Price vs Market</div>
            <div class="analysis-body">${a.price_analysis}</div>
          </div>
          <div class="analysis-section">
            <div class="analysis-section-title"><i class="fas fa-search"></i> Alternatives</div>
            <div class="analysis-body">${a.alternatives}</div>
          </div>
          <div class="analysis-section">
            <div class="analysis-section-title"><i class="fas fa-route"></i> Pickup Route</div>
            <div class="analysis-body">${a.pickup_route}</div>
          </div>
          <div class="analysis-section">
            <div class="analysis-section-title"><i class="fas fa-shield-alt"></i> Safety Note</div>
            <div class="analysis-body">${a.area_safety}</div>
          </div>
          <div class="analysis-section">
            <div class="analysis-section-title"><i class="fas fa-shipping-fast"></i> Shipping ETA</div>
            <div class="analysis-body">${a.shipping_eta}</div>
          </div>
          <div class="analysis-section" style="background:var(--surface-2);">
            <div class="analysis-section-title"><i class="fas fa-gavel"></i> Verdict</div>
            <div class="analysis-body"><strong>${a.verdict}</strong></div>
          </div>
        </div>
        <div style="padding:16px 24px;text-align:center;">
          <button class="btn btn-outline btn-sm" onclick="openProductModal(${product.id})">
            <i class="fas fa-arrow-left"></i> Back to Listing
          </button>
        </div>
      </div>`;
  }


  /* ==============================================================
     SECTION: pages/donate.js — Donate Page Logic
  ============================================================== */

  let selectedCharityId   = null;
  let selectedCharityName = '';

  window.selectCharity = function (id, name, city) {
    selectedCharityId   = id;
    selectedCharityName = name;

    // Highlight selected card
    document.querySelectorAll('.charity-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.charity-card[data-charity-id="${id}"]`)?.classList.add('selected');

    // Update form header
    const display = document.getElementById('donate-selected-charity');
    const nameEl  = document.getElementById('donate-charity-name-display');
    const hiddenId   = document.getElementById('donate-charity-id');
    const hiddenName = document.getElementById('donate-charity-name');
    if (display)    display.style.display = 'flex';
    if (nameEl)     nameEl.textContent = `${name} — ${city}`;
    if (hiddenId)   hiddenId.value = id;
    if (hiddenName) hiddenName.value = name;

    showToast('Charity selected', `${name} selected. Fill in the form to donate.`, 'success');

    // Scroll form into view on mobile
    if (window.innerWidth < 900) {
      document.getElementById('donate-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.clearDonateCharity = function () {
    selectedCharityId   = null;
    selectedCharityName = '';
    document.querySelectorAll('.charity-card').forEach(c => c.classList.remove('selected'));
    const display = document.getElementById('donate-selected-charity');
    if (display) display.style.display = 'none';
    const hiddenId   = document.getElementById('donate-charity-id');
    const hiddenName = document.getElementById('donate-charity-name');
    if (hiddenId)   hiddenId.value = '';
    if (hiddenName) hiddenName.value = '';
  };

  // Donation method toggle
  document.querySelectorAll('input[name="donate-method"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const dropoff = document.getElementById('donate-dropoff-info');
      const ship    = document.getElementById('donate-ship-info');
      if (radio.value === 'dropoff') {
        if (dropoff) dropoff.style.display = 'flex';
        if (ship)    ship.style.display    = 'none';
      } else {
        if (dropoff) dropoff.style.display = 'none';
        if (ship)    ship.style.display    = 'flex';
      }
    });
  });

  // Donate form submit
  const donateForm = document.getElementById('donate-form');
  if (donateForm) {
    donateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const msgEl = document.getElementById('donate-form-msg');

      const itemName = document.getElementById('donate-item-name')?.value.trim();
      const category = document.getElementById('donate-category')?.value;
      const condition= document.getElementById('donate-condition')?.value;
      const location = document.getElementById('donate-your-location')?.value.trim();

      if (!selectedCharityId) {
        if (msgEl) { msgEl.style.display = 'block'; msgEl.className = 'form-msg error'; msgEl.textContent = 'Please select a charity from the list on the left.'; }
        return;
      }
      if (!itemName || !category || !condition || !location) {
        if (msgEl) { msgEl.style.display = 'block'; msgEl.className = 'form-msg error'; msgEl.textContent = 'Please fill in all required fields.'; }
        return;
      }

      if (msgEl) msgEl.style.display = 'none';
      const btn = document.getElementById('donate-submit-btn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';

      // Simulate async
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-heart"></i> Submit Donation';
        donateForm.reset();
        clearDonateCharity();

        if (msgEl) {
          msgEl.style.display = 'block';
          msgEl.className = 'form-msg success';
          msgEl.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Donation submitted!</strong> The charity will reach out within 24 hours with next steps. Thank you for giving back!`;
        }

        showToast('Donation submitted!', `${itemName} → ${selectedCharityName}`, 'success', 5000);
      }, 1400);
    });
  }


  /* ==============================================================
     SECTION: features/sell.js — Payment Method Toggle Handlers
  ============================================================== */

  function initPaymentMethodToggles() {
    const cashCheck  = document.querySelector('input[name="payment-method"][value="cash"]');
    const tradeCheck = document.querySelector('input[name="payment-method"][value="trade"]');
    const cashFields  = document.getElementById('sell-cash-fields');
    const tradeFields = document.getElementById('sell-trade-fields');

    function updateFields() {
      if (cashFields)  cashFields.style.display = cashCheck?.checked  ? 'block' : 'none';
      if (tradeFields) tradeFields.style.display = tradeCheck?.checked ? 'block' : 'none';
    }

    cashCheck?.addEventListener('change', updateFields);
    tradeCheck?.addEventListener('change', updateFields);
    updateFields();
  }

  initPaymentMethodToggles();


  /* ==============================================================
     SECTION: App Initialization
  ============================================================== */
  async function init() {
    // Assign mock payment_methods to products for demo variety
    const payVariants = [
      ['cash'],
      ['cash', 'trade'],
      ['cash', 'online'],
      ['cash'],
      ['cash', 'trade'],
      ['cash'],
      ['cash', 'online'],
      ['trade'],
      ['cash', 'trade', 'online'],
      ['cash'],
      ['cash'],
      ['trade'],
      ['cash'],
      ['cash', 'online'],
      ['cash'],
      ['cash', 'trade']
    ];
    const tradeItems = [
      '', 'Similar LEGO sets or Star Wars memorabilia', '', '', 'Other rare Pokémon sealed product',
      '', '', 'Other vintage Levi\'s or denim jackets', '', '', '', 'Other graded NBA rookie cards',
      '', '', '', 'Other vintage gaming gear'
    ];
    MOCK_PRODUCTS.forEach((p, i) => {
      if (!p.payment_methods) {
        p.payment_methods = payVariants[i % payVariants.length];
        p.meetup_spot  = p.payment_methods.includes('cash') ? 'Public library or police station lobby' : '';
        p.meetup_hours = p.payment_methods.includes('cash') ? 'Weekdays 5pm–8pm, weekends 10am–4pm' : '';
        p.trade_for    = tradeItems[i % tradeItems.length];
      }
    });

    // Load products (mock data; swap for Supabase query in production)
    products     = MOCK_PRODUCTS;
    filteredItems = products.slice();

    // Auth session
    await checkAuthSession();

    // Initial UI updates
    updateCartCount();
    updateNavUI();
    populateHomePage();

    // Initial shop filter state
    applyFilters();

    console.log(`OBTAINUM loaded: ${products.length} listings`);
  }

  init().catch(console.error);

}); // end DOMContentLoaded
