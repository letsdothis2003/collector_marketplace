/* =========================================================
   1. DATABASE CONFIGURATION & INITIALIZATION
   ========================================================= */
const SUPABASE_CONFIG = Object.freeze({
    url: 'https://gotzmuobwuubsugnowxq.supabase.co',
    anonKey: 'sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs',
    options: {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'obtainum-auth-token',
            storage: window.localStorage,
            flowType: 'pkce'
        },
        global: {
            headers: { 'x-application-name': 'obtainum-engine' },
        },
    }
});

let _supabase = null;

const getDB = () => {
    if (!_supabase) {
        _supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, SUPABASE_CONFIG.options);
    }
    return _supabase;
};

/* =========================================================
   2. MARKETPLACE ENGINE (Fetch & Display)
   ========================================================= */
let allListings = [];

async function refreshStore() {
    const db = getDB();
    // Fetching 'name' instead of 'title' to match your SQL schema
    const { data, error } = await db
        .from('listings')
        .select(`*, profiles:seller_id (username, rating)`)
        .eq('is_sold', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Database Fetch Error:", error.message);
        return;
    }

    allListings = data;
    renderGrid(allListings);
}

function renderGrid(items) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #6b7280;">No active listings found.</p>`;
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="card">
            <div style="position: relative;">
                <div style="height:150px; background:#e5e7eb; border-radius:8px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-weight:bold;">
                    ${item.category}
                </div>
                ${item.is_fair ? '<span style="position:absolute; top:8px; right:8px; background:#10b981; color:white; padding:2px 8px; border-radius:12px; font-size:0.65rem; font-weight:800;">FAIR PRICE</span>' : ''}
            </div>
            <h3 style="margin:0 0 5px 0; font-size:1.1rem;">${item.name}</h3>
            <p style="font-weight:bold; color:var(--primary); margin:0;">$${item.price}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <small style="color:#6b7280;">${item.condition.toUpperCase()}</small>
                <small style="color:#9ca3af;">By ${item.profiles?.username || 'Member'}</small>
            </div>
            <button class="btn-primary" style="width:100%; margin-top:12px; font-size:0.85rem;">View Listing</button>
        </div>
    `).join('');
}

/* =========================================================
   3. AUTHENTICATION & LISTING SUBMISSION
   ========================================================= */
const modal = document.getElementById('sellModal');

// Open Modal logic
document.getElementById('openSellModal').onclick = async () => {
    const { data: { user } } = await getDB().auth.getUser();
    if (!user) {
        alert("Please login to create a listing.");
        return;
    }
    modal.style.display = 'flex';
};

document.getElementById('closeModal').onclick = () => modal.style.display = 'none';

// Form Submit Logic (Maps to your SQL schema)
document.getElementById('sellForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitListing');
    btn.disabled = true;
    btn.innerText = "Syncing with DB...";

    const db = getDB();
    const { data: { user } } = await db.auth.getUser();

    const price = parseFloat(document.getElementById('itemPrice').value);
    const msrp = parseFloat(document.getElementById('itemMsrp').value);

    const listingPayload = {
        seller_id: user.id, // Links to your profiles table
        name: document.getElementById('itemTitle').value,
        category: document.getElementById('itemCategory').value,
        price: price,
        msrp: msrp,
        description: document.getElementById('itemDescription').value,
        condition: document.getElementById('itemCondition').value,
        is_fair: price <= msrp, // Automated fairness logic
        type: 'buy-now',
        shipping: 'local'
    };

    const { error } = await db.from('listings').insert([listingPayload]);

    if (!error) {
        modal.style.display = 'none';
        document.getElementById('sellForm').reset();
        await refreshStore(); // Instant UI update
    } else {
        alert("SQL Error: " + error.message);
    }

    btn.disabled = false;
    btn.innerText = "Post Listing";
};

/* =========================================================
   4. UTILITIES & INITIALIZATION
   ========================================================= */
document.getElementById('searchInput').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allListings.filter(l => l.name.toLowerCase().includes(query));
    renderGrid(filtered);
});

async function init() {
    const db = getDB();
    const authBtn = document.getElementById('authBtn');

    // Update Auth Button State
    const updateAuthUI = (user) => {
        authBtn.innerText = user ? 'Logout' : 'Login';
        authBtn.onclick = user 
            ? () => db.auth.signOut() 
            : () => db.auth.signInWithOAuth({ provider: 'google' });
    };

    // Check current session
    const { data: { user } } = await db.auth.getUser();
    updateAuthUI(user);

    // Listen for auth changes
    db.auth.onAuthStateChange((_event, session) => updateAuthUI(session?.user));

    // Load the store
    refreshStore();
}

init();
