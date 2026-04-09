
document.addEventListener('DOMContentLoaded', () => {
    const navRoot = document.getElementById('nav-root');
    if (navRoot) {
        navRoot.innerHTML = `
            <div class="navbar">
                <div class="navbar-inner">
                    <a href="index.html" class="logo">
                        <div class="logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-1"/></svg>
                        </div>
                        OBTAINUM
                    </a>
                    <nav class="nav-links">
                        <a href="index.html">Home</a>
                        <a href="shop.html">Shop</a>
                        <a href="about.html">About</a>
                        <a href="contact.html">Contact</a>
                    </nav>
                    <div class="nav-right">
                        <div class="search-wrap">
                            <input type="search" id="nav-search" placeholder="Search collectibles...">
                            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <div class="search-dropdown" id="search-dropdown" style="display: none;"></div>
                        </div>
                        <button class="nav-icon-btn" id="ai-assistant-btn" onclick="window.toggleAIAssistant()">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8L10.88 10.88"></path><path d="M12 12L6 6"></path><path d="M16 8h-4"></path><path d="M16 12h-4"></path><path d="M20 12h-4"></path><circle cx="12" cy="12" r="8"></circle></svg>
                            <span>AI Assistant</span>
                        </button>
                        <button class="nav-icon-btn" id="theme-toggle">
                            <span id="theme-icon"></span>
                            <span id="theme-text"></span>
                        </button>
                        <div id="nav-auth-section"></div>
                         <a href="sell.html" class="btn btn-primary btn-sm">List Item</a>
                    </div>
                    <button class="hamburger" id="hamburger">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            <div class="mobile-menu" id="mobile-menu"></div>
        `;
    }
    initNav();
    initFooter();
});

async function initNav() {
    try {
        await API.ready;
    } catch (error) {
        console.error("Halting nav initialization due to API failure.");
        return;
    }

    setupSearch();
    setupMobileMenu();
    updateCartBadge();
    updateAuthUI(API.getCurrentUser());

    API.onAuthStateChanged(user => {
        updateAuthUI(user);
    });
}

function updateAuthUI(user) {
    const authSection = document.getElementById('nav-auth-section');
    if (!authSection) return;

    let authHTML = '';
    if (user) {
        authHTML = `
            <div class="nav-item dropdown-container">
                <button class="nav-icon-btn" onclick="toggleProfileMenu()" id="profile-menu-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </button>
                <div class="dropdown-menu" id="profile-menu">
                    <a href="profile.html">My Profile</a>
                    <a href="#" id="logout-link">Logout</a>
                </div>
            </div>
        `;
    } else {
        authHTML = `
            <a href="login.html" class="btn btn-outline btn-sm">Login</a>
            <a href="signup.html" class="btn btn-primary btn-sm">Sign Up</a>
        `;
    }
    authSection.innerHTML = authHTML;

    if (user) {
        document.getElementById('logout-link').addEventListener('click', async (e) => {
            e.preventDefault();
            await API.signOut();
            window.location.href = '/login.html';
        });

        document.addEventListener('click', (e) => {
            const menu = document.getElementById('profile-menu');
            const btn = document.getElementById('profile-menu-btn');
            if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }
}

function toggleProfileMenu() {
    const menu = document.getElementById('profile-menu');
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
}

function setupSearch() {
  const searchInput = document.getElementById('nav-search');
  const dropdown = document.getElementById('search-dropdown');
  let debounce;

  if (searchInput && dropdown) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      const val = searchInput.value.trim();
      if (val.length < 2) { dropdown.style.display = 'none'; return; }
      debounce = setTimeout(() => doSearch(val), 220);
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { dropdown.style.display = 'none'; searchInput.value = ''; }
      if (e.key === 'Enter') {
        dropdown.style.display = 'none';
        window.location.href = `shop.html?search=${encodeURIComponent(searchInput.value)}`;
      }
    });

    document.addEventListener('mousedown', e => {
      const searchWrap = document.getElementById('search-wrap');
      if (searchWrap && !searchWrap.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }
  async function doSearch(query) { /* ... existing search logic ... */ }
}

function setupMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
        });
    }
}

function updateCartBadge() {
  // ... logic to update cart ...
}

function initFooter() {
  const FOOTER_HTML = `
    <footer>
    <div class="container">
        <div class="footer-grid">
        <div>
            <div class="logo" style="margin-bottom:.75rem">            <div class="logo-icon">                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-1"/></svg>            </div>            OBTAINUM            </div>            <p style="font-size:.8rem;color:var(--muted);max-width:220px">The only marketplace using real-time market data to protect collectors from scalpers.</p>        </div>
        <div>            <div class="footer-col-title">Navigate</div>            <ul class="footer-links"><li><a href="index.html">Home</a></li><li><a href="shop.html">Shop</a></li><li><a href="sell.html">Sell</a></li><li><a href="about.html">About</a></li></ul>        </div>
        <div>            <div class="footer-col-title">Categories</div>            <ul class="footer-links"><li><a href="shop.html">Toys</a></li><li><a href="shop.html">Trading Cards</a></li><li><a href="shop.html">Shoes</a></li><li><a href="shop.html">Electronics</a></li></ul>        </div>
        <div>            <div class="footer-col-title">Company</div>            <ul class="footer-links"><li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li></ul>        </div>
        </div>
        <div class="footer-bottom">
        <p class="footer-copy">&copy; ${new Date().getFullYear()} Obtainum. Built for collectors, by collectors.</p>
        </div>
    </div>
    </footer>
  `;
  const footerRoot = document.getElementById('footer-root');
  if (footerRoot) {
    footerRoot.innerHTML = FOOTER_HTML;
  }
}
