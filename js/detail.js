// ==================== DETAIL MODULE ====================
import { getDb, getCurrentUser, getCurrentProfile } from './auth.js';
import { showToast, escHtml, formatPrice, getCategoryIcon, paymentIcons, conditionLabels } from './utils.js';
import { toggleWishlist, loadWishlistIds } from './wishlist.js';
import { startChat } from './messages.js';
import { navigate } from './main.js';

let currentListing = null;
let currentListingId = null;

// Initialize detail page
export async function initDetail() {
  // Detail page is loaded on demand via openListing()
  // This init is called when the page is loaded, but rendering happens in openListing
  if (currentListingId) {
    await openListing(currentListingId);
  }
}

// Open listing detail view
export async function openListing(listingId) {
  currentListingId = listingId;
  await navigate('detail');
  
  const content = document.getElementById('detail-content');
  if (content) content.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';
  
  const db = getDb();
  try {
    const { data: listing, error } = await db
      .from('listings')
      .select('*, profiles:seller_id(id, username, avatar_url, rating, location, bio)')
      .eq('id', listingId)
      .single();
    
    if (error) throw error;
    currentListing = listing;
    
    // Increment view count
    try {
      await db.rpc('increment_view_count', { listing_id: listingId });
    } catch (rpcErr) {
      console.warn('RPC function not found');
    }
    
    renderDetail(listing);
    loadSimilarItems(listing);
    
    // Generate AI suggestion if not already present
    if (!listing.ai_suggestions) {
      const { generateAndSaveListingSuggestion } = await import('./assistant.js');
      generateAndSaveListingSuggestion(listingId);
    }
  } catch (err) {
    console.error('Detail error:', err);
    if (content) content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">LISTING NOT FOUND</div></div>`;
  }
}

// Render detail view
export function renderDetail(listing) {
  const content = document.getElementById('detail-content');
  if (!content) return;
  
  const seller = listing.profiles || {};
  const currentUser = getCurrentUser();
  const isOwner = currentUser && currentUser.id === listing.seller_id;
  
  // Load wishlist status
  loadWishlistIds().then(() => {
    const isWished = window.wishlistIds?.has(listing.id);
    const wishlistBtn = document.getElementById('detail-wish-btn');
    if (wishlistBtn && isWished !== undefined) {
      wishlistBtn.innerHTML = isWished ? '❤️ REMOVE FROM WISHLIST' : '🤍 ADD TO WISHLIST';
      wishlistBtn.classList.toggle('active', isWished);
    }
  });
  
  // Image handling
  let imagesHtml = '';
  if (listing.images && listing.images.length > 0) {
    if (listing.images.length === 1) {
      imagesHtml = `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" style="width:100%;border-radius:var(--radius-lg);" id="main-detail-img" />`;
    } else {
      const detailCarouselId = `detail-carousel-${listing.id}`;
      imagesHtml = `
        <div class="image-carousel" id="${detailCarouselId}" style="position:relative;">
          <div class="carousel-slides" id="${detailCarouselId}-slides" style="display:flex;transition:transform 0.3s ease;">
            ${listing.images.map((img, idx) => `
              <div class="carousel-slide" style="min-width:100%;">
                <img src="${escHtml(img)}" alt="Image ${idx + 1}" style="width:100%;border-radius:var(--radius-lg);" />
              </div>
            `).join('')}
          </div>
          <button class="carousel-btn prev" data-carousel="${detailCarouselId}" style="position:absolute;top:50%;left:10px;transform:translateY(-50%);background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:36px;height:36px;color:white;cursor:pointer;z-index:10;">‹</button>
          <button class="carousel-btn next" data-carousel="${detailCarouselId}" style="position:absolute;top:50%;right:10px;transform:translateY(-50%);background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:36px;height:36px;color:white;cursor:pointer;z-index:10;">›</button>
          <div class="carousel-dots" id="${detailCarouselId}-dots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;">
            ${listing.images.map((_, idx) => `<span class="carousel-dot" data-index="${idx}" style="width:8px;height:8px;border-radius:50%;background:${idx === 0 ? 'var(--neon)' : 'rgba(255,255,255,0.5)'};cursor:pointer;"></span>`).join('')}
          </div>
          <div class="image-count-badge" style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:12px;font-size:11px;color:var(--neon);z-index:10;">${listing.images.length} images</div>
        </div>
      `;
      setTimeout(() => {
        const slides = document.getElementById(`${detailCarouselId}-slides`);
        if (slides) slides.dataset.currentIndex = '0';
      }, 100);
    }
  } else {
    imagesHtml = `<div class="card-no-image" style="display:flex;align-items:center;justify-content:center;height:300px;font-size:5rem;background:var(--bg-3);border-radius:var(--radius-lg);">${getCategoryIcon(listing.category)}<br><span style="font-size:0.8rem;margin-top:10px;">No images</span></div>`;
  }
  
  // Payment methods
  const paymentMethodsList = listing.payment_methods && listing.payment_methods.length > 0
    ? listing.payment_methods.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' · ')
    : 'Cash';
  
  // Actions based on ownership
  let actionsHtml;
  if (isOwner) {
    actionsHtml = `
      <button class="btn btn-outline" id="edit-listing-btn">✏️ EDIT LISTING</button>
      ${!listing.is_sold ? `<button class="btn btn-primary" id="mark-sold-btn">✅ MARK AS SOLD</button>` : ''}
      <button class="btn btn-danger" id="delete-listing-btn">❌ DELETE</button>
    `;
  } else {
    const contactBtn = currentUser 
      ? `<button class="btn btn-primary btn-lg" id="contact-seller-btn">💬 CONTACT SELLER</button>`
      : `<button class="btn btn-primary btn-lg" id="login-to-contact-btn">🔐 LOGIN TO CONTACT</button>`;
    
    const wishlistBtn = currentUser 
      ? `<button class="btn btn-outline wishlist-btn" id="detail-wish-btn">🤍 ADD TO WISHLIST</button>`
      : `<button class="btn btn-outline" id="login-to-wishlist-btn">🤍 LOGIN TO SAVE</button>`;
    
    actionsHtml = `${contactBtn}${wishlistBtn}`;
  }
  
  // Calculate savings percentage
  const savings = listing.msrp && listing.price < listing.msrp
    ? Math.round((1 - listing.price / listing.msrp) * 100)
    : null;
  
  content.innerHTML = `
    <div class="detail-grid" style="display:grid;grid-template-columns:1fr 400px;gap:32px;">
      <div class="detail-images">${imagesHtml}</div>
      <div class="detail-info">
        ${listing.is_sold ? '<div class="sold-banner" style="background:var(--danger);padding:8px;text-align:center;border-radius:8px;margin-bottom:16px;">SOLD</div>' : ''}
        <h1 class="detail-title" style="font-size:1.6rem;font-weight:700;margin-bottom:8px;">${escHtml(listing.name)}</h1>
        ${listing.subcategory ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">${escHtml(listing.category)} › ${escHtml(listing.subcategory)}</div>` : ''}
        
        <div class="detail-price-row" style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
          <span class="detail-price" style="font-family:'Orbitron',sans-serif;font-size:2rem;font-weight:900;color:var(--neon);">${formatPrice(listing.price)}</span>
          ${listing.msrp ? `<span class="detail-msrp" style="text-decoration:line-through;color:var(--text-muted);">${formatPrice(listing.msrp)} MSRP</span>` : ''}
          ${savings ? `<span class="detail-savings" style="color:var(--neon);background:rgba(0,255,65,0.1);padding:3px 8px;border-radius:20px;font-size:0.82rem;">${savings}% BELOW MSRP</span>` : ''}
        </div>
        
        <div class="detail-badges" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          <span class="badge" style="border-color:var(--blue);color:var(--blue);padding:4px 10px;border-radius:4px;font-size:0.75rem;">${conditionLabels[listing.condition] || listing.condition}</span>
          <span class="badge" style="border-color:var(--border-bright);color:var(--neon);padding:4px 10px;border-radius:4px;font-size:0.75rem;">${listing.type?.replace(/-/g, ' ').toUpperCase() || 'BUY NOW'}</span>
          <span class="badge" style="border-color:var(--text-muted);color:var(--text-muted);padding:4px 10px;border-radius:4px;font-size:0.75rem;">📦 ${listing.shipping?.toUpperCase() || 'PAID'}</span>
          ${listing.is_fair ? '<span class="badge" style="border-color:var(--neon);color:var(--neon);padding:4px 10px;border-radius:4px;font-size:0.75rem;">✓ AI FAIR PRICE</span>' : ''}
        </div>
        
        <div class="detail-meta-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
          ${listing.location ? `<div class="detail-meta-item" style="background:var(--bg-2);padding:10px;border-radius:8px;"><strong>📍 Location</strong><br>${escHtml(listing.location)}</div>` : ''}
          <div class="detail-meta-item" style="background:var(--bg-2);padding:10px;border-radius:8px;"><strong>💳 Payment Methods</strong><br>${paymentMethodsList}</div>
          <div class="detail-meta-item" style="background:var(--bg-2);padding:10px;border-radius:8px;"><strong>👁️ Views</strong><br>${listing.view_count || 0}</div>
          <div class="detail-meta-item" style="background:var(--bg-2);padding:10px;border-radius:8px;"><strong>❤️ Favorites</strong><br>${listing.favorite_count || 0}</div>
          <div class="detail-meta-item" style="background:var(--bg-2);padding:10px;border-radius:8px;"><strong>📅 Listed</strong><br>${new Date(listing.created_at).toLocaleDateString()}</div>
          <div class="detail-meta-item" style="background:var(--bg-2);padding:10px;border-radius:8px;"><strong>⏰ Expires</strong><br>${listing.expires_at ? new Date(listing.expires_at).toLocaleDateString() : 'N/A'}</div>
        </div>
        
        <div class="detail-description" style="background:var(--bg-2);padding:16px;border-radius:8px;margin:16px 0;line-height:1.6;">
          ${escHtml(listing.description)}
        </div>
        
        ${listing.tags && listing.tags.length > 0 ? `
          <div class="detail-tags" style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;">
            ${listing.tags.map(t => `<span class="tag-chip" style="background:var(--bg-3);padding:4px 10px;border-radius:20px;font-size:0.75rem;">#${escHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="seller-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:14px;display:flex;align-items:center;gap:12px;margin:16px 0;">
          <div class="seller-avatar" style="width:42px;height:42px;border-radius:50%;background:var(--bg-3);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0;">
            ${seller.username?.charAt(0) || '?'}
          </div>
          <div style="flex:1;">
            <div class="seller-name" style="font-weight:600;">${escHtml(seller.username || 'Anonymous')}</div>
            ${seller.rating > 0 ? `<div class="seller-rating" style="color:var(--warning);font-size:0.78rem;">⭐ ${parseFloat(seller.rating).toFixed(1)}</div>` : ''}
            ${seller.location ? `<div class="seller-location" style="font-size:0.78rem;color:var(--text-muted);">📍 ${escHtml(seller.location)}</div>` : ''}
          </div>
          <button class="btn btn-outline btn-sm" id="view-seller-profile">View Profile</button>
        </div>
        
        <div class="detail-actions" style="display:flex;flex-direction:column;gap:10px;">${actionsHtml}</div>
        
        <div id="ai-suggestions-${listing.id}" style="margin-top:20px;">
          <div style="text-align:center; padding:20px;">
            <div class="spinner"></div> Loading AI analysis...
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  document.getElementById('back-to-shop')?.addEventListener('click', () => navigate('shop'));
  document.getElementById('edit-listing-btn')?.addEventListener('click', () => editListing(listing.id));
  document.getElementById('mark-sold-btn')?.addEventListener('click', () => openMarkSoldModal(listing.id));
  document.getElementById('delete-listing-btn')?.addEventListener('click', () => deleteListing(listing.id));
  document.getElementById('contact-seller-btn')?.addEventListener('click', () => startChat(listing.seller_id, listing.id));
  document.getElementById('login-to-contact-btn')?.addEventListener('click', () => window.openAuthModal());
  document.getElementById('detail-wish-btn')?.addEventListener('click', (e) => toggleWishlist(listing.id));
  document.getElementById('login-to-wishlist-btn')?.addEventListener('click', () => window.openAuthModal());
  document.getElementById('view-seller-profile')?.addEventListener('click', () => viewSellerProfile(listing.seller_id));
  document.getElementById('route-safety-btn')?.addEventListener('click', () => {
    document.getElementById('pickup-location').value = listing.location || '';
    window.openModal('route-modal');
  });
  
  // Load AI suggestion
  setTimeout(async () => {
    const { displayListingSuggestion } = await import('./assistant.js');
    displayListingSuggestion(listing.id);
  }, 500);
}

// View seller profile
export function viewSellerProfile(sellerId) {
  window.selectedProfileId = sellerId;
  navigate('profile');
}

// Edit listing
export async function editListing(listingId) {
  window.editingListingId = listingId;
  navigate('create');
}

// Delete listing
export async function deleteListing(listingId) {
  if (!confirm('Are you sure you want to permanently delete this listing? This cannot be undone.')) return;
  
  const db = getDb();
  const currentUser = getCurrentUser();
  
  try {
    const { error } = await db
      .from('listings')
      .delete()
      .eq('id', listingId)
      .eq('seller_id', currentUser.id);
    if (error) throw error;
    
    showToast('Listing deleted.', 'success');
    navigate('profile');
  } catch (err) {
    console.error('Error deleting listing:', err);
    showToast('Failed to delete listing: ' + err.message, 'error');
  }
}

// Mark as sold modal
export function openMarkSoldModal(listingId) {
  const input = document.getElementById('mark-sold-listing-id');
  if (input) input.value = listingId;
  window.openModal('mark-sold-modal');
}

// Confirm mark as sold
export async function confirmMarkSold() {
  const listingId = document.getElementById('mark-sold-listing-id')?.value;
  const currentUser = getCurrentUser();
  const db = getDb();
  
  if (!listingId || !currentUser) return;
  
  try {
    const { error } = await db
      .from('listings')
      .update({ 
        is_sold: true, 
        sold_at: new Date().toISOString(),
        sold_to: currentUser.id
      })
      .eq('id', listingId)
      .eq('seller_id', currentUser.id);
    
    if (error) throw error;
    
    window.closeModal('mark-sold-modal');
    showToast('Listing marked as sold!', 'success');
    navigate('profile');
  } catch (err) {
    console.error('Error marking as sold:', err);
    showToast('Failed to mark as sold: ' + err.message, 'error');
  }
}

// Load similar items
async function loadSimilarItems(listing) {
  const scroll = document.getElementById('similar-scroll');
  if (!scroll) return;
  scroll.innerHTML = '<div style="padding:20px;">Loading...</div>';
  
  const db = getDb();
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
    const { createListingCard } = await import('./shop.js');
    items.forEach(l => scroll.appendChild(createListingCard(l)));
  } catch (err) {
    const section = document.getElementById('similar-section');
    if (section) section.style.display = 'none';
  }
}