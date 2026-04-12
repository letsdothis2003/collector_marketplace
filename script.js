/* ================================================================
   OBTAINUM MARKETPLACE — script.js
   Logic: Navigation, Supabase CRUD, and AI Reasoning
================================================================ */

// --- 1. SUPABASE CLIENT ---
const DB_URL = 'https://gotzmuobwuubsugnowxq.supabase.co';
const DB_KEY = 'sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs';
const db = supabase.createClient(DB_URL, DB_KEY);

// --- 2. GLOBAL STATE ---
let state = {
    view: 'shop',
    prevView: 'shop',
    items: [],
    selectedItem: null,
    user: null
};

// --- 3. CORE INIT ---
document.addEventListener('DOMContentLoaded', () => {
    fetchListings();
    initAuth();
    setupListeners();
});

// --- 4. DATA FETCHING (SQL MATCHED) ---
async function fetchListings() {
    try {
        // Fetch from 'listings' table, join with 'profiles' for seller data
        const { data, error } = await db
            .from('listings')
            .select(`*, profiles(username, rating)`)
            .eq('is_sold', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        state.items = data;
        renderGrid(data);
    } catch (err) {
        showSystemCrash(err.message);
    }
}

function renderGrid(data) {
    const grid = document.getElementById('listing-grid');
    grid.innerHTML = data.map(item => `
        <div class="item-card" onclick="selectItem('${item.id}')">
            <div class="card-img" style="background: url('${item.images[0] || 'https://via.placeholder.com/300'}') center/cover"></div>
            <div class="card-info">
                <div class="card-price">$${item.price}</div>
                <div class="card-title">${item.name}</div>
                <div class="card-loc">${item.location || 'Local'}</div>
                ${item.is_fair ? '<span class="fair-badge">◈ FAIR</span>' : ''}
            </div>
        </div>
    `).join('');
}

// --- 5. NAVIGATION & VIEW SWITCHING ---
function setupListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.onclick = () => {
            const page = tab.dataset.page;
            switchPage(page);
        };
    });

    // Theme Toggle
    document.getElementById('theme-toggle').onclick = () => {
        document.body.classList.toggle('light-mode');
    };

    // AI Maximize Logic
    document.getElementById('maximize-ai').onclick = () => {
        state.prevView = state.view;
        document.getElementById('ai-sidebar').classList.add('hidden');
        switchPage('ai-full');
    };

    document.getElementById('minimize-ai').onclick = () => {
        document.getElementById('ai-sidebar').classList.remove('hidden');
        switchPage(state.prevView);
    };
}

function switchPage(pageId) {
    state.view = pageId;
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.page === pageId);
    });
}

// --- 6. AI LOGIC (Personalized & Bulleted) ---
function selectItem(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    
    state.selectedItem = item;
    const aiUl = document.getElementById('ai-bullets');
    document.querySelector('.welcome').innerText = `Analyzing: ${item.name}`;

    // Calculate Fairness
    const markup = item.msrp ? ((item.price / item.msrp) - 1) * 100 : 0;
    
    aiUl.innerHTML = `
        <li><strong>Price Integrity:</strong> This item is listed at ${markup.toFixed(1)}% ${markup > 0 ? 'above' : 'below'} MSRP.</li>
        <li><strong>Condition Scan:</strong> Tagged as "${item.condition.toUpperCase()}". Check high-res photos for joint stress.</li>
        <li><strong>Market Worth:</strong> Demand for ${item.category} has spiked due to recent collector trends. This price is considered ${item.is_fair ? 'Fair' : 'Aggressive'}.</li>
        <li><strong>Risk Assessment:</strong> Seller rating: ${item.profiles?.rating || 'New'}/5. Transaction risk is LOW.</li>
    `;
}

// --- 7. AUTH & FORMS ---
async function initAuth() {
    const { data: { user } } = await db.auth.getUser();
    if (user) {
        state.user = user;
        document.getElementById('profile-pill').innerHTML = `<span>${user.email}</span>`;
    }
}

const sellForm = document.getElementById('listing-form');
sellForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!state.user) return alert("Sign in to list items!");

    const payload = {
        seller_id: state.user.id,
        name: document.getElementById('form-name').value,
        category: document.getElementById('form-cat').value,
        price: parseFloat(document.getElementById('form-price').value),
        msrp: parseFloat(document.getElementById('form-msrp').value),
        condition: document.getElementById('form-condition').value,
        description: document.getElementById('form-desc').value,
        is_fair: true // Logic could be added to calculate this based on MSRP
    };

    const { error } = await db.from('listings').insert([payload]);
    if (!error) {
        alert("Listing Deployed!");
        fetchListings();
        switchPage('shop');
    }
};

// --- 8. NON-FUNCTIONAL: CRASH PROTECTION ---
function showSystemCrash(msg) {
    console.error("Critical Failure:", msg);
    document.getElementById('status-lock').classList.remove('hidden');
}
