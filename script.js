// ========== NAV TOGGLE FUNCTION ==========
function toggleExtendedNav() {
  const extendedNav = document.getElementById('nav-menu-extended');
  extendedNav.classList.toggle('hidden');
  
  // Close when clicking outside
  if (!extendedNav.classList.contains('hidden')) {
    setTimeout(() => {
      document.addEventListener('click', function closeNav(e) {
        if (!extendedNav.contains(e.target) && !e.target.closest('.nav-toggle-btn')) {
          extendedNav.classList.add('hidden');
          document.removeEventListener('click', closeNav);
        }
      });
    }, 0);
  }
}

// ========== ROUTE & SAFETY CALCULATOR ==========
async function calculateRouteAndSafety() {
  const userLocation = document.getElementById('route-user-location').value;
  const listingLocation = currentListingDetails?.location;
  
  if (!userLocation) {
    showToast('Please enter your location', 'error');
    return;
  }
  
  if (!listingLocation) {
    showToast('Seller has not provided a location', 'error');
    return;
  }
  
  const resultDiv = document.getElementById('route-result');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = '<div class="spinner"></div> Calculating route and safety...';
  
  try {
    // Simulate AI calculation (replace with actual API call)
    const analysis = await simulateRouteSafetyAnalysis(userLocation, listingLocation);
    
    resultDiv.innerHTML = `
      <div class="route-info">
        🚗 <strong>From:</strong> ${escapeHtml(userLocation)}<br>
        🏠 <strong>To:</strong> ${escapeHtml(listingLocation)}
      </div>
      <div class="safety-score ${analysis.safetyClass}">
        🛡️ Safety Score: ${analysis.safetyScore}/100 - ${analysis.safetyRating}
      </div>
      <div class="safety-details">
        ${analysis.details}
      </div>
    `;
  } catch (error) {
    resultDiv.innerHTML = `<div class="safety-details" style="color: var(--danger);">
      ⚠️ Unable to calculate route. Please try again.
    </div>`;
  }
}

async function simulateRouteSafetyAnalysis(userLoc, listingLoc) {
  // This simulates AI analysis. In production, you'd call an actual API
  // like Google Maps Distance Matrix API and a crime data API
  
  const randomScore = Math.floor(Math.random() * 100);
  let safetyRating, safetyClass, details;
  
  if (randomScore >= 70) {
    safetyRating = 'Very Safe';
    safetyClass = 'high';
    details = '✅ This area has low crime rates and good lighting. Suggested meeting spots: local police station or busy coffee shops.';
  } else if (randomScore >= 40) {
    safetyRating = 'Moderately Safe';
    safetyClass = 'medium';
    details = '⚠️ Exercise normal precautions. Meet during daylight hours in public spaces. Bring a friend if possible.';
  } else {
    safetyRating = 'Exercise Caution';
    safetyClass = 'low';
    details = '🔴 High crime area reported. Consider meeting at a police station or public library. Avoid meeting at night.';
  }
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    safetyScore: randomScore,
    safetyRating,
    safetyClass,
    details: `${details}<br><br>💡 <strong>AI Recommendation:</strong> ${getRecommendation(randomScore)}`
  };
}

function getRecommendation(score) {
  if (score >= 70) {
    return 'Safe for local pickup. Use common sense as usual.';
  } else if (score >= 40) {
    return 'Consider using shipping instead of local pickup, or meet at a trusted public location.';
  } else {
    return 'Strongly recommend shipping option instead of local pickup. If meeting, do so at a police station.';
  }
}

// ========== MESSAGE TIMESTAMP FORMATTING ==========
function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

// Enhanced message rendering with timestamps
function renderMessageWithTimestamp(message, isSent) {
  const timeStr = formatMessageTime(message.created_at);
  return `
    <div class="msg ${isSent ? 'sent' : 'received'}">
      ${escapeHtml(message.content || '')}
      ${message.image_url ? `<img src="${message.image_url}" class="msg-image" onclick="window.open('${message.image_url}', '_blank')" />` : ''}
      <span class="msg-timestamp">${timeStr}</span>
    </div>
  `;
}

// ========== PERFORMANCE OPTIMIZATIONS ==========
// Implement lazy loading for images
function setupLazyLoading() {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      }
    });
  });
  
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// Debounce search input
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Virtual scrolling for large lists
class VirtualScroller {
  constructor(container, itemHeight, renderItem, loadMore) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.loadMore = loadMore;
    this.items = [];
    this.visibleItems = new Map();
    this.scrollTop = 0;
    
    this.container.addEventListener('scroll', debounce(() => this.onScroll(), 16));
    this.onScroll();
  }
  
  setItems(items) {
    this.items = items;
    this.container.style.height = `${this.items.length * this.itemHeight}px`;
    this.onScroll();
  }
  
  onScroll() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(viewportHeight / this.itemHeight) + 5,
      this.items.length
    );
    
    // Check if we need to load more
    if (endIndex >= this.items.length - 10) {
      this.loadMore();
    }
    
    // Render visible items
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.visibleItems.has(i)) {
        const element = this.renderItem(this.items[i], i);
        element.style.position = 'absolute';
        element.style.top = `${i * this.itemHeight}px`;
        element.style.left = '0';
        element.style.right = '0';
        this.container.appendChild(element);
        this.visibleItems.set(i, element);
      }
    }
    
    // Remove out-of-view items
    for (const [index, element] of this.visibleItems) {
      if (index < startIndex - 5 || index > endIndex + 5) {
        element.remove();
        this.visibleItems.delete(index);
      }
    }
  }
}

// ========== CACHE MANAGEMENT ==========
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedOrFetch(key, fetchFn) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

function clearCache() {
  cache.clear();
}

// Clear cache every hour
setInterval(clearCache, 60 * 60 * 1000);

// ========== AI ASSISTANT WITH TIMESTAMPS ==========
async function askAssistant(question) {
  if (!currentUser) {
    showToast('Please login to use AI Assistant', 'error');
    return;
  }
  
  const messagesContainer = document.getElementById('assistantMessages');
  
  // Add user message with timestamp
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'assistant-message user';
  userMsgDiv.innerHTML = `
    ${escapeHtml(question)}
    <span class="msg-timestamp">${formatMessageTime(new Date())}</span>
  `;
  messagesContainer.appendChild(userMsgDiv);
  
  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'assistant-message bot';
  typingDiv.innerHTML = '<div class="typing-indicator">AI is thinking<span>.</span><span>.</span><span>.</span></div>';
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // Save user message to DB
    await saveAIChatMessage('user', question);
    
    // Get AI response (implement with your AI service)
    const response = await getAIResponse(question);
    
    // Remove typing indicator
    typingDiv.remove();
    
    // Add AI response with timestamp
    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'assistant-message bot';
    aiMsgDiv.innerHTML = `
      ${escapeHtml(response)}
      <span class="msg-timestamp">${formatMessageTime(new Date())}</span>
    `;
    messagesContainer.appendChild(aiMsgDiv);
    
    // Save AI response to DB
    await saveAIChatMessage('ai', response);
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (error) {
    typingDiv.remove();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'assistant-message bot';
    errorDiv.innerHTML = `
      Sorry, I encountered an error. Please try again.
      <span class="msg-timestamp">${formatMessageTime(new Date())}</span>
    `;
    messagesContainer.appendChild(errorDiv);
  }
}

// Typing indicator CSS
const typingStyles = `
.typing-indicator span {
  animation: blink 1.4s infinite both;
}
.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}
`;

// Add typing styles
const styleSheet = document.createElement("style");
styleSheet.textContent = typingStyles;
document.head.appendChild(styleSheet);

// ========== LAZY LOAD INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
  setupLazyLoading();
  
  // Prefetch common data
  prefetchData();
});

async function prefetchData() {
  // Prefetch categories and initial listings
  const categories = await getCachedOrFetch('categories', fetchCategories);
  const initialListings = await getCachedOrFetch('listings', () => fetchListings({ limit: 20 }));
}

// ========== HELPER FUNCTIONS ==========
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global variable to store current listing details
let currentListingDetails = null;

// Override showDetail to store listing details
const originalShowDetail = window.showDetail;
window.showDetail = function(listingId) {
  originalShowDetail(listingId);
  // Store listing details for route calculator
  const listing = allListings.find(l => l.id === listingId);
  if (listing) {
    currentListingDetails = listing;
    const routeSection = document.getElementById('route-safety-section');
    if (listing.location) {
      routeSection.style.display = 'block';
    } else {
      routeSection.style.display = 'none';
    }
  }
};
