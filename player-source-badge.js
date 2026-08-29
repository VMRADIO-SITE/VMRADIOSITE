/* VM RADIO — badge source du player : Rotation / Demande / Émission / Jingle */
(function(){
'use strict';
if(window.__VMRADIO_PLAYER_SOURCE_BADGE_V3__)return;
window.__VMRADIO_PLAYER_SOURCE_BADGE_V3__=true;
const ENGINE='https://admin.vmradio.fr/api/radio/nowplaying';
const REFRESH=1500;
const normalize=value=>{let s=String(value||'').trim();try{s=s.normalize('NFD')}catch{}return s.replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()};
const first=(...values)=>values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')??'';
function classify(data){
  const now=data?.now_playing||{},raw=data?.raw?.engine?.current||{};
  const playlist=String(first(raw?.scheduleName,raw?.playlist,now?.playlist,data?.playlist)||'').trim();
  const p=normalize(playlist),type=normalize(raw?.type);
  if(now?.is_request===true||type==='request')return{kind:'request',label:'Demande'};
  if(p.includes('jingle')||type.includes('jingle'))return{kind:'jingle',label:'Jingle'};
  const general=!p||['rotation','rotation generale','general rotation','default','music','musique','playlist'].includes(p)||p.includes('rotation generale');
  if(!general)return{kind:'emission',label:playlist||'Émission'};
  return{kind:'rotation',label:'Rotation'};
}
function ensureStyle(){
  if(document.getElementById('vm-player-source-badge-style'))return;
  const s=document.createElement('style');
  s.id='vm-player-source-badge-style';
  s.textContent=`
.vm-source-cover-host{position:relative!important;display:block!important;width:max-content!important;max-width:100%!important;line-height:0!important;overflow:visible!important}
.vm-source-cover-host.vm-source-wrap-auto{align-self:center!important;justify-self:center!important}
.vm-source-cover-host>img{display:block!important}
.vm-source-badge{position:absolute!important;right:7px!important;top:7px!important;z-index:2147483000!important;display:inline-flex!important;align-items:center!important;max-width:calc(100% - 14px)!important;min-height:23px!important;padding:5px 9px!important;border-radius:999px!important;font:800 10px/1 Arial,Helvetica,sans-serif!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:0 4px 14px rgba(0,0,0,.38)!important;pointer-events:none!important;border:1px solid rgba(255,255,255,.62)!important}
.vm-source-badge[data-kind="rotation"]{background:#f0e8ff!important;color:#6d28d9!important}
.vm-source-badge[data-kind="request"]{background:#fff1c7!important;color:#9a6500!important}
.vm-source-badge[data-kind="emission"]{background:#e5f8ec!important;color:#16803d!important}
.vm-source-badge[data-kind="jingle"]{background:#ffe4ed!important;color:#d62f5d!important}
@media(max-width:600px){.vm-source-badge{right:6px!important;top:6px!important;min-height:20px!important;padding:4px 7px!important;font-size:9px!important}}
`;
  document.head.appendChild(s);
}
function coverImages(){
  const selectors=['.cover-wrap img','#currentCover','#cover','img[data-current-cover]','img.current-cover','#programme-direct img.cover','#programme-direct img[data-current-cover]','.homepage-program-current img','.home-original-module .now img','.player-shell .cover-wrap img','.radio-player .cover-wrap img'];
  const out=[];
  for(const sel of selectors)document.querySelectorAll(sel).forEach(img=>{if(img?.tagName==='IMG'&&!out.includes(img))out.push(img)});
  return out;
}
function ensureHost(img){
  let parent=img.parentElement;
  if(!parent)return null;
  if(parent.classList.contains('vm-source-cover-host'))return parent;
  if(parent.classList.contains('cover-wrap')){parent.classList.add('vm-source-cover-host');return parent;}
  const wrap=document.createElement('span');
  wrap.className='vm-source-cover-host vm-source-wrap-auto';
  parent.insertBefore(wrap,img);
  wrap.appendChild(img);
  return wrap;
}
function applyBadge(info){
  ensureStyle();
  for(const img of coverImages()){
    const host=ensureHost(img);if(!host)continue;
    let badge=Array.from(host.children).find(el=>el.classList?.contains('vm-source-badge'));
    if(!badge){badge=document.createElement('span');badge.className='vm-source-badge';host.appendChild(badge)}
    badge.dataset.kind=info.kind;
    badge.textContent=info.label;
    badge.title=info.kind==='emission'?'Émission : '+info.label:info.label;
  }
}
let currentInfo={kind:'rotation',label:'Rotation'},busy=false;
async function refresh(){
  applyBadge(currentInfo);
  if(busy)return;busy=true;
  try{
    const r=await fetch(ENGINE+'?_badge='+Date.now(),{cache:'no-store',credentials:'omit'});
    if(r.ok){currentInfo=classify(await r.json());applyBadge(currentInfo)}
  }catch(_){}finally{busy=false}
}
const start=()=>{
  ensureStyle();applyBadge(currentInfo);refresh();setInterval(refresh,REFRESH);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  window.addEventListener('vmradio:pagechange',()=>setTimeout(refresh,50));
  new MutationObserver(()=>applyBadge(currentInfo)).observe(document.body,{childList:true,subtree:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
