const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const toggle=document.querySelector(".menu-toggle");
const nav=document.querySelector(".nav");
const header=document.querySelector(".site-header");

function closeMenu(){
  nav.classList.remove("open");
  toggle.setAttribute("aria-expanded","false");
  toggle.setAttribute("aria-label","Abrir menu");
}

toggle.addEventListener("click",()=>{
  const open=nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded",String(open));
  toggle.setAttribute("aria-label",open?"Fechar menu":"Abrir menu");
});

nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",closeMenu));

document.addEventListener("keydown",event=>{
  if(event.key==="Escape") closeMenu();
});

function syncHeader(){
  header.classList.toggle("is-scrolled",window.scrollY>18);
}
syncHeader();
window.addEventListener("scroll",syncHeader,{passive:true});

document.body.classList.add("motion-ready");
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  document.body.classList.add("motion-start");
}));

const revealGroups=[
  document.querySelector(".section-intro"),
  ...document.querySelectorAll(".service-row"),
  document.querySelector(".method-title"),
  ...document.querySelectorAll(".method-flow article"),
  document.querySelector(".booking-copy"),
  document.querySelector(".booking-form")
].filter(Boolean);

revealGroups.forEach((element,index)=>{
  element.classList.add("reveal");
  element.style.setProperty("--reveal-delay",`${Math.min(index%4,3)*55}ms`);
});

if(reduceMotion){
  revealGroups.forEach(element=>element.classList.add("is-visible"));
}else{
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  },{
    threshold:.14,
    rootMargin:"0px 0px -8% 0px"
  });

  revealGroups.forEach(element=>observer.observe(element));
}

const dateInput=document.querySelector('input[type="date"]');
const today=new Date();
const local=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
dateInput.min=local;

const serviceSelect=document.querySelector("#service-select");
const bookingForm=document.querySelector(".booking-form");

document.querySelectorAll(".service-pick").forEach(button=>{
  button.addEventListener("click",()=>{
    serviceSelect.value=button.dataset.service;
    document.querySelector("#agenda").scrollIntoView({behavior:reduceMotion?"auto":"smooth"});
    serviceSelect.focus({preventScroll:true});

    if(!reduceMotion){
      bookingForm.classList.add("is-highlighted");
      window.setTimeout(()=>bookingForm.classList.remove("is-highlighted"),420);
    }
  });
});

const form=document.querySelector("#booking-form");
const feedback=document.querySelector("#form-feedback");

form.addEventListener("submit",event=>{
  event.preventDefault();

  const data=new FormData(form);
  const nome=data.get("nome").trim().split(/\s+/)[0];
  const dia=new Date(data.get("dia")+"T12:00:00");
  const dataFormatada=dia.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});

  feedback.textContent="";
  requestAnimationFrame(()=>{
    feedback.textContent=`Certo, ${nome}. Pedido anotado para ${dataFormatada}, às ${data.get("horario")}: ${data.get("servico")}.`;
  });
});
