// ==================== AUTH MODULE - DATABASE & USER MANAGEMENT ====================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { showToast } from './utils.js';

// Initialize Supabase
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
export let currentUser = null;
let currentProfile = null;
let db = null;

// Initialize database client
export function getDb() {
  return supabase;
}

// Get current user state (synchronous - use for UI checks)
export function getCurrentUserSync() {
  return currentUser;
}

// Get current authenticated user (async - use for actual operations)
export async function getCurrentUser() {
  if (currentUser) return currentUser;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    return user;
  } catch (err) {
    console.error('Error getting current user:', err);
    return null;
  }
}

// Get current user's profile
export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (currentProfile) return currentProfile;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting profile:', error);
      return null;
    }
    
    currentProfile = data || null;
    return currentProfile;
  } catch (err) {
    console.error('Profile fetch error:', err);
    return null;
  }
}

// Save/Update profile
export async function saveProfile(updates) {
  const user = await getCurrentUser();
  if (!user) {
    showToast('You must be logged in to save profile', 'error');
    return false;
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...updates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) throw error;
    currentProfile = data;
    return true;
  } catch (err) {
    console.error('Profile save error:', err);
    showToast('Error saving profile: ' + err.message, 'error');
    return false;
  }
}

// Email login
export async function loginEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    currentUser = data.user;
    currentProfile = null; // Reset profile to force reload
    showToast('Logged in successfully!', 'success');
    return true;
  } catch (err) {
    console.error('Login error:', err);
    showToast('Login failed: ' + err.message, 'error');
    return false;
  }
}

// Email registration
export async function registerEmail(email, password, username) {
  try {
    // Sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    });
    
    if (authError) throw authError;
    
    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: username,
        email: email,
        avatar_url: null,
        bio: '',
        created_at: new Date().toISOString()
      });
    
    if (profileError) {
      console.warn('Profile creation warning:', profileError);
    }
    
    currentUser = authData.user;
    currentProfile = null;
    showToast('Account created! Please check your email to verify.', 'success');
    return true;
  } catch (err) {
    console.error('Registration error:', err);
    showToast('Registration failed: ' + err.message, 'error');
    return false;
  }
}

// Google OAuth login/register
export async function loginGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    
    if (error) {
      if (error.message.includes('Only one')) {
        // OAuth redirect - this is normal for Google flow
        return;
      }
      throw error;
    }
    
    currentUser = null;
    currentProfile = null;
    return true;
  } catch (err) {
    console.error('Google login error:', err);
    showToast('Google login failed: ' + err.message, 'error');
    return false;
  }
}

// Sign out
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    currentUser = null;
    currentProfile = null;
    showToast('Logged out successfully', 'success');
    return true;
  } catch (err) {
    console.error('Sign out error:', err);
    showToast('Error logging out: ' + err.message, 'error');
    return false;
  }
}

// Check auth on page load
export async function checkAuthStatus() {
  try {
    const { data: { session } } = await supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        currentUser = session.user;
        await getCurrentProfile();
      } else {
        currentUser = null;
        currentProfile = null;
      }
    });
    
    // Initial check
    const user = await getCurrentUser();
    if (user) {
      await getCurrentProfile();
    }
    
    return user;
  } catch (err) {
    console.error('Auth check error:', err);
    return null;
  }
}

// Listen for auth changes
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    if (!currentUser) {
      currentProfile = null;
    }
    callback(event, session);
  });
}

// Upload image to storage
export async function uploadImage(file, bucket = 'listings') {
  const user = await getCurrentUser();
  if (!user) {
    showToast('You must be logged in to upload images', 'error');
    return null;
  }
  
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    return publicUrl;
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Image upload failed: ' + err.message, 'error');
    return null;
  }
}

// Get listings
export async function getListings(filters = {}) {
  try {
    let query = supabase
      .from('listings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters.condition && filters.condition !== 'all') {
      query = query.eq('condition', filters.condition);
    }
    if (filters.listing_type && filters.listing_type !== 'all') {
      query = query.eq('listing_type', filters.listing_type);
    }
    if (filters.minPrice) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Listings fetch error:', err);
    return [];
  }
}

// Get single listing
export async function getListing(listingId) {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Listing fetch error:', err);
    return null;
  }
}

// Create listing
export async function createListing(listingData) {
  const user = await getCurrentUser();
  if (!user) {
    showToast('You must be logged in to create listings', 'error');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...listingData,
        seller_id: user.id,
        created_at: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    showToast('Listing created successfully!', 'success');
    return data;
  } catch (err) {
    console.error('Create listing error:', err);
    showToast('Error creating listing: ' + err.message, 'error');
    return null;
  }
}

// Update listing
export async function updateListing(listingId, updates) {
  try {
    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', listingId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Update listing error:', err);
    showToast('Error updating listing: ' + err.message, 'error');
    return null;
  }
}

// Delete listing
export async function deleteListing(listingId) {
  try {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId);
    
    if (error) throw error;
    showToast('Listing deleted', 'success');
    return true;
  } catch (err) {
    console.error('Delete listing error:', err);
    showToast('Error deleting listing: ' + err.message, 'error');
    return false;
  }
}
