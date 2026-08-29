/* VM RADIO — halo source : Rotation / Demande / Émission / Jingle */
(function(){
'use strict';
if(window.__VMRADIO_PLAYER_SOURCE_HALO_V2__)return;
window.__VMRADIO_PLAYER_SOURCE_HALO_V2__=true;

const ENGINE='https://admin.vmradio.fr/api/radio/nowplaying';
const REFRESH=1500;
const normalize=value=>{let s=String(value||'').trim();try{s=s.normalize('NFD')}catch{}return s.replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()};
const first=(...values)=>values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')??'';

function classify(data){
  const now=data?.now_playing||{};
  const raw=data?.raw?.engine?.current||{};
  const playlist=String(first(raw?.scheduleName,raw?.playlist,now?.playlist,data?.playlist)||'').trim();
  const p=normalize(playlist),type=normalize(raw?.type);
  if(now?.is_request===true||type==='request')return{kind:'request',label:'Demande'};
  if(p.includes('jingle')||type.includes('jingle'))return{kind:'jingle',label:'Jingle'};
  const general=!p||['rotation','rotation generale','general rotation','default','music','musique','playlist'].includes(p)||p.includes('rotation generale');
  if(!general)return{kind:'emission',label:playlist||'Émission'};
  return{kind:'rotation',label:'Rotation'};
}

function ensureStyle(){
  if(document.getElementById('vm-player-source-halo-style'))return;
  const s=document.createElement('style');
  s.id='vm-player-source-halo-style';
  s.textContent=`
img.vm-source-halo{
  position:relative!important;
  z-index:2!important;
  transition:box-shadow .35s ease,border-color .35s ease,filter .35s ease!important;
  border:2px solid var(--vm-source-color,#a855f7)!important;
  box-shadow:
    0 0 0 1px color-mix(in srgb,var(--vm-source-color,#a855f7) 62%,transparent),
    0 0 14px color-mix(in srgb,var(--vm-source-color,#a855f7) 72%,transparent),
    0 0 28px color-mix(in srgb,var(--vm-source-color,#a855f7) 48%,transparent)!important;
}
img.vm-source-halo[data-vm-source-kind="rotation"]{--vm-source-color:#a855f7}
img.vm-source-halo[data-vm-source-kind="request"]{--vm-source-color:#f5a524}
img.vm-source-halo[data-vm-source-kind="emission"]{--vm-source-color:#39d353}
img.vm-source-halo[data-vm-source-kind="jingle"]{--vm-source-color:#ec4899}
.vm-source-legend{
  width:100%!important;
  margin:14px 0 0!important;
  padding:8px 11px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  flex-wrap:wrap!important;
  gap:8px 14px!important;
  border:1px solid rgba(255,255,255,.10)!important;
  border-radius:999px!important;
  background:rgba(8,5,13,.58)!important;
  color:#bdb5c7!important;
  font:700 10px/1.2 Arial,Helvetica,sans-serif!important;
  box-sizing:border-box!important;
}
.vm-source-legend-item{display:inline-flex!important;align-items:center!important;gap:5px!important;white-space:nowrap!important;opacity:.72!important;transition:opacity .25s ease,transform .25s ease,color .25s ease!important}
.vm-source-legend-item::before{content:"";display:block;width:8px;height:8px;border-radius:50%;background:var(--legend-color);box-shadow:0 0 7px var(--legend-color)}
.vm-source-legend-item[data-kind="rotation"]{--legend-color:#a855f7}
.vm-source-legend-item[data-kind="request"]{--legend-color:#f5a524}
.vm-source-legend-item[data-kind="emission"]{--legend-color:#39d353}
.vm-source-legend-item[data-kind="jingle"]{--legend-color:#ec4899}
.vm-source-legend[data-active-kind="rotation"] .vm-source-legend-item[data-kind="rotation"],
.vm-source-legend[data-active-kind="request"] .vm-source-legend-item[data-kind="request"],
.vm-source-legend[data-active-kind="emission"] .vm-source-legend-item[data-kind="emission"],
.vm-source-legend[data-active-kind="jingle"] .vm-source-legend-item[data-kind="jingle"]{opacity:1!important;color:#fff!important;transform:scale(1.04)}
@media(max-width:600px){.vm-source-legend{margin-top:10px!important;padding:7px 8px!important;gap:6px 10px!important;font-size:8.5px!important;border-radius:16px!important}.vm-source-legend-item::before{width:7px;height:7px}}
@supports not (color:color-mix(in srgb,red,blue)){
  img.vm-source-halo[data-vm-source-kind="rotation"]{box-shadow:0 0 0 1px #a855f7,0 0 14px #a855f7,0 0 28px rgba(168,85,247,.55)!important}
  img.vm-source-halo[data-vm-source-kind="request"]{box-shadow:0 0 0 1px #f5a524,0 0 14px #f5a524,0 0 28px rgba(245,165,36,.55)!important}
  img.vm-source-halo[data-vm-source-kind="emission"]{box-shadow:0 0 0 1px #39d353,0 0 14px #39d353,0 0 28px rgba(57,211,83,.55)!important}
  img.vm-source-halo[data-vm-source-kind="jingle"]{box-shadow:0 0 0 1px #ec4899,0 0 14px #ec4899,0 0 28px rgba(236,72,153,.55)!important}
}
`;
  document.head.appendChild(s);
}

function currentCoverImages(){
  const selectors=[
    '.player-shell .cover-wrap img',
    '.radio-player .cover-wrap img',
    '#currentCover',
    '#cover',
    'img[data-current-cover]',
    'img.current-cover',
    '#programme-direct img.cover',
    '#programme-direct img[data-current-cover]',
    '.homepage-program-current img',
    '.home-original-module .now img'
  ];
  const out=[];
  for(const sel of selectors){
    document.querySelectorAll(sel).forEach(img=>{
      if(img?.tagName==='IMG'&&!out.includes(img))out.push(img);
    });
  }
  return out;
}

function legendTargets(){
  const selectors=['.player-shell','.radio-player','#programme-direct'];
  const out=[];
  for(const sel of selectors){
    document.querySelectorAll(sel).forEach(el=>{if(el&&!out.includes(el))out.push(el)});
  }
  return out;
}

function cleanupOldBadges(){document.querySelectorAll('.vm-source-badge').forEach(el=>el.remove())}

function ensureLegends(info){
  for(const target of legendTargets()){
    let legend=Array.from(target.children).find(el=>el.classList?.contains('vm-source-legend'));
    if(!legend){
      legend=document.createElement('div');
      legend.className='vm-source-legend';
      legend.setAttribute('aria-label','Signification des couleurs du halo');
      legend.innerHTML='<span class="vm-source-legend-item" data-kind="rotation">Rotation</span><span class="vm-source-legend-item" data-kind="request">Demande</span><span class="vm-source-legend-item" data-kind="emission">Émission</span><span class="vm-source-legend-item" data-kind="jingle">Jingle</span>';
      target.appendChild(legend);
    }
    legend.dataset.activeKind=info.kind;
  }
}

function applyHalo(info){
  ensureStyle();
  cleanupOldBadges();
  for(const img of currentCoverImages()){
    img.classList.add('vm-source-halo');
    img.dataset.vmSourceKind=info.kind;
    img.dataset.vmSourceLabel=info.label;
    img.title=info.kind==='emission'?'Émission : '+info.label:info.label;
  }
  ensureLegends(info);
}

let currentInfo={kind:'rotation',label:'Rotation'};
let busy=false;
async function refresh(){
  applyHalo(currentInfo);
  if(busy)return;
  busy=true;
  try{
    const r=await fetch(ENGINE+'?_halo='+Date.now(),{cache:'no-store',credentials:'omit'});
    if(r.ok){currentInfo=classify(await r.json());applyHalo(currentInfo)}
  }catch(_){}
  finally{busy=false}
}

const start=()=>{
  ensureStyle();applyHalo(currentInfo);refresh();setInterval(refresh,REFRESH);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  window.addEventListener('vmradio:pagechange',()=>setTimeout(refresh,50));
  new MutationObserver(()=>applyHalo(currentInfo)).observe(document.body,{childList:true,subtree:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
