// ============ CONFIG ============
// Supabase → Project Settings → API
const SUPABASE_URL = 'https://toamvzsfxcmhaqwgszqb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0l4syHQPB3qy518KCFL_ow_ZDt5V3TU';
// ================================

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('.food-grid');
  const categoryEls = [...document.querySelectorAll('.category')];
  const fmt = n => '₭ ' + Number(n).toLocaleString('en-US');

  // Supabase client (null if not configured, the site still works with static cards)
  let sb = null;
  if (window.supabase && !SUPABASE_URL.startsWith('YOUR_')) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // ---------- Menu ----------
  // Fallback: read the cards already in the HTML
  function itemsFromDom() {
    return [...grid.querySelectorAll('.food-card')].map((card, i) => ({
      id: 'static-' + i,
      name: card.querySelector('h3').textContent.trim(),
      description: card.querySelector('.food-description').textContent.trim(),
      category: card.querySelector('.food-description').textContent.trim(),
      price: parseInt(card.querySelector('.food-bottom strong').textContent.replace(/\D/g, ''), 10),
      rating: card.querySelector('.rating strong').textContent.trim(),
      prep_time: '15–20 ນາທີ',
      image_url: card.querySelector('img').getAttribute('src'),
      is_popular: !!card.querySelector('.food-badge'),
    }));
  }

  let menu = itemsFromDom();

  if (sb) {
    const { data, error } = await sb.from('menu_items').select('*').order('id');
    if (error) console.error('Menu load failed, using static menu:', error.message);
    else if (data.length) menu = data;
  }

  const HEART = grid.querySelector('.heart')?.innerHTML || '';
  const PLUS = grid.querySelector('.add')?.innerHTML || '+';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderMenu(list) {
    grid.replaceChildren();
    list.forEach(item => {
      const card = el('article', 'food-card');

      const imgWrap = el('div', 'food-image');
      const img = document.createElement('img');
      img.src = item.image_url || '';
      img.alt = item.name;
      img.loading = 'lazy';
      imgWrap.append(img);
      if (item.is_popular) imgWrap.append(el('span', 'food-badge', 'ຍອດນິຍົມ'));
      const heart = el('span', 'heart');
      heart.innerHTML = HEART; // static SVG copied from the page
      imgWrap.append(heart);

      const heading = el('div', 'food-heading');
      heading.append(el('h3', '', item.name));

      const rating = el('div', 'rating');
      rating.append(
        el('span', '', '★'),
        el('strong', '', item.rating ?? ''),
        el('span', 'rating-divider', '·'),
        el('span', '', item.prep_time || '15–20 ນາທີ')
      );

      const bottom = el('div', 'food-bottom');
      bottom.append(el('strong', '', fmt(item.price)));
      const add = el('span', 'add');
      add.innerHTML = PLUS;
      add.setAttribute('role', 'button');
      add.setAttribute('aria-label', 'Add ' + item.name);
      add.addEventListener('click', () => addToCart(item));
      bottom.append(add);

      card.append(imgWrap, heading, el('p', 'food-description', item.description || ''), rating, bottom);
      grid.append(card);
    });
  }

  // ---------- Category filter ----------
  categoryEls.forEach((c, idx) => {
    c.addEventListener('click', () => {
      categoryEls.forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      const label = c.textContent.trim();
      if (idx === 0) return renderMenu(menu);
      if (label === 'ຍອດນິຍົມ') return renderMenu(menu.filter(i => i.is_popular));
      renderMenu(menu.filter(i => (i.category || '').includes(label)));
    });
  });

  // ---------- Cart ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('kupa_cart') || '[]'); } catch { cart = []; }
  const save = () => { try { localStorage.setItem('kupa_cart', JSON.stringify(cart)); } catch {} };

  // Cart UI
  const overlay = el('div', 'cart-overlay');
  const panel = el('aside', 'cart-panel');
  panel.innerHTML = `
    <div class="cart-head"><h2>ກະຕ່າ</h2><button class="cart-close" aria-label="Close">✕</button></div>
    <div class="cart-items"></div>
    <div class="cart-form">
      <input id="c-name" placeholder="ຊື່" autocomplete="name">
      <input id="c-phone" placeholder="ເບີໂທ" inputmode="tel" autocomplete="tel">
    </div>
    <div class="cart-total"><span>ລວມ</span><span id="c-total"></span></div>
    <button class="cart-submit">ສັ່ງເລີຍ</button>
    <div class="cart-msg"></div>`;
  document.body.append(overlay, panel);

  const itemsBox = panel.querySelector('.cart-items');
  const totalEl = panel.querySelector('#c-total');
  const msg = panel.querySelector('.cart-msg');
  const submit = panel.querySelector('.cart-submit');

  const navCart = document.querySelector('[data-nav="cart"]');
  const badge = el('span', 'cart-count');
  navCart.append(badge);

  const openCart = () => { overlay.classList.add('open'); panel.classList.add('open'); };
  const closeCart = () => { overlay.classList.remove('open'); panel.classList.remove('open'); };
  navCart.addEventListener('click', openCart);
  navCart.addEventListener('keydown', e => { if (e.key === 'Enter') openCart(); });
  overlay.addEventListener('click', closeCart);
  panel.querySelector('.cart-close').addEventListener('click', closeCart);

  function addToCart(item) {
    const found = cart.find(i => i.id === item.id);
    if (found) found.qty++;
    else cart.push({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, qty: 1 });
    renderCart();
  }

  function changeQty(id, d) {
    const it = cart.find(i => i.id === id);
    if (!it) return;
    it.qty += d;
    if (it.qty <= 0) cart = cart.filter(i => i.id !== id);
    renderCart();
  }

  function renderCart() {
    save();
    itemsBox.replaceChildren();
    const count = cart.reduce((s, i) => s + i.qty, 0);
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);

    if (!cart.length) itemsBox.append(el('div', 'cart-empty', 'ກະຕ່າວ່າງ'));

    cart.forEach(i => {
      const row = el('div', 'cart-row');
      const img = document.createElement('img');
      img.src = i.image_url || ''; img.alt = '';
      const info = el('div', 'info');
      info.append(el('strong', '', i.name), el('span', '', fmt(i.price)));
      const qty = el('div', 'qty');
      const minus = el('button', '', '−'); minus.onclick = () => changeQty(i.id, -1);
      const plus = el('button', '', '+'); plus.onclick = () => changeQty(i.id, 1);
      qty.append(minus, el('span', '', i.qty), plus);
      row.append(img, info, qty);
      itemsBox.append(row);
    });

    totalEl.textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0));
    submit.disabled = !cart.length;
  }

  // ---------- Place order ----------
  submit.addEventListener('click', async () => {
    const name = panel.querySelector('#c-name').value.trim();
    const phone = panel.querySelector('#c-phone').value.trim();
    msg.className = 'cart-msg';
    if (!name || !phone) { msg.classList.add('err'); msg.textContent = 'ກະລຸນາໃສ່ຊື່ ແລະ ເບີໂທ'; return; }
    if (!sb) { msg.classList.add('err'); msg.textContent = 'Database not configured yet (add your Supabase keys in script.js).'; return; }

    submit.disabled = true;
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const { error } = await sb.from('orders').insert({
      customer_name: name,
      phone,
      items: cart.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
      total,
    });

    if (error) {
      console.error(error);
      msg.classList.add('err'); msg.textContent = 'ສັ່ງບໍ່ສຳເລັດ, ລອງໃໝ່ອີກຄັ້ງ';
      submit.disabled = false;
      return;
    }
    cart = [];
    renderCart();
    msg.classList.add('ok'); msg.textContent = 'ສັ່ງສຳເລັດແລ້ວ! ຂອບໃຈ 🎄';
  });

  renderMenu(menu);
  renderCart();
});// Kupa: presentation-only UI.
// No event handlers, application logic, storage, or network requests.
// Responsive layouts are handled entirely in style.css.
