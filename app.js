const data = [
  ['Parfum Premium','10 000 FCFA','Parfums'],
  ['Téléphone','75 000 FCFA','Électronique'],
  ['Chaussures','15 000 FCFA','Mode'],
  ['Table maison','30 000 FCFA','Maison']
];

const box = document.getElementById('products');

function renderProducts(list = data) {
  if (!box) return;
  box.innerHTML = list.map(p => `
    <div class="product">
      <h3>${p[0]}</h3>
      <p>${p[1]}</p>
      <small>${p[2]}</small>
    </div>
  `).join('');
}

function filterCategory(cat) {
  renderProducts(data.filter(p => p[2] === cat));
}

function searchProducts() {
  const input = document.getElementById('searchInput');
  const q = (input?.value || '').toLowerCase().trim();
  renderProducts(q ? data.filter(p => p.join(' ').toLowerCase().includes(q)) : data);
}

function openAuth() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('hidden');
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

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem('zedboutik_users') || '[]');
  } catch (e) {
    window.__zedboutik_users = window.__zedboutik_users || [];
    return window.__zedboutik_users;
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem('zedboutik_users', JSON.stringify(users));
  } catch (e) {
    window.__zedboutik_users = users;
  }
}

function register() {
  try {
    const name = document.getElementById('regName')?.value.trim();
    const phone = document.getElementById('regPhone')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('regPassword')?.value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : 'client';

    if (!name || !phone || !email || !password) {
      alert('Veuillez remplir tous les champs.');
      return false;
    }

    if (password.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères.');
      return false;
    }

    const users = getUsers();

    if (users.some(u => u.email === email)) {
      alert('Cet email est déjà utilisé.');
      return false;
    }

    const user = { name, phone, email, password, role };
    users.push(user);
    saveUsers(users);

    try {
      localStorage.setItem('zedboutik_current_user', JSON.stringify(user));
    } catch (e) {
      window.__zedboutik_current_user = user;
    }

    const button = document.getElementById('loginBtn');
    if (button) {
      button.textContent = role === 'vendeur' ? '🏪 ' + name : '👤 ' + name;
    }

    alert(role === 'vendeur'
      ? '✅ Compte vendeur créé avec succès !'
      : '✅ Compte client créé avec succès !');

    closeAuth();
    return true;
  } catch (error) {
    console.error('Erreur inscription ZedBoutik:', error);
    alert('Une erreur est survenue pendant l’inscription. Réessaie.');
    return false;
  }
}

function login() {
  try {
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value || '';
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      alert('Email ou mot de passe incorrect.');
      return false;
    }

    try {
      localStorage.setItem('zedboutik_current_user', JSON.stringify(user));
    } catch (e) {
      window.__zedboutik_current_user = user;
    }

    const button = document.getElementById('loginBtn');
    if (button) {
      button.textContent = user.role === 'vendeur' ? '🏪 ' + user.name : '👤 ' + user.name;
    }

    alert(`Bienvenue ${user.name} !`);
    closeAuth();
    return true;
  } catch (error) {
    console.error('Erreur connexion ZedBoutik:', error);
    alert('Une erreur est survenue pendant la connexion.');
    return false;
  }
}

// Connexion / fermeture
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) loginBtn.addEventListener('click', openAuth);

document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
});

renderProducts();
