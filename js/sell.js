/**
 * Real-time markup check for the Fairness Meter
 */
function checkMarkup() {
  const price = parseFloat(document.getElementById('price').value) || 0;
  const msrp = parseFloat(document.getElementById('msrp').value) || 0;
  const wrap = document.getElementById('fairness-meter-wrap');
  const fill = document.getElementById('meter-fill');
  const warning = document.getElementById('markup-warning');

  if (price <= 0 || msrp <= 0) {
    wrap.style.display = 'none';
    warning.innerHTML = '';
    return;
  }

  wrap.style.display = 'block';
  const ratio = price / msrp;
  
  // Meter mapping: 0% = $0, 50% = MSRP, 100% = 2x MSRP
  const percent = Math.min(100, (ratio / 2) * 100);
  fill.style.width = percent + '%';

  if (ratio > 1.25) {
    fill.style.backgroundColor = 'var(--red)';
    warning.innerHTML = `<div class="scalper-warn">⚠️ Warning: This price is ${( (ratio-1)*100 ).toFixed(0)}% above MSRP. This may be flagged as scalping.</div>`;
  } else if (ratio > 1.0) {
    fill.style.backgroundColor = 'var(--amber)';
    warning.innerHTML = `<div class="fair-note" style="color:var(--amber);border-color:rgba(245,158,11,.2);background:rgba(245,158,11,.08)">ℹ️ Note: Pricing slightly above MSRP. This is acceptable for rare items.</div>`;
  } else {
    fill.style.backgroundColor = 'var(--primary)';
    warning.innerHTML = `<div class="fair-note">✅ This is a fair deal! Collectors will love this price.</div>`;
  }
}

/**
 * Internal function to handle listing submission
 */
async function submitListing(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Publishing...';

  // TODO: Implement image uploading in api.js and uncomment this.
  // const imageFile = document.getElementById('imageFile').files[0];
  // let imageUrl = null;
  // if (imageFile) { ... }

  const data = {
    title: document.getElementById('title').value,
    price: document.getElementById('price').value,
    msrp: document.getElementById('msrp').value,
    location: document.getElementById('location').value,
    fulfillment: {
        shipping: document.getElementById('shipping').checked,
        local_pickup: document.getElementById('local_pickup').checked,
        trade: document.getElementById('trade').checked
    },
    category: document.getElementById('category').value,
    condition: document.getElementById('condition').value,
    description: document.getElementById('description').value,
    imageUrl: null // Placeholder for now
  };

  try {
    await API.createListing(data);
    document.getElementById('sell-content').innerHTML = `
      <div class="glass success-box">
        <div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h2>Listing Live!</h2>
        <p style="color:var(--muted);margin-bottom:2rem">Your listing has been added to Obtainum.</p>
        <a href="/" class="btn btn-primary">Go to Shop</a>
      </div>
    `;
  } catch (err) {
    alert("Error creating listing: " + err.message);
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/**
 * Public function to handle sell form submission, checks for authentication first.
 */
async function handleSellSubmit(event) {
  event.preventDefault();
  await API.ready; // Wait for API and auth to be initialized
  const user = API.getCurrentUser();

  if (!user) {
    alert('Please log in or sign up to list an item.');
    // Redirect to login page after a short delay
    window.location.href = 'login.html?redirect=sell.html'; 
    return;
  }
  
  submitListing(event); // Proceed with submission if authenticated
}
