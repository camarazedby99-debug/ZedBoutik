(() => {
"use strict";

const SUPABASE_URL = "https://sypixtgbbznxfnhydall.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K5_plneGF5G1lrOjAobM5g_jE4DOk4f";

if (!window.supabase) {
  document.body.insertAdjacentHTML("afterbegin","<div style='padding:12px;background:#fee2e2;color:#991b1b'>Impossible de charger Supabase. Vérifie la connexion Internet.</div>");
  return;
}
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
const state = { products: [], user: null, profile: null, authMode: "login", cart: readJSON("zedboutik_cart", []) };

function readJSON(k, fallback){ try{return JSON.parse(localStorage.getItem(k)) ?? fallback}catch{return fallback} }
function saveJSON(k,v){ localStorage.setItem(k,JSON.stringify(v)) }
function money(v){ return new Intl.NumberFormat("fr-FR").format(Number(v)||0)+" FCFA" }
function esc(v){ return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])) }
function openModal(id){ $(id).classList.remove("hidden") }
function closeModal(id){ $(id).classList.add("hidden") }
function message(el,text,type=""){ el.textContent=text; el.className="message "+type }

window.showHome = () => { window.scrollTo({top:0,behavior:"smooth"}); };

document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));

async function init(){
  bindUI();
  updateCart();
  const { data } = await db.auth.getSession();
  state.user = data?.session?.user || null;
  await loadProfile();
  updateAccountUI();
  await loadProducts();

  db.auth.onAuthStateChange(async (_event, session)=>{
    state.user=session?.user||null;
    await loadProfile();
    updateAccountUI();
  });
}

function bindUI(){
  $("accountBtn").addEventListener("click",()=> state.user ? openAccount() : openAuth("login"));
  $("cartBtn").addEventListener("click",openCart);
  $("loginTab").addEventListener("click",()=>openAuth("login"));
  $("signupTab").addEventListener("click",()=>openAuth("signup"));
  $("authForm").addEventListener("submit",handleAuth);
  $("logoutBtn").addEventListener("click",logout);
  $("sellerBtn").addEventListener("click",openSeller);
  $("productForm").addEventListener("submit",publishProduct);
  $("orderBtn").addEventListener("click",placeOrder);
  $("searchBtn").addEventListener("click",applyFilters);
  $("searchInput").addEventListener("input",applyFilters);
  document.querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>{
    $("searchInput").value=b.dataset.category||"";
    applyFilters();
    $("products").scrollIntoView({behavior:"smooth"});
  }));
}

function openAuth(mode="login"){
  state.authMode=mode;
  const signup=mode==="signup";
  $("signupFields").classList.toggle("hidden",!signup);
  $("loginTab").classList.toggle("active",!signup);
  $("signupTab").classList.toggle("active",signup);
  $("authTitle").textContent=signup?"Créer un compte":"Connexion";
  $("authSubmit").textContent=signup?"Créer mon compte":"Se connecter";
  $("password").autocomplete=signup?"new-password":"current-password";
  message($("authMessage"),"");
  openModal("authModal");
}

async function handleAuth(e){
  e.preventDefault();
  const email=$("email").value.trim();
  const password=$("password").value;
  message($("authMessage"),"Traitement…");
  $("authSubmit").disabled=true;
  try{
    if(state.authMode==="login"){
      const {error}=await db.auth.signInWithPassword({email,password});
      if(error) throw error;
      closeModal("authModal");
    }else{
      const full_name=$("fullName").value.trim();
      const phone=$("phone").value.trim();
      const role=$("role").value;
      if(!full_name) throw new Error("Entre ton nom complet.");
      const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name,phone,role}}});
      if(error) throw error;
      if(data.user){
        const {error:profileError}=await db.from("profiles").upsert({
          id:data.user.id, full_name, phone, role, email
        },{onConflict:"id"});
        if(profileError) console.warn("Profil:",profileError.message);
      }
      message($("authMessage"),data.session?"Compte créé. Tu es connecté.":"Compte créé. Vérifie ton e-mail si Supabase le demande.","ok");
      if(data.session) setTimeout(()=>closeModal("authModal"),700);
    }
  }catch(err){ message($("authMessage"),friendlyError(err),"error") }
  finally{$("authSubmit").disabled=false}
}

function friendlyError(err){
  const s=String(err?.message||err||"Erreur");
  if(s.includes("Invalid login credentials")) return "Email ou mot de passe incorrect.";
  if(s.includes("already registered")) return "Cet email possède déjà un compte.";
  return s;
}

async function loadProfile(){
  state.profile=null;
  if(!state.user) return;
  const {data,error}=await db.from("profiles").select("*").eq("id",state.user.id).maybeSingle();
  if(!error && data) state.profile=data;
  if(!state.profile){
    const m=state.user.user_metadata||{};
    state.profile={id:state.user.id,email:state.user.email,full_name:m.full_name||state.user.email,phone:m.phone||"",role:m.role||"client"};
  }
}

function currentRole(){ return state.profile?.role || state.user?.user_metadata?.role || "client" }
function currentName(){ return state.profile?.full_name || state.user?.user_metadata?.full_name || state.user?.email || "Utilisateur" }

function updateAccountUI(){
  $("accountBtn").textContent=state.user ? "👤 "+currentName().split(" ")[0] : "👤 Connexion";
}
function openAccount(){
  $("accountInfo").innerHTML=`<p><strong>${esc(currentName())}</strong></p><p>${esc(state.user.email||"")}</p><p class="meta">Compte : ${esc(currentRole())}</p>`;
  $("sellerBtn").classList.toggle("hidden",currentRole()!=="vendeur");
  openModal("accountModal");
}
async function logout(){
  await db.auth.signOut(); state.user=null;state.profile=null;updateAccountUI();closeModal("accountModal");
}

async function loadProducts(){
  $("productStatus").textContent="Chargement…";
  const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
  if(error){
    state.products=[];
    $("productStatus").textContent="";
    $("products").innerHTML=`<div class="empty"><strong>Les produits ne peuvent pas être chargés.</strong><br><small>${esc(error.message)}</small></div>`;
    return;
  }
  state.products=(data||[]).map(p=>({...p,price:Number(p.price||0),stock:Number(p.stock||0)}));
  $("productStatus").textContent=state.products.length+" produit(s)";
  renderProducts(state.products);
}

function renderProducts(list){
  if(!list.length){$("products").innerHTML='<div class="empty">Aucun produit pour le moment.</div>';return}
  $("products").innerHTML=list.map(p=>`
    <article class="product">
      <div class="product-media">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentElement.innerHTML='📦'">`:"📦"}</div>
      <div class="product-body">
        <div class="meta">${esc(p.category||"Autres")}</div>
        <h3>${esc(p.name)}</h3>
        <div class="price">${money(p.price)}</div>
        <div class="meta">Stock : ${p.stock}</div>
        <button class="btn primary" data-add="${esc(p.id)}" ${p.stock<=0?"disabled":""}>Ajouter</button>
      </div>
    </article>`).join("");
  document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>addToCart(b.dataset.add)));
}
function applyFilters(){
  const q=$("searchInput").value.trim().toLowerCase();
  renderProducts(!q?state.products:state.products.filter(p=>[p.name,p.category,p.description,p.seller_name].some(v=>String(v||"").toLowerCase().includes(q))));
}

async function openSeller(){
  closeModal("accountModal");
  if(!state.user || currentRole()!=="vendeur"){alert("Compte vendeur requis.");return}
  message($("sellerMessage"),"");
  await renderSellerProducts();
  openModal("sellerModal");
}

async function publishProduct(e){
  e.preventDefault();
  if(!state.user || currentRole()!=="vendeur") return message($("sellerMessage"),"Compte vendeur requis.","error");
  let imageUrl=null;
  const file=$("pImageFile").files?.[0];
  if(file){
    if(file.size > 5*1024*1024) return message($("sellerMessage"),"La photo doit faire moins de 5 Mo.","error");
    message($("sellerMessage"),"Envoi de la photo…");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=`${state.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await db.storage.from("product-images").upload(path,file,{cacheControl:"3600",upsert:false});
    if(uploadError) return message($("sellerMessage"),"Photo : "+uploadError.message,"error");
    const {data:publicData}=db.storage.from("product-images").getPublicUrl(path);
    imageUrl=publicData.publicUrl;
  }
  const row={
    seller_id:state.user.id,
    seller_name:currentName(),
    name:$("pName").value.trim(),
    price:Number($("pPrice").value),
    category:$("pCategory").value,
    description:$("pDescription").value.trim(),
    stock:Number($("pStock").value),
    image:imageUrl
  };
  message($("sellerMessage"),"Publication…");
  const {error}=await db.from("products").insert(row);
  if(error) return message($("sellerMessage"),error.message,"error");
  $("productForm").reset();$("pStock").value=1;
  message($("sellerMessage"),"Produit publié avec succès.","ok");
  await loadProducts(); await renderSellerProducts();
}

async function renderSellerProducts(){
  if(!state.user) return;
  const {data,error}=await db.from("products").select("*").eq("seller_id",state.user.id).order("created_at",{ascending:false});
  if(error){$("sellerProducts").innerHTML=`<p class="message error">${esc(error.message)}</p>`;return}
  $("sellerProducts").innerHTML=(data||[]).length?(data||[]).map(p=>`
    <div class="seller-item"><div><strong>${esc(p.name)}</strong><div class="meta">${money(p.price)} · Stock ${p.stock}</div></div>
    <button data-delete="${esc(p.id)}">Supprimer</button></div>`).join(""):"<p class='muted'>Aucun produit publié.</p>";
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProduct(b.dataset.delete)));
}
async function deleteProduct(id){
  if(!confirm("Supprimer ce produit ?")) return;
  const {error}=await db.from("products").delete().eq("id",id).eq("seller_id",state.user.id);
  if(error){alert(error.message);return}
  await loadProducts();await renderSellerProducts();
}

function addToCart(id){
  const p=state.products.find(x=>String(x.id)===String(id));if(!p)return;
  const item=state.cart.find(x=>String(x.id)===String(id));
  if(item)item.qty=Math.min(item.qty+1,p.stock);else state.cart.push({id:p.id,name:p.name,price:p.price,qty:1});
  saveJSON("zedboutik_cart",state.cart);updateCart();
}
function updateCart(){
  $("cartCount").textContent=state.cart.reduce((n,x)=>n+x.qty,0);
}
function openCart(){
  $("cartItems").innerHTML=state.cart.length?state.cart.map(x=>`<div class="cart-item"><div><strong>${esc(x.name)}</strong><div class="meta">${x.qty} × ${money(x.price)}</div></div><button class="btn ghost" data-remove="${esc(x.id)}">Retirer</button></div>`).join(""):"<p class='muted'>Ton panier est vide.</p>";
  $("cartTotal").textContent=money(state.cart.reduce((s,x)=>s+x.price*x.qty,0));
  document.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{state.cart=state.cart.filter(x=>String(x.id)!==String(b.dataset.remove));saveJSON("zedboutik_cart",state.cart);updateCart();openCart()}));
  message($("cartMessage"),"");openModal("cartModal");
}
function placeOrder(){
  if(!state.cart.length)return message($("cartMessage"),"Ton panier est vide.","error");
  if(!state.user){closeModal("cartModal");openAuth("login");return}
  message($("cartMessage"),"Panier prêt. Le module de commande/paiement sera connecté après validation de cette base.","ok");
}

init().catch(err=>{
  console.error(err);
  $("products").innerHTML=`<div class="empty">Erreur de démarrage : ${esc(err.message||err)}</div>`;
});
})();