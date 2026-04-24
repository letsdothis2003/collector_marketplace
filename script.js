/* ============================================================
   FILE: script.js (FULL VERSION with AI Route Safety + Pickup Planner)
   OBTAINUM MARKETPLACE — Complete logic for all pages
   ============================================================ */

// ==================== DATABASE CONFIG ====================
const SUPABASE_URL = "https://gotzmuobwuubsugnowxq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs";

// 1. This placeholder is replaced by GitHub Actions during deployment.
// Do not change the placeholder string; it must match deploy.yml.
let GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_PLACEHOLDER";

// 2. Fallback for local development: Use config.js if the placeholder hasn't been replaced.
if (GEMINI_API_KEY.includes("PLACEHOLDER") && typeof CONFIG !== 'undefined') {
  if (CONFIG.GEMINI_API_KEY && !CONFIG.GEMINI_API_KEY.includes("HERE")) {
    GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;
  }
}

// Sanity check for deployment injection
if (GEMINI_API_KEY.includes("PLACEHOLDER")) {
  console.warn('[OBTAINUM AI] Warning: API Key placeholder detected. Did the GitHub Action run correctly?');
}

let db;

try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[OBTAINUM] Supabase connected');
} catch (e) {
  console.error('[OBTAINUM] Init failed:', e);
}

// Debugging utility to prevent accidental key leaks in logs
function scrub(text) {
  if (!text || typeof text !== 'string') return text;
  return text.split(GEMINI_API_KEY).join('[REDACTED_KEY]');
}

// ==================== DIRECT API HELPER (REPLACES LIBRARY) ====================
async function callGemini(prompt, responseType = 'text/plain') {
  if (GEMINI_API_KEY.includes("PLACEHOLDER")) {
    throw new Error("AI service is not configured. Please add your Gemini API Key.");
  }

  // Priority list including requested future-proof models
  const models = [
    "gemini-3.0-flash", 
    "gemini-2.5-flash", 
    "gemini-2.0-flash", 
    "gemini-1.5-flash"
  ];
  
  for (const model of models) {
    let retries = 2; // Retries per model specifically for rate limits
    let delay = 2000;

    while (retries >= 0) {
      console.log(`[OBTAINUM AI] Attempting ${model}...`);
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: responseType }
          })
        });

        // If rate limited, wait and retry THIS model
        if (response.status === 429) {
          console.warn(`[OBTAINUM AI] 429 Rate Limit on ${model}. Retrying...`);
          await new Promise(res => setTimeout(res, delay));
          retries--;
          delay *= 2;
          continue;
        }

        // If model doesn't exist (404) or other error, break to try the NEXT model in the list
        if (!response.ok) {
          console.warn(`[OBTAINUM AI] ${model} unavailable (Status: ${response.status}). Trying fallback...`);
          break; 
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        
        break; 
      } catch (err) {
        console.error(`[OBTAINUM AI] Connection error with ${model}:`, err);
        break;
      }
    }
  }
  throw new Error("AI service currently unavailable. Please check your API key.");
}

// ==================== CHARITY FINDER (RAG-STYLE AI) ====================
async function findLocalCharities() {
  const locationInput = document.getElementById('charity-location-input');
  const resultsDiv = document.getElementById('charity-results-container');
  const mapDiv = document.getElementById('charity-map');
  const btn = document.getElementById('charity-search-btn');
  
  // Check if API key is configured
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("PLACEHOLDER")) {
    resultsDiv.innerHTML = `<div class="auth-error show">⚠️ Charity finder is not available. AI service not configured.</div>`;
    return;
  }
  
  const location = locationInput?.value.trim();
  if (!location) {
    showToast("Please enter a location.", "info");
    return;
  }

  setLoading(btn, true, "SEARCHING...");
  resultsDiv.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div><p style="text-align:center;">Identifying top-rated charities near you...</p>';
  mapDiv.style.display = 'none';

  const prompt = `You are a helpful community assistant. Find the top 8 registered, highly-rated charities, non-profits, or donation centers in or near "${location}". 
  Include a mix of organizations (e.g., food banks, clothing donations, animal shelters).
  
  Return the results as a JSON array of objects with this structure (include exact coordinates for the map):
  [
    {
      "name": "Charity Name",
      "description": "Short 1-sentence mission",
      "address": "Full street address, City, State",
      "focus": "Category",
      "url": "Website URL",
      "lat": latitude_float,
      "lng": longitude_float
    }
  ]
  Return ONLY the JSON array. No extra text.`;

  try {
    const response = await callGemini(prompt, 'application/json');
    const cleanText = response.replace(/```json|```/g, '').trim();
    const charities = JSON.parse(cleanText);

    if (!charities || charities.length === 0) throw new Error("No charities found.");

    resultsDiv.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 20px;">
        ${charities.map((c, i) => `
          <div class="charity-card animate-pop" style="background: var(--bg-2); padding: 16px; border-radius: var(--radius); border-left: 4px solid var(--neon);">
            <div style="font-size: 0.65rem; color: var(--neon); font-weight: bold; margin-bottom: 4px;">#${i+1} ${c.focus.toUpperCase()}</div>
            <h4 style="margin: 0 0 8px 0; color: var(--text);">${escHtml(c.name)}</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">${escHtml(c.description)}</p>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">📍 ${escHtml(c.address)}</div>
            ${c.url ? `<a href="${c.url}" target="_blank" class="btn btn-ghost btn-sm" style="font-size: 0.7rem; padding: 4px 8px;">VISIT WEBSITE</a>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    // Geocode and show map
    mapDiv.style.display = 'block';
    initCharityMap(charities, location);

  } catch (err) {
    console.error("Charity Finder Error:", err);
    resultsDiv.innerHTML = `<div class="auth-error show">⚠️ Could not retrieve charity data. Try again or configure Gemini API.</div>`;
  } finally {
    setLoading(btn, false, "FIND CHARITIES");
  }
}

async function initCharityMap(charities, centerLocation) {
  if (typeof L === 'undefined') return;
  
  try {
    // Get center coordinates for the user's provided area
    const center = await geocodeLocation(centerLocation);
    const map = L.map('charity-map').setView([center.lat, center.lon], 12);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(map);

    const bounds = [];
    for (const c of charities) {
      if (c.lat && c.lng) {
        const marker = L.marker([c.lat, c.lng]).addTo(map);
        marker.bindPopup(`<strong>${escHtml(c.name)}</strong><br>${escHtml(c.address)}`);
        bounds.push([c.lat, c.lng]);
      }
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
    
    // Trigger a resize to fix Leaflet gray tiles
    setTimeout(() => map.invalidateSize(), 200);

  } catch (err) {
    console.error("Map initialization failed", err);
  }
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
  currentListingId: null,
  aiSessionId: null,
  aiMessages: [],
  currentReviewSellerId: null,
  reviewId: null,
  existingReviewImages: [],
  originalReviewImages: [],
  reviewImageFiles: [],
  selectedReviewListingId: null,
  allSellerItems: [],
  viewingProfileId: null,
  isSubmittingListing: false
};

// ==================== HELPER FUNCTIONS ====================
function escHtml(str) {
  if (!str) return ''; 
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

function generateStarRatingHtml(rating) {
  const fullStars = Math.round(rating || 0);
  let html = '<span style="color:var(--neon); letter-spacing:2px; font-size:1.1rem;">';
  for(let i=0; i<5; i++) {
    if(i < fullStars) html += '★';
    else html += '☆';
  }
  html += '</span>';
  return html;
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

function toggleProcessingOverlay(show, text = 'PROCESSING...') {
  const overlay = document.getElementById('processing-overlay');
  const textEl = document.getElementById('processing-text');
  if (!overlay) return;
  if (textEl) textEl.textContent = text.toUpperCase();
  overlay.classList.toggle('show', show);
}

function setLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="spinner"></span> ${text}` : text;
}

// ==================== THEME TOGGLE ====================
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
  showToast(isLight ? 'Dark mode activated' : 'Light mode activated', 'info');
}

// ==================== IMAGE CAROUSEL ====================
function createImageCarousel(images, listingId) {
  if (!images || images.length === 0) return `<div class="card-no-image">📦</div>`;
  if (images.length === 1) return `<img src="${escHtml(images[0])}" alt="Listing image" style="width:100%;height:100%;object-fit:cover;" />`;
  const carouselId = `carousel-${listingId}`;
  return `
    <div class="image-carousel" id="${carouselId}">
      <div class="carousel-container">
        <div class="carousel-slides" id="${carouselId}-slides">
          ${images.map((img, idx) => `<div class="carousel-slide" data-index="${idx}"><img src="${escHtml(img)}" alt="Image ${idx + 1}" loading="lazy" decoding="async" /></div>`).join('')}
        </div>
        <button class="carousel-btn prev" onclick="event.stopPropagation(); changeSlide('${carouselId}', -1)">‹</button>
        <button class="carousel-btn next" onclick="event.stopPropagation(); changeSlide('${carouselId}', 1)">›</button>
        <div class="carousel-dots" id="${carouselId}-dots">${images.map((_, idx) => `<span class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="event.stopPropagation(); goToSlide('${carouselId}', ${idx})"></span>`).join('')}</div>
        <div class="image-count-badge">${images.length} images</div>
      </div>
    </div>
  `;
}

window.changeSlide = function(carouselId, direction) {
  const slides = document.getElementById(`${carouselId}-slides`);
  const dots = document.getElementById(`${carouselId}-dots`);
  if (!slides) return;
  const currentIndex = parseInt(slides.dataset.currentIndex || '0');
  const totalSlides = slides.children.length;
  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = totalSlides - 1;
  if (newIndex >= totalSlides) newIndex = 0;
  slides.style.transform = `translateX(-${newIndex * 100}%)`;
  slides.dataset.currentIndex = newIndex;
  if (dots) {
    const dotElements = dots.querySelectorAll('.carousel-dot');
    dotElements.forEach((dot, idx) => dot.classList.toggle('active', idx === newIndex));
  }
};

window.goToSlide = function(carouselId, index) {
  const slides = document.getElementById(`${carouselId}-slides`);
  const dots = document.getElementById(`${carouselId}-dots`);
  if (!slides) return;
  slides.style.transform = `translateX(-${index * 100}%)`;
  slides.dataset.currentIndex = index;
  if (dots) {
    const dotElements = dots.querySelectorAll('.carousel-dot');
    dotElements.forEach((dot, idx) => dot.classList.toggle('active', idx === index));
  }
};

function updateNavActive(page) {
  const activePage = page === 'detail' ? 'shop' : page;
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.id === `nav-${activePage}`);
  });
}

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[&/\\#,+()$~%.'"*?:@<>!^\[\]{}]+/g, '')
    .replace(/-+/g, '-');
}

function getRouteHash(page, meta = {}) {
  if (page === 'detail' && meta.listingId && meta.listingName) {
    const slug = slugify(meta.listingName);
    return `#shop-${slug}--${meta.listingId}`; // Double-dash separator for UUIDs
  }
  if (page === 'profile' && meta.profileId) {
    return `#profile/${meta.profileId}`;
  }
  if (page === 'review' && meta.sellerId) {
    return `#review/${meta.sellerId}`;
  }
  return `#${page}`;
}

function updateUrlForPage(page, meta = {}) {
  const hash = getRouteHash(page, meta);
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
  }
  updateDocumentTitle(page, meta.listingName);
}

function updateDocumentTitle(page, listingName) {
  let title = 'OBTAINUM';
  switch (page) {
    case 'about': title = 'About — OBTAINUM'; break;
    case 'contact': title = 'Contact — OBTAINUM'; break;
    case 'donate': title = 'Donate — OBTAINUM'; break;
    case 'create': title = 'Create Listing — OBTAINUM'; break;
    case 'profile': title = 'Profile — OBTAINUM'; break;
    case 'wishlist': title = 'Wishlist — OBTAINUM'; break;
    case 'messages': title = 'Messages — OBTAINUM'; break;
    case 'assistant': title = 'Assistant — OBTAINUM'; break;
    case 'detail': title = listingName ? `Shop — ${listingName} — OBTAINUM` : 'Shop — OBTAINUM'; break;
    default: title = 'Shop — OBTAINUM';
  }
  document.title = title;
}

function parseRouteFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { page: 'shop' };
  const knownPages = ['shop', 'create', 'profile', 'wishlist', 'messages', 'assistant', 'about', 'contact', 'donate', 'review'];
  if (knownPages.includes(hash)) return { page: hash };
  if (hash.startsWith('shop-')) {
    const parts = hash.split('--');
    const id = parts[parts.length - 1];
    if (id && id.length >= 32) { // Validate UUID format
      return { page: 'detail', listingId: id };
    }
  }
  if (hash.startsWith('profile/')) {
    const id = hash.split('/')[1];
    return { page: 'profile', profileId: id };
  }
  if (hash.startsWith('review/')) {
    const id = hash.split('/')[1];
    return { page: 'review', sellerId: id };
  }
  return { page: 'shop' };
}

let ignoreHashChange = false;
function handleHashChange() {
  if (ignoreHashChange) return;
  const route = parseRouteFromHash();
  if (route.page === 'detail' && route.listingId) {
    openListing(route.listingId);
    return;
  }
  if (route.page === 'profile' && route.profileId) {
    window.selectedProfileId = route.profileId;
    navigate('profile', { updateUrl: false });
    return;
  }
  if (route.page === 'review' && route.sellerId) {
    navigate('review', { meta: { sellerId: route.sellerId }, updateUrl: false });
    return;
  }
  navigate(route.page, { updateUrl: false });
}

// ==================== NAVIGATION ====================
function navigate(page, options = {}) {
  const pages = ['shop', 'detail', 'create', 'profile', 'wishlist', 'messages', 'assistant', 'about', 'contact', 'donate', 'review'];
  if (!pages.includes(page)) page = 'shop';

  // Guard restricted pages for unsigned users
  const restricted = ['create', 'wishlist', 'messages', 'assistant', 'review'];
  if (restricted.includes(page) && !State.user) {
    openAuthModal();
    return;
  }

  pages.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.remove('active');
  });
  
  document.getElementById(`page-${page}`)?.classList.add('active');
  State.currentPage = page;
  updateNavActive(page);
  
  updateRestrictedPageUI();
  
  if (page === 'shop') loadListings();
  if (page === 'profile') loadProfile();
  if (page === 'wishlist' && State.user) loadWishlist();
  if (page === 'create' && State.user) initCreatePage();
  if (page === 'review') loadReviewPage(options.meta?.sellerId);
  if (page === 'messages' && State.user) loadMessages();
  if (page === 'assistant') {
    updateAssistantUI();
    loadAIChatHistory();
  }

  if (options.updateUrl !== false) {
    ignoreHashChange = true;
    updateUrlForPage(page, options.meta);
    setTimeout(() => { ignoreHashChange = false; }, 0);
  }

  // Fix: Hide global AI route finder button unless on detail page
  const globalRouteBtn = document.getElementById('btn-global-route-safety');
  if (globalRouteBtn) globalRouteBtn.style.display = (State.currentPage === 'detail') ? 'inline-flex' : 'none';
}

function navigateProfile() {
  if (!State.user) {
    openAuthModal();
    return;
  }
  navigate('profile');
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
  
  if (!profile) {
    console.log("Profile not found, creating fallback...");
    
    let username = user.user_metadata?.username || 
                   user.user_metadata?.full_name || 
                   user.email?.split('@')[0] || 
                   'user_' + Math.random().toString(36).substring(2, 8);
    
    username = username.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 28);
    if (username.length < 3) username = username + '_usr';
    
    const newProfileData = {
      id: user.id,
      email: user.email,
      username: username,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: created, error: createErr } = await db
      .from('profiles')
      .insert(newProfileData)
      .select()
      .single();
    
    if (!createErr) {
      profile = created;
      showToast(`Welcome, ${username}!`, 'success');
    }
  }
  
  State.profile = profile;
  updateAuthUI();
  await loadWishlistIds();
  await initAISession();
}

function onSignOut() {
  State.user = null;
  State.profile = null;
  State.wishlistIds.clear();
  State.currentChatPartnerId = null;
  State.currentListingId = null;
  State.aiSessionId = null;
  State.aiMessages = [];
  updateAuthUI();
  if (State.currentPage === 'profile') navigate('shop');
  if (State.currentPage === 'messages') navigate('shop');
  if (State.currentPage === 'wishlist') navigate('shop');
  if (State.currentPage === 'create') navigate('shop');
  if (State.currentPage === 'assistant') updateAssistantUI();
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
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error('Google sign-in error:', err);
    showToast('Google sign-in failed: ' + err.message, 'error');
  }
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
  
  const cleanUsername = username.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 28);
  if (cleanUsername.length < 3) {
    if (errEl) {
      errEl.textContent = 'Username must be at least 3 characters (letters, numbers, underscores only)';
      errEl.classList.add('show');
    }
    if (btn) setLoading(btn, false, 'CREATE ACCOUNT');
    return;
  }
  
  try {
    const { data, error } = await db.auth.signUp({
      email,
      password: pass,
      options: { 
        data: { username: cleanUsername }
      }
    });
    
    if (error) throw error;
    
    if (data.session) {
      closeModal('auth-modal');
      showToast('Account created! Welcome to OBTAINUM.', 'success');
    } else {
      // Fix: Handle case where 'register-form-wrap' ID is missing from HTML
      const wrap = document.getElementById('register-form-wrap') || document.getElementById('auth-register');
      if (wrap) {
        wrap.innerHTML = `
          <div class="auth-confirm-panel" style="text-align:center;padding:20px;">
            <div class="confirm-icon" style="font-size:3rem;">✉️</div>
            <div class="confirm-title" style="font-weight:bold;margin:16px 0;">CHECK YOUR EMAIL</div>
            <div class="confirm-msg">Click the confirmation link to activate your account.</div>
            <button class="btn btn-outline w-full" onclick="closeModal('auth-modal')">GOT IT</button>
          </div>
        `;
      } else {
        showToast('Registration successful! Check your email to confirm.', 'success');
        closeModal('auth-modal');
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Registration failed.';
      errEl.classList.add('show');
    }
  } finally {
    if (btn) setLoading(btn, false, 'CREATE ACCOUNT');
  }
}

// ==================== UI STYLING INJECTION ====================
function injectCustomStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Global Processing Overlay */
    #processing-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(10px);
      z-index: 10000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--neon);
      font-family: 'Orbitron', sans-serif;
      text-align: center;
    }
    #processing-overlay.show { display: flex; }

    /* Navbar Scrollbar Red & Wide in Dark Mode */
    body:not(.light-mode) .nav-menu::-webkit-scrollbar {
      height: 12px;
    }
    body:not(.light-mode) .nav-menu::-webkit-scrollbar-thumb {
      background: #ff0000;
      border-radius: 10px;
      border: 2px solid var(--bg);
      box-shadow: 0 0 15px #ff0000, inset 0 0 5px rgba(255, 255, 255, 0.5);
    }
    /* Hardware Acceleration for smoother page transitions */
    .page { backface-visibility: hidden; transform: translateZ(0); }
  `;
  document.head.appendChild(style);

  // Create overlay element if it doesn't exist
  if (!document.getElementById('processing-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'processing-overlay';
    overlay.innerHTML = '<div class="spinner spinner-lg"></div><div id="processing-text" style="margin-top:20px; letter-spacing:2px; font-weight:bold;">PROCESSING...</div>';
    document.body.appendChild(overlay);
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

// ==================== AI CHAT FUNCTIONS ====================

async function initAISession() {
  if (!State.user) return;
  if (!State.aiSessionId) {
    State.aiSessionId = crypto.randomUUID();
  }
}

async function loadAIChatHistory() {
  if (!State.user) return;
  
  try {
    const { data, error } = await db
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', State.user.id)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMessages = (data || []).filter(msg => new Date(msg.created_at) >= cutoff);
    State.aiMessages = recentMessages;
    
    const messagesDiv = document.getElementById('assistantMessages');
    if (messagesDiv) {
      if (recentMessages.length === 0) {
        messagesDiv.innerHTML = '<div class="assistant-message bot">✨ Hi! I\'m your OBTAINUM AI assistant. Ask me anything about the marketplace!</div>';
      } else {
        messagesDiv.innerHTML = '';
        recentMessages.forEach(msg => {
          const msgDiv = document.createElement('div');
          msgDiv.className = `assistant-message ${msg.sender_type === 'user' ? 'user' : 'bot'}`;
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          msgDiv.innerHTML = msg.content.replace(/\n/g, '<br>') + 
            `<div style="font-size:0.65rem; opacity:0.6; margin-top:4px;">${time}</div>`;
          messagesDiv.appendChild(msgDiv);
        });
      }
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  } catch (err) {
    console.error('Error loading AI chat history:', err);
  }
}

async function saveAIMessage(senderType, content) {
  if (!State.user) return;
  
  try {
    const { error } = await db
      .from('ai_chat_messages')
      .insert({
        sender_type: senderType,
        user_id: State.user.id,
        session_id: State.aiSessionId,
        content: content
      });
    
    if (error) throw error;
    
    State.aiMessages.push({
      sender_type: senderType,
      content: content,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving AI message:', err);
  }
}

async function askAssistant() {
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
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  userMsgDiv.innerHTML = escHtml(question) + `<div style="font-size:0.65rem; opacity:0.6; margin-top:4px;">${timeStr}</div>`;
  messagesDiv.appendChild(userMsgDiv);
  
  await saveAIMessage('user', question);
  
  if (input) input.value = '';
  
  const typingDiv = document.createElement('div');
  typingDiv.className = 'assistant-message bot';
  typingDiv.innerHTML = '<span class="spinner" style="width:16px;height:16px;"></span> Thinking...';
  messagesDiv.appendChild(typingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  try {
    const aiResponse = await getGeminiResponse(question);
    typingDiv.remove();
    
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'assistant-message bot';
    const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    botMsgDiv.innerHTML = formatMarkdown(aiResponse) + 
      `<div style="font-size:0.65rem; opacity:0.6; margin-top:4px;">${botTime}</div>`;
    messagesDiv.appendChild(botMsgDiv);
    
    await saveAIMessage('ai', aiResponse);
    
  } catch (err) {
    console.error('[OBTAINUM Assistant] Error:', err);
    typingDiv.remove();
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'assistant-message bot';
    errorMsg.textContent = '⚠️ ' + err.message;
    messagesDiv.appendChild(errorMsg);
  }
  
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function getGeminiResponse(userMessage) {
  // Simple direct pass-through to Gemini - assume user talks about products
  const systemPrompt = `You are OBTAINUM AI assistant, helping users with marketplace questions about products, pricing, and buying/selling. Be concise and helpful.`;
  
  // Build simple conversation context
  const messages = [];
  messages.push({ role: 'user', content: systemPrompt });
  
  // Add last few messages for context
  State.aiMessages.slice(-4).forEach(m => {
    messages.push({ 
      role: m.sender_type === 'user' ? 'user' : 'assistant', 
      content: m.content 
    });
  });
  
  messages.push({ role: 'user', content: userMessage });
  
  // Simplified prompt - just the user message with minimal context
  const finalPrompt = `${systemPrompt}\n\nUser: ${userMessage}`;
  
  return await callGemini(finalPrompt);
}

function askSuggestion(suggestion) {
  const input = document.getElementById('assistantInput');
  if (input) input.value = suggestion;
  askAssistant();
}

// ==================== LISTING SUGGESTIONS (AI Price Analysis) ====================

async function generateAndSaveListingSuggestion(listingId, forceRefresh = false) {
  if (!db) return null;
  
  const { data: listing, error } = await db
    .from('listings')
    .select('*, profiles:seller_id(username, rating, location)')
    .eq('id', listingId)
    .single();
  
  if (error || !listing) {
    console.error('Could not fetch listing:', error);
    return null;
  }

  const existing = listing.ai_suggestions;

  // If we already have a suggestion saved and aren't forcing a refresh, use it.
  // This prevents unnecessary API calls and keeps the DB as the source of truth.
  if (existing && !forceRefresh) {
    const isComplete = typeof existing === 'object' && 
                       existing.itemIdentification && 
                       !JSON.stringify(existing).includes("Unknown");
    if (isComplete) return existing;
  }
  
  let suggestion = null;
  
  try {
    suggestion = await analyzeListingWithGemini(listing);
  } catch (err) {
    console.error('Gemini analysis failed:', err);
    suggestion = getFallbackListingAnalysis(listing);
  }
  
  if (suggestion) {
    const { error: updateError } = await db
      .from('listings')
      .update({ ai_suggestions: suggestion })
      .eq('id', listingId);
    
    // Sync state if update was successful (don't wait for .select() to avoid RLS return issues)
    if (!updateError && State.selectedListing && State.selectedListing.id === listingId) {
      State.selectedListing.ai_suggestions = suggestion; // Sync UI State
      console.log('[OBTAINUM] AI Suggestion saved and synced to UI');
    }

    if (updateError) {
      console.error('Failed to save AI suggestion:', updateError);
    }
  }
  
  return suggestion;
}

async function analyzeListingWithGemini(listing) {
  const prompt = `You are OBTAINUM's expert collector and market analyst AI. 
  Task: Perform a deep valuation of the item listed below. 
  KNOWLEDGE LOOKUP: Use your internal training data to identify the specific product line (e.g., Transformers Studio Series, LEGO Star Wars), release year, and manufacturer.
  VALUATION: Identify the original retail MSRP and the current secondary market value for a "${listing.condition}" condition specimen. 
  INFLATED VALUE: You MUST calculate an inflated value. Take the MSRP, add 4% annual inflation, and a 20-50% scarcity premium for sought-after collectibles.
  
  CRITICAL: DO NOT use the words "Unknown", "N/A", or null. If you don't have the exact dollar amount, provide your best high-confidence estimate based on the product class (e.g., Voyager class Transformers usually MSRP for $29.99).
  For the "reasoning", provide a 3-sentence summary explaining the product's history and why it is a ${listing.price > (listing.msrp || 0) ? 'collector item' : 'good deal'}.

LISTING DETAILS:
- Product Name: ${listing.name}
- Category: ${listing.category}
- Condition: ${listing.condition}
- Seller's Listed Price: $${listing.price}
- MSRP (if available): ${listing.msrp ? '$' + listing.msrp : 'Not provided'}
- Images for Context: ${listing.images?.join(', ') || 'No images provided'}

Return ONLY valid JSON with this exact structure:
{
  "itemIdentification": "What specific product this appears to be",
  "releaseYear": "Year or era when this item first came out",
  "originalRetailPrice": "Original MSRP (e.g. $12.99)",
  "currentMarketValue": "Current inflated market range including collector premiums (e.g. $35 - $95)",
  "valueAssessment": "good deal / fair price / overpriced",
  "score": 0-100,
  "reasoning": "A coherent 3-4 sentence analytical summary. Identify the specific model, its release era, rarity factor, and justify the valuation based on inflation-adjusted historical data and current collector demand.",
  "recommendation": "buy / negotiate / avoid"
}`;
  
  try {
    const result = await callGemini(prompt, 'application/json');
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getFallbackListingAnalysis(listing);
  } catch (err) {
    return getFallbackListingAnalysis(listing);
  }
}

function getFallbackListingAnalysis(listing) {
  // Attempt to guess the release year from the title; NEVER return "Unknown"
  let releaseYear = "2021"; 
  const name = (listing.name || "").toLowerCase();
  
  // Regex for 4-digit years (1970-2029)
  const yearMatch = name.match(/\b(19[7-9]\d|20[0-2]\d)\b/);
  if (yearMatch) {
    releaseYear = yearMatch[0];
  } else {
    if (name.includes("dark of the moon")) releaseYear = "2011";
    else if (name.includes("g1") || name.includes("generation 1")) releaseYear = "1984";
    else if (name.includes("beast wars")) releaseYear = "1996";
    else if (name.includes("vintage")) releaseYear = "1980s/90s";
    else if (name.includes("studio series")) releaseYear = "2018";
    else if (listing.category === "Electronics") releaseYear = "2021";
    else if (listing.category === "Collectibles") releaseYear = "2015";
  }

  // Guess MSRP based on common keywords; NEVER return "Unknown"
  let guessedMsrp = listing.msrp;
  if (!guessedMsrp) {
    if (name.includes("deluxe")) guessedMsrp = 19.99;
    else if (name.includes("voyager")) guessedMsrp = 29.99;
    else if (name.includes("leader")) guessedMsrp = 49.99;
    else if (name.includes("studio series")) guessedMsrp = 29.99;
    else if (listing.category === "Electronics") guessedMsrp = listing.price * 1.5;
    else guessedMsrp = listing.price || 25.00; 
  }

  const finalMsrpDisplay = `$${Number(guessedMsrp).toFixed(2)}`;
  let score = 50;
  let valueAssessment = "fair price";
  let recommendation = "consider";
  
  // Calculate Inflation and Collector Range for fallback
  let minVal = Math.round((guessedMsrp || 20) * 1.1);
  let maxVal = Math.round(minVal * 2.5);

  const effectiveMsrp = guessedMsrp || listing.msrp;
  if (effectiveMsrp && releaseYear !== "Unknown") {
    const match = releaseYear.match(/\d{4}/);
    const year = match ? parseInt(match[0]) : 2018;
    const yearsPassed = Math.max(1, new Date().getFullYear() - year);
    
    // Base inflation (3%) + Scarcity Multiplier (3.5x for peak collector value)
    const inflationAdjusted = effectiveMsrp * Math.pow(1.03, yearsPassed);
    minVal = Math.round(inflationAdjusted);
    maxVal = Math.round(inflationAdjusted * 3.5); 
  }

  if (effectiveMsrp && effectiveMsrp > 0) {
    const percentOfMsrp = (listing.price / effectiveMsrp) * 100;
    if (percentOfMsrp <= 60) {
      score = 90;
      valueAssessment = "excellent deal";
      recommendation = "buy";
    } else if (percentOfMsrp <= 85) {
      score = 75;
      valueAssessment = "good deal";
      recommendation = "buy";
    } else if (percentOfMsrp <= 100) {
      score = 60;
      valueAssessment = "fair price";
      recommendation = "consider";
    } else if (percentOfMsrp <= 125) {
      score = 40;
      valueAssessment = "overpriced";
      recommendation = "negotiate";
    } else {
      score = 25;
      valueAssessment = "significantly overpriced";
      recommendation = "avoid";
    }
  }
  
  // Condition weighting: 'Good' condition is common for collectors and shouldn't be heavily penalized
  const condWeights = { 'new': 1.0, 'like-new': 0.98, 'good': 0.9, 'fair': 0.7, 'poor': 0.4 };
  score = Math.round(score * (condWeights[listing.condition] || 0.85));
  
  const fallbackReasoning = `This ${listing.name} from approximately ${releaseYear} is evaluated as a ${valueAssessment}. Given its ${listing.condition} condition and the historical MSRP of ${finalMsrpDisplay}, the current market value reflects standard inflation and typical collector demand within the ${listing.category} sector.`;

  return {
    itemIdentification: listing.name,
    releaseYear: releaseYear,
    originalRetailPrice: finalMsrpDisplay,
    currentMarketValue: `$${minVal} - $${maxVal}`,
    valueAssessment: valueAssessment,
    score: Math.min(100, Math.max(0, score)),
    reasoning: fallbackReasoning,
    recommendation: recommendation
  };
}

async function displayListingSuggestion(listingId, forceRefresh = false) {
  const container = document.getElementById(`ai-suggestions-${listingId}`);
  if (forceRefresh && container) {
    container.innerHTML = '<div style="text-align:center; padding:20px; background:var(--bg-2); border-radius:var(--radius-lg); height:100%; display:flex; flex-direction:column; justify-content:center;"><div class="spinner" style="margin:0 auto 10px;"></div> Updating Analysis...</div>';
  }

  const suggestion = await generateAndSaveListingSuggestion(listingId, forceRefresh);
  
  if (!container || !suggestion) return;
  
  const scoreColor = suggestion.score >= 70 ? 'var(--neon)' : (suggestion.score >= 40 ? 'var(--warning)' : 'var(--danger)');
  
  container.innerHTML = `
    <div class="ai-suggestion-card" style="background:var(--bg-2); border-radius:var(--radius-lg); padding:16px; margin-top:16px; border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="ai-dot"></span>
          <strong style="color:var(--neon);">🤖 AI PRICE ANALYSIS</strong>
        </div>
        <div style="background:${scoreColor}; color:#001a07; padding:4px 12px; border-radius:20px; font-weight:bold;">
          ${suggestion.valueAssessment.toUpperCase()} • ${suggestion.score}%
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:12px; margin-bottom:16px;">
        <div style="background:var(--bg-3); padding:10px; border-radius:8px;">
          <div style="font-size:11px; color:var(--text-muted);">🔍 IDENTIFIED AS</div>
          <div style="font-weight:600;">${escHtml(suggestion.itemIdentification)}</div>
        </div>
        <div style="background:var(--bg-3); padding:10px; border-radius:8px;">
          <div style="font-size:11px; color:var(--text-muted);">📅 CAME OUT IN</div>
          <div style="font-weight:600;">${suggestion.releaseYear || 'N/A'}</div>
        </div>
        <div style="background:var(--bg-3); padding:10px; border-radius:8px;">
          <div style="font-size:11px; color:var(--text-muted);">💰 ORIGINAL PRICE</div>
          <div style="font-weight:600;">${suggestion.originalRetailPrice || 'N/A'}</div>
        </div>
        <div style="background:var(--bg-3); padding:10px; border-radius:8px;">
          <div style="font-size:11px; color:var(--text-muted);">📈 CURRENT VALUE</div>
          <div style="font-weight:600;">${suggestion.currentMarketValue || 'N/A'}</div>
        </div>
      </div>
      
      <div style="background:rgba(0,255,65,0.05); padding:12px; border-radius:8px; margin-bottom:12px;">
        <div style="font-weight:600; margin-bottom:6px;">📝 ANALYSIS</div>
        <div style="font-size:14px;">${escHtml(suggestion.reasoning)}</div>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:12px; border-top:1px solid var(--border);">
        <div style="font-size:13px;">🏷️ ${suggestion.recommendation === 'buy' ? '✅ RECOMMENDED' : (suggestion.recommendation === 'negotiate' ? '🤝 TRY NEGOTIATING' : '⚠️ CONSIDER ALTERNATIVES')}</div>
        <button class="btn btn-ghost btn-sm" onclick="displayListingSuggestion('${listingId}', true)" style="font-size:10px; padding:4px 8px;">🔄 REFRESH AI</button>
      </div>
    </div>
  `;
}

// ==================== LISTINGS MODULE ====================
async function loadListings(forceRefresh = false) {
  if (!db) { renderListings([]); return; }
  try {
    if (State.listings.length > 0 && !forceRefresh) {
      applyFilters();
      return;
    }

    showSkeletons();
    
    const { data, error } = await db
      .from('listings')
      // OPTIMIZATION: Only select columns needed for the grid view to reduce payload size
      .select('id, name, price, images, category, condition, type, location, is_fair, is_sold, seller_id, created_at, ai_suggestions, profiles:seller_id(id, username, avatar_url, rating, location)')
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
    const currentIndex = State.imageFiles.length;
    State.imageFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, currentIndex);
    reader.readAsDataURL(file);
  });
  
  if (files.length > remaining) {
    showToast(`Max ${maxImages} images total. ${remaining} slot(s) remaining.`, 'info');
  }
  event.target.value = '';
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
  
  if (State.isSubmittingListing) return;
  State.isSubmittingListing = true;
  
  const isEditing = !!State.editingListingId;
  const errEl = document.getElementById('create-error');
  const btn = document.getElementById('create-submit');
  if (errEl) errEl.classList.remove('show');
  if (btn) setLoading(btn, true, isEditing ? 'SAVING...' : 'PUBLISHING...');
  toggleProcessingOverlay(true, isEditing ? 'Updating listing...' : 'Uploading listing...');
  
  try {
    const price = parseFloat(document.getElementById('c-price')?.value || '0');
    const name = document.getElementById('c-name')?.value.trim() || '';
    const category = document.getElementById('c-category')?.value || '';
    const description = document.getElementById('c-desc')?.value.trim() || '';

    if (!name || !category || !description || isNaN(price)) {
      throw new Error('Please fill out all required fields.');
    }
    if (description.length < 10) {
      throw new Error('Description must be at least 10 characters.');
    }

    let newImageUrls = [];
    if (State.imageFiles.length > 0) {
      newImageUrls = await uploadImages(State.user.id);
    }
    
    const allImages = [...State.keepExistingImages, ...newImageUrls];
    
    const paymentMethods = Array.from(
      document.querySelectorAll('input[name="payment"]:checked')
    ).map(cb => cb.value);
    
    if (paymentMethods.length === 0) paymentMethods.push('cash');
    
    const msrpVal = document.getElementById('c-msrp')?.value;
    const msrp = msrpVal ? parseFloat(msrpVal) : null;
    const tagsRaw = document.getElementById('c-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
    const subcategoryEl = document.getElementById('c-subcategory');
    const subcategory = subcategoryEl && subcategoryEl.value ? subcategoryEl.value : null;
    
    const isFair = msrp ? price <= msrp * 1.2 : true;
    
    const listingData = {
      seller_id: State.user.id,
      name: name,
      category: category,
      subcategory: subcategory,
      description: description,
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
    }
    
    // Reset listing state completely
    const createForm = document.getElementById('create-form');
    if (createForm) createForm.reset();
    State.imageFiles = [];
    State.keepExistingImages = [];
    document.getElementById('image-preview-grid').innerHTML = '';
    State.editingListingId = null;

    showToast(isEditing ? 'Listing updated!' : 'Listing published!', 'success');
    // Force refresh to clear local unshifted state and get fresh DB data
    if (isEditing) navigate('profile');
    else loadListings(true).then(() => navigate('shop'));

  } catch (err) {
    console.error('Error submitting listing:', err);
    if (errEl) {
      errEl.textContent = err.message || 'An unknown error occurred.';
      errEl.classList.add('show');
    }
  } finally {
    if (btn) setLoading(btn, false, isEditing ? 'SAVE CHANGES' : 'PUBLISH LISTING');
    State.isSubmittingListing = false;
    toggleProcessingOverlay(false);
  }
}

// ==================== PROFILE MODULE ====================
async function loadProfile() {
  if (!State.user && !window.selectedProfileId) {
    navigate('shop');
    return;
  }

  const profileIdToLoad = window.selectedProfileId || State.user?.id;
  if (!profileIdToLoad) {
    navigate('shop');
    return;
  }

  State.viewingProfileId = profileIdToLoad;
  const isOwnProfile = State.user && profileIdToLoad === State.user.id;

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
  renderProfileUI(profile);
}

// New: Extracted UI logic to allow calling from cache or fresh fetch
async function renderProfileUI(profile) {
  const profileIdToLoad = profile.id;
  const isOwnProfile = State.user && profileIdToLoad === State.user.id;

  const avatarEl = document.getElementById('profile-avatar-lg');
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const bioEl = document.getElementById('profile-bio');
  const locationEl = document.getElementById('profile-location');
  
  const name = profile?.username || '?';
  
  if (avatarEl) {
    if (profile?.avatar_url) {
      avatarEl.innerHTML = `<img src="${escHtml(profile.avatar_url)}" alt="${escHtml(name)}" decoding="async" />`;
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }
  
  // Render Username with Rating Summary (Visible to everyone)
  if (usernameEl) {
    const ratingValue = Number(profile?.rating) || 0;
    const stars = generateStarRatingHtml(ratingValue);
    const refreshBtn = isOwnProfile ? `<button id="btn-refresh-rating" onclick="refreshProfileRating()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.9rem; padding:4px;" title="Refresh Rating">↻</button>` : '';
    usernameEl.innerHTML = `${escHtml(profile?.username || name).toUpperCase()}
        <span style="font-size:1rem; margin-left:12px; vertical-align:middle; display:inline-flex; align-items:center; gap:8px;">
          ${stars} <small style="color:var(--text-muted); font-family:'Inter';">(${parseFloat(ratingValue).toFixed(1)})</small> ${refreshBtn}
        </span>`;
  }

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
    
    // Handle Review Button logic
    const existingReviewBtn = document.getElementById('btn-review-action');
    if (existingReviewBtn) existingReviewBtn.remove();

    if (profile) {
      const actionsWrap = editButton.parentElement;
      if (isOwnProfile) {
        actionsWrap.insertAdjacentHTML('beforeend', `<button id="btn-review-action" class="btn btn-outline ml-sm" onclick="switchProfileTab(document.querySelector('[data-ptab=\\'reviews\\']'))">⭐ My Reviews</button>`);
      } else {
        actionsWrap.insertAdjacentHTML('beforeend', `<button id="btn-review-action" class="btn btn-outline ml-sm" onclick="navigate('review', { meta: { sellerId: '${profile.id}' } })">⭐ Review</button>`);
      }
    }
  }

  // Ensure Reviews Tab exists
  const reviewsTab = document.querySelector('.profile-tab[data-ptab="reviews"]');
  if (!reviewsTab) {
    const tabContainer = document.querySelector('.profile-tabs');
    if (tabContainer) {
      tabContainer.insertAdjacentHTML('beforeend', `<button class="profile-tab" data-ptab="reviews" onclick="switchProfileTab(this)">⭐ Reviews</button>`);
    }
  }
  
  // Show/Hide settings tab based on ownership
  const settingsTabBtn = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTabBtn) settingsTabBtn.style.display = isOwnProfile ? 'inline-block' : 'none';

  const profileTabs = document.querySelector('.profile-tabs');
  if (profileTabs) profileTabs.style.display = 'flex';

  await loadProfileListings(profileIdToLoad, isOwnProfile);
  
  if (isOwnProfile) {
    const sUsername = document.getElementById('s-username');
    const sBio = document.getElementById('s-bio');
    const sLocation = document.getElementById('s-location');
    const sPhone = document.getElementById('s-phone');
    
    if (sUsername) sUsername.value = profile?.username || '';
    if (sBio) sBio.value = profile?.bio || '';
    if (sLocation) sLocation.value = profile?.location || '';
    if (sPhone) sPhone.value = profile?.phone || '';
  }
  
  // Default to listings tab if settings is active but not allowed
  const activeTabBtn = document.querySelector('.profile-tab.active');
  let tabToOpen = activeTabBtn ? activeTabBtn.dataset.ptab : 'my-listings';
  if (tabToOpen === 'settings' && !isOwnProfile) tabToOpen = 'my-listings';
  
  showProfileTab(tabToOpen);
}

async function refreshProfileRating() {
  if (!State.user || State.viewingProfileId !== State.user.id) return;
  const btn = document.getElementById('btn-refresh-rating');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '...';
  btn.disabled = true;

  try {
    // Recalculate average from reviews table
    const { data: allReviews, error: fetchErr } = await db
      .from('reviews')
      .select('rating')
      .eq('seller_id', State.user.id);

    if (fetchErr) throw fetchErr;

    const avgRating = allReviews.length > 0 
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length 
      : 0;

    // Sync back to profile
    await db.from('profiles').update({ rating: avgRating }).eq('id', State.user.id);
    
    showToast('Rating updated from latest reviews!', 'success');
    await loadProfile(); 
  } catch (err) {
    showToast('Failed to refresh rating.', 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

// Update seller's rating after a review is submitted
async function updateSellerRating(sellerId) {
  if (!sellerId) return;
  
  try {
    // Calculate average rating from all reviews for this seller
    const { data: allReviews, error: fetchErr } = await db
      .from('reviews')
      .select('rating')
      .eq('seller_id', sellerId);

    if (fetchErr) throw fetchErr;

    const avgRating = allReviews.length > 0 
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length 
      : 0;

    // Update the profile with the new average rating
    const { error: updateErr } = await db
      .from('profiles')
      .update({ rating: avgRating })
      .eq('id', sellerId);

    if (updateErr) throw updateErr;
    
    console.log(`Updated seller ${sellerId} rating to ${avgRating.toFixed(1)}`);
  } catch (err) {
    console.error('Error updating seller rating:', err);
  }
}

function showProfileTab(tabName) {
  const myListingsDiv = document.getElementById('ptab-my-listings');
  const soldDiv = document.getElementById('ptab-sold');
  const settingsDiv = document.getElementById('ptab-settings');
  const reviewsDiv = document.getElementById('ptab-reviews');
  
  const targetId = State.viewingProfileId;
  const isOwnProfile = State.user && targetId === State.user.id;

  // Security: Prevent access to settings if not own profile
  if (tabName === 'settings' && !isOwnProfile) {
    showProfileTab('my-listings');
    return;
  }

  if (myListingsDiv) myListingsDiv.classList.add('hidden');
  if (soldDiv) soldDiv.classList.add('hidden');
  if (settingsDiv) settingsDiv.classList.add('hidden');
  if (reviewsDiv) reviewsDiv.classList.add('hidden');
  
  if (tabName === 'my-listings' && myListingsDiv) {
    myListingsDiv.classList.remove('hidden');
  } else if (tabName === 'reviews' && reviewsDiv) {
    reviewsDiv.classList.remove('hidden');
    loadSellerReviews(targetId);
  } else if (tabName === 'sold' && soldDiv) {
    soldDiv.classList.remove('hidden');
    loadProfileListings(targetId, isOwnProfile);
  } else if (tabName === 'settings' && settingsDiv) {
    settingsDiv.classList.remove('hidden');
  }
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
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">NO ACTIVE LISTINGS</div>${isOwnProfile ? '<div class="empty-sub">Click + CREATE to list your first item</div>' : ''}</div>`;
    } else {
      grid.innerHTML = '';
      active.forEach(l => grid.appendChild(createListingCard(l, isOwnProfile)));
    }
  }
  
  const soldGrid = document.getElementById('profile-sold-grid');
  if (soldGrid) {
    if (sold.length === 0) {
      soldGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">NO SOLD ITEMS YET</div><div class="empty-sub">Items you sell will appear here</div></div>`;
    } else {
      soldGrid.innerHTML = '';
      sold.forEach(l => {
        const card = createListingCard(l, false);
        card.classList.add('sold-listing-card');
        soldGrid.appendChild(card);
      });
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
  showProfileTab(tabName);
}

function openEditProfile() {
  const settingsTab = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTab) {
    settingsTab.click();
    settingsTab.scrollIntoView({ behavior: 'smooth' });
  }
}

// ==================== REVIEW SYSTEM ====================
window.removeReviewImage = function(index) {
  if (State.reviewImageFiles) {
    State.reviewImageFiles.splice(index, 1);
    const preview = document.getElementById('review-image-previews');
    const countEl = document.getElementById('review-image-count');
    
    if (preview) {
      preview.innerHTML = (State.reviewImageFiles || []).map((f, idx) => `
        <div style="position:relative; width:80px; height:80px;">
          <img src="${URL.createObjectURL(f)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; display:block;">
          <button type="button" onclick="removeReviewImage(${idx})" style="position:absolute; top:-8px; right:-8px; width:24px; height:24px; border-radius:50%; background:var(--danger); border:none; color:white; cursor:pointer; font-size:1rem; padding:0; display:flex; align-items:center; justify-content:center;">×</button>
        </div>
      `).join('');
    }
    
    if (countEl) countEl.textContent = `${State.reviewImageFiles.length} / 3 images`;
  }
};

window.removeExistingReviewImage = function(imagePath) {
  if (!State.reviewId) return;
  // Remove from State.existingReviewImages
  State.existingReviewImages = State.existingReviewImages.filter(img => img.object_path !== imagePath);
  
  const preview = document.getElementById('review-image-previews');
  if (preview) {
    // Rebuild preview with remaining existing images + new images
    preview.innerHTML = State.existingReviewImages.map((img) => `
      <div style="position:relative; width:80px; height:80px;">
        <img src="${img.object_path}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; display:block;">
        <button type="button" onclick="removeExistingReviewImage('${img.object_path}')" style="position:absolute; top:-8px; right:-8px; width:24px; height:24px; border-radius:50%; background:var(--danger); border:none; color:white; cursor:pointer; font-size:1rem; padding:0; display:flex; align-items:center; justify-content:center;">×</button>
      </div>
    `).join('') + 
    (State.reviewImageFiles || []).map((f, idx) => `
      <div style="position:relative; width:80px; height:80px;">
        <img src="${URL.createObjectURL(f)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; display:block;">
        <button type="button" onclick="removeReviewImage(${idx})" style="position:absolute; top:-8px; right:-8px; width:24px; height:24px; border-radius:50%; background:var(--danger); border:none; color:white; cursor:pointer; font-size:1rem; padding:0; display:flex; align-items:center; justify-content:center;">×</button>
      </div>
    `).join('');
  }
  
  const countEl = document.getElementById('review-image-count');
  if (countEl) {
    const totalCount = State.existingReviewImages.length + (State.reviewImageFiles?.length || 0);
    countEl.textContent = `${totalCount} / 3 images`;
  }
};

async function loadReviewPage(sellerId) {
  if (!sellerId || !State.user || sellerId === State.user.id) {
    showToast("You cannot review yourself.", "warning");
    if (State.currentPage === 'review') window.location.href = 'index.html#shop';
    else navigate('shop');
    return;
  }

  State.currentReviewSellerId = sellerId;
  State.reviewImageFiles = [];
  State.reviewId = null;
  State.existingReviewImages = [];
  State.originalReviewImages = [];

  // Setup back/cancel buttons
  const backBtn = document.getElementById('btn-back-profile');
  const cancelBtn = document.getElementById('btn-cancel-review');
  const backHandler = () => navigate('profile', { meta: { profileId: sellerId } });
  if (backBtn) backBtn.onclick = backHandler;
  if (cancelBtn) cancelBtn.onclick = backHandler;

  const toggleSoldInput = document.getElementById('toggle-sold-items');
  if (toggleSoldInput) toggleSoldInput.checked = false;

  const header = document.getElementById('review-seller-info');
  const itemsGrid = document.getElementById('seller-items-grid');
  if (!header || !itemsGrid) return;

  header.innerHTML = '<div class="spinner"></div> Loading seller...';
  itemsGrid.innerHTML = '<div class="spinner"></div>';

  try {
    const [sellerRes, itemsRes, existingReviewRes] = await Promise.all([
      db.from('profiles').select('*').eq('id', sellerId).single(),
      db.from('listings').select('*').eq('seller_id', sellerId).eq('is_sold', false).order('created_at', { ascending: false }),
      db.from('reviews').select('*').eq('seller_id', sellerId).eq('reviewer_id', State.user.id).maybeSingle()
    ]);

    if (sellerRes.error) throw sellerRes.error;
    const seller = sellerRes.data;
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px; padding:16px; background:var(--bg-2); border-radius:var(--radius-lg);">
        <div class="seller-avatar" style="width:50px; height:50px; font-size:1.2rem; background:var(--bg-3);">${seller.username?.charAt(0).toUpperCase()}</div>
        <div>
          <h3 style="margin:0 0 4px 0; font-family:'Orbitron';">REVIEWING: ${escHtml(seller.username).toUpperCase()}</h3>
          <div style="font-size:0.8rem; color:var(--text-muted);">⭐ ${seller.rating || 'New seller'} | 📍 ${seller.location || 'N/A'}</div>
        </div>
      </div>
    `;

    // Load active items only first
    const items = itemsRes.data || [];
    State.allSellerItems = items;
    renderSellerItems(items);
    if (existingReviewRes.data) {
      const review = existingReviewRes.data;
      State.reviewId = review.id;
      
      // Load review images
      const { data: images } = await db.from('review_images').select('object_path').eq('review_id', review.id);
      State.existingReviewImages = images || [];
      State.originalReviewImages = JSON.parse(JSON.stringify(images || [])); // Store original for comparison
      
      // Populate form with existing data
      document.getElementById('review-body').value = review.body;
      const charCountEl = document.getElementById('review-char-count');
      if (charCountEl) charCountEl.textContent = `${review.body.length} / 2000 characters`;
      
      const radio = document.querySelector(`input[name="rating"][value="${review.rating}"]`);
      if (radio) radio.checked = true;

      const display = document.getElementById('star-value-display');
      if (display) display.textContent = `${review.rating} star${review.rating !== 1 ? 's' : ''} selected`;
      
      // Show existing images
      const preview = document.getElementById('review-image-previews');
      if (preview && State.existingReviewImages.length > 0) {
        preview.innerHTML = State.existingReviewImages.map((img) => `
          <div style="position:relative; width:80px; height:80px;" class="animate-pop">
            <img src="${img.object_path}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; display:block;">
            <button type="button" onclick="removeExistingReviewImage('${img.object_path}')" style="position:absolute; top:-8px; right:-8px; width:24px; height:24px; border-radius:50%; background:var(--danger); border:none; color:white; cursor:pointer; font-size:1rem; padding:0; display:flex; align-items:center; justify-content:center;">×</button>
          </div>
        `).join('');
      }
      
      const countEl = document.getElementById('review-image-count');
      if (countEl) countEl.textContent = `${State.existingReviewImages.length} / 3 images`;
      
      // Update button text
      const btn = document.getElementById('submit-review-btn');
      if (btn) btn.textContent = '✎ UPDATE MY PREVIOUS REVIEW';
      const formTitle = document.getElementById('review-form-title');
      if (formTitle) formTitle.textContent = '✍️ Edit Your Review';
    }
  } catch (err) {
    console.error('Error loading review context:', err);
    showToast('Failed to load seller info.', 'error');
  }
}

function renderSellerItems(items) {
  const itemsGrid = document.getElementById('seller-items-grid');
  if (!itemsGrid) return;
  
  if (items.length === 0) {
    itemsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--text-muted);">No items to display</div>';
  } else {
    itemsGrid.innerHTML = items.map(item => `
      <div class="seller-item-card" data-id="${item.id}" style="border-radius:var(--radius); overflow:hidden; background:var(--bg-2); transition:all 0.2s; cursor:pointer; border: 2px solid transparent;" title="${escHtml(item.name)}">
        <img src="${item.images?.[0] || 'placeholder.png'}" style="width:100%; aspect-ratio:1; object-fit:cover; display:block;">
        <div style="padding:8px; font-size:0.75rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center; color:var(--text-secondary);">${escHtml(item.name)}</div>
        ${item.is_sold ? '<div style="position:absolute; top:4px; right:4px; background:var(--danger); color:white; font-size:0.65rem; padding:3px 6px; border-radius:4px; font-weight:bold;">SOLD</div>' : ''}
      </div>
    `).join('');
    
    itemsGrid.querySelectorAll('.seller-item-card').forEach(card => {
        card.onclick = () => {
            itemsGrid.querySelectorAll('.seller-item-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            State.selectedReviewListingId = card.dataset.id;
        };
    });
  }
}

window.toggleSoldItems = async function() {
  const checkbox = document.getElementById('toggle-sold-items');
  if (!State.currentReviewSellerId) return;

  try {
    if (checkbox.checked) {
      const { data: allItems, error } = await db
        .from('listings')
        .select('*')
        .eq('seller_id', State.currentReviewSellerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      State.allSellerItems = allItems || [];
    } else {
      const { data: activeItems, error } = await db
        .from('listings')
        .select('*')
        .eq('seller_id', State.currentReviewSellerId)
        .eq('is_sold', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      State.allSellerItems = activeItems || [];
    }
    renderSellerItems(State.allSellerItems);
  } catch (err) {
    showToast('Failed to load items.', 'error');
  }
};

async function handleReviewSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-review-btn');
  const errEl = document.getElementById('review-form-error');
  
  if (!State.user) {
    openAuthModal();
    return;
  }

  const rating = document.querySelector('input[name="rating"]:checked')?.value;
  if (!rating) {
    showToast("Please provide a star rating.", "warning");
    return;
  }

  const body = document.getElementById('review-body').value.trim();
  if (!body || body.length < 10) {
    showToast("Review must be at least 10 characters.", "warning");
    return;
  }

  setLoading(btn, true, State.reviewId ? 'UPDATING...' : 'SUBMITTING...');
  if (errEl) errEl.style.display = 'none';

  try {
    let review;
    
    if (State.reviewId) {
      // UPDATE MODE
      const { data: updated, error: uError } = await db
        .from('reviews')
        .update({
          rating: parseInt(rating),
          body: body,
          updated_at: new Date().toISOString()
        })
        .eq('id', State.reviewId)
        .select()
        .single();
      
      if (uError) throw uError;
      review = updated;
      
      // Handle image removals - compare original with current
      const removedImages = (State.originalReviewImages || []).filter(original => 
        !State.existingReviewImages.some(current => current.object_path === original.object_path)
      );
      
      for (const img of removedImages) {
        try {
          const path = img.object_path.split('/').slice(-3).join('/');
          await db.storage.from('review-images').remove([path]);
          await db.from('review_images').delete().eq('object_path', img.object_path);
        } catch (err) {
          console.error('Error removing image:', err);
        }
      }
    } else {
      // INSERT MODE
      const { data: newReview, error: iError } = await db
        .from('reviews')
        .insert({
          seller_id: State.currentReviewSellerId,
          reviewer_id: State.user.id,
          listing_id: State.selectedReviewListingId,
          rating: parseInt(rating),
          body: body
        })
        .select()
        .single();

      if (iError) throw iError;
      review = newReview;
    }

    // Handle Review Images (max 3, only new ones)
    if (State.reviewImageFiles && State.reviewImageFiles.length > 0) {
      const totalImages = (State.existingReviewImages?.length || 0) + State.reviewImageFiles.length;
      const maxNewImages = Math.max(0, 3 - (State.existingReviewImages?.length || 0));
      
      for (let i = 0; i < Math.min(State.reviewImageFiles.length, maxNewImages); i++) {
        const file = State.reviewImageFiles[i];
        const ext = file.name.split('.').pop();
        const path = `${State.user.id}/${review.id}/${Date.now()}_${i}.${ext}`;
        
        const { error: uploadError } = await db.storage.from('review-images').upload(path, file);
        
        if (!uploadError) {
          const { data: { publicUrl } } = db.storage.from('review-images').getPublicUrl(path);
          await db.from('review_images').insert({ 
            review_id: review.id, 
            object_path: publicUrl 
          });
        }
      }
    }

    const message = State.reviewId ? '✓ Review updated successfully!' : '✓ Review posted successfully!';
    showToast(message, 'success');
    
    // Update seller's rating after successful review submission
    await updateSellerRating(State.currentReviewSellerId);
    
    navigate('profile', { meta: { profileId: State.currentReviewSellerId } });
  } catch (err) {
    console.error('Submit error:', err);
    if (errEl) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  } finally {
    const btnText = State.reviewId ? '✎ UPDATE REVIEW' : '✓ SUBMIT REVIEW';
    setLoading(btn, false, btnText);
  }
}

async function loadSellerReviews(sellerId) {
  const container = document.getElementById('seller-reviews-container');
  if (!container) return;
  
  container.innerHTML = '<div class="spinner" style="display:block; margin:20px auto;"></div>';

  try {
    const { data: reviews, error } = await db
      .from('reviews')
      .select(`
        *, 
        reviewer:reviewer_id(id, username, avatar_url), 
        review_images(object_path),
        listings:listing_id(name, images)
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const noReviewsMsg = document.getElementById('no-reviews-message');
    if (!reviews || reviews.length === 0) {
      if (noReviewsMsg) noReviewsMsg.style.display = 'block';
      container.innerHTML = '';
      return;
    }
    if (noReviewsMsg) noReviewsMsg.style.display = 'none';

    container.innerHTML = reviews.map(r => {
      const item = r.listings;
      const itemHtml = item ? `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:8px; background:var(--bg-3); border-radius:6px; border:1px solid var(--border);">
          <img src="${item.images?.[0] || ''}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
          <span style="font-size:0.8rem; color:var(--text-secondary);">Reviewed: <strong>${escHtml(item.name)}</strong></span>
        </div>` : '';

      return `
      <div class="review-card" onclick="this.classList.toggle('expanded')" style="background:var(--bg-2); border-radius:var(--radius); padding:20px; margin-bottom:16px; border:1px solid var(--border); cursor:pointer; transition:all 0.3s ease;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div class="reviewer-avatar" style="width:44px; height:44px; border-radius:50%; background:var(--bg-3); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem; border:1px solid var(--border);">
            ${r.reviewer?.avatar_url ? `<img src="${r.reviewer.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : (r.reviewer?.username?.charAt(0) || '?')}
          </div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--text); font-size:1rem; cursor:pointer; text-decoration:underline;" onclick="event.stopPropagation(); viewSellerProfile('${r.reviewer?.id}')">${escHtml(r.reviewer?.username || 'Anonymous')}</strong>
              ${generateStarRatingHtml(r.rating)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${new Date(r.created_at).toLocaleDateString()}</div>
          </div>
          <div class="expand-icon" style="transition:transform 0.3s; font-size:0.8rem; color:var(--text-muted);">▼</div>
        </div>
        
        <div class="review-details" style="display:block;">
          ${itemHtml}
          <div style="line-height:1.7; color:var(--text-secondary); white-space:pre-wrap;">${escHtml(r.body)}</div>
          ${r.review_images && r.review_images.length ? `
            <div class="review-images" style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
              ${r.review_images.map(img => `<img src="${img.object_path}" style="width:120px; height:120px; object-fit:cover; border-radius:8px; border:2px solid var(--border); transition:transform 0.2s; cursor:zoom-in; display:block;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="event.stopPropagation(); window.open('${img.object_path}')">`).join('')}
            </div>
          ` : ''}
          <div style="text-align:right; margin-top:12px;">
             <small style="color:var(--neon); font-size:0.65rem; text-transform:uppercase; font-weight:700;">Verified Transaction</small>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Error loading reviews:', err);
    container.innerHTML = '<div class="empty-state">Failed to load reviews.</div>';
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
    
    if (State.currentPage === 'profile') {
      await loadProfileListings(State.user.id, true);
    }
    if (State.currentPage === 'detail') navigate('profile');
  } catch (err) {
    console.error('Error marking as sold:', err);
    showToast('Failed to mark as sold: ' + err.message, 'error');
  }
}

async function initListingMap(locationStr, elementId) {
  const container = document.getElementById(elementId);
  if (!container || typeof L === 'undefined') return;

  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationStr)}`);
    const results = await resp.json();
    
    if (results && results.length > 0) {
      const { lat, lon } = results[0];
      container.innerHTML = '';

      const neonIcon = L.divIcon({
        className: 'custom-neon-marker',
        html: `<div style="background-color:var(--neon); width:15px; height:15px; border-radius:50%; border:2px solid #000; box-shadow:0 0 10px var(--neon), 0 0 20px var(--neon);"></div>`,
        iconSize: [15, 15],
        iconAnchor: [7, 7]
      });

      const map = L.map(elementId).setView([lat, lon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      L.marker([lat, lon], { icon: neonIcon }).addTo(map);
      
      setTimeout(() => map.invalidateSize(), 400);
    } else {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.8rem;">📍 Location coordinates not found</div>';
    }
  } catch (err) {
    console.error('Map initialization error:', err);
  }
}

async function openListing(listingId) {
  navigate('detail', { updateUrl: false });
  State.currentListingId = listingId;
  
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
    
    ignoreHashChange = true;
    updateUrlForPage('detail', { listingId: listingId, listingName: listing.name });
    setTimeout(() => { ignoreHashChange = false; }, 0);
    
    if (!listing.ai_suggestions) {
      generateAndSaveListingSuggestion(listingId);
    }
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
  
  let imagesHtml = '';
  if (listing.images && listing.images.length > 0) {
    if (listing.images.length === 1) {
      imagesHtml = `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" style="width:100%;border-radius:var(--radius-lg);" />`;
    } else {
      const detailCarouselId = `detail-carousel-${listing.id}`;
      imagesHtml = `
        <div class="image-carousel" id="${detailCarouselId}">
          <div class="carousel-container">
            <div class="carousel-slides" id="${detailCarouselId}-slides" style="display:flex;transition:transform 0.3s ease;">
              ${listing.images.map((img, idx) => `
                <div class="carousel-slide" style="min-width:100%;">
                  <img src="${escHtml(img)}" alt="Image ${idx + 1}" style="width:100%;border-radius:var(--radius-lg);" />
                </div>
              `).join('')}
            </div>
            <button class="carousel-btn prev" onclick="changeSlide('${detailCarouselId}', -1)">‹</button>
            <button class="carousel-btn next" onclick="changeSlide('${detailCarouselId}', 1)">›</button>
            <div class="carousel-dots" id="${detailCarouselId}-dots">
              ${listing.images.map((_, idx) => `<span class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide('${detailCarouselId}', ${idx})"></span>`).join('')}
            </div>
            <div class="image-count-badge">${listing.images.length} images</div>
          </div>
        </div>
      `;
      setTimeout(() => {
        const slides = document.getElementById(`${detailCarouselId}-slides`);
        if (slides) slides.dataset.currentIndex = '0';
      }, 100);
    }
  } else {
    imagesHtml = `<div class="card-no-image">📦</div>`;
  }
  
  const paymentMethodsList = listing.payment_methods && listing.payment_methods.length > 0
    ? listing.payment_methods.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' · ')
    : 'Cash';
  
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
          ${listing.msrp ? `<span class="detail-msrp" style="text-decoration:line-through;color:var(--text-muted);margin-left:12px;">$${parseFloat(listing.msrp).toFixed(2)} MSRP</span>` : ''}
        </div>
        <div class="detail-meta-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
          ${listing.location ? `<div class="detail-meta-item"><strong>📍 Location</strong><br>${escHtml(listing.location)}</div>` : ''}
          <div class="detail-meta-item"><strong>💳 Payment Methods</strong><br>${paymentMethodsList}</div>
          <div class="detail-meta-item"><strong>📦 Condition</strong><br>${listing.condition || 'N/A'}</div>
          <div class="detail-meta-item"><strong>🚚 Shipping</strong><br>${listing.shipping || 'paid'}</div>
        </div>
        <div class="detail-description">${escHtml(listing.description)}</div>

        <div class="detail-analysis-row" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin: 24px 0;">
          ${listing.location ? `
            <div id="map-${listing.id}" class="detail-map-container" style="border-radius: var(--radius-lg); overflow: hidden; height: 320px; border: 1px solid var(--border); z-index:1; position:relative; background:var(--bg-3);">
              <div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.8rem;color:var(--text-muted);">
                <span class="spinner" style="margin-right:8px;"></span> Loading Map...
              </div>
            </div>
          ` : ''}
          
          <div id="ai-suggestions-${listing.id}">
            <div style="text-align:center; padding:20px; background:var(--bg-2); border-radius:var(--radius-lg); border:1px solid var(--border); height:100%; display:flex; flex-direction:column; justify-content:center;">
              <div class="spinner" style="margin:0 auto 10px;"></div> Loading AI analysis...
            </div>
          </div>
        </div>

        <div class="pickup-route-planner" style="margin: 24px 0; padding: 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); animation: fadeIn 0.5s ease-out;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
            <span style="font-size:1.5rem;">🗺️</span>
            <h3 style="color: var(--neon); font-family: 'Orbitron', sans-serif; font-size: 1.1rem;">AI PICKUP ROUTE PLANNER</h3>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 20px;">Planning a pickup? Get AI-powered travel routes and area safety assessments.</p>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <input type="text" id="pickup-start-loc-${listing.id}" placeholder="Your location (City or neighborhood)..." style="flex:1; min-width:200px;">
            <button class="btn btn-primary" onclick="generatePickupRoute('${listing.id}')">PLAN ROUTE</button>
          </div>
          <div id="route-planner-result-${listing.id}" style="margin-top:20px;"></div>
        </div>

        <div class="seller-card">
          <div class="seller-avatar">${seller.username?.charAt(0) || '?'}</div>
          <div><div class="seller-name">${escHtml(seller.username || 'Anonymous')}</div>
          ${seller.rating > 0 ? `<div class="seller-rating">⭐ ${parseFloat(seller.rating).toFixed(1)}</div>` : ''}
          ${seller.location ? `<div class="seller-location">📍 ${escHtml(seller.location)}</div>` : ''}</div>
          <button onclick="viewSellerProfile('${seller.id}')" class="btn btn-outline btn-sm">View Profile</button>
        </div>
        <div class="detail-actions" style="display:flex;flex-direction:column;gap:10px;">${actionsHtml}</div>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    displayListingSuggestion(listing.id);
    if (listing.location) initListingMap(listing.location, `map-${listing.id}`);
  }, 500);
}

function viewSellerProfile(sellerId, updateHash = true) {
  if (updateHash) {
    window.location.hash = `profile/${sellerId}`;
    return;
  }
  window.selectedProfileId = sellerId;
  navigate('profile', { updateUrl: false, meta: { profileId: sellerId } });
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
  card.className = 'listing-card animate-fade';
  card.onclick = (e) => {
    if (e.target.closest('.wishlist-btn, .owner-btn, .carousel-btn, .carousel-dot')) return;
    openListing(listing.id);
  };
  
  const isWished = State.wishlistIds.has(listing.id);
  const isOwner = State.user && State.user.id === listing.seller_id;
  const showActions = showOwnerActions !== undefined ? showOwnerActions : isOwner;
  
  let imageHtml;
  if (listing.images && listing.images.length > 1) {
    imageHtml = createImageCarousel(listing.images, listing.id);
  } else if (listing.images && listing.images.length === 1) {
    imageHtml = `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" decoding="async" />`;
  } else {
    imageHtml = `<div class="card-no-image">📦</div>`;
  }
  
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
        style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;z-index:20;transition:all 0.2s;"
      >${isWished ? '❤️' : '🤍'}</button>
    `;
  }
  
  let ownerActions = '';
  if (showActions && isOwner && !listing.is_sold) {
    ownerActions = `
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="owner-btn" onclick="event.stopPropagation(); editListing('${listing.id}')" style="background:var(--neon);color:#001a07;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;font-size:11px;transition:all 0.2s;">EDIT</button>
        <button class="owner-btn" onclick="event.stopPropagation(); openMarkSoldModal('${listing.id}')" style="background:var(--warning);color:#001a07;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;font-size:11px;transition:all 0.2s;">SOLD</button>
      </div>
    `;
  }
  
  const hasAiSuggestion = listing.ai_suggestions ? true : false;
  
  const soldOverlay = listing.is_sold ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);padding:8px 16px;border-radius:8px;font-weight:bold;color:var(--danger);z-index:15;">SOLD</div>' : '';
  const locationDisplay = listing.location ? `📍 ${listing.location.substring(0, 25)}` : '';
  
  card.innerHTML = `
    <div class="card-image-wrap" style="position:relative;aspect-ratio:1;background:var(--bg-3);overflow:hidden;">
      ${imageHtml}
      ${listing.is_fair ? '<span style="position:absolute;top:8px;left:8px;background:var(--neon);color:#001a07;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:20;">AI FAIR</span>' : ''}
      ${hasAiSuggestion ? '<span style="position:absolute;top:8px;left:70px;background:var(--blue);color:#001a07;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:20;">🤖 AI ANALYZED</span>' : ''}
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
      ${locationDisplay ? `<div class="card-location" style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;display:flex;align-items:center;gap:4px;">${locationDisplay}</div>` : ''}
      <div class="card-payment" style="font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;background:rgba(0,255,65,0.08);padding:4px 8px;border-radius:6px;margin-top:4px;flex-wrap:wrap;">
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
    .or(`sender_id.eq.${State.user.id},receiver_id.eq.${State.user.id}`)
    .order('created_at', { ascending: true });
  
  if (mError) return console.error("Error loading messages", mError);
  
  const threadEl = document.getElementById('chatThread');
  if (!threadEl) return;
  threadEl.innerHTML = '';

  if (messages) {
    const filteredMessages = messages.filter(msg => {
      return (msg.sender_id === State.user.id && msg.receiver_id === partnerId) || 
             (msg.sender_id === partnerId && msg.receiver_id === State.user.id);
    });

    filteredMessages.forEach(msg => renderMessage(msg, State.user.id));
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
  const file = e.target.files?.[0];
  if (!file || !State.currentChatPartnerId) return;

  toggleProcessingOverlay(true, 'Uploading image...');

  try {
    const filePath = `${State.user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await db.storage.from('messages-images').upload(filePath, file);
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = db.storage.from('messages-images').getPublicUrl(filePath);
    
    const { error: msgError } = await db.from('messages').insert([{
      sender_id: State.user.id,
      receiver_id: State.currentChatPartnerId,
      listing_id: State.currentListingId || null,
      image_url: publicUrl,
    }]);

    if (msgError) throw msgError;
    
    e.target.value = ''; // Reset input
    await loadConversationThread(State.currentChatPartnerId);
    await loadMessages();
  } catch (err) {
    console.error("Image send error:", err);
    showToast("Could not send image: " + err.message, 'error');
  } finally {
    toggleProcessingOverlay(false);
  }
}

function renderMessage(msg, currentUserId) {
  const thread = document.getElementById('chatThread');
  if (!thread) return;
  const isSent = msg.sender_id === currentUserId;
  const div = document.createElement('div');
  div.className = `msg ${isSent ? 'sent' : 'received'}`;

  let timestampHtml = '';
  if (msg.created_at) {
    const date = new Date(msg.created_at);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toDateString() === date.toDateString() ? '' : date.toLocaleDateString() + ' ';
    timestampHtml = `<div style="font-size:0.65rem; opacity:0.6; margin-top:4px; text-align:${isSent ? 'right' : 'left'}">${dateStr}${time}</div>`;
  }
  
  if (msg.image_url) {
    div.innerHTML = `<img src="${escHtml(msg.image_url)}" class="msg-image" style="max-width:200px;border-radius:8px;cursor:pointer;" onclick="window.open(this.src)">
                     ${timestampHtml}`;
  } else {
    div.innerHTML = `${escHtml(msg.content)}
                     ${timestampHtml}`;
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
  const themeBtn = document.getElementById('theme-toggle');
  const createForm = document.getElementById('create-form');
  if (createForm) createForm.addEventListener('submit', submitListing);
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
  const headerSearch = document.querySelector('.header-search');
  const searchIcon = document.querySelector('.search-icon');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      State.searchQuery = e.target.value;
      if (headerSearch && !headerSearch.classList.contains('expanded')) {
        headerSearch.classList.add('expanded');
      }
      searchTimer = setTimeout(() => {
        if (State.currentPage !== 'shop') navigate('shop');
        applyFilters();
      }, 320);
    });
    searchInput.addEventListener('focus', () => {
      if (headerSearch) headerSearch.classList.add('expanded');
    });
    searchInput.addEventListener('blur', () => {
      if (headerSearch && !searchInput.value.trim()) {
        headerSearch.classList.remove('expanded');
      }
    });
  }
  if (searchIcon && searchInput) {
    searchIcon.addEventListener('click', () => searchInput.focus());
  }
  
  window.addEventListener('hashchange', handleHashChange);
  
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
  const logoEls = document.querySelectorAll('.logo');
  
  if (priceMin) priceMin.addEventListener('input', () => applyFilters());
  if (priceMax) priceMax.addEventListener('input', () => applyFilters());
  if (fairOnly) fairOnly.addEventListener('change', () => applyFilters());
  if (featuredOnly) featuredOnly.addEventListener('change', () => applyFilters());
  if (sortSelect) sortSelect.addEventListener('change', () => applyFilters());
  
  logoEls.forEach((logo) => {
    logo.addEventListener('click', () => {
      logo.classList.add('click-animate');
      setTimeout(() => logo.classList.remove('click-animate'), 420);
    });
  });
  
  const imageInput = document.getElementById('image-input');
  const uploadZone = document.getElementById('upload-zone');
  if (imageInput) {
    imageInput.addEventListener('change', handleImageUpload);
    imageInput.addEventListener('click', e => e.stopPropagation()); // Prevent double dialog
  }
  if (uploadZone) {
    uploadZone.addEventListener('click', () => {
      const input = document.getElementById('image-input');
      if (input) input.click();
    });
  }

  window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (header) {
      if (window.scrollY > 50) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    }
  });
  
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

  // Star Rating Input Animation
  document.querySelectorAll('.star-rating-input label').forEach(label => {
    label.addEventListener('click', () => {
      const val = parseInt(label.getAttribute('for').replace('star', ''));
      document.querySelectorAll('.star-rating-input label').forEach((l, idx) => {
        const starVal = 5 - idx;
        l.style.color = starVal <= val ? 'var(--neon)' : 'var(--text-muted)';
      });
    });
  });

  // Review image handling (max 3 images)
  const reviewImgInput = document.getElementById('review-image-input');
  if (reviewImgInput) {
    reviewImgInput.onclick = (e) => e.stopPropagation(); // Prevent double dialog
    reviewImgInput.onchange = (e) => {
      const newFiles = Array.from(e.target.files);
      const currentTotal = (State.existingReviewImages?.length || 0) + (State.reviewImageFiles?.length || 0);
      const remaining = Math.max(0, 3 - currentTotal);
      // Append new files instead of replacing
      State.reviewImageFiles = [...(State.reviewImageFiles || []), ...newFiles.slice(0, remaining)];
      
      const preview = document.getElementById('review-image-previews');
      const countEl = document.getElementById('review-image-count');
      
      // Show existing images + new images
      preview.innerHTML = (State.existingReviewImages || []).map((img) => `
        <div style="position:relative; width:80px; height:80px;">
          <img src="${img.object_path}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; display:block;">
          <button type="button" onclick="removeExistingReviewImage('${img.object_path}')" style="position:absolute; top:-8px; right:-8px; width:24px; height:24px; border-radius:50%; background:var(--danger); border:none; color:white; cursor:pointer; font-size:1rem; padding:0; display:flex; align-items:center; justify-content:center;">×</button>
        </div>
      `).join('') +
      State.reviewImageFiles.map((f, idx) => `
        <div style="position:relative; width:80px; height:80px;">
          <img src="${URL.createObjectURL(f)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; display:block;">
          <button type="button" onclick="removeReviewImage(${idx})" style="position:absolute; top:-8px; right:-8px; width:24px; height:24px; border-radius:50%; background:var(--danger); border:none; color:white; cursor:pointer; font-size:1rem; padding:0; display:flex; align-items:center; justify-content:center;">×</button>
        </div>
      `).join('');
      
      const totalCount = currentTotal + newFiles.slice(0, remaining).length;
      if (countEl) countEl.textContent = `${totalCount} / 3 images`;
    };
  }

  // Review body character counter
  const reviewBody = document.getElementById('review-body');
  if (reviewBody) {
    reviewBody.addEventListener('input', (e) => {
      const count = e.target.value.length;
      const countEl = document.getElementById('review-char-count');
      if (countEl) countEl.textContent = `${count} / 2000 characters`;
    });
  }

  // Star rating display
  document.querySelectorAll('input[name="rating"]').forEach(star => {
    star.addEventListener('change', (e) => {
      const display = document.getElementById('star-value-display');
      if (display) {
        display.textContent = `${e.target.value} star${e.target.value !== '1' ? 's' : ''} selected`;
        display.style.color = 'var(--neon)';
      }
    });
  });

  // Review upload zone click handler
  const reviewUploadZone = document.getElementById('review-upload-zone');
  if (reviewUploadZone) {
    reviewUploadZone.addEventListener('click', () => {
      document.getElementById('review-image-input')?.click();
    });
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  injectCustomStyles();
  initTheme();
  setupEventListeners();
  await initAuth();
  initChat();

  const route = parseRouteFromHash();
  
  // FIX: Properly handle meta-data for all routes on refresh
  if (route.page === 'detail' && route.listingId) {
    openListing(route.listingId);
  } else if (route.page === 'profile' && route.profileId) {
    window.selectedProfileId = route.profileId;
    navigate('profile', { updateUrl: false });
  } else if (route.page === 'review' && route.sellerId) {
    navigate('review', { meta: { sellerId: route.sellerId }, updateUrl: false });
  } else {
    navigate(route.page, { updateUrl: false });
  }
  
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
  
  console.log('%c OBTAINUM INITIALIZED - Ready', 'background:#00ff41;color:#001a07;font-family:monospace;padding:4px 8px;');
});

// ==================== CONTACT & ABOUT FUNCTIONS ====================
const ADMIN_EMAILS = "ftanvir2025@gmail.com,ronnyip1997@gmail.com,khalidissa530@gmail.com,Jadenthompson076@gmail.com";

async function submitBugReport(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  const lastSubmit = localStorage.getItem('last_bug_submit');
  const cooldown = 2 * 60 * 1000;
  if (lastSubmit && (Date.now() - lastSubmit < cooldown)) {
    showToast('Please wait before sending another report.', 'warning');
    return;
  }

  const formData = new FormData(form);
  const recipients = ADMIN_EMAILS.split(',').map(email => email.trim());
  const accessKey = "de95b588-e25e-4674-be05-a869867fa7ff";
  const bugSubject = `OBTAINUM Bug Report - ${State.user?.email || 'Guest'}`;
  
  setLoading(btn, true, 'SUBMITTING...');

  try {
    let anySucceeded = false;

    for (const recipientEmail of recipients) {
      const payload = new FormData();
      for (const [key, value] of formData.entries()) {
        payload.append(key, value);
      }
      payload.append("access_key", accessKey);
      payload.append("to", recipientEmail);
      payload.append("subject", bugSubject);

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: payload
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) anySucceeded = true;
      }
    }

    if (anySucceeded) {
      showToast('Bug report submitted! Thank you.', 'success');
      closeModal('report-modal');
      form.reset();
      localStorage.setItem('last_bug_submit', Date.now());
    } else {
      showToast('Bug report submission failed. Please try again.', 'error');
    }
  } catch (err) {
    console.error("Bug Report Error:", err);
    showToast('Error connecting to server.', 'error');
  } finally {
    setLoading(btn, false, 'Submit Report');
  }
}

function toggleNavMode() {
  const extraBtns = document.querySelectorAll('.nav-extra, .mobile-nav-extra');
  const toggleBtn = document.getElementById('nav-toggle-btn');
  const isMinimized = toggleBtn?.classList.contains('minimized');
  
  extraBtns.forEach(btn => {
    if (isMinimized) {
      btn.classList.remove('hidden-nav');
    } else {
      btn.classList.add('hidden-nav');
    }
  });
  
  if (toggleBtn) toggleBtn.classList.toggle('minimized');
}

async function getSafeRouteFromGemini(start, end) {
  const ragContext = buildSafetyContext(start, end);
  const prompt = `You are OBTAINUM's route safety AI. Using the following local safety context, suggest a safe route from "${start}" to "${end}".

${ragContext}

Provide a clear, bullet-point list of recommendations:
- General safe corridors or streets to take
- Areas to avoid (if any)
- Time-of-day advice
- Alternative safer paths

Keep it practical and concise. If exact streets are unknown, suggest types of routes (e.g., "use main highways, avoid side alleys").`;
  
  try {
    return await callGemini(prompt);
  } catch (e) {
    return await getFallbackSafeRoute(start, end);
  }
}

async function getFallbackSafeRoute(start, end) {
  const startScore = getSafetyScore(start);
  const endScore = getSafetyScore(end);
  let advice = `**Safe route suggestions from ${start} to ${end}**\n\n`;
  if (startScore < 50) advice += `⚠️ Starting area has lower safety rating. Consider using ride-share or traveling during daylight.\n`;
  if (endScore < 50) advice += `⚠️ Destination area has lower safety rating. Plan to arrive before dark.\n`;
  advice += `\n✅ General advice: Stick to main roads, use well-lit paths, avoid shortcuts through isolated areas.`;
  if (startScore >= 70 && endScore >= 70) advice += `\n✅ Both areas are relatively safe – direct routes should be fine, but remain aware.`;
  return advice;
}

function formatMarkdown(text) {
  // Convert markdown to HTML for better readability
  let formatted = text;
  
  // Headers (###)
  formatted = formatted.replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>');
  
  // Bold (**text**)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Bullet lists (*)
  formatted = formatted.replace(/^\* (.*?)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Numbered lists
  formatted = formatted.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
  
  // Add line breaks for paragraphs
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  formatted = '<p>' + formatted + '</p>';
  
  // Clean up empty paragraphs
  formatted = formatted.replace(/<p>\s*<\/p>/g, '');
  formatted = formatted.replace(/<p>(<[ou]l>)/g, '$1');
  formatted = formatted.replace(/(<\/[ou]l>)<\/p>/g, '$1');
  
  return formatted;
}

// ==================== PICKUP ROUTE PLANNER (for listing page) ====================
async function generatePickupRoute(listingId) {
  if (!listingId) {
    showToast("Invalid listing ID.", "error");
    return;
  }

  const { data: listing, error } = await db
    .from('listings')
    .select('location')
    .eq('id', listingId)
    .single();

  if (error || !listing || !listing.location) {
    showToast("Listing location not available.", "error");
    return;
  }

  const destination = listing.location;
  const startInput = document.getElementById(`pickup-start-loc-${listingId}`);
  if (!startInput) {
    showToast("Please enter your starting location.", "info");
    return;
  }

  const start = startInput.value.trim();
  if (!start) {
    showToast("Please enter your starting location.", "info");
    startInput.focus();
    return;
  }

  const resultContainer = document.getElementById(`route-planner-result-${listingId}`);
  if (!resultContainer) return;

  resultContainer.innerHTML = '<div class="spinner"></div> Analyzing safe route...';

  try {
    const ragContext = buildSafetyContext(start, destination);
    const prompt = `You are OBTAINUM's route safety AI. Suggest a safe route from "${start}" to "${destination}" for a physical pickup of an item.

${ragContext}

Provide a clear, actionable response with:
- Best route recommendations (main roads, public transit if applicable)
- Areas to avoid (if any)
- Time-of-day safety advice
- Any alternative safer paths
Keep it concise and practical.`;

    let aiResponse;
    try {
      aiResponse = await callGemini(prompt);
    } catch (e) {
      aiResponse = await getFallbackSafeRoute(start, destination);
    }

    resultContainer.innerHTML = `
      <div style="background:var(--bg-3); border-radius:var(--radius); padding:16px; margin-top:12px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <span>🛡️</span>
          <strong style="color:var(--neon);">AI Safe Route Suggestion</strong>
        </div>
        <div style="line-height:1.6;">${aiResponse.replace(/\n/g, '<br>')}</div>
        <div style="margin-top:12px; font-size:0.7rem; color:var(--text-muted);">⚠️ Always verify local conditions. AI suggestions are advisory only.</div>
      </div>
    `;
  } catch (err) {
    console.error("Pickup route error:", err);
    resultContainer.innerHTML = `<div class="auth-error show">⚠️ Error: ${err.message || "Could not generate route."}</div>`;
  }
}

// Expose global functions
window.openRouteSafetyModal = openRouteSafetyModal;
window.findSafeRoute = findSafeRoute;
window.generatePickupRoute = generatePickupRoute;



// ==================== GEOCODING & OSRM ROUTING HELPERS ====================
async function geocodeLocation(location) {
  // Returns { lat, lon } for a location string
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`);
  const data = await response.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  throw new Error(`Could not geocode: ${location}`);
}

async function getDrivingRoute(startLat, startLon, endLat, endLon) {
  // OSRM driving route
  const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.code !== 'Ok') throw new Error('Routing failed');
  return data;
}

// ==================== UPDATED PICKUP ROUTE PLANNER ====================
async function generatePickupRoute(listingId) {
  if (!listingId) {
    showToast("Invalid listing ID.", "error");
    return;
  }

  // Get listing location
  const { data: listing, error } = await db
    .from('listings')
    .select('location')
    .eq('id', listingId)
    .single();

  if (error || !listing || !listing.location) {
    showToast("Listing location not available.", "error");
    return;
  }

  const destination = listing.location;
  const startInput = document.getElementById(`pickup-start-loc-${listingId}`);
  if (!startInput) {
    showToast("Please enter your starting location.", "info");
    return;
  }

  const start = startInput.value.trim();
  if (!start) {
    showToast("Please enter your starting location.", "info");
    startInput.focus();
    return;
  }

  const resultContainer = document.getElementById(`route-planner-result-${listingId}`);
  if (!resultContainer) return;

  resultContainer.innerHTML = '<div class="spinner"></div> Geocoding locations...';

  try {
    // 1. Geocode both locations
    const [startCoords, endCoords] = await Promise.all([
      geocodeLocation(start),
      geocodeLocation(destination)
    ]);

    resultContainer.innerHTML = '<div class="spinner"></div> Fetching driving route...';

    // 2. Get driving route from OSRM
    const routeData = await getDrivingRoute(startCoords.lat, startCoords.lon, endCoords.lat, endCoords.lon);
    const route = routeData.routes[0];
    const distanceKm = (route.distance / 1000).toFixed(1);
    const durationMin = Math.round(route.duration / 60);

    // Extract step-by-step instructions
    let stepsHtml = '<ul style="margin: 8px 0 0 20px;">';
    (route.legs[0]?.steps || []).forEach(step => {
      const instruction = step.maneuver?.instruction || "Proceed forward";
      stepsHtml += `<li>${instruction} (${(step.distance / 1000).toFixed(1)} km)</li>`;
    });
    stepsHtml += '</ul>';

    // 3. Generate transit directions using Gemini (no API key needed for free transit data)
    let transitHtml = '';
    try {
      resultContainer.innerHTML = '<div class="spinner"></div> Generating transit directions...';
      const transitPrompt = `You are a public transit assistant. Suggest the best public transit route from "${start}" to "${destination}" in the New York City area (or general US city). Provide specific subway/bus lines, station names, number of stops, and estimated travel time. Use real MTA lines (e.g., 6 train, Q44 bus) if plausible. Keep it concise with bullet points.`;
      const transitResult = await callGemini(transitPrompt);
      transitHtml = `
        <div style="margin-top: 20px; padding: 16px; background: var(--bg-2); border-radius: var(--radius); border-left: 3px solid var(--blue);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span>🚇</span>
            <strong style="color: var(--blue);">Public Transit Directions</strong>
          </div>
          <div style="line-height: 1.6;">${formatMarkdown(transitResult)}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 8px;">⚠️ Transit suggestions are AI-generated; verify with local transit apps.</div>
        </div>
      `;
    } catch (e) {
      transitHtml = '<div style="margin-top: 20px; padding: 16px; background: var(--bg-2); border-radius: var(--radius);">⚠️ Public transit data currently unavailable.</div>';
    }

    // 4. Create map with the driving route
    const mapId = `route-map-${listingId}-${Date.now()}`;
    const mapHtml = `
      <div id="${mapId}" style="height: 300px; margin-top: 16px; border-radius: var(--radius); border: 1px solid var(--border);"></div>
    `;

    resultContainer.innerHTML = `
      <div style="background: var(--bg-3); border-radius: var(--radius); padding: 16px; margin-top: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span>🚗</span>
          <strong style="color: var(--neon);">Driving Route</strong>
          <span style="margin-left: auto; font-size: 0.85rem;">${distanceKm} km • ${durationMin} min</span>
        </div>
        ${mapHtml}
        <details style="margin-top: 12px;">
          <summary style="cursor: pointer; color: var(--text-secondary); font-size: 0.85rem;">Turn-by-turn directions</summary>
          ${stepsHtml}
        </details>
        ${transitHtml}
        <div style="margin-top: 12px; font-size: 0.7rem; color: var(--text-muted);">⚠️ Always verify local conditions. AI suggestions are advisory only.</div>
      </div>
    `;

    // Initialize the map after DOM update
    setTimeout(() => {
      if (typeof L !== 'undefined') {
        const map = L.map(mapId).setView([startCoords.lat, startCoords.lon], 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
        }).addTo(map);

        // Add start and end markers
        const startIcon = L.divIcon({ html: '<div style="background: #00ff41; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff;"></div>', iconSize: [12, 12] });
        const endIcon = L.divIcon({ html: '<div style="background: #ff2d55; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff;"></div>', iconSize: [12, 12] });
        L.marker([startCoords.lat, startCoords.lon], { icon: startIcon }).addTo(map).bindPopup(`Start: ${start}`);
        L.marker([endCoords.lat, endCoords.lon], { icon: endIcon }).addTo(map).bindPopup(`Destination: ${destination}`);

        // Draw the route line
        const routeGeoJSON = route.geometry;
        const routeLayer = L.geoJSON(routeGeoJSON, {
          style: { color: 'var(--neon)', weight: 5, opacity: 0.8 }
        }).addTo(map);
        map.fitBounds(routeLayer.getBounds());
      } else {
        console.warn('Leaflet not loaded');
      }
    }, 100);

  } catch (err) {
    console.error("Pickup route error:", err);
    resultContainer.innerHTML = `<div class="auth-error show">⚠️ Error: ${err.message || "Could not generate route."}</div>`;
  }
}

function getSafetyScore(location) {
  if (!location) return 50;
  const lowerLoc = location.toLowerCase();
  const safetyDatabase = {
    "downtown,new york": 65, "midtown,new york": 70, "upper east side,new york": 85,
    "harlem,new york": 55, "bronx,new york": 45, "south side,chicago": 40,
    "loop,chicago": 70, "lincoln park,chicago": 80, "hollywood,los angeles": 65,
    "beverly hills,los angeles": 85, "skid row,los angeles": 25
  };
  let bestScore = 50;
  for (const [key, score] of Object.entries(safetyDatabase)) {
    if (lowerLoc.includes(key)) bestScore = Math.max(bestScore, score);
  }
  return bestScore;
}

function buildSafetyContext(start, end) {
  const startScore = getSafetyScore(start);
  const endScore = getSafetyScore(end);
  const startSafe = startScore >= 70 ? "safe" : (startScore >= 50 ? "moderately safe" : "unsafe");
  const endSafe = endScore >= 70 ? "safe" : (endScore >= 50 ? "moderately safe" : "unsafe");
  return `Local safety data: Starting area: ${startSafe}; Destination: ${endSafe}. Suggest a route avoiding unsafe zones.`;
}

async function openRouteSafetyModal() {
  const modal = document.getElementById('route-safety-modal');
  const contentDiv = document.getElementById('route-safety-content');
  if (!modal || !contentDiv) return;
  contentDiv.innerHTML = `
    <form onsubmit="event.preventDefault(); findSafeRoute();">
      <div class="form-group"><label class="form-label">📍 Start</label><input type="text" id="route-start" class="form-input" required></div>
      <div class="form-group"><label class="form-label">🏁 End</label><input type="text" id="route-end" class="form-input" required></div>
      <button type="submit" class="btn btn-primary w-full" id="route-find-btn">🔍 Find Safe Route</button>
    </form><div id="route-result" style="margin-top: 20px;"></div>`;
  modal.classList.add('open');
}

async function findSafeRoute() {
  const start = document.getElementById('route-start')?.value.trim();
  const end = document.getElementById('route-end')?.value.trim();
  if (!start || !end) {
    showToast("Please enter both start and destination.", "error");
    return;
  }

  const resultDiv = document.getElementById('route-result');
  const findBtn = document.getElementById('route-find-btn');
  if (!resultDiv || !findBtn) return;

  setLoading(findBtn, true, "Analyzing...");
  resultDiv.innerHTML = '<div class="spinner"></div> Geocoding...';

  try {
    // Geocode start and end
    const [startCoords, endCoords] = await Promise.all([
      geocodeLocation(start),
      geocodeLocation(end)
    ]);

    resultDiv.innerHTML = '<div class="spinner"></div> Fetching driving route...';

    // Get OSRM route
    const routeData = await getDrivingRoute(startCoords.lat, startCoords.lon, endCoords.lat, endCoords.lon);
    const route = routeData.routes[0];
    const distanceKm = (route.distance / 1000).toFixed(1);
    const durationMin = Math.round(route.duration / 60);

    let stepsHtml = '<ul style="margin: 8px 0 0 20px;">';
    (route.legs[0]?.steps || []).forEach(step => {
      const instruction = step.maneuver?.instruction || "Continue on route";
      stepsHtml += `<li>${instruction} (${(step.distance / 1000).toFixed(1)} km)</li>`;
    });
    stepsHtml += '</ul>';

    // Gemini transit suggestion
    let transitHtml = '';
    try {
      const transitPrompt = `Suggest public transit from "${start}" to "${end}". Include line names, station names, and estimated time. Be specific and concise.`;
      const transitResponse = await callGemini(transitPrompt);
      transitHtml = `
        <div style="margin-top: 20px; padding: 16px; background: var(--bg-2); border-radius: var(--radius); border-left: 3px solid var(--blue);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span>🚇</span>
            <strong style="color: var(--blue);">Public Transit Suggestions</strong>
          </div>
          <div style="line-height: 1.6;">${formatMarkdown(transitResponse)}</div>
        </div>
      `;
    } catch (e) {
      console.warn("Transit fetch failed", e);
    }

    const mapId = `route-map-modal-${Date.now()}`;
    resultDiv.innerHTML = `
      <div style="background:var(--bg-3); border-radius:var(--radius); padding:16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span>🚗</span>
          <strong style="color:var(--neon);">Driving Route</strong>
          <span style="margin-left: auto;">${distanceKm} km • ${durationMin} min</span>
        </div>
        <div id="${mapId}" style="height: 300px; border-radius: var(--radius); margin-bottom: 12px;"></div>
        <details><summary style="cursor: pointer;">Turn-by-turn directions</summary>${stepsHtml}</details>
        ${transitHtml}
        <div style="margin-top: 12px; font-size:0.7rem; color:var(--text-muted);">⚠️ Always verify local conditions.</div>
      </div>
    `;

    // Render map
    setTimeout(() => {
      if (typeof L !== 'undefined') {
        const map = L.map(mapId).setView([startCoords.lat, startCoords.lon], 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OSM & CartoDB'
        }).addTo(map);
        L.marker([startCoords.lat, startCoords.lon]).addTo(map).bindPopup(`Start: ${start}`);
        L.marker([endCoords.lat, endCoords.lon]).addTo(map).bindPopup(`Destination: ${end}`);
        const routeLayer = L.geoJSON(route.geometry, { style: { color: 'var(--neon)', weight: 5, opacity: 0.8 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds());
      }
    }, 100);
  } catch (err) {
    resultDiv.innerHTML = `<div class="auth-error show">⚠️ Error: ${err.message}</div>`;
  } finally {
    setLoading(findBtn, false, "🔍 Find Safe Route");
  }
}

/**
 * Bridges the Charity Finder to the OSRM/Gemini Route Safety system
 */
async function getCharityDirections(name, address) {
  const start = document.getElementById('charity-location-input')?.value.trim();
  if (!start) {
    showToast("Please enter your starting location in the search box first.", "info");
    return;
  }

  await openRouteSafetyModal();
  document.getElementById('route-start').value = start;
  document.getElementById('route-end').value = address;
  findSafeRoute();
}

window.getCharityDirections = getCharityDirections;
