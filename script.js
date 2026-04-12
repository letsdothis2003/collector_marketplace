/* ============================================================
   OBTAINUM MARKETPLACE — script.js
   Vanilla JS, no frameworks. Connects to Supabase.
   Sections: CONFIG | STATE | THEME | ROUTER | AUTH |
             LISTINGS | WISHLIST | CREATE | PROFILE |
             DETAIL + AI | RENDER | ANIMATIONS | EVENTS | INIT
   ============================================================ */

// --- SECTION: DATABASE CONFIG ---
const SUPABASE_URL = "https://gotzmuobwuubsugnowxq.supabase.co";
const SUPABASE_URL_KEY = "sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs";

// db is declared with let so it stays accessible even if createClient throws
// (const would leave db in temporal dead zone on failure)
let db;
try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_URL_KEY);
} catch (e) {
  console.error('[OBTAINUM] Supabase init failed — check your URL and key:', e);
}

/* ============================================================
   SECTION: STATE MANAGEMENT — Global app state
   All constants and state hoisted to top so inline onclick
   handlers never hit a temporal dead zone on deferred modules
   ============================================================ */

// Pages list used by router — must be declared before navigate() is called
const PAGES = ['shop', 'detail', 'create', 'profile', 'wishlist'];

const CATEGORIES = [
  'Collectibles', 'Electronics', 'Clothing & Accessories',
  'Toys & Figures', 'Sports & Outdoors', 'Books & Media',
  'Home & Garden', 'Tools & Equipment', 'Other'
];

const CONDITION_LABELS = {
  'new': '✦ New',
  'like-new': '✦ Like New',
  'good': '✦ Good',
  'fair': '✦ Fair',
  'poor': '✦ Poor'
};

const State = {
  user: null,
  profile: null,
  currentPage: 'shop',
  listings: [],
  filteredListings: [],
  wishlistIds: new Set(),
  activeCategory: 'all',
  activeCondition: 'all',
  searchQuery: '',
  priceMin: null,
  priceMax: null,
  sortBy: 'newest',
  selectedListing: null,
  imageFiles: [],
  isOnline: navigator.onLine
};

/* ============================================================
   SECTION: THEME TOGGLE — Dark / Light mode
   ============================================================ */

function initTheme() {
  const saved = localStorage.getItem('obtainum-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(mode) {
  document.body.classList.toggle('light-mode', mode === 'light');
  localStorage.setItem('obtainum-theme', mode);
  const label = document.getElementById('theme-label');
  if (label) label.textContent = mode === 'dark' ? 'DARK' : 'LIGHT';
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-mode');
  applyTheme(isLight ? 'dark' : 'light');
}

/* ============================================================
   SECTION: ROUTER / NAVIGATION — Single-page navigation
   ============================================================ */

function navigate(page) {
  if (!PAGES.includes(page)) page = 'shop';

  // Deactivate all pages
  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });

  // Activate target page
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  State.currentPage = page;
  updateNavActive(page);

  // Load page-specific data
  if (page === 'shop') loadListings();
  if (page === 'profile') loadProfile();
  if (page === 'wishlist') loadWishlist();
  if (page === 'create') initCreatePage();
}

function updateNavActive(page) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const el = document.getElementById('nav-' + page);
  if (el) el.classList.add('active');
}

/* ============================================================
   SECTION: AUTH MODULE — Login, Register, Session, Sign Out
   ============================================================ */

async function initAuth() {
  if (!db) return;
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    await onAuthChange(session.user);
  }

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await onAuthChange(session.user);
    } else {
      onSignOut();
    }
  });
}

async function onAuthChange(user) {
  State.user = user;

  // The DB has a trigger to create a profile. We just need to fetch it.
  // It might take a moment to be created after auth, so we retry a few times.
  const fetchProfileWithRetry = async (retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
      const { data: profile, error } = await db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) return profile; // Success

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile:", error);
        return null; // Don't retry on unexpected errors
      }

      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
    console.error("Could not fetch user profile after multiple attempts. The database trigger might be missing or failing.");
    return null;
  };

  const profile = await fetchProfileWithRetry();

  if (profile) {
    State.profile = profile;
    const profileAge = new Date() - new Date(profile.created_at);
    if (profileAge < 6000) { // If profile is newer than 6s, show welcome.
      showToast(`Welcome, ${profile.username}! Your profile is ready.`, 'success');
    }
  } else {
    State.profile = null;
    showToast('Could not load your user profile.', 'error');
  }

  updateAuthUI();
  await loadWishlistIds();
}

function onSignOut() {
  State.user = null;
  State.profile = null;
  State.wishlistIds.clear();
  updateAuthUI();
  navigate('shop');
}

function updateAuthUI() {
  const btnWrap = document.getElementById('auth-btn-wrap');
  const avatarWrap = document.getElementById('user-avatar-wrap');
  const avatar = document.getElementById('header-avatar');

  if (State.user && State.profile) {
    btnWrap.classList.add('hidden');
    avatarWrap.classList.remove('hidden');
    const name = State.profile.username || State.user.email || '?';
    if (State.profile.avatar_url) {
      avatar.innerHTML = `<img src="${State.profile.avatar_url}" alt="${name}" />`;
    } else {
      avatar.textContent = name.charAt(0).toUpperCase();
    }
  } else {
    btnWrap.classList.remove('hidden');
    avatarWrap.classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  setLoading(btn, true, 'LOGGING IN...');
  errEl.classList.remove('show');

  try {
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    closeModal('auth-modal');
    showToast('Welcome back to OBTAINUM!', 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Login failed. Check your credentials.';
    errEl.classList.add('show');
  } finally {
    setLoading(btn, false, 'LOGIN TO OBTAINUM');
  }
}

async function signInWithGoogle() {
  if (!db) return;
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) showToast('Google sign-in failed: ' + error.message, 'error');
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('register-error');
  const btn = document.getElementById('register-btn');

  setLoading(btn, true, 'CREATING ACCOUNT...');
  errEl.classList.remove('show');

  try {
    // The handle_new_user trigger in SQL will create the profile.
    // We pass the username in the metadata for the trigger to use.
    const { data, error } = await db.auth.signUp({
      email,
      password: pass,
      options: { data: { username } }
    });
    if (error) throw error;

    if (data.session) {
      closeModal('auth-modal');
    } else {
      document.getElementById('register-form-wrap').innerHTML = `
        <div class="auth-confirm-panel">
          <div class="confirm-icon">✉️</div>
          <div class="confirm-title">CHECK YOUR EMAIL</div>
          <div class="confirm-msg">
            We sent a confirmation link to<br>
            <strong>${email}</strong><br><br>
            Click it to activate your OBTAINUM account.
          </div>
          <button class="btn btn-outline w-full" onclick="closeModal('auth-modal')">GOT IT</button>
        </div>
      `;
    }
  } catch (err) {
    errEl.textContent = err.message || 'Registration failed.';
    errEl.classList.add('show');
  } finally {
    const currentBtn = document.getElementById('register-btn');
    if (currentBtn) setLoading(currentBtn, false, 'CREATE ACCOUNT');
  }
}

async function signOut() {
  if (!db) return;
  await db.auth.signOut();
  showToast('Signed out successfully.', 'info');
}

function openAuthModal() {
  document.getElementById('auth-modal').classList.add('open');
}

function switchAuthTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('auth-login');
  const regForm = document.getElementById('auth-register');

  loginTab.classList.toggle('active', tab === 'login');
  regTab.classList.toggle('active', tab !== 'login');
  loginForm.classList.toggle('hidden', tab !== 'login');
  regForm.classList.toggle('hidden', tab === 'login');
}

/* ============================================================
   SECTION: LISTINGS MODULE — Fetch, Filter, Search, Sort
   ============================================================ */

async function loadListings() {
  if (!db) { renderListings([]); return; }
  try {
    showSkeletons();
    const { data, error } = await db
      .from('listings')
      .select('*, profiles:seller_id(username, avatar_url)')
      .eq('is_sold', false)
      .order('created_at', { ascending: false });
    if (error) throw error;

    State.listings = data || [];
    applyFilters();
    hideErrorBanner();
  } catch (err) {
    console.error('Error loading listings:', err);
    showErrorBanner();
    renderListings([]);
  }
}

function applyFilters() {
  let results = [...State.listings];
  const q = State.searchQuery.toLowerCase();

  if (q.length >= 2) {
    results = results.filter(l =>
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.description && l.description.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q)) ||
      (l.tags && l.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  if (State.activeCategory !== 'all') {
    results = results.filter(l => l.category === State.activeCategory);
  }
  if (State.activeCondition !== 'all') {
    results = results.filter(l => l.condition === State.activeCondition);
  }

  const minP = parseFloat(document.getElementById('price-min')?.value);
  const maxP = parseFloat(document.getElementById('price-max')?.value);
  if (!isNaN(minP)) results = results.filter(l => l.price >= minP);
  if (!isNaN(maxP)) results = results.filter(l => l.price <= maxP);

  if (document.getElementById('fair-only')?.checked) {
    results = results.filter(l => l.is_fair);
  }
  if (document.getElementById('featured-only')?.checked) {
    results = results.filter(l => l.is_featured);
  }

  const sort = document.getElementById('sort-select')?.value || 'newest';
  if (sort === 'price-asc') results.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') results.sort((a, b) => b.price - a.price);
  else if (sort === 'popular') results.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  else results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  State.filteredListings = results;
  document.getElementById('results-count').textContent = results.length;
  renderListings(results);
}

function selectCategory(btn, cat) {
  document.querySelectorAll('#category-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  State.activeCategory = cat;
  applyFilters();
}

function selectCondition(btn, cond) {
  document.querySelectorAll('#condition-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  State.activeCondition = cond;
  applyFilters();
}

function onPriceSlider(slider) {
  document.getElementById('price-slider-val').textContent = '$' + slider.value;
  document.getElementById('price-max').value = slider.value;
  applyFilters();
}

function resetFilters() {
  State.activeCategory = 'all';
  State.activeCondition = 'all';
  State.searchQuery = '';

  document.getElementById('search-input').value = '';
  document.getElementById('price-min').value = '';
  document.getElementById('price-max').value = '';
  document.getElementById('price-slider').value = 2000;
  document.getElementById('price-slider-val').textContent = '$2000';
  document.getElementById('fair-only').checked = false;
  document.getElementById('featured-only').checked = false;
  document.getElementById('sort-select').value = 'newest';

  document.querySelectorAll('.chip[data-cat]').forEach(c =>
    c.classList.toggle('active', c.dataset.cat === 'all'));
  document.querySelectorAll('.chip[data-cond]').forEach(c =>
    c.classList.toggle('active', c.dataset.cond === 'all'));
  applyFilters();
  showToast('Filters reset.', 'info');
}

/* ============================================================
   SECTION: WISHLIST MODULE — Load, Add, Remove
   ============================================================ */

async function loadWishlistIds() {
  if (!State.user) return;
  const { data } = await db
    .from('wishlists')
    .select('listing_id')
    .eq('user_id', State.user.id);
  State.wishlistIds = new Set((data || []).map(w => w.listing_id));
}

async function loadWishlist() {
  const container = document.getElementById('wishlist-grid');
  const notice = document.getElementById('wishlist-auth-notice');

  if (!State.user) {
    notice.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }
  notice.classList.add('hidden');

  try {
    const { data, error } = await db
      .from('wishlists')
      .select('listing_id, listings:listing_id(*, profiles:seller_id(username, avatar_url))')
      .eq('user_id', State.user.id);
    if (error) throw error;

    const listings = (data || []).map(w => w.listings).filter(Boolean);
    if (listings.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#9825;</div><div class="empty-title">YOUR WISHLIST IS EMPTY</div></div>`;
    } else {
      container.innerHTML = '';
      container.classList.add('stagger');
      listings.forEach(l => container.appendChild(createListingCard(l)));
      animateCards(container);
    }
  } catch (err) {
    console.error('Error loading wishlist:', err);
  }
}

async function toggleWishlist(e, listingId) {
  e.stopPropagation();
  if (!State.user) { openAuthModal(); return; }

  const btn = e.currentTarget;
  const isWished = State.wishlistIds.has(listingId);

  btn.classList.toggle('active', !isWished);
  isWished ? State.wishlistIds.delete(listingId) : State.wishlistIds.add(listingId);

  try {
    if (isWished) {
      await db.from('wishlists').delete().match({ user_id: State.user.id, listing_id: listingId });
      showToast('Removed from wishlist.', 'info');
    } else {
      await db.from('wishlists').insert({ user_id: State.user.id, listing_id: listingId });
      showToast('Added to wishlist!', 'success');
    }
  } catch (err) {
    btn.classList.toggle('active', isWished);
    isWished ? State.wishlistIds.add(listingId) : State.wishlistIds.delete(listingId);
    showToast('Could not update wishlist.', 'error');
  }
}

/* ============================================================
   SECTION: CREATE LISTING MODULE — Form, Image Upload, Submit
   ============================================================ */

function initCreatePage() {
  const notice = document.getElementById('create-auth-notice');
  const form = document.getElementById('create-form');
  const isAuthed = State.user && State.profile;
  notice.classList.toggle('hidden', isAuthed);
  form.classList.toggle('hidden', !isAuthed);
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const max = 10 - State.imageFiles.length;
  files.slice(0, max).forEach(file => {
    if (file.type.startsWith('image/')) {
      State.imageFiles.push(file);
    }
  });
  renderImagePreviews();
}

function addImagePreview(src, index) {
  const grid = document.getElementById('image-preview-grid');
  const item = document.createElement('div');
  item.className = 'image-preview-item animate-pop';
  item.dataset.index = index;
  item.innerHTML = `<img src="${src}" alt="Preview" /><button class="remove-image" onclick="removeImage(${index})">&times;</button>`;
  grid.appendChild(item);
}

function removeImage(index) {
  State.imageFiles.splice(index, 1);
  renderImagePreviews();
}

function renderImagePreviews() {
  const grid = document.getElementById('image-preview-grid');
  grid.innerHTML = '';
  State.imageFiles.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, i);
    reader.readAsDataURL(file);
  });
}

async function uploadImages(userId) {
  const urls = [];
  for (const file of State.imageFiles) {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await db.storage.from('listing-images').upload(path, file);
    if (error) {
      console.error('Error uploading image:', error);
    } else {
      const { data } = db.storage.from('listing-images').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
  }
  return urls;
}

async function submitListing(e) {
  e.preventDefault();
  if (!State.user || !State.user.id) {
    showToast('You must be logged in to create a listing.', 'error');
    openAuthModal();
    return;
  }

  const errEl = document.getElementById('create-error');
  const btn = document.getElementById('create-submit');
  errEl.classList.remove('show');
  setLoading(btn, true, 'PUBLISHING...');

  try {
    const imageUrls = State.imageFiles.length > 0 ? await uploadImages(State.user.id) : [];
    
    const price = parseFloat(document.getElementById('c-price').value);
    const msrp = parseFloat(document.getElementById('c-msrp').value) || null;
    const tagsRaw = document.getElementById('c-tags').value;

    const listingData = {
      seller_id: State.user.id,
      name: document.getElementById('c-name').value.trim(),
      category: document.getElementById('c-category').value,
      description: document.getElementById('c-desc').value.trim(),
      price: price,
      msrp: msrp,
      condition: document.getElementById('c-condition').value,
      type: document.getElementById('c-type').value,
      shipping: document.getElementById('c-shipping').value,
      location: document.getElementById('c-location').value.trim() || null,
      tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
      images: imageUrls,
      is_fair: msrp ? price <= msrp * 1.2 : false,
    };

    if (!listingData.seller_id) throw new Error("User ID is missing. Cannot create listing.");
    console.log("Submitting listing:", listingData);

    const { data: newListing, error } = await db
      .from('listings')
      .insert(listingData)
      .select('*, profiles:seller_id(*)')
      .single();

    if (error) throw error;

    State.listings.unshift(newListing);
    e.target.reset();
    State.imageFiles = [];
    renderImagePreviews();

    showToast('Listing published successfully!', 'success');
    navigate('shop');

  } catch (err) {
    console.error('Error publishing listing:', err);
    errEl.textContent = err.message || 'Publishing failed. Check console for details.';
    errEl.classList.add('show');
  } finally {
    setLoading(btn, false, 'PUBLISH LISTING');
  }
}

/* ============================================================
   SECTION: PROFILE MODULE — Load, Update, Tabs
   ============================================================ */

async function loadProfile() {
  if (!State.profile) {
    navigate('shop');
    openAuthModal();
    return;
  }

  const p = State.profile;
  document.getElementById('profile-avatar-lg').innerHTML = p.avatar_url ? `<img src="${p.avatar_url}" />` : p.username.charAt(0).toUpperCase();
  document.getElementById('profile-username').textContent = p.username.toUpperCase();
  document.getElementById('profile-email').textContent = State.user.email;
  document.getElementById('profile-bio').textContent = p.bio || '';

  document.getElementById('s-username').value = p.username || '';
  document.getElementById('s-bio').value = p.bio || '';
  document.getElementById('s-location').value = p.location || '';

  await loadProfileListings();
}

async function loadProfileListings() {
  if (!State.user) return;

  const { data, error } = await db
    .from('listings')
    .select('*, profiles:seller_id(*)')
    .eq('seller_id', State.user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error("Couldn't load profile listings", error); return; }

  const active = data.filter(l => !l.is_sold);
  const sold = data.filter(l => l.is_sold);

  animateNumber(document.getElementById('stat-listings'), data.length);
  animateNumber(document.getElementById('stat-views'), data.reduce((s, l) => s + (l.view_count || 0), 0));
  animateNumber(document.getElementById('stat-favorites'), data.reduce((s, l) => s + (l.favorite_count || 0), 0));

  const renderGrid = (selector, items, emptyHTML) => {
    const grid = document.getElementById(selector);
    if (items.length === 0) {
      grid.innerHTML = emptyHTML;
    } else {
      grid.innerHTML = '';
      items.forEach(l => grid.appendChild(createListingCard(l)));
      animateCards(grid);
    }
  };

  renderGrid('profile-listings-grid', active, `<div class="empty-state"><div class="empty-icon">&#128722;</div><div class="empty-title">NO ACTIVE LISTINGS</div></div>`);
  renderGrid('profile-sold-grid', sold, `<div class="empty-state"><div class="empty-icon">&#10003;</div><div class="empty-title">NO SOLD ITEMS</div></div>`);
}

async function saveProfile(e) {
  e.preventDefault();
  if (!State.user) return;

  const updates = {
    username: document.getElementById('s-username').value.trim(),
    bio: document.getElementById('s-bio').value.trim(),
    location: document.getElementById('s-location').value.trim(),
    updated_at: new Date(),
  };

  const { error } = await db.from('profiles').update(updates).eq('id', State.user.id);

  if (error) {
    showToast('Failed to save profile: ' + error.message, 'error');
  } else {
    State.profile = { ...State.profile, ...updates };
    updateAuthUI(); // To update avatar if username changed
    showToast('Profile updated!', 'success');
  }
}

function switchProfileTab(btn) {
  const tab = btn.dataset.ptab;
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['my-listings', 'sold', 'settings'].forEach(t => {
    document.getElementById('ptab-' + t).classList.toggle('hidden', t !== tab);
  });
}

/* ============================================================
   SECTION: ITEM DETAIL MODULE — View, AI Insights, Similar Items
   ============================================================ */

async function openListing(listingId) {
  navigate('detail');
  const content = document.getElementById('detail-content');
  content.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';

  try {
    const { data: listing, error } = await db
      .from('listings')
      .select('*, profiles:seller_id(*)')
      .eq('id', listingId)
      .single();

    if (error) throw error;
    State.selectedListing = listing;

    db.from('listings')
      .update({ view_count: (listing.view_count || 0) + 1 })
      .eq('id', listingId)
      .then(() => {});

    renderDetail(listing);
    loadSimilarItems(listing);
  } catch (err) {
    console.error('Detail error:', err);
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">&#9888;</div><div class="empty-title">LISTING NOT FOUND</div></div>`;
  }
}

function renderDetail(listing) {
  const content = document.getElementById('detail-content');
  const seller = listing.profiles || {};
  const savings = listing.msrp && listing.price < listing.msrp ? Math.round((1 - listing.price / listing.msrp) * 100) : null;

  const imagesHtml = listing.images?.length > 0
    ? `<img src="${listing.images[0]}" alt="${escHtml(listing.name)}" id="main-detail-img" />`
    : `<div class="card-no-image">${categoryIcon(listing.category)}</div>`;

  const thumbsHtml = listing.images?.length > 1
    ? `<div class="image-thumbs">${listing.images.map((img, i) => 
        `<div class="image-thumb ${i === 0 ? 'active' : ''}" onclick="switchDetailImage('${img}', this)"><img src="${img}" /></div>`
      ).join('')}</div>`
    : '';

  content.innerHTML = `
    <div class="detail-images animate-fade">${imagesHtml}${thumbsHtml}</div>
    <div class="detail-info">
      <h1 class="detail-title">${escHtml(listing.name)}</h1>
      <div class="detail-price-row">
        <span class="detail-price">$${listing.price.toFixed(2)}</span>
        ${listing.msrp ? `<span class="detail-msrp">$${listing.msrp.toFixed(2)} MSRP</span>` : ''}
        ${savings ? `<span class="detail-savings">${savings}% OFF</span>` : ''}
      </div>
      <div class="detail-badges">
        <span class="badge">${CONDITION_LABELS[listing.condition]}</span>
        <span class="badge">${listing.type.toUpperCase()}</span>
        ${listing.is_fair ? '<span class="badge fair">AI FAIR PRICE</span>' : ''}
      </div>
      <p class="detail-description">${escHtml(listing.description)}</p>
      <div class="seller-card">
        <div class="seller-avatar">${seller.avatar_url ? `<img src="${seller.avatar_url}" />` : (seller.username || '?').charAt(0)}</div>
        <div>
          <div class="seller-name">${escHtml(seller.username)}</div>
          <div class="seller-location">${escHtml(seller.location) || 'Unknown location'}</div>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary">BUY NOW</button>
        <button class="btn btn-outline" onclick="toggleWishlist(event, '${listing.id}')">
          ${State.wishlistIds.has(listing.id) ? 'WISHLISTED' : 'ADD TO WISHLIST'}
        </button>
      </div>
      <div class="ai-panel">
        <div class="ai-label"><span class="ai-dot"></span>AI ANALYSIS</div>
        <div class="ai-insights" id="ai-insights">Analyzing...</div>
      </div>
    </div>`;

  setTimeout(() => generateAIInsights(listing), 500);
}

function switchDetailImage(src, thumbEl) {
  document.getElementById('main-detail-img').src = src;
  document.querySelectorAll('.image-thumb').forEach(t => t.classList.remove('active'));
  thumbEl.classList.add('active');
}

function generateAIInsights(listing) {
  const panel = document.getElementById('ai-insights');
  const insights = [];
  const { price, msrp, condition, is_fair } = listing;

  if (is_fair) {
    insights.push({ type: 'positive', text: `AI Fair Price: Our model confirms this is a fair price based on its MSRP of $${msrp.toFixed(2)}.` });
  } else if (msrp && price > msrp * 1.5) {
    insights.push({ type: 'warning', text: `Price Alert: ${Math.round((price/msrp - 1)*100)}% above MSRP.` });
  } else if (!msrp) {
    insights.push({ type: 'neutral', text: 'No MSRP provided for price analysis.' });
  }

  const conditionMap = {
    'new': 'Mint condition expected.',
    'like-new': 'Minimal use. Great for collectors.',
    'good': 'Indicates normal wear.',
    'fair': 'May have visible flaws.',
    'poor': 'Best for parts or restoration.'
  };
  insights.push({ type: 'info', text: `Condition: ${conditionMap[condition]}` });

  panel.innerHTML = insights.map(ins => 
    `<div class="ai-insight ${ins.type}">${ins.text}</div>`
  ).join('');
}

async function loadSimilarItems(listing) {
  const scroll = document.getElementById('similar-scroll');
  scroll.innerHTML = '';
  try {
    const { data } = await db
      .from('listings')
      .select('*, profiles:seller_id(*)')
      .eq('category', listing.category)
      .neq('id', listing.id)
      .limit(10);

    if (data && data.length > 0) {
      data.forEach(l => scroll.appendChild(createListingCard(l)));
    } else {
      document.getElementById('similar-section').style.display = 'none';
    }
  } catch (err) {
    document.getElementById('similar-section').style.display = 'none';
  }
}

/* ============================================================
   SECTION: RENDER ENGINE — Card creation, skeleton, etc.
   ============================================================ */

function createListingCard(listing) {
  const card = document.createElement('div');
  card.className = 'listing-card animate-fade-up';
  card.onclick = () => openListing(listing.id);

  const img = listing.images?.length > 0
    ? `<img src="${listing.images[0]}" alt="${escHtml(listing.name)}" loading="lazy" />`
    : `<div class="card-no-image">${categoryIcon(listing.category)}</div>`;

  card.innerHTML = `
    <div class="card-image-wrap">
      ${img}
      ${listing.is_fair ? '<span class="card-badge fair">AI FAIR</span>' : ''}
      <button class="wishlist-btn ${State.wishlistIds.has(listing.id) ? 'active' : ''}"
        onclick="toggleWishlist(event, '${listing.id}')">&#9825;</button>
    </div>
    <div class="card-body">
      <div class="card-title">${escHtml(listing.name)}</div>
      <div class="card-price">$${listing.price.toFixed(2)}</div>
      <div class="card-meta">
        <span>${listing.condition}</span>
        <span>${escHtml(listing.location) || 'N/A'}</span>
      </div>
    </div>`;
  return card;
}

function renderListings(listings) {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;

  if (!listings || listings.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128269;</div>
        <div class="empty-title">NO LISTINGS FOUND</div>
        <div class="empty-sub">
          ${State.listings.length === 0
            ? 'Be the first to list something for sale!'
            : 'Try adjusting your search or filters.'}
        </div>
        ${State.user ? `<br/><button class="btn btn-primary" onclick="navigate('create')">+ LIST AN ITEM</button>` : ''}
      </div>`;
    return;
  }

  grid.innerHTML = '';
  grid.classList.add('stagger');
  listings.forEach(l => grid.appendChild(createListingCard(l)));
  animateCards(grid);
}

function showSkeletons() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill('').map(() => `<div class="skeleton-card skeleton"></div>`).join('');
}

function categoryIcon(cat) {
  const icons = {
    'Collectibles': '&#127942;', 'Electronics': '&#128267;', 'Clothing & Accessories': '&#128084;',
    'Toys & Figures': '&#9875;', 'Sports & Outdoors': '&#9917;', 'Books & Media': '&#128218;',
    'Home & Garden': '&#127968;', 'Tools & Equipment': '&#128296;', 'Other': '&#128722;'
  };
  return icons[cat] || '&#128722;';
}

/* ============================================================
   SECTION: ANIMATIONS & UI UTILS
   ============================================================ */

function animateCards(container) {
  container.querySelectorAll('.listing-card, .skeleton-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 0.05}s`;
  });
}

function animateNumber(el, target) {
  const duration = 800, start = performance.now(), startVal = parseInt(el.textContent) || 0;
  const step = (ts) => {
    const p = Math.min((ts - start) / duration, 1);
    el.textContent = Math.round(startVal + (target - startVal) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function closeOnOverlay(e, id) {
  if (e.target.id === id) closeModal(id);
}

function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

function setLoading(btn, isLoading, text) {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="spinner"></span> ${text}` : text;
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"'`]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]));
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '&#10003;', error: '&#9888;', info: '&#9432;' };
  const toast = Object.assign(document.createElement('div'), {
    className: `toast ${type}`,
    innerHTML: `<span class="toast-icon">${icons[type]}</span><span>${escHtml(message)}</span>`
  });
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('exit'); toast.addEventListener('animationend', () => toast.remove()); }, 3500);
}

function showErrorBanner() { document.getElementById('error-banner')?.classList.add('show'); }
function hideErrorBanner() { document.getElementById('error-banner')?.classList.remove('show'); }

/* ============================================================
   SECTION: EVENT LISTENERS & INITIALIZATION
   ============================================================ */

function setupEventListeners() {
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('mobile-nav')?.classList.toggle('open');
  });

  let searchTimer;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    State.searchQuery = e.target.value;
    searchTimer = setTimeout(() => {
      if (State.currentPage !== 'shop') navigate('shop');
      applyFilters();
    }, 320);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('auth-modal');
      closeMobileNav();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  });

  window.addEventListener('online', () => { hideErrorBanner(); loadListings(); });
  window.addEventListener('offline', showErrorBanner);
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await initAuth();
  navigate('shop');
  console.log('%c OBTAINUM INITIALIZED ', 'background:#00ff41;color:#001a07;font-weight:bold;');
});
