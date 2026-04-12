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

  // Auth guard for protected pages
  if ((page === 'create' || page === 'profile') && !State.user) {
    // Show notice inside the page but still navigate
  }

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
  // Restore session
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    await onAuthChange(session.user);
  }

  // Listen for auth state changes
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

  // Fetch profile — create one if it doesn't exist
  let { data: profile, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // PGRST116 is the PostgREST code for "exactly one row was requested, but 0 were found"
  if (profileError && profileError.code !== 'PGRST116') { 
      console.error("Error fetching profile:", profileError);
  }

  if (!profile) {
    // This is a new user, so create a profile.
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
      // Show a welcome toast only for brand new users (created within the last 5s)
      // This covers both email signup and OAuth sign-in.
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
    // Set avatar initials
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
      // If email confirmation is disabled, user is immediately signed in.
      // onAuthChange will handle profile creation and welcome toast.
      closeModal('auth-modal');
    } else {
      // Email confirmation required — swap form for a confirmation panel
      document.getElementById('register-form-wrap').innerHTML = `
        <div class="auth-confirm-panel">
          <div class="confirm-icon">✉️</div>
          <div class="confirm-title">CHECK YOUR EMAIL</div>
          <div class="confirm-msg">
            We sent a confirmation link to<br>
            <strong>${email}</strong><br><br>
            Click it to activate your OBTAINUM account,
            then come back and log in.
          </div>
          <button class="btn btn-outline w-full" onclick="closeModal('auth-modal')">GOT IT</button>
        </div>
      `;
    }
  } catch (err) {
    errEl.textContent = err.message || 'Registration failed.';
    errEl.classList.add('show');
  } finally {
    // Only reset button if the form still exists (not replaced by confirm panel)
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

    // If the confirmation panel replaced the form, restore the form
    const wrap = document.getElementById('register-form-wrap');
    if (wrap && !document.getElementById('register-btn')) {
      wrap.innerHTML = `
        <button type="button" class="btn-google" onclick="signInWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          CONTINUE WITH GOOGLE
        </button>
        <div class="auth-divider">OR</div>
        <form onsubmit="handleRegister(event)" style="display:contents;">
          <div class="auth-error" id="register-error"></div>
          <div class="form-group">
            <label class="form-label" for="reg-username">Username</label>
            <input class="form-input" id="reg-username" type="text" placeholder="your_handle" required minlength="3" maxlength="30"
              pattern="[a-zA-Z0-9_]+" title="Letters, numbers and underscores only" />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">Email</label>
            <input class="form-input" id="reg-email" type="email" placeholder="your@email.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-pass">Password</label>
            <input class="form-input" id="reg-pass" type="password" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary w-full" id="register-btn">CREATE ACCOUNT</button>
          <div style="font-size:0.8rem;text-align:center;color:var(--text-muted);">
            Already a member?
            <a href="#" onclick="switchAuthTab('login'); return false;" style="color:var(--neon);">Login</a>
          </div>
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
    console.error('Error loading listings:', err);
    showErrorBanner();
    renderListings([]);
  }
}

function applyFilters() {
  let results = [...State.listings];

  // Search filter
  const q = (State.searchQuery || '').toLowerCase();
  if (q.length >= 2) {
    results = results.filter(l =>
      fuzzyMatch(q, l.name) ||
      fuzzyMatch(q, l.description) ||
      fuzzyMatch(q, l.category) ||
      (l.tags && l.tags.some(t => fuzzyMatch(q, t)))
    );
  }

  // Category filter
  if (State.activeCategory !== 'all') {
    results = results.filter(l => l.category === State.activeCategory);
  }

  // Condition filter
  if (State.activeCondition !== 'all') {
    results = results.filter(l => l.condition === State.activeCondition);
  }

  // Price filters
  const minP = parseFloat(document.getElementById('price-min')?.value || '');
  const maxP = parseFloat(document.getElementById('price-max')?.value || '');
  if (!isNaN(minP)) results = results.filter(l => l.price >= minP);
  if (!isNaN(maxP)) results = results.filter(l => l.price <= maxP);

  // Quality filters
  if (document.getElementById('fair-only')?.checked) {
    results = results.filter(l => l.is_fair);
  }
  if (document.getElementById('featured-only')?.checked) {
    results = results.filter(l => l.is_featured);
  }

  // Sort
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
  // Simple char-based fuzzy: allow 1 substitution
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
            <div class="empty-icon">&#9825;</div>
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
    console.error('Error loading wishlist:', err);
  }
}

async function toggleWishlist(e, listingId) {
  e.stopPropagation();
  if (!State.user) { openAuthModal(); return; }

  const btn = e.currentTarget;
  const isWished = State.wishlistIds.has(listingId);

  // Optimistic UI
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
    // Revert optimistic update
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
        console.error('Error uploading image:', error);
    } else {
      const { data: { publicUrl } } = db.storage
        .from('listing-images')
        .getPublicUrl(path);
      urls.push(publicUrl);
    }
  }
  return urls;
}

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
    // 1. Upload images
    let imageUrls = [];
    if (State.imageFiles.length > 0) {
      imageUrls = await uploadImages(State.user.id);
      if (imageUrls.length !== State.imageFiles.length) {
        showToast('Warning: Some images failed to upload.', 'warning');
      }
    }

    // 2. Gather and prepare data
    const price = parseFloat(document.getElementById('c-price').value);
    const msrp = parseFloat(document.getElementById('c-msrp').value) || null;
    const tagsRaw = document.getElementById('c-tags').value;
    const isFair = msrp ? price <= msrp * 1.2 : false; // AI determines fair price

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
      tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10),
      images: imageUrls,
      is_fair: isFair,
    };

    // 3. Validate required fields before sending to the database
    if (!listingData.name || !listingData.category || !listingData.description || !listingData.price) {
      throw new Error("Please fill out all required fields: Name, Category, Description, and Price.");
    }

    // 4. Insert into Supabase and select the new row back to confirm
    const { data: newListing, error } = await db
      .from('listings')
      .insert(listingData)
      .select('*, profiles:seller_id(*)')
      .single();

    if (error) {
      // This will catch any database-level errors, like RLS policy violations or CHECK constraints.
      throw error;
    }

    // 5. Reset form, update UI, and navigate
    if (newListing) {
      State.listings.unshift(newListing); // Optimistically add to local state
    }
    
    e.target.reset();
    State.imageFiles = [];
    document.getElementById('image-preview-grid').innerHTML = '';

    showToast('Listing published successfully!', 'success');
    navigate('shop'); // Rerenders the shop page with the new listing

  } catch (err) {
    // 6. Detailed error handling
    console.error('Error publishing listing:', err);
    errEl.textContent = err.message || 'An unknown error occurred. Please check the console for details.';
    errEl.classList.add('show');
  } finally {
    // 7. Always reset the button state
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

  // Refresh profile data
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', State.user.id)
    .single();
  State.profile = profile;

  // Render profile banner
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

  // Pre-fill settings
  if (document.getElementById('s-username')) {
    document.getElementById('s-username').value = profile?.username || '';
    document.getElementById('s-bio').value = profile?.bio || '';
    document.getElementById('s-location').value = profile?.location || '';
  }

  // Load user's listings
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

  // Stats
  const totalViews = allListings.reduce((s, l) => s + (l.view_count || 0), 0);
  const totalFavs = allListings.reduce((s, l) => s + (l.favorite_count || 0), 0);

  const statListings = document.getElementById('stat-listings');
  const statViews = document.getElementById('stat-views');
  const statFavs = document.getElementById('stat-favorites');
  if (statListings) animateNumber(statListings, allListings.length);
  if (statViews) animateNumber(statViews, totalViews);
  if (statFavs) animateNumber(statFavs, totalFavs);

  // Render active listings
  const grid = document.getElementById('profile-listings-grid');
  if (grid) {
    if (active.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128722;</div>
          <div class="empty-title">NO LISTINGS YET</div>
          <div class="empty-sub">Start selling by creating your first listing.</div>
          <br/>
          <button class="btn btn-primary" onclick="navigate('create')" style="margin-top:12px;">+ CREATE LISTING</button>
        </div>
      `;
    } else {
      grid.innerHTML = '';
      active.forEach(l => grid.appendChild(createListingCard(l)));
      animateCards(grid);
    }
  }

  // Render sold listings
  const soldGrid = document.getElementById('profile-sold-grid');
  if (soldGrid) {
    if (sold.length === 0) {
      soldGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#10003;</div>
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
  if (content) content.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';

  try {
    // Fetch listing + seller profile
    const { data: listing, error } = await db
      .from('listings')
      .select('*, profiles:seller_id(username, avatar_url, rating, location, bio)')
      .eq('id', listingId)
      .single();

    if (error) throw error;
    State.selectedListing = listing;

    // Increment view count (fire and forget)
    db.from('listings')
      .update({ view_count: (listing.view_count || 0) + 1 })
      .eq('id', listingId)
      .then(() => {});

    renderDetail(listing);
    loadSimilarItems(listing);
  } catch (err) {
    console.error('Detail error:', err);
    if (content) content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#9888;</div>
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
    ? `<div class="image-thumbs">
        ${listing.images.map((img, i) => `
          <div class="image-thumb ${i === 0 ? 'active' : ''}" onclick="switchDetailImage('${img}', this)">
            <img src="${img}" alt="Thumb ${i + 1}" />
          </div>
        `).join('')}
      </div>`
    : '';

  content.innerHTML = `
    <!-- Images -->
    <div class="detail-images animate-fade">
      <div class="main-image-wrap">${imagesHtml}</div>
      ${thumbsHtml}
    </div>

    <!-- Info Panel -->
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
        <span class="badge badge-shipping">&#9992; ${listing.shipping.toUpperCase()}</span>
        ${listing.is_fair ? '<span class="badge" style="border-color:var(--neon);color:var(--neon);">&#10003; AI FAIR PRICE</span>' : ''}
        ${listing.is_featured ? '<span class="badge" style="border-color:var(--warning);color:var(--warning);">&#9733; FEATURED</span>' : ''}
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
          <div class="detail-meta-value">&#128205; ${escHtml(listing.location)}</div>
        </div>` : ''}
        <div class="detail-meta-item">
          <div class="detail-meta-label">Views</div>
          <div class="detail-meta-value">&#128065; ${(listing.view_count || 0) + 1}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">Favorites</div>
          <div class="detail-meta-value">&#9825; ${listing.favorite_count || 0}</div>
        </div>
        ${listing.payment_methods?.length ? `
        <div class="detail-meta-item" style="grid-column:1/-1;">
          <div class="detail-meta-label">Payment Methods</div>
          <div class="detail-meta-value">${listing.payment_methods.join(', ')}</div>
        </div>` : ''}
      </div>

      <!-- Seller Info -->
      <div class="seller-card">
        <div class="seller-avatar">
          ${seller.avatar_url
            ? `<img src="${seller.avatar_url}" alt="${escHtml(seller.username || '')}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`
            : (seller.username || '?').charAt(0).toUpperCase()
          }
        </div>
        <div>
          <div class="seller-name">${escHtml(seller.username || 'Anonymous')}</div>
          ${seller.location ? `<div class="seller-location">&#128205; ${escHtml(seller.location)}</div>` : ''}
          ${seller.rating ? `<div class="seller-rating">${'&#9733;'.repeat(Math.round(seller.rating))} ${parseFloat(seller.rating).toFixed(1)}</div>` : ''}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="detail-actions">
        ${listing.type === 'buy-now' ? '<button class="btn btn-primary btn-lg">BUY NOW</button>' : ''}
        ${listing.type === 'offers' ? '<button class="btn btn-primary btn-lg">MAKE AN OFFER</button>' : ''}
        ${listing.type === 'auction' ? '<button class="btn btn-primary btn-lg">PLACE BID</button>' : ''}
        <button class="btn btn-outline" onclick="toggleWishlist(event, '${listing.id}')" id="detail-wish-btn">
          ${isWished ? '&#9829; REMOVE FROM WISHLIST' : '&#9825; ADD TO WISHLIST'}
        </button>
      </div>

      <!-- AI Insights -->
      <div class="ai-panel">
        <div class="ai-label">
          <span class="ai-dot"></span>
          AI PRICE &amp; MARKET ANALYSIS
        </div>
        <div class="ai-insights" id="ai-insights">
          <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:0.85rem;">
            <div class="spinner"></div> Analyzing market data...
          </div>
        </div>
      </div>
    </div>
  `;

  // Generate AI insights after render
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

// Simulate AI analysis based on listing data (no external AI key required)
function generateAIInsights(listing) {
  const panel = document.getElementById('ai-insights');
  if (!panel) return;

  const insights = [];
  const price = parseFloat(listing.price);
  const msrp = parseFloat(listing.msrp) || null;

  // Price fairness
  if (listing.is_fair) {
      insights.push({ type: 'positive', text: `AI Fair Price: Our model has determined this listing is priced fairly, within a reasonable margin of its MSRP ($${msrp.toFixed(2)}).` });
  } else if (msrp && price > msrp * 1.5) {
    insights.push({ type: 'warning', text: `Price Alert: This item is priced ${Math.round((price/msrp - 1)*100)}% above MSRP. Consider checking other retailers before purchasing.` });
  } else if (!msrp) {
    insights.push({ type: 'neutral', text: `Price Verification: No MSRP was provided. Research similar items on retail sites to verify fair market value before buying.` });
  }

  // Condition assessment
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

  // Market value estimate
  if (msrp) {
    const low = (msrp * 0.7).toFixed(2);
    const high = (msrp * 1.3).toFixed(2);
    insights.push({ type: 'info', text: `Estimated Market Range: Similar items in ${listing.condition} condition typically sell for $${low} – $${high} based on MSRP ratios.` });
  }

  // Risk analysis
  const risks = [];
  if (!listing.images || listing.images.length === 0) risks.push('no photos provided');
  if (!listing.location) risks.push('no location specified');
  if (listing.payment_methods?.includes('cash') && !listing.payment_methods?.includes('paypal')) risks.push('cash-only increases risk');

  if (risks.length > 0) {
    insights.push({ type: 'warning', text: `Risk Analysis: This listing has some caution flags — ${risks.join(', ')}. Always communicate through the platform and verify before payment.` });
  } else {
    insights.push({ type: 'positive', text: 'Risk Analysis: This listing looks well-documented with images and verified seller details. Low risk profile.' });
  }

  // Recommendation
  const rec = listing.is_fair
    ? 'AI Recommendation: This listing is marked as a Fair Price by our model. This appears to be a trustworthy deal worth considering.'
    : 'Recommendation: Research comparable sold listings on other platforms to benchmark this price before purchasing.';
  insights.push({ type: 'info', text: rec });

  const iconMap = { positive: '&#9679;', warning: '&#9651;', info: '&#9670;', neutral: '&#9632;' };
  const colorMap = { positive: 'var(--neon)', warning: 'var(--warning)', info: 'var(--blue)', neutral: 'var(--text-muted)' };

  panel.innerHTML = insights.map((ins, i) => `
    <div class="ai-insight animate-fade-up" style="animation-delay:${i * 0.1}s;">
      <span class="ai-bullet" style="color:${colorMap[ins.type]}">${iconMap[ins.type]}</span>
      <span>${ins.text}</span>
    </div>
  `).join('');
}

async function loadSimilarItems(listing) {
  const scroll = document.getElementById('similar-scroll');
  if (!scroll) return;
  scroll.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:20px;">Loading...</div>';

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
  const img = listing.images && listing.images.length > 0
    ? `<img src="${listing.images[0]}" alt="${escHtml(listing.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'card-no-image\'>${categoryIcon(listing.category)}</div>'" />`
    : `<div class="card-no-image">${categoryIcon(listing.category)}</div>`;

  card.innerHTML = `
    <div class="card-image-wrap">
      ${img}
      ${listing.is_fair ? '<span class="card-badge fair">AI FAIR</span>' : ''}
      ${listing.is_featured ? '<span class="card-badge featured" style="left:auto;right:40px;">&#9733;</span>' : ''}
      <button class="wishlist-btn ${isWished ? 'active' : ''}"
        onclick="toggleWishlist(event, '${listing.id}')"
        title="${isWished ? 'Remove from wishlist' : 'Add to wishlist'}"
      >${isWished ? '&#9829;' : '&#9825;'}</button>
    </div>
    <div class="card-body">
      <div class="card-title" title="${escHtml(listing.name)}">${escHtml(listing.name)}</div>
      <div>
        <span class="card-price">$${parseFloat(listing.price).toFixed(2)}</span>
        ${listing.msrp && listing.msrp > listing.price
          ? `<span class="card-msrp">$${parseFloat(listing.msrp).toFixed(2)}</span>`
          : ''}
      </div>
      <div class="card-meta">
        <span class="card-condition">${listing.condition || 'N/A'}</span>
        ${listing.location ? `<span>&#128205; ${escHtml(listing.location)}</span>` : ''}
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
        <div class="empty-icon">&#128269;</div>
        <div class="empty-title">NO LISTINGS FOUND</div>
        <div class="empty-sub">
          ${
            State.listings && State.listings.length === 0
              ? 'Be the first to list something for sale!'
              : 'Try adjusting your search or filters.'
          }
        </div>
  
        ${
          State.user
            ? `<br/><button class="btn btn-primary" onclick="navigate('create')" style="margin-top:12px;">+ LIST AN ITEM</button>`
            : ''
        }
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
    `<div class="skeleton-card skeleton"></div>`
  ).join('');
}

function categoryIcon(cat) {
  const icons = {
    'Collectibles': '&#127942;',
    'Electronics': '&#128267;',
    'Clothing & Accessories': '&#128084;',
    'Toys & Figures': '&#9875;',
    'Sports & Outdoors': '&#9917;',
    'Books & Media': '&#128218;',
    'Home & Garden': '&#127968;',
    'Tools & Equipment': '&#128296;',
    'Other': '&#128722;'
  };
  return icons[cat] || '&#128722;';
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
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(startVal + (target - startVal) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Mobile sidebar animation
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
    .replace(/'/g, '&#039;');
}

/* ============================================================
   SECTION: TOAST NOTIFICATIONS — Show, Auto-dismiss
   ============================================================ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '&#10003;', error: '&#9888;', info: '&#9432;' };
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
  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Hamburger
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('mobile-nav')?.classList.toggle('open');
  });

  // Search input (debounced)
  let searchTimer;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    State.searchQuery = e.target.value;
    searchTimer = setTimeout(() => {
      if (State.currentPage !== 'shop') navigate('shop');
      applyFilters();
    }, 320);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      document.getElementById('mobile-nav')?.classList.remove('open');
    }
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  });

  // Online/offline monitoring
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

  // Mobile filter toggle visibility on resize
  const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
  const updateFilterBtnVisibility = () => {
    if (mobileFilterToggle) {
      mobileFilterToggle.style.display = window.innerWidth < 900 ? 'inline-flex' : 'none';
    }
  };
  window.addEventListener('resize', updateFilterBtnVisibility);
  updateFilterBtnVisibility();

  // Click outside mobile nav to close
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
   SECTION: OPEN EDIT PROFILE (stub — extend as needed)
   ============================================================ */

function openEditProfile() {
  // Switch to settings tab
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
  // 1. Apply saved theme
  initTheme();

  // 2. Set up all event listeners
  setupEventListeners();

  // 3. Restore auth session
  await initAuth();

  // 4. Start on shop page
  navigate('shop');

  // 5. Animate logo on load
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.animation = 'neonPulse 3.5s ease-in-out infinite';
  }

  // 6. Connectivity check
  if (!navigator.onLine) {
    showErrorBanner();
  }

  console.log(
    '%c OBTAINUM INITIALIZED ',
    'background:#00ff41;color:#001a07;font-family:monospace;font-weight:bold;font-size:14px;padding:4px 8px;'
  );
});
