// ==================== PROFILE MODULE ====================
import { getDb, getCurrentUser, getCurrentProfile, saveProfile as saveProfileAuth, signOut } from './auth.js';
import { showToast, animateNumber, escHtml } from './utils.js';
import { navigate } from './main.js';
import { openListing } from './detail.js';
import { startChat } from './messages.js';

let currentProfileId = null;

// Initialize profile page
export async function initProfile() {
  await loadProfile();
}

// Load profile page
export async function loadProfile() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    window.openAuthModal();
    return;
  }
  
  const profileIdToLoad = window.selectedProfileId || currentUser.id;
  const isOwnProfile = profileIdToLoad === currentUser.id;
  
  delete window.selectedProfileId;
  
  const db = getDb();
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
  
  currentProfileId = profileIdToLoad;
  
  // Update UI elements
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
  
  const editButton = document.getElementById('edit-profile-btn');
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
  
  await loadProfileListings(profileIdToLoad, isOwnProfile);
  
  // Set up settings form values
  if (isOwnProfile) {
    const sUsername = document.getElementById('s-username');
    const sBio = document.getElementById('s-bio');
    const sLocation = document.getElementById('s-location');
    const sPhone = document.getElementById('s-phone');
    const currentProfile = getCurrentProfile();
    
    if (sUsername) sUsername.value = currentProfile?.username || '';
    if (sBio) sBio.value = currentProfile?.bio || '';
    if (sLocation) sLocation.value = currentProfile?.location || '';
    if (sPhone) sPhone.value = currentProfile?.phone || '';
  }
  
  // Show correct tab
  const activeTab = document.querySelector('.profile-tab.active');
  if (activeTab) {
    showProfileTab(activeTab.dataset.ptab);
  } else {
    showProfileTab('my-listings');
  }
  
  // Settings form submit
  const settingsForm = document.getElementById('profile-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProfileSettings();
    });
  }
  
  // Sign out button
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) signoutBtn.addEventListener('click', async () => {
    await signOut();
    navigate('shop');
  });
}

function showProfileTab(tabName) {
  const myListingsDiv = document.getElementById('ptab-my-listings');
  const soldDiv = document.getElementById('ptab-sold');
  const settingsDiv = document.getElementById('ptab-settings');
  
  if (myListingsDiv) myListingsDiv.classList.add('hidden');
  if (soldDiv) soldDiv.classList.add('hidden');
  if (settingsDiv) settingsDiv.classList.add('hidden');
  
  if (tabName === 'my-listings' && myListingsDiv) {
    myListingsDiv.classList.remove('hidden');
  } else if (tabName === 'sold' && soldDiv) {
    soldDiv.classList.remove('hidden');
    if (currentProfileId) loadProfileListings(currentProfileId, true);
  } else if (tabName === 'settings' && settingsDiv) {
    settingsDiv.classList.remove('hidden');
  }
}

export async function loadProfileListings(profileId, isOwnProfile) {
  if (!profileId) return;
  
  const db = getDb();
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
      active.forEach(l => grid.appendChild(createListingCard(l)));
    }
  }
  
  const soldGrid = document.getElementById('profile-sold-grid');
  if (soldGrid) {
    if (sold.length === 0) {
      soldGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">NO SOLD ITEMS YET</div><div class="empty-sub">Items you sell will appear here</div></div>`;
    } else {
      soldGrid.innerHTML = '';
      sold.forEach(l => {
        const card = createListingCard(l);
        card.classList.add('sold-listing-card');
        soldGrid.appendChild(card);
      });
    }
  }
}

async function saveProfileSettings() {
  const username = document.getElementById('s-username')?.value.trim() || '';
  const bio = document.getElementById('s-bio')?.value.trim() || '';
  const location = document.getElementById('s-location')?.value.trim() || null;
  const phone = document.getElementById('s-phone')?.value.trim() || null;
  
  if (username.length < 3) {
    showToast('Username must be at least 3 characters.', 'error');
    return;
  }
  
  try {
    await saveProfileAuth({ username, bio, location, phone });
    await loadProfile(); // Refresh profile display
  } catch (err) {
    showToast('Failed to save profile: ' + err.message, 'error');
  }
}

export function switchProfileTab(btn) {
  const tabName = btn.dataset.ptab;
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  showProfileTab(tabName);
}

export function openEditProfile() {
  const settingsTab = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTab) {
    settingsTab.click();
    settingsTab.scrollIntoView({ behavior: 'smooth' });
  }
}