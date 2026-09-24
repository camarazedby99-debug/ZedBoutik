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
    <article class="product">
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

function updateAccountButton(){
  const btn=document.getElementById('loginBtn'), user=getCurrentUser();
  if(!btn)return;
  btn.textContent=user?(user.role==='vendeur'?'🏪 '+user.name:'👤 '+user.name):'👤 Connexion';
  btn.onclick=user?(user.role==='vendeur'?openSeller:openAuth):openAuth;
}

function register(){
  const name=document.getElementById('regName')?.value.trim();
  const phone=document.getElementById('regPhone')?.value.trim();
  const email=document.getElementById('regEmail')?.value.trim().toLowerCase();
  const password=document.getElementById('regPassword')?.value;
  const role=document.querySelector('input[name="role"]:checked')?.value||'client';
  if(!name||!phone||!email||!password){alert('Veuillez remplir tous les champs.');return}
  if(password.length<6){alert('Le mot de passe doit contenir au moins 6 caractères.');return}
  const users=getUsers();
  if(users.some(u=>u.email===email)){alert('Cet email est déjà utilisé.');return}
  const user={name,phone,email,password,role};
  users.push(user);saveUsers(users);saveCurrentUser(user);
  alert(role==='vendeur'?'✅ Compte vendeur créé avec succès !':'✅ Compte client créé avec succès !');
  closeAuth();updateAccountButton();
  if(role==='vendeur')openSeller();
}

function login(){
  const email=document.getElementById('loginEmail')?.value.trim().toLowerCase();
  const password=document.getElementById('loginPassword')?.value||'';
  const user=getUsers().find(u=>u.email===email&&u.password===password);
  if(!user){alert('Email ou mot de passe incorrect.');return}
  saveCurrentUser(user);alert(`Bienvenue ${user.name} !`);closeAuth();updateAccountButton();
  if(user.role==='vendeur')openSeller();
}

function openSeller(){
  const user=getCurrentUser();
  if(!user||user.role!=='vendeur'){openAuth();return}
  document.getElementById('sellerWelcome').textContent=`Bienvenue ${user.name}. Publiez vos produits sur ZedBoutik.`;
  document.getElementById('sellerModal').classList.remove('hidden');
  renderSellerProducts();
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

document.addEventListener('DOMContentLoaded',()=>{
  renderProducts();
  updateAccountButton();
});
