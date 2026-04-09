async function loadCart() {
  try {
    const items = await API.getCart();
    const sub = document.getElementById('cart-sub');
    const content = document.getElementById('cart-content');

    if (!items.length) {
      sub.textContent = '0 items';
      content.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.55L23 6H6"/></svg>
          <div class="empty-title">Your cart is empty</div>
          <div class="empty-sub">Browse the shop to find your next grail</div>
          <a href="/shop.html" class="btn btn-primary" style="margin-top:1.5rem">Explore the Shop</a>
        </div>`;
      return;
    }

    sub.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    const external = items.filter(i => i.source !== 'Marketplace');
    const marketplace = items.filter(i => i.source === 'Marketplace');

    let html = '';

    if (external.length) {
      html += `<div class="cart-section-label" style="margin-top:1.5rem">Tracking — External Purchases</div>`;
      html += external.map(item => cartItemHTML(item)).join('');
    }

    if (marketplace.length) {
      html += `<div class="cart-section-label" style="margin-top:${external.length ? '2rem' : '0'}">Obtainum Marketplace</div>`;
      html += marketplace.map(item => cartItemHTML(item)).join('');
    }

    // Total
    const total = items.reduce((sum, i) => sum + Number(i.price), 0);
    html += `
      <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)">Estimated Total</div>
          <div style="font-size:2rem;font-weight:800;color:var(--primary)">$${total.toFixed(2)}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:.25rem">External items open their own checkout. Marketplace items checkout here.</div>
        </div>
        ${marketplace.length ? `<button class="btn btn-primary btn-lg" onclick="showToast('Checkout coming soon!')">Checkout Marketplace Items</button>` : ''}
      </div>`;

    content.innerHTML = html;
  } catch {
    document.getElementById('cart-sub').textContent = 'Error loading cart';
  }
}

function cartItemHTML(item) {
  const scalped = Number(item.price) > Number(item.msrp) * 1.25;
  return `
    <div class="cart-item" id="cart-item-${item.cart_id}">
      <div class="cart-item-img">
        ${item.image_url ? `<img src="${item.image_url}" alt="${item.title}">` : ''}
      </div>
      <div style="flex:1;min-width:0">
        <a href="/listing.html?id=${item.id}" class="cart-item-title" style="display:block;transition:color .15s" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color=''">
          ${item.title}
        </a>
        <div class="cart-item-meta">
          ${item.source} · ${item.condition}
          ${item.source !== 'Marketplace' && item.external_url ? `· <a href="${item.external_url}" target="_blank" style="color:var(--primary);font-weight:700">Open Link ↗</a>` : ''}
        </div>
      </div>
      <div class="cart-item-price ${scalped ? '' : ''}" style="color:${scalped ? '#f87171' : 'var(--primary)'}">
        $${Number(item.price).toFixed(2)}
      </div>
      <button class="cart-remove" onclick="removeItem(${item.cart_id})" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`;
}

window.removeItem = async function(cartId) {
  try {
    await API.del(`/api/cart/${cartId}`);
    document.getElementById(`cart-item-${cartId}`)?.remove();
    updateCartBadge();
    loadCart(); // reload to recalculate total
  } catch { showToast('Failed to remove item', true); }
};

document.addEventListener('DOMContentLoaded', loadCart);
