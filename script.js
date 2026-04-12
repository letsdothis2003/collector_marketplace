/* ============================================================
   OBTAINUM MARKETPLACE — style.css
   Techno-cyberpunk marketplace theme with neon green accents
   ============================================================ */

/* ============================================================
   SECTION: FONTS & ROOT VARIABLES
   ============================================================ */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');

:root {
  --neon: #00ff41;
  --neon-dim: #00cc33;
  --neon-glow: rgba(0, 255, 65, 0.4);
  --neon-glow-strong: rgba(0, 255, 65, 0.8);
  --danger: #ff2d55;
  --warning: #ffd60a;
  --blue: #0af5ff;

  /* Dark mode (default) */
  --bg: #0a0a0f;
  --bg-2: #0f0f1a;
  --bg-3: #141428;
  --bg-card: #0d0d1f;
  --bg-card-hover: #131330;
  --border: rgba(0, 255, 65, 0.15);
  --border-bright: rgba(0, 255, 65, 0.5);
  --text: #e8ffe0;
  --text-muted: #6b7a6e;
  --text-secondary: #9ab09e;
  --header-h: 64px;
  --radius: 8px;
  --radius-lg: 16px;
  --transition: 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  --shadow-neon: 0 0 16px rgba(0, 255, 65, 0.25), 0 4px 24px rgba(0,0,0,0.6);
  --shadow-card: 0 2px 16px rgba(0,0,0,0.5);
}

body.light-mode {
  --bg: #f0f4f0;
  --bg-2: #e4ece4;
  --bg-3: #d8e4d8;
  --bg-card: #ffffff;
  --bg-card-hover: #f5fbf5;
  --border: rgba(0, 180, 60, 0.2);
  --border-bright: rgba(0, 180, 60, 0.6);
  --text: #0d1a0d;
  --text-muted: #5a7a5a;
  --text-secondary: #3a6a3a;
  --shadow-neon: 0 0 12px rgba(0, 180, 60, 0.2), 0 4px 16px rgba(0,0,0,0.1);
  --shadow-card: 0 2px 12px rgba(0,0,0,0.12);
  --neon: #00aa2a;
  --neon-dim: #008820;
  --neon-glow: rgba(0, 170, 42, 0.3);
}

/* ============================================================
   SECTION: RESET & BASE
   ============================================================ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  font-family: 'Inter', 'Rajdhani', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
  transition: background var(--transition), color var(--transition);
}

a { color: var(--neon); text-decoration: none; transition: opacity var(--transition); }
a:hover { opacity: 0.8; }
button { cursor: pointer; font-family: inherit; border: none; outline: none; }
input, textarea, select { font-family: inherit; }
img { max-width: 100%; display: block; }
ul { list-style: none; }

/* ============================================================
   SECTION: SCROLLBAR
   ============================================================ */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-2); }
::-webkit-scrollbar-thumb { background: var(--neon-dim); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--neon); }

/* ============================================================
   SECTION: ANIMATIONS & KEYFRAMES
   ============================================================ */
@keyframes neonPulse {
  0%, 100% { text-shadow: 0 0 8px var(--neon-glow), 0 0 20px var(--neon-glow), 0 0 40px var(--neon-glow); }
  50% { text-shadow: 0 0 16px var(--neon-glow-strong), 0 0 32px var(--neon-glow-strong), 0 0 64px var(--neon-glow-strong); }
}

@keyframes borderPulse {
  0%, 100% { border-color: rgba(0, 255, 65, 0.2); }
  50% { border-color: rgba(0, 255, 65, 0.6); }
}

@keyframes scanline {
  0% { top: -2px; }
  100% { top: 100%; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes popIn {
  0% { opacity: 0; transform: scale(0.85); }
  70% { transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes glitchX {
  0%, 100% { clip-path: inset(0 0 90% 0); transform: translate(-4px, 0); }
  25% { clip-path: inset(40% 0 40% 0); transform: translate(4px, 0); }
  50% { clip-path: inset(80% 0 0% 0); transform: translate(-2px, 0); }
  75% { clip-path: inset(20% 0 60% 0); transform: translate(2px, 0); }
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes toastOut {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(100%); }
}

/* ============================================================
   SECTION: UTILITY CLASSES
   ============================================================ */
.hidden { display: none !important; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.w-full { width: 100%; }
.animate-fade-up { animation: fadeInUp 0.45s ease both; }
.animate-fade { animation: fadeIn 0.35s ease both; }
.animate-pop { animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }

/* Stagger children */
.stagger > *:nth-child(1) { animation-delay: 0.05s; }
.stagger > *:nth-child(2) { animation-delay: 0.10s; }
.stagger > *:nth-child(3) { animation-delay: 0.15s; }
.stagger > *:nth-child(4) { animation-delay: 0.20s; }
.stagger > *:nth-child(5) { animation-delay: 0.25s; }
.stagger > *:nth-child(6) { animation-delay: 0.30s; }
.stagger > *:nth-child(7) { animation-delay: 0.35s; }
.stagger > *:nth-child(8) { animation-delay: 0.40s; }
.stagger > *:nth-child(n+9) { animation-delay: 0.45s; }

/* ============================================================
   SECTION: BUTTONS
   ============================================================ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius);
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  transition: all var(--transition);
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: white;
  opacity: 0;
  transition: opacity var(--transition);
  pointer-events: none;
}
.btn:hover::after { opacity: 0.06; }
.btn:active { transform: scale(0.97); }

.btn-primary {
  background: var(--neon);
  color: #001a07;
  font-weight: 700;
  box-shadow: 0 0 16px var(--neon-glow);
}
.btn-primary:hover { box-shadow: 0 0 28px var(--neon-glow-strong); }

.btn-outline {
  background: transparent;
  border: 1px solid var(--neon);
  color: var(--neon);
  box-shadow: inset 0 0 0 0 var(--neon);
}
.btn-outline:hover {
  background: rgba(0, 255, 65, 0.08);
  box-shadow: 0 0 12px var(--neon-glow);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn-ghost:hover { border-color: var(--border-bright); color: var(--text); }

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-sm { padding: 6px 14px; font-size: 0.82rem; }
.btn-lg { padding: 13px 28px; font-size: 1.05rem; }
.btn-icon { padding: 10px; width: 40px; height: 40px; border-radius: 50%; }

/* ============================================================
   SECTION: FORM ELEMENTS
   ============================================================ */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.form-input {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 10px 14px;
  font-size: 0.95rem;
  transition: border-color var(--transition), box-shadow var(--transition);
  width: 100%;
}
.form-input:focus {
  outline: none;
  border-color: var(--neon);
  box-shadow: 0 0 0 3px var(--neon-glow);
}
.form-input::placeholder { color: var(--text-muted); }

select.form-input { cursor: pointer; }
textarea.form-input { resize: vertical; min-height: 100px; }

/* ============================================================
   SECTION: HEADER / NAVIGATION
   ============================================================ */
#header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-h);
  background: rgba(10, 10, 15, 0.92);
  backdrop-filter: blur(16px) saturate(1.5);
  border-bottom: 1px solid var(--border);
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  transition: background var(--transition);
}
body.light-mode #header {
  background: rgba(240, 244, 240, 0.92);
}

.logo {
  font-family: 'Orbitron', sans-serif;
  font-weight: 900;
  font-size: 1.45rem;
  letter-spacing: 0.12em;
  color: var(--neon);
  text-transform: uppercase;
  animation: neonPulse 3.5s ease-in-out infinite;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
}

.header-search {
  flex: 1;
  max-width: 560px;
  position: relative;
}

.header-search input {
  width: 100%;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 40px;
  padding: 9px 16px 9px 44px;
  color: var(--text);
  font-size: 0.92rem;
  transition: all var(--transition);
}
.header-search input:focus {
  outline: none;
  border-color: var(--neon);
  box-shadow: 0 0 0 3px var(--neon-glow);
}
.header-search input::placeholder { color: var(--text-muted); }

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 0;
}

/* Theme toggle */
.theme-toggle {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 20px;
  width: 52px;
  height: 28px;
  position: relative;
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}
.theme-toggle::before {
  content: '';
  position: absolute;
  width: 20px; height: 20px;
  background: var(--neon);
  border-radius: 50%;
  top: 3px; left: 4px;
  transition: transform var(--transition), background var(--transition);
  box-shadow: 0 0 8px var(--neon-glow);
}
body.light-mode .theme-toggle::before {
  transform: translateX(24px);
}
.theme-toggle-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 2px;
  text-align: center;
  font-family: 'Rajdhani', sans-serif;
  letter-spacing: 0.05em;
}

.header-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--bg-3);
  border: 2px solid var(--neon);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--neon);
  cursor: pointer;
  transition: box-shadow var(--transition);
  font-family: 'Orbitron', sans-serif;
  position: relative;
  overflow: hidden;
}
.header-avatar:hover { box-shadow: 0 0 16px var(--neon-glow-strong); }
.header-avatar img {
  width: 100%; height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

/* Nav menu */
.nav-menu {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav-btn:hover { color: var(--neon); background: rgba(0,255,65,0.06); }
.nav-btn.active { color: var(--neon); }

/* Mobile hamburger */
.hamburger {
  display: none;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 38px; height: 38px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  transition: border-color var(--transition);
}
.hamburger span {
  display: block;
  width: 18px; height: 2px;
  background: var(--text);
  border-radius: 1px;
  transition: all var(--transition);
}
.hamburger:hover { border-color: var(--neon); }
.hamburger:hover span { background: var(--neon); }

/* Mobile nav drawer */
.mobile-nav {
  display: none;
  position: fixed;
  top: var(--header-h);
  left: 0; right: 0;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  padding: 12px 20px;
  flex-direction: column;
  gap: 4px;
  z-index: 999;
  animation: slideInLeft 0.25s ease both;
}
.mobile-nav.open { display: flex; }
.mobile-nav .nav-btn { justify-content: flex-start; }

/* ============================================================
   SECTION: LAYOUT / PAGE WRAPPER
   ============================================================ */
#app {
  padding-top: var(--header-h);
  min-height: 100vh;
}

.page {
  display: none;
  min-height: calc(100vh - var(--header-h));
}
.page.active {
  display: block;
  animation: fadeIn 0.3s ease both;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 20px;
}

/* ============================================================
   SECTION: SHOP PAGE (main marketplace grid)
   ============================================================ */
#page-shop {
  display: none;
}
#page-shop.active {
  display: block;
}

/* Shop layout */
.shop-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 0;
  min-height: calc(100vh - var(--header-h));
}

/* Sidebar filters */
.sidebar {
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  padding: 24px 20px;
  position: sticky;
  top: var(--header-h);
  height: calc(100vh - var(--header-h));
  overflow-y: auto;
  animation: slideInLeft 0.4s ease both;
}

.sidebar-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.filter-section {
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.filter-section:last-child { border-bottom: none; }

.filter-title {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 0.88rem;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 0.78rem;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition);
  letter-spacing: 0.03em;
}
.chip:hover { border-color: var(--neon); color: var(--neon); }
.chip.active {
  background: rgba(0,255,65,0.12);
  border-color: var(--neon);
  color: var(--neon);
  box-shadow: 0 0 8px var(--neon-glow);
}

.price-range {
  display: flex;
  gap: 8px;
  align-items: center;
}
.price-range input {
  flex: 1;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 7px 10px;
  color: var(--text);
  font-size: 0.85rem;
  transition: border-color var(--transition);
  width: 100%;
}
.price-range input:focus { outline: none; border-color: var(--neon); }
.price-range span { color: var(--text-muted); font-size: 0.85rem; flex-shrink: 0; }

.source-toggle {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 0;
}
.source-item input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--neon);
  cursor: pointer;
}
.source-item label {
  font-size: 0.88rem;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 500;
}

/* Range slider */
input[type="range"] {
  width: 100%;
  accent-color: var(--neon);
  cursor: pointer;
}

/* Main content area */
.shop-main {
  padding: 24px;
  overflow-y: auto;
}

.shop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}

.results-info {
  font-size: 0.88rem;
  color: var(--text-muted);
  font-family: 'Rajdhani', sans-serif;
  font-weight: 500;
}
.results-count { color: var(--neon); font-weight: 700; }

.sort-select {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 8px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color var(--transition);
}
.sort-select:focus { outline: none; border-color: var(--neon); }
.sort-select option { background: var(--bg-2); }

/* Listing grid */
.listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

/* ============================================================
   SECTION: LISTING CARDS
   ============================================================ */
.listing-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition), border-color var(--transition), box-shadow var(--transition);
  position: relative;
  animation: fadeInUp 0.4s ease both;
}
.listing-card:hover {
  transform: translateY(-4px);
  border-color: var(--border-bright);
  box-shadow: var(--shadow-neon);
}

.card-image-wrap {
  aspect-ratio: 1;
  background: var(--bg-3);
  position: relative;
  overflow: hidden;
}
.card-image-wrap img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}
.listing-card:hover .card-image-wrap img { transform: scale(1.06); }

.card-no-image {
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  color: var(--text-muted);
  background: linear-gradient(135deg, var(--bg-2), var(--bg-3));
}

/* Scanline overlay on hover */
.listing-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--neon), transparent);
  z-index: 2;
  opacity: 0;
  transition: opacity var(--transition);
}
.listing-card:hover::before { opacity: 1; }

.card-badge {
  position: absolute;
  top: 10px; left: 10px;
  background: rgba(0,0,0,0.85);
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.68rem;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--neon);
  z-index: 1;
}
.card-badge.fair { color: var(--neon); border-color: var(--neon); }
.card-badge.featured { color: var(--warning); border-color: var(--warning); }

.wishlist-btn {
  position: absolute;
  top: 10px; right: 10px;
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,0.7);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  cursor: pointer;
  z-index: 2;
  transition: all var(--transition);
  color: var(--text-muted);
}
.wishlist-btn:hover { border-color: var(--danger); color: var(--danger); }
.wishlist-btn.active { border-color: var(--danger); color: var(--danger); background: rgba(255,45,85,0.15); }

.card-body {
  padding: 12px;
}
.card-title {
  font-weight: 600;
  font-size: 0.92rem;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}
.card-price {
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--neon);
  margin-bottom: 6px;
}
.card-msrp {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: line-through;
  margin-left: 6px;
}
.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: 'Rajdhani', sans-serif;
}
.card-condition {
  font-size: 0.7rem;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  text-transform: capitalize;
  letter-spacing: 0.04em;
}

/* Skeleton loader */
.skeleton {
  background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.5s infinite linear;
  border-radius: var(--radius);
}
.skeleton-card {
  height: 260px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
}

/* Empty state */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 20px;
  animation: fadeIn 0.4s ease both;
}
.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.4;
}
.empty-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.1rem;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}
.empty-sub {
  font-size: 0.88rem;
  color: var(--text-muted);
  margin-top: 8px;
}

/* ============================================================
   SECTION: ITEM DETAIL PAGE
   ============================================================ */
#page-detail {
  display: none;
}
#page-detail.active {
  display: block;
  animation: fadeIn 0.35s ease both;
}

.detail-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 20px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 24px;
  transition: color var(--transition);
}
.back-btn:hover { color: var(--neon); }

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 32px;
  align-items: start;
}

.detail-images {
  position: sticky;
  top: calc(var(--header-h) + 24px);
}

.main-image-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  aspect-ratio: 1.2;
  position: relative;
  margin-bottom: 12px;
}
.main-image-wrap img {
  width: 100%; height: 100%;
  object-fit: cover;
}
.main-image-wrap .card-no-image {
  aspect-ratio: unset;
  height: 100%;
  font-size: 5rem;
}

.image-thumbs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.image-thumb {
  flex-shrink: 0;
  width: 64px; height: 64px;
  border-radius: 8px;
  border: 2px solid var(--border);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition);
}
.image-thumb:hover, .image-thumb.active { border-color: var(--neon); }
.image-thumb img { width: 100%; height: 100%; object-fit: cover; }

.detail-info {
  animation: slideInRight 0.4s ease both;
}

.detail-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
  line-height: 1.3;
}

.detail-price-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.detail-price {
  font-family: 'Orbitron', sans-serif;
  font-size: 2rem;
  font-weight: 900;
  color: var(--neon);
  text-shadow: 0 0 20px var(--neon-glow);
}
.detail-msrp {
  font-size: 0.95rem;
  color: var(--text-muted);
  text-decoration: line-through;
}
.detail-savings {
  font-size: 0.82rem;
  color: var(--neon);
  background: rgba(0,255,65,0.1);
  border: 1px solid rgba(0,255,65,0.3);
  padding: 3px 8px;
  border-radius: 20px;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
}

.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.badge {
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid;
}
.badge-condition { border-color: var(--blue); color: var(--blue); }
.badge-type { border-color: var(--border-bright); color: var(--neon); }
.badge-shipping { border-color: var(--text-muted); color: var(--text-muted); }

.detail-description {
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.7;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
.detail-meta-item {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
}
.detail-meta-label {
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-bottom: 3px;
}
.detail-meta-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  text-transform: capitalize;
}

.seller-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.seller-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: var(--bg-3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', sans-serif;
  font-size: 0.9rem;
  color: var(--neon);
  flex-shrink: 0;
}
.seller-name { font-weight: 600; font-size: 0.9rem; }
.seller-location { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
.seller-rating { color: var(--warning); font-size: 0.78rem; margin-top: 2px; }

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* AI Insights panel */
.ai-panel {
  background: linear-gradient(135deg, rgba(0,255,65,0.04), rgba(0,15,5,0.6));
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-top: 28px;
  position: relative;
  overflow: hidden;
  animation: fadeInUp 0.5s ease both 0.2s;
}
.ai-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--neon), transparent);
  animation: neonPulse 2.5s ease-in-out infinite;
}

.ai-label {
  font-family: 'Orbitron', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: var(--neon);
  text-transform: uppercase;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ai-dot {
  width: 6px; height: 6px;
  background: var(--neon);
  border-radius: 50%;
  animation: neonPulse 1.5s ease-in-out infinite;
}

.ai-insights {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-insight {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 0.875rem;
  color: var(--text-secondary);
  padding: 8px 0;
  border-bottom: 1px solid rgba(0,255,65,0.05);
  animation: fadeInUp 0.4s ease both;
}
.ai-insight:last-child { border-bottom: none; }
.ai-bullet {
  color: var(--neon);
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

/* Similar items */
.similar-section {
  padding: 32px 0;
}
.section-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  color: var(--neon);
  text-transform: uppercase;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.similar-scroll {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x mandatory;
}
.similar-scroll .listing-card {
  min-width: 200px;
  max-width: 200px;
  scroll-snap-align: start;
  flex-shrink: 0;
}

/* ============================================================
   SECTION: CREATE LISTING PAGE
   ============================================================ */
#page-create {
  display: none;
}
#page-create.active {
  display: block;
  animation: fadeIn 0.35s ease both;
}

.create-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 20px;
}

.page-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.2rem;
  letter-spacing: 0.1em;
  color: var(--neon);
  text-transform: uppercase;
  margin-bottom: 28px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.image-upload-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
}
.image-upload-zone:hover {
  border-color: var(--neon);
  background: rgba(0,255,65,0.04);
}
.upload-icon { font-size: 2.5rem; margin-bottom: 8px; opacity: 0.6; }
.upload-text {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-family: 'Rajdhani', sans-serif;
}
.upload-text span { color: var(--neon); }
.upload-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.image-preview-item {
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border);
}
.image-preview-item img { width: 100%; height: 100%; object-fit: cover; }
.remove-image {
  position: absolute;
  top: 4px; right: 4px;
  width: 20px; height: 20px;
  background: rgba(0,0,0,0.8);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem;
  color: white;
  cursor: pointer;
  transition: background var(--transition);
  border: none;
}
.remove-image:hover { background: var(--danger); }

/* ============================================================
   SECTION: LOGIN / REGISTER MODAL
   ============================================================ */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(6px);
  z-index: 2000;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-overlay.open {
  display: flex;
  animation: fadeIn 0.25s ease both;
}

.modal {
  background: var(--bg-2);
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-lg);
  padding: 32px;
  width: 100%;
  max-width: 420px;
  position: relative;
  animation: popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
  box-shadow: 0 0 40px rgba(0,255,65,0.15), 0 20px 60px rgba(0,0,0,0.6);
}

.modal-close {
  position: absolute;
  top: 16px; right: 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition);
}
.modal-close:hover { border-color: var(--danger); color: var(--danger); }

.modal-logo {
  font-family: 'Orbitron', sans-serif;
  font-weight: 900;
  font-size: 1.5rem;
  color: var(--neon);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  animation: neonPulse 3s ease-in-out infinite;
  text-align: center;
  margin-bottom: 4px;
}
.modal-tagline {
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-family: 'Rajdhani', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 24px;
}

.modal-tabs {
  display: flex;
  gap: 0;
  background: var(--bg-3);
  border-radius: var(--radius);
  padding: 3px;
  margin-bottom: 24px;
}
.modal-tab {
  flex: 1;
  padding: 8px;
  border-radius: calc(var(--radius) - 2px);
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  cursor: pointer;
  text-align: center;
  color: var(--text-muted);
  background: transparent;
  border: none;
  transition: all var(--transition);
}
.modal-tab.active {
  background: var(--neon);
  color: #001a07;
  box-shadow: 0 0 12px var(--neon-glow);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-error {
  background: rgba(255,45,85,0.1);
  border: 1px solid rgba(255,45,85,0.4);
  border-radius: var(--radius);
  padding: 10px 14px;
  font-size: 0.85rem;
  color: var(--danger);
  display: none;
}
.auth-error.show { display: block; animation: fadeIn 0.25s ease both; }

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-family: 'Rajdhani', sans-serif;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* ============================================================
   SECTION: PROFILE PAGE
   ============================================================ */
#page-profile {
  display: none;
}
#page-profile.active {
  display: block;
  animation: fadeIn 0.35s ease both;
}

.profile-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 20px;
}

.profile-banner {
  background: linear-gradient(135deg, var(--bg-2), var(--bg-3));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  position: relative;
  overflow: hidden;
  animation: fadeInUp 0.4s ease both;
}
.profile-banner::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--neon), transparent);
}

.profile-avatar-lg {
  width: 88px; height: 88px;
  border-radius: 50%;
  background: var(--bg-3);
  border: 3px solid var(--neon);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', sans-serif;
  font-size: 2rem;
  color: var(--neon);
  box-shadow: 0 0 24px var(--neon-glow);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.profile-avatar-lg img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

.profile-info { flex: 1; }
.profile-username {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--neon);
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}
.profile-email { font-size: 0.88rem; color: var(--text-muted); margin-bottom: 8px; }
.profile-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.stat-item { text-align: center; }
.stat-value {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--neon);
}
.stat-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-family: 'Rajdhani', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.profile-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  gap: 0;
  margin-bottom: 24px;
  overflow-x: auto;
}
.profile-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 0.88rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 10px 20px;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}
.profile-tab:hover { color: var(--neon); }
.profile-tab.active {
  color: var(--neon);
  border-bottom-color: var(--neon);
}

/* ============================================================
   SECTION: WISHLIST PAGE
   ============================================================ */
#page-wishlist {
  display: none;
}
#page-wishlist.active {
  display: block;
  animation: fadeIn 0.35s ease both;
}

.wishlist-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 20px;
}

/* ============================================================
   SECTION: TOAST NOTIFICATIONS
   ============================================================ */
#toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 260px;
  max-width: 360px;
  box-shadow: var(--shadow-card);
  pointer-events: all;
  animation: toastIn 0.35s ease both;
  position: relative;
  overflow: hidden;
}
.toast::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
}
.toast.success { border-color: rgba(0,255,65,0.4); }
.toast.success::before { background: var(--neon); }
.toast.error { border-color: rgba(255,45,85,0.4); }
.toast.error::before { background: var(--danger); }
.toast.info { border-color: rgba(10,245,255,0.4); }
.toast.info::before { background: var(--blue); }

.toast-icon { font-size: 1.1rem; flex-shrink: 0; }
.toast-msg { font-size: 0.88rem; font-family: 'Rajdhani', sans-serif; font-weight: 500; line-height: 1.3; }
.toast.exit { animation: toastOut 0.3s ease forwards; }

/* ============================================================
   SECTION: SPINNER / LOADING
   ============================================================ */
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--neon);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
.spinner-lg {
  width: 40px; height: 40px;
  border-width: 3px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: inherit;
}

/* ============================================================
   SECTION: GLITCH EFFECT (for logo)
   ============================================================ */
.glitch {
  position: relative;
}
.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}
.glitch:hover::before {
  color: #ff0066;
  opacity: 0.7;
  animation: glitchX 0.3s steps(1) both;
  clip-path: inset(0 0 70% 0);
  left: -2px;
}
.glitch:hover::after {
  color: var(--blue);
  opacity: 0.7;
  animation: glitchX 0.3s steps(1) reverse both;
  clip-path: inset(60% 0 0 0);
  left: 2px;
}

/* ============================================================
   SECTION: SCANLINE OVERLAY
   ============================================================ */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 65, 0.012) 2px,
    rgba(0, 255, 65, 0.012) 4px
  );
  pointer-events: none;
  z-index: 9998;
}
body.light-mode::after { opacity: 0; }

/* ============================================================
   SECTION: FOOTER
   ============================================================ */
footer {
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  padding: 24px 20px;
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-family: 'Rajdhani', sans-serif;
  letter-spacing: 0.06em;
  margin-top: auto;
}
footer .footer-logo {
  font-family: 'Orbitron', sans-serif;
  color: var(--neon);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  margin-bottom: 6px;
}
footer .footer-links {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
footer .footer-links a {
  color: var(--text-muted);
  transition: color var(--transition);
}
footer .footer-links a:hover { color: var(--neon); }

/* ============================================================
   SECTION: RESPONSIVE / MOBILE STYLES
   ============================================================ */
@media (max-width: 900px) {
  .shop-layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: relative;
    top: 0;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    display: none;
  }
  .sidebar.mobile-open { display: block; }
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .detail-images { position: relative; top: 0; }
  .form-row { grid-template-columns: 1fr; }
  .nav-menu { display: none; }
  .hamburger { display: flex; }
}

@media (max-width: 600px) {
  :root { --header-h: 58px; }
  .logo { font-size: 1.1rem; }
  .header-search { max-width: 100%; }
  .profile-banner { flex-direction: column; text-align: center; }
  .profile-stats { justify-content: center; }
  .shop-main { padding: 16px; }
  .listings-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .modal { padding: 24px 16px; }
}

/* ============================================================
   SECTION: DOWN / ERROR STATE
   ============================================================ */
#error-banner {
  display: none;
  position: fixed;
  top: var(--header-h);
  left: 0; right: 0;
  background: rgba(255,45,85,0.12);
  border-bottom: 2px solid var(--danger);
  padding: 12px 24px;
  text-align: center;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  color: var(--danger);
  z-index: 998;
}
#error-banner.show { display: block; animation: fadeIn 0.35s ease both; }


/* ============================================================
   SECTION: OPEN EDIT PROFILE (stub — extend as needed)
   ============================================================ */

function openEditProfile() {
  // Switch to settings tab
  const settingsTab = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTab) {
    settingsTab.click();
    settingsTab.scrollIntoView({ behavior: 'smooth' });
  }
}

/* ============================================================
   SECTION: INITIALIZATION — Bootstrap the app on DOM ready
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Apply saved theme
  initTheme();

  // 2. Set up all event listeners
  setupEventListeners();

  // 3. Restore auth session
  await initAuth();

  // 4. Start on shop page
  navigate('shop');

  // 5. Animate logo on load
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.animation = 'neonPulse 3.5s ease-in-out infinite';
  }

  // 6. Connectivity check
  if (!navigator.onLine) {
    showErrorBanner();
  }

  console.log(
    '%c OBTAINUM INITIALIZED ',
    'background:#00ff41;color:#001a07;font-family:monospace;font-weight:bold;font-size:14px;padding:4px 8px;'
  );
});
