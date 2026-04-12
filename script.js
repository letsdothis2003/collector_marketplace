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

let db;
try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_URL_KEY);
} catch (e) {
  console.error('[OBTAINUM] Supabase init failed — check your URL and key:', e);
}

/* ============================================================
   SECTION: STATE MANAGEMENT
   ============================================================ */

const PAGES = ['shop', 'detail', 'create', 'profile', 'wishlist'];

const CATEGORIES = [
  'Collectibles', 'Electronics', 'Clothing & Accessories',
  'Toys & Figures', 'Sports & Outdoors', 'Books & Media',
  'Home & Garden', 'Tools & Equipment', 'Other'
];

// Subcategories per category (schema: listings.subcategory TEXT)
const SUBCATEGORIES = {
  'Collectibles': ['Action Figures', 'Trading Cards', 'Comics', 'Stamps', 'Coins', 'Vintage Items', 'Art', 'Other'],
  'Electronics': ['Phones', 'Computers', 'Cameras', 'Audio', 'Gaming', 'TVs', 'Wearables', 'Components', 'Other'],
  'Clothing & Accessories': ['Shirts', 'Pants', 'Shoes', 'Hats', 'Bags', 'Jewelry', 'Watches', 'Other'],
  'Toys & Figures': ['Action Figures', 'Board Games', 'Building Sets', 'Puzzles', 'Plush', 'Model Kits', 'Other'],
  'Sports & Outdoors': ['Fitness', 'Cycling', 'Camping', 'Water Sports', 'Team Sports', 'Golf', 'Other'],
  'Books & Media': ['Books', 'Manga', 'Movies', 'Music', 'Video Games', 'Magazines', 'Other'],
  'Home & Garden': ['Furniture', 'Kitchen', 'Decor', 'Garden Tools', 'Bedding', 'Lighting', 'Other'],
  'Tools & Equipment': ['Power Tools', 'Hand Tools', 'Measuring', 'Safety', 'Other'],
  'Other': ['Other']
};

const CONDITION_LABELS = {
  'new': '✦ New',
  'like-new': '✦ Like New',
  'good': '✦ Good',
  'fair': '✦ Fair',
  'poor': '✦ Poor'
};

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
  activeType: 'all',
  searchQuery: '',
  priceMin: null,
  priceMax: null,
  sortBy: 'newest',
  selectedListing: null,
  editingListingId: null,
  imageFiles: [],
  keepExistingImages: [],
  isOnline: navigator.onLine
};

/* ============================================================
   SECTION: THEME TOGGLE
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
   SECTION: ROUTER / NAVIGATION
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
   SECTION: AUTH MODULE
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
    console.error("Error fetching profile:", profileError);
  }

  if (!profile) {
    const rawName = user.user_metadata?.username || user.user_metadata?.name || user.email.split('@')[0];
    const newUsername = rawName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
    const finalUsername = newUsername.length >= 3 ? newUsername : `${newUsername}_usr`;

    const newProfileData = {
      id: user.id,
      email: user.email,
      username: finalUsername,
      avatar_url: user.user_metadata?.picture || user.user_metadata?.avatar_url || null
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
      avatar.innerHTML = `<img src="${State.profile.avatar_url}" alt="${escHtml(name)}" />`;
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
        <div class="auth-confirm-panel">
          <div class="confirm-icon">&#9993;</div>
          <div class="confirm-title">CHECK YOUR EMAIL</div>
          <div class="confirm-msg">
            We sent a confirmation link to<br>
            <strong>${escHtml(email)}</strong><br><br>
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
  }
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

  // Search
  const q = (State.searchQuery || '').toLowerCase();
  if (q.length >= 2) {
    results = results.filter(l =>
      fuzzyMatch(q, l.name) ||
      fuzzyMatch(q, l.description) ||
      fuzzyMatch(q, l.category) ||
      fuzzyMatch(q, l.subcategory) ||
      (l.tags && l.tags.some(t => fuzzyMatch(q, t)))
    );
  }

  // Category
  if (State.activeCategory !== 'all') {
    results = results.filter(l => l.category === State.activeCategory);
  }

  // Condition
  if (State.activeCondition !== 'all') {
    results = results.filter(l => l.condition === State.activeCondition);
  }

  // Listing type
  if (State.activeType !== 'all') {
    results = results.filter(l => l.type === State.activeType);
  }

  // Price
  const minP = parseFloat(document.getElementById('price-min')?.value || '');
  const maxP = parseFloat(document.getElementById('price-max')?.value || '');
  if (!isNaN(minP)) results = results.filter(l => l.price >= minP);
  if (!isNaN(maxP)) results = results.filter(l => l.price <= maxP);

  // Quality
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
  else if (sort === 'favorites') results.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
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

function selectType(btn, type) {
  document.querySelectorAll('#type-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  State.activeType = type;
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
  State.activeType = 'all';
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
  document.querySelectorAll('.chip[data-type]').forEach(c =>
    c.classList.toggle('active', c.dataset.type === 'all'));

  applyFilters();
  showToast('Filters reset.', 'info');
}

/* ============================================================
   SECTION: WISHLIST MODULE
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

  const listing = State.listings.find(l => l.id === listingId) || State.selectedListing;
  if (listing && listing.seller_id === State.user.id) {
    showToast("You can't add your own listing to your wishlist.", 'info');
    return;
  }

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
   SECTION: CREATE / EDIT LISTING MODULE
   ============================================================ */

async function initCreatePage() {
  const notice = document.getElementById('create-auth-notice');
  const form = document.getElementById('create-form');
  const title = document.getElementById('create-page-title');
  const submitBtn = document.getElementById('create-submit');
  const cancelBtn = document.getElementById('create-cancel');

  if (!State.user) {
    if (notice) notice.classList.remove('hidden');
    if (form) form.classList.add('hidden');
    return;
  }

  if (notice) notice.classList.add('hidden');
  if (form) form.classList.remove('hidden');

  // Reset form and image state
  form.reset();
  State.imageFiles = [];
  State.keepExistingImages = [];
  document.getElementById('image-preview-grid').innerHTML = '';

  const existingSection = document.getElementById('existing-images-section');
  const existingGrid = document.getElementById('existing-image-grid');
  if (existingSection) existingSection.classList.add('hidden');
  if (existingGrid) existingGrid.innerHTML = '';

  // Reset payment checkboxes to just cash
  document.querySelectorAll('input[name="payment"]').forEach(cb => {
    cb.checked = cb.value === 'cash';
  });

  // Reset subcategory
  updateSubcategories();

  if (State.editingListingId) {
    title.textContent = '&#9998; EDIT LISTING';
    submitBtn.textContent = 'SAVE CHANGES';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    // Fetch the fresh listing from Supabase to ensure we have the latest data
    let listing = State.listings.find(l => l.id === State.editingListingId);
    if (!listing) {
      try {
        const { data, error } = await db
          .from('listings')
          .select('*')
          .eq('id', State.editingListingId)
          .single();
        if (error) throw error;
        listing = data;
      } catch (err) {
        showToast('Could not load listing for editing.', 'error');
        State.editingListingId = null;
        title.textContent = 'CREATE LISTING';
        submitBtn.textContent = 'PUBLISH LISTING';
        if (cancelBtn) cancelBtn.style.display = 'none';
        return;
      }
    }

    if (listing) {
      document.getElementById('c-name').value = listing.name || '';
      document.getElementById('c-category').value = listing.category || '';
      document.getElementById('c-desc').value = listing.description || '';
      document.getElementById('c-price').value = listing.price ?? '';
      document.getElementById('c-msrp').value = listing.msrp || '';
      document.getElementById('c-condition').value = listing.condition || '';
      document.getElementById('c-type').value = listing.type || 'buy-now';
      document.getElementById('c-shipping').value = listing.shipping || 'paid';
      document.getElementById('c-location').value = listing.location || '';
      document.getElementById('c-tags').value = (listing.tags || []).join(', ');

      // Subcategory — populate then set after category is set
      updateSubcategories();
      if (listing.subcategory) {
        const subEl = document.getElementById('c-subcategory');
        if (subEl) subEl.value = listing.subcategory;
      }

      // Payment methods
      if (listing.payment_methods && listing.payment_methods.length > 0) {
        document.querySelectorAll('input[name="payment"]').forEach(cb => {
          cb.checked = listing.payment_methods.includes(cb.value);
        });
      }

      // Show existing images
      if (listing.images && listing.images.length > 0) {
        State.keepExistingImages = [...listing.images];
        if (existingSection) existingSection.classList.remove('hidden');
        if (existingGrid) {
          existingGrid.innerHTML = '';
          listing.images.forEach((url, i) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item animate-pop';
            item.dataset.existingIndex = i;
            item.innerHTML = `
              <img src="${escHtml(url)}" alt="Image ${i + 1}" />
              <button class="remove-image" onclick="removeExistingImage(${i})" title="Remove">&times;</button>
            `;
            existingGrid.appendChild(item);
          });
        }
      }

      // Update char counter
      updateDescCounter();
    }
  } else {
    title.textContent = '+ CREATE LISTING';
    submitBtn.textContent = 'PUBLISH LISTING';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

function updateSubcategories() {
  const cat = document.getElementById('c-category')?.value;
  const group = document.getElementById('subcategory-group');
  const sel = document.getElementById('c-subcategory');
  if (!group || !sel) return;

  if (cat && SUBCATEGORIES[cat]) {
    group.style.display = 'flex';
    sel.innerHTML = '<option value="">Select subcategory...</option>';
    SUBCATEGORIES[cat].forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      sel.appendChild(opt);
    });
  } else {
    group.style.display = 'none';
    sel.innerHTML = '<option value="">Select subcategory...</option>';
  }
}

function updateDescCounter() {
  const desc = document.getElementById('c-desc');
  const counter = document.getElementById('desc-char-count');
  if (desc && counter) {
    counter.textContent = `${desc.value.length} / 2000`;
  }
}

function removeExistingImage(index) {
  State.keepExistingImages.splice(index, 1);
  // Re-render existing image grid
  const existingGrid = document.getElementById('existing-image-grid');
  const existingSection = document.getElementById('existing-images-section');
  if (!existingGrid) return;

  if (State.keepExistingImages.length === 0) {
    if (existingSection) existingSection.classList.add('hidden');
    return;
  }

  existingGrid.innerHTML = '';
  State.keepExistingImages.forEach((url, i) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item animate-pop';
    item.dataset.existingIndex = i;
    item.innerHTML = `
      <img src="${escHtml(url)}" alt="Image ${i + 1}" />
      <button class="remove-image" onclick="removeExistingImage(${i})" title="Remove">&times;</button>
    `;
    existingGrid.appendChild(item);
  });
}

function cancelEdit() {
  State.editingListingId = null;
  State.imageFiles = [];
  State.keepExistingImages = [];
  navigate('shop');
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const maxImages = 10;
  const usedSlots = State.keepExistingImages.length + State.imageFiles.length;
  const remaining = maxImages - usedSlots;
  const newFiles = files.slice(0, remaining);

  newFiles.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    State.imageFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, State.imageFiles.length - 1);
    reader.readAsDataURL(file);
  });

  if (files.length > remaining) {
    showToast(`Max ${maxImages} images total. ${remaining} slot(s) remaining.`, 'info');
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

  const isEditing = !!State.editingListingId;
  const errEl = document.getElementById('create-error');
  const btn = document.getElementById('create-submit');
  errEl.classList.remove('show');
  setLoading(btn, true, isEditing ? 'SAVING...' : 'PUBLISHING...');

  try {
    // Upload new images
    let newImageUrls = [];
    if (State.imageFiles.length > 0) {
      newImageUrls = await uploadImages(State.user.id);
      if (newImageUrls.length !== State.imageFiles.length) {
        showToast('Warning: Some images failed to upload.', 'warning');
      }
    }

    // Combine kept existing images + newly uploaded images
    const allImages = [...State.keepExistingImages, ...newImageUrls];

    // Gather payment methods
    const paymentMethods = Array.from(
      document.querySelectorAll('input[name="payment"]:checked')
    ).map(cb => cb.value).filter(v => VALID_PAYMENT_METHODS.includes(v));

    if (paymentMethods.length === 0) paymentMethods.push('cash');

    const price = parseFloat(document.getElementById('c-price').value);
    const msrpVal = document.getElementById('c-msrp').value;
    const msrp = msrpVal ? parseFloat(msrpVal) : null;
    const tagsRaw = document.getElementById('c-tags').value;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
    const subcategoryEl = document.getElementById('c-subcategory');
    const subcategory = subcategoryEl && subcategoryEl.value ? subcategoryEl.value : null;

    // is_fair: price is fair if no MSRP or within 120% of MSRP
    const isFair = msrp ? price <= msrp * 1.2 : true;

    const listingData = {
      seller_id: State.user.id,
      name: document.getElementById('c-name').value.trim(),
      category: document.getElementById('c-category').value,
      subcategory: subcategory,
      description: document.getElementById('c-desc').value.trim(),
      price: price,
      msrp: msrp,
      condition: document.getElementById('c-condition').value,
      type: document.getElementById('c-type').value,
      shipping: document.getElementById('c-shipping').value,
      location: document.getElementById('c-location').value.trim() || null,
      tags: tags,
      payment_methods: paymentMethods,
      is_fair: isFair,
      images: allImages
    };

    if (!listingData.name || !listingData.category || !listingData.description || isNaN(price)) {
      throw new Error('Please fill out all required fields: Name, Category, Description, and Price.');
    }
    if (listingData.description.length < 10) {
      throw new Error('Description must be at least 10 characters.');
    }

    let savedListing;
    if (isEditing) {
      // Don't overwrite seller_id on update
      delete listingData.seller_id;
      const { data, error } = await db
        .from('listings')
        .update(listingData)
        .eq('id', State.editingListingId)
        .eq('seller_id', State.user.id)
        .select('*, profiles:seller_id(username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;

      // Update in local state
      const idx = State.listings.findIndex(l => l.id === State.editingListingId);
      if (idx !== -1) State.listings[idx] = savedListing;
    } else {
      const { data, error } = await db
        .from('listings')
        .insert(listingData)
        .select('*, profiles:seller_id(username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;
      State.listings.unshift(savedListing);
    }

    // Reset state
    e.target.reset();
    State.imageFiles = [];
    State.keepExistingImages = [];
    document.getElementById('image-preview-grid').innerHTML = '';
    State.editingListingId = null;

    showToast(isEditing ? 'Listing updated!' : 'Listing published!', 'success');
    navigate(isEditing ? 'profile' : 'shop');

  } catch (err) {
    console.error('Error submitting listing:', err);
    errEl.textContent = err.message || 'An unknown error occurred.';
    errEl.classList.add('show');
  } finally {
    setLoading(btn, false, isEditing ? 'SAVE CHANGES' : 'PUBLISH LISTING');
  }
}

/* ============================================================
   SECTION: PROFILE MODULE
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
  const locationEl = document.getElementById('profile-location');

  const name = profile?.username || State.user.email?.split('@')[0] || '?';

  if (profile?.avatar_url) {
    avatarEl.innerHTML = `<img src="${escHtml(profile.avatar_url)}" alt="${escHtml(name)}" />`;
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }

  if (usernameEl) usernameEl.textContent = (profile?.username || name).toUpperCase();
  if (emailEl) emailEl.textContent = State.user.email;
  if (bioEl) bioEl.textContent = profile?.bio || '';
  if (locationEl) locationEl.textContent = profile?.location ? '&#128205; ' + profile.location : '';

  // Pre-fill settings form
  const sUsernameEl = document.getElementById('s-username');
  if (sUsernameEl) {
    sUsernameEl.value = profile?.username || '';
    document.getElementById('s-bio').value = profile?.bio || '';
    document.getElementById('s-location').value = profile?.location || '';
    document.getElementById('s-phone').value = profile?.phone || '';
    document.getElementById('s-website').value = profile?.website || '';
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
  const statSold = document.getElementById('stat-sold');
  if (statListings) animateNumber(statListings, active.length);
  if (statViews) animateNumber(statViews, totalViews);
  if (statFavs) animateNumber(statFavs, totalFavs);
  if (statSold) animateNumber(statSold, sold.length);

  // Active listings
  const grid = document.getElementById('profile-listings-grid');
  if (grid) {
    if (active.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128722;</div>
          <div class="empty-title">NO ACTIVE LISTINGS</div>
          <div class="empty-sub">Start selling by creating your first listing.</div>
          <br/>
          <button class="btn btn-primary" onclick="navigate('create')" style="margin-top:12px;">+ CREATE LISTING</button>
        </div>
      `;
    } else {
      grid.innerHTML = '';
      active.forEach(l => grid.appendChild(createListingCard(l, true)));
      animateCards(grid);
    }
  }

  // Sold listings
  const soldGrid = document.getElementById('profile-sold-grid');
  if (soldGrid) {
    if (sold.length === 0) {
      soldGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#10003;</div>
          <div class="empty-title">NO SOLD ITEMS YET</div>
          <div class="empty-sub">Items you've sold will appear here.</div>
        </div>
      `;
    } else {
      soldGrid.innerHTML = '';
      sold.forEach(l => soldGrid.appendChild(createListingCard(l, false)));
    }
  }
}

async function saveProfile(e) {
  e.preventDefault();
  if (!State.user) return;

  const errEl = document.getElementById('profile-save-error');
  if (errEl) errEl.classList.remove('show');

  const updates = {
    username: document.getElementById('s-username').value.trim(),
    bio: document.getElementById('s-bio').value.trim(),
    location: document.getElementById('s-location').value.trim() || null,
    phone: document.getElementById('s-phone').value.trim() || null,
    website: document.getElementById('s-website').value.trim() || null
  };

  if (updates.username.length < 3) {
    if (errEl) { errEl.textContent = 'Username must be at least 3 characters.'; errEl.classList.add('show'); }
    return;
  }

  const { error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', State.user.id);

  if (error) {
    const msg = error.message.includes('unique') ? 'That username is already taken.' : error.message;
    if (errEl) { errEl.textContent = 'Failed to save profile: ' + msg; errEl.classList.add('show'); }
    showToast('Failed to save profile.', 'error');
  } else {
    State.profile = { ...State.profile, ...updates };
    updateAuthUI();
    showToast('Profile updated!', 'success');
    // Refresh profile display
    loadProfile();
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

function openEditProfile() {
  const settingsTab = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTab) {
    settingsTab.click();
    settingsTab.scrollIntoView({ behavior: 'smooth' });
  }
}

/* ============================================================
   SECTION: MARK SOLD
   ============================================================ */

function openMarkSoldModal(listingId) {
  document.getElementById('mark-sold-listing-id').value = listingId;
  document.getElementById('mark-sold-modal').classList.add('open');
}

async function confirmMarkSold() {
  const listingId = document.getElementById('mark-sold-listing-id').value;
  if (!listingId || !State.user) return;

  try {
    const { error } = await db
      .from('listings')
      .update({ is_sold: true, sold_at: new Date().toISOString() })
      .eq('id', listingId)
      .eq('seller_id', State.user.id);

    if (error) throw error;

    closeModal('mark-sold-modal');
    showToast('Listing marked as sold!', 'success');

    // Update local state
    const idx = State.listings.findIndex(l => l.id === listingId);
    if (idx !== -1) State.listings.splice(idx, 1);
    applyFilters();

    // Reload profile listings if on profile page
    if (State.currentPage === 'profile') loadProfileListings();
    if (State.currentPage === 'detail') navigate('profile');
  } catch (err) {
    console.error('Error marking as sold:', err);
    showToast('Failed to mark as sold: ' + err.message, 'error');
  }
}

/* ============================================================
   SECTION: ITEM DETAIL MODULE
   ============================================================ */

async function openListing(listingId) {
  navigate('detail');

  const content = document.getElementById('detail-content');
  if (content) content.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';

  try {
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
  const isOwner = State.user && State.user.id === listing.seller_id;
  const isWished = State.wishlistIds.has(listing.id);
  const savings = listing.msrp && listing.price < listing.msrp
    ? Math.round((1 - listing.price / listing.msrp) * 100)
    : null;

  // Images
  const imagesHtml = listing.images && listing.images.length > 0
    ? `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" id="main-detail-img" />`
    : `<div class="card-no-image">${categoryIcon(listing.category)}</div>`;

  const thumbsHtml = listing.images && listing.images.length > 1
    ? `<div class="image-thumbs">
        ${listing.images.map((img, i) => `
          <div class="image-thumb ${i === 0 ? 'active' : ''}" onclick="switchDetailImage('${escHtml(img)}', this)">
            <img src="${escHtml(img)}" alt="Thumb ${i + 1}" />
          </div>
        `).join('')}
      </div>`
    : '';

  // Actions
  let actionsHtml;
  if (isOwner) {
    actionsHtml = `
      <button class="btn btn-outline" onclick="editListing('${listing.id}')">&#9998; EDIT LISTING</button>
      ${!listing.is_sold ? `<button class="btn btn-primary" onclick="openMarkSoldModal('${listing.id}')">&#10003; MARK AS SOLD</button>` : ''}
      <button class="btn btn-danger" onclick="deleteListing('${listing.id}')">&#10005; DELETE</button>
    `;
  } else {
    actionsHtml = `
      ${listing.type === 'buy-now' ? '<button class="btn btn-primary btn-lg">BUY NOW</button>' : ''}
      ${listing.type === 'offers' ? '<button class="btn btn-primary btn-lg">MAKE AN OFFER</button>' : ''}
      ${listing.type === 'auction' ? '<button class="btn btn-primary btn-lg">PLACE BID</button>' : ''}
      ${State.user ? `
        <button class="btn btn-outline wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(event, '${listing.id}')" id="detail-wish-btn">
          ${isWished ? '&#9829; REMOVE FROM WISHLIST' : '&#9825; ADD TO WISHLIST'}
        </button>
      ` : `
        <button class="btn btn-outline" onclick="openAuthModal()">&#9825; LOGIN TO SAVE</button>
      `}
    `;
  }

  // Payment methods display
  const paymentHtml = listing.payment_methods?.length
    ? `<div class="detail-meta-item" style="grid-column:1/-1;">
        <div class="detail-meta-label">Payment Methods</div>
        <div class="detail-meta-value">${listing.payment_methods.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' · ')}</div>
       </div>`
    : '';

  content.innerHTML = `
    <div class="detail-grid animate-fade">
      <!-- Images -->
      <div class="detail-images">
        <div class="main-image-wrap">${imagesHtml}</div>
        ${thumbsHtml}
      </div>

      <!-- Info Panel -->
      <div class="detail-info">
        ${listing.is_sold ? '<div class="sold-banner">SOLD</div>' : ''}
        <h1 class="detail-title">${escHtml(listing.name)}</h1>
        ${listing.subcategory ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">${escHtml(listing.category)} &rsaquo; ${escHtml(listing.subcategory)}</div>` : ''}

        <div class="detail-price-row">
          <span class="detail-price">$${parseFloat(listing.price).toFixed(2)}</span>
          ${listing.msrp ? `<span class="detail-msrp">$${parseFloat(listing.msrp).toFixed(2)} MSRP</span>` : ''}
          ${savings ? `<span class="detail-savings">${savings}% BELOW MSRP</span>` : ''}
        </div>

        <div class="detail-badges">
          <span class="badge badge-condition">${CONDITION_LABELS[listing.condition] || listing.condition}</span>
          <span class="badge badge-type">${listing.type.replace(/-/g, ' ').toUpperCase()}</span>
          <span class="badge badge-shipping">&#9992; ${listing.shipping.toUpperCase()}</span>
          ${listing.is_fair ? '<span class="badge badge-fair">&#10003; AI FAIR PRICE</span>' : ''}
          ${listing.is_featured ? '<span class="badge badge-featured">&#9733; FEATURED</span>' : ''}
        </div>

        <div class="detail-description">${escHtml(listing.description)}</div>

        ${listing.tags && listing.tags.length > 0 ? `
          <div class="detail-tags">
            ${listing.tags.map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('')}
          </div>
        ` : ''}

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
          <div class="detail-meta-item">
            <div class="detail-meta-label">Listed</div>
            <div class="detail-meta-value">${new Date(listing.created_at).toLocaleDateString()}</div>
          </div>
          <div class="detail-meta-item">
            <div class="detail-meta-label">Expires</div>
            <div class="detail-meta-value">${listing.expires_at ? new Date(listing.expires_at).toLocaleDateString() : 'N/A'}</div>
          </div>
          ${paymentHtml}
        </div>

        <!-- Seller Info -->
        <div class="seller-card">
          <div class="seller-avatar">
            ${seller.avatar_url
              ? `<img src="${escHtml(seller.avatar_url)}" alt="${escHtml(seller.username || '')}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`
              : (seller.username || '?').charAt(0).toUpperCase()
            }
          </div>
          <div style="flex:1;">
            <div class="seller-name">${escHtml(seller.username || 'Anonymous')}</div>
            ${seller.location ? `<div class="seller-location">; ${escHtml(seller.location)}</div>` : ''}
            ${seller.rating > 0 ? `<div class="seller-rating">${'&#9733;'.repeat(Math.round(seller.rating))} ${parseFloat(seller.rating).toFixed(1)}</div>` : ''}
            ${seller.bio ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${escHtml(seller.bio.slice(0, 100))}${seller.bio.length > 100 ? '...' : ''}</div>` : ''}
          </div>
        </div>

        <!-- Actions -->
        <div class="detail-actions">${actionsHtml}</div>

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
  const msrp = listing.msrp ? parseFloat(listing.msrp) : null;

  if (listing.is_fair) {
    insights.push({ type: 'positive', text: `AI Fair Price: This listing is priced fairly${msrp ? ` relative to its MSRP ($${msrp.toFixed(2)})` : ''}.` });
  } else if (msrp && price > msrp * 1.5) {
    insights.push({ type: 'warning', text: `Price Alert: This item is priced ${Math.round((price/msrp - 1)*100)}% above MSRP. Research other listings before purchasing.` });
  } else if (!msrp) {
    insights.push({ type: 'neutral', text: `Price Verification: No MSRP was provided. Check similar items on retail sites to verify fair market value.` });
  }

  const conditionMap = {
    'new': 'Listed as New — expect full functionality and original packaging.',
    'like-new': 'Like-New condition suggests minimal use. Great for collectors.',
    'good': 'Good condition indicates normal wear. Solid value for play or display.',
    'fair': 'Fair condition — may have visible wear. Verify details with the seller.',
    'poor': 'Poor condition — heavily used or damaged. Best for parts or budget builds.'
  };
  if (conditionMap[listing.condition]) {
    insights.push({ type: 'info', text: `Condition: ${conditionMap[listing.condition]}` });
  }

  if (msrp) {
    const low = (msrp * 0.65).toFixed(2);
    const high = (msrp * 1.25).toFixed(2);
    insights.push({ type: 'info', text: `Market Range: Similar ${listing.condition} items typically sell for $${low} – $${high}.` });
  }

  const risks = [];
  if (!listing.images || listing.images.length === 0) risks.push('no photos provided');
  if (!listing.location) risks.push('no location specified');
  if (listing.payment_methods?.length === 1 && listing.payment_methods[0] === 'cash') risks.push('cash-only payment increases buyer risk');

  if (risks.length > 0) {
    insights.push({ type: 'warning', text: `Caution Flags: ${risks.join('; ')}. Verify with the seller before committing.` });
  } else {
    insights.push({ type: 'positive', text: 'Risk Profile: This listing appears well-documented. Low risk profile.' });
  }

  const rec = listing.is_fair
    ? 'Recommendation: This appears to be a trustworthy, fairly-priced deal worth considering.'
    : 'Recommendation: Compare to similar sold listings on other platforms before purchasing.';
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
      .limit(12);

    const items = data || [];
    if (items.length === 0) {
      const section = document.getElementById('similar-section');
      if (section) section.style.display = 'none';
      return;
    }

    scroll.innerHTML = '';
    items.forEach(l => scroll.appendChild(createListingCard(l)));
    animateCards(scroll);
  } catch (err) {
    const section = document.getElementById('similar-section');
    if (section) section.style.display = 'none';
  }
}

async function editListing(listingId) {
  State.editingListingId = listingId;
  navigate('create');
}

async function deleteListing(listingId) {
  if (!confirm('Are you sure you want to permanently delete this listing? This cannot be undone.')) return;

  try {
    const { error } = await db
      .from('listings')
      .delete()
      .eq('id', listingId)
      .eq('seller_id', State.user.id);
    if (error) throw error;

    State.listings = State.listings.filter(l => l.id !== listingId);
    applyFilters();

    showToast('Listing deleted.', 'success');
    if (State.currentPage === 'detail') navigate('profile');
  } catch (err) {
    console.error('Error deleting listing:', err);
    showToast('Failed to delete listing: ' + err.message, 'error');
  }
}

/* ============================================================
   SECTION: RENDER ENGINE
   ============================================================ */

function createListingCard(listing, showOwnerActions) {
  const card = document.createElement('div');
  card.className = 'listing-card animate-fade-up';
  card.onclick = (e) => {
    if (e.target.closest('.owner-btn, .wishlist-btn')) return;
    openListing(listing.id);
  };

  const isWished = State.wishlistIds.has(listing.id);
  const isOwner = State.user && State.user.id === listing.seller_id;
  const showActions = showOwnerActions !== undefined ? showOwnerActions : isOwner;

  const img = listing.images && listing.images.length > 0
    ? `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" loading="lazy"
         onerror="this.parentElement.innerHTML='<div class=\'card-no-image\'>${categoryIcon(listing.category)}</div>'" />`
    : `<div class="card-no-image">${categoryIcon(listing.category)}</div>`;

  let wishlistBtn = '';
  if (State.user && !isOwner) {
    wishlistBtn = `
      <button class="wishlist-btn ${isWished ? 'active' : ''}"
        onclick="toggleWishlist(event, '${listing.id}')"
        title="${isWished ? 'Remove from wishlist' : 'Add to wishlist'}"
      >${isWished ? '&#9829;' : '&#9825;'}</button>
    `;
  }

  let ownerActions = '';
  if (showActions && isOwner) {
    ownerActions = `
      <div class="card-owner-actions">
        <button class="owner-btn edit" onclick="editListing('${listing.id}')">EDIT</button>
        ${!listing.is_sold ? `<button class="owner-btn sold" onclick="openMarkSoldModal('${listing.id}')">SOLD</button>` : ''}
        <button class="owner-btn delete" onclick="deleteListing('${listing.id}')">DELETE</button>
      </div>
    `;
  }

  const soldOverlay = listing.is_sold ? '<div class="card-sold-overlay">SOLD</div>' : '';

  card.innerHTML = `
    <div class="card-image-wrap">
      ${img}
      ${listing.is_fair ? '<span class="card-badge fair">AI FAIR</span>' : ''}
      ${listing.is_featured ? '<span class="card-badge featured">&#9733;</span>' : ''}
      ${soldOverlay}
      ${wishlistBtn}
    </div>
    <div class="card-body">
      <div class="card-title" title="${escHtml(listing.name)}">${escHtml(listing.name)}</div>
      ${listing.subcategory ? `<div class="card-subcategory">${escHtml(listing.subcategory)}</div>` : ''}
      <div>
        <span class="card-price">$${parseFloat(listing.price).toFixed(2)}</span>
        ${listing.msrp && listing.msrp > listing.price
          ? `<span class="card-msrp">$${parseFloat(listing.msrp).toFixed(2)}</span>`
          : ''}
      </div>
      <div class="card-meta">
        <span class="card-condition">${listing.condition || 'N/A'}</span>
        <span class="card-type">${listing.type ? listing.type.replace(/-/g, ' ') : ''}</span>
        ${listing.location ? `<span>&#128205; ${escHtml(listing.location)}</span>` : ''}
      </div>
      ${ownerActions}
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
        <div class="empty-sub">${
          State.listings && State.listings.length === 0
            ? 'Be the first to list something for sale!'
            : 'Try adjusting your search or filters.'
        }</div>
        ${State.user
          ? `<br/><button class="btn btn-primary" onclick="navigate('create')" style="margin-top:12px;">+ LIST AN ITEM</button>`
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
   SECTION: ANIMATIONS
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
    .replace(/'/g, '&#039;');
}

/* ============================================================
   SECTION: TOAST NOTIFICATIONS
   ============================================================ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '&#10003;', error: '&#9888;', info: '&#9432;', warning: '&#9651;' };
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
   SECTION: ERROR BANNER
   ============================================================ */

function showErrorBanner() {
  document.getElementById('error-banner')?.classList.add('show');
}

function hideErrorBanner() {
  document.getElementById('error-banner')?.classList.remove('show');
}

/* ============================================================
   SECTION: EVENT LISTENERS
   ============================================================ */

function setupEventListeners() {
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('mobile-nav')?.classList.toggle('open');
  });

  // Debounced search
  let searchTimer;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    State.searchQuery = e.target.value;
    searchTimer = setTimeout(() => {
      if (State.currentPage !== 'shop') navigate('shop');
      applyFilters();
    }, 320);
  });

  // Description char counter
  document.getElementById('c-desc')?.addEventListener('input', updateDescCounter);

  // Keyboard shortcuts
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

  // Online/offline
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

  // Mobile filter toggle visibility
  const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
  const updateFilterBtnVisibility = () => {
    if (mobileFilterToggle) {
      mobileFilterToggle.style.display = window.innerWidth < 900 ? 'inline-flex' : 'none';
    }
  };
  window.addEventListener('resize', updateFilterBtnVisibility);
  updateFilterBtnVisibility();

  // Close mobile nav on outside click
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
   SECTION: INITIALIZATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await initAuth();
  navigate('shop');

  const logo = document.querySelector('.logo');
  if (logo) logo.style.animation = 'neonPulse 3.5s ease-in-out infinite';

  if (!navigator.onLine) showErrorBanner();

  console.log(
    '%c OBTAINUM INITIALIZED ',
    'background:#00ff41;color:#001a07;font-family:monospace;font-weight:bold;font-size:14px;padding:4px 8px;'
  );
});

