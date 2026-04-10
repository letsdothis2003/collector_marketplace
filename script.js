/* =========================================================
   1. DATABASE CONFIGURATION (Frozen Singleton)
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
   2. STORE LOGIC (FETCH & RENDER)
   ========================================================= */
let allListings = [];

async function refreshStore() {
    const db = getDB();
    const grid = document.getElementById('productGrid');
    
    const { data, error } = await db
        .from('listings')
        .select(`*, profiles:seller_id (username, rating)`)
        .eq('is_sold', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Fetch Error:", error.message);
        return;
    }

    allListings = data;
    render(allListings);
}

function render(items) {
    const grid = document.getElementById('productGrid');
    if (items.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #667;">No listings found.</p>`;
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="card">
            <div style="position: relative;">
                <div style="height:150px; background:#e5e7eb; border-radius:8px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#9ca3af;">
                    ${item.category}
                </div>
                ${item.is_fair ? '<span class="fair-badge">FAIR PRICE</span>' : ''}
            </div>
            <h3 style="margin:0 0 5px 0; font-size:1.1rem;">${item.name}</h3>
            <p style="font-weight:bold; color:var(--primary); margin:0;">$${item.price}</p>
            <p style="font-size:0.8rem; color:#6b7280; margin:5px 0;">Seller: ${item.profiles?.username || 'Verified User'}</p>
            <button class="btn-primary" style="width:100%; margin-top:10px; font-size:0.8rem;">View Details</button>
        </div>
    `).join('');
}

/* =========================================================
   3. AUTH & MODAL ACTIONS
   ========================================================= */
const modal = document.getElementById('sellModal');
const openBtn = document.getElementById('openSellModal');

// Modal Toggles
openBtn.onclick = async () => {
    const { data: { user } } = await getDB().auth.getUser();
    if (!user) {
        alert("You must be logged in to sell items.");
        return;
    }
    modal.style.display = 'flex';
};

document.getElementById('closeModal').onclick = () => modal.style.display = 'none';

// Form Submission (Matching your SQL Schema)
document.getElementById('sellForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitListing');
    btn.disabled = true;
    btn.innerText = "Posting...";

    const db = getDB();
    const { data: { user } } = await db.auth.getUser();

    const price = parseFloat(document.getElementById('itemPrice').value);
    const msrp = parseFloat(document.getElementById('itemMsrp').value || price);

    const newEntry = {
        seller_id: user.id,
        name: document.getElementById('itemTitle').value,
        category: document.getElementById('itemCategory').value,
        price: price,
        msrp: msrp,
        description: document.getElementById('itemDescription').value,
        condition: document.getElementById('itemCondition').value,
        is_fair: price <= msrp, // Anti-scalp logic
        type: 'buy-now',
        shipping: 'local'
    };

    const { error } = await db.from('listings').insert([newEntry]);

    if (!error) {
        modal.style.display = 'none';
        document.getElementById('sellForm').reset();
        await refreshStore(); // Instant update
    } else {
        alert("Listing failed: " + error.message);
    }
    
    btn.disabled = false;
    btn.innerText = "Post Listing";
};

/* =========================================================
   4. SEARCH & INITIALIZATION
   ========================================================= */
document.getElementById('searchInput').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allListings.filter(l => l.name.toLowerCase().includes(query));
    render(filtered);
});

async function setupAuth() {
    const db = getDB();
    const authBtn = document.getElementById('authBtn');

    const updateUI = (user) => {
        authBtn.innerText = user ? 'Logout' : 'Login';
        authBtn.onclick = user ? () => db.auth.signOut() : () => db.auth.signInWithOAuth({ provider: 'google' });
    };

    const { data: { user } } = await db.auth.getUser();
    updateUI(user);

    db.auth.onAuthStateChange((_event, session) => updateUI(session?.user));
}

// Initial Load
setupAuth();
refreshStore();
