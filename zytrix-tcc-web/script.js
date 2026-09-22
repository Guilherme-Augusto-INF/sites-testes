import {
  auth, db, googleProvider,
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signOut, sendSignInLinkToEmail, isSignInWithEmailLink,
  EmailAuthProvider, reauthenticateWithCredential,
  collection, query, where, limit, getDocs, onSnapshot,
  doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, writeBatch
} from "./firebase.js";

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const BONUS_INICIAL=500;
const PACKAGE_KEY="zytrixSelectedCoinPackage";
const STREAM_KEY="zytrixSelectedStream";

const PACKAGES=[
  {id:"zy100",coins:100,priceCents:490,label:"Pacote Inicial",description:"Para mandar seus primeiros apoios."},
  {id:"zy500",coins:500,priceCents:1490,label:"Pacote Stream",description:"Uma boa quantidade para apoiar várias lives.",popular:true},
  {id:"zy1200",coins:1200,priceCents:2990,label:"Pacote Plus",description:"Mais Zy Coins para apoiar seus criadores favoritos."},
  {id:"zy2500",coins:2500,priceCents:4990,label:"Pacote Ultra",description:"Para quem quer apoiar muito mais."}
];

const CATEGORY_DATA={
  "Gaming":["Ação / Aventura","RPG","Esportes","Simulação"],
  "Música":["Rock","Sertanejo","Eletrônica","Funk"],
  "Just Chatting":["Bate-Papo","Perguntas e Respostas","Histórias","Desafios"],
  "Criatividade":["Desenho","Design","Fotografia","Edição"],
  "Esportes":["Futebol","Basquete","Automobilismo","Lutas"],
  "Tecnologia":["Programação","Hardware","Inteligência Artificial","Ciência e Tech"],
  "Podcasts":["Conversas","Entrevistas","Notícias","Entretenimento"],
  "IRL":["Viagens","Eventos","Vida Cotidiana","Exploração"]
};

const CATEGORY_ICONS={
  "Gaming":"🎮","Música":"🎵","Just Chatting":"🎙️","Criatividade":"🎨",
  "Esportes":"🌐","Tecnologia":"💻","Podcasts":"🎧","IRL":"📷"
};

let currentUser=null;
let pageCleanups=[];
let liveCache=[];
const profileCache=new Map();

function cleanupPage(){
  pageCleanups.forEach(fn=>{try{fn()}catch{}});
  pageCleanups=[];
}
function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function safeHttps(v){
  try{const u=new URL(String(v||""),location.origin);return u.protocol==="https:"?u.href:""}catch{return ""}
}
function slug(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function money(cents){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(cents||0)/100);
}
function coins(v){
  return Math.max(0,Math.floor(Number(v||0))).toLocaleString("pt-BR");
}
function pathOnly(v){
  const s=String(v||"");
  return s.startsWith("/")&&!s.startsWith("//")?s:"/";
}
function nextAfterAuth(){
  const q=new URLSearchParams(location.search).get("next");
  return pathOnly(q||"/");
}
function setMessage(el,text,type="error"){
  if(!el)return;
  el.innerHTML=text?'<div class="message '+type+'">'+esc(text)+'</div>':"";
}
function pageTitle(t){document.title=t?("Zytrix — "+t):"Zytrix"}
function avatarMarkup(profile,size="normal"){
  const url=safeHttps(profile?.photoURL);
  if(url)return '<img class="avatar '+size+'" src="'+esc(url)+'" alt="">';
  const initial=esc(String(profile?.username||"Z").charAt(0).toUpperCase());
  return '<span class="avatar '+size+'">'+initial+"</span>";
}
function categoryPath(name,sub){
  let p="/categoria/"+slug(name);
  if(sub)p+="/"+slug(sub);
  return p;
}
function categoryNameFromSlug(s){
  return Object.keys(CATEGORY_DATA).find(k=>slug(k)===s)||"";
}
function subNameFromSlug(main,s){
  return (CATEGORY_DATA[main]||[]).find(k=>slug(k)===s)||"";
}

function headerHtml(user){
  const actions=user
    ? '<span class="search-icon" aria-hidden="true">⌕</span><a class="cart-btn" href="/loja" aria-label="Loja">🛒</a><a class="top-btn primary" href="/perfil">Perfil</a>'
    : '<span class="search-icon" aria-hidden="true">⌕</span><a class="top-btn" href="/login">Entrar</a><a class="top-btn primary" href="/registro">Registrar</a>';
  return '<div class="site-header"><div class="container header-inner">'+
    '<a class="brand" href="/"><span class="brand-mark">Z</span><span>Zytrix</span></a>'+
    '<nav class="site-nav"><a href="/">Início</a><a href="/categorias">Categorias</a><a href="/ao-vivo">Ao Vivo</a><a href="/sobre">Sobre</a></nav>'+
    '<div class="header-actions">'+actions+"</div></div></div>";
}
function footerHtml(){
  return '<div class="site-footer"><div class="container footer-inner">'+
    '<div class="brand footer-brand"><span class="brand-mark" style="width:28px;height:28px;font-size:18px">Z</span><span>Zytrix</span></div>'+
    '<div class="footer-copy">© 2026 Zytrix. Todos os direitos reservados.</div>'+
    '<nav class="footer-links"><a href="/sobre">Sobre</a><a href="#">Termos</a><a href="#">Privacidade</a></nav>'+
    "</div></div>";
}
function renderChrome(){
  $("#site-header").innerHTML=headerHtml(currentUser);
  $("#site-footer").innerHTML=footerHtml();
  $$(".site-nav a").forEach(a=>{
    const p=a.getAttribute("href");
    if(p!=="/"&&location.pathname.startsWith(p))a.classList.add("active");
    if(p==="/"&&location.pathname==="/")a.classList.add("active");
  });
}

async function ensureUserDocs(user,username,provider){
  const uref=doc(db,"users",user.uid),pref=doc(db,"profiles",user.uid);
  const [us,ps]=await Promise.all([getDoc(uref),getDoc(pref)]);
  if(!us.exists())await setDoc(uref,{
    uid:user.uid,zytrixId:"ZY-"+user.uid.slice(0,10).toUpperCase(),
    email:user.email||"",provider:provider||"password",
    createdAt:serverTimestamp(),lastLoginAt:serverTimestamp()
  });
  else await updateDoc(uref,{lastLoginAt:serverTimestamp()}).catch(()=>{});
  if(!ps.exists())await setDoc(pref,{
    uid:user.uid,username:username||user.displayName||"Usuário",photoURL:user.photoURL||"",
    bio:"",createdAt:serverTimestamp(),usernameUpdatedAt:serverTimestamp()
  });
}
async function ensureWallet(user){
  const ref=doc(db,"wallets",user.uid);
  await runTransaction(db,async tx=>{
    const s=await tx.get(ref);
    if(!s.exists())tx.set(ref,{
      uid:user.uid,balance:BONUS_INICIAL,totalSent:0,totalReceived:0,lastTransactionId:"",
      createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
  });
}
async function getProfile(uid){
  if(!uid)return {username:"Streamer",photoURL:""};
  if(profileCache.has(uid))return profileCache.get(uid);
  let p={username:"Streamer",photoURL:""};
  try{
    const s=await getDoc(doc(db,"profiles",uid));
    if(s.exists()){const d=s.data();p={username:String(d.username||"Streamer"),photoURL:String(d.photoURL||"")}}
  }catch(e){console.warn("Perfil indisponível",e)}
  profileCache.set(uid,p);return p;
}
async function hydrateStreams(snapshot){
  const base=snapshot.docs.map(s=>{
    const d=s.data();
    return {
      id:s.id,streamerUid:String(d.streamerUid||"").trim(),
      title:String(d.title||"Transmissão ao vivo"),
      description:String(d.description||""),
      categoryId:String(d.categoryId||""),
      thumbnailURL:String(d.thumbnailURL||""),
      viewerCount:Math.max(0,Number(d.viewerCount||0)),
      status:String(d.status||"offline"),
      playbackURL:String(d.playbackURL||"")
    };
  }).sort((a,b)=>b.viewerCount-a.viewerCount||a.id.localeCompare(b.id));
  return Promise.all(base.map(async l=>Object.assign({},l,await getProfile(l.streamerUid))));
}
function watchLiveStreams(onData,onError){
  const q=query(collection(db,"streams"),where("status","==","live"));
  const unsub=onSnapshot(q,async snap=>{
    try{liveCache=await hydrateStreams(snap);onData(liveCache)}
    catch(e){console.error(e);onError&&onError(e)}
  },e=>{console.error(e);liveCache=[];onError&&onError(e)});
  pageCleanups.push(unsub);
  return unsub;
}
function selectStream(live){
  try{
    localStorage.setItem(STREAM_KEY,live.id);
    localStorage.setItem("zytrixSelectedStreamName",live.username||"Streamer");
    localStorage.setItem("zytrixSelectedStreamTitle",live.title||"Transmissão ao vivo");
  }catch{}
}
function bindStreamLinks(root=document){
  $$("[data-stream-id]",root).forEach(a=>{
    a.addEventListener("click",()=>{
      const id=a.dataset.streamId;
      const live=liveCache.find(x=>x.id===id);
      if(live)selectStream(live);
    });
  });
}
function streamCard(live,index){
  const img=safeHttps(live.thumbnailURL);
  const bg=img?' style="background-image:linear-gradient(rgba(2,8,14,.08),rgba(2,8,14,.15)),url(&quot;'+esc(img)+'&quot;);background-size:cover;background-position:center"':"";
  const photo=safeHttps(live.photoURL);
  const avatar=photo?'<img class="avatar" src="'+esc(photo)+'" alt="">':'<span class="avatar">'+esc((live.username||"S").charAt(0).toUpperCase())+"</span>";
  return '<article class="stream-card"><a data-stream-id="'+esc(live.id)+'" href="/live?stream='+encodeURIComponent(live.id)+'">'+
    '<div class="thumb '+(img?"":"placeholder")+'"'+bg+'><span class="live-badge">● AO VIVO</span>'+
    '<span class="platform-badge">'+(index<3?("★ #"+(index+1)+" DESTAQUE"):"LIVE")+'</span>'+
    '<span class="views">◉ '+coins(live.viewerCount)+'</span></div>'+
    '<div class="stream-meta">'+avatar+'<div class="stream-copy"><b>'+esc(live.username||"Streamer")+'</b>'+
    '<span>'+esc(live.title)+'</span><small>'+esc(live.categoryId||"AO VIVO")+"</small></div></div></a></article>";
}
function liveListHtml(lives,limit,cls){
  const list=typeof limit==="number"?lives.slice(0,limit):lives;
  if(!list.length)return '<div class="empty-lives"><div><strong>Não tem ninguém... :(</strong>Nenhuma transmissão está ao vivo agora.</div></div>';
  return '<div class="live-grid '+(cls||"")+'">'+list.map((l,i)=>streamCard(l,i)).join("")+"</div>";
}
function categoryCards(limit){
  const names=Object.keys(CATEGORY_DATA).slice(0,limit||99);
  return names.map(n=>'<a class="category-card" href="'+categoryPath(n)+'"><span class="category-icon">'+CATEGORY_ICONS[n]+'</span>'+
    '<div><b>'+esc(n.toUpperCase())+'</b><small>Explorar transmissões</small></div></a>').join("");
}

function requireAuthOrRedirect(){
  if(currentUser)return true;
  location.replace("/login?next="+encodeURIComponent(location.pathname+location.search));
  return false;
}

function renderHome(){
  pageTitle("");
  $("#app").innerHTML='<section class="hero home-hero"><div class="container">'+
    '<div class="kicker">• TRANSMISSÕES AO VIVO</div><h1 class="hero-title">O seu mundo. <span class="cyan">Ao vivo.</span></h1>'+
    '<div class="hero-sub">Assista às melhores lives, descubra novos criadores e faça parte da comunidade Zytrix.</div>'+
    '<div id="home-featured" class="featured-area"><div class="empty-lives">Carregando destaques...</div></div>'+
    '<div class="home-actions"><div class="stats"><div class="stat"><strong>00.00K</strong><span>Criadores</span></div>'+
    '<div class="stat"><strong id="home-viewers">00.00K+</strong><span>Espectadores</span></div>'+
    '<div class="stat"><strong id="home-live-count">0.0M</strong><span>Lives Realizadas</span></div></div>'+
    '<a class="btn primary" href="/ao-vivo">▶ Explorar Lives</a><a class="btn" href="/perfil">Começar a transmitir</a></div>'+
    "</div></section>"+
    '<section class="content-section alt"><div class="container"><div class="section-label">EXPLORE</div>'+
    '<div class="section-head"><h2>ENCONTRE SEU CONTEÚDO</h2><a href="/categorias">Ver tudo →</a></div>'+
    '<div class="category-grid">'+categoryCards(5)+"</div></div></section>"+
    '<section class="content-section"><div class="container"><div class="section-label">AGORA</div>'+
    '<div class="section-head"><h2>AO VIVO NA ZYTRIX</h2><a href="/ao-vivo">Ver todas →</a></div>'+
    '<div id="home-live-list"><div class="empty-lives">Carregando...</div></div></div></section>';
  watchLiveStreams(lives=>{
    $("#home-featured").innerHTML=liveListHtml(lives,3);
    $("#home-live-list").innerHTML=liveListHtml(lives,3);
    const viewers=lives.reduce((a,b)=>a+Number(b.viewerCount||0),0);
    $("#home-viewers").textContent=viewers.toLocaleString("pt-BR");
    $("#home-live-count").textContent=lives.length.toLocaleString("pt-BR");
    bindStreamLinks();
  },()=>{
    $("#home-featured").innerHTML=liveListHtml([],3);
    $("#home-live-list").innerHTML=liveListHtml([],3);
  });
}

function guestGate(title,background){
  return '<div class="lock-wrap"><div class="lock-blur">'+background+'</div><div class="lock-overlay"><div class="lock-modal">'+
    '<h2>Faça Login para acessar a aba '+esc(title)+'</h2><div class="lock-actions"><a href="/login?next='+encodeURIComponent(location.pathname)+'">Entrar</a>'+
    '<span>OU</span><a href="/registro?next='+encodeURIComponent(location.pathname)+'">Registrar</a></div></div></div></div>';
}
function fakeBrowseBackground(){
  return '<section class="hero"><div class="container"><div class="kicker">• TRANSMISSÕES AO VIVO</div><h1 class="hero-title">O seu mundo. <span class="cyan">Ao vivo.</span></h1>'+
    '<div class="hero-sub">Assista às melhores lives, descubra novos criadores e faça parte da comunidade Zytrix.</div><div class="featured-area">'+liveListHtml([],3)+'</div></div></section>'+
    '<section class="content-section alt"><div class="container"><div class="section-head"><h2>AO VIVO NA ZYTRIX</h2></div>'+liveListHtml([],3)+"</div></section>";
}
function renderAoVivo(){
  pageTitle("Ao Vivo");
  if(!currentUser){$("#app").innerHTML=guestGate("Ao Vivo",fakeBrowseBackground());return}
  $("#app").innerHTML='<section class="browse-page"><div class="container"><div class="kicker">• TRANSMISSÕES EM DESTAQUE</div>'+
    '<h1 class="hero-title" style="font-size:58px">O seu mundo. <span class="cyan">Ao vivo.</span></h1>'+
    '<div class="hero-sub">Assista às melhores lives, descubra novos criadores e faça parte da comunidade Zytrix.</div>'+
    '<div id="browse-featured" class="featured-area"><div class="empty-lives">Carregando destaques...</div></div>'+
    '<div class="section-label">AGORA</div><h2 class="browse-title">AO VIVO NA ZYTRIX</h2>'+
    '<div class="live-toolbar"><div class="filter-chips" id="live-filters"><button class="chip active" data-filter="">Todos</button>'+
    Object.keys(CATEGORY_DATA).map(n=>'<button class="chip" data-filter="'+esc(n)+'">'+CATEGORY_ICONS[n]+" "+esc(n)+"</button>").join("")+
    '</div><label class="search-live">🔎 <input id="live-search" placeholder="Pesquisar lives…"></label></div>'+
    '<div id="browse-list"><div class="empty-lives">Carregando...</div></div></div></section>';
  let category="",term="";
  function rerender(){
    let list=liveCache;
    if(category)list=list.filter(l=>l.categoryId===category||l.categoryId.startsWith(category+" - "));
    if(term){const t=slug(term);list=list.filter(l=>slug(l.title+" "+l.username+" "+l.categoryId).includes(t))}
    $("#browse-list").innerHTML=liveListHtml(list);
    bindStreamLinks();
  }
  watchLiveStreams(lives=>{
    $("#browse-featured").innerHTML=liveListHtml(lives,3);
    rerender();bindStreamLinks();
  },()=>{$("#browse-featured").innerHTML=liveListHtml([],3);rerender()});
  $$("#live-filters [data-filter]").forEach(btn=>btn.onclick=()=>{
    $$("#live-filters .chip").forEach(x=>x.classList.remove("active"));btn.classList.add("active");category=btn.dataset.filter||"";rerender();
  });
  $("#live-search").oninput=e=>{term=e.target.value;rerender()};
}

function categoriesBackground(){
  return '<section class="categories-page"><div class="container"><div class="kicker">• EXPLORE A ZYTRIX</div><h1>Categorias</h1>'+
    '<div class="desc">Encontre transmissões sobre os assuntos que você gosta.</div><div class="categories-main-grid">'+
    Object.keys(CATEGORY_DATA).map(n=>'<div class="category-card wide"><span>'+CATEGORY_ICONS[n]+" "+esc(n)+'</span><span>→</span></div>').join("")+
    "</div></div></section>";
}
function renderCategorias(){
  pageTitle("Categorias");
  if(!currentUser){$("#app").innerHTML=guestGate("Categorias",categoriesBackground());return}
  $("#app").innerHTML='<section class="categories-page"><div class="container"><div class="kicker">• EXPLORE A ZYTRIX</div><h1>Categorias</h1>'+
    '<div class="desc">Encontre transmissões sobre os assuntos que você gosta.</div><div class="categories-main-grid">'+
    Object.keys(CATEGORY_DATA).map(n=>'<a class="category-card wide" href="'+categoryPath(n)+'"><span>'+CATEGORY_ICONS[n]+" <b>"+esc(n)+'</b></span><span style="color:var(--cyan)">→</span></a>').join("")+
    "</div></div></section>";
}
function renderCategoria(){
  if(!requireAuthOrRedirect())return;
  const parts=location.pathname.split("/").filter(Boolean);
  const main=categoryNameFromSlug(parts[1]||"");
  const sub=subNameFromSlug(main,parts[2]||"");
  if(!main){location.replace("/categorias");return}
  pageTitle(sub?main+" — "+sub:main);
  const subs=(CATEGORY_DATA[main]||[]).map(s=>'<a class="chip '+(sub===s?"active":"")+'" href="'+categoryPath(main,s)+'">'+esc(s)+"</a>").join("");
  $("#app").innerHTML='<section class="container category-results"><div class="category-detail-head"><div class="section-label">CATEGORIAS</div>'+
    '<h1>'+CATEGORY_ICONS[main]+" "+esc(sub||main)+'</h1><p>'+(sub?"Transmissões de "+esc(sub)+" em "+esc(main):"Explore "+esc(main)+" e suas subcategorias.")+'</p></div>'+
    '<div class="subcategory-links"><a class="chip '+(!sub?"active":"")+'" href="'+categoryPath(main)+'">Tudo</a>'+subs+"</div>"+
    '<div id="category-live-list"><div class="empty-lives">Carregando transmissões...</div></div></section>';
  watchLiveStreams(lives=>{
    const filtered=lives.filter(l=>sub?l.categoryId===main+" - "+sub:(l.categoryId===main||l.categoryId.startsWith(main+" - ")));
    $("#category-live-list").innerHTML=liveListHtml(filtered);
    bindStreamLinks();
  },()=>{$("#category-live-list").innerHTML=liveListHtml([])});
}

function renderSobre(){
  pageTitle("Sobre");
  $("#app").innerHTML='<section class="about-hero"><div class="container"><div class="kicker">• SOBRE A ZYTRIX</div>'+
    '<h1>Conectando pessoas através<br>do <span style="color:var(--cyan)">Ao Vivo.</span></h1>'+
    '<div class="lead">Assista às melhores lives, descubra novos criadores e faça parte da comunidade Zytrix.</div>'+
    '<div class="about-columns"><h2>O FUTURO DO LIVESTREAM<br>COMEÇA AQUI.</h2><div class="about-copy">'+
    '<p>A Zytrix é uma plataforma criada para tornar o livestream mais simples, divertido e acessível.</p>'+
    '<p>Nossa missão é dar aos criadores as ferramentas necessárias para construir comunidades enquanto oferecemos aos espectadores um lugar para descobrir conteúdo incrível.</p>'+
    '<p>Gaming, música, tecnologia, conversas ou criatividade: na Zytrix, existe espaço para todos.</p></div></div></div></section>'+
    '<section class="values-section"><div class="container"><div class="section-label">NOSSOS VALORES</div><h3>Feita para a comunidade</h3><div class="values-grid">'+
    '<div class="value-card">⚡<b>Liberdade</b><p>Criadores têm liberdade para transmitir e criar seu próprio conteúdo.</p></div>'+
    '<div class="value-card">🌎<b>Comunidade</b><p>Acreditamos que as melhores experiências acontecem quando pessoas se conectam.</p></div>'+
    '<div class="value-card">🛡️<b>Segurança</b><p>Trabalhamos para criar um ambiente saudável para todos.</p></div>'+
    '<div class="value-card">🚀<b>Inovação</b><p>Estamos sempre buscando novas formas de melhorar o livestream.</p></div></div></div></section>'+
    '<section class="big-block"><div class="container" style="display:contents"><h2>FEITA PARA CRIADORES E<br>ESPECTADORES</h2><div class="about-copy"><p>Para quem cria, queremos oferecer um espaço onde seja fácil construir uma comunidade e apresentar seu conteúdo.</p><p>Para quem assiste, queremos facilitar a descoberta de novas transmissões, categorias e criadores.</p></div></div></section>'+
    '<section class="big-block alt"><div class="container" style="display:contents"><h2>UM ESPAÇO PARA TODOS</h2><div class="about-copy"><p>Não importa se você quer jogar, conversar, produzir música, programar, acompanhar esportes ou criar conteúdo.</p><p>Estamos construindo a plataforma pensando em simplicidade, comunidade, liberdade e inovação.</p></div></div></section>';
}

function authCard(kind){
  const isLogin=kind==="login",isRegister=kind==="registro";
  const title=isLogin?"Entrar":isRegister?"Registrar":"Recuperar senha";
  const fields=isRegister?'<div class="form-group"><input class="form-control" name="username" placeholder="Nome de usuário" required maxlength="30"></div>':"";
  const pass=(isLogin||isRegister)?'<div class="form-group"><input class="form-control" name="password" type="password" placeholder="Senha" required minlength="10"></div>':"";
  const submit=isLogin?"Entrar":isRegister?"Criar conta":"Enviar link";
  const extras=isLogin?'<div class="auth-links"><a href="/recuperar-senha">Esqueci minha senha</a></div>':"";
  const google=(isLogin||isRegister)?'<button class="google-btn" type="button" id="google-auth">G&nbsp; Entrar com o Google</button>':"";
  const bottom=isLogin?'<div class="auth-links">Não possui conta? <a href="/registro">Registrar</a></div>':
    isRegister?'<div class="auth-links">Já possui conta? <a href="/login">Entrar</a></div>':
    '<div class="auth-links"><a href="/login">Voltar para entrar</a></div>';
  return '<section class="auth-page"><div class="auth-card"><div class="brand auth-brand"><span class="brand-mark">Z</span><span>Zytrix</span></div>'+
    '<h1>'+title+'</h1><form id="auth-form" class="form-grid">'+fields+
    '<div class="form-group"><input class="form-control" name="email" type="email" placeholder="E-mail" required></div>'+pass+
    '<button class="btn-purple" type="submit">'+submit+'</button></form>'+extras+google+bottom+'<div id="auth-message"></div></div></section>';
}
function authError(err){
  const c=String(err?.code||"");
  if(c==="auth/popup-blocked")return "O navegador bloqueou a janela do Google.";
  if(c==="auth/popup-closed-by-user"||c==="auth/cancelled-popup-request")return "Login com Google cancelado.";
  if(c==="auth/unauthorized-domain")return "Este domínio ainda não está autorizado no Firebase Authentication.";
  if(c==="auth/operation-not-allowed")return "Este método de login não está habilitado no Firebase.";
  if(c==="auth/network-request-failed")return "Falha de rede. Tente novamente.";
  if(c==="auth/email-already-in-use")return "Este e-mail já está cadastrado.";
  if(c==="auth/weak-password")return "A senha é muito fraca.";
  return "Não foi possível concluir a autenticação.";
}
function renderAuth(kind){
  pageTitle(kind==="login"?"Entrar":kind==="registro"?"Registrar":"Recuperar senha");
  $("#app").innerHTML=authCard(kind);
  const form=$("#auth-form"),msg=$("#auth-message");
  form.onsubmit=async e=>{
    e.preventDefault();setMessage(msg,"");
    const fd=new FormData(form),email=String(fd.get("email")||"").trim();
    try{
      if(kind==="login"){
        const cred=await signInWithEmailAndPassword(auth,email,String(fd.get("password")||""));
        await ensureUserDocs(cred.user,cred.user.displayName||"Usuário","password");
        location.href=nextAfterAuth();
      }else if(kind==="registro"){
        const username=String(fd.get("username")||"").trim(),password=String(fd.get("password")||"");
        if(username.length<2||username.length>30)throw new Error("username-invalid");
        if(password.length<10||!/[A-Za-z]/.test(password)||!/\d/.test(password))throw new Error("password-invalid");
        const cred=await createUserWithEmailAndPassword(auth,email,password);
        await ensureUserDocs(cred.user,username,"password");
        await sendEmailVerification(cred.user);
        setMessage(msg,"Conta criada. Enviamos um e-mail de verificação.","ok");
        setTimeout(()=>location.href=nextAfterAuth(),900);
      }else{
        await sendPasswordResetEmail(auth,email).catch(()=>{});
        setMessage(msg,"Se existir uma conta para esse e-mail, enviaremos as instruções.","ok");
      }
    }catch(err){
      console.warn(err);
      if(err?.message==="username-invalid")setMessage(msg,"O nome precisa ter entre 2 e 30 caracteres.");
      else if(err?.message==="password-invalid")setMessage(msg,"Use pelo menos 10 caracteres, com letra e número.");
      else setMessage(msg,authError(err));
    }
  };
  const google=$("#google-auth");
  if(google)google.onclick=async()=>{
    google.disabled=true;setMessage(msg,"");
    try{
      const cred=await signInWithPopup(auth,googleProvider);
      await ensureUserDocs(cred.user,cred.user.displayName||"Usuário","google");
      location.href=nextAfterAuth();
    }catch(err){setMessage(msg,authError(err))}
    finally{google.disabled=false}
  };
}

function selectedStreamId(){
  const q=new URLSearchParams(location.search).get("stream");
  if(q)return q;
  try{return localStorage.getItem(STREAM_KEY)||""}catch{return ""}
}
function twitchChannel(v){
  const s=String(v||"").trim();
  if(/^[A-Za-z0-9_]+$/.test(s))return s;
  try{
    const u=new URL(s);const h=u.hostname.replace(/^www\./,"").toLowerCase();
    if(h==="player.twitch.tv")return u.searchParams.get("channel")||"";
    if(h==="twitch.tv")return u.pathname.split("/").filter(Boolean)[0]||"";
  }catch{}
  return "";
}
function youtubeId(v){
  try{
    const u=new URL(String(v||""));const h=u.hostname.replace(/^www\./,"").toLowerCase();
    if(h==="youtu.be")return u.pathname.split("/").filter(Boolean)[0]||"";
    if(h==="youtube.com"||h==="m.youtube.com"){
      if(u.pathname==="/watch")return u.searchParams.get("v")||"";
      const p=u.pathname.split("/").filter(Boolean);if(["live","embed"].includes(p[0]))return p[1]||"";
    }
  }catch{}
  return "";
}
function playerHtml(playback,title){
  const y=youtubeId(playback);
  if(y&&/^[A-Za-z0-9_-]{6,20}$/.test(y))return '<iframe src="https://www.youtube.com/embed/'+encodeURIComponent(y)+'?autoplay=1&mute=1" title="'+esc(title)+'" allow="autoplay; fullscreen" allowfullscreen></iframe>';
  const t=twitchChannel(playback);
  if(t){
    const parent=encodeURIComponent(location.hostname);
    return '<iframe src="https://player.twitch.tv/?channel='+encodeURIComponent(t)+'&parent='+parent+'&autoplay=true&muted=true" title="'+esc(title)+'" allow="autoplay; fullscreen" allowfullscreen></iframe>';
  }
  try{
    const u=new URL(String(playback||""));const h=u.hostname.toLowerCase();
    if(h==="player.kick.com"||h.endsWith(".kick.com"))return '<iframe src="'+esc(u.href)+'" title="'+esc(title)+'" allow="autoplay; fullscreen" allowfullscreen></iframe>';
  }catch{}
  return '<div class="player-empty"><div><strong>Player indisponível</strong><br><small>Configure o playbackURL desta transmissão.</small></div></div>';
}
function initialChat(){
  return [
    {username:"ZyBot",text:"Bem-vindo ao chat da Zytrix! 💙",time:"agora"},
    {username:"LunaPlay",text:"Salve, chat! 👋",time:"agora"},
    {username:"NeoBR",text:"Essa live tá muito boa 🔥",time:"agora"},
    {username:"PixelX",text:"Bora apoiar o streamer! ◈",time:"agora"}
  ];
}
async function renderLive(){
  pageTitle("Live");
  const id=selectedStreamId();
  if(!id){
    $("#app").innerHTML='<div class="center-state"><div><div class="state-icon">!</div><h2>Live não encontrada</h2><small>Selecione uma transmissão antes de entrar nesta página.</small></div></div>';
    return;
  }
  $("#app").innerHTML='<section class="container live-page"><div class="center-state" style="min-height:450px">Carregando transmissão...</div></section>';
  const ref=doc(db,"streams",id);
  const unsub=onSnapshot(ref,async snap=>{
    if(!snap.exists()){
      $("#app").innerHTML='<div class="center-state"><div><div class="state-icon">!</div><h2>Live não encontrada</h2><small>Essa transmissão não existe.</small></div></div>';return;
    }
    const d=snap.data(),stream={id:snap.id,...d,viewerCount:Math.max(0,Number(d.viewerCount||0))};
    const profile=await getProfile(String(stream.streamerUid||""));
    let balance=0;
    if(currentUser){
      await ensureWallet(currentUser).catch(()=>{});
      const w=await getDoc(doc(db,"wallets",currentUser.uid)).catch(()=>null);
      if(w?.exists())balance=Math.max(0,Number(w.data().balance||0));
    }
    drawLive(stream,profile,balance);
  },e=>{
    console.error(e);$("#app").innerHTML='<div class="center-state">Não foi possível carregar esta live.</div>';
  });
  pageCleanups.push(unsub);
}
function drawLive(stream,profile,balance){
  const mine=currentUser&&currentUser.uid===stream.streamerUid;
  $("#app").innerHTML='<section class="container live-page"><div class="live-layout"><div>'+
    '<div class="player-shell">'+playerHtml(stream.playbackURL,stream.title)+'</div>'+
    '<div class="live-info"><div><div class="status-row"><span class="badge '+(stream.status==="live"?"live":"offline")+'">● '+(stream.status==="live"?"AO VIVO":"OFFLINE")+'</span>'+
    '<span class="badge category">'+esc(stream.categoryId||"SEM CATEGORIA")+'</span></div><h1>'+esc(stream.title||"Transmissão")+'</h1>'+
    '<div class="live-desc">'+esc(stream.description||"")+'</div><div class="creator-line">'+avatarMarkup(profile)+'<b>'+esc(profile.username||"Streamer")+'</b></div></div>'+
    '<div class="live-side-stats"><div class="mini-card"><small>ESPECTADORES</small><strong>👁 '+coins(stream.viewerCount)+'</strong></div>'+
    '<div class="mini-card"><small>ZY SALDO</small><strong style="color:var(--cyan)">◈ '+coins(balance)+'</strong></div></div></div>'+
    '<div class="support-card"><div class="eyebrow">ZY COINS</div><h3 style="margin:3px 0">Apoie '+esc(profile.username||"Streamer")+'</h3>'+
    '<small style="color:#7e899a">Envie Zy Coins diretamente para este streamer durante a transmissão.</small>'+
    (mine?'<div class="message" style="background:#101a27;border:1px solid #283a4c">Esta é a sua transmissão. Você pode receber Zy Coins dos espectadores, mas não pode apoiar a própria live.</div>':
    '<div class="support-options"><button data-coin="10">◈ 10</button><button data-coin="50" class="active">◈ 50</button><button data-coin="100">◈ 100</button><button data-coin="500">◈ 500</button>'+
    '<input id="custom-coin" class="form-control" style="max-width:130px" type="number" min="1" max="100000" placeholder="Outro valor"></div>'+
    '<button id="support-send" class="btn primary">Enviar apoio</button><div id="support-message"></div>')+
    '</div></div><aside class="chat-panel"><div class="chat-head"><div><div class="eyebrow">AO VIVO</div><b>Chat da transmissão</b></div><span style="color:var(--green)">●</span></div>'+
    '<div class="chat-warning">Chat simulado — as mensagens digitadas ficam apenas nesta tela.</div><div class="chat-messages" id="chat-messages"></div>'+
    '<div class="chat-input"><input id="chat-text" class="form-control" maxlength="180" placeholder="Enviar mensagem..."><button id="chat-send" class="btn primary">➤</button></div></aside></div></section>';
  const messages=initialChat();
  function drawChat(){
    $("#chat-messages").innerHTML=messages.map(m=>'<div class="chat-msg '+(m.own?"own":"")+'"><div><b>'+esc(m.username)+'</b><time>'+esc(m.time)+'</time></div><div>'+esc(m.text)+'</div></div>').join("");
    $("#chat-messages").scrollTop=$("#chat-messages").scrollHeight;
  }
  drawChat();
  function sendChat(){
    const input=$("#chat-text"),text=String(input.value||"").trim().slice(0,180);if(!text)return;
    messages.push({username:currentUser?.displayName||"Visitante",text,time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),own:true});
    input.value="";drawChat();
  }
  $("#chat-send").onclick=sendChat;$("#chat-text").onkeydown=e=>{if(e.key==="Enter")sendChat()};
  if(mine)return;
  let amount=50;
  $$("[data-coin]").forEach(b=>b.onclick=()=>{$$("[data-coin]").forEach(x=>x.classList.remove("active"));b.classList.add("active");amount=Number(b.dataset.coin)});
  $("#support-send").onclick=async()=>{
    const msg=$("#support-message");
    if(!currentUser){setMessage(msg,"Entre na sua conta para apoiar um streamer.");return}
    if(stream.status!=="live"){setMessage(msg,"Só é possível apoiar enquanto a transmissão estiver ao vivo.");return}
    if(currentUser.uid===stream.streamerUid){setMessage(msg,"Você não pode apoiar a própria transmissão.");return}
    const custom=Math.floor(Number($("#custom-coin").value||0));const sendAmount=custom>0?custom:amount;
    if(!Number.isFinite(sendAmount)||sendAmount<1||sendAmount>100000){setMessage(msg,"Escolha um valor válido.");return}
    const senderRef=doc(db,"wallets",currentUser.uid),recipientRef=doc(db,"wallets",stream.streamerUid);
    const txRef=doc(collection(db,"zyCoinTransactions"));
    try{
      await ensureWallet(currentUser);
      await runTransaction(db,async tx=>{
        const [ss,rs]=await Promise.all([tx.get(senderRef),tx.get(recipientRef)]);
        if(!ss.exists())throw new Error("wallet-not-found");
        const sender=ss.data(),senderBalance=Math.max(0,Number(sender.balance||0));
        if(senderBalance<sendAmount)throw new Error("insufficient");
        const recipient=rs.exists()?rs.data():{balance:BONUS_INICIAL,totalReceived:0,totalSent:0};
        tx.update(senderRef,{balance:senderBalance-sendAmount,totalSent:Math.max(0,Number(sender.totalSent||0))+sendAmount,lastTransactionId:txRef.id,updatedAt:serverTimestamp()});
        if(rs.exists())tx.update(recipientRef,{balance:Math.max(0,Number(recipient.balance||0))+sendAmount,totalReceived:Math.max(0,Number(recipient.totalReceived||0))+sendAmount,lastTransactionId:txRef.id,updatedAt:serverTimestamp()});
        else tx.set(recipientRef,{uid:stream.streamerUid,balance:BONUS_INICIAL+sendAmount,totalSent:0,totalReceived:sendAmount,lastTransactionId:txRef.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        tx.set(txRef,{transactionId:txRef.id,type:"stream_support",fromUid:currentUser.uid,toUid:stream.streamerUid,streamId:stream.id,amount:sendAmount,status:"completed",createdAt:serverTimestamp()});
      });
      setMessage(msg,"Apoio enviado: ◈ "+coins(sendAmount)+" Zy Coins.","ok");
    }catch(e){setMessage(msg,e?.message==="insufficient"?"Saldo insuficiente.":"Não foi possível enviar o apoio.")}
  };
}

async function renderLoja(){
  if(!requireAuthOrRedirect())return;
  pageTitle("Loja");
  $("#app").innerHTML='<section class="container store-page"><div class="center-state" style="min-height:400px">Carregando Zy Coins...</div></section>';
  await ensureWallet(currentUser).catch(()=>{});
  let selected="";try{selected=localStorage.getItem(PACKAGE_KEY)||""}catch{}
  const ref=doc(db,"wallets",currentUser.uid);
  const unsub=onSnapshot(ref,snap=>drawStore(snap.exists()?snap.data():{balance:0},selected));
  pageCleanups.push(unsub);
}
function drawStore(wallet,initialSelected){
  let selected=initialSelected;
  $("#app").innerHTML='<section class="container store-page"><div class="store-hero"><div><div class="eyebrow">ZYTRIX • APOIE QUEM CRIA</div><h1>Zy Coins</h1>'+
    '<p style="color:#8290a3">Use Zy Coins para apoiar streamers durante as lives. Quanto mais você apoia, mais força dá para os criadores continuarem produzindo conteúdo.</p></div>'+
    '<div class="balance-card"><small>SEU SALDO</small><strong>◈ '+coins(wallet.balance)+'</strong><small>Zy Coins disponíveis</small></div></div>'+
    '<div style="margin-top:25px"><div class="eyebrow">PACOTES</div><h2 style="margin:5px 0">Escolha suas Zy Coins</h2><div class="package-grid" id="packages">'+
    PACKAGES.map(p=>'<article class="package-card '+(selected===p.id?"selected":"")+'" data-package="'+p.id+'">'+(p.popular?'<span class="popular">MAIS POPULAR</span>':"")+
      '<span style="color:var(--cyan);font-size:24px">◈</span><div class="coins">'+coins(p.coins)+'</div><b>'+esc(p.label)+'</b><p>'+esc(p.description)+'</p><div class="price">'+money(p.priceCents)+'</div>'+
      '<button class="btn" type="button">SELECIONAR</button></article>').join("")+
    '</div><div class="continue-card"><div><b id="package-state">'+(selected?"Pacote selecionado.":"Selecione um pacote para continuar")+'</b>'+
    '<div style="color:#78869a;font-size:10px;margin-top:4px">O pacote escolhido fica salvo neste navegador.</div></div><a id="go-payment" class="btn primary" href="/pagamento">Pagamento</a></div></div></section>';
  $$("[data-package]").forEach(card=>card.onclick=()=>{
    selected=card.dataset.package;try{localStorage.setItem(PACKAGE_KEY,selected)}catch{}
    $$("[data-package]").forEach(c=>c.classList.toggle("selected",c.dataset.package===selected));
    $("#package-state").textContent="Pacote selecionado.";
  });
}

async function renderPagamento(){
  if(!requireAuthOrRedirect())return;
  pageTitle("Pagamento");
  await ensureWallet(currentUser).catch(()=>{});
  let pid="";try{pid=localStorage.getItem(PACKAGE_KEY)||""}catch{}
  const pack=PACKAGES.find(p=>p.id===pid)||null;
  if(!pack){
    $("#app").innerHTML='<div class="center-state"><div><div class="state-icon">◈</div><h2>Nenhum pacote selecionado</h2><small>Volte para a Loja de Zy Coins, selecione um pacote e depois abra esta página novamente.</small><div style="margin-top:20px"><a class="btn primary" href="/loja">Voltar à loja</a></div></div></div>';
    return;
  }
  const adminSnap=await getDoc(doc(db,"admins",currentUser.uid)).catch(()=>null);
  const isAdmin=!!(adminSnap?.exists()&&adminSnap.data().active===true);
  const walletRef=doc(db,"wallets",currentUser.uid);
  const unsub=onSnapshot(walletRef,snap=>drawPayment(pack,snap.exists()?Number(snap.data().balance||0):0,isAdmin));
  pageCleanups.push(unsub);
}
function drawPayment(pack,balance,isAdmin){
  $("#app").innerHTML='<section class="container payment-page"><div class="eyebrow">CHECKOUT ZYTRIX</div><h1>Pagamento</h1><p style="color:#7e8b9c">Confira o pacote escolhido e selecione a forma de pagamento.</p>'+
    '<div class="payment-grid"><div class="payment-box"><div class="eyebrow">FORMA DE PAGAMENTO</div><h2>Como deseja pagar?</h2><div class="method-grid">'+
    '<button class="method active" data-method="pix"><b>◆ &nbsp; PIX</b><small style="display:block;color:#7e899a;margin-top:5px">Confirmação rápida quando houver gateway.</small></button>'+
    '<button class="method" data-method="card"><b>▣ &nbsp; Cartão</b><small style="display:block;color:#7e899a;margin-top:5px">Não coletamos número de cartão nesta versão.</small></button></div>'+
    '<div class="account-card"><b>Pagamento protegido por arquitetura segura</b><p style="color:#7f8a9d;font-size:10px">Um pagamento real deve ser confirmado por backend ou gateway. O navegador não credita moedas sozinho.</p></div>'+
    (isAdmin?'<div class="message ok">Modo demonstrativo de administrador ativo.</div>':'<div class="message" style="background:#102131;border:1px solid #225b79;color:#7edaff">Modo TCC: pedido demonstrativo. O saldo só muda com confirmação segura.</div>')+
    '<div id="payment-message"></div></div><aside><div class="balance-card"><small>SALDO ATUAL</small><strong>◈ '+coins(balance)+'</strong></div>'+
    '<div class="payment-box order-summary" style="margin-top:14px"><div class="eyebrow">RESUMO DO PEDIDO</div><div style="color:var(--cyan);font-size:25px;margin-top:15px">◈</div><div class="coins">'+coins(pack.coins)+'</div><b>Zy Coins</b><p style="color:#7f8a9d;font-size:10px">'+esc(pack.label)+'</p>'+
    '<div class="summary-row"><span>Pacote</span><span>'+money(pack.priceCents)+'</span></div><div class="summary-row"><span>Taxa</span><span>R$ 0,00</span></div><div class="summary-row"><b>Total</b><b>'+money(pack.priceCents)+'</b></div>'+
    '<button id="pay-demo" class="btn primary" style="width:100%;margin-top:10px">'+(isAdmin?"SIMULAR PAGAMENTO APROVADO":"CRIAR PEDIDO DEMONSTRATIVO")+'</button></div></aside></div></section>';
  let method="pix";$$("[data-method]").forEach(b=>b.onclick=()=>{$$("[data-method]").forEach(x=>x.classList.remove("active"));b.classList.add("active");method=b.dataset.method});
  $("#pay-demo").onclick=async()=>{
    const btn=$("#pay-demo"),msg=$("#payment-message");btn.disabled=true;setMessage(msg,"");
    const orderRef=doc(collection(db,"zyCoinOrders"));
    try{
      if(isAdmin){
        const wref=doc(db,"wallets",currentUser.uid);
        await runTransaction(db,async tx=>{
          const ws=await tx.get(wref);if(!ws.exists())throw new Error("Carteira não encontrada.");
          const w=ws.data();
          tx.update(wref,{balance:Math.max(0,Number(w.balance||0))+pack.coins,totalSent:Math.max(0,Number(w.totalSent||0)),totalReceived:Math.max(0,Number(w.totalReceived||0)),lastTransactionId:orderRef.id,updatedAt:serverTimestamp()});
          tx.set(orderRef,{uid:currentUser.uid,packageId:pack.id,coins:pack.coins,priceCents:pack.priceCents,paymentMethod:method,status:"paid",mode:"admin_demo",createdAt:serverTimestamp(),paidAt:serverTimestamp()});
        });
        setMessage(msg,"Pagamento demonstrativo aprovado. "+coins(pack.coins)+" Zy Coins foram adicionadas.","ok");
      }else{
        await setDoc(orderRef,{uid:currentUser.uid,packageId:pack.id,coins:pack.coins,priceCents:pack.priceCents,paymentMethod:method,status:"pending",mode:"prototype",createdAt:serverTimestamp(),paidAt:null});
        setMessage(msg,"Pedido criado. O pagamento real não está conectado nesta versão do TCC.","ok");
      }
    }catch(e){console.error(e);setMessage(msg,e?.message||"Não foi possível criar o pedido.")}
    finally{btn.disabled=false}
  };
}

function defaultAvatar(){
  return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#D1D5DB"/><circle cx="150" cy="105" r="55" fill="#6B7280"/><path d="M55 270c15-65 54-95 95-95s80 30 95 95" fill="#6B7280"/></svg>');
}
function timestampDate(ts){
  try{return ts&&typeof ts.toDate==="function"?ts.toDate():null}catch{return null}
}
async function findUserStream(uid){
  const q=query(collection(db,"streams"),where("streamerUid","==",uid),limit(1));
  const res=await getDocs(q);if(res.empty)return null;return {id:res.docs[0].id,...res.docs[0].data()};
}
function extractTwitchUser(value){
  const input=String(value||"").trim();if(!input)return "";
  try{
    const u=new URL(input.startsWith("http")?input:"https://"+input);
    const h=u.hostname.replace(/^www\./,"").toLowerCase();
    if(h!=="twitch.tv")return "";
    return u.pathname.split("/").filter(Boolean)[0]||"";
  }catch{return ""}
}
async function maybeCompleteTwitchChange(user){
  if(!isSignInWithEmailLink(auth,location.href))return "";
  const pendingURL=localStorage.getItem("zytrixPendingTwitchURL")||"";
  const pendingUid=localStorage.getItem("zytrixPendingTwitchUid")||"";
  const pendingEmail=localStorage.getItem("zytrixPendingTwitchEmail")||"";
  if(!pendingURL||pendingUid!==user.uid||!pendingEmail)return "Solicitação de troca da Twitch inválida ou pertence a outra conta.";
  const cred=EmailAuthProvider.credentialWithLink(pendingEmail,location.href);
  await reauthenticateWithCredential(user,cred);
  const stream=await findUserStream(user.uid);if(!stream)throw new Error("Live não encontrada.");
  await updateDoc(doc(db,"streams",stream.id),{playbackURL:pendingURL});
  localStorage.removeItem("zytrixPendingTwitchURL");localStorage.removeItem("zytrixPendingTwitchUid");localStorage.removeItem("zytrixPendingTwitchEmail");
  history.replaceState({},document.title,"/perfil");
  return "Conta da Twitch alterada com sucesso.";
}
async function renderPerfil(){
  if(!requireAuthOrRedirect())return;
  pageTitle("Perfil");
  $("#app").innerHTML='<div class="center-state">Carregando perfil...</div>';
  try{
    await currentUser.reload();
    const twitchMessage=await maybeCompleteTwitchChange(currentUser).catch(e=>{console.error(e);return "Não foi possível concluir a troca da Twitch."});
    const [ps,us]=await Promise.all([getDoc(doc(db,"profiles",currentUser.uid)),getDoc(doc(db,"users",currentUser.uid))]);
    if(!ps.exists()||!us.exists())await ensureUserDocs(currentUser,currentUser.displayName||"Usuário","password");
    const [p2,u2]=await Promise.all([getDoc(doc(db,"profiles",currentUser.uid)),getDoc(doc(db,"users",currentUser.uid))]);
    const profile=p2.data(),account=u2.data();
    await ensureWallet(currentUser).catch(()=>{});
    const walletSnap=await getDoc(doc(db,"wallets",currentUser.uid)).catch(()=>null);
    const wallet=walletSnap?.exists()?walletSnap.data():{balance:0};
    const channelSnap=await getDoc(doc(db,"channels",currentUser.uid)).catch(()=>null);
    let stream=null;if(channelSnap?.exists()){const cid=String(channelSnap.data().currentStreamId||"");if(cid){const ss=await getDoc(doc(db,"streams",cid)).catch(()=>null);if(ss?.exists())stream={id:ss.id,...ss.data()}}if(!stream)stream=await findUserStream(currentUser.uid)}
    drawProfile(profile,account,wallet,channelSnap?.exists(),stream,twitchMessage);
  }catch(e){console.error(e);$("#app").innerHTML='<div class="center-state">Não foi possível carregar seu perfil.</div>'}
}
function drawProfile(profile,account,wallet,isStreamer,stream,twitchMessage){
  const created=timestampDate(account.createdAt);
  const member=created?created.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}):"Data indisponível";
  const image=safeHttps(profile.photoURL)||defaultAvatar();
  const verified=currentUser.emailVerified;
  const twitch=stream?.playbackURL||"";
  $("#app").innerHTML='<section class="profile-page"><div class="profile-shell"><div class="profile-top"><a class="brand" href="/"><span class="brand-mark">Z</span><span>Zytrix</span></a><h1>Perfil</h1><a class="top-btn primary" href="/config-live">Configurar</a></div>'+
    '<div class="profile-main"><div><img class="profile-avatar" src="'+esc(image)+'" alt=""><button id="edit-profile" class="btn-purple" style="width:145px;margin-top:8px">Editar perfil</button></div>'+
    '<div><h3>Nome: '+esc(profile.username||"Usuário")+'</h3><div id="name-cooldown" style="color:#a7b0c0;font-size:11px"></div>'+
    '<p>ID: <span id="profile-id">Oculto</span></p><button id="toggle-id" class="btn" style="min-height:32px;padding:5px 10px">Mostrar ID</button>'+
    '<div class="account-card"><div class="eyebrow">CONTA</div><div class="account-row"><b>Membro desde:</b><b>'+esc(member)+'</b></div>'+
    '<div class="account-row"><b>Zy Coins:</b><span class="verified" style="background:#08384b;color:var(--cyan)">◈ '+coins(wallet.balance)+'</span></div>'+
    '<div class="account-row"><div><b>E-mail:</b><div style="margin-top:7px">'+esc(currentUser.email||"")+'</div></div>'+
    '<div>'+(verified?'<span class="verified">✓ Verificado</span>':'<button id="verify-email" class="btn">Verificar e-mail</button>')+'</div></div></div>'+
    '<h3>Bio: '+esc(profile.bio||"Sem bio")+'</h3><div id="profile-form"></div>'+
    '<div class="streamer-card"><div class="eyebrow">CONTA DE STREAMER</div><div id="streamer-area"></div></div>'+
    (twitchMessage?'<div class="message ok">'+esc(twitchMessage)+'</div>':"")+'</div></div>'+
    '<div style="position:absolute;right:20px;bottom:18px"><a class="btn danger" href="/sair">Desconectar</a></div></div></section>';
  const updated=timestampDate(profile.usernameUpdatedAt),unlock=updated?updated.getTime()+7*24*60*60*1000:0;
  $("#name-cooldown").textContent=!updated||Date.now()>=unlock?"Você já pode alterar seu nome de usuário.":"Você poderá mudar o nome em "+Math.floor((unlock-Date.now())/86400000)+" dia(s).";
  let showId=false;$("#toggle-id").onclick=()=>{showId=!showId;$("#profile-id").textContent=showId?(account.zytrixId||currentUser.uid):"Oculto";$("#toggle-id").textContent=showId?"Ocultar ID":"Mostrar ID"};
  $("#edit-profile").onclick=()=>renderEditProfile(profile);
  const verify=$("#verify-email");if(verify)verify.onclick=async()=>{verify.disabled=true;try{await sendEmailVerification(currentUser);verify.textContent="E-mail enviado"}catch{verify.textContent="Falha ao enviar"}};
  renderStreamerArea(isStreamer,stream,profile,twitch);
}
function renderEditProfile(profile){
  const area=$("#profile-form");area.innerHTML='<div class="profile-edit"><input id="profile-name" class="form-control" maxlength="30" value="'+esc(profile.username||"")+'">'+
    '<input id="profile-photo" class="form-control" placeholder="URL da foto" value="'+esc(profile.photoURL||"")+'"><textarea id="profile-bio" class="form-control" maxlength="500" placeholder="Bio">'+esc(profile.bio||"")+'</textarea>'+
    '<div class="profile-actions"><button id="save-profile" class="btn primary">Salvar</button><button id="cancel-profile" class="btn">Cancelar</button></div><div id="profile-message"></div></div>';
  $("#cancel-profile").onclick=()=>area.innerHTML="";
  $("#save-profile").onclick=async()=>{
    const msg=$("#profile-message"),name=$("#profile-name").value.trim(),bio=$("#profile-bio").value.trim(),photo=$("#profile-photo").value.trim();
    if(name.length<2||name.length>30){setMessage(msg,"O nome precisa ter entre 2 e 30 caracteres.");return}
    if(bio.length>500){setMessage(msg,"A bio pode ter no máximo 500 caracteres.");return}
    const changed=name!==profile.username,updated=timestampDate(profile.usernameUpdatedAt);
    if(changed&&updated&&Date.now()<updated.getTime()+7*86400000){setMessage(msg,"Você ainda precisa esperar 7 dias para alterar o nome.");return}
    const data={bio,photoURL:photo};if(changed){data.username=name;data.usernameUpdatedAt=serverTimestamp()}
    try{await updateDoc(doc(db,"profiles",currentUser.uid),data);setMessage(msg,"Perfil atualizado com sucesso.","ok");setTimeout(()=>renderPerfil(),500)}
    catch(e){console.error(e);setMessage(msg,"Não foi possível salvar o perfil.")}
  };
}
function renderStreamerArea(isStreamer,stream,profile,twitch){
  const area=$("#streamer-area");
  if(isStreamer){
    area.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><div><h3 style="margin:8px 0">🎥 Seu canal está pronto</h3><small style="color:#8190a2">Configure título, descrição, categoria e thumbnail na página Configurar Live.</small></div>'+
      '<span class="badge '+(stream?.status==="live"?"live":"offline")+'">● '+(stream?.status==="live"?"AO VIVO":"OFFLINE")+'</span></div>'+
      '<div class="account-card"><div class="eyebrow">TWITCH VINCULADA</div><div style="display:flex;gap:10px;align-items:center;margin-top:8px"><code style="flex:1;color:#9e7cff">'+esc(twitch||"Não configurada")+'</code><button id="change-twitch" class="btn">Alterar Twitch</button></div><div id="twitch-change"></div></div>'+
      '<a class="continue-card" href="/config-live"><b>⚙ Configurar live</b><span>→</span></a>';
    $("#change-twitch").onclick=()=>{
      $("#twitch-change").innerHTML='<div class="profile-edit"><input id="new-twitch" class="form-control" placeholder="https://www.twitch.tv/seucanal"><div class="profile-actions"><button id="send-twitch-link" class="btn primary">Enviar confirmação por e-mail</button></div><div id="twitch-msg"></div></div>';
      $("#send-twitch-link").onclick=async()=>{
        const msg=$("#twitch-msg"),user=extractTwitchUser($("#new-twitch").value);
        if(!user){setMessage(msg,"Digite um link válido da Twitch.");return}
        if(!currentUser.email){setMessage(msg,"Sua conta não possui e-mail disponível.");return}
        const canonical="https://www.twitch.tv/"+user;
        localStorage.setItem("zytrixPendingTwitchURL",canonical);localStorage.setItem("zytrixPendingTwitchUid",currentUser.uid);localStorage.setItem("zytrixPendingTwitchEmail",currentUser.email);
        try{await sendSignInLinkToEmail(auth,currentUser.email,{url:location.origin+"/perfil",handleCodeInApp:true});setMessage(msg,"Enviamos um link de confirmação para "+currentUser.email+".","ok")}
        catch(e){console.error(e);setMessage(msg,e?.code==="auth/unauthorized-continue-uri"?"Autorize este domínio no Firebase Authentication.":"Não foi possível enviar o e-mail de confirmação.")}
      };
    };
  }else{
    area.innerHTML='<h3>Quer transmitir na Zytrix?</h3><p style="color:#7f8a9a;font-size:11px">Crie seu canal vinculando uma conta da Twitch.</p>'+
      '<div class="profile-edit"><input id="streamer-twitch" class="form-control" placeholder="https://www.twitch.tv/seucanal"><button id="create-streamer" class="btn primary">Criar conta de streamer</button><div id="streamer-msg"></div></div>';
    $("#create-streamer").onclick=async()=>{
      const msg=$("#streamer-msg"),tuser=extractTwitchUser($("#streamer-twitch").value);
      if(!tuser){setMessage(msg,"Digite um link válido da Twitch.");return}
      const canonical="https://www.twitch.tv/"+tuser;
      try{
        const channelRef=doc(db,"channels",currentUser.uid),channelSnap=await getDoc(channelRef);
        let existing=null;if(channelSnap.exists()){const sid=String(channelSnap.data().currentStreamId||"");if(sid){const ss=await getDoc(doc(db,"streams",sid));if(ss.exists())existing={id:ss.id,...ss.data()}}}
        if(!existing)existing=await findUserStream(currentUser.uid);
        const streamId=existing?.id||currentUser.uid,streamRef=doc(db,"streams",streamId),batch=writeBatch(db);
        if(!channelSnap.exists())batch.set(channelRef,{ownerUid:currentUser.uid,channelName:profile.username||"Streamer",description:profile.bio||"",avatarURL:profile.photoURL||"",bannerURL:"",categoryId:existing?.categoryId||"Just Chatting",isLive:existing?.status==="live",currentStreamId:streamId,createdAt:serverTimestamp()});
        else if(String(channelSnap.data().currentStreamId||"")!==streamId)batch.update(channelRef,{currentStreamId:streamId});
        if(!existing)batch.set(streamRef,{streamerUid:currentUser.uid,channelId:currentUser.uid,title:"Minha primeira live na Zytrix",description:"",categoryId:"Just Chatting",thumbnailURL:profile.photoURL||"",status:"offline",playbackURL:canonical,startedAt:null,endedAt:null,createdAt:serverTimestamp(),viewerCount:0});
        else batch.update(streamRef,{playbackURL:canonical});
        await batch.commit();setMessage(msg,"Conta de streamer criada com sucesso!","ok");setTimeout(()=>renderPerfil(),500);
      }catch(e){console.error(e);setMessage(msg,"Não foi possível transformar sua conta em streamer.")}
    };
  }
}

async function findConfigStream(uid){
  const ch=await getDoc(doc(db,"channels",uid));
  if(!ch.exists())throw new Error("Esta conta ainda não é uma conta de streamer.");
  let id=String(ch.data().currentStreamId||"");
  if(id){const ss=await getDoc(doc(db,"streams",id));if(!ss.exists())id=""}
  if(!id){const q=query(collection(db,"streams"),where("streamerUid","==",uid),limit(1)),r=await getDocs(q);if(r.empty)throw new Error("Seu canal existe, mas a configuração da live não foi encontrada.");id=r.docs[0].id}
  return id;
}
function splitCategory(v){
  const p=String(v||"").split(" - ");const main=CATEGORY_DATA[p[0]]?p[0]:"Gaming";return {main,sub:p.slice(1).join(" - ")};
}
async function renderConfigLive(){
  if(!requireAuthOrRedirect())return;
  pageTitle("Configurar live");
  $("#app").innerHTML='<div class="center-state">Carregando configurações...</div>';
  try{
    const id=await findConfigStream(currentUser.uid),ref=doc(db,"streams",id);
    const unsub=onSnapshot(ref,s=>{if(!s.exists()){$("#app").innerHTML='<div class="center-state">Configuração indisponível.</div>';return}drawConfig(id,{id:s.id,...s.data()})});
    pageCleanups.push(unsub);
  }catch(e){$("#app").innerHTML='<div class="center-state"><div><div class="state-icon">🎥</div><h2>Configuração indisponível</h2><small>'+esc(e.message)+'</small></div></div>'}
}
function drawConfig(id,stream){
  const cat=splitCategory(stream.categoryId),subs=CATEGORY_DATA[cat.main]||[],img=safeHttps(stream.thumbnailURL);
  $("#app").innerHTML='<section class="container config-page"><div class="config-layout"><div><div class="eyebrow">PAINEL DO STREAMER</div><h1 style="font-size:33px;margin:6px 0">Configurar live</h1><p style="color:#78879a">Prepare sua transmissão antes de entrar ao vivo.</p>'+
    '<div class="config-box"><div class="eyebrow">THUMBNAIL DA LIVE</div><div id="thumb-preview" class="thumb-preview" '+(img?'style="background-image:url(&quot;'+esc(img)+'&quot;);color:transparent"':"")+'>LIVE DE TESTE</div>'+
    '<input id="cfg-thumb" class="form-control" value="'+esc(stream.thumbnailURL||"")+'" placeholder="URL da imagem"><div class="form-group" style="margin-top:20px"><label>TÍTULO DA LIVE</label><input id="cfg-title" maxlength="120" class="form-control" value="'+esc(stream.title||"")+'"></div>'+
    '<div class="form-group" style="margin-top:20px"><label>DESCRIÇÃO</label><textarea id="cfg-desc" maxlength="500" class="form-control">'+esc(stream.description||"")+'</textarea></div>'+
    '<div class="category-selects" style="margin-top:20px"><div class="form-group"><label>CATEGORIA</label><select id="cfg-cat" class="form-control">'+Object.keys(CATEGORY_DATA).map(n=>'<option '+(n===cat.main?"selected":"")+'>'+esc(n)+'</option>').join("")+'</select></div>'+
    '<div class="form-group"><label>SUBCATEGORIA</label><select id="cfg-sub" class="form-control">'+subs.map(n=>'<option '+(n===cat.sub?"selected":"")+'>'+esc(n)+'</option>').join("")+'</select></div></div>'+
    '<button id="cfg-save" class="btn primary" style="width:100%;margin-top:18px">Salvar configurações</button><div id="cfg-msg"></div></div></div>'+
    '<aside><div class="config-box status-card"><div class="eyebrow">STATUS DA LIVE</div><div class="'+(stream.status==="live"?"status-live":"status-offline")+'">● '+(stream.status==="live"?"AO VIVO":"OFFLINE")+'</div>'+
    '<div class="account-row"><span>Espectadores</span><b>'+coins(stream.viewerCount)+'</b></div><div class="account-row"><span>Categoria</span><b>'+esc(stream.categoryId||"")+'</b></div>'+
    '<div style="margin:15px 0"><div class="eyebrow">TWITCH CONECTADA</div><div class="account-card"><code>'+esc(stream.playbackURL||"")+'</code></div></div>'+
    '<button id="cfg-status" class="btn '+(stream.status==="live"?"danger":"primary")+'" style="width:100%">'+(stream.status==="live"?"■ Encerrar live":"● Iniciar live")+'</button></div></aside></div></section>';
  const catSel=$("#cfg-cat"),subSel=$("#cfg-sub"),thumb=$("#cfg-thumb");
  catSel.onchange=()=>{subSel.innerHTML=(CATEGORY_DATA[catSel.value]||[]).map(n=>'<option>'+esc(n)+'</option>').join("")};
  thumb.oninput=()=>{const v=safeHttps(thumb.value);$("#thumb-preview").style.backgroundImage=v?'url("'+v.replace(/"/g,"%22")+'")':"";$("#thumb-preview").style.color=v?"transparent":""};
  $("#cfg-save").onclick=async()=>{
    const msg=$("#cfg-msg"),title=$("#cfg-title").value.trim(),desc=$("#cfg-desc").value.trim(),sub=$("#cfg-sub").value;
    if(!title){setMessage(msg,"Digite um título para a live.");return}
    if(!sub){setMessage(msg,"Escolha uma subcategoria.");return}
    const categoryId=catSel.value+" - "+sub,batch=writeBatch(db);
    batch.update(doc(db,"streams",id),{title,description:desc,categoryId,thumbnailURL:thumb.value.trim()});
    batch.update(doc(db,"channels",currentUser.uid),{description:desc,categoryId,currentStreamId:id});
    try{await batch.commit();setMessage(msg,"Configurações salvas com sucesso.","ok")}catch(e){console.error(e);setMessage(msg,"Não foi possível salvar.")}
  };
  $("#cfg-status").onclick=async()=>{
    const msg=$("#cfg-msg"),going=stream.status!=="live";
    if(going&&!$("#cfg-sub").value){setMessage(msg,"Escolha e salve uma subcategoria antes de iniciar.");return}
    const batch=writeBatch(db);
    if(going){batch.update(doc(db,"streams",id),{status:"live",startedAt:serverTimestamp(),endedAt:null});batch.update(doc(db,"channels",currentUser.uid),{isLive:true,currentStreamId:id})}
    else{batch.update(doc(db,"streams",id),{status:"offline",endedAt:serverTimestamp()});batch.update(doc(db,"channels",currentUser.uid),{isLive:false,currentStreamId:id})}
    try{await batch.commit();setMessage(msg,going?"Você está ao vivo na Zytrix.":"Transmissão encerrada.","ok")}catch(e){console.error(e);setMessage(msg,"Não foi possível alterar o status.")}
  };
}

async function renderSair(){
  pageTitle("Sair");
  $("#app").innerHTML='<div class="center-state"><div><div class="state-icon">↪</div><h2>Saindo da conta...</h2></div></div>';
  try{await signOut(auth);$("#app").innerHTML='<div class="center-state"><div><div class="state-icon" style="color:#43db8d">✓</div><h2>Sessão encerrada</h2><small>Saindo da sua conta...</small><div class="sair-card"><a class="btn" href="/">Voltar para o início</a><a class="btn primary" href="/login">Entrar Novamente</a></div></div></div>'}
  catch{$("#app").innerHTML='<div class="center-state">Não foi possível encerrar a sessão.</div>'}
}

function route(){
  cleanupPage();renderChrome();
  const p=location.pathname.replace(/\/+$/,"")||"/";
  if(p==="/")return renderHome();
  if(p==="/ao-vivo")return renderAoVivo();
  if(p==="/categorias")return renderCategorias();
  if(p.startsWith("/categoria/"))return renderCategoria();
  if(p==="/sobre")return renderSobre();
  if(p==="/login")return renderAuth("login");
  if(p==="/registro")return renderAuth("registro");
  if(p==="/recuperar-senha")return renderAuth("reset");
  if(p==="/live")return renderLive();
  if(p==="/loja")return renderLoja();
  if(p==="/pagamento")return renderPagamento();
  if(p==="/perfil")return renderPerfil();
  if(p==="/config-live")return renderConfigLive();
  if(p==="/sair")return renderSair();
  pageTitle("Não encontrada");
  $("#app").innerHTML='<div class="center-state"><div><div class="state-icon">404</div><h2>Página não encontrada</h2><a class="btn primary" href="/">Voltar ao início</a></div></div>';
}

onAuthStateChanged(auth,user=>{
  currentUser=user;
  route();
});
