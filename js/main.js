// ==================== MAIN APPLICATION MODULE ====================
import { getCurrentUser, getCurrentProfile, signOut, checkAuthStatus, onAuthStateChange, loginEmail, registerEmail, loginGoogle, currentUser } from './auth.js';
import { showToast, closeModal, openModal, closeMobileNav, setLoading, lazyLoadImages } from './utils.js';
import { initShop, loadListings } from './shop.js';
import { initCreatePage } from './create.js';
import { initWishlist } from './wishlist.js';
import { initProfile } from './profile.js';
import { initMessages } from './messages.js';
import { initAssistant } from './assistant.js';
import { initDetail } from './detail.js';
import { calculateRouteSafety, getUserCurrentLocation } from './airoute.js';

// Page registry
const pageRegistry = {
  'shop': { file: 'pages/shop.html', init: initShop },
  'about': { file: 'pages/about.html', init: null },
  'contact': { file: 'pages/contact.html', init: null },
  'create': { file: 'pages/create.html', init: initCreatePage },
  'wishlist': { file: 'pages/wishlist.html', init: initWishlist },
  'profile': { file: 'pages/profile.html', init: initProfile },
  'assistant': { file: 'pages/assistant.html', init: initAssistant },
  'detail': { file: 'pages/detail.html', init: initDetail },
  'messages': { file: 'pages/messages.html', init: initMessages },
  'donate': { file: 'pages/donate.html', init: null }
};

// CSS files for dynamic loading
const pageStyles = {
  'shop': 'css/shop.css',
  'create': 'css/create.css',
  'detail': 'css/detail.css',
  'profile': 'css/profile.css',
  'wishlist': 'css/wishlist.css',
  'assistant': 'css/assistant.css',
  'messages': 'css/messages.css',
  'about': 'css/about.css',
  'contact': 'css/contact.css',
  'donate': 'css/donate.css'
};

// Global state
let currentPage = 'shop';
let isAuthModalOpen = false;
let currentTheme = localStorage.getItem('theme') || 'dark';

// ===================== INITIALIZATION =====================

console.log('📝 OBTAINUM script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 OBTAINUM initializing...');
  console.log('DOM content loaded, starting setup...');
  
  try {
    // Check auth status
    console.log('1. Checking auth status...');
    await checkAuthStatus();
    console.log('2. Auth status checked');
    
    console.log('3. Setting up auth listeners...');
    setupAuthListeners();
    console.log('4. Auth listeners setup');
    
    console.log('5. Setting up navigation...');
    setupNavigation();
    console.log('6. Navigation setup');
    
    console.log('7. Setting up theme...');
    setupTheme();
    console.log('8. Theme setup');
    
    console.log('9. Setting up modals...');
    setupModals();
    console.log('10. Modals setup');
    
    console.log('11. Setting up event listeners...');
    setupEventListeners();
    console.log('12. Event listeners setup');
    
    // Load initial page
    console.log('13. Loading initial page (shop)...');
    await navigateTo('shop');
    console.log('14. Initial page loaded');
    
    console.log('✅ OBTAINUM ready!');
  } catch (err) {
    console.error('❌ Initialization error:', err);
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger);">
        ❌ Initialization error: ${err.message}
        <br><small style="color:var(--text-muted);">Check browser console for details</small>
      </div>`;
    }
  }
});

// ===================== NAVIGATION =====================

export function navigate(page) {
  return navigateTo(page);
}

export async function navigateTo(page) {
  console.log(`Navigating to page: ${page}`);
  
  if (!pageRegistry[page]) {
    console.warn(`Page '${page}' not found in registry`);
    return;
  }
  
  // Check private pages auth
  const privatePages = ['create', 'profile', 'wishlist', 'messages', 'assistant'];
  if (privatePages.includes(page)) {
    const user = await getCurrentUser();
    if (!user) {
      showToast('Please log in to access this page', 'info');
      window.openAuthModal?.();
      return;
    }
  }
  
  currentPage = page;
  await loadPage(page);
  updateNavigation();
  
  // Close mobile nav if open
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) {
    mobileNav.classList.remove('open');
  }
  
  console.log(`Navigation complete: ${page}`);
}

async function loadPage(page) {
  const pageConfig = pageRegistry[page];
  const content = document.getElementById('page-content');
  const loader = document.getElementById('page-loader');
  
  if (!pageConfig) {
    console.error(`Page config not found for ${page}`);
    return;
  }
  
  // Show loader
  if (loader) loader.style.display = 'flex';
  
  try {
    console.log(`Loading page: ${page} from ${pageConfig.file}`);
    
    // Load HTML
    const response = await fetch(pageConfig.file);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to load ${pageConfig.file}`);
    }
    
    const html = await response.text();
    console.log(`Loaded HTML for ${page}, length: ${html.length}`);
    
    if (content) {
      content.innerHTML = html;
    }
    
    // Load CSS dynamically
    const styleId = `page-style-${page}`;
    const existingStyle = document.getElementById(styleId);
    if(!existingStyle && pageStyles[page]) {
      console.log(`Loading CSS: ${pageStyles[page]}`);
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = pageStyles[page];
      document.head.appendChild(link);
    }
    
    // Initialize page if it has init function
    if (pageConfig.init) {
      console.log(`Initializing page: ${page}`);
      try {
        await pageConfig.init();
        console.log(`Page initialized: ${page}`);
      } catch (initErr) {
        console.error(`Error initializing page ${page}:`, initErr);
        throw initErr;
      }
    }
    
    // Lazy load images
    lazyLoadImages();
    
    // Add fade-in animation
    if (content) {
      content.style.opacity = '0';
      setTimeout(() => {
        content.style.transition = 'opacity 0.3s ease-in';
        content.style.opacity = '1';
      }, 10);
    }
    
    console.log(`✅ Page loaded successfully: ${page}`);
    
  } catch (err) {
    console.error('Page load error:', err);
    if (content) {
      content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger);">
        ⚠️ Error loading page: ${err.message}
        <br><small style="color:var(--text-muted);">Check browser console for details</small>
      </div>`;
    }
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function updateNavigation() {
  // Update active nav button
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === currentPage);
  });
  
  // Update mobile nav active state
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === currentPage);
  });
}

// ===================== AUTHENTICATION =====================

async function setupAuthListeners() {
  const user = await getCurrentUser();
  updateAuthUI(user);
  
  // Listen for auth changes
  onAuthStateChange((event, session) => {
    updateAuthUI(session?.user || null);
  });
}

function updateAuthUI(user) {
  const authBtnWrap = document.getElementById('auth-btn-wrap');
  const userAvatarWrap = document.getElementById('user-avatar-wrap');
  const navPrivate = document.querySelector('.nav-private');
  const headerAvatar = document.getElementById('header-avatar');
  
  if (user) {
    // User is logged in
    authBtnWrap.classList.add('hidden');
    userAvatarWrap.classList.remove('hidden');
    navPrivate.classList.remove('hidden');
    
    // Set avatar - use first letter of email
    const letter = user.email?.[0]?.toUpperCase() || '?';
    headerAvatar.textContent = letter;
    
  } else {
    // User is logged out
    authBtnWrap.classList.remove('hidden');
    userAvatarWrap.classList.add('hidden');
    navPrivate.classList.add('hidden');
  }
}

window.openAuthModal = () => {
  openModal('auth-modal');
  isAuthModalOpen = true;
};

// ===================== MODALS SETUP =====================

function setupModals() {
  // Auth modal tabs
  const modalTabs = document.querySelectorAll('.modal-tab');
  const authLogin = document.getElementById('auth-login');
  const authRegister = document.getElementById('auth-register');
  
  modalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      modalTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      if (tabName === 'login') {
        authLogin.classList.remove('hidden');
        authRegister.classList.add('hidden');
      } else {
        authLogin.classList.add('hidden');
        authRegister.classList.remove('hidden');
      }
    });
  });
  
  // Expose modal functions globally
  window.closeModal = (id) => {
    console.log('Closing modal:', id);
    closeModal(id);
  };
  window.openModal = (id) => {
    console.log('Opening modal:', id);
    openModal(id);
  };
  window.closeOnOverlay = (e, id) => {
    if (e.target === e.currentTarget) closeModal(id);
  };
  
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-pass').value;
      const btn = loginForm.querySelector('button[type="submit"]');
      const errorDiv = document.getElementById('login-error');
      
      setLoading(btn, true, 'LOGGING IN...');
      errorDiv.textContent = '';
      
      const success = await loginEmail(email, password);
      if (success) {
        closeModal('auth-modal');
        loginForm.reset();
      } else {
        errorDiv.textContent = 'Login failed. Check your credentials.';
      }
      setLoading(btn, false, 'LOGIN');
    });
  }
  
  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-pass').value;
      const btn = registerForm.querySelector('button[type="submit"]');
      const errorDiv = document.getElementById('register-error');
      
      setLoading(btn, true, 'CREATING ACCOUNT...');
      errorDiv.textContent = '';
      
      const success = await registerEmail(email, password, username);
      if (success) {
        closeModal('auth-modal');
        registerForm.reset();
      } else {
        errorDiv.textContent = 'Registration failed. Try a different email.';
      }
      setLoading(btn, false, 'CREATE ACCOUNT');
    });
  }
  
  // Google login buttons
  document.getElementById('google-login-btn')?.addEventListener('click', loginGoogle);
  document.getElementById('google-register-btn')?.addEventListener('click', loginGoogle);
  
  // Route form
  const routeForm = document.getElementById('route-form');
  if (routeForm) {
    routeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pickup = document.getElementById('pickup-location').value;
      const userLocation = document.getElementById('user-location').value;
      const method = document.getElementById('transport-method').value;
      const btn = routeForm.querySelector('button[type="submit"]');
      
      setLoading(btn, true, 'ANALYZING...');
      await calculateRouteSafety(pickup, userLocation, method);
      setLoading(btn, false, '🔍 ANALYZE ROUTE & SAFETY');
    });
  }
  
  // Use current location button
  document.getElementById('use-current-location')?.addEventListener('click', (e) => {
    e.preventDefault();
    const btn = e.target;
    setLoading(btn, true, 'DETECTING...');
    getUserCurrentLocation();
    setTimeout(() => {
      setLoading(btn, false, '📍 USE MY CURRENT LOCATION');
    }, 2000);
  });
}

// ===================== NAVIGATION SETUP =====================

function setupNavigation() {
  console.log('Setting up navigation...');
  
  // Public and private nav buttons
  const navButtons = document.querySelectorAll('.nav-btn');
  console.log(`Found ${navButtons.length} nav buttons`);
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const page = btn.dataset.page;
      console.log(`Nav clicked: ${page}`);
      if (page) {
        await navigateTo(page);
      }
    });
  });
  
  // Login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Login button clicked');
      window.openAuthModal();
    });
  }
  
  // User avatar menu
  const headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) {
    headerAvatar.addEventListener('click', () => {
      const menu = headerAvatar.nextElementSibling;
      if (menu) {
        menu.classList.toggle('visible');
      }
    });
  }
  
  // Logout button (if it exists)
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
      await navigateTo('shop');
    });
  }
  
  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const mobileNav = document.getElementById('mobile-nav');
      mobileNav.classList.toggle('open');
      
      // Populate mobile nav if empty
      if (!mobileNav.innerHTML) {
        populateMobileNav();
      }
    });
  }
  
  // Logo click goes home
  const logo = document.getElementById('logo');
  if (logo) {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Logo clicked, navigating to shop');
      navigateTo('shop');
    });
  }
  
  console.log('Navigation setup complete');
}

function populateMobileNav() {
  const mobileNav = document.getElementById('mobile-nav');
  const user = document.querySelector('.nav-private')?.classList.contains('hidden') === false;
  
  let html = '';
  
  // Public pages
  html += '<button class="mobile-nav-item" data-page="shop">🛒 SHOP</button>';
  html += '<button class="mobile-nav-item" data-page="about">📖 ABOUT</button>';
  html += '<button class="mobile-nav-item" data-page="contact">📧 CONTACT</button>';
  
  // Private pages
  if (user) {
    html += '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;">';
    html += '<button class="mobile-nav-item" data-page="create">+ CREATE</button>';
    html += '<button class="mobile-nav-item" data-page="wishlist">❤️ WISHLIST</button>';
    html += '<button class="mobile-nav-item" data-page="profile">⚙️ PROFILE</button>';
    html += '<button class="mobile-nav-item" data-page="assistant">🤖 ASSISTANT</button>';
    html += '<button class="mobile-nav-item" data-page="messages">💬 MESSAGES</button>';
    html += '<button class="mobile-nav-item" data-page="donate">🎁 DONATE</button>';
    html += '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;">';
    html += '<button id="logout-btn-mobile" class="mobile-nav-item">🚪 LOGOUT</button>';
  }
  
  mobileNav.innerHTML = html;
  
  // Attach listeners
  mobileNav.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', async () => {
      if (item.id === 'logout-btn-mobile') {
        await signOut();
        await navigateTo('shop');
      } else {
        await navigateTo(item.dataset.page);
      }
    });
  });
}

// ===================== THEME SETUP =====================

function setupTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  
  // Apply initial theme
  applyTheme(currentTheme);
  updateThemeLabel();
  
  // Toggle theme
  themeToggle?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
    updateThemeLabel();
    showToast(`Switched to ${currentTheme} mode`, 'success');
  });
  
  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }
  
  function updateThemeLabel() {
    if (themeLabel) {
      themeLabel.textContent = currentTheme.toUpperCase();
    }
  }
}

// ===================== EVENT LISTENERS =====================

function setupEventListeners() {
  // Search functionality
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      // This will be handled by the shop module
      if (currentPage === 'shop') {
        // Trigger search in shop module
        const event = new CustomEvent('search', { detail: { query } });
        window.dispatchEvent(event);
      }
    });
  }
  
  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name')?.value;
      const email = document.getElementById('contact-email')?.value;
      const subject = document.getElementById('contact-subject')?.value;
      const message = document.getElementById('contact-msg')?.value;
      const btn = contactForm.querySelector('button[type="submit"]');
      
      setLoading(btn, true, 'SENDING...');
      
      try {
        // In a real app, this would send to a backend
        // For now, just show success
        setTimeout(() => {
          showToast('Message sent! We\'ll get back to you soon.', 'success');
          contactForm.reset();
          setLoading(btn, false, 'SEND MESSAGE');
        }, 500);
      } catch (err) {
        showToast('Error sending message', 'error');
        setLoading(btn, false, 'SEND MESSAGE');
      }
    });
  }
  
  // Donate buttons
  document.querySelectorAll('[data-amount]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = btn.dataset.amount;
      showToast(`Support with $${amount}? (Payment integration needed)`, 'info');
    });
  });
  
  document.getElementById('crypto-btn')?.addEventListener('click', () => {
    const cryptoAddresses = document.getElementById('crypto-addresses');
    cryptoAddresses?.classList.toggle('hidden');
  });
}

// ===================== GLOBAL EXPORTS =====================

window.navigate = navigate;
window.navigateTo = navigateTo;
window.getCurrentUser = getCurrentUser;
window.getCurrentProfile = getCurrentProfile;
window.signOut = signOut;
