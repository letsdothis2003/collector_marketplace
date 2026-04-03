// Mock Database
const DATABASE = [
    { id: '1', title: 'Optimus Prime SS-38', price: 120, msrp: 29.99, source: 'Local', category: 'Toys', sub: 'Transformers', img: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400' },
    { id: '2', title: 'RTX 5090 Prototype', price: 1999, msrp: 1999, source: 'Retail', category: 'Electronics', sub: 'PC', img: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400' },
    { id: '3', title: 'Jordan 1 Retro High', price: 170, msrp: 170, source: 'Retail', category: 'Shoes', sub: 'Nike', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400' }
];

let state = {
    listings: [...DATABASE],
    isDown: false
};

// INITIALIZE
document.addEventListener('DOMContentLoaded', () => {
    renderGrid(state.listings);
    startSystemMonitor();
    
    // Search listener
    document.getElementById('searchInput').addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });
});

// SYSTEM MONITORING (Non-functional Requirement)
function startSystemMonitor() {
    setInterval(() => {
        // Logic check: Priority consistency
        // If critical data like MSRP is missing, trigger downtime overlay
        const isCorrupted = state.listings.some(item => isNaN(item.msrp));
        if (isCorrupted) {
            document.getElementById('crashOverlay').classList.remove('hidden');
        }
    }, 3000);
}

function handleSearch(term) {
    const filtered = DATABASE.filter(item => 
        item.title.toLowerCase().includes(term.toLowerCase())
    );
    renderGrid(filtered);
}

function renderGrid(items) {
    const grid = document.getElementById('itemGrid');
    grid.innerHTML = '';
    
    items.forEach(item => {
        const markup = ((item.price - item.msrp) / item.msrp) * 100;
        const isScalped = markup > 30;

        const card = document.createElement('div');
        card.className = `listing-card glass rounded-2xl overflow-hidden cursor-pointer ${isScalped ? 'card-scalper' : 'card-fair'}`;
        card.innerHTML = `
            <div class="h-40 bg-slate-950 flex items-center justify-center p-4">
                <img src="${item.img}" class="h-full object-contain">
            </div>
            <div class="p-4">
                <div class="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1">
                    <span>${item.source}</span>
                    <span>${item.sub}</span>
                </div>
                <h3 class="font-bold text-sm mb-3 truncate">${item.title}</h3>
                <div class="flex justify-between items-center border-t border-white/5 pt-3">
                    <span class="text-lg font-bold ${isScalped ? 'text-red-400' : 'text-emerald-400'}">$${item.price}</span>
                    <span class="text-[9px] px-2 py-0.5 rounded bg-white/5 font-black uppercase">
                        ${isScalped ? 'Scalper Alert' : 'Fair Price'}
                    </span>
                </div>
            </div>
        `;
        card.onclick = () => showDetail(item);
        grid.appendChild(card);
    });
    document.getElementById('resultCount').innerText = `${items.length} RESULTS FOUND`;
}

function showDetail(item) {
    const view = document.getElementById('detailView');
    const marketplace = document.getElementById('marketplaceView');
    
    const markup = ((item.price - item.msrp) / item.msrp) * 100;
    const isScalped = markup > 30;
    const barWidth = Math.min(100, (item.price / (item.msrp * 1.5)) * 100);

    marketplace.classList.add('hidden');
    view.classList.remove('hidden');

    view.innerHTML = `
        <button onclick="showView('marketplace')" class="text-xs font-bold text-slate-500 mb-8"><i class="fas fa-arrow-left mr-2"></i> BACK TO MARKET</button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 glass p-8 rounded-[32px]">
            <div class="bg-slate-950 rounded-2xl p-8 flex items-center justify-center">
                <img src="${item.img}" class="max-h-64 object-contain">
            </div>
            <div class="space-y-6">
                <div>
                    <h2 class="text-3xl font-bold">${item.title}</h2>
                    <p class="text-slate-400 text-sm">Target MSRP: $${item.msrp}</p>
                </div>

                <div class="bg-white/5 p-6 rounded-2xl">
                    <h3 class="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4">AI Financial Insights</h3>
                    <ul class="ai-insight-list">
                        <li>This listing is ${markup.toFixed(1)}% above the verified MSRP.</li>
                        <li><strong>Market Demand:</strong> High interest detected in the last 24 hours.</li>
                        <li><strong>Scalper Risk:</strong> ${isScalped ? 'High. Prices are currently inflated due to limited retail restocks.' : 'Low. This matches consistent secondary market value.'}</li>
                        <li><strong>Recommendation:</strong> ${isScalped ? 'Wait for a restock at major retailers to save money.' : 'Safe to purchase. This represents a fair community trade.'}</li>
                    </ul>
                </div>

                <div class="price-bar-container">
                    <div class="price-bar-fill" style="width: ${barWidth}%"></div>
                </div>

                <button class="w-full bg-emerald-500 text-slate-900 font-bold py-4 rounded-2xl hover:scale-[1.02] transition-transform">
                    SECURE THIS ITEM
                </button>
            </div>
        </div>
    `;
}

function showView(viewId) {
    ['marketplaceView', 'detailView', 'sellView'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId + 'View').classList.remove('hidden');
}
