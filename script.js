/* ============================================================
   FILE: script.js
   OBTAINUM MARKETPLACE — Complete with AI Chat & Listing Suggestions
   ============================================================ */

// ==================== DATABASE CONFIG ====================
// Use environment variables from config.js (created during deployment)
// Fallback for local development
const SUPABASE_URL = window.ENV?.SUPABASE_URL || "https://gotzmuobwuubsugnowxq.supabase.co";
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || "sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs";
const GEMINI_API_KEY = window.ENV?.GEMINI_API_KEY || null;

let db;
let genAI;

try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE" && GEMINI_API_KEY !== "") {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('[OBTAINUM] Gemini AI initialized');
  } else {
    console.warn('[OBTAINUM] Gemini API key not configured');
  }
} catch (e) {
  console.error('[OBTAINUM] Init failed:', e);
}

// ==================== STATE MANAGEMENT ====================
const State = {
  user: null,
  profile: null,
  currentPage: 'shop',
  listings: [],
  filteredListings: [],
  wishlistIds: new Set(),
  activeCategory: 'all',
  activeCondition: 'all',
  activeType: 'all',
  searchQuery: '',
  priceMin: null,
  priceMax: null,
  sortBy: 'newest',
  selectedListing: null,
  editingListingId: null,
  imageFiles: [],
  keepExistingImages: [],
  currentChatPartnerId: null,
  currentListingId: null,
  aiSessionId: null,
  aiMessages: []
};

// ==================== HELPER FUNCTIONS ====================
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-msg">${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function closeOnOverlay(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

function setLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="spinner"></span> ${text}` : text;
}

// ==================== THEME TOGGLE ====================
function initTheme() {
  const saved = localStorage.getItem('obtainum-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(mode) {
  document.body.classList.toggle('light-mode', mode === 'light');
  localStorage.setItem('obtainum-theme', mode);
  const label = document.getElementById('theme-label');
  if (label) label.textContent = mode === 'dark' ? 'DARK' : 'LIGHT';
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-mode');
  applyTheme(isLight ? 'dark' : 'light');
  showToast(isLight ? 'Dark mode activated' : 'Light mode activated', 'info');
}

// ==================== IMAGE CAROUSEL FUNCTION ====================
function createImageCarousel(images, listingId) {
  if (!images || images.length === 0) {
    return `<div class="card-no-image">📦</div>`;
  }
  
  if (images.length === 1) {
    return `<img src="${escHtml(images[0])}" alt="Listing image" style="width:100%;height:100%;object-fit:cover;" />`;
  }
  
  const carouselId = `carousel-${listingId}`;
  return `
    <div class="image-carousel" id="${carouselId}">
      <div class="carousel-container">
        <div class="carousel-slides" id="${carouselId}-slides">
          ${images.map((img, idx) => `
            <div class="carousel-slide" data-index="${idx}">
              <img src="${escHtml(img)}" alt="Image ${idx + 1}" loading="lazy" />
            </div>
          `).join('')}
        </div>
        <button class="carousel-btn prev" onclick="event.stopPropagation(); changeSlide('${carouselId}', -1)">‹</button>
        <button class="carousel-btn next" onclick="event.stopPropagation(); changeSlide('${carouselId}', 1)">›</button>
        <div class="carousel-dots" id="${carouselId}-dots">
          ${images.map((_, idx) => `<span class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="event.stopPropagation(); goToSlide('${carouselId}', ${idx})"></span>`).join('')}
        </div>
        <div class="image-count-badge">${images.length} images</div>
      </div>
    </div>
  `;
}

window.changeSlide = function(carouselId, direction) {
  const slides = document.getElementById(`${carouselId}-slides`);
  const dots = document.getElementById(`${carouselId}-dots`);
  if (!slides) return;
  
  const currentIndex = parseInt(slides.dataset.currentIndex || '0');
  const totalSlides = slides.children.length;
  let newIndex = currentIndex + direction;
  
  if (newIndex < 0) newIndex = totalSlides - 1;
  if (newIndex >= totalSlides) newIndex = 0;
  
  slides.style.transform = `translateX(-${newIndex * 100}%)`;
  slides.dataset.currentIndex = newIndex;
  
  if (dots) {
    const dotElements = dots.querySelectorAll('.carousel-dot');
    dotElements.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === newIndex);
    });
  }
};

window.goToSlide = function(carouselId, index) {
  const slides = document.getElementById(`${carouselId}-slides`);
  const dots = document.getElementById(`${carouselId}-dots`);
  if (!slides) return;
  
  slides.style.transform = `translateX(-${index * 100}%)`;
  slides.dataset.currentIndex = index;
  
  if (dots) {
    const dotElements = dots.querySelectorAll('.carousel-dot');
    dotElements.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === index);
    });
  }
};

// ==================== NAVIGATION ====================
function navigate(page) {
  const pages = ['shop', 'detail', 'create', 'profile', 'wishlist', 'messages', 'assistant', 'donate'];
  if (!pages.includes(page)) page = 'shop';
  
  pages.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.remove('active');
  });
  
  document.getElementById(`page-${page}`)?.classList.add('active');
  State.currentPage = page;
  updateNavActive(page);
  
  updateRestrictedPageUI();
  
  if (page === 'shop') loadListings();
  if (page === 'profile' && State.user) loadProfile();
  if (page === 'wishlist' && State.user) loadWishlist();
  if (page === 'create' && State.user) initCreatePage();
  if (page === 'messages' && State.user) loadMessages();
  if (page === 'assistant') {
    updateAssistantUI();
    loadAIChatHistory();
  }
}

function updateNavActive(page) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const el = document.getElementById(`nav-${page}`);
  if (el) el.classList.add('active');
}

function updateRestrictedPageUI() {
  const messagesLoginNotice = document.getElementById('messages-login-notice');
  const chatForm = document.getElementById('chatForm');
  const conversationList = document.getElementById('conversationList');
  const activeChatHeader = document.getElementById('activeChatHeader');
  const chatThread = document.getElementById('chatThread');
  
  if (!State.user) {
    if (messagesLoginNotice) messagesLoginNotice.classList.remove('hidden');
    if (chatForm) chatForm.style.display = 'none';
    if (conversationList) conversationList.innerHTML = '<div class="empty-state-small">Login to see conversations</div>';
    if (activeChatHeader) activeChatHeader.innerHTML = 'Login to chat';
    if (chatThread) chatThread.innerHTML = '<div class="empty-state-small">🔐 Please login to send and receive messages</div>';
  } else {
    if (messagesLoginNotice) messagesLoginNotice.classList.add('hidden');
  }
  
  updateAssistantUI();
}

function updateAssistantUI() {
  const assistantLoginNotice = document.getElementById('assistant-login-notice');
  const assistantInput = document.getElementById('assistantInput');
  const assistantBtn = document.getElementById('askAssistantBtn');
  const assistantSuggestions = document.querySelector('.assistant-suggestions');
  
  if (!State.user) {
    if (assistantLoginNotice) assistantLoginNotice.classList.remove('hidden');
    if (assistantInput) assistantInput.disabled = true;
    if (assistantBtn) assistantBtn.disabled = true;
    if (assistantSuggestions) {
      assistantSuggestions.style.opacity = '0.5';
      assistantSuggestions.style.pointerEvents = 'none';
    }
  } else {
    if (assistantLoginNotice) assistantLoginNotice.classList.add('hidden');
    if (assistantInput) assistantInput.disabled = false;
    if (assistantBtn) assistantBtn.disabled = false;
    if (assistantSuggestions) {
      assistantSuggestions.style.opacity = '1';
      assistantSuggestions.style.pointerEvents = 'auto';
    }
  }
}

// ==================== AUTH MODULE ====================
async function initAuth() {
  if (!db) return;
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    await onAuthChange(session.user);
  }
  
  db.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await onAuthChange(session.user);
    } else {
      onSignOut();
    }
    updateRestrictedPageUI();
    if (State.currentPage === 'messages' && State.user) loadMessages();
    if (State.currentPage === 'assistant') updateAssistantUI();
  });
}

async function onAuthChange(user) {
  State.user = user;
  
  let { data: profile, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (!profile) {
    console.log("Profile not found, creating fallback...");
    
    let username = user.user_metadata?.username || 
                   user.user_metadata?.full_name || 
                   user.email?.split('@')[0] || 
                   'user_' + Math.random().toString(36).substring(2, 8);
    
    username = username.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 28);
    if (username.length < 3) username = username + '_usr';
    
    const newProfileData = {
      id: user.id,
      email: user.email,
      username: username,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: created, error: createErr } = await db
      .from('profiles')
      .insert(newProfileData)
      .select()
      .single();
    
    if (!createErr) {
      profile = created;
      showToast(`Welcome, ${username}!`, 'success');
    }
  }
  
  State.profile = profile;
  updateAuthUI();
  await loadWishlistIds();
  await initAISession();
}

function onSignOut() {
  State.user = null;
  State.profile = null;
  State.wishlistIds.clear();
  State.currentChatPartnerId = null;
  State.currentListingId = null;
  State.aiSessionId = null;
  State.aiMessages = [];
  updateAuthUI();
  if (State.currentPage === 'profile') navigate('shop');
  if (State.currentPage === 'messages') navigate('shop');
  if (State.currentPage === 'wishlist') navigate('shop');
  if (State.currentPage === 'create') navigate('shop');
  if (State.currentPage === 'assistant') updateAssistantUI();
  showToast('Signed out successfully.', 'info');
}

function updateAuthUI() {
  const btnWrap = document.getElementById('auth-btn-wrap');
  const avatarWrap = document.getElementById('user-avatar-wrap');
  const avatar = document.getElementById('header-avatar');
  
  if (State.user) {
    btnWrap.classList.add('hidden');
    avatarWrap.classList.remove('hidden');
    const name = State.profile?.username || State.user.email || '?';
    if (State.profile?.avatar_url) {
      avatar.innerHTML = `<img src="${State.profile.avatar_url}" alt="${escHtml(name)}" />`;
    } else {
      avatar.textContent = name.charAt(0).toUpperCase();
    }
  } else {
    btnWrap.classList.remove('hidden');
    avatarWrap.classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  
  if (btn) setLoading(btn, true, 'LOGGING IN...');
  if (errEl) errEl.classList.remove('show');
  
  try {
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    closeModal('auth-modal');
    showToast('Welcome back to OBTAINUM!', 'success');
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Login failed.';
      errEl.classList.add('show');
    }
  } finally {
    if (btn) setLoading(btn, false, 'LOGIN TO OBTAINUM');
  }
}

async function signInWithGoogle() {
  if (!db) return;
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error('Google sign-in error:', err);
    showToast('Google sign-in failed: ' + err.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('register-error');
  const btn = document.getElementById('register-btn');
  
  if (btn) setLoading(btn, true, 'CREATING ACCOUNT...');
  if (errEl) errEl.classList.remove('show');
  
  const cleanUsername = username.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 28);
  if (cleanUsername.length < 3) {
    if (errEl) {
      errEl.textContent = 'Username must be at least 3 characters (letters, numbers, underscores only)';
      errEl.classList.add('show');
    }
    if (btn) setLoading(btn, false, 'CREATE ACCOUNT');
    return;
  }
  
  try {
    const { data, error } = await db.auth.signUp({
      email,
      password: pass,
      options: { 
        data: { username: cleanUsername }
      }
    });
    
    if (error) throw error;
    
    if (data.session) {
      closeModal('auth-modal');
      showToast('Account created! Welcome to OBTAINUM.', 'success');
    } else {
      document.getElementById('register-form-wrap').innerHTML = `
        <div class="auth-confirm-panel" style="text-align:center;padding:20px;">
          <div class="confirm-icon" style="font-size:3rem;">✉️</div>
          <div class="confirm-title" style="font-weight:bold;margin:16px 0;">CHECK YOUR EMAIL</div>
          <div class="confirm-msg">Click the confirmation link to activate your account.</div>
          <button class="btn btn-outline w-full" onclick="closeModal('auth-modal')">GOT IT</button>
        </div>
      `;
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Registration failed.';
      errEl.classList.add('show');
    }
  } finally {
    if (btn) setLoading(btn, false, 'CREATE ACCOUNT');
  }
}

async function signOut() {
  await db.auth.signOut();
}

function openAuthModal() {
  document.getElementById('auth-modal').classList.add('open');
}

function switchAuthTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('auth-login');
  const regForm = document.getElementById('auth-register');
  
  if (tab === 'login') {
    if (loginTab) loginTab.classList.add('active');
    if (regTab) regTab.classList.remove('active');
    if (loginForm) loginForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
  } else {
    if (regTab) regTab.classList.add('active');
    if (loginTab) loginTab.classList.remove('active');
    if (regForm) regForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
  }
}

// ==================== AI CHAT FUNCTIONS (SIMPLE GEMINI CHAT) ====================

async function initAISession() {
  if (!State.user) return;
  if (!State.aiSessionId) {
    State.aiSessionId = crypto.randomUUID();
  }
}

async function loadAIChatHistory() {
  if (!State.user) return;
  
  try {
    const { data, error } = await db
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', State.user.id)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    State.aiMessages = data || [];
    
    const messagesDiv = document.getElementById('assistantMessages');
    if (messagesDiv) {
      if (State.aiMessages.length === 0) {
        messagesDiv.innerHTML = '<div class="assistant-message bot">✨ Hi! I\'m your OBTAINUM AI assistant powered by Gemini. Ask me anything about the marketplace!</div>';
      } else {
        messagesDiv.innerHTML = '';
        State.aiMessages.forEach(msg => {
          const msgDiv = document.createElement('div');
          msgDiv.className = `assistant-message ${msg.sender_type === 'user' ? 'user' : 'bot'}`;
          msgDiv.innerHTML = msg.content.replace(/\n/g, '<br>');
          messagesDiv.appendChild(msgDiv);
        });
      }
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  } catch (err) {
    console.error('Error loading AI chat history:', err);
  }
}

async function saveAIMessage(senderType, content) {
  if (!State.user) return;
  
  try {
    const { error } = await db
      .from('ai_chat_messages')
      .insert({
        sender_type: senderType,
        user_id: State.user.id,
        session_id: State.aiSessionId,
        content: content
      });
    
    if (error) throw error;
    
    State.aiMessages.push({
      sender_type: senderType,
      content: content,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving AI message:', err);
  }
}

async function askAssistant() {
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  const input = document.getElementById('assistantInput');
  const question = input?.value.trim();
  if (!question) return;
  
  const messagesDiv = document.getElementById('assistantMessages');
  if (!messagesDiv) return;
  
  // Add user message to UI
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'assistant-message user';
  userMsgDiv.textContent = question;
  messagesDiv.appendChild(userMsgDiv);
  
  // Save user message to database
  await saveAIMessage('user', question);
  
  if (input) input.value = '';
  
  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'assistant-message bot';
  typingDiv.innerHTML = '<span class="spinner" style="width:16px;height:16px;"></span> Thinking...';
  messagesDiv.appendChild(typingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  try {
    let aiResponse;
    
    // Use Gemini API if available
    if (genAI) {
      aiResponse = await getGeminiResponse(question);
    } else {
      aiResponse = "⚠️ Gemini API is not configured. Please add your API key to enable AI chat.\n\nYou can still browse listings and use all other features!";
    }
    
    // Remove typing indicator
    typingDiv.remove();
    
    // Add AI response to UI
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'assistant-message bot';
    botMsgDiv.innerHTML = aiResponse.replace(/\n/g, '<br>');
    messagesDiv.appendChild(botMsgDiv);
    
    // Save AI response to database
    await saveAIMessage('ai', aiResponse);
    
  } catch (err) {
    console.error('AI Assistant error:', err);
    typingDiv.remove();
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'assistant-message bot';
    errorMsg.textContent = '⚠️ Sorry, I encountered an error. Please try again later.';
    messagesDiv.appendChild(errorMsg);
  }
  
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function getGeminiResponse(userMessage) {
  if (!genAI) {
    return "⚠️ Gemini API is not configured. Please add your API key to continue.";
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `You are OBTAINUM AI, a friendly and helpful assistant for a marketplace website. 
Your role is to help users with general questions about buying, selling, collectibles, pricing, safety tips, and marketplace navigation.

Keep responses:
- Concise and helpful (2-3 paragraphs max)
- Friendly and approachable
- Use bullet points when listing multiple items
- Stay on topic

User question: ${userMessage}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (err) {
    console.error('Gemini API error:', err);
    return "⚠️ Sorry, I'm having trouble connecting right now. Please try again in a moment.";
  }
}

function askSuggestion(suggestion) {
  const input = document.getElementById('assistantInput');
  if (input) input.value = suggestion;
  askAssistant();
}

// ==================== LISTING SUGGESTIONS (AI Price Analysis) ====================

async function generateAndSaveListingSuggestion(listingId) {
  if (!db) return null;
  
  // Check if suggestion already exists
  const { data: existingListing } = await db
    .from('listings')
    .select('ai_suggestions')
    .eq('id', listingId)
    .single();
  
  if (existingListing?.ai_suggestions) {
    return existingListing.ai_suggestions;
  }
  
  // Get the full listing data
  const { data: listing, error } = await db
    .from('listings')
    .select('*, profiles:seller_id(username, rating, location)')
    .eq('id', listingId)
    .single();
  
  if (error || !listing) {
    console.error('Could not fetch listing:', error);
    return null;
  }
  
  let suggestion = null;
  
  // Try Gemini API first
  if (genAI) {
    try {
      suggestion = await analyzeListingWithGemini(listing);
    } catch (err) {
      console.error('Gemini analysis failed:', err);
      suggestion = getFallbackListingAnalysis(listing);
    }
  } else {
    suggestion = getFallbackListingAnalysis(listing);
  }
  
  // Save to database
  if (suggestion) {
    const { error: updateError } = await db
      .from('listings')
      .update({ ai_suggestions: suggestion })
      .eq('id', listingId);
    
    if (updateError) {
      console.error('Failed to save AI suggestion:', updateError);
    }
  }
  
  return suggestion;
}

async function analyzeListingWithGemini(listing) {
  if (!genAI) return getFallbackListingAnalysis(listing);
  
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `You are OBTAINUM's pricing AI. Analyze this marketplace listing and provide a JSON response.

LISTING DETAILS:
- Item Name: ${listing.name}
- Category: ${listing.category}
- Condition: ${listing.condition}
- Listed Price: $${listing.price}
- MSRP (if available): ${listing.msrp ? '$' + listing.msrp : 'Not provided'}

Return ONLY valid JSON with this exact structure:
{
  "itemIdentification": "What specific product this appears to be",
  "originalRetailPrice": "Original MSRP/retail price when new",
  "currentMarketValue": "Estimated current market value",
  "valueAssessment": "good deal / fair price / overpriced",
  "score": 0-100,
  "reasoning": "Brief explanation",
  "recommendation": "buy / negotiate / avoid"
}`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getFallbackListingAnalysis(listing);
  } catch (err) {
    console.error('Gemini analysis error:', err);
    return getFallbackListingAnalysis(listing);
  }
}

function getFallbackListingAnalysis(listing) {
  let score = 50;
  let valueAssessment = "fair price";
  let recommendation = "consider";
  
  if (listing.msrp && listing.msrp > 0) {
    const percentOfMsrp = (listing.price / listing.msrp) * 100;
    if (percentOfMsrp <= 60) {
      score = 90;
      valueAssessment = "excellent deal";
      recommendation = "buy";
    } else if (percentOfMsrp <= 85) {
      score = 75;
      valueAssessment = "good deal";
      recommendation = "buy";
    } else if (percentOfMsrp <= 100) {
      score = 60;
      valueAssessment = "fair price";
      recommendation = "consider";
    } else if (percentOfMsrp <= 125) {
      score = 40;
      valueAssessment = "overpriced";
      recommendation = "negotiate";
    } else {
      score = 25;
      valueAssessment = "significantly overpriced";
      recommendation = "avoid";
    }
  }
  
  const conditionAdjustment = {
    'new': 1.0,
    'like-new': 0.9,
    'good': 0.75,
    'fair': 0.6,
    'poor': 0.4
  };
  score = Math.round(score * (conditionAdjustment[listing.condition] || 0.7));
  
  return {
    itemIdentification: listing.name,
    originalRetailPrice: listing.msrp ? `$${listing.msrp}` : "Unknown",
    currentMarketValue: `$${Math.round(listing.price * 0.8)} - $${Math.round(listing.price * 1.2)}`,
    valueAssessment: valueAssessment,
    score: Math.min(100, Math.max(0, score)),
    reasoning: `Based on ${listing.condition} condition in "${listing.category}" category.`,
    recommendation: recommendation
  };
}

async function displayListingSuggestion(listingId) {
  const suggestion = await generateAndSaveListingSuggestion(listingId);
  const container = document.getElementById(`ai-suggestions-${listingId}`);
  
  if (!container || !suggestion) return;
  
  const scoreColor = suggestion.score >= 70 ? 'var(--neon)' : (suggestion.score >= 40 ? 'var(--warning)' : 'var(--danger)');
  
  container.innerHTML = `
    <div class="ai-suggestion-card" style="background:var(--bg-2); border-radius:var(--radius-lg); padding:16px; margin-top:16px; border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="ai-dot"></span>
          <strong style="color:var(--neon);">🤖 AI PRICE ANALYSIS</strong>
        </div>
        <div style="background:${scoreColor}; color:#001a07; padding:4px 12px; border-radius:20px; font-weight:bold;">
          ${suggestion.valueAssessment.toUpperCase()} • ${suggestion.score}%
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:12px; margin-bottom:16px;">
        <div style="background:var(--bg-3); padding:10px; border-radius:8px;">
          <div style="font-size:11px; color:var(--text-muted);">🔍 IDENTIFIED AS</div>
          <div style="font-weight:600;">${escHtml(suggestion.itemIdentification)}</div>
        </div>
        <div style="background:var(--bg-3); padding:10px; border-radius:8px;">
          <div style="font-size:11px; color:var(--text-muted);">💰 ORIGINAL PRICE</div>
          <div style="font-weight:600;">${suggestion.originalRetailPrice}</div>
        </div>
        <div style="background:var(--bg-3); padding:10px; border-radius:8px;">
          <div style="font-size:11px; color:var(--text-muted);">📈 CURRENT VALUE</div>
          <div style="font-weight:600;">${suggestion.currentMarketValue}</div>
        </div>
      </div>
      
      <div style="background:rgba(0,255,65,0.05); padding:12px; border-radius:8px; margin-bottom:12px;">
        <div style="font-weight:600; margin-bottom:6px;">📝 ANALYSIS</div>
        <div style="font-size:14px;">${escHtml(suggestion.reasoning)}</div>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:12px; border-top:1px solid var(--border);">
        <span style="font-size:13px;">🏷️ ${suggestion.recommendation === 'buy' ? '✅ RECOMMENDED' : (suggestion.recommendation === 'negotiate' ? '🤝 TRY NEGOTIATING' : '⚠️ CONSIDER ALTERNATIVES')}</span>
        <span style="font-size:11px; color:var(--text-muted);">AI analysis • generated once</span>
      </div>
    </div>
  `;
}

// ==================== LISTINGS MODULE ====================
// [Keep all your existing listing functions - loadListings, applyFilters, etc.]
// They are unchanged from your original file

// ... (I'm omitting the rest of your existing functions for brevity, but they remain the same)

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await initAuth();
  initChat();
  navigate('shop');
  
  const categoryChips = document.getElementById('category-chips');
  if (categoryChips) {
    const categories = ['all', 'Electronics', 'Clothing & Accessories', 'Collectibles', 'Toys & Figures', 'Sports & Outdoors', 'Books & Media', 'Home & Garden', 'Tools & Equipment', 'Other'];
    categoryChips.innerHTML = categories.map(cat => 
      `<button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="${cat}" onclick="selectCategory(this, '${cat}')">${cat === 'all' ? 'All' : cat}</button>`
    ).join('');
  }
  
  const conditionChips = document.getElementById('condition-chips');
  if (conditionChips) {
    const conditions = ['all', 'new', 'like-new', 'good', 'fair', 'poor'];
    conditionChips.innerHTML = conditions.map(cond => 
      `<button class="chip ${cond === 'all' ? 'active' : ''}" data-cond="${cond}" onclick="selectCondition(this, '${cond}')">${cond === 'all' ? 'Any' : cond}</button>`
    ).join('');
  }
  
  const typeChips = document.getElementById('type-chips');
  if (typeChips) {
    const types = ['all', 'buy-now', 'offers', 'auction'];
    typeChips.innerHTML = types.map(type => 
      `<button class="chip ${type === 'all' ? 'active' : ''}" data-type="${type}" onclick="selectType(this, '${type}')">${type === 'all' ? 'All' : type.replace('-', ' ').toUpperCase()}</button>`
    ).join('');
  }
  
  const categorySelect = document.getElementById('c-category');
  if (categorySelect) {
    const categories = ['Electronics', 'Clothing & Accessories', 'Collectibles', 'Toys & Figures', 'Sports & Outdoors', 'Books & Media', 'Home & Garden', 'Tools & Equipment', 'Other'];
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }
  
  if (!navigator.onLine) showErrorBanner();
  
  console.log('%c OBTAINUM INITIALIZED', 'background:#00ff41;color:#001a07;font-family:monospace;padding:4px 8px;');
});
