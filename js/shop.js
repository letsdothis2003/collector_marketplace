let allListings = [];
let activeCategories = new Set();
let activeFulfillments = new Set();
let sortMode = 'newest';
let searchVal = '';
let searchDebounce;

// --- CONSTANTS ---
const CATEGORIES = ['Toys', 'Electronics', 'Clothing', 'Shoes', 'Trading Cards', 'Other'];
const FULFILLMENTS = [
    { id: 'shipping', label: 'Shipping Available' },
    { id: 'local_pickup', label: 'Local Pickup' },
    { id: 'trade', label: 'Open to Trades' },
];

// --- CORE FUNCTIONS ---

async function initShop() {
    await API.ready;
    renderFilters();
    addEventListeners();
    await fetchListings();
}

async function fetchListings() {
    try {
        allListings = await API.getListings();
        renderGrid();
    } catch (err) {
        console.error("Failed to load listings:", err);
        document.getElementById('shop-grid').innerHTML = '<p class="error-text">Failed to load listings.</p>';
    }
}

function getFilteredAndSorted() {
    const filtered = allListings
        .filter(l => {
            const searchMatch = !searchVal || l.title.toLowerCase().includes(searchVal.toLowerCase());
            const categoryMatch = activeCategories.size === 0 || activeCategories.has(l.category);
            const fulfillmentMatch = activeFulfillments.size === 0 || [...activeFulfillments].every(f => l[f]);
            return searchMatch && categoryMatch && fulfillmentMatch;
        });

    return filtered.sort((a, b) => {
        switch (sortMode) {
            case 'price_asc': return Number(a.price) - Number(b.price);
            case 'price_desc': return Number(b.price) - Number(a.price);
            case 'newest':
            default: return new Date(b.created_at) - new Date(a.created_at);
        }
    });
}

// --- RENDERING FUNCTIONS ---

function renderGrid() {
    const grid = document.getElementById('shop-grid');
    const noResults = document.getElementById('no-results');
    const listings = getFilteredAndSorted();

    grid.innerHTML = '';
    document.getElementById('listing-count').textContent = `${allListings.length} total listing${allListings.length !== 1 ? 's' : ''}`;

    if (listings.length === 0) {
        noResults.style.display = 'block';
    } else {
        noResults.style.display = 'none';
        listings.forEach(item => grid.appendChild(buildCard(item)));
    }
}

function buildCard(item) {
    const card = document.createElement('a');
    card.className = 'listing-card';
    card.href = `listing.html?id=${item.id}`;

    const priceRatio = item.msrp > 0 ? (item.price / item.msrp) : 0;
    let dealBadge = '';
    if (priceRatio > 0 && priceRatio < 0.9) {
        dealBadge = `<div class="deal-badge good">Great Deal</div>`;
    } else if (priceRatio > 1.25) {
        dealBadge = `<div class="deal-badge scalper">High Price</div>`;
    }

    let fulfillmentTags = '';
    if (item.shipping) fulfillmentTags += `<div class="tag">Shipping</div>`;
    if (item.local_pickup) fulfillmentTags += `<div class="tag">Pickup</div>`;
    if (item.trade) fulfillmentTags += `<div class="tag">Trade</div>`;

    card.innerHTML = `
        <div class="card-img" style="background-image: url(${item.image_url || 'img/placeholder.png'})">
            ${dealBadge}
        </div>
        <div class="card-body">
            <h3 class="card-title">${item.title}</h3>
            <div class="card-price">$${Number(item.price).toFixed(2)}</div>
            <div class="card-location">${item.location || 'Location not set'}</div>
            <div class="card-seller">by <strong>${item.seller || 'Anonymous'}</strong></div>
            <div class="card-tags">${fulfillmentTags}</div>
        </div>
    `;
    return card;
}

function renderFilters() {
    const categoryContainer = document.getElementById('category-filters');
    const fulfillmentContainer = document.getElementById('fulfillment-filters');

    categoryContainer.innerHTML = CATEGORIES.map(cat => `
        <label class="filter-item">
            <input type="checkbox" onchange="toggleFilter('category', '${cat}')">
            <span class="filter-label">${cat}</span>
        </label>
    `).join('');

    fulfillmentContainer.innerHTML = FULFILLMENTS.map(ful => `
        <label class="filter-item">
            <input type="checkbox" onchange="toggleFilter('fulfillment', '${ful.id}')">
            <span class="filter-label">${ful.label}</span>
        </label>
    `).join('');
}

// --- EVENT HANDLERS & LISTENERS ---

window.toggleFilter = function(type, value) {
    const targetSet = type === 'category' ? activeCategories : activeFulfillments;
    if (targetSet.has(value)) {
        targetSet.delete(value);
    } else {
        targetSet.add(value);
    }
    renderGrid();
};

window.clearFilters = function() {
    activeCategories.clear();
    activeFulfillments.clear();
    renderFilters(); // Re-render to uncheck all boxes
    renderGrid();
};

function addEventListeners() {
    document.getElementById('shop-search').addEventListener('input', e => {
        clearTimeout(searchDebounce);
        searchVal = e.target.value.trim();
        searchDebounce = setTimeout(renderGrid, 300);
    });

    document.getElementById('shop-sort').addEventListener('change', e => {
        sortMode = e.target.value;
        renderGrid();
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', initShop);
