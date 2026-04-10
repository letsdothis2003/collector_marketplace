const SUPABASE_CONFIG = Object.freeze({
    url: 'https://gotzmuobwuubsugnowxq.supabase.co',
    anonKey: 'sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs',
    options: {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'obtainum-auth-token', flowType: 'pkce' }
    }
});

const _supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, SUPABASE_CONFIG.options);

async function refreshStore() {
    const { data, error } = await _supabase.from('listings').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    renderGrid(data);
}

function renderGrid(items) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = items.map(item => `
        <div class="card">
            ${item.is_fair ? '<span class="fair-badge">FAIR</span>' : ''}
            <div style="height:120px; background:#eee; border-radius:8px; margin-bottom:10px;"></div>
            <h3>${item.name}</h3>
            <p style="color:var(--primary); font-weight:bold;">$${item.price}</p>
            <small style="color:gray">${item.category}</small>
        </div>
    `).join('');
}

document.getElementById('sellForm').onsubmit = async (e) => {
    e.preventDefault();
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return alert("Login required!");

    const price = parseFloat(document.getElementById('itemPrice').value);
    const msrp = parseFloat(document.getElementById('itemMsrp').value);

    const { error } = await _supabase.from('listings').insert([{
        seller_id: user.id,
        name: document.getElementById('itemTitle').value,
        price: price,
        msrp: msrp,
        category: document.getElementById('itemCategory').value,
        description: document.getElementById('itemDescription').value,
        is_fair: price <= msrp,
        condition: 'new'
    }]);

    if (!error) {
        document.getElementById('sellModal').style.display = 'none';
        refreshStore();
    }
};

// Modal Logic
document.getElementById('openSellModal').onclick = () => document.getElementById('sellModal').style.display = 'flex';
document.getElementById('closeModal').onclick = () => document.getElementById('sellModal').style.display = 'none';

// Init
refreshStore();
