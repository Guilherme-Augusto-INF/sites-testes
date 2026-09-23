const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const header=document.querySelector(".topbar");
const menuButton=document.querySelector(".menu-toggle");
const mobileNav=document.querySelector(".mobile-nav");

function closeMenu(){
  mobileNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded","false");
  menuButton.setAttribute("aria-label","Abrir menu");
}

menuButton.addEventListener("click",()=>{
  const open=mobileNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded",String(open));
  menuButton.setAttribute("aria-label",open?"Fechar menu":"Abrir menu");
});

mobileNav.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});

function updateHeader(){
  header.classList.toggle("scrolled",window.scrollY>20);
}
updateHeader();
window.addEventListener("scroll",updateHeader,{passive:true});

const reveals=[...document.querySelectorAll(".reveal")];
reveals.forEach((el,i)=>el.style.setProperty("--delay",String(Math.min(i%4,3)*55)+"ms"));

if(reduceMotion){
  reveals.forEach(el=>el.classList.add("visible"));
}else{
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  },{threshold:.14,rootMargin:"0px 0px -8% 0px"});
  reveals.forEach(el=>observer.observe(el));
}

const serviceSelect=document.querySelector("#service-select");
const barberSelect=document.querySelector("#barber-select");
const dateInput=document.querySelector("#preferred-date");
const timeSelect=document.querySelector("#time-select");
const ticketService=document.querySelector("#ticket-service");
const ticketMeta=document.querySelector("#ticket-meta");
const ticketPrice=document.querySelector("#ticket-price");
const whatsapp=document.querySelector("#whatsapp-cta");

const now=new Date();
dateInput.min=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);

function selectedService(){
  const option=serviceSelect.options[serviceSelect.selectedIndex];
  return {name:option.value,price:option.dataset.price,duration:option.dataset.duration};
}

function updateTicket(){
  const service=selectedService();
  const barber=barberSelect.value;
  const date=dateInput.value
    ? new Date(dateInput.value+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})
    : "dia a combinar";
  const time=timeSelect.value||"horário a combinar";

  ticketService.textContent=service.name;
  ticketPrice.textContent=service.price;
  ticketMeta.textContent=barber+" · "+date+" · "+time+" · "+service.duration;

  const message=
    "Olá! Gostaria de pedir um horário na Barbearia Imperial.%0A%0A"+
    "Serviço: "+encodeURIComponent(service.name)+"%0A"+
    "Profissional: "+encodeURIComponent(barber)+"%0A"+
    "Data preferida: "+encodeURIComponent(date)+"%0A"+
    "Horário preferido: "+encodeURIComponent(time)+"%0A%0A"+
    "Aguardo a confirmação da equipe.";
  whatsapp.href="https://wa.me/?text="+message;
}

[serviceSelect,barberSelect,dateInput,timeSelect].forEach(el=>el.addEventListener("change",updateTicket));

document.querySelectorAll(".choose-service").forEach(button=>{
  button.addEventListener("click",()=>{
    const card=button.closest(".service");
    const target=[...serviceSelect.options].find(option=>option.value===card.dataset.service);
    if(!target)return;
    serviceSelect.value=target.value;
    updateTicket();
    document.querySelector("#agenda").scrollIntoView({behavior:reduceMotion?"auto":"smooth"});
    serviceSelect.focus({preventScroll:true});
  });
});

document.querySelectorAll(".choose-barber").forEach(button=>{
  button.addEventListener("click",()=>{
    const card=button.closest(".barber");
    barberSelect.value=card.dataset.barber;
    updateTicket();
    document.querySelector("#agenda").scrollIntoView({behavior:reduceMotion?"auto":"smooth"});
    barberSelect.focus({preventScroll:true});
  });
});

document.querySelectorAll("details").forEach(detail=>{
  detail.addEventListener("toggle",()=>{
    if(!detail.open)return;
    document.querySelectorAll("details").forEach(other=>{if(other!==detail)other.open=false});
  });
});

updateTicket();