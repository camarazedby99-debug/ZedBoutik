const products = [
  {name:'Parfum Premium',price:'10 000 FCFA',category:'Parfums'},
  {name:'Téléphone',price:'85 000 FCFA',category:'Téléphones'},
  {name:'Chaussures',price:'15 000 FCFA',category:'Chaussures'},
  {name:'Robe élégante',price:'20 000 FCFA',category:'Mode'}
];

const box = document.getElementById('products');
function render(list=products){
  box.innerHTML = list.map(p => `<article class="product"><div style="font-size:40px">🛍️</div><h3>${p.name}</h3><p>${p.category}</p><div class="price">${p.price}</div></article>`).join('');
}
function filterCategory(cat){ render(products.filter(p => p.category === cat)); }
function searchProducts(){
  const q = document.getElementById('searchInput').value.toLowerCase();
  render(products.filter(p => (p.name+' '+p.category).toLowerCase().includes(q)));
}

const modal = document.getElementById('authModal');
function openAuth(){ modal.classList.remove('hidden'); showLogin(); }
function closeAuth(){ modal.classList.add('hidden'); }
function showLogin(){
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
}
function showRegister(){
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
}

function getUsers(){ return JSON.parse(localStorage.getItem('zed_users') || '[]'); }
function saveUsers(users){ localStorage.setItem('zed_users', JSON.stringify(users)); }

function register(){
  const name = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

  if(!name || !phone || !email || !password || !role){
    alert('Remplis tous les champs.'); return;
  }
  if(password.length < 6){ alert('Le mot de passe doit contenir au moins 6 caractères.'); return; }

  const users = getUsers();
  if(users.some(u => u.email === email)){ alert('Un compte existe déjà avec cet email.'); return; }

  users.push({name, phone, email, password, role});
  saveUsers(users);
  alert('Compte créé avec succès ! Tu peux maintenant te connecter.');
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = '';
  showLogin();
}

function login(){
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const user = getUsers().find(u => u.email === email && u.password === password);
  if(!user){ alert('Email ou mot de passe incorrect.'); return; }
  localStorage.setItem('zed_current_user', JSON.stringify(user));
  closeAuth();
  updateLogin();
  alert(`Bienvenue ${user.name} !\nCompte : ${user.role === 'vendeur' ? 'Vendeur' : 'Client'}`);
}

function logout(){
  localStorage.removeItem('zed_current_user');
  updateLogin();
  alert('Tu es déconnecté.');
}

function updateLogin(){
  const user = JSON.parse(localStorage.getItem('zed_current_user') || 'null');
  const b = document.getElementById('loginBtn');
  if(user){
    b.textContent = '👤 ' + user.name;
    b.onclick = () => {
      const action = confirm(`Compte ${user.role === 'vendeur' ? 'Vendeur' : 'Client'}\n\nOK = voir le profil\nAnnuler = se déconnecter`);
      if(!action) logout();
    };
  } else {
    b.textContent = '👤 Connexion';
    b.onclick = openAuth;
  }
}

document.getElementById('loginBtn').onclick = openAuth;
render();
updateLogin();
