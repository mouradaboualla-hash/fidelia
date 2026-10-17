// Fidelia — funciones compartidas por todas las páginas
const SECTORES = {
  cafeteria:{n:"Cafetería",r:[["Café gratis",50],["Bollería gratis",80],["Desayuno completo",150]],col:"#6b3e26",unit:"1 punto por cada café"},
  restaurante:{n:"Restaurante / bar",r:[["Bebida gratis",60],["Postre gratis",100],["Menú para dos",400]],col:"#c0392b",unit:"1 punto por cada €"},
  panaderia:{n:"Panadería / pastelería",r:[["Barra de pan gratis",30],["Docena de croissants",120],["Tarta pequeña",250]],col:"#b7791f",unit:"1 punto por cada compra"},
  belleza:{n:"Peluquería / estética",r:[["Lavado y peinado",120],["Tratamiento capilar",200],["Corte gratis",300]],col:"#9b2c6f",unit:"1 punto por cada €"},
  moda:{n:"Moda y complementos",r:[["5 € de descuento",100],["Envío gratis",150],["15 € de descuento",300]],col:"#1d1d1f",unit:"1 punto por cada €"},
  deporte:{n:"Gimnasio / deporte",r:[["Batido proteico",80],["Clase gratis para un amigo",120],["Mes con 20 % menos",400]],col:"#0f766e",unit:"1 punto por cada visita"},
  salud:{n:"Farmacia / salud",r:[["Muestra de regalo",60],["5 € en parafarmacia",150],["Revisión gratuita",300]],col:"#15803d",unit:"1 punto por cada €"},
  servicios:{n:"Servicios / otros",r:[["5 % de descuento",100],["Servicio extra gratis",250],["10 % de descuento",400]],col:"#2b4cff",unit:"1 punto por cada €"}
};
const COLORES = ["#2b4cff","#0f766e","#15803d","#b7791f","#c0392b","#9b2c6f","#6b3e26","#1d1d1f","#e85d04","#0369a1"];

const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(t){let el=$("#toast");if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el)}el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2800)}
function inkFor(hex){const h=String(hex||"#2b4cff").replace("#","");const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return (r*299+g*587+b*114)/1000>150?"#151a17":"#ffffff"}
function lsGet(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function lsSet(k,v){try{v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
async function copiar(t){try{await navigator.clipboard.writeText(t);toast("Copiado")}catch(e){toast("Mantén pulsado para copiar")}}
async function api(ruta,{method="GET",body=null,headers={}}={}){
  const r=await fetch(ruta,{method,headers:{...(body?{"Content-Type":"application/json"}:{}),...headers},body:body?JSON.stringify(body):null});
  let d={};try{d=await r.json()}catch(e){}
  if(!r.ok)throw Object.assign(new Error(d.error||"No se pudo conectar. Revisa tu conexión."),{status:r.status});
  return d;
}
const logoSrc = u => !u ? "" : u.startsWith("data:") ? u : "/api/img?u="+encodeURIComponent(u);

// Pantalla de la app del cliente (se usa en la vista previa y en la app real)
function appHTML(t,{cliente=null,demo=false}={}){
  const color=t.color||"#2b4cff", ink=inkFor(color);
  const pts=cliente?cliente.puntos:(demo?65:0);
  const lista=[...(t.rewards||[])].map((r,i)=>({...r,i})).sort((a,b)=>a.p-b.p);
  const next=lista.find(r=>r.p>pts)||lista[lista.length-1];
  const pct=next?Math.min(100,Math.round(pts/next.p*100)):0;
  const nom=cliente?cliente.nombre.split(" ")[0]:(demo?"Laura":"");
  const logo=t.logo?`<img src="${esc(logoSrc(t.logo))}" alt="">`:esc((t.nombre||"?").charAt(0));
  const code=cliente?cliente.code:"DEMO42";
  const movs=(cliente&&cliente.movimientos||[]).filter(m=>m.puntos!==0).slice(0,5);
  return `<div style="--brand:${esc(color)};--brand-ink:${ink}">
    <div class="a-head"><div class="who"><div class="a-logo">${logo}</div><div><div class="a-name">${esc(t.nombre||"Tu tienda")}</div><div class="a-sub">Club de fidelización</div></div></div>
      <div class="a-hi">${nom?`Hola, ${esc(nom)}`:"Bienvenido al club"}</div></div>
    <div class="a-body">
      <div class="a-card"><div class="pts"><b>${pts}</b><span>puntos</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="a-small">${next?(pts>=next.p?`Ya puedes canjear: ${esc(next.t)}`:`Te faltan ${next.p-pts} para: ${esc(next.t)}`):"Pronto habrá recompensas"}</div></div>
      ${t.cupon?`<div class="a-card"><div class="coupon"><b>%</b><div><div class="a-t" style="margin:0">${esc(t.cupon)}</div><div class="a-small">Enséñalo en caja</div></div></div></div>`:""}
      <div class="a-card qrwrap"><p class="a-t">Tu tarjeta</p><div class="qr" data-qr="${esc(code)}"></div><div class="code">${esc(code)}</div><div class="a-small">Enseña este código en caja. ${esc(t.unidad||"")}</div></div>
      <div class="a-card"><p class="a-t">Recompensas</p>${lista.map(r=>`<div class="rew ${pts>=r.p?"ready":""}">${esc(r.t)}<span class="c">${r.p} pts</span></div>`).join("")}</div>
      ${movs.length?`<div class="a-card"><p class="a-t">Últimos movimientos</p>${movs.map(m=>`<div class="mov"><span>${esc(m.detalle||"")}</span><b style="color:${m.puntos>0?"#1f8a4c":"#151a17"}">${m.puntos>0?"+":""}${m.puntos}</b></div>`).join("")}</div>`:""}
    </div></div>`;
}
function drawQRs(scope=document,size=120){
  scope.querySelectorAll("[data-qr]").forEach(el=>{
    if(el.dataset.done===el.dataset.qr+size)return; el.innerHTML="";
    if(window.QRCode)new QRCode(el,{text:el.dataset.qr,width:size,height:size,colorDark:"#151a17",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
    el.dataset.done=el.dataset.qr+size;
  });
}
