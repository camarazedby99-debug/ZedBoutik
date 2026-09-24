const SUPABASE_URL = 'https://sypixtgbbznxfnhydall.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_K5_plneGF5G1lrOjAobM5g_jE4DOk4f';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const demoData=[
  {id:'demo1',name:'Parfum Premium',price:10000,category:'Parfums',description:'Parfum premium',stock:10,image:''},
  {id:'demo2',name:'Téléphone',price:75000,category:'Électronique',description:'Téléphone',stock:5,image:''},
  {id:'demo3',name:'Chaussures',price:15000,category:'Mode',description:'Chaussures',stock:8,image:''},
  {id:'demo4',name:'Table maison',price:30000,category:'Maison',description:'Table maison',stock:3,image:''}
];

const box=document.getElementById('products');

function getUsers(){
  try{return JSON.parse(localStorage.getItem('zedboutik_users')||'[]')}catch(e){return window.__users||[]}
}
function saveUsers(users){
  try{localStorage.setItem('zedboutik_users',JSON.stringify(users))}catch(e){window.__users=users}
}
function getCurrentUser(){
  try{return JSON.parse(localStorage.getItem('zedboutik_current_user')||'null')}catch(e){return window.__currentUser||null}
}
function saveCurrentUser(user){
  try{localStorage.setItem('zedboutik_current_user',JSON.stringify(user))}catch(e){window.__currentUser=user}
}
function getProducts(){
  try{return JSON.parse(localStorage.getItem('zedboutik_products')||'[]')}catch(e){return window.__products||[]}
}
function saveProducts(products){
  try{localStorage.setItem('zedboutik_products',JSON.stringify(products))}catch(e){window.__products=products}
}

function allProducts(){return [...getProducts(),...demoData]}

function renderProducts(list=allProducts()){
  if(!box)return;
  if(!list.length){box.innerHTML='<p>Aucun produit trouvé.</p>';return}
  box.innerHTML=list.map(p=>`
    <article class="product" onclick="openProduct('${p.id}')">
      ${p.image?`<img src="${p.image}" alt="${escapeHtml(p.name)}">`:''}
      <h3>${escapeHtml(p.name)}</h3>
      <div class="price">${Number(p.price).toLocaleString('fr-FR')} FCFA</div>
      <p>${escapeHtml(p.description||'')}</p>
      <div class="stock">Catégorie : ${escapeHtml(p.category)} · Stock : ${p.stock}</div>
    </article>`).join('');
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function filterCategory(cat){renderProducts(allProducts().filter(p=>p.category===cat))}
function searchProducts(){
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  renderProducts(q?allProducts().filter(p=>(p.name+' '+p.category+' '+p.description).toLowerCase().includes(q)):allProducts());
}

function openAuth(){
  document.getElementById('authModal')?.classList.remove('hidden');
  showLogin();
}
function closeAuth(){document.getElementById('authModal')?.classList.add('hidden')}
function showLogin(){document.getElementById('loginForm')?.classList.remove('hidden');document.getElementById('registerForm')?.classList.add('hidden')}
function showRegister(){document.getElementById('loginForm')?.classList.add('hidden');document.getElementById('registerForm')?.classList.remove('hidden')}

async function updateAccountButton(){
  const btn = document.getElementById('loginBtn');
  
const { data: { user: authUser } } = await supabaseClient.auth.getUser();
  if (!btn) return;

 if (authUser) { 
   
 const name = authUser.user_metadata?.full_name || authUser.email || 'Mon compte';
    btn.textContent = '👤 ' + name;
   btn.onclick = authUser.user_metadata?.role === 'vendeur' ? openSeller : openAuth;
  } else {
    btn.textContent = '👤 Connexion';
    btn.onclick = openAuth;
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
    email: email,
    password: motDePasse
  });

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  const { error: profileError } = await supabaseClient
    .from('profiles')
    .insert({
      id: data.user.id,
      full_name: nom,
      phone: telephone,
      email: email,
      role: role
    });

  if (profileError) {
    alert('Compte créé, mais erreur profil : ' + profileError.message);
    return;
  }

  alert('✅ Compte créé avec succès !');
  closeAuth();
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    alert('Veuillez entrer votre email et votre mot de passe.');
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert('Email ou mot de passe incorrect.');
    return;
  }

  updateAccountButton();
  alert('✅ Connexion réussie !');
  closeAuth();
}
function openSeller(){
  const user=getCurrentUser();
  if(!user||user.role!=='vendeur'){openAuth();return}
  document.getElementById('sellerWelcome').textContent=`Bienvenue ${user.name}. Publiez vos produits sur ZedBoutik.`;
  document.getElementById('sellerModal').classList.remove('hidden');
  renderSellerProducts();
  renderSellerOrders();
}
function closeSeller(){document.getElementById('sellerModal')?.classList.add('hidden')}

function previewImage(event){
  const file=event.target.files?.[0], img=document.getElementById('imagePreview');
  if(!file||!img)return;
  const reader=new FileReader();
  reader.onload=()=>{img.src=reader.result;img.classList.remove('hidden')};
  reader.readAsDataURL(file);
}

function addProduct(){
  const user=getCurrentUser();
  if(!user||user.role!=='vendeur'){alert('Connectez-vous avec un compte vendeur.');return}
  const name=document.getElementById('productName').value.trim();
  const price=Number(document.getElementById('productPrice').value);
  const category=document.getElementById('productCategory').value;
  const description=document.getElementById('productDescription').value.trim();
  const stock=Number(document.getElementById('productStock').value);
  const file=document.getElementById('productImage').files?.[0];

  if(!name||!price||!category||!description||stock<0){alert('Veuillez remplir tous les champs du produit.');return}

  const createProduct=(image='')=>{
    const products=getProducts();
    products.push({id:Date.now().toString(),sellerEmail:user.email,sellerName:user.name,name,price,category,description,stock,image});
    saveProducts(products);
    ['productName','productPrice','productDescription','productStock'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('productCategory').value='';
    document.getElementById('productImage').value='';
    document.getElementById('imagePreview').classList.add('hidden');
    renderSellerProducts();renderProducts();
    alert('✅ Produit publié avec succès !');
  };
  if(file){
    const reader=new FileReader();
    reader.onload=()=>createProduct(reader.result);
    reader.readAsDataURL(file);
  }else createProduct();
}

function renderSellerProducts(){
  const user=getCurrentUser(), box=document.getElementById('sellerProducts');
  if(!box||!user)return;
  const products=getProducts().filter(p=>p.sellerEmail===user.email);
  box.innerHTML=products.length?products.map(p=>`
    <div class="seller-item">
      <div><strong>${escapeHtml(p.name)}</strong><br>${Number(p.price).toLocaleString('fr-FR')} FCFA · Stock ${p.stock}</div>
      <button class="delete-btn" onclick="deleteProduct('${p.id}')">Supprimer</button>
    </div>`).join(''):'<p>Vous n’avez pas encore publié de produit.</p>';
}
function deleteProduct(id){
  if(!confirm('Supprimer ce produit ?'))return;
  saveProducts(getProducts().filter(p=>p.id!==id));
  renderSellerProducts();renderProducts();
}


function getCart(){try{return JSON.parse(localStorage.getItem('zedboutik_cart')||'[]')}catch(e){return window.__cart||[]}}
function saveCart(c){try{localStorage.setItem('zedboutik_cart',JSON.stringify(c))}catch(e){window.__cart=c}}
function updateCartCount(){const e=document.getElementById('cartCount');if(e)e.textContent=getCart().reduce((s,i)=>s+i.qty,0)}
function openProduct(id){
 const p=allProducts().find(x=>String(x.id)===String(id));if(!p)return;
 document.getElementById('productDetail').innerHTML=`${p.image?`<img src="${p.image}" class="detail-image" alt="${escapeHtml(p.name)}">`:''}<h2>${escapeHtml(p.name)}</h2><div class="price">${Number(p.price).toLocaleString('fr-FR')} FCFA</div><p>${escapeHtml(p.description||'')}</p><p><strong>Catégorie :</strong> ${escapeHtml(p.category)}</p><p><strong>Stock :</strong> ${p.stock}</p><button class="primary" onclick="addToCart('${p.id}')">🛒 Ajouter au panier</button>`;
 document.getElementById('productModal').classList.remove('hidden')
}
function closeProduct(){document.getElementById('productModal')?.classList.add('hidden')}
function addToCart(id){
 const p=allProducts().find(x=>String(x.id)===String(id));
 if(!p)return;
 const c=getCart(),e=c.find(x=>String(x.id)===String(id));
 if(e){
   if(e.qty >= Number(p.stock||0)){ alert('Stock disponible insuffisant.'); return; }
   e.qty++;
 }else{
   if(Number(p.stock||0) <= 0){ alert('Produit en rupture de stock.'); return; }
   c.push({id:p.id,name:p.name,price:p.price,image:p.image||'',qty:1,sellerEmail:p.sellerEmail||'',sellerName:p.sellerName||''});
 }
 saveCart(c);updateCartCount();closeProduct();alert('✅ Produit ajouté au panier !')
}
function openCart(){
 const c=getCart(),b=document.getElementById('cartItems');if(!b)return;
 b.innerHTML=c.length?c.map(i=>`<div class="cart-item"><div>${i.image?`<img src="${i.image}" alt="">`:''}<strong>${escapeHtml(i.name)}</strong></div><div>${i.qty} × ${Number(i.price).toLocaleString('fr-FR')} FCFA <button class="delete-btn" onclick="removeFromCart('${i.id}')">Supprimer</button></div></div>`).join(''):'<p>Votre panier est vide.</p>';
 document.getElementById('cartTotal').textContent=`Total : ${c.reduce((s,i)=>s+i.price*i.qty,0).toLocaleString('fr-FR')} FCFA`;
 document.getElementById('cartModal').classList.remove('hidden')
}
function closeCart(){document.getElementById('cartModal')?.classList.add('hidden')}
function removeFromCart(id){saveCart(getCart().filter(i=>String(i.id)!==String(id)));updateCartCount();openCart()}
function openCheckout(){
 if(!getCart().length){alert('Votre panier est vide.');return} const u=getCurrentUser();
 if(u){document.getElementById('deliveryName').value=u.name||'';document.getElementById('deliveryPhone').value=u.phone||''}
 closeCart();document.getElementById('checkoutModal').classList.remove('hidden')
}
function closeCheckout(){document.getElementById('checkoutModal')?.classList.add('hidden')}
function getOrders(){
 try{return JSON.parse(localStorage.getItem('zedboutik_orders')||'[]')}catch(e){return window.__orders||[]}
}
function saveOrders(orders){
 try{localStorage.setItem('zedboutik_orders',JSON.stringify(orders))}catch(e){window.__orders=orders}
}

function placeOrder(){
 const n=document.getElementById('deliveryName').value.trim(),ph=document.getElementById('deliveryPhone').value.trim(),a=document.getElementById('deliveryAddress').value.trim(),pay=document.getElementById('paymentMethod').value;
 if(!n||!ph||!a||!pay){alert('Veuillez remplir tous les champs de livraison et de paiement.');return}
 const cart=getCart();
 if(!cart.length){alert('Votre panier est vide.');return}
 const user=getCurrentUser();
 const orders=getOrders();
 const order={
   id:'CMD-'+Date.now(),
   customerEmail:user?.email||'',
   customerName:n,
   phone:ph,
   address:a,
   payment:pay,
   items:cart,
   total:cart.reduce((sum,i)=>sum+(Number(i.price)*Number(i.qty)),0),
   status:'Nouvelle',
   createdAt:new Date().toISOString()
 };
 orders.push(order);
 saveOrders(orders);
 saveCart([]);
 updateCartCount();
 closeCheckout();
 alert('✅ Commande enregistrée !');
}

function formatDate(iso){
 try{return new Date(iso).toLocaleString('fr-FR')}catch(e){return iso||''}
}
function statusOptions(current){
 return ['Nouvelle','En préparation','Expédiée','Livrée','Annulée'].map(s=>`<option value="${s}" ${s===current?'selected':''}>${s}</option>`).join('');
}
function renderSellerOrders(){
 const box=document.getElementById('sellerOrders'),user=getCurrentUser();
 if(!box||!user)return;
 const orders=getOrders().filter(o=>o.items?.some(i=>i.sellerEmail===user.email));
 if(!orders.length){box.innerHTML='<p>Aucune commande pour le moment.</p>';return}
 box.innerHTML=orders.slice().reverse().map(o=>{
   const items=o.items.filter(i=>i.sellerEmail===user.email);
   const total=items.reduce((sum,i)=>sum+Number(i.price)*Number(i.qty),0);
   return `<div class="order-card">
     <div><strong>${escapeHtml(o.id)}</strong> · ${formatDate(o.createdAt)}</div>
     <p><strong>Client :</strong> ${escapeHtml(o.customerName)} · ${escapeHtml(o.phone)}</p>
     <p><strong>Adresse :</strong> ${escapeHtml(o.address)}</p>
     <p><strong>Paiement :</strong> ${escapeHtml(o.payment==='livraison'?'Paiement à la livraison':o.payment==='wave'?'Wave':'Orange Money')}</p>
     <p><strong>Produits :</strong> ${items.map(i=>`${escapeHtml(i.name)} × ${i.qty}`).join(', ')}</p>
     <p><strong>Total :</strong> ${total.toLocaleString('fr-FR')} FCFA</p>
     <label><strong>Statut :</strong> <select onchange="updateOrderStatus('${o.id}',this.value)">${statusOptions(o.status)}</select></label>
   </div>`;
 }).join('');
}
function updateOrderStatus(id,status){
 const orders=getOrders();
 const order=orders.find(o=>o.id===id);
 if(!order)return;
 order.status=status;
 saveOrders(orders);
 renderSellerOrders();
 alert('✅ Statut de la commande mis à jour.');
}


document.addEventListener('DOMContentLoaded',()=>{
  renderProducts();
  updateAccountButton();
  updateCartCount();
  renderSellerOrders();
});
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session?.user) {
    const user = data.session.user;
    saveCurrentUser({
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'client',
      full_name: user.user_metadata?.full_name || user.email
    });
    updateAccountButton();
  }
});
