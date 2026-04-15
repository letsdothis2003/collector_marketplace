// ==================== MESSAGES MODULE ====================
import { getDb, getCurrentUser } from './auth.js';
import { showToast, escHtml } from './utils.js';
import { navigate } from './main.js';

let currentChatPartnerId = null;
let currentListingId = null;

// Initialize messages page
export async function initMessages() {
  await loadMessages();
  initChat();
}

// Initialize chat
function initChat() {
  const db = getDb();
  if (!db) return;
  
  db.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const newMsg = payload.new;
      const user = getCurrentUser();
      const relevantToMe = newMsg.sender_id === user?.id || newMsg.receiver_id === user?.id;
      
      if (window.currentPage === 'messages' && relevantToMe && user) {
        const fromPartner = newMsg.sender_id === currentChatPartnerId;
        const fromMe = newMsg.sender_id === user?.id;
        
        if (fromPartner || fromMe) {
          renderMessage(newMsg, user?.id);
        }
        loadMessages();
      }
    })
    .subscribe();
}

// Start a new chat
export async function startChat(partnerId, listingId = null) {
  const user = getCurrentUser();
  if (!user) {
    window.openAuthModal();
    return;
  }
  if (partnerId === user.id) {
    showToast("You can't start a chat with yourself.", "info");
    return;
  }
  
  currentChatPartnerId = partnerId;
  currentListingId = listingId;
  navigate('messages');
}

// Load messages page
export async function loadMessages() {
  const user = getCurrentUser();
  if (!user) return;
  
  const db = getDb();
  const { data: allMessages, error } = await db
    .from('messages')
    .select(`
      *,
      sender:sender_id(id, username, avatar_url),
      receiver:receiver_id(id, username, avatar_url)
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetching conversations", error);
    return;
  }
  
  const conversations = new Map();
  if (allMessages) {
    allMessages.forEach(msg => {
      const partner = msg.sender.id === user.id ? msg.receiver : msg.sender;
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
    convoListEl.innerHTML = '<div class="empty-state-small" style="text-align:center;padding:40px;">No conversations yet.</div>';
  } else {
    sortedConversations.forEach(convo => {
      const partnerProfile = convo.partnerProfile;
      const isActive = currentChatPartnerId === partnerProfile.id;
      
      const li = document.createElement('div');
      li.className = `convo-item ${isActive ? 'active' : ''}`;
      li.setAttribute('data-id', partnerProfile.id);
      li.onclick = () => loadConversationThread(partnerProfile.id);
      
      const previewText = convo.lastMessage.image_url ? '📷 Sent an image' : convo.lastMessage.content;
      
      li.innerHTML = `
        <div class="convo-avatar" style="width:42px;height:42px;border-radius:50%;background:var(--bg-3);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0;">
          ${partnerProfile.username?.charAt(0) || '?'}
        </div>
        <div class="convo-details" style="overflow:hidden;">
          <div class="convo-username" style="font-weight:600;white-space:nowrap;">${escHtml(partnerProfile.username)}</div>
          <div class="convo-preview" style="font-size:0.82rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(previewText?.substring(0, 35) || '...')}</div>
        </div>
      `;
      convoListEl.appendChild(li);
    });
  }
  
  if (currentChatPartnerId) {
    await loadConversationThread(currentChatPartnerId, currentListingId);
  } else {
    const activeHeader = document.getElementById('activeChatHeader');
    const chatThread = document.getElementById('chatThread');
    const chatForm = document.getElementById('chatForm');
    if (activeHeader) activeHeader.innerHTML = 'Select a conversation';
    if (chatThread) chatThread.innerHTML = '<div class="empty-state-small" style="text-align:center;padding:40px;">Your messages will appear here.</div>';
    if (chatForm) chatForm.style.display = 'none';
  }
  
  // Set up message form
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatMessageInput');
  const chatImageInput = document.getElementById('chatImageInput');
  
  if (chatForm) {
    chatForm.onsubmit = async (e) => {
      e.preventDefault();
      await sendMessage();
    };
  }
  if (chatImageInput) {
    chatImageInput.onchange = async (e) => {
      await sendImage(e);
    };
  }
}

async function loadConversationThread(partnerId, listingId = null) {
  currentChatPartnerId = partnerId;
  const user = getCurrentUser();
  const db = getDb();
  
  // Update sidebar active state
  document.querySelectorAll('.convo-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === partnerId);
  });
  
  // Fetch partner info
  const { data: partnerProfile, error: pError } = await db.from('profiles').select('*').eq('id', partnerId).single();
  if (pError || !partnerProfile) return;
  
  const activeHeader = document.getElementById('activeChatHeader');
  const chatForm = document.getElementById('chatForm');
  if (activeHeader) activeHeader.innerHTML = `Chatting with <strong>${escHtml(partnerProfile.username)}</strong>`;
  if (chatForm) chatForm.style.display = 'flex';
  
  // Auto-fill message if coming from listing
  if (listingId && !window._listingMessageFilled) {
    const { data: listing } = await db.from('listings').select('name, price').eq('id', listingId).single();
    if (listing) {
      const input = document.getElementById('chatMessageInput');
      if (input) {
        input.value = `Hi, I'm interested in your "${listing.name}" for $${listing.price}.`;
        input.focus();
      }
    }
    window._listingMessageFilled = true;
    setTimeout(() => { window._listingMessageFilled = false; }, 1000);
  }
  
  // Fetch messages
  const { data: messages, error: mError } = await db
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: true });
  
  if (mError) return console.error("Error loading messages", mError);
  
  const threadEl = document.getElementById('chatThread');
  if (!threadEl) return;
  threadEl.innerHTML = '';
  if (messages) {
    messages.forEach(msg => renderMessage(msg, user.id));
  }
  threadEl.scrollTop = threadEl.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chatMessageInput');
  const content = input?.value.trim();
  const user = getCurrentUser();
  const db = getDb();
  
  if (!content || !currentChatPartnerId || !user) return;
  
  const { error } = await db.from('messages').insert([{
    sender_id: user.id,
    receiver_id: currentChatPartnerId,
    listing_id: currentListingId,
    content: content,
  }]);
  
  if (error) showToast("Error: " + error.message, 'error');
  else {
    if (input) input.value = '';
    await loadConversationThread(currentChatPartnerId);
    await loadMessages();
  }
}

async function sendImage(e) {
  const file = e.target.files[0];
  const user = getCurrentUser();
  const db = getDb();
  
  if (!file || !currentChatPartnerId || !user) return;
  
  const filePath = `${user.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await db.storage.from('chat-images').upload(filePath, file);
  
  if (uploadError) {
    showToast("Upload failed", 'error');
    return;
  }
  
  const { data: { publicUrl } } = db.storage.from('chat-images').getPublicUrl(filePath);
  
  await db.from('messages').insert([{
    sender_id: user.id,
    receiver_id: currentChatPartnerId,
    listing_id: currentListingId,
    image_url: publicUrl,
  }]);
  
  await loadConversationThread(currentChatPartnerId);
  await loadMessages();
}

function renderMessage(msg, currentUserId) {
  const thread = document.getElementById('chatThread');
  if (!thread) return;
  const isSent = msg.sender_id === currentUserId;
  const div = document.createElement('div');
  div.className = `msg ${isSent ? 'sent' : 'received'}`;
  div.style.maxWidth = '75%';
  div.style.padding = '10px 14px';
  div.style.borderRadius = 'var(--radius-lg)';
  div.style.fontSize = '0.92rem';
  div.style.lineHeight = '1.5';
  div.style.marginBottom = '8px';
  
  if (isSent) {
    div.style.background = 'var(--neon)';
    div.style.color = '#001a07';
    div.style.alignSelf = 'flex-end';
    div.style.borderBottomRightRadius = '4px';
  } else {
    div.style.background = 'var(--bg-3)';
    div.style.color = 'var(--text-secondary)';
    div.style.alignSelf = 'flex-start';
    div.style.borderBottomLeftRadius = '4px';
  }
  
  if (msg.image_url) {
    div.innerHTML = `<img src="${escHtml(msg.image_url)}" class="msg-image" style="max-width:200px;border-radius:8px;cursor:pointer;" onclick="window.open(this.src)">`;
  } else {
    div.innerHTML = escHtml(msg.content);
  }
  
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}