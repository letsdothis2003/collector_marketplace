const SUGGESTIONS = [
  'Best site for vintage Transformers figures',
  'How do I spot fake Funko POPs?',
  'What makes a LEGO set valuable?',
  'Should I grade my vintage figures?',
];

function initAssistant() {
  const history = [
    { role: 'assistant', content: "Hey! I'm ObtainAI — your collector's assistant. Ask me about market trends, what to buy, how to spot fakes, or anything collector-related." }
  ];

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="ai-panel hidden" id="ai-panel">
      <div class="ai-panel-header">
        <div class="ai-panel-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div>
          <div class="ai-panel-name">Obtainum Assistant</div>
          <div class="ai-panel-sub">AI-powered guide</div>
        </div>
        <div class="ai-pulse"></div>
         <button class="ai-close-btn" id="ai-close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="ai-messages" id="ai-messages"></div>
      <div class="ai-suggestions" id="ai-suggestions"></div>
      <div class="ai-input-row">
        <input type="text" id="ai-input" class="input" placeholder="Ask me anything...">
        <button class="btn btn-primary ai-send" id="ai-send">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 22-2z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  renderMessages();
  renderSuggestions();

  document.getElementById('ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendAIMessage();
  });

  document.getElementById('ai-send').addEventListener('click', () => sendAIMessage());
  document.getElementById('ai-close-btn').addEventListener('click', () => toggleAIAssistant());


  function renderMessages() {
    const container = document.getElementById('ai-messages');
    if (!container) return;
    container.innerHTML = history.map(m => `
      <div class="ai-bubble ${m.role}">
        ${m.role === 'assistant' ? `<div class="ai-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>` : ''}
        <div class="ai-text">${m.content}</div>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  function renderSuggestions() {
    const s = document.getElementById('ai-suggestions');
    if (!s) return;
    if (history.length > 1) { s.innerHTML = ''; return; }
    s.innerHTML = SUGGESTIONS.map(q =>
      `<button class="ai-suggest-chip" onclick="sendAIMessage('${q.replace(/'/g, "\\'")}')">
        ${q}
      </button>`
    ).join('');
  }

  function showTyping() {
    const container = document.getElementById('ai-messages');
    const typing = document.createElement('div');
    typing.className = 'ai-bubble assistant';
    typing.id = 'ai-typing';
    typing.innerHTML = `<div class="ai-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div class="ai-text" style="background:rgba(255,255,255,.06);border-radius:.25rem 1rem 1rem 1rem"><div class="ai-typing"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div></div>`;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  window.sendAIMessage = async function(text) {
    const input = document.getElementById('ai-input');
    const msg = text || input.value.trim();
    if (!msg) return;
    if (input) input.value = '';

    history.push({ role: 'user', content: msg });
    renderMessages();
    renderSuggestions();
    showTyping();

    const sendBtn = document.getElementById('ai-send');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const data = await API.chatWithAI(msg, history.slice(0, -1).slice(-8));
      document.getElementById('ai-typing')?.remove();
      history.push({ role: 'assistant', content: data });
      renderMessages();
    } catch(e) {
      console.error(e);
      document.getElementById('ai-typing')?.remove();
      history.push({ role: 'assistant', content: "Sorry, I'm having trouble connecting. Try again in a moment!" });
      renderMessages();
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  };
}

window.toggleAIAssistant = function() {
  const panel = document.getElementById('ai-panel');
  const fab = document.getElementById('ai-assistant-btn');

  if (!panel || !fab) return;

  const isHidden = panel.classList.toggle('hidden');
  fab.classList.toggle('open', !isHidden);
};

document.addEventListener('DOMContentLoaded', initAssistant);
