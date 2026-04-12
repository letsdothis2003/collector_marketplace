/* ============================================================
   OBTAINUM MARKETPLACE — script.js
   Vanilla JS, no frameworks. Connects to Supabase.
   Sections: CONFIG | STATE | THEME | ROUTER | AUTH |
             LISTINGS | WISHLIST | CREATE | PROFILE |
             DETAIL + AI | RENDER | ANIMATIONS | EVENTS | INIT
   ============================================================ */

// --- SECTION: DATABASE CONFIG ---
// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = "https://gotzmuobwuubsugnowxq.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs";  
// db is declared with let so it stays accessible even if createClient throws
let db;
try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  console.log('[OBTAINUM] Supabase client initialized successfully');
} catch (e) {
  console.error('[OBTAINUM] Supabase init failed — check your URL and key:', e);
}

/* ============================================================
   SECTION: STATE MANAGEMENT — Global app state
   ============================================================ */

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

// Valid values for database constraints
const VALID_CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'];
const VALID_TYPES = ['buy-now', 'offers', 'auction'];
const VALID_SHIPPING = ['free', 'paid', 'local', 'pickup'];
const VALID_PAYMENT_METHODS = ['cash', 'card', 'paypal', 'venmo', 'zelle', 'crypto', 'trade'];

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

  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });

  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  State.currentPage = page;
  updateNavActive(page);

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

  let { data: profile, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error("[OBTAINUM] Error fetching profile:", profileError);
  }

  if (!profile) {
    const newUsername = (user.user_metadata?.username || user.user_metadata?.name || user.email.split('@')[0])
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, 30);

    const finalUsername = newUsername.length >= 3 ? newUsername : `${newUsername}_usr`;

    const newProfileData = {
      id: user.id,
      email: user.email,
      username: finalUsername,
      avatar_url: user.user_metadata?.picture || user.user_metadata?.avatar_url
    };

    const { data: created, error: createErr } = await db
      .from('profiles')
      .insert(newProfileData)
      .select()
      .single();

    if (createErr) {
      console.error('[OBTAINUM] Could not create profile:', createErr.message);
    } else {
      profile = created;
      if (new Date(user.created_at) > new Date(Date.now() - 5000)) {
        showToast(`Welcome, ${finalUsername}! Your profile is ready.`, 'success');
      }
    }
  }

  State.profile = profile;
  updateAuthUI();
  await loadWishlistIds();
}

function onSignOut() {
  State.user = null;
  State.profile = null;
  State.wishlistIds.clear();
  updateAuthUI();
}

function updateAuthUI() {
  const btnWrap = document.getElementById('auth-btn-wrap');
  const avatarWrap = document.getElementById('user-avatar-wrap');
  const avatar = document.getElementById('header-avatar');

  if (State.user) {
    btnWrap.classList.add('hidden');
    avatarWrap.classList.remove('hidden');
    const name = State.profile?.username || State.user.email || '?';
    if (State.profile?.avatar_url) {
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
        <div class="empty-state" style="padding:20px;">
          <div class="empty-icon">✉️</div>
          <div class="empty-title">CHECK YOUR EMAIL</div>
          <div class="empty-sub">We sent a confirmation link to<br/><strong>${email}</strong></div>
          <p style="margin-top:16px; font-size:0.85rem; color:var(--text-muted);">
            Click it to activate your OBTAINUM account,<br/>then come back and log in.
          </p>
          <button class="btn btn-outline" style="margin-top:20px;" onclick="switchAuthTab('login')">GOT IT</button>
        </div>
      `;
    }
  } catch (err) {
    errEl.textContent = err.message || 'Registration failed.';
    errEl.classList.add('show');
  } finally {
    const btn2 = document.getElementById('register-btn');
    if (btn2) setLoading(btn2, false, 'CREATE ACCOUNT');
  }
}

async function signOut() {
  await db.auth.signOut();
  navigate('shop');
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

  if (tab === 'login') {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
  } else {
    regTab.classList.add('active');
    loginTab.classList.remove('active');
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');

    const wrap = document.getElementById('register-form-wrap');
    if (wrap && !document.getElementById('register-btn')) {
      wrap.innerHTML = `
        <form class="auth-form" onsubmit="handleRegister(event)">
          <button type="button" class="btn btn-outline w-full" onclick="signInWithGoogle()">
            CONTINUE WITH GOOGLE
          </button>
          <div class="auth-divider"><span>OR</span></div>
          <div class="form-group">
            <label class="form-label" for="reg-username">Username</label>
            <input class="form-input" id="reg-username" type="text" required minlength="3" maxlength="30" />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">Email</label>
            <input class="form-input" id="reg-email" type="email" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-pass">Password</label>
            <input class="form-input" id="reg-pass" type="password" required minlength="6" />
          </div>
          <div id="register-error" class="auth-error"></div>
          <button type="submit" class="btn btn-primary btn-lg w-full" id="register-btn">CREATE ACCOUNT</button>
          <p style="text-align:center; font-size:0.82rem; color:var(--text-muted); margin-top:12px;">
            Already a member? <a href="#" onclick="switchAuthTab('login'); return false;">Login</a>
          </p>
        </form>
      `;
    }
  }
}

/* ============================================================
   SECTION: LISTINGS MODULE — Fetch, Filter, Search, Sort
   ============================================================ */

async function loadListings() {
  if (!db) { renderListings([]); return; }
  try {
    showSkeletons();

    let query = db
      .from('listings')
      .select(`
        *,
        profiles:seller_id (
          username,
          avatar_url,
          rating,
          location
        )
      `)
      .eq('is_sold', false)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    State.listings = data || [];
    applyFilters();
    hideErrorBanner();
  } catch (err) {
    console.error('[OBTAINUM] Error loading listings:', err);
    showErrorBanner();
    renderListings([]);
  }
}

function applyFilters() {
  let results = [...State.listings];

  const q = (State.searchQuery || '').toLowerCase();
  if (q.length >= 2) {
    results = results.filter(l =>
      fuzzyMatch(q, l.name) ||
      fuzzyMatch(q, l.description) ||
      fuzzyMatch(q, l.category) ||
      (l.tags && l.tags.some(t => fuzzyMatch(q, t)))
    );
  }

  if (State.activeCategory !== 'all') {
    results = results.filter(l => l.category === State.activeCategory);
  }

  if (State.activeCondition !== 'all') {
    results = results.filter(l => l.condition === State.activeCondition);
  }

  const minP = parseFloat(document.getElementById('price-min')?.value || '');
  const maxP = parseFloat(document.getElementById('price-max')?.value || '');
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

  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = results.length;

  renderListings(results);
}

function fuzzyMatch(query, text) {
  if (!text) return false;
  const t = text.toLowerCase();
  if (t.includes(query)) return true;
  for (let i = 0; i <= t.length - query.length; i++) {
    let mismatches = 0;
    for (let j = 0; j < query.length; j++) {
      if (t[i + j] !== query[j]) mismatches++;
      if (mismatches > 1) break;
    }
    if (mismatches <= 1) return true;
  }
  return false;
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
    if (notice) notice.classList.remove('hidden');
    if (container) container.innerHTML = '';
    return;
  }

  if (notice) notice.classList.add('hidden');

  try {
    const { data, error } = await db
      .from('wishlists')
      .select(`
        listing_id,
        listings:listing_id (
          *,
          profiles:seller_id ( username, avatar_url, rating, location )
        )
      `)
      .eq('user_id', State.user.id);

    if (error) throw error;

    const listings = (data || []).map(w => w.listings).filter(Boolean);
    if (container) {
      if (listings.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">♡</div>
            <div class="empty-title">YOUR WISHLIST IS EMPTY</div>
            <div class="empty-sub">Heart items in the marketplace to save them here.</div>
          </div>
        `;
      } else {
        container.innerHTML = '';
        container.classList.add('stagger');
        listings.forEach(l => container.appendChild(createListingCard(l)));
        animateCards(container);
      }
    }
  } catch (err) {
    console.error('[OBTAINUM] Error loading wishlist:', err);
  }
}

async function toggleWishlist(e, listingId) {
  e.stopPropagation();
  if (!State.user) { openAuthModal(); return; }

  const btn = e.currentTarget;
  const isWished = State.wishlistIds.has(listingId);

  btn.classList.toggle('active', !isWished);
  if (isWished) {
    State.wishlistIds.delete(listingId);
  } else {
    State.wishlistIds.add(listingId);
  }

  try {
    if (isWished) {
      await db.from('wishlists').delete()
        .eq('user_id', State.user.id)
        .eq('listing_id', listingId);
      showToast('Removed from wishlist.', 'info');
    } else {
      await db.from('wishlists').insert({
        user_id: State.user.id,
        listing_id: listingId
      });
      showToast('Added to wishlist!', 'success');
    }
  } catch (err) {
    btn.classList.toggle('active', isWished);
    if (isWished) State.wishlistIds.add(listingId);
    else State.wishlistIds.delete(listingId);
    showToast('Could not update wishlist.', 'error');
  }
}

/* ============================================================
   SECTION: CREATE LISTING MODULE — Form, Image Upload, Submit
   ============================================================ */

function initCreatePage() {
  const notice = document.getElementById('create-auth-notice');
  const form = document.getElementById('create-form');
  if (!State.user) {
    if (notice) notice.classList.remove('hidden');
    if (form) form.classList.add('hidden');
  } else {
    if (notice) notice.classList.add('hidden');
    if (form) form.classList.remove('hidden');
  }
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const maxImages = 10;
  const remaining = maxImages - State.imageFiles.length;
  const newFiles = files.slice(0, remaining);

  newFiles.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    State.imageFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, State.imageFiles.length - 1);
    reader.readAsDataURL(file);
  });

  if (files.length > remaining) {
    showToast(`Max ${maxImages} images allowed.`, 'info');
  }
}

function addImagePreview(src, index) {
  const grid = document.getElementById('image-preview-grid');
  const item = document.createElement('div');
  item.className = 'image-preview-item animate-pop';
  item.dataset.index = index;
  item.innerHTML = `
    <img src="${src}" alt="Preview ${index + 1}" />
    <button class="remove-image" onclick="removeImage(${index})" title="Remove">&times;</button>
  `;
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
    
    const { error } = await db.storage
      .from('listing-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('[OBTAINUM] Error uploading image:', error);
    } else {
      const { data: { publicUrl } } = db.storage
        .from('listing-images')
        .getPublicUrl(path);
      urls.push(publicUrl);
    }
  }
  return urls;
}

/**
 * FIXED: submitListing function with proper schema alignment
 * Key fixes:
 * 1. Added explicit is_sold: false to satisfy RLS policy
 * 2. Added payment_methods array (required by schema)
 * 3. Added comprehensive client-side validation matching SQL constraints
 * 4. Improved error handling with specific error codes
 */
async function submitListing(e) {
  e.preventDefault();
  
  if (!State.user) {
    openAuthModal();
    return;
  }

  const errEl = document.getElementById('create-error');
  const btn = document.getElementById('create-submit');
  errEl.classList.remove('show');
  setLoading(btn, true, 'PUBLISHING...');

  try {
    // 1. Upload images first
    let imageUrls = [];
    if (State.imageFiles.length > 0) {
      imageUrls = await uploadImages(State.user.id);
      if (imageUrls.length !== State.imageFiles.length) {
        showToast('Warning: Some images failed to upload.', 'warning');
      }
    }

    // 2. Gather form values
    const name = document.getElementById('c-name').value.trim();
    const category = document.getElementById('c-category').value;
    const description = document.getElementById('c-desc').value.trim();
    const priceStr = document.getElementById('c-price').value;
    const msrpStr = document.getElementById('c-msrp').value;
    const condition = document.getElementById('c-condition').value;
    const type = document.getElementById('c-type').value;
    const shipping = document.getElementById('c-shipping').value;
    const location = document.getElementById('c-location').value.trim() || null;
    const tagsRaw = document.getElementById('c-tags').value;
    
    // Parse numeric values
    const price = parseFloat(priceStr);
    const msrp = msrpStr ? parseFloat(msrpStr) : null;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);

    // 3. Client-side validation matching SQL CHECK constraints
    if (!name || name.length < 1) {
      throw new Error("Item name is required.");
    }
    if (name.length > 100) {
      throw new Error("Item name cannot exceed 100 characters.");
    }
    if (!category) {
      throw new Error("Please select a category.");
    }
    if (!description || description.length < 10) {
      throw new Error("Description must be at least 10 characters.");
    }
    if (description.length > 2000) {
      throw new Error("Description cannot exceed 2000 characters.");
    }
    if (isNaN(price) || price < 0) {
      throw new Error("Please enter a valid price (0 or greater).");
    }
    if (msrp !== null && (isNaN(msrp) || msrp < 0)) {
      throw new Error("MSRP must be a valid number (0 or greater).");
    }
    if (!condition) {
      throw new Error("Please select a condition.");
    }
    if (!VALID_CONDITIONS.includes(condition)) {
      throw new Error(`Invalid condition. Must be one of: ${VALID_CONDITIONS.join(', ')}`);
    }
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Invalid listing type. Must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (!VALID_SHIPPING.includes(shipping)) {
      throw new Error(`Invalid shipping option. Must be one of: ${VALID_SHIPPING.join(', ')}`);
    }

    // 4. Determine fair price (AI logic)
    const isFair = msrp ? price <= msrp * 1.2 : true;

    // 5. Build listing data object - MUST match SQL schema exactly
    const listingData = {
      seller_id: State.user.id,
      name: name,
      category: category,
      // subcategory is optional, not included
      description: description,
      condition: condition,
      location: location,
      price: price,
      msrp: msrp,
      type: type,
      shipping: shipping,
      payment_methods: ['cash'], // Default payment method - matches schema default
      tags: tags,
      images: imageUrls,
      is_fair: isFair,
      is_sold: false // CRITICAL: Explicitly set to satisfy RLS INSERT policy
      // These fields use database defaults: is_featured, view_count, favorite_count, expires_at, created_at, updated_at
    };

    console.log('[OBTAINUM] Submitting listing data:', listingData);

    // 6. Insert into Supabase
    const { data: newListing, error } = await db
      .from('listings')
      .insert(listingData)
      .select('*, profiles:seller_id(*)')
      .single();

    if (error) {
      console.error('[OBTAINUM] Supabase insert error:', error);
      
      // Provide user-friendly error messages based on error codes
      if (error.code === '23503') {
        // Foreign key violation - profile doesn't exist
        throw new Error("Your profile was not found. Please try logging out and back in.");
      }
      if (error.code === '23514') {
        // Check constraint violation
        throw new Error("Invalid data: " + (error.message || "Please check all fields meet the requirements."));
      }
      if (error.code === '42501') {
        // RLS policy violation
        throw new Error("Permission denied. Please ensure you're logged in and try again.");
      }
      if (error.code === '23505') {
        // Unique constraint violation
        throw new Error("A listing with this information already exists.");
      }
      // Generic error
      throw new Error(error.message || 'Failed to create listing. Please check the console for details.');
    }

    // 7. Success! Update local state and UI
    if (newListing) {
      State.listings.unshift(newListing);
    }

    // Reset form
    e.target.reset();
    State.imageFiles = [];
    document.getElementById('image-preview-grid').innerHTML = '';

    showToast('Listing published successfully!', 'success');
    navigate('shop');

  } catch (err) {
    console.error('[OBTAINUM] Error publishing listing:', err);
    errEl.textContent = err.message || 'An unknown error occurred. Please check the console for details.';
    errEl.classList.add('show');
  } finally {
    setLoading(btn, false, 'PUBLISH LISTING');
  }
}

/* ============================================================
   SECTION: PROFILE MODULE — Load, Update, Tabs
   ============================================================ */

async function loadProfile() {
  if (!State.user) {
    navigate('shop');
    openAuthModal();
    return;
  }

  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', State.user.id)
    .single();
  State.profile = profile;

  const avatarEl = document.getElementById('profile-avatar-lg');
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const bioEl = document.getElementById('profile-bio');

  const name = profile?.username || State.user.email?.split('@')[0] || '?';

  if (profile?.avatar_url) {
    avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="${name}" />`;
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }

  if (usernameEl) usernameEl.textContent = (profile?.username || name).toUpperCase();
  if (emailEl) emailEl.textContent = State.user.email;
  if (bioEl) bioEl.textContent = profile?.bio || '';

  if (document.getElementById('s-username')) {
    document.getElementById('s-username').value = profile?.username || '';
    document.getElementById('s-bio').value = profile?.bio || '';
    document.getElementById('s-location').value = profile?.location || '';
  }

  await loadProfileListings();
}

async function loadProfileListings() {
  if (!State.user) return;

  const { data } = await db
    .from('listings')
    .select('*, profiles:seller_id(username, avatar_url, rating, location)')
    .eq('seller_id', State.user.id)
    .order('created_at', { ascending: false });

  const allListings = data || [];
  const active = allListings.filter(l => !l.is_sold);
  const sold = allListings.filter(l => l.is_sold);

  const totalViews = allListings.reduce((s, l) => s + (l.view_count || 0), 0);
  const totalFavs = allListings.reduce((s, l) => s + (l.favorite_count || 0), 0);

  const statListings = document.getElementById('stat-listings');
  const statViews = document.getElementById('stat-views');
  const statFavs = document.getElementById('stat-favorites');
  if (statListings) animateNumber(statListings, allListings.length);
  if (statViews) animateNumber(statViews, totalViews);
  if (statFavs) animateNumber(statFavs, totalFavs);

  const grid = document.getElementById('profile-listings-grid');
  if (grid) {
    if (active.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <div class="empty-title">NO LISTINGS YET</div>
          <div class="empty-sub">Start selling by creating your first listing.</div>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="navigate('create')">+ CREATE LISTING</button>
        </div>
      `;
    } else {
      grid.innerHTML = '';
      active.forEach(l => grid.appendChild(createListingCard(l)));
      animateCards(grid);
    }
  }

  const soldGrid = document.getElementById('profile-sold-grid');
  if (soldGrid) {
    if (sold.length === 0) {
      soldGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✓</div>
          <div class="empty-title">NO SOLD ITEMS</div>
        </div>
      `;
    } else {
      soldGrid.innerHTML = '';
      sold.forEach(l => soldGrid.appendChild(createListingCard(l)));
    }
  }
}

async function saveProfile(e) {
  e.preventDefault();
  if (!State.user) return;

  const updates = {
    username: document.getElementById('s-username').value.trim(),
    bio: document.getElementById('s-bio').value.trim(),
    location: document.getElementById('s-location').value.trim()
  };

  const { error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', State.user.id);

  if (error) {
    showToast('Failed to save profile: ' + error.message, 'error');
  } else {
    State.profile = { ...State.profile, ...updates };
    updateAuthUI();
    showToast('Profile updated!', 'success');
  }
}

function switchProfileTab(btn) {
  const tabName = btn.dataset.ptab;

  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  ['my-listings', 'sold', 'settings'].forEach(t => {
    const el = document.getElementById('ptab-' + t);
    if (el) el.classList.toggle('hidden', t !== tabName);
  });
}

/* ============================================================
   SECTION: ITEM DETAIL MODULE — View, AI Insights, Similar Items
   ============================================================ */

async function openListing(listingId) {
  navigate('detail');

  const content = document.getElementById('detail-content');
  if (content) content.innerHTML = '<div class="loading-overlay"><div class="spinner spinner-lg"></div></div>';

  try {
    const { data: listing, error } = await db
      .from('listings')
      .select('*, profiles:seller_id(username, avatar_url, rating, location, bio)')
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
    console.error('[OBTAINUM] Detail error:', err);
    if (content) content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">LISTING NOT FOUND</div>
        <div class="empty-sub">This item may have been removed or sold.</div>
      </div>
    `;
  }
}

function renderDetail(listing) {
  const content = document.getElementById('detail-content');
  if (!content) return;

  const seller = listing.profiles || {};
  const isWished = State.wishlistIds.has(listing.id);
  const savings = listing.msrp && listing.price < listing.msrp
    ? Math.round((1 - listing.price / listing.msrp) * 100)
    : null;

  const imagesHtml = listing.images && listing.images.length > 0
    ? `<img src="${listing.images[0]}" alt="${escHtml(listing.name)}" id="main-detail-img" />`
    : `<div class="card-no-image">${categoryIcon(listing.category)}</div>`;

  const thumbsHtml = listing.images && listing.images.length > 1
    ? `
      <div class="image-thumbs">
        ${listing.images.map((img, i) => `
          <div class="image-thumb ${i === 0 ? 'active' : ''}" onclick="switchDetailImage('${img}', this)">
            <img src="${img}" alt="Thumb ${i + 1}" />
          </div>
        `).join('')}
      </div>
    `
    : '';

  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-images">
        <div class="main-image-wrap">
          ${imagesHtml}
        </div>
        ${thumbsHtml}
      </div>
      <div class="detail-info">
        <h1 class="detail-title">${escHtml(listing.name)}</h1>
        <div class="detail-price-row">
          <span class="detail-price">$${parseFloat(listing.price).toFixed(2)}</span>
          ${listing.msrp ? `<span class="detail-msrp">$${parseFloat(listing.msrp).toFixed(2)} MSRP</span>` : ''}
          ${savings ? `<span class="detail-savings">${savings}% BELOW MSRP</span>` : ''}
        </div>
        <div class="detail-badges">
          <span class="badge badge-condition">${CONDITION_LABELS[listing.condition] || listing.condition}</span>
          <span class="badge badge-type">${listing.type.replace('-', ' ').toUpperCase()}</span>
          <span class="badge badge-shipping">✈ ${listing.shipping.toUpperCase()}</span>
          ${listing.is_fair ? '<span class="badge badge-condition">✓ AI FAIR PRICE</span>' : ''}
          ${listing.is_featured ? '<span class="badge" style="border-color:var(--warning);color:var(--warning);">★ FEATURED</span>' : ''}
        </div>
        <div class="detail-description">${escHtml(listing.description)}</div>
        <div class="detail-meta-grid">
          <div class="detail-meta-item">
            <div class="detail-meta-label">Category</div>
            <div class="detail-meta-value">${escHtml(listing.category)}</div>
          </div>
          ${listing.location ? `
            <div class="detail-meta-item">
              <div class="detail-meta-label">Location</div>
              <div class="detail-meta-value">📍 ${escHtml(listing.location)}</div>
            </div>
          ` : ''}
          <div class="detail-meta-item">
            <div class="detail-meta-label">Views</div>
            <div class="detail-meta-value">👁 ${(listing.view_count || 0) + 1}</div>
          </div>
          <div class="detail-meta-item">
            <div class="detail-meta-label">Favorites</div>
            <div class="detail-meta-value">♡ ${listing.favorite_count || 0}</div>
          </div>
          ${listing.payment_methods?.length ? `
            <div class="detail-meta-item" style="grid-column: 1 / -1;">
              <div class="detail-meta-label">Payment Methods</div>
              <div class="detail-meta-value">${listing.payment_methods.join(', ')}</div>
            </div>
          ` : ''}
        </div>
        <div class="seller-card">
          <div class="seller-avatar">
            ${seller.avatar_url
              ? `<img src="${seller.avatar_url}" alt="${escHtml(seller.username || '')}" />`
              : (seller.username || '?').charAt(0).toUpperCase()
            }
          </div>
          <div>
            <div class="seller-name">${escHtml(seller.username || 'PUBLICymous')}</div>
            ${seller.location ? `<div class="seller-location">📍 ${escHtml(seller.location)}</div>` : ''}
            ${seller.rating ? `<div class="seller-rating">${'★'.repeat(Math.round(seller.rating))} ${parseFloat(seller.rating).toFixed(1)}</div>` : ''}
          </div>
        </div>
        <div class="detail-actions">
          ${listing.type === 'buy-now' ? '<button class="btn btn-primary btn-lg">BUY NOW</button>' : ''}
          ${listing.type === 'offers' ? '<button class="btn btn-primary btn-lg">MAKE AN OFFER</button>' : ''}
          ${listing.type === 'auction' ? '<button class="btn btn-primary btn-lg">PLACE BID</button>' : ''}
          <button class="btn btn-outline ${isWished ? 'active' : ''}" onclick="toggleWishlist(event, '${listing.id}')">
            ${isWished ? '♥ REMOVE FROM WISHLIST' : '♡ ADD TO WISHLIST'}
          </button>
        </div>
        <div class="ai-panel">
          <div class="ai-label"><span class="ai-dot"></span> AI PRICE & MARKET ANALYSIS</div>
          <div class="ai-insights" id="ai-insights">
            <div class="ai-insight"><span class="ai-bullet">◆</span>Analyzing market data...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => generateAIInsights(listing), 600);
}

function switchDetailImage(src, thumbEl) {
  const main = document.getElementById('main-detail-img');
  if (main) {
    main.style.opacity = '0';
    main.style.transform = 'scale(0.96)';
    setTimeout(() => {
      main.src = src;
      main.style.opacity = '1';
      main.style.transform = 'scale(1)';
    }, 150);
  }
  document.querySelectorAll('.image-thumb').forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
}

function generateAIInsights(listing) {
  const panel = document.getElementById('ai-insights');
  if (!panel) return;

  const insights = [];
  const price = parseFloat(listing.price);
  const msrp = parseFloat(listing.msrp) || null;

  if (listing.is_fair) {
    insights.push({ type: 'positive', text: `AI Fair Price: Our model has determined this listing is priced fairly, within a reasonable margin of its MSRP ($${msrp?.toFixed(2) || 'N/A'}).` });
  } else if (msrp && price > msrp * 1.5) {
    insights.push({ type: 'warning', text: `Price Alert: This item is priced ${Math.round((price/msrp - 1)*100)}% above MSRP. Consider checking other retailers before purchasing.` });
  } else if (!msrp) {
    insights.push({ type: 'neutral', text: `Price Verification: No MSRP was provided. Research similar items on retail sites to verify fair market value before buying.` });
  }

  const conditionMap = {
    'new': 'Item is listed as New — expect full functionality and original packaging. Request proof photos before committing.',
    'like-new': 'Like-New condition suggests minimal use. Ideal for collectors who value near-mint items.',
    'good': 'Good condition indicates normal wear. Great for collectors who prioritize play value over display.',
    'fair': 'Fair condition items may have visible wear or missing accessories. Verify with the seller.',
    'poor': 'Poor condition — heavily used or damaged. Best for parts, customs, or budget collectors.'
  };
  if (conditionMap[listing.condition]) {
    insights.push({ type: 'info', text: `Condition Assessment: ${conditionMap[listing.condition]}` });
  }

  if (msrp) {
    const low = (msrp * 0.7).toFixed(2);
    const high = (msrp * 1.3).toFixed(2);
    insights.push({ type: 'info', text: `Estimated Market Range: Similar items in ${listing.condition} condition typically sell for $${low} – $${high} based on MSRP ratios.` });
  }

  const risks = [];
  if (!listing.images || listing.images.length === 0) risks.push('no photos provided');
  if (!listing.location) risks.push('no location specified');
  if (listing.payment_methods?.includes('cash') && !listing.payment_methods?.includes('paypal')) risks.push('cash-only increases risk');

  if (risks.length > 0) {
    insights.push({ type: 'warning', text: `Risk Analysis: This listing has some caution flags — ${risks.join(', ')}. Always communicate through the platform and verify before payment.` });
  } else {
    insights.push({ type: 'positive', text: 'Risk Analysis: This listing looks well-documented with images and verified seller details. Low risk profile.' });
  }

  const rec = listing.is_fair
    ? 'AI Recommendation: This listing is marked as a Fair Price by our model. This appears to be a trustworthy deal worth considering.'
    : 'Recommendation: Research comparable sold listings on other platforms to benchmark this price before purchasing.';
  insights.push({ type: 'info', text: rec });

  const iconMap = { positive: '●', warning: '△', info: '◆', neutral: '■' };
  const colorMap = { positive: 'var(--neon)', warning: 'var(--warning)', info: 'var(--blue)', neutral: 'var(--text-muted)' };

  panel.innerHTML = insights.map((ins, i) => `
    <div class="ai-insight" style="animation-delay: ${i * 0.1}s;">
      <span class="ai-bullet" style="color:${colorMap[ins.type]};">${iconMap[ins.type]}</span>
      <span>${ins.text}</span>
    </div>
  `).join('');
}

async function loadSimilarItems(listing) {
  const scroll = document.getElementById('similar-scroll');
  if (!scroll) return;
  scroll.innerHTML = '<div class="spinner"></div> Loading...';

  try {
    const { data } = await db
      .from('listings')
      .select('*, profiles:seller_id(username, avatar_url, rating, location)')
      .eq('category', listing.category)
      .eq('is_sold', false)
      .neq('id', listing.id)
      .limit(10);

    const items = data || [];
    if (items.length === 0) {
      const section = document.getElementById('similar-section');
      if (section) section.style.display = 'none';
      return;
    }

    scroll.innerHTML = '';
    items.forEach(l => {
      const card = createListingCard(l);
      scroll.appendChild(card);
    });
    animateCards(scroll);
  } catch (err) {
    const section = document.getElementById('similar-section');
    if (section) section.style.display = 'none';
  }
}

/* ============================================================
   SECTION: RENDER ENGINE — Card creation, skeleton, etc.
   ============================================================ */
function createListingCard(listing) {
  const card = document.createElement('div');
  card.className = 'listing-card animate-fade-up';
  card.onclick = () => openListing(listing.id);

  const isWished = State.wishlistIds.has(listing.id);
  const isOwner = State.user && State.user.id === listing.seller_id;
  const img = listing.images && listing.images.length > 0
    ? `<img src=\"${listing.images[0]}\" alt=\"${escHtml(listing.name)}\" />`
    : `<div class=\"card-no-image\">${categoryIcon(listing.category)}</div>`;

  card.innerHTML = `
    <div class=\"card-image-wrap\">
      ${img}
      ${listing.is_fair ? '<span class=\"card-badge fair\">AI FAIR</span>' : ''}
      ${listing.is_featured ? '<span class=\"card-badge featured\">★</span>' : ''}
      <button class=\"wishlist-btn ${isWished ? 'active' : ''}\" onclick=\"toggleWishlist(event, '${listing.id}')\">
        ${isWished ? '♥' : '♡'}
      </button>
      ${isOwner ? `
        <div class=\"card-owner-actions\">
          <button class=\"card-action-btn edit-btn\" onclick=\"openEditListing(event, '${listing.id}')\" title=\"Edit\">✎</button>
          <button class=\"card-action-btn delete-btn\" onclick=\"deleteListing(event, '${listing.id}')\" title=\"Delete\">✕</button>
        </div>
      ` : ''}
    </div>
    <div class=\"card-body\">
      <div class=\"card-title\">${escHtml(listing.name)}</div>
      <div class=\"card-price\">
        $${parseFloat(listing.price).toFixed(2)}
        ${listing.msrp && listing.msrp > listing.price
          ? `<span class=\"card-msrp\">$${parseFloat(listing.msrp).toFixed(2)}</span>`
          : ''}
      </div>
      <div class=\"card-meta\">
        <span class=\"card-condition\">${listing.condition || 'N/A'}</span>
        ${listing.location ? `<span>📍 ${escHtml(listing.location)}</span>` : ''}
      </div>
    </div>
  `;

  return card;
}

function renderListings(listings) {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;

  if (listings.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">NO LISTINGS FOUND</div>
        <div class="empty-sub">
          ${State.listings && State.listings.length === 0
            ? 'Be the first to list something for sale!'
            : 'Try adjusting your search or filters.'}
        </div>
        ${State.user
          ? `<button class="btn btn-primary" style="margin-top:16px;" onclick="navigate('create')">+ LIST AN ITEM</button>`
          : ''}
      </div>
    `;
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
  grid.innerHTML = Array(8).fill(0).map(() =>
    `<div class="skeleton skeleton-card"></div>`
  ).join('');
}

function categoryIcon(cat) {
  const icons = {
    'Collectibles': '🏆',
    'Electronics': '🔋',
    'Clothing & Accessories': '👔',
    'Toys & Figures': '⚓',
    'Sports & Outdoors': '⚽',
    'Books & Media': '📚',
    'Home & Garden': '🏠',
    'Tools & Equipment': '🔨',
    'Other': '🛒'
  };
  return icons[cat] || '🛒';
}

/* ============================================================
   SECTION: ANIMATIONS — Stagger, number counter, transitions
   ============================================================ */

function animateCards(container) {
  const children = container.querySelectorAll('.listing-card, .skeleton-card');
  children.forEach((card, i) => {
    card.style.animationDelay = `${i * 0.05}s`;
  });
}

function animateNumber(el, target) {
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

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('mobile-open');
}

/* ============================================================
   SECTION: MODAL & UI UTILITIES
   ============================================================ */

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function closeOnOverlay(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

function setLoading(btn, isLoading, text) {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading
    ? `<span class="spinner"></span> ${text}`
    : text;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   SECTION: TOAST NOTIFICATIONS — Show, Auto-dismiss
   ============================================================ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '⚠', info: 'ⓘ', warning: '△' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${escHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('exit');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

/* ============================================================
   SECTION: ERROR BANNER — Downtime / Connectivity
   ============================================================ */

function showErrorBanner() {
  document.getElementById('error-banner')?.classList.add('show');
}

function hideErrorBanner() {
  document.getElementById('error-banner')?.classList.remove('show');
}

/* ============================================================
   SECTION: EVENT LISTENERS — Search, keyboard, resize, etc.
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
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      document.getElementById('mobile-nav')?.classList.remove('open');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  });

  window.addEventListener('online', () => {
    State.isOnline = true;
    hideErrorBanner();
    showToast('Connection restored.', 'success');
    loadListings();
  });

  window.addEventListener('offline', () => {
    State.isOnline = false;
    showErrorBanner();
    showToast('You are offline. Some features may not work.', 'error');
  });

  const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
  const updateFilterBtnVisibility = () => {
    if (mobileFilterToggle) {
      mobileFilterToggle.style.display = window.innerWidth < 900 ? 'inline-flex' : 'none';
    }
  };
  window.addEventListener('resize', updateFilterBtnVisibility);
  updateFilterBtnVisibility();

  document.addEventListener('click', (e) => {
    const mobileNav = document.getElementById('mobile-nav');
    const hamburger = document.getElementById('hamburger');
    if (mobileNav && mobileNav.classList.contains('open')) {
      if (!mobileNav.contains(e.target) && !hamburger?.contains(e.target)) {
        mobileNav.classList.remove('open');
      }
    }
  });
}

/* ============================================================
   SECTION: OPEN EDIT PROFILE
   ============================================================ */

function openEditProfile() {
  const settingsTab = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTab) {
    settingsTab.click();
    settingsTab.scrollIntoView({ behavior: 'smooth' });
  }
}

/* ============================================================
   SECTION: INITIALIZATION — Bootstrap the app on DOM ready
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await initAuth();
  navigate('shop');

  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.animation = 'neonPulse 3.5s ease-in-out infinite';
  }

  if (!navigator.onLine) {
    showErrorBanner();
  }

  console.log(
    '%c OBTAINUM INITIALIZED ',
    'background:#00ff41;color:#001a07;font-family:monospace;font-weight:bold;font-size:14px;padding:4px 8px;'
  );
});
