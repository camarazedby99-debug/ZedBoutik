const products=[
{name:"Parfum Premium",price:"10 000 FCFA",category:"Parfums"},
{name:"Téléphone",price:"85 000 FCFA",category:"Téléphones"},
{name:"Chaussures",price:"15 000 FCFA",category:"Chaussures"},
{name:"Robe élégante",price:"20 000 FCFA",category:"Mode"}
];
const box=document.getElementById("products");
function render(list=products){box.innerHTML=list.map(p=>`<article class="product"><div style="font-size:40px">🛍️</div><h3>${p.name}</h3><p>${p.category}</p><div class="price">${p.price}</div></article>`).join("")}
function filterCategory(cat){render(products.filter(p=>p.category===cat))}
function searchProducts(){const q=document.getElementById("searchInput").value.toLowerCase();render(products.filter(p=>(p.name+" "+p.category).toLowerCase().includes(q)))}
const modal=document.getElementById("authModal");
function openAuth(){modal.classList.remove("hidden");showLogin()}
function closeAuth(){modal.classList.add("hidden")}
function showLogin(){document.getElementById("loginForm").classList.remove("hidden");document.getElementById("registerForm").classList.add("hidden")}
function showRegister(){document.getElementById("loginForm").classList.add("hidden");document.getElementById("registerForm").classList.remove("hidden")}
function register(){
 const name=document.getElementById("regName").value.trim(),email=document.getElementById("regEmail").value.trim(),password=document.getElementById("regPassword").value;
 if(!name||!email||!password){alert("Remplis tous les champs.");return}
 localStorage.setItem("zed_user",JSON.stringify({name,email,password}));alert("Compte créé !");showLogin()
}
function login(){
 const email=document.getElementById("loginEmail").value.trim(),password=document.getElementById("loginPassword").value;
 const u=JSON.parse(localStorage.getItem("zed_user")||"null");
 if(!u||u.email!==email||u.password!==password){alert("Email ou mot de passe incorrect.");return}
 alert("Bienvenue "+u.name+" !");closeAuth();updateLogin()
}
function updateLogin(){
 const u=JSON.parse(localStorage.getItem("zed_user")||"null");
 const b=document.getElementById("loginBtn");
 if(u){b.textContent="👤 "+u.name;b.onclick=()=>alert("Connecté en tant que "+u.name)}
 else b.onclick=openAuth
}
document.getElementById("loginBtn").onclick=openAuth;
render();updateLogin();
