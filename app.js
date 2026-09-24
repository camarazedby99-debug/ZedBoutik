const SUPABASE_URL = 'https://sypixtgbbznxfnhydall.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_K5_plneGF5G1lrOjAobM5g_jE4DOk4f';
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const demoData = [
  {id:'demo1', name:'Parfum Premium', price:10000, category:'Parfums', description:'Parfum premium', stock:10, image:''},
  {id:'demo2', name:'Téléphone', price:75000, category:'Électronique', description:'Téléphone', stock:5, image:''},
  {id:'demo3', name:'Chaussures', price:15000, category:'Mode', description:'Chaussures', stock:8, image:''},
  {id:'demo4', name:'Table maison', price:30000, category:'Maison', description:'Table maison', stock:3, image:''}
];

const box = document.getElementById('products');

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

/* =========================
   SESSION UTILISATEUR
========================= */

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('zedboutik_current_user') || 'null');
  } catch (e) {
    return null;
  }
}

function saveCurrentUser(user) {
  if (user) {
    localStorage.setItem('zedboutik_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('zedboutik_current_user');
  }
}

async function syncCurrentUser(authUser) {
  if (!authUser) {
    saveCurrentUser(null);
    return null;
  }

  let profile = null;

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('full_name, phone, role, email')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!error) profile = data;
  } catch (e) {}

  const user = {
    id: authUser.id,
    email: authUser.email || profile?.email || '',
    name:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.email ||
      'Utilisateur',
    phone:
      profile?.phone ||
      authUser.user_metadata?.phone ||
      '',
    role:
      profile?.role ||
      authUser.user_metadata?.role ||
      'client'
  };

  saveCurrentUser(user);
  return user;
}

/* =========================
   PRODUITS
========================= */

function getProducts() {
  try {
    return JSON.parse(localStorage.getItem('zedboutik_products') || '[]');
  } catch (e) {
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem('zedboutik_products', JSON.stringify(products));
}

function allProducts() {
  return [...getProducts(), ...demoData];
}

function renderProducts(list = allProducts()) {
  if (!box) return;

  if (!list.length) {
    box.innerHTML = '<p>Aucun produit trouvé.</p>';
    return;
  }

  box.innerHTML = list.map(p => `
    <article class="product" onclick="openProduct('${p.id}')">
      ${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">` : ''}
      <h3>${escapeHtml(p.name)}</h3>
      <div class="price">
        ${Number(p.price).toLocaleString('fr-FR')} FCFA
      </div>
      <p>${escapeHtml(p.description || '')}</p>
      <div class="stock">
        Catégorie : ${escapeHtml(p.category)} · Stock : ${p.stock}
      </div>
    </article>
  `).join('');
}

function filterCategory(cat) {
  renderProducts(allProducts().filter(p => p.category === cat));
}

function searchProducts() {
  const q = (document.getElementById('searchInput')?.value || '')
    .toLowerCase()
    .trim();

  renderProducts(
    q
      ? allProducts().filter(p =>
          `${p.name} ${p.category} ${p.description}`
            .toLowerCase()
            .includes(q)
        )
      : allProducts()
  );
}

/* =========================
   CONNEXION / INSCRIPTION
========================= */

function openAuth() {
  document.getElementById('authModal')?.classList.remove('hidden');
  showLogin();
}

function closeAuth() {
  document.getElementById('authModal')?.classList.add('hidden');
}

function showLogin() {
  document.getElementById('loginForm')?.classList.remove('hidden');
  document.getElementById('registerForm')?.classList.add('hidden');
}

function showRegister() {
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('registerForm')?.classList.remove('hidden');
}

async function updateAccountButton() {
  const btn = document.getElementById('loginBtn');
  if (!btn) return;

  const { data } = await supabaseClient.auth.getUser();
  const authUser = data?.user;

  if (!authUser) {
    saveCurrentUser(null);
    btn.textContent = '👤 Connexion';
    btn.onclick = openAuth;
    return;
  }

  const user = await syncCurrentUser(authUser);

  btn.textContent = '👤 ' + user.name;

  if (user.role === 'vendeur') {
    btn.onclick = openSeller;
  } else {
    btn.onclick = accountMenu;
  }
}

async function register() {
  const nom = document.getElementById('regName').value.trim();
  const telephone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const motDePasse = document.getElementById('regPassword').value;
  const role = document.querySelector('input[name="role"]:checked')?.value;

  if (!nom || !telephone || !email || !motDePasse || !role) {
    alert('Veuillez remplir tous les champs.');
    return;
  }

  if (motDePasse.length < 6) {
    alert('Le mot de passe doit contenir au moins 6 caractères.');
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: motDePasse,
    options: {
      data: {
        full_name: nom,
        phone: telephone,
        role: role
      }
    }
  });

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  if (!data.user) {
    alert('Erreur lors de la création du compte.');
    return;
  }

  const { error: profileError } = await supabaseClient
    .from('profiles')
    .upsert({
      id: data.user.id,
      full_name: nom,
      phone: telephone,
      email: email,
      role: role
    });

  if (profileError) {
    console.error(profileError);
  }

  if (data.session) {
    await syncCurrentUser(data.user);
  }

  await updateAccountButton();
  closeAuth();

  alert('✅ Compte créé avec succès !');
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    alert('Veuillez entrer votre email et votre mot de passe.');
    return;
  }

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    alert('Email ou mot de passe incorrect.');
    return;
  }

  await syncCurrentUser(data.user);
  await updateAccountButton();

  closeAuth();
  alert('✅ Connexion réussie !');
}

async function logout() {
  await supabaseClient.auth.signOut();
  saveCurrentUser(null);
  closeSeller();
  await updateAccountButton();
  alert('Vous êtes déconnecté.');
}

function accountMenu() {
  if (confirm('Voulez-vous vous déconnecter ?')) {
    logout();
  }
}

/* =========================
   ESPACE VENDEUR
========================= */

async function openSeller() {
  const { data } = await supabaseClient.auth.getUser();

  if (!data?.user) {
    openAuth();
    return;
  }

  const user = await syncCurrentUser(data.user);

  if (user.role !== 'vendeur') {
    alert('Ce compte est un compte client.');
    return;
  }

  const welcome = document.getElementById('sellerWelcome');

  if (welcome) {
    welcome.textContent =
      `Bienvenue ${user.name}. Publiez vos produits sur ZedBoutik.`;
  }

  document.getElementById('sellerModal')?.classList.remove('hidden');

  renderSellerProducts();
  renderSellerOrders();
}

function closeSeller() {
  document.getElementById('sellerModal')?.classList.add('hidden');
}

function previewImage(event) {
  const file = event.target.files?.[0];
  const img = document.getElementById('imagePreview');

  if (!file || !img) return;

  const reader = new FileReader();

  reader.onload = () => {
    img.src = reader.result;
    img.classList.remove('hidden');
  };

  reader.readAsDataURL(file);
}

function addProduct() {
  const user = getCurrentUser();

  if (!user || user.role !== 'vendeur') {
    alert('Connectez-vous avec un compte vendeur.');
    return;
  }

  const name = document.getElementById('productName').value.trim();
  const price = Number(document.getElementById('productPrice').value);
  const category = document.getElementById('productCategory').value;
  const description =
    document.getElementById('productDescription').value.trim();
  const stock = Number(document.getElementById('productStock').value);
  const file = document.getElementById('productImage').files?.[0];

  if (!name || price <= 0 || !category || !description || stock < 0) {
    alert('Veuillez remplir tous les champs du produit.');
    return;
  }

  const createProduct = (image = '') => {
    const products = getProducts();

    products.push({
      id: Date.now().toString(),
      sellerId: user.id,
      sellerEmail: user.email,
      sellerName: user.name,
      name,
      price,
      category,
      description,
      stock,
      image
    });

    saveProducts(products);

    [
      'productName',
      'productPrice',
      'productDescription',
      'productStock'
    ].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });

    const categoryInput = document.getElementById('productCategory');
    if (categoryInput) categoryInput.value = '';

    const imageInput = document.getElementById('productImage');
    if (imageInput) imageInput.value = '';

    document.getElementById('imagePreview')?.classList.add('hidden');

    renderSellerProducts();
    renderProducts();

    alert('✅ Produit publié avec succès !');
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = () => createProduct(reader.result);
    reader.readAsDataURL(file);
  } else {
    createProduct();
  }
}

function renderSellerProducts() {
  const user = getCurrentUser();
  const sellerBox = document.getElementById('sellerProducts');

  if (!sellerBox || !user) return;

  const products = getProducts().filter(
    p => p.sellerId === user.id || p.sellerEmail === user.email
  );

  sellerBox.innerHTML = products.length
    ? products.map(p => `
        <div class="seller-item">
          <div>
            <strong>${escapeHtml(p.name)}</strong><br>
            ${Number(p.price).toLocaleString('fr-FR')} FCFA ·
            Stock ${p.stock}
          </div>

          <button
            class="delete-btn"
            onclick="deleteProduct('${p.id}')">
            Supprimer
          </button>
        </div>
      `).join('')
    : '<p>Vous n’avez pas encore publié de produit.</p>';
}

function deleteProduct(id) {
  const user = getCurrentUser();
  if (!user) return;

  const product = getProducts().find(
    p => String(p.id) === String(id)
  );

  if (!product) return;

  if (
    product.sellerId &&
    product.sellerId !== user.id
  ) {
    alert('Vous ne pouvez pas supprimer ce produit.');
    return;
  }

  if (
    !product.sellerId &&
    product.sellerEmail !== user.email
  ) {
    alert('Vous ne pouvez pas supprimer ce produit.');
    return;
  }

  if (!confirm('Supprimer ce produit ?')) return;

  saveProducts(
    getProducts().filter(p => String(p.id) !== String(id))
  );

  renderSellerProducts();
  renderProducts();
}

/* =========================
   PANIER
========================= */

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('zedboutik_cart') || '[]');
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('zedboutik_cart', JSON.stringify(cart));
}

function updateCartCount() {
  const e = document.getElementById('cartCount');

  if (e) {
    e.textContent =
      getCart().reduce((sum, item) => sum + Number(item.qty), 0);
  }
}

function openProduct(id) {
  const p = allProducts().find(
    x => String(x.id) === String(id)
  );

  if (!p) return;

  const detail = document.getElementById('productDetail');
  if (!detail) return;

  detail.innerHTML = `
    ${p.image
      ? `<img src="${p.image}" class="detail-image" alt="${escapeHtml(p.name)}">`
      : ''
    }

    <h2>${escapeHtml(p.name)}</h2>

    <div class="price">
      ${Number(p.price).toLocaleString('fr-FR')} FCFA
    </div>

    <p>${escapeHtml(p.description || '')}</p>

    <p>
      <strong>Catégorie :</strong>
      ${escapeHtml(p.category)}
    </p>

    <p>
      <strong>Stock :</strong>
      ${p.stock}
    </p>

    <button
      class="primary"
      onclick="addToCart('${p.id}')">
      🛒 Ajouter au panier
    </button>
  `;

  document.getElementById('productModal')?.classList.remove('hidden');
}

function closeProduct() {
  document.getElementById('productModal')?.classList.add('hidden');
}

function addToCart(id) {
  const p = allProducts().find(
    x => String(x.id) === String(id)
  );

  if (!p) return;

  const cart = getCart();
  const existing = cart.find(
    x => String(x.id) === String(id)
  );

  if (existing) {
    if (existing.qty >= Number(p.stock || 0)) {
      alert('Stock disponible insuffisant.');
      return;
    }

    existing.qty++;
  } else {
    if (Number(p.stock || 0) <= 0) {
      alert('Produit en rupture de stock.');
      return;
    }

    cart.push({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image || '',
      qty: 1,
      sellerId: p.sellerId || '',
      sellerEmail: p.sellerEmail || '',
      sellerName: p.sellerName || ''
    });
  }

  saveCart(cart);
  updateCartCount();
  closeProduct();

  alert('✅ Produit ajouté au panier !');
}

function openCart() {
  const cart = getCart();
  const b = document.getElementById('cartItems');

  if (!b) return;

  b.innerHTML = cart.length
    ? cart.map(i => `
        <div class="cart-item">
          <div>
            ${i.image ? `<img src="${i.image}" alt="">` : ''}
            <strong>${escapeHtml(i.name)}</strong>
          </div>

          <div>
            ${i.qty} ×
            ${Number(i.price).toLocaleString('fr-FR')} FCFA

            <button
              class="delete-btn"
              onclick="removeFromCart('${i.id}')">
              Supprimer
            </button>
          </div>
        </div>
      `).join('')
    : '<p>Votre panier est vide.</p>';

  const total = cart.reduce(
    (sum, i) => sum + Number(i.price) * Number(i.qty),
    0
  );

  const totalBox = document.getElementById('cartTotal');

  if (totalBox) {
    totalBox.textContent =
      `Total : ${total.toLocaleString('fr-FR')} FCFA`;
  }

  document.getElementById('cartModal')?.classList.remove('hidden');
}

function closeCart() {
  document.getElementById('cartModal')?.classList.add('hidden');
}

function removeFromCart(id) {
  saveCart(
    getCart().filter(i => String(i.id) !== String(id))
  );

  updateCartCount();
  openCart();
}

/* =========================
   COMMANDE
========================= */

function openCheckout() {
  if (!getCart().length) {
    alert('Votre panier est vide.');
    return;
  }

  const user = getCurrentUser();

  if (user) {
    const name = document.getElementById('deliveryName');
    const phone = document.getElementById('deliveryPhone');

    if (name) name.value = user.name || '';
    if (phone) phone.value = user.phone || '';
  }

  closeCart();
  document.getElementById('checkoutModal')?.classList.remove('hidden');
}

function closeCheckout() {
  document.getElementById('checkoutModal')?.classList.add('hidden');
}

function getOrders() {
  try {
    return JSON.parse(
      localStorage.getItem('zedboutik_orders') || '[]'
    );
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(
    'zedboutik_orders',
    JSON.stringify(orders)
  );
}

function placeOrder() {
  const n = document.getElementById('deliveryName').value.trim();
  const ph = document.getElementById('deliveryPhone').value.trim();
  const a = document.getElementById('deliveryAddress').value.trim();
  const pay = document.getElementById('paymentMethod').value;

  if (!n || !ph || !a || !pay) {
    alert(
      'Veuillez remplir tous les champs de livraison et de paiement.'
    );
    return;
  }

  const cart = getCart();

  if (!cart.length) {
    alert('Votre panier est vide.');
    return;
  }

  const user = getCurrentUser();
  const orders = getOrders();

  const order = {
    id: 'CMD-' + Date.now(),
    customerId: user?.id || '',
    customerEmail: user?.email || '',
    customerName: n,
    phone: ph,
    address: a,
    payment: pay,
    items: cart,
    total: cart.reduce(
      (sum, i) =>
        sum + Number(i.price) * Number(i.qty),
      0
    ),
    status: 'Nouvelle',
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  saveOrders(orders);
  saveCart([]);
  updateCartCount();
  closeCheckout();

  alert('✅ Commande enregistrée !');
}

/* =========================
   COMMANDES VENDEUR
========================= */

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch (e) {
    return iso || '';
  }
}

function statusOptions(current) {
  return [
    'Nouvelle',
    'En préparation',
    'Expédiée',
    'Livrée',
    'Annulée'
  ].map(s =>
    `<option value="${s}" ${s === current ? 'selected' : ''}>
      ${s}
    </option>`
  ).join('');
}

function renderSellerOrders() {
  const sellerBox = document.getElementById('sellerOrders');
  const user = getCurrentUser();

  if (!sellerBox || !user) return;

  const orders = getOrders().filter(o =>
    o.items?.some(i =>
      i.sellerId === user.id ||
      i.sellerEmail === user.email
    )
  );

  if (!orders.length) {
    sellerBox.innerHTML =
      '<p>Aucune commande pour le moment.</p>';
    return;
  }

  sellerBox.innerHTML =
    orders.slice().reverse().map(o => {

      const items = o.items.filter(i =>
        i.sellerId === user.id ||
        i.sellerEmail === user.email
      );

      const total = items.reduce(
        (sum, i) =>
          sum + Number(i.price) * Number(i.qty),
        0
      );

      return `
        <div class="order-card">

          <div>
            <strong>${escapeHtml(o.id)}</strong>
            · ${formatDate(o.createdAt)}
          </div>

          <p>
            <strong>Client :</strong>
            ${escapeHtml(o.customerName)}
            · ${escapeHtml(o.phone)}
          </p>

          <p>
            <strong>Adresse :</strong>
            ${escapeHtml(o.address)}
          </p>

          <p>
            <strong>Paiement :</strong>
            ${escapeHtml(
              o.payment === 'livraison'
                ? 'Paiement à la livraison'
                : o.payment === 'wave'
                  ? 'Wave'
                  : 'Orange Money'
            )}
          </p>

          <p>
            <strong>Produits :</strong>
            ${items.map(i =>
              `${escapeHtml(i.name)} × ${i.qty}`
            ).join(', ')}
          </p>

          <p>
            <strong>Total :</strong>
            ${total.toLocaleString('fr-FR')} FCFA
          </p>

          <label>
            <strong>Statut :</strong>

            <select
              onchange="updateOrderStatus('${o.id}', this.value)">
              ${statusOptions(o.status)}
            </select>
          </label>

        </div>
      `;
    }).join('');
}

function updateOrderStatus(id, status) {
  const orders = getOrders();
  const order = orders.find(o => o.id === id);

  if (!order) return;

  order.status = status;

  saveOrders(orders);
  renderSellerOrders();

  alert('✅ Statut de la commande mis à jour.');
}

/* =========================
   DÉMARRAGE
========================= */

document.addEventListener('DOMContentLoaded', async () => {
  renderProducts();
  updateCartCount();

  const { data } = await supabaseClient.auth.getSession();

  if (data.session?.user) {
    await syncCurrentUser(data.session.user);
  } else {
    saveCurrentUser(null);
  }

  await updateAccountButton();
});

supabaseClient.auth.onAuthStateChange(
  async (event, session) => {
    if (session?.user) {
      await syncCurrentUser(session.user);
    } else {
      saveCurrentUser(null);
    }

    await updateAccountButton();
  }
);
