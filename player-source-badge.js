/* VM RADIO — halo source : Rotation / Demande / Émission / Jingle */
(function(){
'use strict';
if(window.__VMRADIO_PLAYER_SOURCE_HALO_V1__)return;
window.__VMRADIO_PLAYER_SOURCE_HALO_V1__=true;

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

function cleanupOldBadges(){
  document.querySelectorAll('.vm-source-badge').forEach(el=>el.remove());
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
}

let currentInfo={kind:'rotation',label:'Rotation'};
let busy=false;

async function refresh(){
  applyHalo(currentInfo);
  if(busy)return;
  busy=true;
  try{
    const r=await fetch(ENGINE+'?_halo='+Date.now(),{cache:'no-store',credentials:'omit'});
    if(r.ok){
      currentInfo=classify(await r.json());
      applyHalo(currentInfo);
    }
  }catch(_){}
  finally{busy=false}
}

const start=()=>{
  ensureStyle();
  applyHalo(currentInfo);
  refresh();
  setInterval(refresh,REFRESH);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  window.addEventListener('vmradio:pagechange',()=>setTimeout(refresh,50));
  new MutationObserver(()=>applyHalo(currentInfo)).observe(document.body,{childList:true,subtree:true});
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
