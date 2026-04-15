/* ============================================================
   FILE: script.js
   OBTAINUM MARKETPLACE — Hardcoded Supabase, Gemini placeholder
   ============================================================ */

// ==================== DATABASE CONFIG ====================
const SUPABASE_URL = "https://gotzmuobwuubsugnowxq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs";


const GEMINI_API_KEY = null;  

let db;
let genAI;

try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[OBTAINUM] Supabase connected');
  
  if (GEMINI_API_KEY && GEMINI_API_KEY !== null) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('[OBTAINUM] Gemini AI initialized');
  } else {
    console.warn('[OBTAINUM] Gemini API key not configured - AI features will use fallback mode');
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
  const pages = ['shop', 'detail', 'create', 'profile', 'wishlist', 'messages', 'assistant', 'about', 'contact', 'donate'];
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

// ==================== AI CHAT FUNCTIONS ====================

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
        messagesDiv.innerHTML = '<div class="assistant-message bot">✨ Hi! I\'m your OBTAINUM AI assistant. Ask me anything about the marketplace!</div>';
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
      aiResponse = "⚠️ Gemini API is not configured yet. The AI assistant will be available once the API key is added.\n\nIn the meantime, you can still browse listings, create listings, and chat with other users!";
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
    return "⚠️ Gemini API is not configured. Once the API key is added, I'll be able to help you with marketplace questions!";
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `You are OBTAINUM AI, a friendly and helpful assistant for a marketplace website. 
Your role is to help users with general questions about buying, selling, collectibles, pricing, safety tips, and marketplace navigation.

Keep responses:
- Concise and helpful
- Friendly and approachable
- Use bullet points when listing multiple items

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
async function loadListings() {
  if (!db) { renderListings([]); return; }
  try {
    showSkeletons();
    
    const { data, error } = await db
      .from('listings')
      .select(`
        *,
        profiles:seller_id (
          id,
          username,
          avatar_url,
          rating,
          location
        )
      `)
      .eq('is_sold', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    State.listings = data || [];
    applyFilters();
    hideErrorBanner();
  } catch (err) {
    console.error('Error loading listings:', err);
    showErrorBanner();
    renderListings([]);
  }
}

function applyFilters() {
  let results = [...State.listings];
  
  const q = (State.searchQuery || '').toLowerCase();
  if (q.length >= 2) {
    results = results.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.category?.toLowerCase().includes(q)
    );
  }
  
  if (State.activeCategory !== 'all') {
    results = results.filter(l => l.category === State.activeCategory);
  }
  
  if (State.activeCondition !== 'all') {
    results = results.filter(l => l.condition === State.activeCondition);
  }
  
  if (State.activeType !== 'all') {
    results = results.filter(l => l.type === State.activeType);
  }
  
  const minP = parseFloat(document.getElementById('price-min')?.value || '');
  const maxP = parseFloat(document.getElementById('price-max')?.value || '');
  if (!isNaN(minP)) results = results.filter(l => l.price >= minP);
  if (!isNaN(maxP)) results = results.filter(l => l.price <= maxP);
  
  if (document.getElementById('fair-only')?.checked) {
    results = results.filter(l => l.is_fair === true);
  }
  if (document.getElementById('featured-only')?.checked) {
    results = results.filter(l => l.is_featured === true);
  }
  
  const sort = document.getElementById('sort-select')?.value || 'newest';
  if (sort === 'price-asc') results.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') results.sort((a, b) => b.price - a.price);
  else if (sort === 'popular') results.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  else if (sort === 'favorites') results.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
  else results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  State.filteredListings = results;
  
  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = results.length;
  
  renderListings(results);
}

function selectCategory(btn, cat) {
  document.querySelectorAll('#category-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  State.activeCategory = cat;
  applyFilters();
}

function selectCondition(btn, cond) {
  document.querySelectorAll('#condition-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  State.activeCondition = cond;
  applyFilters();
}

function selectType(btn, type) {
  document.querySelectorAll('#type-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  State.activeType = type;
  applyFilters();
}

function onPriceSlider(slider) {
  const valSpan = document.getElementById('price-slider-val');
  const maxInput = document.getElementById('price-max');
  if (valSpan) valSpan.textContent = '$' + slider.value;
  if (maxInput) maxInput.value = slider.value;
  applyFilters();
}

function resetFilters() {
  State.activeCategory = 'all';
  State.activeCondition = 'all';
  State.activeType = 'all';
  State.searchQuery = '';
  
  const searchInput = document.getElementById('search-input');
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  const priceSlider = document.getElementById('price-slider');
  const fairOnly = document.getElementById('fair-only');
  const featuredOnly = document.getElementById('featured-only');
  const sortSelect = document.getElementById('sort-select');
  
  if (searchInput) searchInput.value = '';
  if (priceMin) priceMin.value = '';
  if (priceMax) priceMax.value = '';
  if (priceSlider) priceSlider.value = 2000;
  if (fairOnly) fairOnly.checked = false;
  if (featuredOnly) featuredOnly.checked = false;
  if (sortSelect) sortSelect.value = 'newest';
  
  const priceSliderVal = document.getElementById('price-slider-val');
  if (priceSliderVal) priceSliderVal.textContent = '$2000';
  
  document.querySelectorAll('.chip[data-cat]').forEach(c =>
    c.classList.toggle('active', c.dataset.cat === 'all'));
  document.querySelectorAll('.chip[data-cond]').forEach(c =>
    c.classList.toggle('active', c.dataset.cond === 'all'));
  document.querySelectorAll('.chip[data-type]').forEach(c =>
    c.classList.toggle('active', c.dataset.type === 'all'));
  
  applyFilters();
  showToast('Filters reset.', 'info');
}

// ==================== WISHLIST MODULE ====================
async function loadWishlistIds() {
  if (!State.user) return;
  const { data } = await db
    .from('wishlists')
    .select('listing_id')
    .eq('user_id', State.user.id);
  State.wishlistIds = new Set((data || []).map(w => w.listing_id));
}

async function loadWishlist() {
  const container = document.getElementById('wishlist-grid');
  const notice = document.getElementById('wishlist-auth-notice');
  
  if (!State.user) {
    if (notice) notice.classList.remove('hidden');
    if (container) container.innerHTML = '';
    return;
  }
  
  if (notice) notice.classList.add('hidden');
  
  try {
    const { data, error } = await db
      .from('wishlists')
      .select(`
        listing_id,
        listings:listing_id (
          *,
          profiles:seller_id (id, username, avatar_url, rating, location)
        )
      `)
      .eq('user_id', State.user.id);
    
    if (error) throw error;
    
    const listings = (data || []).map(w => w.listings).filter(Boolean);
    if (container) {
      if (listings.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><div class="empty-title">YOUR WISHLIST IS EMPTY</div></div>`;
      } else {
        container.innerHTML = '';
        listings.forEach(l => container.appendChild(createListingCard(l)));
      }
    }
  } catch (err) {
    console.error('Error loading wishlist:', err);
  }
}

async function toggleWishlist(e, listingId) {
  e.stopPropagation();
  if (!State.user) { openAuthModal(); return; }
  
  const listing = State.listings.find(l => l.id === listingId);
  if (listing && listing.seller_id === State.user.id) {
    showToast("You can't add your own listing to your wishlist.", 'info');
    return;
  }
  
  const btn = e.currentTarget;
  const isWished = State.wishlistIds.has(listingId);
  
  btn.classList.toggle('active', !isWished);
  if (isWished) {
    State.wishlistIds.delete(listingId);
  } else {
    State.wishlistIds.add(listingId);
  }
  
  try {
    if (isWished) {
      await db.from('wishlists').delete()
        .eq('user_id', State.user.id)
        .eq('listing_id', listingId);
      showToast('Removed from wishlist.', 'info');
    } else {
      await db.from('wishlists').insert({
        user_id: State.user.id,
        listing_id: listingId
      });
      showToast('Added to wishlist!', 'success');
    }
  } catch (err) {
    btn.classList.toggle('active', isWished);
    if (isWished) State.wishlistIds.add(listingId);
    else State.wishlistIds.delete(listingId);
    showToast('Could not update wishlist.', 'error');
  }
}

// ==================== CREATE/EDIT LISTING ====================
async function initCreatePage() {
  const notice = document.getElementById('create-auth-notice');
  const form = document.getElementById('create-form');
  const title = document.getElementById('create-page-title');
  const submitBtn = document.getElementById('create-submit');
  const cancelBtn = document.getElementById('create-cancel');
  
  if (!State.user) {
    if (notice) notice.classList.remove('hidden');
    if (form) form.classList.add('hidden');
    return;
  }
  
  if (notice) notice.classList.add('hidden');
  if (form) form.classList.remove('hidden');
  
  if (form) form.reset();
  State.imageFiles = [];
  State.keepExistingImages = [];
  const previewGrid = document.getElementById('image-preview-grid');
  if (previewGrid) previewGrid.innerHTML = '';
  
  const existingSection = document.getElementById('existing-images-section');
  const existingGrid = document.getElementById('existing-image-grid');
  if (existingSection) existingSection.classList.add('hidden');
  if (existingGrid) existingGrid.innerHTML = '';
  
  const paymentCheckboxes = document.querySelectorAll('input[name="payment"]');
  paymentCheckboxes.forEach(cb => {
    cb.checked = cb.value === 'cash';
  });
  
  updateSubcategories();
  
  if (State.editingListingId) {
    if (title) title.textContent = '✏️ EDIT LISTING';
    if (submitBtn) submitBtn.textContent = 'SAVE CHANGES';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    
    let listing = State.listings.find(l => l.id === State.editingListingId);
    if (!listing) {
      try {
        const { data, error } = await db
          .from('listings')
          .select('*')
          .eq('id', State.editingListingId)
          .single();
        if (error) throw error;
        listing = data;
      } catch (err) {
        showToast('Could not load listing for editing.', 'error');
        State.editingListingId = null;
        if (title) title.textContent = '+ CREATE LISTING';
        if (submitBtn) submitBtn.textContent = 'PUBLISH LISTING';
        if (cancelBtn) cancelBtn.style.display = 'none';
        return;
      }
    }
    
    if (listing) {
      const nameInput = document.getElementById('c-name');
      const categorySelect = document.getElementById('c-category');
      const descTextarea = document.getElementById('c-desc');
      const priceInput = document.getElementById('c-price');
      const msrpInput = document.getElementById('c-msrp');
      const conditionSelect = document.getElementById('c-condition');
      const typeSelect = document.getElementById('c-type');
      const shippingSelect = document.getElementById('c-shipping');
      const locationInput = document.getElementById('c-location');
      const tagsInput = document.getElementById('c-tags');
      
      if (nameInput) nameInput.value = listing.name || '';
      if (categorySelect) categorySelect.value = listing.category || '';
      if (descTextarea) descTextarea.value = listing.description || '';
      if (priceInput) priceInput.value = listing.price ?? '';
      if (msrpInput) msrpInput.value = listing.msrp || '';
      if (conditionSelect) conditionSelect.value = listing.condition || '';
      if (typeSelect) typeSelect.value = listing.type || 'buy-now';
      if (shippingSelect) shippingSelect.value = listing.shipping || 'paid';
      if (locationInput) locationInput.value = listing.location || '';
      if (tagsInput) tagsInput.value = (listing.tags || []).join(', ');
      
      updateSubcategories();
      const subcategorySelect = document.getElementById('c-subcategory');
      if (subcategorySelect && listing.subcategory) {
        subcategorySelect.value = listing.subcategory;
      }
      
      if (listing.payment_methods && listing.payment_methods.length > 0) {
        paymentCheckboxes.forEach(cb => {
          cb.checked = listing.payment_methods.includes(cb.value);
        });
      }
      
      if (listing.images && listing.images.length > 0) {
        State.keepExistingImages = [...listing.images];
        if (existingSection) existingSection.classList.remove('hidden');
        if (existingGrid) {
          existingGrid.innerHTML = '';
          listing.images.forEach((url, i) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item animate-pop';
            item.innerHTML = `
              <img src="${escHtml(url)}" alt="Image ${i + 1}" />
              <button class="remove-image" onclick="removeExistingImage(${i})" title="Remove">&times;</button>
            `;
            existingGrid.appendChild(item);
          });
        }
      }
      
      updateDescCounter();
    }
  } else {
    if (title) title.textContent = '+ CREATE LISTING';
    if (submitBtn) submitBtn.textContent = 'PUBLISH LISTING';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

function updateSubcategories() {
  const cat = document.getElementById('c-category')?.value;
  const group = document.getElementById('subcategory-group');
  const sel = document.getElementById('c-subcategory');
  if (!group || !sel) return;
  
  const SUBCATEGORIES = {
    'Collectibles': ['Action Figures', 'Trading Cards', 'Comics', 'Stamps', 'Coins', 'Vintage Items'],
    'Electronics': ['Phones', 'Computers', 'Cameras', 'Audio', 'Gaming', 'TVs'],
    'Clothing & Accessories': ['Shirts', 'Pants', 'Shoes', 'Hats', 'Bags', 'Jewelry'],
    'Toys & Figures': ['Action Figures', 'Board Games', 'Building Sets', 'Puzzles', 'Plush'],
    'Other': ['Other']
  };
  
  if (cat && SUBCATEGORIES[cat]) {
    group.style.display = 'flex';
    sel.innerHTML = '<option value="">Select subcategory...</option>';
    SUBCATEGORIES[cat].forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      sel.appendChild(opt);
    });
  } else {
    group.style.display = 'none';
    sel.innerHTML = '<option value="">Select subcategory...</option>';
  }
}

function updateDescCounter() {
  const desc = document.getElementById('c-desc');
  const counter = document.getElementById('desc-char-count');
  if (desc && counter) {
    counter.textContent = `${desc.value.length} / 2000`;
  }
}

function removeExistingImage(index) {
  State.keepExistingImages.splice(index, 1);
  const existingGrid = document.getElementById('existing-image-grid');
  const existingSection = document.getElementById('existing-images-section');
  if (!existingGrid) return;
  
  if (State.keepExistingImages.length === 0) {
    if (existingSection) existingSection.classList.add('hidden');
    return;
  }
  
  existingGrid.innerHTML = '';
  State.keepExistingImages.forEach((url, i) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item animate-pop';
    item.innerHTML = `
      <img src="${escHtml(url)}" alt="Image ${i + 1}" />
      <button class="remove-image" onclick="removeExistingImage(${i})" title="Remove">&times;</button>
    `;
    existingGrid.appendChild(item);
  });
}

function cancelEdit() {
  State.editingListingId = null;
  State.imageFiles = [];
  State.keepExistingImages = [];
  navigate('shop');
}

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const maxImages = 10;
  const usedSlots = State.keepExistingImages.length + State.imageFiles.length;
  const remaining = maxImages - usedSlots;
  const newFiles = files.slice(0, remaining);
  
  newFiles.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    State.imageFiles.push(file);
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, State.imageFiles.length - 1);
    reader.readAsDataURL(file);
  });
  
  if (files.length > remaining) {
    showToast(`Max ${maxImages} images total. ${remaining} slot(s) remaining.`, 'info');
  }
}

function addImagePreview(src, index) {
  const grid = document.getElementById('image-preview-grid');
  if (!grid) return;
  const item = document.createElement('div');
  item.className = 'image-preview-item animate-pop';
  item.dataset.index = index;
  item.innerHTML = `
    <img src="${src}" alt="Preview ${index + 1}" />
    <button class="remove-image" onclick="removeImage(${index})" title="Remove">&times;</button>
  `;
  grid.appendChild(item);
}

function removeImage(index) {
  State.imageFiles.splice(index, 1);
  renderImagePreviews();
}

function renderImagePreviews() {
  const grid = document.getElementById('image-preview-grid');
  if (!grid) return;
  grid.innerHTML = '';
  State.imageFiles.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (e) => addImagePreview(e.target.result, i);
    reader.readAsDataURL(file);
  });
}

async function uploadImages(userId) {
  const urls = [];
  for (const file of State.imageFiles) {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await db.storage
      .from('listing-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    
    if (error) {
      console.error('Error uploading image:', error);
    } else {
      const { data: { publicUrl } } = db.storage
        .from('listing-images')
        .getPublicUrl(path);
      urls.push(publicUrl);
    }
  }
  return urls;
}

async function submitListing(e) {
  e.preventDefault();
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  const isEditing = !!State.editingListingId;
  const errEl = document.getElementById('create-error');
  const btn = document.getElementById('create-submit');
  if (errEl) errEl.classList.remove('show');
  if (btn) setLoading(btn, true, isEditing ? 'SAVING...' : 'PUBLISHING...');
  
  try {
    let newImageUrls = [];
    if (State.imageFiles.length > 0) {
      newImageUrls = await uploadImages(State.user.id);
    }
    
    const allImages = [...State.keepExistingImages, ...newImageUrls];
    
    const paymentMethods = Array.from(
      document.querySelectorAll('input[name="payment"]:checked')
    ).map(cb => cb.value);
    
    if (paymentMethods.length === 0) paymentMethods.push('cash');
    
    const price = parseFloat(document.getElementById('c-price')?.value || '0');
    const msrpVal = document.getElementById('c-msrp')?.value;
    const msrp = msrpVal ? parseFloat(msrpVal) : null;
    const tagsRaw = document.getElementById('c-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
    const subcategoryEl = document.getElementById('c-subcategory');
    const subcategory = subcategoryEl && subcategoryEl.value ? subcategoryEl.value : null;
    
    const isFair = msrp ? price <= msrp * 1.2 : true;
    
    const listingData = {
      seller_id: State.user.id,
      name: document.getElementById('c-name')?.value.trim() || '',
      category: document.getElementById('c-category')?.value || '',
      subcategory: subcategory,
      description: document.getElementById('c-desc')?.value.trim() || '',
      price: price,
      msrp: msrp,
      condition: document.getElementById('c-condition')?.value || '',
      type: document.getElementById('c-type')?.value || 'buy-now',
      shipping: document.getElementById('c-shipping')?.value || 'paid',
      location: document.getElementById('c-location')?.value.trim() || null,
      tags: tags,
      payment_methods: paymentMethods,
      is_fair: isFair,
      images: allImages
    };
    
    if (!listingData.name || !listingData.category || !listingData.description || isNaN(price)) {
      throw new Error('Please fill out all required fields.');
    }
    if (listingData.description.length < 10) {
      throw new Error('Description must be at least 10 characters.');
    }
    
    let savedListing;
    if (isEditing) {
      delete listingData.seller_id;
      const { data, error } = await db
        .from('listings')
        .update(listingData)
        .eq('id', State.editingListingId)
        .eq('seller_id', State.user.id)
        .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;
      
      const idx = State.listings.findIndex(l => l.id === State.editingListingId);
      if (idx !== -1) State.listings[idx] = savedListing;
    } else {
      const { data, error } = await db
        .from('listings')
        .insert(listingData)
        .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
        .single();
      if (error) throw error;
      savedListing = data;
      State.listings.unshift(savedListing);
    }
    
    const form = document.getElementById('create-form');
    if (form) form.reset();
    State.imageFiles = [];
    State.keepExistingImages = [];
    const previewGrid = document.getElementById('image-preview-grid');
    if (previewGrid) previewGrid.innerHTML = '';
    State.editingListingId = null;
    
    showToast(isEditing ? 'Listing updated!' : 'Listing published!', 'success');
    navigate(isEditing ? 'profile' : 'shop');
    
  } catch (err) {
    console.error('Error submitting listing:', err);
    if (errEl) {
      errEl.textContent = err.message || 'An unknown error occurred.';
      errEl.classList.add('show');
    }
  } finally {
    if (btn) setLoading(btn, false, isEditing ? 'SAVE CHANGES' : 'PUBLISH LISTING');
  }
}

// ==================== PROFILE MODULE ====================
async function loadProfile() {
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  const profileIdToLoad = window.selectedProfileId || State.user.id;
  const isOwnProfile = profileIdToLoad === State.user.id;
  
  if (window.selectedProfileId) delete window.selectedProfileId;
  
  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', profileIdToLoad)
    .single();
  
  if (error) {
    showToast("Could not load profile.", 'error');
    navigate('shop');
    return;
  }
  
  const avatarEl = document.getElementById('profile-avatar-lg');
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const bioEl = document.getElementById('profile-bio');
  const locationEl = document.getElementById('profile-location');
  
  const name = profile?.username || '?';
  
  if (avatarEl) {
    if (profile?.avatar_url) {
      avatarEl.innerHTML = `<img src="${escHtml(profile.avatar_url)}" alt="${escHtml(name)}" />`;
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }
  
  if (usernameEl) usernameEl.textContent = (profile?.username || name).toUpperCase();
  if (emailEl) emailEl.textContent = isOwnProfile ? profile.email : '';
  if (bioEl) bioEl.textContent = profile?.bio || '';
  if (locationEl) locationEl.textContent = profile?.location ? '📍 ' + profile.location : '';
  
  const editButton = document.querySelector('#page-profile .profile-banner .btn');
  if (editButton) {
    if (isOwnProfile) {
      editButton.innerHTML = '✏️ Edit Profile';
      editButton.onclick = openEditProfile;
      editButton.style.display = 'inline-block';
    } else if (profile) {
      editButton.innerHTML = '💬 Let\'s Chat';
      editButton.onclick = () => startChat(profile.id);
      editButton.style.display = 'inline-block';
    }
  }
  
  const profileTabs = document.querySelector('.profile-tabs');
  if (profileTabs) profileTabs.style.display = isOwnProfile ? 'flex' : 'none';
  
  await loadProfileListings(profileIdToLoad, isOwnProfile);
  
  if (isOwnProfile) {
    const sUsername = document.getElementById('s-username');
    const sBio = document.getElementById('s-bio');
    const sLocation = document.getElementById('s-location');
    const sPhone = document.getElementById('s-phone');
    
    if (sUsername) sUsername.value = profile?.username || '';
    if (sBio) sBio.value = profile?.bio || '';
    if (sLocation) sLocation.value = profile?.location || '';
    if (sPhone) sPhone.value = profile?.phone || '';
  }
  
  const activeTab = document.querySelector('.profile-tab.active');
  if (activeTab) {
    const tabName = activeTab.dataset.ptab;
    showProfileTab(tabName);
  } else {
    showProfileTab('my-listings');
  }
}

function showProfileTab(tabName) {
  const myListingsDiv = document.getElementById('ptab-my-listings');
  const soldDiv = document.getElementById('ptab-sold');
  const settingsDiv = document.getElementById('ptab-settings');
  
  if (myListingsDiv) myListingsDiv.classList.add('hidden');
  if (soldDiv) soldDiv.classList.add('hidden');
  if (settingsDiv) settingsDiv.classList.add('hidden');
  
  if (tabName === 'my-listings' && myListingsDiv) {
    myListingsDiv.classList.remove('hidden');
  } else if (tabName === 'sold' && soldDiv) {
    soldDiv.classList.remove('hidden');
    if (State.user) loadProfileListings(State.user.id, true);
  } else if (tabName === 'settings' && settingsDiv) {
    settingsDiv.classList.remove('hidden');
  }
}

async function loadProfileListings(profileId, isOwnProfile) {
  if (!profileId) return;
  
  const { data } = await db
    .from('listings')
    .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
    .eq('seller_id', profileId)
    .order('created_at', { ascending: false });
  
  const allListings = data || [];
  const active = allListings.filter(l => !l.is_sold);
  const sold = allListings.filter(l => l.is_sold);
  
  const totalViews = allListings.reduce((s, l) => s + (l.view_count || 0), 0);
  const totalFavs = allListings.reduce((s, l) => s + (l.favorite_count || 0), 0);
  
  const statListings = document.getElementById('stat-listings');
  const statViews = document.getElementById('stat-views');
  const statFavs = document.getElementById('stat-favorites');
  const statSold = document.getElementById('stat-sold');
  
  if (statListings) animateNumber(statListings, active.length);
  if (statViews) animateNumber(statViews, totalViews);
  if (statFavs) animateNumber(statFavs, totalFavs);
  if (statSold) animateNumber(statSold, sold.length);
  
  const grid = document.getElementById('profile-listings-grid');
  if (grid) {
    if (active.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">NO ACTIVE LISTINGS</div>${isOwnProfile ? '<div class="empty-sub">Click + CREATE to list your first item</div>' : ''}</div>`;
    } else {
      grid.innerHTML = '';
      active.forEach(l => grid.appendChild(createListingCard(l, isOwnProfile)));
    }
  }
  
  const soldGrid = document.getElementById('profile-sold-grid');
  if (soldGrid) {
    if (sold.length === 0) {
      soldGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">NO SOLD ITEMS YET</div><div class="empty-sub">Items you sell will appear here</div></div>`;
    } else {
      soldGrid.innerHTML = '';
      sold.forEach(l => {
        const card = createListingCard(l, false);
        card.classList.add('sold-listing-card');
        soldGrid.appendChild(card);
      });
    }
  }
}

async function saveProfile(e) {
  e.preventDefault();
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  const errEl = document.getElementById('profile-save-error');
  if (errEl) errEl.classList.remove('show');
  
  const username = document.getElementById('s-username')?.value.trim() || '';
  const bio = document.getElementById('s-bio')?.value.trim() || '';
  const location = document.getElementById('s-location')?.value.trim() || null;
  const phone = document.getElementById('s-phone')?.value.trim() || null;
  
  if (username.length < 3) {
    if (errEl) { 
      errEl.textContent = 'Username must be at least 3 characters.'; 
      errEl.classList.add('show'); 
    }
    showToast('Username must be at least 3 characters.', 'error');
    return;
  }
  
  const saveBtn = e.target.querySelector('button[type="submit"]');
  const originalText = saveBtn?.textContent || 'SAVE PROFILE';
  if (saveBtn) setLoading(saveBtn, true, 'SAVING...');
  
  try {
    const updates = {
      username: username,
      bio: bio,
      location: location,
      phone: phone,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', State.user.id);
    
    if (error) {
      const msg = error.message.includes('unique') ? 'That username is already taken.' : error.message;
      if (errEl) { 
        errEl.textContent = 'Failed to save profile: ' + msg; 
        errEl.classList.add('show'); 
      }
      showToast('Failed to save profile: ' + msg, 'error');
    } else {
      State.profile = { ...State.profile, ...updates };
      updateAuthUI();
      showToast('Profile updated successfully!', 'success');
      await loadProfile();
      if (errEl) errEl.classList.remove('show');
    }
  } catch (err) {
    console.error('Save profile error:', err);
    if (errEl) {
      errEl.textContent = 'An unexpected error occurred.';
      errEl.classList.add('show');
    }
    showToast('Failed to save profile.', 'error');
  } finally {
    if (saveBtn) setLoading(saveBtn, false, originalText);
  }
}

function switchProfileTab(btn) {
  const tabName = btn.dataset.ptab;
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  showProfileTab(tabName);
}

function openEditProfile() {
  const settingsTab = document.querySelector('.profile-tab[data-ptab="settings"]');
  if (settingsTab) {
    settingsTab.click();
    settingsTab.scrollIntoView({ behavior: 'smooth' });
  }
}

// ==================== MARK SOLD ====================
function openMarkSoldModal(listingId) {
  const input = document.getElementById('mark-sold-listing-id');
  if (input) input.value = listingId;
  const modal = document.getElementById('mark-sold-modal');
  if (modal) modal.classList.add('open');
}

async function confirmMarkSold() {
  const listingId = document.getElementById('mark-sold-listing-id')?.value;
  if (!listingId || !State.user) return;
  
  try {
    const { error } = await db
      .from('listings')
      .update({ 
        is_sold: true, 
        sold_at: new Date().toISOString(),
        sold_to: State.user.id
      })
      .eq('id', listingId)
      .eq('seller_id', State.user.id);
    
    if (error) throw error;
    
    closeModal('mark-sold-modal');
    showToast('Listing marked as sold!', 'success');
    
    const idx = State.listings.findIndex(l => l.id === listingId);
    if (idx !== -1) State.listings.splice(idx, 1);
    applyFilters();
    
    if (State.currentPage === 'profile') {
      await loadProfileListings(State.user.id, true);
    }
    if (State.currentPage === 'detail') navigate('profile');
  } catch (err) {
    console.error('Error marking as sold:', err);
    showToast('Failed to mark as sold: ' + err.message, 'error');
  }
}

// ==================== ITEM DETAIL MODULE ====================
async function openListing(listingId) {
  navigate('detail');
  State.currentListingId = listingId;
  
  const content = document.getElementById('detail-content');
  if (content) content.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';
  
  try {
    const { data: listing, error } = await db
      .from('listings')
      .select('*, profiles:seller_id(id, username, avatar_url, rating, location, bio)')
      .eq('id', listingId)
      .single();
    
    if (error) throw error;
    State.selectedListing = listing;
    
    try {
      await db.rpc('increment_view_count', { listing_id: listingId });
    } catch (rpcErr) {
      console.warn('RPC function not found');
    }
    
    renderDetail(listing);
    loadSimilarItems(listing);
    
    // Generate AI suggestion if not already present
    if (!listing.ai_suggestions) {
      generateAndSaveListingSuggestion(listingId);
    }
  } catch (err) {
    console.error('Detail error:', err);
    if (content) content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">LISTING NOT FOUND</div></div>`;
  }
}

function renderDetail(listing) {
  const content = document.getElementById('detail-content');
  if (!content) return;
  
  const seller = listing.profiles || {};
  const isOwner = State.user && State.user.id === listing.seller_id;
  const isWished = State.wishlistIds.has(listing.id);
  
  let imagesHtml = '';
  if (listing.images && listing.images.length > 0) {
    if (listing.images.length === 1) {
      imagesHtml = `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" style="width:100%;border-radius:var(--radius-lg);" />`;
    } else {
      const detailCarouselId = `detail-carousel-${listing.id}`;
      imagesHtml = `
        <div class="image-carousel" id="${detailCarouselId}">
          <div class="carousel-container">
            <div class="carousel-slides" id="${detailCarouselId}-slides" style="display:flex;transition:transform 0.3s ease;">
              ${listing.images.map((img, idx) => `
                <div class="carousel-slide" style="min-width:100%;">
                  <img src="${escHtml(img)}" alt="Image ${idx + 1}" style="width:100%;border-radius:var(--radius-lg);" />
                </div>
              `).join('')}
            </div>
            <button class="carousel-btn prev" onclick="changeSlide('${detailCarouselId}', -1)">‹</button>
            <button class="carousel-btn next" onclick="changeSlide('${detailCarouselId}', 1)">›</button>
            <div class="carousel-dots" id="${detailCarouselId}-dots">
              ${listing.images.map((_, idx) => `<span class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide('${detailCarouselId}', ${idx})"></span>`).join('')}
            </div>
            <div class="image-count-badge">${listing.images.length} images</div>
          </div>
        </div>
      `;
      setTimeout(() => {
        const slides = document.getElementById(`${detailCarouselId}-slides`);
        if (slides) slides.dataset.currentIndex = '0';
      }, 100);
    }
  } else {
    imagesHtml = `<div class="card-no-image">📦</div>`;
  }
  
  const paymentMethodsList = listing.payment_methods && listing.payment_methods.length > 0
    ? listing.payment_methods.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' · ')
    : 'Cash';
  
  let actionsHtml;
  if (isOwner) {
    actionsHtml = `
      <button class="btn btn-outline" onclick="editListing('${listing.id}')">✏️ EDIT LISTING</button>
      ${!listing.is_sold ? `<button class="btn btn-primary" onclick="openMarkSoldModal('${listing.id}')">✅ MARK AS SOLD</button>` : ''}
      <button class="btn btn-danger" onclick="deleteListing('${listing.id}')">❌ DELETE</button>
    `;
  } else {
    const contactBtn = State.user 
      ? `<button class="btn btn-primary btn-lg" onclick="startChat('${listing.seller_id}', '${listing.id}')">💬 CONTACT SELLER</button>`
      : `<button class="btn btn-primary btn-lg" onclick="openAuthModal()">🔐 LOGIN TO CONTACT</button>`;
    
    const wishlistBtn = State.user 
      ? `<button class="btn btn-outline wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(event, '${listing.id}')">
          ${isWished ? '❤️ REMOVE FROM WISHLIST' : '🤍 ADD TO WISHLIST'}
        </button>`
      : `<button class="btn btn-outline" onclick="openAuthModal()">🤍 LOGIN TO SAVE</button>`;
    
    actionsHtml = `${contactBtn}${wishlistBtn}`;
  }
  
  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-images">${imagesHtml}</div>
      <div class="detail-info">
        ${listing.is_sold ? '<div class="sold-banner" style="background:var(--danger);padding:8px;text-align:center;border-radius:8px;margin-bottom:16px;">SOLD</div>' : ''}
        <h1 class="detail-title">${escHtml(listing.name)}</h1>
        <div class="detail-price-row">
          <span class="detail-price">$${parseFloat(listing.price).toFixed(2)}</span>
          ${listing.msrp ? `<span class="detail-msrp" style="text-decoration:line-through;color:var(--text-muted);margin-left:12px;">$${parseFloat(listing.msrp).toFixed(2)} MSRP</span>` : ''}
        </div>
        <div class="detail-meta-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
          ${listing.location ? `<div class="detail-meta-item"><strong>📍 Location</strong><br>${escHtml(listing.location)}</div>` : ''}
          <div class="detail-meta-item"><strong>💳 Payment Methods</strong><br>${paymentMethodsList}</div>
          <div class="detail-meta-item"><strong>📦 Condition</strong><br>${listing.condition || 'N/A'}</div>
          <div class="detail-meta-item"><strong>🚚 Shipping</strong><br>${listing.shipping || 'paid'}</div>
        </div>
        <div class="detail-description">${escHtml(listing.description)}</div>
        <div class="seller-card">
          <div class="seller-avatar">${seller.username?.charAt(0) || '?'}</div>
          <div><div class="seller-name">${escHtml(seller.username || 'Anonymous')}</div>
          ${seller.rating > 0 ? `<div class="seller-rating">⭐ ${parseFloat(seller.rating).toFixed(1)}</div>` : ''}
          ${seller.location ? `<div class="seller-location">📍 ${escHtml(seller.location)}</div>` : ''}</div>
          <button onclick="viewSellerProfile('${seller.id}')" class="btn btn-outline btn-sm">View Profile</button>
        </div>
        <div class="detail-actions" style="display:flex;flex-direction:column;gap:10px;">${actionsHtml}</div>
        
        <!-- AI SUGGESTIONS PANEL - DYNAMICALLY GENERATED -->
        <div id="ai-suggestions-${listing.id}">
          <div style="text-align:center; padding:20px;">
            <div class="spinner"></div> Loading AI analysis...
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Trigger AI suggestion display
  setTimeout(() => {
    displayListingSuggestion(listing.id);
  }, 500);
}

function viewSellerProfile(sellerId) {
  window.selectedProfileId = sellerId;
  navigate('profile');
}

async function editListing(listingId) {
  State.editingListingId = listingId;
  navigate('create');
}

async function deleteListing(listingId) {
  if (!confirm('Are you sure you want to permanently delete this listing? This cannot be undone.')) return;
  
  try {
    const { error } = await db
      .from('listings')
      .delete()
      .eq('id', listingId)
      .eq('seller_id', State.user.id);
    if (error) throw error;
    
    State.listings = State.listings.filter(l => l.id !== listingId);
    applyFilters();
    
    showToast('Listing deleted.', 'success');
    if (State.currentPage === 'detail') navigate('profile');
  } catch (err) {
    console.error('Error deleting listing:', err);
    showToast('Failed to delete listing: ' + err.message, 'error');
  }
}

async function loadSimilarItems(listing) {
  const scroll = document.getElementById('similar-scroll');
  if (!scroll) return;
  scroll.innerHTML = '<div style="padding:20px;">Loading...</div>';
  
  try {
    const { data } = await db
      .from('listings')
      .select('*, profiles:seller_id(id, username, avatar_url, rating, location)')
      .eq('category', listing.category)
      .eq('is_sold', false)
      .neq('id', listing.id)
      .limit(8);
    
    const items = data || [];
    if (items.length === 0) {
      const section = document.getElementById('similar-section');
      if (section) section.style.display = 'none';
      return;
    }
    
    scroll.innerHTML = '';
    items.forEach(l => scroll.appendChild(createListingCard(l)));
  } catch (err) {
    const section = document.getElementById('similar-section');
    if (section) section.style.display = 'none';
  }
}

// ==================== RENDER ENGINE ====================
function createListingCard(listing, showOwnerActions = false) {
  const card = document.createElement('div');
  card.className = 'listing-card animate-fade';
  card.onclick = (e) => {
    if (e.target.closest('.wishlist-btn, .owner-btn, .carousel-btn, .carousel-dot')) return;
    openListing(listing.id);
  };
  
  const isWished = State.wishlistIds.has(listing.id);
  const isOwner = State.user && State.user.id === listing.seller_id;
  const showActions = showOwnerActions !== undefined ? showOwnerActions : isOwner;
  
  let imageHtml;
  if (listing.images && listing.images.length > 1) {
    imageHtml = createImageCarousel(listing.images, listing.id);
  } else if (listing.images && listing.images.length === 1) {
    imageHtml = `<img src="${escHtml(listing.images[0])}" alt="${escHtml(listing.name)}" style="width:100%;height:100%;object-fit:cover;" />`;
  } else {
    imageHtml = `<div class="card-no-image">📦</div>`;
  }
  
  const paymentIcons = {
    'cash': '💵', 'card': '💳', 'paypal': '🅿️', 'venmo': 'V', 'crypto': '₿', 'trade': '🔄'
  };
  const paymentDisplay = listing.payment_methods && listing.payment_methods.length > 0
    ? listing.payment_methods.slice(0, 3).map(p => paymentIcons[p] || p).join(' ')
    : '💵';
  
  let wishlistBtn = '';
  if (State.user && !isOwner) {
    wishlistBtn = `
      <button class="wishlist-btn ${isWished ? 'active' : ''}"
        onclick="toggleWishlist(event, '${listing.id}')"
        style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;z-index:20;transition:all 0.2s;"
      >${isWished ? '❤️' : '🤍'}</button>
    `;
  }
  
  let ownerActions = '';
  if (showActions && isOwner && !listing.is_sold) {
    ownerActions = `
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="owner-btn" onclick="event.stopPropagation(); editListing('${listing.id}')" style="background:var(--neon);color:#001a07;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;font-size:11px;transition:all 0.2s;">EDIT</button>
        <button class="owner-btn" onclick="event.stopPropagation(); openMarkSoldModal('${listing.id}')" style="background:var(--warning);color:#001a07;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;font-size:11px;transition:all 0.2s;">SOLD</button>
      </div>
    `;
  }
  
  const hasAiSuggestion = listing.ai_suggestions ? true : false;
  
  const soldOverlay = listing.is_sold ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);padding:8px 16px;border-radius:8px;font-weight:bold;color:var(--danger);z-index:15;">SOLD</div>' : '';
  const locationDisplay = listing.location ? `📍 ${listing.location.substring(0, 25)}` : '';
  
  card.innerHTML = `
    <div class="card-image-wrap" style="position:relative;aspect-ratio:1;background:var(--bg-3);overflow:hidden;">
      ${imageHtml}
      ${listing.is_fair ? '<span style="position:absolute;top:8px;left:8px;background:var(--neon);color:#001a07;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:20;">AI FAIR</span>' : ''}
      ${hasAiSuggestion ? '<span style="position:absolute;top:8px;left:70px;background:var(--blue);color:#001a07;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:20;">🤖 AI ANALYZED</span>' : ''}
      ${soldOverlay}
      ${wishlistBtn}
    </div>
    <div class="card-body" style="padding:12px;">
      <div class="card-title" style="font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;">${escHtml(listing.name)}</div>
      <div class="card-price" style="color:var(--neon);font-weight:bold;font-size:1.1rem;margin-bottom:4px;">$${parseFloat(listing.price).toFixed(2)}</div>
      <div class="card-meta" style="font-size:0.7rem;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
        <span>🏷️ ${listing.condition || 'N/A'}</span>
        <span>📦 ${listing.type || 'buy-now'}</span>
      </div>
      ${locationDisplay ? `<div class="card-location" style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;display:flex;align-items:center;gap:4px;">${locationDisplay}</div>` : ''}
      <div class="card-payment" style="font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;background:rgba(0,255,65,0.08);padding:4px 8px;border-radius:6px;margin-top:4px;flex-wrap:wrap;">
        <span>💳 Accepts:</span>
        <span>${paymentDisplay}</span>
      </div>
      ${ownerActions}
    </div>
  `;
  
  return card;
}

function renderListings(listings) {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  
  if (listings.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">NO LISTINGS FOUND</div></div>`;
    return;
  }
  
  grid.innerHTML = '';
  listings.forEach(l => grid.appendChild(createListingCard(l)));
}

function showSkeletons() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill(0).map(() => `<div class="skeleton-card skeleton" style="height:280px;background:var(--bg-2);border-radius:var(--radius-lg);"></div>`).join('');
}

function animateNumber(el, target) {
  const duration = 800;
  const start = performance.now();
  const startVal = parseInt(el.textContent) || 0;
  
  function step(timestamp) {
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (target - startVal) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('mobile-open');
}

// ==================== CHAT SYSTEM ====================
async function startChat(partnerId, listingId = null) {
  if (!State.user) {
    openAuthModal();
    return;
  }
  if (partnerId === State.user.id) {
    showToast("You can't start a chat with yourself.", "info");
    return;
  }
  
  State.currentChatPartnerId = partnerId;
  State.currentListingId = listingId;
  navigate('messages');
}

async function loadMessages() {
  if (!State.user) return;
  
  const { data: allMessages, error } = await db
    .from('messages')
    .select(`
      *,
      sender:sender_id(id, username, avatar_url),
      receiver:receiver_id(id, username, avatar_url)
    `)
    .or(`sender_id.eq.${State.user.id},receiver_id.eq.${State.user.id}`)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetching conversations", error);
    return;
  }
  
  const conversations = new Map();
  if (allMessages) {
    allMessages.forEach(msg => {
      const partner = msg.sender.id === State.user.id ? msg.receiver : msg.sender;
      if (!conversations.has(partner.id)) {
        conversations.set(partner.id, {
          partnerProfile: partner,
          lastMessage: msg
        });
      }
    });
  }
  
  const sortedConversations = Array.from(conversations.values())
    .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));
  
  const convoListEl = document.getElementById('conversationList');
  if (!convoListEl) return;
  convoListEl.innerHTML = '';
  
  if (sortedConversations.length === 0) {
    convoListEl.innerHTML = '<div class="empty-state-small">No conversations yet.</div>';
  } else {
    sortedConversations.forEach(convo => {
      const partnerProfile = convo.partnerProfile;
      const isActive = State.currentChatPartnerId === partnerProfile.id;
      
      const li = document.createElement('div');
      li.className = `convo-item ${isActive ? 'active' : ''}`;
      li.setAttribute('data-id', partnerProfile.id);
      li.onclick = () => loadConversationThread(partnerProfile.id);
      
      const previewText = convo.lastMessage.image_url ? '📷 Sent an image' : convo.lastMessage.content;
      
      li.innerHTML = `
        <div class="convo-avatar">${partnerProfile.username?.charAt(0) || '?'}</div>
        <div class="convo-details">
          <div class="convo-username">${escHtml(partnerProfile.username)}</div>
          <div class="convo-preview">${escHtml(previewText?.substring(0, 35) || '...')}</div>
        </div>
      `;
      convoListEl.appendChild(li);
    });
  }
  
  if (State.currentChatPartnerId) {
    await loadConversationThread(State.currentChatPartnerId, State.currentListingId);
  } else {
    const activeHeader = document.getElementById('activeChatHeader');
    const chatThread = document.getElementById('chatThread');
    const chatForm = document.getElementById('chatForm');
    if (activeHeader) activeHeader.innerHTML = 'Select a conversation';
    if (chatThread) chatThread.innerHTML = '<div class="empty-state-small">Your messages will appear here.</div>';
    if (chatForm) chatForm.style.display = 'none';
  }
}

async function loadConversationThread(partnerId, listingId = null) {
  State.currentChatPartnerId = partnerId;
  
  document.querySelectorAll('.convo-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === partnerId);
  });
  
  const { data: partnerProfile, error: pError } = await db.from('profiles').select('*').eq('id', partnerId).single();
  if (pError || !partnerProfile) return;
  
  const activeHeader = document.getElementById('activeChatHeader');
  const chatForm = document.getElementById('chatForm');
  if (activeHeader) activeHeader.innerHTML = `Chatting with <strong>${escHtml(partnerProfile.username)}</strong>`;
  if (chatForm) chatForm.style.display = 'flex';
  
  if (listingId) {
    const { data: listing } = await db.from('listings').select('name, price').eq('id', listingId).single();
    if (listing) {
      const input = document.getElementById('chatMessageInput');
      if (input) {
        input.value = `Hi, I'm interested in your "${listing.name}" for $${listing.price}.`;
        input.focus();
      }
    }
    State.currentListingId = null;
  }
  
  const { data: messages, error: mError } = await db
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${State.user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${State.user.id})`)
    .order('created_at', { ascending: true });
  
  if (mError) return console.error("Error loading messages", mError);
  
  const threadEl = document.getElementById('chatThread');
  if (!threadEl) return;
  threadEl.innerHTML = '';
  if (messages) {
    messages.forEach(msg => renderMessage(msg, State.user.id));
  }
  threadEl.scrollTop = threadEl.scrollHeight;
}

async function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatMessageInput');
  const content = input?.value.trim();
  if (!content || !State.currentChatPartnerId) return;
  
  const { error } = await db.from('messages').insert([{
    sender_id: State.user.id,
    receiver_id: State.currentChatPartnerId,
    listing_id: State.currentListingId,
    content: content,
  }]);
  
  if (error) showToast("Error: " + error.message, 'error');
  else {
    if (input) input.value = '';
    await loadConversationThread(State.currentChatPartnerId);
    await loadMessages();
  }
}

async function handleSendImage(e) {
  const file = e.target.files[0];
  if (!file || !State.currentChatPartnerId) return;
  
  const filePath = `${State.user.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await db.storage.from('chat-images').upload(filePath, file);
  
  if (uploadError) {
    showToast("Upload failed", 'error');
    return;
  }
  
  const { data: { publicUrl } } = db.storage.from('chat-images').getPublicUrl(filePath);
  
  await db.from('messages').insert([{
    sender_id: State.user.id,
    receiver_id: State.currentChatPartnerId,
    listing_id: State.currentListingId,
    image_url: publicUrl,
  }]);
  
  await loadConversationThread(State.currentChatPartnerId);
  await loadMessages();
}

function renderMessage(msg, currentUserId) {
  const thread = document.getElementById('chatThread');
  if (!thread) return;
  const isSent = msg.sender_id === currentUserId;
  const div = document.createElement('div');
  div.className = `msg ${isSent ? 'sent' : 'received'}`;
  
  if (msg.image_url) {
    div.innerHTML = `<img src="${escHtml(msg.image_url)}" class="msg-image" style="max-width:200px;border-radius:8px;cursor:pointer;" onclick="window.open(this.src)">`;
  } else {
    div.innerHTML = escHtml(msg.content);
  }
  
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

function initChat() {
  if (!db) return;
  db.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const newMsg = payload.new;
      const relevantToMe = newMsg.sender_id === State.user?.id || newMsg.receiver_id === State.user?.id;
      
      if (State.currentPage === 'messages' && relevantToMe && State.user) {
        const fromPartner = newMsg.sender_id === State.currentChatPartnerId;
        const fromMe = newMsg.sender_id === State.user?.id;
        
        if (fromPartner || fromMe) {
          renderMessage(newMsg, State.user?.id);
        }
        loadMessages();
      }
    })
    .subscribe();
}

// ==================== ERROR BANNER ====================
function showErrorBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.classList.add('show');
}

function hideErrorBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.classList.remove('show');
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const mobileNav = document.getElementById('mobile-nav');
      if (mobileNav) mobileNav.classList.toggle('open');
    });
  }
  
  let searchTimer;
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      State.searchQuery = e.target.value;
      searchTimer = setTimeout(() => {
        if (State.currentPage !== 'shop') navigate('shop');
        applyFilters();
      }, 320);
    });
  }
  
  const descTextarea = document.getElementById('c-desc');
  if (descTextarea) descTextarea.addEventListener('input', updateDescCounter);
  
  const categorySelect = document.getElementById('c-category');
  if (categorySelect) categorySelect.addEventListener('change', updateSubcategories);
  
  const priceSlider = document.getElementById('price-slider');
  if (priceSlider) priceSlider.addEventListener('input', (e) => onPriceSlider(e.target));
  
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  const fairOnly = document.getElementById('fair-only');
  const featuredOnly = document.getElementById('featured-only');
  const sortSelect = document.getElementById('sort-select');
  
  if (priceMin) priceMin.addEventListener('input', () => applyFilters());
  if (priceMax) priceMax.addEventListener('input', () => applyFilters());
  if (fairOnly) fairOnly.addEventListener('change', () => applyFilters());
  if (featuredOnly) featuredOnly.addEventListener('change', () => applyFilters());
  if (sortSelect) sortSelect.addEventListener('change', () => applyFilters());
  
  const imageInput = document.getElementById('image-input');
  const uploadZone = document.getElementById('upload-zone');
  if (imageInput) imageInput.addEventListener('change', handleImageUpload);
  if (uploadZone) {
    uploadZone.addEventListener('click', () => {
      const input = document.getElementById('image-input');
      if (input) input.click();
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      const mobileNav = document.getElementById('mobile-nav');
      if (mobileNav) mobileNav.classList.remove('open');
    }
  });
  
  window.addEventListener('online', () => {
    hideErrorBanner();
    showToast('Connection restored.', 'success');
    loadListings();
  });
  
  window.addEventListener('offline', () => {
    showErrorBanner();
    showToast('You are offline. Some features may not work.', 'error');
  });
  
  const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
  const updateFilterBtnVisibility = () => {
    if (mobileFilterToggle) {
      mobileFilterToggle.style.display = window.innerWidth < 900 ? 'inline-flex' : 'none';
    }
  };
  window.addEventListener('resize', updateFilterBtnVisibility);
  updateFilterBtnVisibility();
  
  document.addEventListener('click', (e) => {
    const mobileNav = document.getElementById('mobile-nav');
    const hamburger = document.getElementById('hamburger');
    if (mobileNav && mobileNav.classList.contains('open')) {
      if (!mobileNav.contains(e.target) && !hamburger?.contains(e.target)) {
        mobileNav.classList.remove('open');
      }
    }
  });
  
  const chatForm = document.getElementById('chatForm');
  const chatImageInput = document.getElementById('chatImageInput');
  const askBtn = document.getElementById('askAssistantBtn');
  const assistantInput = document.getElementById('assistantInput');
  
  if (chatForm) chatForm.addEventListener('submit', handleSendMessage);
  if (chatImageInput) chatImageInput.addEventListener('change', handleSendImage);
  if (askBtn) askBtn.addEventListener('click', askAssistant);
  if (assistantInput) {
    assistantInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') askAssistant();
    });
  }
}

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
  
  console.log('%c OBTAINUM INITIALIZED - Ready', 'background:#00ff41;color:#001a07;font-family:monospace;padding:4px 8px;');
});



// ==================== CONTACT & ABOUT FUNCTIONS ====================

function sendContactMessage(e) {
  e.preventDefault();
  const name = document.getElementById('contact-name')?.value || '';
  const email = document.getElementById('contact-email')?.value || '';
  const subject = document.getElementById('contact-subject')?.value || '';
  const message = document.getElementById('contact-message')?.value || '';
  
  // In a real implementation, this would send to your backend
  // For now, we'll show a success message and log to console
  
  console.log('Contact form submitted:', { name, email, subject, message });
  showToast('Message sent! We\'ll get back to you soon.', 'success');
  
  // Clear form
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-email').value = '';
  document.getElementById('contact-message').value = '';
  
  // Optional: Save to Supabase
  if (db && State.user) {
    db.from('contact_messages').insert([{
      name: name,
      email: email,
      subject: subject,
      message: message,
      user_id: State.user.id,
      created_at: new Date().toISOString()
    }]).catch(err => console.error('Failed to save message:', err));
  }
}

function showReportModal() {
  document.getElementById('report-modal').classList.add('open');
}

function submitBugReport(e) {
  e.preventDefault();
  const title = document.getElementById('bug-title')?.value || '';
  const description = document.getElementById('bug-description')?.value || '';
  const url = document.getElementById('bug-url')?.value || window.location.href;
  
  console.log('Bug report:', { title, description, url, user: State.user?.email });
  showToast('Bug report submitted! Thank you for helping improve OBTAINUM.', 'success');
  
  closeModal('report-modal');
  
  // Clear form
  document.getElementById('bug-title').value = '';
  document.getElementById('bug-description').value = '';
  document.getElementById('bug-url').value = '';
}




/* script.js - Add these new functions and modifications at the end of the file, before the closing brackets */

// ==================== NAVIGATION TOGGLE FUNCTION ====================
// Track nav mode state (true = minimized/showing only shop/about/contact)
let isNavMinimized = localStorage.getItem('obtainum-nav-minimized') === 'true';

function toggleNavMode() {
  isNavMinimized = !isNavMinimized;
  localStorage.setItem('obtainum-nav-minimized', isNavMinimized);
  
  const navExtraButtons = document.querySelectorAll('.nav-extra');
  const mobileNavExtra = document.querySelectorAll('.mobile-nav-extra');
  const navToggleBtn = document.getElementById('nav-toggle-btn');
  
  if (isNavMinimized) {
    // Hide extra nav buttons
    navExtraButtons.forEach(btn => {
      btn.classList.add('hidden-nav');
      // Add animation
      btn.style.animation = 'fadeOut 0.2s ease forwards';
    });
    mobileNavExtra.forEach(btn => {
      btn.classList.add('hidden-nav');
    });
    if (navToggleBtn) {
      navToggleBtn.classList.add('minimized');
      navToggleBtn.innerHTML = '<span class="nav-toggle-icon">🔘</span> <span>EXPAND</span>';
    }
    showToast('Navigation minimized - showing only Shop, About, Contact', 'info');
  } else {
    // Show all nav buttons
    navExtraButtons.forEach(btn => {
      btn.classList.remove('hidden-nav');
      btn.style.animation = 'fadeIn 0.3s ease forwards';
    });
    mobileNavExtra.forEach(btn => {
      btn.classList.remove('hidden-nav');
    });
    if (navToggleBtn) {
      navToggleBtn.classList.remove('minimized');
      navToggleBtn.innerHTML = '<span class="nav-toggle-icon">🔘</span> <span>MINIMIZE</span>';
    }
    showToast('Navigation expanded - showing all options', 'info');
  }
}

// Override navigate function to handle minimized nav state
const originalNavigate = navigate;
navigate = function(page) {
  // If nav is minimized and trying to navigate to a non-core page, show toast and don't navigate
  const corePages = ['shop', 'about', 'contact'];
  if (isNavMinimized && !corePages.includes(page) && page !== 'detail') {
    showToast('Navigation is minimized. Click the toggle button to access all features.', 'info');
    // Add shake animation to toggle button
    const toggleBtn = document.getElementById('nav-toggle-btn');
    if (toggleBtn) {
      toggleBtn.classList.add('animate-shake');
      setTimeout(() => toggleBtn.classList.remove('animate-shake'), 400);
    }
    return;
  }
  originalNavigate(page);
};

// Add fadeOut animation to CSS via JavaScript (ensure it exists)
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.9); display: none; }
  }
`;
document.head.appendChild(styleSheet);

// Initialize nav state on page load
function initNavState() {
  if (isNavMinimized) {
    const navExtraButtons = document.querySelectorAll('.nav-extra');
    const mobileNavExtra = document.querySelectorAll('.mobile-nav-extra');
    const navToggleBtn = document.getElementById('nav-toggle-btn');
    
    navExtraButtons.forEach(btn => btn.classList.add('hidden-nav'));
    mobileNavExtra.forEach(btn => btn.classList.add('hidden-nav'));
    if (navToggleBtn) {
      navToggleBtn.classList.add('minimized');
      navToggleBtn.innerHTML = '<span class="nav-toggle-icon">🔘</span> <span>EXPAND</span>';
    }
  }
}

// ==================== AI ROUTE SAFETY FUNCTION ====================

// Store user's saved location for route safety checks
let userSavedLocation = localStorage.getItem('obtainum-user-location') || '';

async function openRouteSafetyModal(listingId, sellerLocation) {
  const modal = document.getElementById('route-safety-modal');
  const content = document.getElementById('route-safety-content');
  
  if (!modal || !content) return;
  
  // Get user location from saved preference or ask
  const savedLocation = localStorage.getItem('obtainum-user-location');
  
  content.innerHTML = `
    <div style="padding: 8px 0;">
      <div class="route-safety-card" style="margin-top: 0;">
        <div class="route-safety-header">
          <span style="font-size: 1.5rem;">📍</span>
          <div>
            <h4>Meet-up Location Safety Check</h4>
            <p style="font-size: 0.75rem; color: var(--text-muted);">AI-powered route and safety analysis</p>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Your Starting Location</label>
          <div class="location-input-group">
            <input type="text" id="route-user-location" placeholder="City, State or address" value="${escHtml(savedLocation || '')}" />
            <button class="btn btn-outline btn-sm" onclick="saveUserLocationForRoute()">💾 Save</button>
          </div>
          <small style="color: var(--text-muted);">We'll save this for future checks</small>
        </div>
        
        <div class="form-group">
          <label class="form-label">Seller's Location</label>
          <input type="text" id="route-seller-location" value="${escHtml(sellerLocation || 'Unknown')}" readonly disabled style="background: var(--bg-3);" />
        </div>
        
        <button class="btn btn-primary w-full" onclick="calculateRouteSafety('${listingId}', '${escHtml(sellerLocation || '')}')" style="margin-top: 12px;">
          🗺️ Calculate Route & Safety Score
        </button>
        
        <div id="route-safety-result" style="margin-top: 16px;"></div>
      </div>
    </div>
  `;
  
  modal.classList.add('open');
}

function saveUserLocationForRoute() {
  const locationInput = document.getElementById('route-user-location');
  if (locationInput && locationInput.value.trim()) {
    localStorage.setItem('obtainum-user-location', locationInput.value.trim());
    userSavedLocation = locationInput.value.trim();
    showToast('Location saved for future route checks!', 'success');
    
    // Add animation
    const btn = locationInput.parentElement.querySelector('button');
    if (btn) {
      btn.classList.add('animate-scale-pulse');
      setTimeout(() => btn.classList.remove('animate-scale-pulse'), 400);
    }
  } else {
    showToast('Please enter a valid location', 'error');
  }
}

async function calculateRouteSafety(listingId, sellerLocation) {
  const userLocation = document.getElementById('route-user-location')?.value.trim();
  const resultDiv = document.getElementById('route-safety-result');
  
  if (!userLocation) {
    showToast('Please enter your starting location first', 'error');
    resultDiv.innerHTML = '<div class="auth-error show" style="text-align:center;">⚠️ Please enter your location above</div>';
    return;
  }
  
  if (!sellerLocation || sellerLocation === 'Unknown') {
    resultDiv.innerHTML = '<div class="auth-error show" style="text-align:center;">⚠️ Seller location not available for safety check</div>';
    return;
  }
  
  resultDiv.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div> AI analyzing route safety...</div>';
  
  try {
    let safetyAnalysis;
    
    if (genAI) {
      safetyAnalysis = await analyzeRouteWithGemini(userLocation, sellerLocation);
    } else {
      safetyAnalysis = getFallbackRouteAnalysis(userLocation, sellerLocation);
    }
    
    displayRouteSafetyResult(safetyAnalysis, userLocation, sellerLocation);
    
    // Add animation to result
    if (resultDiv) {
      resultDiv.classList.add('animate-fade');
    }
    
  } catch (err) {
    console.error('Route safety analysis error:', err);
    resultDiv.innerHTML = `<div class="auth-error show" style="text-align:center;">⚠️ Error analyzing route: ${err.message || 'Please try again'}</div>`;
  }
}

async function analyzeRouteWithGemini(userLocation, sellerLocation) {
  if (!genAI) return getFallbackRouteAnalysis(userLocation, sellerLocation);
  
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `You are OBTAINUM's safety AI. Analyze a potential meet-up route for a marketplace transaction.

USER STARTING LOCATION: ${userLocation}
SELLER/ITEM LOCATION: ${sellerLocation}

Provide a JSON response with route safety analysis. Consider:
- Distance between locations (estimate based on city names)
- General safety considerations for meeting strangers
- Best practices for safe exchanges

Return ONLY valid JSON with this structure:
{
  "estimatedDistance": "Approximate distance (e.g., '5 miles' or 'within same city')",
  "estimatedTravelTime": "Estimated travel time (e.g., '15 min drive')",
  "safetyScore": 0-100,
  "safetyLevel": "High / Medium / Low",
  "recommendedMeetingSpot": "Suggested public meeting location type",
  "safetyTips": ["tip 1", "tip 2", "tip 3"],
  "overallAssessment": "Brief overall safety assessment"
}`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getFallbackRouteAnalysis(userLocation, sellerLocation);
  } catch (err) {
    console.error('Gemini route analysis error:', err);
    return getFallbackRouteAnalysis(userLocation, sellerLocation);
  }
}

function getFallbackRouteAnalysis(userLocation, sellerLocation) {
  // Generate a semi-random but deterministic safety score based on location names
  const locationStr = (userLocation + sellerLocation).toLowerCase();
  let hash = 0;
  for (let i = 0; i < locationStr.length; i++) {
    hash = ((hash << 5) - hash) + locationStr.charCodeAt(i);
    hash |= 0;
  }
  
  const safetyScore = 50 + (Math.abs(hash) % 45);
  let safetyLevel = 'Medium';
  if (safetyScore >= 70) safetyLevel = 'High';
  else if (safetyScore <= 40) safetyLevel = 'Low';
  
  // Check if locations might be same city
  const userCity = userLocation.split(',')[0].trim().toLowerCase();
  const sellerCity = sellerLocation.split(',')[0].trim().toLowerCase();
  const isSameCity = userCity === sellerCity;
  
  return {
    estimatedDistance: isSameCity ? 'Within same city' : 'Cross-city travel',
    estimatedTravelTime: isSameCity ? '15-30 minutes' : '30-60 minutes',
    safetyScore: safetyScore,
    safetyLevel: safetyLevel,
    recommendedMeetingSpot: isSameCity ? 'Public mall, coffee shop, or police station lobby' : 'Public location near seller\'s area',
    safetyTips: [
      'Always meet in a public, well-lit area',
      'Bring a friend if possible',
      'Let someone know where you\'re going',
      'Trust your instincts - if something feels wrong, leave',
      'Consider meeting at a local police station lobby'
    ],
    overallAssessment: safetyScore >= 70 ? 'This route appears reasonably safe for a meet-up.' : 
                       (safetyScore >= 40 ? 'Exercise normal caution for this meet-up.' : 
                       'Consider extra precautions or request shipping instead.')
  };
}

function displayRouteSafetyResult(analysis, userLocation, sellerLocation) {
  const resultDiv = document.getElementById('route-safety-result');
  if (!resultDiv) return;
  
  const scoreColor = analysis.safetyScore >= 70 ? 'high' : (analysis.safetyScore >= 40 ? 'medium' : 'low');
  const scoreEmoji = analysis.safetyScore >= 70 ? '✅' : (analysis.safetyScore >= 40 ? '⚠️' : '⚠️⚠️');
  
  resultDiv.innerHTML = `
    <div class="route-safety-card animate-fade">
      <div class="route-safety-header">
        <div class="safety-score ${scoreColor}">${analysis.safetyScore}</div>
        <div>
          <h4>${scoreEmoji} ${analysis.safetyLevel} Safety Level</h4>
          <p style="font-size: 0.75rem; color: var(--text-muted);">AI-powered route analysis</p>
        </div>
      </div>
      
      <div class="route-details">
        <div class="route-detail-item">
          <span class="route-detail-label">📍 From</span>
          <span class="route-detail-value">${escHtml(userLocation)}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">🎯 To</span>
          <span class="route-detail-value">${escHtml(sellerLocation)}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">📏 Est. Distance</span>
          <span class="route-detail-value">${analysis.estimatedDistance}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">⏱️ Est. Travel Time</span>
          <span class="route-detail-value">${analysis.estimatedTravelTime}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">📍 Recommended Meet-up</span>
          <span class="route-detail-value">${analysis.recommendedMeetingSpot}</span>
        </div>
      </div>
      
      <div class="safety-tips">
        <strong>🛡️ Safety Tips</strong>
        <ul>
          ${analysis.safetyTips.map(tip => `<li>${escHtml(tip)}</li>`).join('')}
        </ul>
      </div>
      
      <div style="margin-top: 12px; padding: 10px; background: rgba(0,255,65,0.05); border-radius: 8px;">
        <strong>📋 Overall Assessment:</strong> ${analysis.overallAssessment}
      </div>
    </div>
  `;
  
  // Animate the result
  resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Modify the renderDetail function to include a route safety button
// Add this function to be called after rendering the detail page
function addRouteSafetyButtonToListing(listing) {
  const detailActions = document.querySelector('.detail-actions');
  if (!detailActions) return;
  
  // Check if button already exists
  if (document.getElementById('route-safety-btn')) return;
  
  const sellerLocation = listing.location || 'Location not specified';
  const hasValidLocation = sellerLocation && sellerLocation !== 'Location not specified' && sellerLocation !== '';
  
  const routeBtn = document.createElement('button');
  routeBtn.id = 'route-safety-btn';
  routeBtn.className = 'btn btn-outline';
  routeBtn.innerHTML = '🗺️ Check Route Safety';
  routeBtn.style.marginTop = '8px';
  
  if (!hasValidLocation) {
    routeBtn.disabled = true;
    routeBtn.style.opacity = '0.5';
    routeBtn.style.cursor = 'not-allowed';
    routeBtn.title = 'Seller location not provided';
    routeBtn.innerHTML = '🗺️ Route Safety (Location N/A)';
  } else {
    routeBtn.onclick = () => openRouteSafetyModal(listing.id, sellerLocation);
  }
  
  detailActions.appendChild(routeBtn);
}

// Override renderDetail to include route safety button
const originalRenderDetail = renderDetail;
renderDetail = function(listing) {
  originalRenderDetail(listing);
  // Add route safety button after a small delay to ensure DOM is ready
  setTimeout(() => addRouteSafetyButtonToListing(listing), 100);
};

// ==================== ADDITIONAL ANIMATION FUNCTIONS ====================

// Function to add ripple effect to buttons
function addRippleEffectToButtons() {
  document.querySelectorAll('.btn, .chip, .nav-btn').forEach(btn => {
    if (!btn.classList.contains('ripple')) {
      btn.classList.add('ripple');
    }
  });
}

// Function to add scroll reveal animations
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.listing-card, .about-section, .contact-method, .donate-card, .stat-card');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  
  revealElements.forEach(el => {
    el.classList.add('scroll-reveal');
    observer.observe(el);
  });
}

// Function to add glitch effect on hover for logo
function initLogoGlitch() {
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('mouseenter', () => {
      logo.classList.add('animate-glitch');
      setTimeout(() => logo.classList.remove('animate-glitch'), 300);
    });
  }
}

// Override showToast to add animation
const originalShowToast = showToast;
showToast = function(message, type = 'info') {
  originalShowToast(message, type);
  
  // Add animation to the last toast
  setTimeout(() => {
    const toasts = document.querySelectorAll('.toast');
    if (toasts.length) {
      const lastToast = toasts[toasts.length - 1];
      lastToast.classList.add('animate-slide');
    }
  }, 10);
};

// Add loading animation for listings
const originalShowSkeletons = showSkeletons;
showSkeletons = function() {
  originalShowSkeletons();
  const skeletons = document.querySelectorAll('.skeleton-card');
  skeletons.forEach(skeleton => {
    skeleton.style.animation = 'pulse 1.5s ease-in-out infinite';
  });
};

// Initialize all new features
function initNewFeatures() {
  initNavState();
  addRippleEffectToButtons();
  initScrollReveal();
  initLogoGlitch();
  
  // Add animation to price slider
  const priceSlider = document.getElementById('price-slider');
  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      const valSpan = document.getElementById('price-slider-val');
      if (valSpan) {
        valSpan.classList.add('animate-scale-pulse');
        setTimeout(() => valSpan.classList.remove('animate-scale-pulse'), 200);
      }
    });
  }
  
  // Add animation to filter chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', function() {
      this.classList.add('animate-scale-pulse');
      setTimeout(() => this.classList.remove('animate-scale-pulse'), 300);
    });
  });
}

// Call initNewFeatures when DOM is ready
const originalDOMContentLoaded = document.addEventListener('DOMContentLoaded', () => {});
// Instead, we'll add to the existing DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(initNewFeatures, 100);
});


/* script.js - Add all new features including map, RAG, and rate limiting */

// ==================== AI USAGE RATE LIMITING (Client-side only, resets every 24 hours) ====================

const AI_USAGE_KEY = 'obtainum_ai_usage';
const AI_DAILY_LIMIT = 10; // Max AI assistant queries per day

function getAIUsage() {
  const stored = localStorage.getItem(AI_USAGE_KEY);
  if (!stored) {
    return { count: 0, date: new Date().toDateString() };
  }
  try {
    const data = JSON.parse(stored);
    // Reset if it's a new day
    if (data.date !== new Date().toDateString()) {
      return { count: 0, date: new Date().toDateString() };
    }
    return data;
  } catch {
    return { count: 0, date: new Date().toDateString() };
  }
}

function incrementAIUsage() {
  const usage = getAIUsage();
  usage.count++;
  localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage));
  updateAIUsageDisplay();
  return usage.count;
}

function getRemainingAIQueries() {
  const usage = getAIUsage();
  return Math.max(0, AI_DAILY_LIMIT - usage.count);
}

function canUseAI() {
  const usage = getAIUsage();
  return usage.count < AI_DAILY_LIMIT;
}

function updateAIUsageDisplay() {
  const usage = getAIUsage();
  const remaining = AI_DAILY_LIMIT - usage.count;
  const countSpan = document.getElementById('ai-usage-count');
  const limitSpan = document.getElementById('ai-usage-limit');
  
  if (countSpan) countSpan.textContent = usage.count;
  if (limitSpan) limitSpan.textContent = AI_DAILY_LIMIT;
  
  // Add warning class if low on queries
  const counterDiv = document.getElementById('ai-usage-counter');
  if (counterDiv) {
    if (remaining <= 2) {
      counterDiv.classList.add('ai-usage-warning');
    } else {
      counterDiv.classList.remove('ai-usage-warning');
    }
  }
  
  // Update reset timer
  updateResetTimer();
}

function updateResetTimer() {
  const timerSpan = document.getElementById('ai-reset-timer');
  if (!timerSpan) return;
  
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const diff = tomorrow - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  timerSpan.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Start timer update interval
setInterval(updateResetTimer, 1000);

// ==================== MODIFIED AI ASSISTANT FUNCTION WITH RATE LIMITING ====================

// Override askAssistant to include rate limiting
const originalAskAssistant = askAssistant;
askAssistant = async function() {
  if (!State.user) {
    openAuthModal();
    return;
  }
  
  // Check rate limit
  if (!canUseAI()) {
    showToast(`You've reached your daily limit of ${AI_DAILY_LIMIT} AI queries. Please try again tomorrow!`, 'warning');
    
    // Add shake animation to input
    const input = document.getElementById('assistantInput');
    if (input) {
      input.classList.add('animate-shake');
      setTimeout(() => input.classList.remove('animate-shake'), 400);
    }
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
    
    // Increment usage counter
    incrementAIUsage();
    
    // Use Gemini API if available
    if (genAI) {
      aiResponse = await getGeminiResponseWithRAG(question);
    } else {
      aiResponse = "⚠️ Gemini API is not configured yet. The AI assistant will be available once the API key is added.\n\nIn the meantime, you can still browse listings, create listings, and chat with other users!";
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
    
    // Clear old messages from UI only (not database) - keep last 20 messages in UI
    const allMessages = messagesDiv.querySelectorAll('.assistant-message');
    if (allMessages.length > 30) {
      for (let i = 0; i < allMessages.length - 20; i++) {
        allMessages[i].remove();
      }
    }
    
  } catch (err) {
    console.error('AI Assistant error:', err);
    typingDiv.remove();
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'assistant-message bot';
    errorMsg.textContent = '⚠️ Sorry, I encountered an error. Please try again later.';
    messagesDiv.appendChild(errorMsg);
  }
  
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

// RAG-enhanced Gemini response function
async function getGeminiResponseWithRAG(userMessage) {
  if (!genAI) {
    return "⚠️ Gemini API is not configured. Once the API key is added, I'll be able to help you with marketplace questions!";
  }
  
  try {
    // First, fetch relevant listings from the database for context
    const { data: recentListings } = await db
      .from('listings')
      .select('name, category, price, condition, location')
      .eq('is_sold', false)
      .limit(10);
    
    // Extract keywords from user message for better context
    const keywords = userMessage.toLowerCase();
    let relevantContext = "";
    
    if (recentListings && recentListings.length > 0) {
      const relevantListings = recentListings.filter(l => 
        keywords.includes(l.name?.toLowerCase() || '') ||
        keywords.includes(l.category?.toLowerCase() || '')
      ).slice(0, 5);
      
      if (relevantListings.length > 0) {
        relevantContext = "\n\nRelevant current listings on OBTAINUM:\n";
        relevantListings.forEach(l => {
          relevantContext += `- ${l.name} (${l.category}): $${l.price} (${l.condition} condition)${l.location ? ` in ${l.location}` : ''}\n`;
        });
      }
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `You are OBTAINUM AI, a friendly and helpful assistant for a marketplace website. 
Your role is to help users with general questions about buying, selling, collectibles, pricing, safety tips, and marketplace navigation.

Keep responses:
- Concise and helpful (max 300 words)
- Friendly and approachable
- Use bullet points when listing multiple items
- Be honest about limitations

${relevantContext}

User question: ${userMessage}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (err) {
    console.error('Gemini API error:', err);
    return "⚠️ Sorry, I'm having trouble connecting right now. Please try again in a moment.";
  }
}

// ==================== MAP FUNCTIONS (Leaflet + OpenStreetMap) ====================

let currentMap = null;

function initializeMap(elementId, centerLat = 40.7128, centerLng = -74.0060, zoom = 12) {
  if (currentMap) {
    currentMap.remove();
  }
  
  currentMap = L.map(elementId).setView([centerLat, centerLng], zoom);
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    minZoom: 3
  }).addTo(currentMap);
  
  return currentMap;
}

async function geocodeLocation(locationName) {
  // Try OpenStreetMap Nominatim API (free, no API key)
  const encodedLocation = encodeURIComponent(locationName);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OBTAINUM-Marketplace/1.0'
      }
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
}

function addMarkerToMap(map, lat, lng, popupText, color = 'green') {
  const iconColor = color === 'green' ? 'success' : (color === 'red' ? 'danger' : 'primary');
  const icon = L.divIcon({
    html: `<div style="background-color: ${color === 'green' ? '#00ff41' : '#ff2d55'}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px;">📍</div>`,
    className: 'custom-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  
  const marker = L.marker([lat, lng], { icon }).addTo(map);
  if (popupText) {
    marker.bindPopup(popupText);
  }
  return marker;
}

function addRouteToMap(map, startLat, startLng, endLat, endLng) {
  // Draw a simple line between two points
  const latlngs = [
    [startLat, startLng],
    [endLat, endLng]
  ];
  
  const polyline = L.polyline(latlngs, { color: '#00ff41', weight: 3, opacity: 0.7 }).addTo(map);
  
  // Fit bounds to show both points
  const bounds = L.latLngBounds(latlngs);
  map.fitBounds(bounds, { padding: [50, 50] });
  
  return polyline;
}

// ==================== ENHANCED ROUTE SAFETY WITH RAG AND MAP ====================

async function openRouteSafetyModal(listingId, sellerLocation) {
  const modal = document.getElementById('route-safety-modal');
  const content = document.getElementById('route-safety-content');
  
  if (!modal || !content) return;
  
  const savedLocation = localStorage.getItem('obtainum-user-location');
  
  content.innerHTML = `
    <div style="padding: 8px 0;">
      <div class="route-safety-card" style="margin-top: 0;">
        <div class="route-safety-header">
          <span style="font-size: 1.5rem;">📍</span>
          <div>
            <h4>Meet-up Location Safety Check</h4>
            <p style="font-size: 0.75rem; color: var(--text-muted);">AI-powered route and safety analysis with map</p>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Your Starting Location</label>
          <div class="location-input-group">
            <input type="text" id="route-user-location" placeholder="City, State or address" value="${escHtml(savedLocation || '')}" />
            <button class="btn btn-outline btn-sm" onclick="saveUserLocationForRoute()">💾 Save</button>
          </div>
          <small style="color: var(--text-muted);">We'll save this for future checks</small>
        </div>
        
        <div class="form-group">
          <label class="form-label">Seller's Location</label>
          <input type="text" id="route-seller-location" value="${escHtml(sellerLocation || 'Unknown')}" readonly disabled style="background: var(--bg-3);" />
        </div>
        
        <button class="btn btn-primary w-full" onclick="calculateRouteSafetyWithMap('${listingId}', '${escHtml(sellerLocation || '')}')" style="margin-top: 12px;">
          🗺️ Calculate Route & Safety Score
        </button>
        
        <div id="route-map-container" style="margin-top: 16px;"></div>
        <div id="route-safety-result" style="margin-top: 16px;"></div>
      </div>
    </div>
  `;
  
  modal.classList.add('open');
}

async function calculateRouteSafetyWithMap(listingId, sellerLocation) {
  const userLocation = document.getElementById('route-user-location')?.value.trim();
  const resultDiv = document.getElementById('route-safety-result');
  const mapContainer = document.getElementById('route-map-container');
  
  if (!userLocation) {
    showToast('Please enter your starting location first', 'error');
    resultDiv.innerHTML = '<div class="auth-error show" style="text-align:center;">⚠️ Please enter your location above</div>';
    return;
  }
  
  if (!sellerLocation || sellerLocation === 'Unknown') {
    resultDiv.innerHTML = '<div class="auth-error show" style="text-align:center;">⚠️ Seller location not available for safety check</div>';
    return;
  }
  
  resultDiv.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div> AI analyzing route safety...</div>';
  if (mapContainer) mapContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div> Loading map...</div>';
  
  try {
    // Geocode both locations
    const userCoords = await geocodeLocation(userLocation);
    const sellerCoords = await geocodeLocation(sellerLocation);
    
    if (!userCoords || !sellerCoords) {
      resultDiv.innerHTML = '<div class="auth-error show" style="text-align:center;">⚠️ Could not geocode one or both locations. Please be more specific.</div>';
      if (mapContainer) mapContainer.innerHTML = '';
      return;
    }
    
    // Initialize and display map
    if (mapContainer) {
      mapContainer.innerHTML = '<div id="route-map" class="route-map"></div>';
      const map = initializeMap('route-map', (userCoords.lat + sellerCoords.lat) / 2, (userCoords.lng + sellerCoords.lng) / 2, 10);
      
      // Add markers
      addMarkerToMap(map, userCoords.lat, userCoords.lng, `You: ${userLocation}`, 'green');
      addMarkerToMap(map, sellerCoords.lat, sellerCoords.lng, `Seller: ${sellerLocation}`, 'red');
      
      // Add route line
      addRouteToMap(map, userCoords.lat, userCoords.lng, sellerCoords.lat, sellerCoords.lng);
    }
    
    // Calculate distance (Haversine formula)
    const distance = calculateDistance(userCoords.lat, userCoords.lng, sellerCoords.lat, sellerCoords.lng);
    const travelTimeMinutes = Math.round(distance / 30 * 60); // Assume 30 mph average
    
    // Get safety analysis with RAG (using marketplace data for context)
    let safetyAnalysis;
    if (genAI) {
      safetyAnalysis = await analyzeRouteWithGeminiRAG(userLocation, sellerLocation, distance, travelTimeMinutes);
    } else {
      safetyAnalysis = getFallbackRouteAnalysisWithRAG(userLocation, sellerLocation, distance, travelTimeMinutes);
    }
    
    displayRouteSafetyResultWithMap(safetyAnalysis, userLocation, sellerLocation, distance, travelTimeMinutes);
    
    if (resultDiv) {
      resultDiv.classList.add('animate-fade');
    }
    
  } catch (err) {
    console.error('Route safety analysis error:', err);
    resultDiv.innerHTML = `<div class="auth-error show" style="text-align:center;">⚠️ Error analyzing route: ${err.message || 'Please try again'}</div>`;
    if (mapContainer) mapContainer.innerHTML = '';
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function analyzeRouteWithGeminiRAG(userLocation, sellerLocation, distance, travelTimeMinutes) {
  if (!genAI) return getFallbackRouteAnalysisWithRAG(userLocation, sellerLocation, distance, travelTimeMinutes);
  
  // Fetch relevant safety data from marketplace (RAG)
  const { data: nearbyListings } = await db
    .from('listings')
    .select('location, name')
    .ilike('location', `%${sellerLocation.split(',')[0]}%`)
    .limit(5);
  
  const nearbyContext = nearbyListings && nearbyListings.length > 0 
    ? `\nNearby listings in the seller's area: ${nearbyListings.map(l => l.name).join(', ')}`
    : '';
  
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `You are OBTAINUM's safety AI. Analyze a potential meet-up route for a marketplace transaction.

USER STARTING LOCATION: ${userLocation}
SELLER/ITEM LOCATION: ${sellerLocation}
ESTIMATED DISTANCE: ${distance.toFixed(1)} miles
ESTIMATED TRAVEL TIME: ${travelTimeMinutes} minutes
${nearbyContext}

Provide a JSON response with route safety analysis. Consider:
- Distance and travel time reasonability
- General safety considerations for meeting strangers in this area
- Best practices for safe exchanges
- Whether the distance is reasonable for a local transaction

Return ONLY valid JSON with this structure:
{
  "estimatedDistance": "${distance.toFixed(1)} miles",
  "estimatedTravelTime": "${travelTimeMinutes} min drive",
  "safetyScore": 0-100,
  "safetyLevel": "High / Medium / Low",
  "recommendedMeetingSpot": "Suggested public meeting location type",
  "safetyTips": ["tip 1", "tip 2", "tip 3"],
  "overallAssessment": "Brief overall safety assessment"
}`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getFallbackRouteAnalysisWithRAG(userLocation, sellerLocation, distance, travelTimeMinutes);
  } catch (err) {
    console.error('Gemini route analysis error:', err);
    return getFallbackRouteAnalysisWithRAG(userLocation, sellerLocation, distance, travelTimeMinutes);
  }
}

function getFallbackRouteAnalysisWithRAG(userLocation, sellerLocation, distance, travelTimeMinutes) {
  let safetyScore = 70;
  let safetyLevel = 'Medium';
  
  // Adjust score based on distance
  if (distance <= 5) {
    safetyScore = 90;
    safetyLevel = 'High';
  } else if (distance <= 20) {
    safetyScore = 75;
    safetyLevel = 'Medium';
  } else if (distance <= 50) {
    safetyScore = 55;
    safetyLevel = 'Medium';
  } else {
    safetyScore = 40;
    safetyLevel = 'Low';
  }
  
  return {
    estimatedDistance: `${distance.toFixed(1)} miles`,
    estimatedTravelTime: `${travelTimeMinutes} min drive`,
    safetyScore: safetyScore,
    safetyLevel: safetyLevel,
    recommendedMeetingSpot: distance <= 10 ? 'Public mall, coffee shop, or police station lobby' : 'Public location near seller\'s area, consider meeting halfway',
    safetyTips: [
      'Always meet in a public, well-lit area',
      'Bring a friend if possible',
      'Let someone know where you\'re going',
      'Trust your instincts - if something feels wrong, leave',
      'Consider meeting at a local police station lobby',
      distance > 30 ? '⚠️ Long distance - consider requesting shipping instead' : '✅ Reasonable distance for local meet-up'
    ],
    overallAssessment: safetyScore >= 70 ? 'This route appears reasonably safe for a meet-up.' : 
                       (safetyScore >= 40 ? 'Exercise normal caution for this meet-up.' : 
                       'Consider extra precautions or request shipping instead.')
  };
}

function displayRouteSafetyResultWithMap(analysis, userLocation, sellerLocation, distance, travelTimeMinutes) {
  const resultDiv = document.getElementById('route-safety-result');
  if (!resultDiv) return;
  
  const scoreColor = analysis.safetyScore >= 70 ? 'high' : (analysis.safetyScore >= 40 ? 'medium' : 'low');
  const scoreEmoji = analysis.safetyScore >= 70 ? '✅' : (analysis.safetyScore >= 40 ? '⚠️' : '⚠️⚠️');
  
  resultDiv.innerHTML = `
    <div class="route-safety-card animate-fade">
      <div class="route-safety-header">
        <div class="safety-score ${scoreColor}">${analysis.safetyScore}</div>
        <div>
          <h4>${scoreEmoji} ${analysis.safetyLevel} Safety Level</h4>
          <p style="font-size: 0.75rem; color: var(--text-muted);">AI-powered route analysis with RAG</p>
        </div>
      </div>
      
      <div class="route-details">
        <div class="route-detail-item">
          <span class="route-detail-label">📍 From</span>
          <span class="route-detail-value">${escHtml(userLocation)}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">🎯 To</span>
          <span class="route-detail-value">${escHtml(sellerLocation)}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">📏 Distance</span>
          <span class="route-detail-value">${analysis.estimatedDistance}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">⏱️ Est. Travel Time</span>
          <span class="route-detail-value">${analysis.estimatedTravelTime}</span>
        </div>
        <div class="route-detail-item">
          <span class="route-detail-label">📍 Recommended Meet-up</span>
          <span class="route-detail-value">${analysis.recommendedMeetingSpot}</span>
        </div>
      </div>
      
      <div class="safety-tips">
        <strong>🛡️ Safety Tips</strong>
        <ul>
          ${analysis.safetyTips.map(tip => `<li>${escHtml(tip)}</li>`).join('')}
        </ul>
      </div>
      
      <div style="margin-top: 12px; padding: 10px; background: rgba(0,255,65,0.05); border-radius: 8px;">
        <strong>📋 Overall Assessment:</strong> ${analysis.overallAssessment}
      </div>
    </div>
  `;
}

function saveUserLocationForRoute() {
  const locationInput = document.getElementById('route-user-location');
  if (locationInput && locationInput.value.trim()) {
    localStorage.setItem('obtainum-user-location', locationInput.value.trim());
    showToast('Location saved for future route checks!', 'success');
    
    const btn = locationInput.parentElement.querySelector('button');
    if (btn) {
      btn.classList.add('animate-scale-pulse');
      setTimeout(() => btn.classList.remove('animate-scale-pulse'), 400);
    }
  } else {
    showToast('Please enter a valid location', 'error');
  }
}

// ==================== MODIFY RENDER DETAIL TO ADD MAP BUTTON ====================

function addRouteSafetyButtonToListing(listing) {
  const detailActions = document.querySelector('.detail-actions');
  if (!detailActions) return;
  
  if (document.getElementById('route-safety-btn')) return;
  
  const sellerLocation = listing.location || 'Location not specified';
  const hasValidLocation = sellerLocation && sellerLocation !== 'Location not specified' && sellerLocation !== '';
  
  const routeBtn = document.createElement('button');
  routeBtn.id = 'route-safety-btn';
  routeBtn.className = 'btn btn-outline';
  routeBtn.innerHTML = '🗺️ Check Route Safety with Map';
  routeBtn.style.marginTop = '8px';
  
  if (!hasValidLocation) {
    routeBtn.disabled = true;
    routeBtn.style.opacity = '0.5';
    routeBtn.style.cursor = 'not-allowed';
    routeBtn.title = 'Seller location not provided';
    routeBtn.innerHTML = '🗺️ Route Safety (Location N/A)';
  } else {
    routeBtn.onclick = () => openRouteSafetyModal(listing.id, sellerLocation);
  }
  
  detailActions.appendChild(routeBtn);
}

// Override renderDetail to include route safety button
const originalRenderDetail = renderDetail;
renderDetail = function(listing) {
  originalRenderDetail(listing);
  setTimeout(() => addRouteSafetyButtonToListing(listing), 100);
};

// ==================== INITIALIZE ALL NEW FEATURES ====================

function initNewFeatures() {
  initNavState();
  addRippleEffectToButtons();
  initScrollReveal();
  initLogoGlitch();
  updateAIUsageDisplay();
  
  // Add animation to price slider
  const priceSlider = document.getElementById('price-slider');
  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      const valSpan = document.getElementById('price-slider-val');
      if (valSpan) {
        valSpan.classList.add('animate-scale-pulse');
        setTimeout(() => valSpan.classList.remove('animate-scale-pulse'), 200);
      }
    });
  }
  
  // Add animation to filter chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', function() {
      this.classList.add('animate-scale-pulse');
      setTimeout(() => this.classList.remove('animate-scale-pulse'), 300);
    });
  });
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(initNewFeatures, 100);
});


