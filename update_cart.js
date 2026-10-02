const fs = require('fs');
const file = 'frontend/mikyaj-demo/cart.html';
let content = fs.readFileSync(file, 'utf8');

const newScript = `<script>
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  MikyajApp.updateCartBadge();
});

function renderCart() {
  const cart = MikyajStore.getCart();
  const container = document.getElementById('cartItems');
  const total = MikyajStore.getCartTotal();
  
  document.getElementById('cartCount').textContent = MikyajStore.getCartCount();
  container.innerHTML = '';

  if (cart.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:3rem 0;color:var(--outline)"><span class="material-symbols-outlined" style="font-size:48px;margin-bottom:1rem">shopping_bag</span><p>Your bag is empty.</p><a href="shop.html" class="btn btn-outline" style="margin-top:1rem">Continue Shopping</a></div>';
    document.getElementById('subtotal').textContent = 'KWD 0.000';
    document.getElementById('total').textContent = 'KWD 0.000';
    return;
  }

  cart.forEach(item => {
    // Relying on properties cached in the cart item
    const itemName = item.name || 'Unknown Product';
    const itemImg = item.image || 'https://placehold.co/400x500?text=No+Image';
    const itemPrice = item.price || 0;
    const itemSlug = item.slug || item.productId;
    const itemTotal = itemPrice * item.qty;

    container.innerHTML += \`
      <div class="cart-item" style="display:grid;grid-template-columns:80px 1fr auto;gap:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--outline-variant);align-items:center">
        <div style="background:var(--surface-container);aspect-ratio:1;border-radius:4px;overflow:hidden">
          <a href="product.html?slug=\${itemSlug}">
            <img src="\${itemImg}" alt="\${itemName}" style="width:100%;height:100%;object-fit:cover"/>
          </a>
        </div>
        <div>
          <a href="product.html?slug=\${itemSlug}" class="text-headline-sm" style="margin-bottom:4px;display:block;text-decoration:none;color:var(--on-surface)">\${itemName}</a>
          <div class="text-body-sm" style="color:var(--on-surface-variant);margin-bottom:8px">
            \${item.variant ? \`Variant: \${item.variant}<br>\` : ''}
            \${MikyajApp.formatKWD(itemPrice)}
          </div>
          <button class="text-label-caps" style="color:var(--error);display:flex;align-items:center;gap:4px" onclick="removeItem('\${item.productId}','\${item.variant||''}')">
            <span class="material-symbols-outlined" style="font-size:14px">delete</span> Remove
          </button>
        </div>
        <div class="flex" style="border:1px solid var(--outline);border-radius:24px;overflow:hidden;height:36px;align-items:center">
          <button style="padding:4px 8px;color:var(--on-surface-variant)" onclick="updateQty('\${item.productId}','\${item.variant||''}',\${item.qty-1})">−</button>
          <span style="padding:0 12px;font-weight:600">\${item.qty}</span>
          <button style="padding:4px 8px;color:var(--on-surface-variant)" onclick="updateQty('\${item.productId}','\${item.variant||''}',\${item.qty+1})">+</button>
        </div>
        <span class="text-price" style="text-align:right">\${MikyajApp.formatKWD(itemTotal)}</span>
      </div>\`;
  });

  document.getElementById('subtotal').textContent = MikyajApp.formatKWD(total);
  document.getElementById('total').textContent = MikyajApp.formatKWD(total);
}

function removeItem(id, variant) { MikyajStore.removeFromCart(id, variant || null); renderCart(); MikyajApp.showToast('Item removed from bag', 'info'); MikyajApp.updateCartBadge(); }
function updateQty(id, variant, qty) { if (qty < 1) return removeItem(id, variant); MikyajStore.updateCartQty(id, qty, variant || null); renderCart(); MikyajApp.updateCartBadge(); }
function requestQuote() { MikyajApp.showToast('WhatsApp quotation request sent!', 'success'); }
function proceedCheckout() {
  const cart = MikyajStore.getCart();
  const items = cart.map(item => { return { productId: item.productId, name: item.name, qty: item.qty, price: item.price, image: item.image }; });
  MikyajStore.addOrder({ customer: 'Guest Customer', items, total: MikyajStore.getCartTotal(), status: 'pending', paymentMethod: 'KNET' });
  MikyajStore.clearCart();
  MikyajApp.showToast('Order placed successfully! 🎉', 'success');
  MikyajApp.updateCartBadge();
  setTimeout(renderCart, 500);
}
</script>`;

content = content.replace(/<script src="js\/catalog-data\.js\?v=\d+"><\/script>\s*<script src="js\/store\.js\?v=3"><\/script>\s*<script src="js\/seed-data\.js\?v=\d+"><\/script>\s*<script src="js\/app\.js\?v=3"><\/script>/, '<script src="js/api.js?v=1"></script>\n<script src="js/store.js?v=3"></script>\n<script src="js/app.js?v=3"></script>');
content = content.replace(/<script>[\s\S]*?<\/script>\s*<script src="js\/mobile\.js\?v=1"><\/script>/, newScript + '\n  <script src="js/mobile.js?v=1"></script>');

fs.writeFileSync(file, content);
console.log('cart.html updated successfully');
