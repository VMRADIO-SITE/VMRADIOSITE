/* VM RADIO — système source propre pour player.html (PC + mobile) */
(function(){
'use strict';
if(window.__VMRADIO_SITE_SOURCE_CLEAN_V1__)return;
window.__VMRADIO_SITE_SOURCE_CLEAN_V1__=true;

const API='https://admin.vmradio.fr/api/radio/nowplaying';
const REFRESH=1500;
const normalize=value=>{let s=String(value||'').trim();try{s=s.normalize('NFD')}catch{}return s.replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()};
const first=(...values)=>values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')??'';

function classify(obj,raw){
  obj=obj||{};raw=raw||{};
  const playlist=String(first(raw.scheduleName,raw.playlist,obj.scheduleName,obj.playlist)||'').trim();
  const p=normalize(playlist),type=normalize(first(raw.type,obj.type));
  if(obj.is_request===true||type==='request')return{kind:'request',name:''};
  if(type.includes('jingle')||p.includes('jingle'))return{kind:'jingle',name:''};
  const general=!p||['rotation','rotation generale','general rotation','default','music','musique','playlist'].includes(p)||p.includes('rotation generale');
  if(!general)return{kind:'emission',name:playlist||'Émission'};
  return{kind:'rotation',name:''};
}

function ensureStyle(){
  if(document.getElementById('vm-site-source-clean-style'))return;
  const s=document.createElement('style');
  s.id='vm-site-source-clean-style';
  s.textContent=`
/* neutralise l'ancien halo violet du player */
.radio-player .cover-wrap{background:transparent!important;box-shadow:none!important;padding:0!important;overflow:visible!important;height:auto!important;display:flex!important;flex-direction:column!important;align-items:center!important}
.radio-player #currentCover,.radio-player #nextCover{filter:none!important;outline:none!important;box-shadow:none!important}

.vm-site-source-cover{border:2px solid var(--vm-source-color,#a855f7)!important;transition:border-color .35s ease,box-shadow .35s ease!important}
.vm-site-source-cover[data-source="rotation"]{--vm-source-color:#a855f7;box-shadow:0 0 0 1px #a855f7,0 0 14px #a855f7,0 0 28px rgba(168,85,247,.52)!important}
.vm-site-source-cover[data-source="request"]{--vm-source-color:#f5a524;box-shadow:0 0 0 1px #f5a524,0 0 14px #f5a524,0 0 28px rgba(245,165,36,.52)!important}
.vm-site-source-cover[data-source="emission"]{--vm-source-color:#22c55e;box-shadow:0 0 0 1px #22c55e,0 0 14px #22c55e,0 0 28px rgba(34,197,94,.52)!important}
.vm-site-source-cover[data-source="jingle"]{--vm-source-color:#ec4899;box-shadow:0 0 0 1px #ec4899,0 0 14px #ec4899,0 0 28px rgba(236,72,153,.52)!important}

.vm-site-emission-name{display:none;margin-top:8px;width:100%;max-width:150px;text-align:center;color:#55df78;font:800 10px/1.25 Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vm-site-emission-name.visible{display:block}
.vm-next-cover-wrap{width:88px;min-width:88px;display:flex;flex-direction:column;align-items:center;overflow:visible}
.vm-next-cover-wrap #nextCover{width:88px!important;height:88px!important}
.vm-next-cover-wrap .vm-site-emission-name{max-width:120px;font-size:9px}

#vmSiteSourceLegend{display:flex!important;align-items:center!important;justify-content:flex-start!important;flex-wrap:wrap!important;gap:6px 12px!important;margin:9px 0 0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;font:800 9px/1.2 Arial,sans-serif!important}
#vmSiteSourceLegend span{display:inline-flex!important;align-items:center!important;gap:4px!important;white-space:nowrap!important}
#vmSiteSourceLegend .rotation{color:#a855f7!important}#vmSiteSourceLegend .request{color:#f5a524!important}#vmSiteSourceLegend .emission{color:#22c55e!important}#vmSiteSourceLegend .jingle{color:#ec4899!important}

/* interdit les anciennes légendes */
.radio-player .vm-source-legend,.radio-player #vmIndexSourceLegend{display:none!important}

@media(max-width:700px){
  #vmSiteSourceLegend{justify-content:center!important;gap:5px 9px!important;font-size:8px!important}
  .vm-site-emission-name{font-size:9px!important;margin-top:6px!important}
}
`;
  document.head.appendChild(s);
}

function removeLegacyLegends(){document.querySelectorAll('.radio-player .vm-source-legend,.radio-player #vmIndexSourceLegend').forEach(el=>el.remove())}

function ensureLegend(){
  const controls=document.querySelector('.radio-player .controls');
  if(!controls)return null;
  let legend=document.getElementById('vmSiteSourceLegend');
  if(!legend){
    legend=document.createElement('div');
    legend.id='vmSiteSourceLegend';
    legend.innerHTML='<span class="rotation">● Rotation</span><span class="request">● Demande</span><span class="emission">● Émission</span><span class="jingle">● Jingle</span>';
    controls.insertAdjacentElement('afterend',legend);
  }
  return legend;
}

function ensureCurrentLabel(){
  const wrap=document.querySelector('.radio-player .cover-wrap');
  if(!wrap)return null;
  let label=document.getElementById('vmSiteCurrentEmission');
  if(!label){label=document.createElement('div');label.id='vmSiteCurrentEmission';label.className='vm-site-emission-name';wrap.appendChild(label)}
  return label;
}

function ensureNextWrap(){
  const img=document.getElementById('nextCover');
  if(!img)return null;
  let wrap=img.closest('.vm-next-cover-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.className='vm-next-cover-wrap';img.parentNode.insertBefore(wrap,img);wrap.appendChild(img)}
  let label=document.getElementById('vmSiteNextEmission');
  if(!label){label=document.createElement('div');label.id='vmSiteNextEmission';label.className='vm-site-emission-name';wrap.appendChild(label)}
  return label;
}

function paint(img,info){if(!img)return;img.classList.add('vm-site-source-cover');img.dataset.source=info.kind}
function showLabel(el,info){if(!el)return;if(info.kind==='emission'&&info.name){el.textContent=info.name;el.classList.add('visible')}else{el.textContent='';el.classList.remove('visible')}}

let busy=false;
async function refresh(){
  ensureStyle();removeLegacyLegends();ensureLegend();
  const currentLabel=ensureCurrentLabel();
  const nextLabel=ensureNextWrap();
  const currentCover=document.getElementById('currentCover');
  const nextCover=document.getElementById('nextCover');
  if(busy)return;busy=true;
  try{
    const r=await fetch(API+'?_siteSource='+Date.now(),{cache:'no-store',credentials:'omit'});
    if(!r.ok)return;
    const d=await r.json();
    const current=classify(d.now_playing,d.raw?.engine?.current);
    const next=classify(d.playing_next,d.raw?.engine?.next);
    paint(currentCover,current);paint(nextCover,next);
    showLabel(currentLabel,current);showLabel(nextLabel,next);
  }catch(_){}finally{busy=false}
}

function start(){
  ensureStyle();removeLegacyLegends();ensureLegend();ensureCurrentLabel();ensureNextWrap();
  const def={kind:'rotation',name:''};paint(document.getElementById('currentCover'),def);paint(document.getElementById('nextCover'),def);
  refresh();setInterval(refresh,REFRESH);
  new MutationObserver(()=>{removeLegacyLegends();ensureLegend()}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
