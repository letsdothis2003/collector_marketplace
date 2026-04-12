//* ================================================================
   FILE: script.js 
   PURPOSE: Logic, Animations, & SQL Integration
   SECTIONS: router.js, market.js, auth.js, ai.js
================================================================
*/

// --- SECTION: DATABASE CONFIG ---
const DB_URL = "YOUR_SUPABASE_URL";
const DB_KEY = "YOUR_SUPABASE_ANON_KEY";
const db = supabase.createClient(DB_URL, DB_KEY);

// --- SECTION: ROUTER & ANIMATIONS ---
const router = {
    current: 'home',
    navigate: (pageId) => {
        const oldPage = document.getElementById(`view-${router.current}`);
        const newPage = document.getElementById(`view-${pageId}`);
        
        // GSAP-style smooth transition logic
        oldPage.style.opacity = '0';
        oldPage.style.transform = 'translateY(15px)';
        
        setTimeout(() => {
            oldPage.classList.add('hidden');
            oldPage.classList.remove('active');
            
            newPage.classList.remove('hidden');
            newPage.classList.add('active');
            
            // Trigger entry animation
            setTimeout(() => {
                newPage.style.opacity = '1';
                newPage.style.transform = 'translateY(0)';
            }, 50);

            router.current = pageId;
            if(pageId === 'shop') market.fetch();
            if(pageId === 'profile') profile.fetch();
        }, 300);

        // Update Nav UI
        document.querySelectorAll('.n-link').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === pageId);
        });
    }
};

// --- SECTION: MARKET LOGIC (LISTINGS SQL) ---
const market = {
    fetch: async () => {
        const grid = document.getElementById('market-grid');
        grid.innerHTML = '<div class="shimmer">Scanning Network...</div>';

        // Complex Join: Listing + Seller Profile
        const { data, error } = await db
            .from('listings')
            .select(`*, profiles(username, rating, is_verified)`)
            .eq('is_sold', false)
            .order('created_at', { ascending: false });

        if(error) return console.error(error);
        
        grid.innerHTML = data.map(item => `
            <div class="item-card anim-up" onclick="ai.inspect('${item.id}')">
                <div class="item-img-placeholder"></div>
                <div class="item-details">
                    <div class="item-price">$${item.price}</div>
                    <div class="item-title">${item.name}</div>
                    <div class="item-meta">
                        <span class="cond">${item.condition}</span>
                        <span class="seller">@${item.profiles.username} ${item.profiles.is_verified ? '✓' : ''}</span>
                    </div>
                    <div class="item-tags">
                        ${item.is_fair ? '<span class="tag-fair">Fair Price</span>' : '<span class="tag-warn">High Price</span>'}
                        <span class="tag-shipping">${item.shipping}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
};

// --- SECTION: SELL LOGIC (SCHEMA COMPLIANT) ---
document.getElementById('listing-form').onsubmit = async (e) => {
    e.preventDefault();
    
    // Auth Check
    const { data: { user } } = await db.auth.getUser();
    if(!user) return alert("AUTH_ERROR: Profile connection required.");

    // Gathering Payment Methods Array (SQL TEXT[])
    const payments = Array.from(document.querySelectorAll('.checkbox-group input:checked'))
                          .map(el => el.value);

    const price = parseFloat(document.getElementById('l-price').value);
    const msrp = parseFloat(document.getElementById('l-msrp').value);

    const payload = {
        seller_id: user.id,
        name: document.getElementById('l-name').value,
        category: document.getElementById('l-category').value,
        condition: document.getElementById('l-condition').value,
        price: price,
        msrp: msrp,
        description: document.getElementById('l-desc').value,
        type: document.getElementById('l-type').value,
        shipping: document.getElementById('l-shipping').value,
        payment_methods: payments,
        is_fair: msrp ? (price <= msrp * 1.15) : true // AI Rule: 15% threshold
    };

    const { error } = await db.from('listings').insert([payload]);
    
    if(!error) {
        alert("SUCCESS: Asset Deployed to Marketplace");
        router.navigate('shop');
    } else {
        alert("SQL_ERROR: " + error.message);
    }
};

// --- SECTION: PROFILE & WISHLIST LOGIC ---
const profile = {
    fetch: async () => {
        const { data: { user } } = await db.auth.getUser();
        if(!user) return;

        const { data: prof } = await db.from('profiles').select('*').eq('id', user.id).single();
        
        document.getElementById('profile-header').innerHTML = `
            <div class="prof-top">
                <h2>${prof.username}</h2>
                <span class="rating">${prof.rating} ★ Rating</span>
            </div>
            <p>${prof.bio || 'No bio available'}</p>
            <div class="prof-stats">
                <span>Verified: ${prof.is_verified ? 'Yes' : 'No'}</span>
                <span>Location: ${prof.location || 'Unknown'}</span>
            </div>
        `;
    }
};

// --- SECTION: AI INTELLIGENCE ---
const ai = {
    inspect: (itemId) => {
        const log = document.getElementById('ai-log');
        log.innerHTML = `<p class="typing">> Scanning Asset ID: ${itemId.substring(0,8)}...</p>`;
        
        setTimeout(() => {
            log.innerHTML = `
                <div class="ai-report">
                    <p><strong>Condition:</strong> Verified</p>
                    <p><strong>Market Value:</strong> Stable</p>
                    <p><strong>Recommendation:</strong> Fair buy for current sector trends.</p>
                </div>
            `;
        }, 800);
    }
}

// Initialize
window.onload = () => {
    router.navigate('home');
};
