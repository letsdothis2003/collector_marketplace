/* ============================================================
   FILE: script.js
   OBTAINUM MARKETPLACE — Full functionality with working theme toggle
   Dark mode (black) <-> Light mode (white)
   ============================================================ */

// ==================== DATABASE CONFIG ====================
const SUPABASE_URL = "https://gotzmuobwuubsugnowxq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs";

let db;
try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('[OBTAINUM] Supabase init failed:', e);
}

// ==================== STATE MANAGEMENT ====================
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
  currentChatPartnerId: null,
  currentListingId: null
};

// ==================== HELPER FUNCTIONS ====================
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showToast(message, type = 'info') {
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

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function closeOnOverlay(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

function setLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="spinner"></span> ${text}` : text;
}

// ==================== THEME TOGGLE (FIXED) ====================
function initTheme() {
  const saved = localStorage.getItem('obtainum-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(mode) {
  if (mode === 'light') {
    document.body.classList.add('light-mode');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('light-mode');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.textContent = '🌙';
  }
  localStorage.setItem('obtainum-theme', mode);
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-mode');
  if (isLight) {
    applyTheme('dark');
    showToast('Dark mode activated', 'info');
  } else {
    applyTheme('light');
    showToast('Light mode activated', 'info');
  }
}

// ==================== NAVIGATION ====================
function navigate(page) {
  const pages = ['shop', 'detail', 'create', 'profile', 'wishlist', 'messages', 'assistant', 'donate'];
  if (!pages.includes(page)) page = 'shop';
  
  pages.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.remove('active');
  });
  
  document.getElementById(`page-${page}`)?.classList.add('active');
  State.currentPage = page;
  updateNavActive(page);
  
  updateRestrictedPageUI();
  
  if (page === 'shop') loadListings();
  if (page === 'profile' && State.user) loadProfile();
  if (page === 'wishlist' && State.user) loadWishlist();
  if (page === 'create' && State.user) initCreatePage();
  if (page === 'messages' && State.user) loadMessages();
  if (page === 'assistant') updateAssistantUI();
}

function updateNavActive(page) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const el = document.getElementById(`nav-${page}`);
  if (el) el.classList.add('active');
}

function updateRestrictedPageUI() {
  const messagesLoginNotice = document.getElementById('messages-login-notice');
  const chatForm = document.getElementById('chatForm');
  const conversationList = document.getElementById('conversationList');
  const activeChatHeader = document.getElementById('activeChatHeader');
  const chatThread = document.getElementById('chatThread');
  
  if (!State.user) {
    if (messagesLoginNotice) messagesLoginNotice.classList.remove('hidden');
    if (chatForm) chatForm.style.display = 'none';
    if (conversationList) conversationList.innerHTML = '<div class="empty-state-small">Login to see conversations</div>';
    if (activeChatHeader) activeChatHeader.innerHTML = 'Login to chat';
    if (chatThread) chatThread.innerHTML = '<div class="empty-state-small">🔐 Please login to send and receive messages</div>';
  } else {
    if (messagesLoginNotice) messagesLoginNotice.classList.add('hidden');
  }
  
  updateAssistantUI();
}

function updateAssistantUI() {
  const assistantLoginNotice = document.getElementById('assistant-login-notice');
  const assistantInput = document.getElementById('assistantInput');
  const assistantBtn = document.getElementById('askAssistantBtn');
  const assistantSuggestions = document.querySelector('.assistant-suggestions');
  
  if (!State.user) {
    if (assistantLoginNotice) assistantLoginNotice.classList.remove('hidden');
    if (assistantInput) assistantInput.disabled = true;
    if (assistantBtn) assistantBtn.disabled = true;
    if (assistantSuggestions) {
      assistantSuggestions.style.opacity = '0.5';
      assistantSuggestions.style.pointerEvents = 'none';
    }
  } else {
    if (assistantLoginNotice) assistantLoginNotice.classList.add('hidden');
    if (assistantInput) assistantInput.disabled = false;
    if (assistantBtn) assistantBtn.disabled = false;
    if (assistantSuggestions) {
      assistantSuggestions.style.opacity = '1';
      assistantSuggestions.style.pointerEvents = 'auto';
    }
  }
}

// ==================== AUTH MODULE ====================
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
    updateRestrictedPageUI();
    if (State.currentPage === 'messages' && State.user) loadMessages();
    if (State.currentPage === 'assistant') updateAssistantUI();
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
      showToast(`Welcome, ${finalUsername}!`, 'success');
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
  State.currentChatPartnerId = null;
  State.currentListingId = null;
  updateAuthUI();
  if (State.currentPage === 'profile') navigate('shop');
  if (State.currentPage === 'messages') navigate('shop');
  if (State.currentPage === 'wishlist') navigate('shop');
  if (State.currentPage === 'create') navigate('shop');
  showToast('Signed out successfully.', 'info');
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
  
  if (btn) setLoading(btn, true, 'LOGGING IN...');
  if (errEl) errEl.classList.remove('show');
  
  try {
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    closeModal('auth-modal');
    showToast('Welcome back to OBTAINUM!', 'success');
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Login failed.';
      errEl.classList.add('show');
    }
  } finally {
    if (btn) setLoading(btn, false, 'LOGIN TO OBTAINUM');
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
  
  if (btn) setLoading(btn, true, 'CREATING ACCOUNT...');
  if (errEl) errEl.classList.remove('show');
  
  try {
    const { data, error } = await db.auth.signUp({
      email,
      password: pass,
      options: { data: { username } }
    });
    if (error) throw error;
    
    if (data.session) {
      closeModal('auth-modal');
      showToast('Account created! Welcome to OBTAINUM.', 'success');
    } else {
      document.getElementById('register-form-wrap').innerHTML = `
        <div class="auth-confirm-panel">
          <div class="confirm-icon">✉️</div>
          <div class="confirm-title">CHECK YOUR EMAIL</div>
          <div class="confirm-msg">Click the confirmation link to activate your account.</div>
          <button class="btn btn-outline w-full" onclick="closeModal('auth-modal')">GOT IT</button>
        </div>
      `;
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Registration failed.';
      errEl.classList.add('show');
    }
  } finally {
    const btn2 = document.getElementById('register-btn');
    if (btn2) setLoading(btn2, false, 'CREATE ACCOUNT');
  }
}

async function signOut() {
  await db.auth.signOut();
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
    if (loginTab) loginTab.classList.add('active');
    if (regTab) regTab.classList.remove('active');
    if (loginForm) loginForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
  } else {
    if (regTab) regTab.classList.add('active');
    if (loginTab) loginTab.classList.remove('active');
    if (regForm) regForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
  }
}

// ==================== LISTINGS MODULE ====================
async function loadListings() {
  if (!db) { renderListings([]); return; }
  try {
    showSkeletons();
    
    const { data, error } = await db
      .from('listings')
      .select(`
        *,
        profiles:seller_id (
          id,
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
  
  const q = (State.searchQuery || '').toLowerCase();
  if (q.length >= 2) {
    results = results.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.category?.toLowerCase().includes(q)
    );
  }
  
  if (State.activeCategory !== 'all') {
    results = results.filter(l => l.category === State.activeCategory);
  }
  
  if (State.activeCondition !== 'all') {
    results = results.filter(l => l.condition === State.activeCondition);
  }
  
  if (State.activeType !== 'all') {
    results = results.filter(l => l.type === State.activeType);
  }
  
  const minP = parseFloat(document.getElementById('price-min')?.value || '');
  const maxP = parseFloat(document.getElementById('price-max')?.value || '');
  if (!isNaN(minP)) results = results.filter(l => l.price >= minP);
  if (!isNaN(maxP)) results = results.filter(l => l.price <= maxP);
  
  if (document.getElementById('fair-only')?.checked) {
    results = results.filter(l => l.is_fair === true);
  }
  if (document.getElementById('featured-only')?.checked) {
    results = results.filter(l => l.is_featured === true);
  }
  
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
  const valSpan = document.getElementById('price-slider-val');
  const maxInput = document.getElementById('price-max');
  if (valSpan) valSpan.textContent = '$' + slider.value;
  if (maxInput) maxInput.value = slider.value;
  applyFilters();
}

function resetFilters() {
  State.activeCategory = 'all';
  State.activeCondition = 'all';
  State.activeType = 'all';
  State.searchQuery = '';
  
  const searchInput = document.getElementById('search-input');
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  const priceSlider = document.getElementById('price-slider');
  const fairOnly = document.getElementById('fair-only');
  const featuredOnly = document.getElementById('featured-only');
  const sortSelect = document.getElementById('sort-select');
  
  if (searchInput) searchInput.value = '';
  if (priceMin) priceMin.value = '';
  if (priceMax) priceMax.value = '';
  if (priceSlider) priceSlider.value = 2000;
  if (fairOnly) fairOnly.checked = false;
  if (featuredOnly) featuredOnly.checked = false;
  if (sortSelect) sortSelect.value = 'newest';
  
  const priceSliderVal = document.getElementById('price-slider-val');
  if (priceSliderVal) priceSliderVal.textContent = '$2000';
  
  document.querySelectorAll('.chip[data-cat]').forEach(c =>
    c.classList.toggle('active', c.dataset.cat === 'all'));
  document.querySelectorAll('.chip[data-cond]').forEach(c =>
    c.classList.toggle('active', c.dataset.cond === 'all'));
  document.querySelectorAll('.chip[data-type]').forEach(c =>
    c.classList.toggle('active', c.dataset.type === 'all'));
  
  applyFilters();
  showToast('Filters reset.', 'info');
}

// ==================== WISHLIST MODULE ====================
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
          profiles:seller_id (id, username, avatar_url, rating, location)
        )
      `)
      .eq('user_id', State.user.id);
    
    if (error) throw error;
    
    const listings = (data || []).map(w => w.listings).filter(Boolean);
    if (container) {
      if (listings.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><div class="empty-title">YOUR WISHLIST IS EMPTY</div></div>`;
      } else {
        container.innerHTML = '';
        listings.forEach(l => container.appendChild(createListingCard(l)));
      }
    }
  } catch (err) {
    console.error('Error loading wishlist:', err);
  }
}

async function toggleWishlist(e, listingId) {
  e.stopPropagation();
  if (!State.user) { openAuthModal(); return; }
  
  const listing = State.listings.find(l => l.id === listingId);
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

// ==================== CREATE/EDIT LISTING ====================
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
  
  if (form) form.reset();
  State.imageFiles = [];
  State.keepExistingImages = [];
  const previewGrid = document.getElementById('image-preview-grid');
  if (previewGrid) previewGrid.innerHTML = '';
  
  const existingSection = document.getElementById('existing-images-section');
  const existingGrid = document.getElementById('existing-image-grid');
  if (existingSection) existingSection.classList.add('hidden');
  if (existingGrid) existingGrid.innerHTML = '';
  
  const paymentCheckboxes = document.querySelectorAll('input[name="payment"]');
  paymentCheckboxes.forEach(cb => {
    cb.checked = cb.value === 'cash';
  });
  
  updateSubcategories();
  
  if (State.editingListingId) {
    if (title) title.textContent = '✏️ EDIT LISTING';
    if (submitBtn) submitBtn.textContent = 'SAVE CHANGES';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    
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
        if (title) title.textContent = '+ CREATE LISTING';
        if (submitBtn) submitBtn.textContent = 'PUBLISH LISTING';
        if (cancelBtn) cancelBtn.style.display = 'none';
        return;
      }
    }
    
    if (listing) {
      const nameInput = document.getElementById('c-name');
      const categorySelect = document.getElementById('c-category');
      const descTextarea = document.getElementById('c-desc');
      const priceInput = document.getElementById('c-price');
      const msrpInput = document.getElementById('c-msrp');
      const conditionSelect = document.getElementById('c-condition');
      const typeSelect = document.getElementById('c-type');
      const shippingSelect = document.getElementById('c-shipping');
      const locationInput = document.getElementById('c-location');
      const tagsInput = document.getElementById('c-tags');
      
      if (nameInput) nameInput.value = listing.name || '';
      if (categorySelect) categorySelect.value = listing.category || '';
      if (descTextarea) descTextarea.value = listing.description || '';
      if (priceInput) priceInput.value = listing.price ?? '';
      if (msrpInput) msrpInput.value = listing.msrp || '';
      if (conditionSelect) conditionSelect.value = listing.condition || '';
      if (typeSelect) typeSelect.value = listing.type || 'buy-now';
      if (shippingSelect) shippingSelect.value = listing.shipping || 'paid';
      if (locationInput) locationInput.value = listing.location || '';
      if (tagsInput) tagsInput.value = (listing.tags || []).join(', ');
      
      updateSubcategories();
      const subcategorySelect = document.getElementById('c-subcategory');
      if (subcategorySelect && listing.subcategory) {
        subcategorySelect.value = listing.subcategory;
      }
      
      if (listing.payment_methods && listing.payment_methods.length > 0) {
        paymentCheckboxes.forEach(cb => {
          cb.checked = listing.payment_methods.includes(cb.value);
        });
      }
      
      if (listing.images && listing.images.length > 0) {
        State.keepExistingImages = [...listing.images];
        if (existingSection) existingSection.classList.remove('hidden');
        if (existingGrid) {
          existingGrid.innerHTML = '';
          listing.images.forEach((url, i) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item animate-pop';
            item.innerHTML = `
              <img src="${escHtml(url)}" alt="Image ${i + 1}" />
              <button class="remove-image" onclick="removeExistingImage(${i})" title="Remove">&times;</button>
            `;
            existingGrid.appendChild(item);
          });
        }
      }
      
      updateDescCounter();
    }
  } else {
    if (title) title.textContent = '+ CREATE LISTING';
    if (submitBtn) submitBtn.textContent = 'PUBLISH LISTING';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

function updateSubcategories() {
  const cat = document.getElementById('c-category')?.value;
  const group = document.getElementById('subcategory-group');
  const sel = document.getElementById('c-subcategory');
  if (!group || !sel) return;
  
  const SUBCATEGORIES = {
    'Collectibles': ['Action Figures', 'Trading Cards', 'Comics', 'Stamps', 'Coins', 'Vintage Items'],
    'Electronics': ['Phones', 'Computers', 'Cameras', 'Audio', 'Gaming', 'TVs'],
    'Clothing & Accessories': ['Shirts', 'Pants', 'Shoes', 'Hats', 'Bags', 'Jewelry'],
    'Toys & Figures': ['Action Figures', 'Board Games', 'Building Sets', 'Puzzles', 'Plush'],
    'Other': ['Other']
  };
  
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
  if (!grid) return;
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
  if (!grid) return;
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
  if (errEl) errEl.classList.remove('show');
  if (btn) setLoading(btn, true, isEditing ? 'SAVING...' : 'PUBLISHING...');
  
  try {
    let newImageUrls = [];
    if (State.imageFiles.length > 0) {
      newImageUrls = await uploadImages(State.user.id);
    }
    
    const allImages = [...State.keepExistingImages, ...newImageUrls];
    
    const paymentMethods = Array.from(
      document.querySelectorAll('input[name="payment"]:checked')
    ).map(cb => cb.value);
    
    if (paymentMethods.length === 0) paymentMethods.push('cash');
    
    const price = parseFloat(document.getElementById('c-price')?.value || '0');
    const msrpVal = document.getElementById('c-msrp')?.value;
    const msrp = msrpVal ? parseFloat(msrpVal) : null;
    const tagsRaw = document.getElementById('c-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
    const subcategoryEl = document.getElementById('c-subcategory');
    const subcategory = subcategoryEl && subcategoryEl.value ? subcategoryEl.value : null;
    
    const isFair = msrp ? price <= msrp * 1.2 : true;
    
    const listingData = {
      seller_id: State.user.id,
      name: document.getElementById('c-name')?.value.trim() || '',
      category: document.getElementById('c-category')?.value || '',
      subcategory: subcategory,
      description: document.getElementById('c-desc')?.value.trim() || '',
      price: price,
      msrp: msrp,
      condition: document.getElementById('c-condition')?.value || '',
      type: document.getElementById('c-type')?.value || 'buy-now',
      shipping: document.getElementById('c-shipping')?.value || 'paid',
      location: document.getElementById('c-location')?.value.trim() || null,
      tags: tags,
      payment_methods: paymentMethods,
      is_fair: isFair,
      images: allImages
    };
    
    if (!listingData.name || !listingData.category || !listingData.description || isNaN(price)) {
      throw new Error('Please fill out all required fields.');
    }
    if (listingData.description.length < 10) {
      throw new Error('Description must be at least 10 characters.');
    }
    
    let savedListing;
    if (isEditing) {
      delete listingData.seller_id;
      const { data, error } = await db
        .from('listings')
        .update(listingData)
        .eq('id', State.editingListingId)
        .eq('seller_id', State.user.id)
        .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;
      
      const idx = State.listings.findIndex(l => l.id === State.editingListingId);
      if (idx !== -1) State.listings[idx] = savedListing;
    } else {
      const { data, error } = await db
        .from('listings')
        .insert(listingData)
        .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;
      State.listings.unshift(savedListing);
    }
    
    const form = document.getElementById('create-form');
    if (form) form.reset();
    State.imageFiles = [];
    State.keepExistingImages = [];
    const previewGrid = document.getElementById('image-preview-grid');
    if (previewGrid) previewGrid.innerHTML = '';
    State.editingListingId = null;
    
    showToast(isEditing ? 'Listing updated!' : 'Listing published!', 'success');
    navigate(isEditing ? 'profile' : 'shop');
    
  } catch (err) {
    console.error('Error submitting listing:', err);
    if (errEl) {
      errEl.textContent = err.message || 'An unknown error occurred.';
      errEl.classList.add('show');
    }
  } finally {
    if (btn) setLoading(btn, false, isEditing ? 'SAVE CHANGES' : 'PUBLISH LISTING');
  }
}

// ==================== PROFILE MODULE ====================
async function loadProfile() {
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  const profileIdToLoad = window.selectedProfileId || State.user.id;
  const isOwnProfile = profileIdToLoad === State.user.id;
  
  if (window.selectedProfileId) delete window.selectedProfileId;
  
  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', profileIdToLoad)
    .single();
  
  if (error) {
    showToast("Could not load profile.", 'error');
    navigate('shop');
    return;
  }
  
  const avatarEl = document.getElementById('profile-avatar-lg');
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const bioEl = document.getElementById('profile-bio');
  const locationEl = document.getElementById('profile-location');
  
  const name = profile?.username || '?';
  
  if (avatarEl) {
    if (profile?.avatar_url) {
      avatarEl.innerHTML = `<img src="${escHtml(profile.avatar_url)}" alt="${escHtml(name)}" />`;
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }
  
  if (usernameEl) usernameEl.textContent = (profile?.username || name).toUpperCase();
  if (emailEl) emailEl.textContent = isOwnProfile ? profile.email : '';
  if (bioEl) bioEl.textContent = profile?.bio || '';
  if (locationEl) locationEl.textContent = profile?.location ? '📍 ' + profile.location : '';
  
  const editButton = document.querySelector('#page-profile .profile-banner .btn');
  if (editButton) {
    if (isOwnProfile) {
      editButton.innerHTML = '✏️ Edit Profile';
      editButton.onclick = openEditProfile;
      editButton.style.display = 'inline-block';
    } else if (profile) {
      editButton.innerHTML = '💬 Let\'s Chat';
      editButton.onclick = () => startChat(profile.id);
      editButton.style.display = 'inline-block';
    }
  }
  
  const profileTabs = document.querySelector('.profile-tabs');
  if (profileTabs) profileTabs.style.display = isOwnProfile ? 'flex' : 'none';
  
  const myListingsDiv = document.getElementById('ptab-my-listings');
  const soldDiv = document.getElementById('ptab-sold');
  const settingsDiv = document.getElementById('ptab-settings');
  
  if (myListingsDiv) myListingsDiv.style.display = 'block';
  if (soldDiv) soldDiv.style.display = 'none';
  if (settingsDiv) settingsDiv.style.display = 'none';
  
  if (isOwnProfile) {
    const profileTabsBtns = document.querySelectorAll('.profile-tab');
    profileTabsBtns.forEach(t => t.classList.remove('active'));
    const firstTab = document.querySelector('.profile-tab[data-ptab="my-listings"]');
    if (firstTab) firstTab.classList.add('active');
    
    const sUsername = document.getElementById('s-username');
    const sBio = document.getElementById('s-bio');
    const sLocation = document.getElementById('s-location');
    const sPhone = document.getElementById('s-phone');
    
    if (sUsername) sUsername.value = profile?.username || '';
    if (sBio) sBio.value = profile?.bio || '';
    if (sLocation) sLocation.value = profile?.location || '';
    if (sPhone) sPhone.value = profile?.phone || '';
  }
  
  await loadProfileListings(profileIdToLoad, isOwnProfile);
}

async function loadProfileListings(profileId, isOwnProfile) {
  if (!profileId) return;
  
  const { data } = await db
    .from('listings')
    .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
    .eq('seller_id', profileId)
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
  
  const grid = document.getElementById('profile-listings-grid');
  if (grid) {
    if (active.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">NO ACTIVE LISTINGS</div></div>`;
    } else {
      grid.innerHTML = '';
      active.forEach(l => grid.appendChild(createListingCard(l, isOwnProfile)));
    }
  }
  
  const soldGrid = document.getElementById('profile-sold-grid');
  if (isOwnProfile && soldGrid) {
    if (sold.length === 0) {
      soldGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">NO SOLD ITEMS YET</div></div>`;
    } else {
      soldGrid.innerHTML = '';
      sold.forEach(l => soldGrid.appendChild(createListingCard(l, false)));
    }
  }
}

async function saveProfile(e) {
  e.preventDefault();
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  const errEl = document.getElementById('profile-save-error');
  if (errEl) errEl.classList.remove('show');
  
  const username = document.getElementById('s-username')?.value.trim() || '';
  const bio = document.getElementById('s-bio')?.value.trim() || '';
  const location = document.getElementById('s-location')?.value.trim() || null;
  const phone = document.getElementById('s-phone')?.value.trim() || null;
  
  if (username.length < 3) {
    if (errEl) { 
      errEl.textContent = 'Username must be at least 3 characters.'; 
      errEl.classList.add('show'); 
    }
    showToast('Username must be at least 3 characters.', 'error');
    return;
  }
  
  const saveBtn = e.target.querySelector('button[type="submit"]');
  const originalText = saveBtn?.textContent || 'SAVE PROFILE';
  if (saveBtn) setLoading(saveBtn, true, 'SAVING...');
  
  try {
    const updates = {
      username: username,
      bio: bio,
      location: location,
      phone: phone,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', State.user.id);
    
    if (error) {
      const msg = error.message.includes('unique') ? 'That username is already taken.' : error.message;
      if (errEl) { 
        errEl.textContent = 'Failed to save profile: ' + msg; 
        errEl.classList.add('show'); 
      }
      showToast('Failed to save profile: ' + msg, 'error');
    } else {
      State.profile = { ...State.profile, ...updates };
      updateAuthUI();
      showToast('Profile updated successfully!', 'success');
      await loadProfile();
      if (errEl) errEl.classList.remove('show');
    }
  } catch (err) {
    console.error('Save profile error:', err);
    if (errEl) {
      errEl.textContent = 'An unexpected error occurred.';
      errEl.classList.add('show');
    }
    showToast('Failed to save profile.', 'error');
  } finally {
    if (saveBtn) setLoading(saveBtn, false, originalText);
  }
}

function switchProfileTab(btn) {
  const tabName = btn.dataset.ptab;
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  const myListingsDiv = document.getElementById('ptab-my-listings');
  const soldDiv = document.getElementById('ptab-sold');
  const settingsDiv = document.getElementById('ptab-settings');
  
  if (tabName === 'my-listings') {
    if (myListingsDiv) myListingsDiv.classList.remove('hidden');
    if (soldDiv) soldDiv.classList.add('hidden');
    if (settingsDiv) settingsDiv.classList.add('hidden');
  } else if (tabName === 'sold') {
    if (myListingsDiv) myListingsDiv.classList.add('hidden');
    if (soldDiv) soldDiv.classList.remove('hidden');
    if (settingsDiv) settingsDiv.classList.add('hidden');
    if (State.user) loadProfileListings(State.user.id, true);
  } else if (tabName === 'settings') {
    if (myListingsDiv) myListingsDiv.classList.add('hidden');
    if (soldDiv) soldDiv.classList.add('hidden');
    if (settingsDiv) settingsDiv.classList.remove('hidden');
  }
}

function openEditProfile() {
  const settingsTab = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTab) {
    settingsTab.click();
    settingsTab.scrollIntoView({ behavior: 'smooth' });
  }
}

// ==================== MARK SOLD ====================
function openMarkSoldModal(listingId) {
  const input = document.getElementById('mark-sold-listing-id');
  if (input) input.value = listingId;
  const modal = document.getElementById('mark-sold-modal');
  if (modal) modal.classList.add('open');
}

async function confirmMarkSold() {
  const listingId = document.getElementById('mark-sold-listing-id')?.value;
  if (!listingId || !State.user) return;
  
  try {
    const { error } = await db
      .from('listings')
      .update({ 
        is_sold: true, 
        sold_at: new Date().toISOString(),
        sold_to: State.user.id
      })
      .eq('id', listingId)
      .eq('seller_id', State.user.id);
    
    if (error) throw error;
    
    closeModal('mark-sold-modal');
    showToast('Listing marked as sold!', 'success');
    
    const idx = State.listings.findIndex(l => l.id === listingId);
    if (idx !== -1) State.listings.splice(idx, 1);
    applyFilters();
    
    if (State.currentPage === 'profile') loadProfileListings(State.user.id, true);
    if (State.currentPage === 'detail') navigate('profile');
  } catch (err) {
    console.error('Error marking as sold:', err);
    showToast('Failed to mark as sold: ' + err.message, 'error');
  }
}

// ==================== ITEM DETAIL MODULE ====================
async function openListing(listingId) {
  navigate('detail');
  
  const content = document.getElementById('detail-content');
  if (content) content.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';
  
  try {
    const { data: listing, error } = await db
      .from('listings')
      .select('*, profiles:seller_id(id, username, avatar_url, rating, location, bio)')
      .eq('id', listingId)
      .single();
    
    if (error) throw error;
    State.selectedListing = listing;
    
    try {
      await db.rpc('increment_view_count', { listing_id: listingId });
    } catch (rpcErr) {
      console.warn('RPC function not found');
    }
    
    renderDetail(listing);
    loadSimilarItems(listing);
  } catch (err) {
    console.error('Detail error:', err);
    if (content) content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">LISTING NOT FOUND</div></div>`;
  }
}

function renderDetail(listing) {
  const content = document.getElementById('detail-content');
  if (!content) return;
  
  const seller = listing.profiles || {};
  const isOwner = State.user && State.user.id === listing.seller_id;
  const isWished = State.wishlistIds.has(listing.id);
  
  const imagesHtml = listing.images && listing.images.length > 0
    ? `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" id="main-detail-img" style="max-width:100%;border-radius:var(--radius-lg);" />`
    : `<div class="card-no-image">📦</div>`;
  
  let actionsHtml;
  if (isOwner) {
    actionsHtml = `
      <button class="btn btn-outline" onclick="editListing('${listing.id}')">✏️ EDIT LISTING</button>
      ${!listing.is_sold ? `<button class="btn btn-primary" onclick="openMarkSoldModal('${listing.id}')">✅ MARK AS SOLD</button>` : ''}
      <button class="btn btn-danger" onclick="deleteListing('${listing.id}')">❌ DELETE</button>
    `;
  } else {
    const contactBtn = State.user 
      ? `<button class="btn btn-primary btn-lg" onclick="startChat('${listing.seller_id}', '${listing.id}')">💬 CONTACT SELLER</button>`
      : `<button class="btn btn-primary btn-lg" onclick="openAuthModal()">🔐 LOGIN TO CONTACT</button>`;
    
    const wishlistBtn = State.user 
      ? `<button class="btn btn-outline wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(event, '${listing.id}')">
          ${isWished ? '❤️ REMOVE FROM WISHLIST' : '🤍 ADD TO WISHLIST'}
        </button>`
      : `<button class="btn btn-outline" onclick="openAuthModal()">🤍 LOGIN TO SAVE</button>`;
    
    actionsHtml = `${contactBtn}${wishlistBtn}`;
  }
  
  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-images">${imagesHtml}</div>
      <div class="detail-info">
        ${listing.is_sold ? '<div class="sold-banner" style="background:var(--danger);padding:8px;text-align:center;border-radius:8px;margin-bottom:16px;">SOLD</div>' : ''}
        <h1 class="detail-title">${escHtml(listing.name)}</h1>
        <div class="detail-price-row">
          <span class="detail-price">$${parseFloat(listing.price).toFixed(2)}</span>
          ${listing.msrp ? `<span class="detail-msrp" style="text-decoration:line-through;color:var(--text-muted);">$${parseFloat(listing.msrp).toFixed(2)} MSRP</span>` : ''}
        </div>
        <div class="detail-description">${escHtml(listing.description)}</div>
        <div class="seller-card">
          <div class="seller-avatar">${seller.username?.charAt(0) || '?'}</div>
          <div><div class="seller-name">${escHtml(seller.username || 'Anonymous')}</div>
          ${seller.rating > 0 ? `<div class="seller-rating">⭐ ${parseFloat(seller.rating).toFixed(1)}</div>` : ''}</div>
          <button onclick="viewSellerProfile('${seller.id}')" class="btn btn-outline btn-sm">View Profile</button>
        </div>
        <div class="detail-actions" style="display:flex;flex-direction:column;gap:10px;">${actionsHtml}</div>
      </div>
    </div>
  `;
}

function viewSellerProfile(sellerId) {
  window.selectedProfileId = sellerId;
  navigate('profile');
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

async function loadSimilarItems(listing) {
  const scroll = document.getElementById('similar-scroll');
  if (!scroll) return;
  scroll.innerHTML = '<div style="padding:20px;">Loading...</div>';
  
  try {
    const { data } = await db
      .from('listings')
      .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
      .eq('category', listing.category)
      .eq('is_sold', false)
      .neq('id', listing.id)
      .limit(8);
    
    const items = data || [];
    if (items.length === 0) {
      const section = document.getElementById('similar-section');
      if (section) section.style.display = 'none';
      return;
    }
    
    scroll.innerHTML = '';
    items.forEach(l => scroll.appendChild(createListingCard(l)));
  } catch (err) {
    const section = document.getElementById('similar-section');
    if (section) section.style.display = 'none';
  }
}

// ==================== RENDER ENGINE ====================
function createListingCard(listing, showOwnerActions = false) {
  const card = document.createElement('div');
  card.className = 'listing-card animate-fade-up';
  card.onclick = (e) => {
    if (e.target.closest('.wishlist-btn, .owner-btn')) return;
    openListing(listing.id);
  };
  
  const isWished = State.wishlistIds.has(listing.id);
  const isOwner = State.user && State.user.id === listing.seller_id;
  const showActions = showOwnerActions !== undefined ? showOwnerActions : isOwner;
  
  const img = listing.images && listing.images.length > 0
    ? `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div class="card-no-image">📦</div>`;
  
  const paymentIcons = {
    'cash': '💵', 'card': '💳', 'paypal': '🅿️', 'venmo': 'V', 'crypto': '₿', 'trade': '🔄'
  };
  const paymentDisplay = listing.payment_methods && listing.payment_methods.length > 0
    ? listing.payment_methods.slice(0, 3).map(p => paymentIcons[p] || p).join(' ')
    : '💵';
  
  let wishlistBtn = '';
  if (State.user && !isOwner) {
    wishlistBtn = `
      <button class="wishlist-btn ${isWished ? 'active' : ''}"
        onclick="toggleWishlist(event, '${listing.id}')"
        style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;z-index:10;"
      >${isWished ? '❤️' : '🤍'}</button>
    `;
  }
  
  let ownerActions = '';
  if (showActions && isOwner && !listing.is_sold) {
    ownerActions = `
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="owner-btn" onclick="event.stopPropagation(); editListing('${listing.id}')" style="background:var(--neon);color:#001a07;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;font-size:11px;">EDIT</button>
        <button class="owner-btn" onclick="event.stopPropagation(); openMarkSoldModal('${listing.id}')" style="background:var(--warning);color:#001a07;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;font-size:11px;">SOLD</button>
      </div>
    `;
  }
  
  const soldOverlay = listing.is_sold ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);padding:8px 16px;border-radius:8px;font-weight:bold;color:var(--danger);z-index:5;">SOLD</div>' : '';
  const locationDisplay = listing.location ? `📍 ${listing.location.substring(0, 20)}` : '';
  
  card.innerHTML = `
    <div class="card-image-wrap" style="position:relative;aspect-ratio:1;background:var(--bg-3);overflow:hidden;">
      ${img}
      ${listing.is_fair ? '<span style="position:absolute;top:8px;left:8px;background:var(--neon);color:#001a07;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:5;">AI FAIR</span>' : ''}
      ${soldOverlay}
      ${wishlistBtn}
    </div>
    <div class="card-body" style="padding:12px;">
      <div class="card-title" style="font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;">${escHtml(listing.name)}</div>
      <div class="card-price" style="color:var(--neon);font-weight:bold;font-size:1.1rem;margin-bottom:4px;">$${parseFloat(listing.price).toFixed(2)}</div>
      <div class="card-meta" style="font-size:0.7rem;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
        <span>🏷️ ${listing.condition || 'N/A'}</span>
        <span>📦 ${listing.type || 'buy-now'}</span>
      </div>
      ${locationDisplay ? `<div class="card-location" style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">${locationDisplay}</div>` : ''}
      <div class="card-payment" style="font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;gap:4px;background:rgba(0,255,65,0.05);padding:4px 6px;border-radius:4px;margin-top:4px;">
        <span>💳 Accepts:</span>
        <span>${paymentDisplay}</span>
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
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">NO LISTINGS FOUND</div></div>`;
    return;
  }
  
  grid.innerHTML = '';
  listings.forEach(l => grid.appendChild(createListingCard(l)));
}

function showSkeletons() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill(0).map(() => `<div class="skeleton-card skeleton" style="height:280px;background:var(--bg-2);border-radius:var(--radius-lg);"></div>`).join('');
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

// ==================== CHAT SYSTEM ====================
async function startChat(partnerId, listingId = null) {
  if (!State.user) {
    openAuthModal();
    return;
  }
  if (partnerId === State.user.id) {
    showToast("You can't start a chat with yourself.", "info");
    return;
  }
  
  State.currentChatPartnerId = partnerId;
  State.currentListingId = listingId;
  navigate('messages');
}

async function loadMessages() {
  if (!State.user) return;
  
  const { data: allMessages, error } = await db
    .from('messages')
    .select(`
      *,
      sender:sender_id(id, username, avatar_url),
      receiver:receiver_id(id, username, avatar_url)
    `)
    .or(`sender_id.eq.${State.user.id},receiver_id.eq.${State.user.id}`)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetching conversations", error);
    return;
  }
  
  const conversations = new Map();
  if (allMessages) {
    allMessages.forEach(msg => {
      const partner = msg.sender.id === State.user.id ? msg.receiver : msg.sender;
      if (!conversations.has(partner.id)) {
        conversations.set(partner.id, {
          partnerProfile: partner,
          lastMessage: msg
        });
      }
    });
  }
  
  const sortedConversations = Array.from(conversations.values())
    .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));
  
  const convoListEl = document.getElementById('conversationList');
  if (!convoListEl) return;
  convoListEl.innerHTML = '';
  
  if (sortedConversations.length === 0) {
    convoListEl.innerHTML = '<div class="empty-state-small">No conversations yet.</div>';
  } else {
    sortedConversations.forEach(convo => {
      const partnerProfile = convo.partnerProfile;
      const isActive = State.currentChatPartnerId === partnerProfile.id;
      
      const li = document.createElement('div');
      li.className = `convo-item ${isActive ? 'active' : ''}`;
      li.setAttribute('data-id', partnerProfile.id);
      li.onclick = () => loadConversationThread(partnerProfile.id);
      
      const previewText = convo.lastMessage.image_url ? '📷 Sent an image' : convo.lastMessage.content;
      
      li.innerHTML = `
        <div class="convo-avatar">${partnerProfile.username?.charAt(0) || '?'}</div>
        <div class="convo-details">
          <div class="convo-username">${escHtml(partnerProfile.username)}</div>
          <div class="convo-preview">${escHtml(previewText?.substring(0, 35) || '...')}</div>
        </div>
      `;
      convoListEl.appendChild(li);
    });
  }
  
  if (State.currentChatPartnerId) {
    await loadConversationThread(State.currentChatPartnerId, State.currentListingId);
  } else {
    const activeHeader = document.getElementById('activeChatHeader');
    const chatThread = document.getElementById('chatThread');
    const chatForm = document.getElementById('chatForm');
    if (activeHeader) activeHeader.innerHTML = 'Select a conversation';
    if (chatThread) chatThread.innerHTML = '<div class="empty-state-small">Your messages will appear here.</div>';
    if (chatForm) chatForm.style.display = 'none';
  }
}

async function loadConversationThread(partnerId, listingId = null) {
  State.currentChatPartnerId = partnerId;
  
  document.querySelectorAll('.convo-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === partnerId);
  });
  
  const { data: partnerProfile, error: pError } = await db.from('profiles').select('*').eq('id', partnerId).single();
  if (pError || !partnerProfile) return;
  
  const activeHeader = document.getElementById('activeChatHeader');
  const chatForm = document.getElementById('chatForm');
  if (activeHeader) activeHeader.innerHTML = `Chatting with <strong>${escHtml(partnerProfile.username)}</strong>`;
  if (chatForm) chatForm.style.display = 'flex';
  
  if (listingId) {
    const { data: listing } = await db.from('listings').select('name, price').eq('id', listingId).single();
    if (listing) {
      const input = document.getElementById('chatMessageInput');
      if (input) {
        input.value = `Hi, I'm interested in your "${listing.name}" for $${listing.price}.`;
        input.focus();
      }
    }
    State.currentListingId = null;
  }
  
  const { data: messages, error: mError } = await db
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${State.user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${State.user.id})`)
    .order('created_at', { ascending: true });
  
  if (mError) return console.error("Error loading messages", mError);
  
  const threadEl = document.getElementById('chatThread');
  if (!threadEl) return;
  threadEl.innerHTML = '';
  if (messages) {
    messages.forEach(msg => renderMessage(msg, State.user.id));
  }
  threadEl.scrollTop = threadEl.scrollHeight;
}

async function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatMessageInput');
  const content = input?.value.trim();
  if (!content || !State.currentChatPartnerId) return;
  
  const { error } = await db.from('messages').insert([{
    sender_id: State.user.id,
    receiver_id: State.currentChatPartnerId,
    listing_id: State.currentListingId,
    content: content,
  }]);
  
  if (error) showToast("Error: " + error.message, 'error');
  else {
    if (input) input.value = '';
    await loadConversationThread(State.currentChatPartnerId);
    await loadMessages();
  }
}

async function handleSendImage(e) {
  const file = e.target.files[0];
  if (!file || !State.currentChatPartnerId) return;
  
  const filePath = `${State.user.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await db.storage.from('chat-images').upload(filePath, file);
  
  if (uploadError) {
    showToast("Upload failed", 'error');
    return;
  }
  
  const { data: { publicUrl } } = db.storage.from('chat-images').getPublicUrl(filePath);
  
  await db.from('messages').insert([{
    sender_id: State.user.id,
    receiver_id: State.currentChatPartnerId,
    listing_id: State.currentListingId,
    image_url: publicUrl,
  }]);
  
  await loadConversationThread(State.currentChatPartnerId);
  await loadMessages();
}

function renderMessage(msg, currentUserId) {
  const thread = document.getElementById('chatThread');
  if (!thread) return;
  const isSent = msg.sender_id === currentUserId;
  const div = document.createElement('div');
  div.className = `msg ${isSent ? 'sent' : 'received'}`;
  
  if (msg.image_url) {
    div.innerHTML = `<img src="${escHtml(msg.image_url)}" class="msg-image" style="max-width:200px;border-radius:8px;cursor:pointer;" onclick="window.open(this.src)">`;
  } else {
    div.innerHTML = escHtml(msg.content);
  }
  
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

function initChat() {
  if (!db) return;
  db.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const newMsg = payload.new;
      const relevantToMe = newMsg.sender_id === State.user?.id || newMsg.receiver_id === State.user?.id;
      
      if (State.currentPage === 'messages' && relevantToMe && State.user) {
        const fromPartner = newMsg.sender_id === State.currentChatPartnerId;
        const fromMe = newMsg.sender_id === State.user?.id;
        
        if (fromPartner || fromMe) {
          renderMessage(newMsg, State.user?.id);
        }
        loadMessages();
      }
    })
    .subscribe();
}

// ==================== AI ASSISTANT ====================
function askAssistant() {
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  const input = document.getElementById('assistantInput');
  const question = input?.value.trim();
  if (!question) return;
  
  const messagesDiv = document.getElementById('assistantMessages');
  if (!messagesDiv) return;
  
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'assistant-message user';
  userMsgDiv.textContent = question;
  messagesDiv.appendChild(userMsgDiv);
  
  if (input) input.value = '';
  
  setTimeout(() => {
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'assistant-message bot';
    botMsgDiv.textContent = generateAIResponse(question);
    messagesDiv.appendChild(botMsgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 500);
  
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function askSuggestion(suggestion) {
  const input = document.getElementById('assistantInput');
  if (input) input.value = suggestion;
  askAssistant();
}

function generateAIResponse(question) {
  const q = question.toLowerCase();
  
  if (q.includes('fair price') || q.includes('pricing')) {
    return "💰 Fair pricing tip: Compare completed sales on eBay or Marketplace. For collectibles, check recent auction results. OBTAINUM's AI Fair Price badge means the listing is ≤20% above MSRP when available.";
  } else if (q.includes('scam') || q.includes('avoid')) {
    return "🛡️ Safety tips: Always meet in public places, use secure payment methods, verify item condition in person, check seller ratings, and never send deposits before seeing the item.";
  } else if (q.includes('trending') || q.includes('popular')) {
    return "📈 Currently trending: Vintage trading cards (Pokémon, MTG), retro gaming consoles (GameCube, PS2), vinyl records, and limited-edition sneakers. Check our 'Popular' sort filter!";
  } else if (q.includes('vintage game')) {
    return "🎮 Price check for vintage games: Condition is key! Loose cartridges sell for 30-50% of CIB (Complete in Box). Use PriceCharting.com for reference values.";
  } else {
    return "🤖 I'm your OBTAINUM assistant! Ask me about fair pricing, avoiding scams, trending items, or price checks. What would you like to know?";
  }
}

// ==================== ERROR BANNER ====================
function showErrorBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.classList.add('show');
}

function hideErrorBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.classList.remove('show');
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const mobileNav = document.getElementById('mobile-nav');
      if (mobileNav) mobileNav.classList.toggle('open');
    });
  }
  
  let searchTimer;
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      State.searchQuery = e.target.value;
      searchTimer = setTimeout(() => {
        if (State.currentPage !== 'shop') navigate('shop');
        applyFilters();
      }, 320);
    });
  }
  
  const descTextarea = document.getElementById('c-desc');
  if (descTextarea) descTextarea.addEventListener('input', updateDescCounter);
  
  const categorySelect = document.getElementById('c-category');
  if (categorySelect) categorySelect.addEventListener('change', updateSubcategories);
  
  const priceSlider = document.getElementById('price-slider');
  if (priceSlider) priceSlider.addEventListener('input', (e) => onPriceSlider(e.target));
  
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  const fairOnly = document.getElementById('fair-only');
  const featuredOnly = document.getElementById('featured-only');
  const sortSelect = document.getElementById('sort-select');
  
  if (priceMin) priceMin.addEventListener('input', () => applyFilters());
  if (priceMax) priceMax.addEventListener('input', () => applyFilters());
  if (fairOnly) fairOnly.addEventListener('change', () => applyFilters());
  if (featuredOnly) featuredOnly.addEventListener('change', () => applyFilters());
  if (sortSelect) sortSelect.addEventListener('change', () => applyFilters());
  
  const imageInput = document.getElementById('image-input');
  const uploadZone = document.getElementById('upload-zone');
  if (imageInput) imageInput.addEventListener('change', handleImageUpload);
  if (uploadZone) {
    uploadZone.addEventListener('click', () => {
      const input = document.getElementById('image-input');
      if (input) input.click();
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      const mobileNav = document.getElementById('mobile-nav');
      if (mobileNav) mobileNav.classList.remove('open');
    }
  });
  
  window.addEventListener('online', () => {
    hideErrorBanner();
    showToast('Connection restored.', 'success');
    loadListings();
  });
  
  window.addEventListener('offline', () => {
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
  
  const chatForm = document.getElementById('chatForm');
  const chatImageInput = document.getElementById('chatImageInput');
  const askBtn = document.getElementById('askAssistantBtn');
  const assistantInput = document.getElementById('assistantInput');
  
  if (chatForm) chatForm.addEventListener('submit', handleSendMessage);
  if (chatImageInput) chatImageInput.addEventListener('change', handleSendImage);
  if (askBtn) askBtn.addEventListener('click', askAssistant);
  if (assistantInput) {
    assistantInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') askAssistant();
    });
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await initAuth();
  initChat();
  navigate('shop');
  
  // Populate filter chips
  const categoryChips = document.getElementById('category-chips');
  if (categoryChips) {
    const categories = ['all', 'Electronics', 'Clothing & Accessories', 'Collectibles', 'Toys & Figures', 'Sports & Outdoors', 'Books & Media', 'Home & Garden', 'Tools & Equipment', 'Other'];
    categoryChips.innerHTML = categories.map(cat => 
      `<button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="${cat}" onclick="selectCategory(this, '${cat}')">${cat === 'all' ? 'All' : cat}</button>`
    ).join('');
  }
  
  const conditionChips = document.getElementById('condition-chips');
  if (conditionChips) {
    const conditions = ['all', 'new', 'like-new', 'good', 'fair', 'poor'];
    conditionChips.innerHTML = conditions.map(cond => 
      `<button class="chip ${cond === 'all' ? 'active' : ''}" data-cond="${cond}" onclick="selectCondition(this, '${cond}')">${cond === 'all' ? 'Any' : cond}</button>`
    ).join('');
  }
  
  const typeChips = document.getElementById('type-chips');
  if (typeChips) {
    const types = ['all', 'buy-now', 'offers', 'auction'];
    typeChips.innerHTML = types.map(type => 
      `<button class="chip ${type === 'all' ? 'active' : ''}" data-type="${type}" onclick="selectType(this, '${type}')">${type === 'all' ? 'All' : type.replace('-', ' ').toUpperCase()}</button>`
    ).join('');
  }
  
  const categorySelect = document.getElementById('c-category');
  if (categorySelect) {
    const categories = ['Electronics', 'Clothing & Accessories', 'Collectibles', 'Toys & Figures', 'Sports & Outdoors', 'Books & Media', 'Home & Garden', 'Tools & Equipment', 'Other'];
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }
  
  if (!navigator.onLine) showErrorBanner();
  
  console.log('%c OBTAINUM INITIALIZED - Theme Toggle Working', 'background:#00ff41;color:#001a07;font-family:monospace;padding:4px 8px;');
});
