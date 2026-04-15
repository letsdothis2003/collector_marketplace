// ==================== AI ASSISTANT MODULE ====================
import { getDb, getCurrentUser } from './auth.js';
import { GEMINI_API_KEY } from './config.js';
import { showToast, escHtml } from './utils.js';

let genAI = null;
let aiSessionId = null;
let aiMessages = [];

// Initialize Gemini if key is available
if (GEMINI_API_KEY && GEMINI_API_KEY !== null && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log('[OBTAINUM] Gemini AI initialized');
}

// Initialize assistant page
export async function initAssistant() {
  await initAIAssistant();
}

// Initialize AI session
async function initAIAssistant() {
  const user = await getCurrentUser();
  if (!user) return;
  
  if (!aiSessionId) {
    aiSessionId = crypto.randomUUID();
  }
  
  await loadAIChatHistory();
  
  // Set up event listeners
  const askBtn = document.getElementById('askAssistantBtn');
  const input = document.getElementById('assistantInput');
  const suggestionChips = document.querySelectorAll('.suggestion-chip');
  
  if (askBtn) askBtn.onclick = () => askAssistant();
  if (input) input.onkeypress = (e) => { if (e.key === 'Enter') askAssistant(); };
  
  suggestionChips.forEach(chip => {
    chip.onclick = () => {
      const suggestion = chip.dataset.suggestion || chip.textContent.replace(/^[^\w]+/, '');
      if (input) input.value = suggestion;
      askAssistant();
    };
  });
}

// Load chat history from database
async function loadAIChatHistory() {
  const user = getCurrentUser();
  if (!user) return;
  
  const db = getDb();
  try {
    const { data, error } = await db
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    aiMessages = data || [];
    
    const messagesDiv = document.getElementById('assistantMessages');
    if (messagesDiv) {
      if (aiMessages.length === 0) {
        messagesDiv.innerHTML = '<div class="assistant-message bot">✨ Hi! I\'m your OBTAINUM AI assistant. Ask me anything about the marketplace!</div>';
      } else {
        messagesDiv.innerHTML = '';
        aiMessages.forEach(msg => {
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

// Save message to database
async function saveAIMessage(senderType, content) {
  const user = getCurrentUser();
  if (!user) return;
  
  const db = getDb();
  try {
    const { error } = await db
      .from('ai_chat_messages')
      .insert({
        sender_type: senderType,
        user_id: user.id,
        session_id: aiSessionId,
        content: content
      });
    
    if (error) throw error;
    
    aiMessages.push({
      sender_type: senderType,
      content: content,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving AI message:', err);
  }
}

// Ask the AI assistant
export async function askAssistant() {
  const user = getCurrentUser();
  if (!user) {
    window.openAuthModal();
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
  
  // Save user message
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
    
    if (genAI) {
      aiResponse = await getGeminiResponse(question);
    } else {
      aiResponse = "⚠️ Gemini API is not configured yet. The AI assistant will be available once the API key is added.\n\nIn the meantime, you can still browse listings, create listings, and chat with other users!";
    }
    
    typingDiv.remove();
    
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'assistant-message bot';
    botMsgDiv.innerHTML = aiResponse.replace(/\n/g, '<br>');
    messagesDiv.appendChild(botMsgDiv);
    
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
- Concise and helpful (2-3 paragraphs max)
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

export function askSuggestion(suggestion) {
  const input = document.getElementById('assistantInput');
  if (input) input.value = suggestion;
  askAssistant();
}

// Listing AI suggestion (generates once and saves to DB)
export async function generateAndSaveListingSuggestion(listingId) {
  const db = getDb();
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
  
  // Get listing data
  const { data: listing, error } = await db
    .from('listings')
    .select('*, profiles:seller_id(username, rating, location)')
    .eq('id', listingId)
    .single();
  
  if (error || !listing) return null;
  
  let suggestion = null;
  
  if (genAI) {
    try {
      suggestion = await analyzeListingWithGemini(listing);
    } catch (err) {
      suggestion = getFallbackListingAnalysis(listing);
    }
  } else {
    suggestion = getFallbackListingAnalysis(listing);
  }
  
  // Save to database
  if (suggestion) {
    await db.from('listings').update({ ai_suggestions: suggestion }).eq('id', listingId);
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
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return getFallbackListingAnalysis(listing);
  } catch (err) {
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

export async function displayListingSuggestion(listingId) {
  const suggestion = await generateAndSaveListingSuggestion(listingId);
  const container = document.getElementById(`ai-suggestions-${listingId}`);
  
  if (!container || !suggestion) return;
  
  const scoreColor = suggestion.score >= 70 ? 'var(--neon)' : (suggestion.score >= 40 ? 'var(--warning)' : 'var(--danger)');
  
  container.innerHTML = `
    <div class="ai-suggestion-card" style="background:var(--bg-2); border-radius:var(--radius-lg); padding:16px; margin-top:16px; border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="ai-dot" style="width:8px;height:8px;background:var(--neon);border-radius:50%;display:inline-block;animation:pulse 1.5s ease-in-out infinite;"></span>
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