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
  $("clientOrdersBtn").addEventListener("click",openClientOrders);
  $("sellerBtn").addEventListener("click",openSeller);
  $("productForm").addEventListener("submit",publishProduct);
  $("orderBtn").addEventListener("click",placeOrder);
  $("orderForm").addEventListener("submit",submitOrder);
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
    <article class="product" data-detail="${esc(p.id)}">
      <div class="product-media">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentElement.innerHTML='📦'">`:"📦"}</div>
      <div class="product-body">
        <div class="meta">${esc(p.category||"Autres")}</div>
        <h3>${esc(p.name)}</h3>
        <div class="price">${money(p.price)}</div>
        <div class="meta">Stock : ${p.stock}</div>
        <button class="detail-card-btn" data-view="${esc(p.id)}">Voir détail</button>
        <button class="btn primary" data-add="${esc(p.id)}" ${p.stock<=0?"disabled":""}>Ajouter</button>
      </div>
    </article>`).join("");

  document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",(e)=>{
    e.stopPropagation();
    addToCart(b.dataset.add);
  }));

  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",(e)=>{
    e.stopPropagation();
    openProductDetail(b.dataset.view);
  }));

  document.querySelectorAll("[data-detail]").forEach(card=>card.addEventListener("click",(e)=>{
    if(e.target.closest("button")) return;
    openProductDetail(card.dataset.detail);
  }));
}

function applyFilters(){
  const q=$("searchInput").value.trim().toLowerCase();
  renderProducts(!q?state.products:state.products.filter(p=>[p.name,p.category,p.description,p.seller_name].some(v=>String(v||"").toLowerCase().includes(q))));
}


async function openClientOrders(){
  if(!state.user){openAuth("login");return}
  closeModal("accountModal");
  openModal("clientOrdersModal");
  $("clientOrders").innerHTML="<p class='muted'>Chargement des commandes…</p>";

  const {data,error}=await db
    .from("orders")
    .select("*")
    .eq("customer_id",state.user.id)
    .order("created_at",{ascending:false})
    .limit(50);

  if(error){
    $("clientOrders").innerHTML=`<p class="message error">${esc(error.message)}</p>`;
    return;
  }

  if(!(data||[]).length){
    $("clientOrders").innerHTML="<p class='muted'>Aucune commande pour le moment.</p>";
    return;
  }

  $("clientOrders").innerHTML=(data||[]).map(o=>{
    const status=String(o.status||"nouvelle");
    const cls=status.replaceAll(" ","_").replace("confirmée","confirmee").replace("livrée","livree").replace("annulée","annulee");
    const total=Number(o.total_price||0)+Number(o.delivery_fee||0);
    return `
      <div class="client-order-card">
        <strong>${esc(o.product_name)}</strong>
        <div class="meta">Quantité : ${o.quantity} · Produit : ${money(o.total_price)}</div>
        <div class="meta">Livraison : ${money(o.delivery_fee || 0)} · Total : <strong>${money(total)}</strong></div>
        <div class="meta">Paiement : ${esc(o.payment_method)}</div>
        <div class="meta">Adresse : ${esc(o.customer_city)} — ${esc(o.customer_address)}</div>
        <div class="meta">Statut : <span class="status-pill ${esc(cls)}">${esc(status)}</span></div>
      </div>`;
  }).join("");
}

async function openSeller(){
  closeModal("accountModal");
  if(!state.user || currentRole()!=="vendeur"){alert("Compte vendeur requis.");return}
  message($("sellerMessage"),"");
  await renderSellerProducts();
  await renderSellerOrders();
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


function normalizePhoneForWhatsApp(phone){
  let n=String(phone||"").replace(/\D/g,"");
  if(!n) return "";
  if(n.startsWith("00")) n=n.slice(2);
  if(n.startsWith("221")) return n;
  if(n.length===9) return "221"+n;
  return n;
}

function whatsappOrderLink(o){
  const phone=normalizePhoneForWhatsApp(o.customer_phone);
  if(!phone) return "#";
  const total=Number(o.total_price||0)+Number(o.delivery_fee||0);
  const text=`Bonjour ${o.customer_name}, votre commande ${o.product_name} de ${money(o.total_price)} sur ZedBoutik est confirmée. Frais de livraison : ${money(o.delivery_fee||0)}. Total à payer : ${money(total)}. Livraison : ${o.customer_city} — ${o.customer_address}. Paiement : ${o.payment_method}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

async function renderSellerOrders(){
  if(!$("sellerOrders") || !state.user) return;
  const {data,error}=await db.from("orders").select("*").eq("seller_id",state.user.id).order("created_at",{ascending:false}).limit(50);
  if(error){
    $("sellerOrders").innerHTML=`<p class="message error">${esc(error.message)}</p>`;
    return;
  }
  if(!(data||[]).length){
    $("sellerOrders").innerHTML="<p class='muted'>Aucune commande reçue pour le moment.</p>";
    return;
  }
  $("sellerOrders").innerHTML=(data||[]).map(o=>{
    const status=String(o.status||"nouvelle");
    const cls=status.replaceAll(" ","_").replace("confirmée","confirmee").replace("livrée","livree").replace("annulée","annulee");
    return `
    <div class="seller-item order-item">
      <div>
        <strong>${esc(o.product_name)}</strong>
        <div class="meta">${o.quantity} × ${money(o.unit_price)} = ${money(o.total_price)}</div>
        <div class="meta">Livraison : ${money(o.delivery_fee || 0)} · Total à payer : <strong>${money(Number(o.total_price||0)+Number(o.delivery_fee||0))}</strong></div>
        <div class="meta">Client : ${esc(o.customer_name)} · ${esc(o.customer_phone)}</div>
        <div class="meta">Adresse : ${esc(o.customer_city)} — ${esc(o.customer_address)}</div>
        <div class="meta">Paiement : ${esc(o.payment_method)} · Statut : <span class="status-pill ${esc(cls)}">${esc(status)}</span></div>
        ${o.customer_message?`<div class="meta">Message : ${esc(o.customer_message)}</div>`:""}
        <div class="status-actions">
          ${statusButton(o.id,status,"confirmée","Confirmer")}
          ${statusButton(o.id,status,"en livraison","En livraison")}
          ${statusButton(o.id,status,"livrée","Livrée")}
          ${statusButton(o.id,status,"annulée","Annuler")}
        </div>
        <a class="whatsapp-btn" href="${esc(whatsappOrderLink(o))}" target="_blank" rel="noopener">💬 WhatsApp client</a>
      </div>
    </div>`;
  }).join("");
  document.querySelectorAll("[data-status-id]").forEach(b=>b.addEventListener("click",()=>updateOrderStatus(b.dataset.statusId,b.dataset.statusValue)));
}

function statusButton(id,current,value,label){
  return `<button class="${current===value?'active':''}" data-status-id="${esc(id)}" data-status-value="${esc(value)}">${esc(label)}</button>`;
}

async function updateOrderStatus(id,status){
  if(!state.user) return;
  const {error}=await db.from("orders").update({status}).eq("id",id).eq("seller_id",state.user.id);
  if(error){alert(error.message);return}
  await renderSellerOrders();
}


function openProductDetail(id){
  const p=state.products.find(x=>String(x.id)===String(id));
  if(!p) return;
  const img=p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : `<div class="detail-placeholder">📦</div>`;
  $("productDetailContent").innerHTML=`
    <div class="detail-layout">
      <div class="detail-image">${img}</div>
      <div class="detail-info">
        <div class="detail-category">${esc(p.category||"Produit")}</div>
        <h2>${esc(p.name)}</h2>
        <div class="detail-price">${money(p.price)}</div>
        <div class="detail-stock">Stock disponible : ${Number(p.stock||0)}</div>
        <div class="detail-seller">Vendeur : ${esc(p.seller_name||p.sellerName||"Vendeur ZedBoutik")}</div>
        <div class="detail-description">${esc(p.description||"Aucune description pour ce produit.")}</div>
        <div class="detail-actions">
          <button class="btn primary" id="detailAddBtn">Ajouter au panier</button>
          <button class="btn ghost" data-close="productDetailModal">Fermer</button>
        </div>
      </div>
    </div>`;
  $("detailAddBtn").addEventListener("click",()=>{addToCart(id); closeModal("productDetailModal");});
  $("productDetailContent").querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  openModal("productDetailModal");
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
  if(!state.cart.length){
    $("cartItems").innerHTML="<p class='muted'>Ton panier est vide.</p>";
  }else{
    $("cartItems").innerHTML=state.cart.map(x=>`
      <div class="cart-line">
        <div>
          <div class="cart-line-title">${esc(x.name)}</div>
          <div class="meta">${money(x.price)} l’unité</div>
          <div class="qty-actions">
            <button data-minus="${esc(x.id)}">−</button>
            <span class="qty-num">${x.qty}</span>
            <button data-plus="${esc(x.id)}">+</button>
            <button class="remove" data-remove="${esc(x.id)}">Retirer</button>
          </div>
        </div>
        <div class="cart-subtotal">${money(x.price*x.qty)}</div>
      </div>`).join("");
  }

  $("cartTotal").textContent=money(state.cart.reduce((s,x)=>s+x.price*x.qty,0));

  document.querySelectorAll("[data-minus]").forEach(b=>b.addEventListener("click",()=>changeCartQty(b.dataset.minus,-1)));
  document.querySelectorAll("[data-plus]").forEach(b=>b.addEventListener("click",()=>changeCartQty(b.dataset.plus,1)));
  document.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>removeCartItem(b.dataset.remove)));

  message($("cartMessage"),"");
  openModal("cartModal");
}

function changeCartQty(id,delta){
  const item=state.cart.find(x=>String(x.id)===String(id));
  if(!item) return;
  const product=state.products.find(p=>String(p.id)===String(id));
  const maxStock=Number(product?.stock||99);
  item.qty=Math.max(1,Math.min(maxStock,item.qty+delta));
  saveJSON("zedboutik_cart",state.cart);
  updateCart();
  openCart();
}

function removeCartItem(id){
  state.cart=state.cart.filter(x=>String(x.id)!==String(id));
  saveJSON("zedboutik_cart",state.cart);
  updateCart();
  openCart();
}

function placeOrder(){
  if(!state.cart.length)return message($("cartMessage"),"Ton panier est vide.","error");
  if(!state.user){closeModal("cartModal");openAuth("login");return}
  closeModal("cartModal");
  $("orderName").value=currentName()||"";
  $("orderPhone").value=state.profile?.phone||"";
  message($("orderFormMessage"),"");
  openModal("orderModal");
}

async function submitOrder(e){
  e.preventDefault();
  if(!state.user){openAuth("login");return}
  if(!state.cart.length)return message($("orderFormMessage"),"Ton panier est vide.","error");

  const customer={
    name:$("orderName").value.trim(),
    phone:$("orderPhone").value.trim(),
    city:$("orderCity").value.trim(),
    address:$("orderAddress").value.trim(),
    delivery_fee:Number($("deliveryFee").value || 0),
    payment_method:$("paymentMethod").value,
    message:$("orderMessage").value.trim()
  };
  if(!customer.name || !customer.phone || !customer.city || !customer.address){
    return message($("orderFormMessage"),"Remplis les informations de livraison.","error");
  }

  const rows=[];
  for(const item of state.cart){
    const p=state.products.find(x=>String(x.id)===String(item.id));
    if(!p) continue;
    rows.push({
      customer_id:state.user.id,
      customer_name:customer.name,
      customer_phone:customer.phone,
      customer_city:customer.city,
      customer_address:customer.address,
      delivery_fee:customer.delivery_fee,
      payment_method:customer.payment_method,
      customer_message:customer.message,
      seller_id:p.seller_id,
      seller_name:p.seller_name || "",
      product_id:p.id,
      product_name:p.name,
      quantity:item.qty,
      unit_price:item.price,
      total_price:item.price*item.qty,
      status:"nouvelle"
    });
  }

  if(!rows.length)return message($("orderFormMessage"),"Aucun produit valide dans le panier.","error");
  message($("orderFormMessage"),"Envoi de la commande…");
  const {error}=await db.from("orders").insert(rows);
  if(error)return message($("orderFormMessage"),error.message,"error");

  state.cart=[];
  saveJSON("zedboutik_cart",state.cart);
  updateCart();
  $("orderForm").reset();
  closeModal("orderModal");
  alert("Commande envoyée avec succès !");
}

init().catch(err=>{
  console.error(err);
  $("products").innerHTML=`<div class="empty">Erreur de démarrage : ${esc(err.message||err)}</div>`;
});
})();
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("heroBuyBtn")?.addEventListener("click",()=>document.getElementById("productsTitle")?.scrollIntoView({behavior:"smooth"}));
  document.getElementById("heroSellBtn")?.addEventListener("click",()=>state.user?openAccount():openAuth("login"));
});
