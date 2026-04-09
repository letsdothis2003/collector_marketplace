let allFeatured = [];
let activeSource = 'Marketplace';

async function loadStats() {
  try {
    const listings = await API.getListings();
    const total = listings.length;
    const fair = listings.filter(l => !isScalped(l.price, l.msrp)).length;
    const scalped = total - fair;
    const bar = document.getElementById('stats-bar');
    bar.innerHTML = `
      <div class="stat-item"><div class="stat-num">${total}</div><div class="stat-label">Total Listings</div></div>
      <div class="stat-item"><div class="stat-num">${fair}</div><div class="stat-label">Fair Deals</div></div>
      <div class="stat-item"><div class="stat-num" style="color:#f87171">${scalped}</div><div class="stat-label">Scalped Items</div></div>
      <div class="stat-item"><div class="stat-num">5</div><div class="stat-label">Categories</div></div>
    `;
  } catch {}
}

async function loadFeatured() {
  try {
    allFeatured = await API.getFeaturedListings();
    renderFeatured();
  } catch {
    document.getElementById('featured-grid').innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem">Could not load listings.</p>';
  }
}

function renderFeatured() {
  const grid = document.getElementById('featured-grid');
  const items = activeSource === 'all' ? allFeatured : allFeatured.filter(l => l.source === activeSource);
  grid.innerHTML = '';
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p class="empty-title">No featured listings for this source</p></div>';
    return;
  }
  items.forEach(item => grid.appendChild(buildCard(item, i => window.location = `listing.html?id=${i.id}`)));
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadFeatured();

  const sourceTabs = document.getElementById('source-tabs');
  if (sourceTabs) {
    sourceTabs.addEventListener('click', e => {
      const tab = e.target.closest('.source-tab');
      if (!tab) return;
      document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeSource = tab.dataset.source;
      renderFeatured();
    });
  }
});
