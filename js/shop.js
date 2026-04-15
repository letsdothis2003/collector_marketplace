// ==================== SHOP MODULE ====================
import { getDb, getCurrentUser, getCurrentUserSync, currentUser } from './auth.js';
import { showToast, escHtml, formatPrice, getCategoryIcon, paymentIcons, conditionLabels } from './utils.js';
import { openListing } from './detail.js';
import { toggleWishlist } from './wishlist.js';

// State
let listings = [];
let filteredListings = [];
let wishlistIds = new Set();
let activeCategory = 'all';
let activeCondition = 'all';
let activeType = 'all';
let searchQuery = '';
let priceMin = null;
let priceMax = null;
let sortBy = 'newest';

// DOM Elements
let listingsGrid;
let resultsCount;
let sortSelect;
let priceMinInput;
let priceMaxInput;
let priceSlider;
let fairOnlyCheckbox;
let featuredOnlyCheckbox;

// Populate filter chips with options
function populateFilterChips() {
  const categories = ['all', 'Collectibles', 'Electronics', 'Clothing & Accessories', 'Toys & Figures', 'Sports & Outdoors', 'Books & Media', 'Home & Garden', 'Tools & Equipment', 'Other'];
  const conditions = ['all', 'new', 'like-new', 'good', 'fair', 'poor'];
  const types = ['all', 'buy-now', 'auction', 'trade'];
  
  // Category chips
  const categoryChips = document.getElementById('category-chips');
  if (categoryChips) {
    categoryChips.innerHTML = categories.map(cat => `
      <button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="${cat}" onclick="selectCategory(this, '${cat}')" style="cursor:pointer;padding:8px 16px;border-radius:20px;background:var(--bg-2);border:1px solid var(--border);margin:4px;transition:all 0.2s;">
        ${cat === 'all' ? '✓ All' : getCategoryIcon(cat) + ' ' + cat}
      </button>
    `).join('');
  }
  
  // Condition chips
  const conditionChips = document.getElementById('condition-chips');
  if (conditionChips) {
    conditionChips.innerHTML = conditions.map(cond => `
      <button class="chip ${cond === 'all' ? 'active' : ''}" data-cond="${cond}" onclick="selectCondition(this, '${cond}')" style="cursor:pointer;padding:8px 16px;border-radius:20px;background:var(--bg-2);border:1px solid var(--border);margin:4px;transition:all 0.2s;">
        ${conditionLabels[cond] || (cond === 'all' ? '✓ All' : cond)}
      </button>
    `).join('');
  }
  
  // Type chips
  const typeChips = document.getElementById('type-chips');
  if (typeChips) {
    typeChips.innerHTML = types.map(type => `
      <button class="chip ${type === 'all' ? 'active' : ''}" data-type="${type}" onclick="selectType(this, '${type}')" style="cursor:pointer;padding:8px 16px;border-radius:20px;background:var(--bg-2);border:1px solid var(--border);margin:4px;transition:all 0.2s;">
        ${type === 'all' ? '✓ All' : type.replace('-', ' ')}
      </button>
    `).join('');
  }
}

// Initialize shop module
export async function initShop() {
  console.log('Initializing shop...');
  
  listingsGrid = document.getElementById('listings-grid');
  resultsCount = document.getElementById('results-count');
  sortSelect = document.getElementById('sort-select');
  priceMinInput = document.getElementById('price-min');
  priceMaxInput = document.getElementById('price-max');
  priceSlider = document.getElementById('price-slider');
  fairOnlyCheckbox = document.getElementById('fair-only');
  featuredOnlyCheckbox = document.getElementById('featured-only');
  
  // Populate filter chips FIRST
  populateFilterChips();
  
  // Set up event listeners
  if (sortSelect) sortSelect.addEventListener('change', () => applyFilters());
  if (priceMinInput) priceMinInput.addEventListener('input', () => applyFilters());
  if (priceMaxInput) priceMaxInput.addEventListener('input', () => applyFilters());
  if (priceSlider) priceSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    const display = document.getElementById('price-slider-val');
    if (display) display.textContent = `$${val}`;
    applyFilters();
  });
  if (fairOnlyCheckbox) fairOnlyCheckbox.addEventListener('change', () => applyFilters());
  if (featuredOnlyCheckbox) featuredOnlyCheckbox.addEventListener('change', () => applyFilters());
  
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => resetFilters());
  
  const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
  if (mobileFilterToggle) mobileFilterToggle.addEventListener('click', toggleMobileSidebar);
  
  console.log('Loading listings...');
  await loadListings();
  console.log('Shop ready');
}

// Load listings from database
export async function loadListings() {
  const db = getDb();
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
    
    listings = data || [];
    await loadWishlistIds();
    applyFilters();
  } catch (err) {
    console.error('Error loading listings:', err);
    showToast('Error loading listings', 'error');
    renderListings([]);
  }
}

// Load wishlist IDs for current user
async function loadWishlistIds() {
  const db = getDb();
  const user = await getCurrentUser();
  if (!user) return;
  
  const { data } = await db
    .from('wishlists')
    .select('listing_id')
    .eq('user_id', user.id);
  wishlistIds = new Set((data || []).map(w => w.listing_id));
}

// Apply all filters to listings
export async function applyFilters() {
  let results = [...listings];
  
  // Search filter
  if (searchQuery.length >= 2) {
    const q = searchQuery.toLowerCase();
    results = results.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.category?.toLowerCase().includes(q)
    );
  }
  
  // Category filter
  if (activeCategory !== 'all') {
    results = results.filter(l => l.category === activeCategory);
  }
  
  // Condition filter
  if (activeCondition !== 'all') {
    results = results.filter(l => l.condition === activeCondition);
  }
  
  // Type filter
  if (activeType !== 'all') {
    results = results.filter(l => l.type === activeType);
  }
  
  // Price filters
  const min = parseFloat(priceMinInput?.value || '');
  const max = parseFloat(priceMaxInput?.value || '');
  if (!isNaN(min)) results = results.filter(l => l.price >= min);
  if (!isNaN(max)) results = results.filter(l => l.price <= max);
  
  // Quality filters
  if (fairOnlyCheckbox?.checked) {
    results = results.filter(l => l.is_fair === true);
  }
  if (featuredOnlyCheckbox?.checked) {
    results = results.filter(l => l.is_featured === true);
  }
  
  // Sorting
  const sortValue = sortSelect?.value || 'newest';
  if (sortValue === 'price-asc') results.sort((a, b) => a.price - b.price);
  else if (sortValue === 'price-desc') results.sort((a, b) => b.price - a.price);
  else if (sortValue === 'popular') results.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  else if (sortValue === 'favorites') results.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
  else results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  filteredListings = results;
  
  if (resultsCount) resultsCount.textContent = results.length;
  renderListings(results);
}

// Render listings grid
function renderListings(listings) {
  if (!listingsGrid) return;
  
  if (listings.length === 0) {
    listingsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">NO LISTINGS FOUND</div>
        <div class="empty-sub">Try adjusting your search or filters.</div>
      </div>
    `;
    return;
  }
  
  listingsGrid.innerHTML = '';
  listings.forEach(listing => {
    listingsGrid.appendChild(createListingCard(listing));
  });
}

// Create individual listing card
function createListingCard(listing) {
  const card = document.createElement('div');
  card.className = 'listing-card animate-fade';
  card.onclick = (e) => {
    if (e.target.closest('.wishlist-btn, .owner-btn, .carousel-btn, .carousel-dot')) return;
    openListing(listing.id);
  };
  
  const isWished = wishlistIds.has(listing.id);
  const isOwner = currentUser && currentUser.id === listing.seller_id;
  
  // Image handling
  let imageHtml;
  if (listing.images && listing.images.length > 1) {
    imageHtml = createImageCarousel(listing.images, listing.id);
  } else if (listing.images && listing.images.length === 1) {
    imageHtml = `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" style="width:100%;height:100%;object-fit:cover;" />`;
  } else {
    imageHtml = `<div class="card-no-image">${getCategoryIcon(listing.category)}</div>`;
  }
  
  // Payment display
  const paymentDisplay = listing.payment_methods && listing.payment_methods.length > 0
    ? listing.payment_methods.slice(0, 3).map(p => paymentIcons[p] || p).join(' ')
    : '💵';
  
  // Wishlist button
  let wishlistBtn = '';
  if (currentUser && !isOwner) {
    wishlistBtn = `
      <button class="wishlist-btn ${isWished ? 'active' : ''}"
        data-listing-id="${listing.id}"
        style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;z-index:20;transition:all 0.2s;"
      >${isWished ? '❤️' : '🤍'}</button>
    `;
  }
  
  // AI badge
  const hasAiSuggestion = listing.ai_suggestions ? true : false;
  
  // Sold overlay
  const soldOverlay = listing.is_sold ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);padding:8px 16px;border-radius:8px;font-weight:bold;color:var(--danger);z-index:15;">SOLD</div>' : '';
  
  // Location display
  const locationDisplay = listing.location ? `📍 ${listing.location.substring(0, 25)}` : '';
  
  card.innerHTML = `
    <div class="card-image-wrap" style="position:relative;aspect-ratio:1;background:var(--bg-3);overflow:hidden;">
      ${imageHtml}
      ${listing.is_fair ? '<span style="position:absolute;top:8px;left:8px;background:var(--neon);color:#001a07;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:20;">AI FAIR</span>' : ''}
      ${hasAiSuggestion ? '<span style="position:absolute;top:8px;left:70px;background:var(--blue);color:#001a07;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:20;">🤖 ANALYZED</span>' : ''}
      ${soldOverlay}
      ${wishlistBtn}
    </div>
    <div class="card-body" style="padding:12px;">
      <div class="card-title" style="font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;">${escHtml(listing.name)}</div>
      <div class="card-price" style="color:var(--neon);font-weight:bold;font-size:1.1rem;margin-bottom:4px;">${formatPrice(listing.price)}</div>
      <div class="card-meta" style="font-size:0.7rem;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
        <span>🏷️ ${conditionLabels[listing.condition] || listing.condition}</span>
        <span>📦 ${listing.type?.replace('-', ' ') || 'buy now'}</span>
      </div>
      ${locationDisplay ? `<div class="card-location" style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;display:flex;align-items:center;gap:4px;">${locationDisplay}</div>` : ''}
      <div class="card-payment" style="font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;background:rgba(0,255,65,0.08);padding:4px 8px;border-radius:6px;margin-top:4px;flex-wrap:wrap;">
        <span>💳 Accepts:</span>
        <span>${paymentDisplay}</span>
      </div>
    </div>
  `;
  
  // Add wishlist button event listener
  const wishlistButton = card.querySelector('.wishlist-btn');
  if (wishlistButton) {
    wishlistButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleWishlist(listing.id);
      await loadWishlistIds();
      await applyFilters();
    });
  }
  
  return card;
}

// Create image carousel for multiple images
function createImageCarousel(images, listingId) {
  if (!images || images.length === 0) return `<div class="card-no-image">📦</div>`;
  if (images.length === 1) return `<img src="${escHtml(images[0])}" alt="Listing image" style="width:100%;height:100%;object-fit:cover;" />`;
  
  const carouselId = `carousel-${listingId}`;
  return `
    <div class="image-carousel" id="${carouselId}" style="position:relative;width:100%;height:100%;">
      <div class="carousel-slides" id="${carouselId}-slides" style="display:flex;width:100%;height:100%;transition:transform 0.3s ease;">
        ${images.map((img, idx) => `
          <div class="carousel-slide" style="min-width:100%;height:100%;">
            <img src="${escHtml(img)}" alt="Image ${idx + 1}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
        `).join('')}
      </div>
      <button class="carousel-btn prev" data-carousel="${carouselId}" style="position:absolute;top:50%;left:10px;transform:translateY(-50%);background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:30px;height:30px;color:white;cursor:pointer;z-index:10;">‹</button>
      <button class="carousel-btn next" data-carousel="${carouselId}" style="position:absolute;top:50%;right:10px;transform:translateY(-50%);background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:30px;height:30px;color:white;cursor:pointer;z-index:10;">›</button>
      <div class="carousel-dots" id="${carouselId}-dots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;">
        ${images.map((_, idx) => `<span class="carousel-dot" data-index="${idx}" style="width:8px;height:8px;border-radius:50%;background:${idx === 0 ? 'var(--neon)' : 'rgba(255,255,255,0.5)'};cursor:pointer;"></span>`).join('')}
      </div>
    </div>
  `;
}

// Show skeleton loaders
function showSkeletons() {
  if (!listingsGrid) return;
  listingsGrid.innerHTML = Array(8).fill(0).map(() => `<div class="skeleton-card skeleton" style="height:280px;border-radius:var(--radius-lg);"></div>`).join('');
}

// Toggle mobile sidebar
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('mobile-open');
}

// Filter functions
export function selectCategory(btn, cat) {
  document.querySelectorAll('#category-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = cat;
  applyFilters();
}

export function selectCondition(btn, cond) {
  document.querySelectorAll('#condition-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  activeCondition = cond;
  applyFilters();
}

export function selectType(btn, type) {
  document.querySelectorAll('#type-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  activeType = type;
  applyFilters();
}

export function onPriceSlider(slider) {
  const valSpan = document.getElementById('price-slider-val');
  if (valSpan) valSpan.textContent = '$' + slider.value;
  if (priceMaxInput) priceMaxInput.value = slider.value;
  applyFilters();
}

export function resetFilters() {
  activeCategory = 'all';
  activeCondition = 'all';
  activeType = 'all';
  searchQuery = '';
  
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  if (priceMinInput) priceMinInput.value = '';
  if (priceMaxInput) priceMaxInput.value = '';
  if (priceSlider) priceSlider.value = 2000;
  if (fairOnlyCheckbox) fairOnlyCheckbox.checked = false;
  if (featuredOnlyCheckbox) featuredOnlyCheckbox.checked = false;
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

// Carousel event listeners setup
document.addEventListener('click', (e) => {
  const prevBtn = e.target.closest('.carousel-btn.prev');
  const nextBtn = e.target.closest('.carousel-btn.next');
  const dot = e.target.closest('.carousel-dot');
  
  if (prevBtn) {
    const carouselId = prevBtn.dataset.carousel;
    changeSlide(carouselId, -1);
  }
  if (nextBtn) {
    const carouselId = nextBtn.dataset.carousel;
    changeSlide(carouselId, 1);
  }
  if (dot) {
    const carouselId = dot.closest('.carousel-dots')?.id?.replace('-dots', '');
    const index = parseInt(dot.dataset.index);
    if (carouselId) goToSlide(carouselId, index);
  }
});

function changeSlide(carouselId, direction) {
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
    dotElements.forEach((dot, idx) => {
      dot.style.background = idx === newIndex ? 'var(--neon)' : 'rgba(255,255,255,0.5)';
    });
  }
}

function goToSlide(carouselId, index) {
  const slides = document.getElementById(`${carouselId}-slides`);
  const dots = document.getElementById(`${carouselId}-dots`);
  if (!slides) return;
  
  slides.style.transform = `translateX(-${index * 100}%)`;
  slides.dataset.currentIndex = index;
  
  if (dots) {
    const dotElements = dots.querySelectorAll('.carousel-dot');
    dotElements.forEach((dot, idx) => {
      dot.style.background = idx === index ? 'var(--neon)' : 'rgba(255,255,255,0.5)';
    });
  }
}

// Expose filter functions to window for onclick handlers
window.selectCategory = selectCategory;
window.selectCondition = selectCondition;
window.selectType = selectType;
window.onPriceSlider = onPriceSlider;
window.resetFilters = resetFilters;
window.toggleWishlist = toggleWishlist;
window.openListing = openListing;