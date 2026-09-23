const toggle=document.querySelector(".menu-toggle");
const nav=document.querySelector(".nav");

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

const dateInput=document.querySelector('input[type="date"]');
const today=new Date();
const local=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
dateInput.min=local;

const serviceSelect=document.querySelector("#service-select");
document.querySelectorAll(".service-pick").forEach(button=>{
  button.addEventListener("click",()=>{
    serviceSelect.value=button.dataset.service;
    document.querySelector("#agenda").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
    serviceSelect.focus({preventScroll:true});
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

  feedback.textContent=`Certo, ${nome}. Pedido anotado para ${dataFormatada}, às ${data.get("horario")}: ${data.get("servico")}.`;
});