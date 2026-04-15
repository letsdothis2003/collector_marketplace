// ==================== CREATE/EDIT LISTING MODULE ====================
import { getDb, getCurrentUser } from './auth.js';
import { showToast, setLoading } from './utils.js';

let editingListingId = null;
let imageFiles = [];
let keepExistingImages = [];

const CATEGORIES = [
  'Collectibles',
  'Electronics',
  'Clothing & Accessories',
  'Toys & Figures',
  'Sports & Outdoors',
  'Books & Media',
  'Home & Garden',
  'Tools & Equipment',
  'Other'
];

// Initialize create page (exported as initCreatePage for main.js)
export async function initCreatePage() {
  await initCreatePageInternal();
}

async function initCreatePageInternal() {
  const notice = document.getElementById('create-auth-notice');
  const form = document.getElementById('create-form');
  const title = document.getElementById('create-page-title');
  const submitBtn = document.getElementById('create-submit');
  const cancelBtn = document.getElementById('create-cancel');
  
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    if (notice) notice.classList.remove('hidden');
    if (form) form.classList.add('hidden');
    document.getElementById('create-login-btn')?.addEventListener('click', () => window.openAuthModal());
    return;
  }
  
  if (notice) notice.classList.add('hidden');
  if (form) form.classList.remove('hidden');
  
  if (form) form.reset();
  imageFiles = [];
  keepExistingImages = [];
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
  
  // Populate categories
  populateCategories();
  updateSubcategories();
  
  // Check if editing
  editingListingId = window.editingListingId;
  delete window.editingListingId;
  
  if (editingListingId) {
    if (title) title.textContent = '✏️ EDIT LISTING';
    if (submitBtn) submitBtn.textContent = 'SAVE CHANGES';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    
    const db = getDb();
    try {
      const { data: listing, error } = await db
        .from('listings')
        .select('*')
        .eq('id', editingListingId)
        .single();
      
      if (error) throw error;
      
      // Populate form
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
        keepExistingImages = [...listing.images];
        if (existingSection) existingSection.classList.remove('hidden');
        if (existingGrid) {
          existingGrid.innerHTML = '';
          listing.images.forEach((url, i) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item animate-pop';
            item.innerHTML = `
              <img src="${escapeHtml(url)}" alt="Image ${i + 1}" />
              <button class="remove-image" data-index="${i}" title="Remove">&times;</button>
            `;
            existingGrid.appendChild(item);
          });
          existingGrid.querySelectorAll('.remove-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const idx = parseInt(btn.dataset.index);
              removeExistingImage(idx);
            });
          });
        }
      }
      
      updateDescCounter();
    } catch (err) {
      showToast('Could not load listing for editing.', 'error');
      editingListingId = null;
      if (title) title.textContent = '+ CREATE LISTING';
      if (submitBtn) submitBtn.textContent = 'PUBLISH LISTING';
      if (cancelBtn) cancelBtn.style.display = 'none';
    }
  } else {
    if (title) title.textContent = '+ CREATE LISTING';
    if (submitBtn) submitBtn.textContent = 'PUBLISH LISTING';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
  
  // Set up image upload
  const uploadZone = document.getElementById('upload-zone');
  const imageInput = document.getElementById('image-input');
  if (uploadZone) {
    uploadZone.addEventListener('click', () => imageInput?.click());
  }
  if (imageInput) {
    imageInput.addEventListener('change', handleImageUpload);
  }
  
  // Description counter
  const descTextarea = document.getElementById('c-desc');
  if (descTextarea) descTextarea.addEventListener('input', updateDescCounter);
  
  // Category change
  const categorySelect = document.getElementById('c-category');
  if (categorySelect) categorySelect.addEventListener('change', updateSubcategories);
  
  // Cancel button
  if (cancelBtn) cancelBtn.addEventListener('click', () => cancelEdit());
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function populateCategories() {
  const categorySelect = document.getElementById('c-category');
  if (!categorySelect) return;
  
  // Clear existing options except the placeholder
  categorySelect.innerHTML = '<option value="">Select category...</option>';
  
  // Add all categories
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
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
  keepExistingImages.splice(index, 1);
  const existingGrid = document.getElementById('existing-image-grid');
  const existingSection = document.getElementById('existing-images-section');
  if (!existingGrid) return;
  
  if (keepExistingImages.length === 0) {
    if (existingSection) existingSection.classList.add('hidden');
    return;
  }
  
  existingGrid.innerHTML = '';
  keepExistingImages.forEach((url, i) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item animate-pop';
    item.innerHTML = `
      <img src="${escapeHtml(url)}" alt="Image ${i + 1}" />
      <button class="remove-image" data-index="${i}" title="Remove">&times;</button>
    `;
    existingGrid.appendChild(item);
  });
  existingGrid.querySelectorAll('.remove-image').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.dataset.index);
      removeExistingImage(idx);
    });
  });
}

export function cancelEdit() {
  editingListingId = null;
  imageFiles = [];
  keepExistingImages = [];
  window.navigate?.('shop');
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const maxImages = 10;
  const usedSlots = keepExistingImages.length + imageFiles.length;
  const remaining = maxImages - usedSlots;
  const newFiles = files.slice(0, remaining);
  
  newFiles.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    imageFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, imageFiles.length - 1);
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
    <button class="remove-image" data-index="${index}" title="Remove">&times;</button>
  `;
  grid.appendChild(item);
  
  const removeBtn = item.querySelector('.remove-image');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => removeImage(parseInt(removeBtn.dataset.index)));
  }
}

function removeImage(index) {
  imageFiles.splice(index, 1);
  renderImagePreviews();
}

function renderImagePreviews() {
  const grid = document.getElementById('image-preview-grid');
  if (!grid) return;
  grid.innerHTML = '';
  imageFiles.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, i);
    reader.readAsDataURL(file);
  });
}

async function uploadImages(userId) {
  const db = getDb();
  const urls = [];
  for (const file of imageFiles) {
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

export async function submitListing(e) {
  e.preventDefault();
  const currentUser = getCurrentUser();
  const db = getDb();
  
  if (!currentUser) {
    window.openAuthModal();
    return;
  }
  
  const isEditing = !!editingListingId;
  const errEl = document.getElementById('create-error');
  const btn = document.getElementById('create-submit');
  if (errEl) errEl.classList.remove('show');
  if (btn) setLoading(btn, true, isEditing ? 'SAVING...' : 'PUBLISHING...');
  
  try {
    let newImageUrls = [];
    if (imageFiles.length > 0) {
      newImageUrls = await uploadImages(currentUser.id);
    }
    
    const allImages = [...keepExistingImages, ...newImageUrls];
    
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
      seller_id: currentUser.id,
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
        .eq('id', editingListingId)
        .eq('seller_id', currentUser.id)
        .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;
    } else {
      const { data, error } = await db
        .from('listings')
        .insert(listingData)
        .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;
    }
    
    // Reset form
    document.getElementById('create-form')?.reset();
    imageFiles = [];
    keepExistingImages = [];
    document.getElementById('image-preview-grid').innerHTML = '';
    editingListingId = null;
    
    showToast(isEditing ? 'Listing updated!' : 'Listing published!', 'success');
    window.navigate?.(isEditing ? 'profile' : 'shop');
    
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