const toggle=document.querySelector(".menu-toggle");
const nav=document.querySelector(".nav");
toggle.addEventListener("click",()=>{
  const open=nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded",String(open));
  toggle.textContent=open?"Fechar":"Menu";
});
nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>{
  nav.classList.remove("open");
  toggle.setAttribute("aria-expanded","false");
  toggle.textContent="Menu";
}));
const dateInput=document.querySelector('input[type="date"]');
const today=new Date();
const local=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
dateInput.min=local;
const form=document.querySelector("#booking-form");
const feedback=document.querySelector("#form-feedback");
form.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(form);
  const nome=data.get("nome").trim().split(" ")[0];
  const dia=new Date(data.get("dia")+"T12:00:00");
  const dataFormatada=dia.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
  feedback.textContent=`Pedido anotado, ${nome}: ${data.get("servico")} em ${dataFormatada} às ${data.get("horario")}.`;
});