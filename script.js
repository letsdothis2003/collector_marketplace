

// --- SECTION 1: DATABASE CLIENT (db) ---
const DB_URL = 'https://gotzmuobwuubsugnowxq.supabase.co';
const DB_KEY = 'sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs';
const db = supabase.createClient(DB_URL, DB_KEY);

// --- SECTION 2: APP STATE ---
let appState = {
    activeView: 'shop',
    previousView: 'shop',
    user: null,
    listings: [],
    theme: 'dark',
    integrity: true
};

// --- SECTION 3: SYSTEM INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadMarketplace();
    bindEvents();
});

// --- SECTION 4: AUTHENTICATION (Supabase Auth) ---
async function initAuth() {
    const { data: { user } } = await db.auth.getUser();
    if (user) {
        appState.user = user;
        updateUserUI(user);
    }
}

function updateUserUI(user) {
    const zone = document.getElementById('user-display');
    zone.innerHTML = `<span class="neon-text">ID_${user.email.split('@')[0].toUpperCase()}</span>`;
}

// --- SECTION 5: MARKETPLACE ENGINE ---
async function loadMarketplace() {
    try {
        const { data, error } = await db
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        appState.listings = data;
        renderListings(data);
    } catch (err) {
        triggerSystemHalt(err.message);
    }
}

function renderListings(items) {
    const grid = document.getElementById('listing-grid');
    grid.innerHTML = items.map(item => `
        <div class="item-card" onclick="openItemDetail('${item.id}')">
            <div class="card-header">
                <span class="tag">${item.category}</span>
                <span class="fairness ${item.is_fair ? 'fair' : 'scalp'}">
                    ${item.is_fair ? '◈ FAIR_PRICE' : '⚠ SCALP_ALERT'}
                </span>
            </div>
            <h3>${item.name}</h3>
            <p class="price-line">$${item.price}</p>
            <div class="card-footer">
                <small>LOC: ${item.location || 'GLOBAL'}</small>
            </div>
        </div>
    `).join('');
}

// --- SECTION 6: SELL LOGIC & AI ANALYTICS ---
const listingForm = document.getElementById('listing-form');
listingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!appState.user) return alert("AUTH_REQUIRED: Please login to deploy.");

    const newAsset = {
        seller_id: appState.user.id,
        name: document.getElementById('item_name').value,
        category: document.getElementById('item_category').value,
        price: parseFloat(document.getElementById('item_price').value),
        msrp: parseFloat(document.getElementById('item_msrp').value) || 0,
        description: document.getElementById('item_desc').value,
        condition: 'new', // Static for demo
        is_fair: true 
    };

    // AI FAIRNESS PROTOCOL
    if (newAsset.msrp > 0 && newAsset.price > (newAsset.msrp * 1.25)) {
        newAsset.is_fair = false;
        showAIFeedback("Warning: Price exceeds 25% over MSRP. This will be flagged as a scalp listing.");
    }

    const { error } = await db.from('listings').insert([newAsset]);
    
    if (!error) {
        alert("DEPLOYMENT_SUCCESSFUL");
        switchView('shop');
        loadMarketplace();
    }
});

// --- SECTION 7: AI SIDEBAR INTERACTION ---
const nameInput = document.getElementById('item_name');
nameInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const bullets = document.getElementById('ai-live-bullets');
    
    if (val.includes('transformers') || val.includes('optimus')) {
        bullets.innerHTML = `
            <li>◈ HIGH_DEMAND: Transformers G1 series is currently trending.</li>
            <li>◈ ADVICE: Check joint tightness before shipping.</li>
        `;
    }
});

// --- SECTION 8: NAVIGATION & MAXIMIZE ---
function switchView(viewId) {
    appState.previousView = appState.activeView;
    appState.activeView = viewId;

    document.querySelectorAll('.page-view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`page-${viewId}`).classList.remove('hidden');
}

document.getElementById('maximize-ai').onclick = () => {
    document.getElementById('ai-sidebar').classList.add('hidden');
    switchView('ai-full');
};

document.getElementById('minimize-ai').onclick = () => {
    document.getElementById('ai-sidebar').classList.remove('hidden');
    switchView(appState.previousView);
};

// --- SECTION 9: UTILS (Consistency Check) ---
function triggerSystemHalt(msg) {
    appState.integrity = false;
    document.getElementById('integrity-shield').classList.remove('hidden');
    console.error("CRITICAL_FAIL:", msg);
}

document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('light-mode');
};
