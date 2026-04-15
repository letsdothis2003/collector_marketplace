// ==================== WISHLIST MODULE ====================
import { getDb, getCurrentUser } from './auth.js';
import { showToast } from './utils.js';
import { openListing } from './detail.js';

export let wishlistIds = new Set();

// Initialize wishlist page
export async function initWishlist() {
  await loadWishlist();
}

// Load wishlist IDs for current user
export async function loadWishlistIds() {
  const db = getDb();
  const user = getCurrentUser();
  if (!user) return;
  
  const { data } = await db
    .from('wishlists')
    .select('listing_id')
    .eq('user_id', user.id);
  wishlistIds = new Set((data || []).map(w => w.listing_id));
}

// Load wishlist page
export async function loadWishlist() {
  const container = document.getElementById('wishlist-grid');
  const notice = document.getElementById('wishlist-auth-notice');
  const user = getCurrentUser();
  
  if (!user) {
    if (notice) notice.classList.remove('hidden');
    if (container) container.innerHTML = '';
    document.getElementById('wishlist-login-btn')?.addEventListener('click', () => window.openAuthModal());
    return;
  }
  
  if (notice) notice.classList.add('hidden');
  
  const db = getDb();
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
      .eq('user_id', user.id);
    
    if (error) throw error;
    
    const listings = (data || []).map(w => w.listings).filter(Boolean);
    if (container) {
      if (listings.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><div class="empty-title">YOUR WISHLIST IS EMPTY</div><div class="empty-sub">Heart items in the marketplace to save them here.</div></div>`;
      } else {
        container.innerHTML = '';
        listings.forEach(l => container.appendChild(createListingCard(l)));
      }
    }
  } catch (err) {
    console.error('Error loading wishlist:', err);
  }
}

// Toggle item in wishlist
export async function toggleWishlist(listingId) {
  const user = getCurrentUser();
  const db = getDb();
  
  if (!user) {
    window.openAuthModal();
    return;
  }
  
  const isWished = wishlistIds.has(listingId);
  
  try {
    if (isWished) {
      await db.from('wishlists').delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);
      wishlistIds.delete(listingId);
      showToast('Removed from wishlist.', 'info');
    } else {
      await db.from('wishlists').insert({
        user_id: user.id,
        listing_id: listingId
      });
      wishlistIds.add(listingId);
      showToast('Added to wishlist!', 'success');
    }
  } catch (err) {
    showToast('Could not update wishlist.', 'error');
  }
}