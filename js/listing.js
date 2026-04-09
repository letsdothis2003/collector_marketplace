async function initListing() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;

  try {
    const item = await API.getListing(id);
    renderListing(item);
    showSentiment(item);
  } catch (e) {
    document.getElementById('listing-content').innerHTML = `<p class="empty-title">Listing not found.</p>`;
  }
}

function renderListing(item) {
  const container = document.getElementById('listing-content');
  const scalped = isScalped(item.price, item.msrp);
  
  container.innerHTML = `
    <div class="listing-detail-grid">
      <div class="glass" style="overflow:hidden; border-radius:1rem;">
        ${cardImg(item)}
      </div>
      <div>
        <div class="card-cats" style="margin-bottom:1rem">
          ${sourceBadge(item.source)}
          <span class="source-badge" style="background:rgba(255,255,255,.06);color:var(--muted)">${item.category}</span>
        </div>
        <h1 style="font-size:2rem;font-weight:700;margin-bottom:.5rem">${item.title}</h1>
        <div style="color:var(--muted);font-size:.875rem;margin-bottom:1.5rem">Seller: ${item.seller} · Condition: ${item.condition}</div>
        
        <div class="detail-price ${scalped ? 'scalped' : 'fair'}" style="margin-bottom:.25rem">${fmt(item.price)}</div>
        <div class="detail-msrp">MSRP: ${fmt(item.msrp)} · ${dealBadge(item.price, item.msrp)}</div>
        
        <p class="detail-desc">${item.description}</p>
        
        <div class="detail-actions">
          <button class="btn btn-primary btn-lg" onclick="handleAddToCart(${item.id})">Add to Cart</button>
          <button class="btn btn-outline btn-lg" onclick="handleWatchItem(${item.id})">Watch Item</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('ai-section').style.display = 'block';
}

async function ensureUserForAction() {
  const { data: { session } } = await API.getSession();
  if (session) return true;
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  if (typeof showToast === 'function') {
    showToast('Log in to continue with this item.', true);
  } else {
    alert('Please log in to continue.');
  }
  window.location.href = `login.html?redirect=${redirect}`;
  return false;
}

async function handleAddToCart(listingId) {
  if (!(await ensureUserForAction())) return;
  await API.addToCart(listingId);
  if (typeof showToast === 'function') {
    showToast('Item added to your cart.');
  } else {
    alert('Item added to your cart.');
  }
}

async function handleWatchItem(listingId) {
  if (!(await ensureUserForAction())) return;
  if (typeof showToast === 'function') {
    showToast('Item added to your watch list.');
  } else {
    alert('Item added to your watch list.');
  }
}

async function showSentiment(item) {
  const sentiment = document.getElementById('market-sentiment');
  // High demand sentiment for specific categories
  if (['Toys', 'Trading Cards', 'Shoes'].includes(item.category)) {
    sentiment.style.display = 'block';
  }
}

async function generateReport() {
  if (!(await ensureUserForAction())) return;

  const btn = document.getElementById('generate-btn');
  const content = document.getElementById('ai-report-content');
  const params = new URLSearchParams(location.search);
  
  btn.disabled = true;
  btn.innerHTML = '<div class="ai-typing"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div>';
  
  try {
    const advice = await API.getAIAdvice(params.get('id'));
    content.innerHTML = `
      <div class="ai-report">
        <div class="ai-rating" style="margin-bottom:1rem">
          <div class="rating-dot rating-${advice.rating}"></div>
          <span style="font-weight:800;text-transform:uppercase;font-size:.7rem;letter-spacing:.05em">${advice.rating} Rating</span>
        </div>
        <p style="font-size:.9rem;line-height:1.6;margin-bottom:1.5rem">${advice.priceAnalysis}</p>
        
        <div class="score-bar-wrap">
          <div style="display:flex;justify-content:space-between;font-size:.7rem;font-weight:800;margin-bottom:.4rem;text-transform:uppercase;color:var(--muted)">
            <span>Collectibility Score</span>
            <span>${advice.collectibilityScore}/100</span>
          </div>
          <div class="score-bar">
            <div class="score-fill" style="width:${advice.collectibilityScore}%"></div>
          </div>
        </div>
        
        <div class="glass" style="padding:1.25rem;margin-top:2rem;background:rgba(16,185,129,.04);border-color:rgba(16,185,129,.1)">
          <div style="font-size:.65rem;font-weight:800;text-transform:uppercase;color:var(--primary);margin-bottom:.35rem;letter-spacing:.1em">AI Recommendation</div>
          <div style="font-size:.85rem;line-height:1.5">${advice.recommendation}</div>
        </div>
      </div>
    `;
    btn.style.display = 'none';
  } catch (err) {
    content.innerHTML = `<p style="color:var(--red);font-size:.8rem">Failed to generate report. Please check your connection.</p>`;
    btn.disabled = false;
    btn.textContent = 'Generate Report';
  }
}

initListing();