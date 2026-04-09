
/* =========================================================
   1. API MODULE (api.js logic)
========================================================= */
const API = (() => {
    let supabase;

    const init = async () => {
        // Replace these with your actual Supabase credentials
        const supabaseUrl = 'YOUR_SUPABASE_URL';
        const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

        if (window.supabase) {
            try {
                supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
                console.log("API: Supabase connected.");
            } catch (error) {
                console.error("API: Initialization failed.", error);
            }
        }
    };

    const ready = init();

    return {
        ready,
        getSupabase: () => supabase,
        // Mock data fetchers - replace with supabase.from('listings').select('*')
        getListings: async () => {
            await ready;
            return [
                { id: 1, title: "Optimus Prime G1", price: 45.00, msrp: 40.00, source: 'Marketplace', category: 'Toys', condition: 'New' },
                { id: 2, title: "Charizard Holo", price: 500.00, msrp: 4.00, source: 'External', category: 'Trading Cards', condition: 'Graded' }
            ];
        },
        getSession: async () => {
            if (!supabase) return { data: { session: null } };
            return await supabase.auth.getSession();
        },
        chatWithAI: async (message, history) => {
            // Placeholder for Edge Function call
            await new Promise(r => setTimeout(r, 1000));
            return `Based on current market data for "${message}", prices are trending 5% above MSRP. It's a safe buy.`;
        }
    };
})();

/* =========================================================
   2. UTILITIES (Formatting & Calculations)
========================================================= */
const Utils = {
    fmt: (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num),
    
    isScalped: (price, msrp) => price > (msrp * 1.2), // 20% threshold
    
    getMarkup: (price, msrp) => {
        const diff = ((price - msrp) / msrp) * 100;
        return diff.toFixed(0);
    }
};

/* =========================================================
   3. VIEW CONTROLLER (Navigation & Routing)
========================================================= */
const App = {
    init: () => {
        window.addEventListener('popstate', App.handleRoute);
        App.handleRoute();
        App.initGlobalListeners();
    },

    handleRoute: () => {
        const hash = window.location.hash.replace('#', '') || 'home';
        App.showPage(hash);
    },

    showPage: (pageId) => {
        document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) {
            target.classList.add('active');
            // Trigger specific view logic
            if (pageId === 'shop') ShopView.init();
            if (pageId === 'sell') SellView.init();
        }
        window.scrollTo(0, 0);
    },

    initGlobalListeners: () => {
        // Contact form handling
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                alert("Message sent! We'll get back to you soon.");
                App.showPage('home');
            });
        }
    }
};

/* =========================================================
   4. VIEW MODULES (Page-specific logic)
========================================================= */

const ShopView = {
    init: async () => {
        const grid = document.getElementById('shop-grid');
        grid.innerHTML = '<div class="loader">Loading...</div>';
        const items = await API.getListings();
        
        grid.innerHTML = items.map(item => `
            <div class="listing-card glass" onclick="ShopView.openListing(${item.id})">
                <div class="card-badge ${Utils.isScalped(item.price, item.msrp) ? 'scalp' : 'fair'}">
                    ${Utils.isScalped(item.price, item.msrp) ? 'High Markup' : 'Fair Price'}
                </div>
                <h3>${item.title}</h3>
                <div class="price-row">
                    <span class="price">${Utils.fmt(item.price)}</span>
                    <span class="msrp">MSRP ${Utils.fmt(item.msrp)}</span>
                </div>
            </div>
        `).join('');
    },
    openListing: (id) => {
        // In a real app, this would route to page-listing and fetch ID
        alert("Opening Listing Details for ID: " + id);
    }
};

const SellView = {
    init: () => {
        const priceInp = document.getElementById('price');
        const msrpInp = document.getElementById('msrp');
        
        const updateMeter = () => {
            const price = parseFloat(priceInp.value) || 0;
            const msrp = parseFloat(msrpInp.value) || 0;
            const fill = document.getElementById('meter-fill');
            
            if (msrp > 0) {
                const ratio = (price / (msrp * 2)) * 100;
                fill.style.width = Math.min(ratio, 100) + '%';
                
                if (price <= msrp) fill.style.background = '#10b981'; // Green
                else if (price <= msrp * 1.3) fill.style.background = '#f59e0b'; // Amber
                else fill.style.background = '#ef4444'; // Red
            }
        };

        priceInp.addEventListener('input', updateMeter);
        msrpInp.addEventListener('input', updateMeter);
    }
};

/* =========================================================
   5. ASSISTANT MODULE
========================================================= */
const Assistant = {
    history: [],

    handleChat: async () => {
        const input = document.getElementById('user-input');
        const msg = input.value.trim();
        if (!msg) return;

        this.addMessage(msg, 'user');
        input.value = '';

        const response = await API.chatWithAI(msg, this.history);
        this.addMessage(response, 'bot');
    },

    addMessage: (text, sender) => {
        const box = document.getElementById('messages');
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;
        div.textContent = text;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
        Assistant.history.push({ role: sender, content: text });
    }
};

/* =========================================================
   6. INITIALIZATION
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});