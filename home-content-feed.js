(()=>{
  'use strict';
  const API='https://admin.vmradio.fr/api/public/home-content';
  const POLL_MS=5000;
  let busy=false,last='';
  const norm=s=>String(s??'').replace(/\s+/g,' ').trim().toLowerCase();
  const all=()=>[...document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,strong,div')];
  const find=(test)=>all().find(el=>!el.children.length&&test(norm(el.textContent||'')))||null;
  function tag(){
    const one=(key,fn)=>{if(document.querySelector(`[data-vm-home="${key}"]`))return;const el=find(fn);if(el)el.dataset.vmHome=key;};
    one('artistTitle',t=>t==='music ia by valentin');
    one('artistSubtitle',t=>t.startsWith('des sons qui viennent du cœur')||t.startsWith('des sons qui viennent du coeur'));
    one('listenButtonText',t=>t.includes('écouter maintenant')||t.includes('ecouter maintenant'));
    one('releaseEyebrow',t=>t==='sortie prochaine');
    one('releaseTitle',t=>t.startsWith('nouveau titre'));
    one('preregisterButtonText',t=>t.includes('pré-enregistrer')||t.includes('pre-enregistrer'));
    const eye=document.querySelector('[data-vm-home="releaseEyebrow"]'),title=document.querySelector('[data-vm-home="releaseTitle"]'),pre=document.querySelector('[data-vm-home="preregisterButtonText"]');
    if(eye&&title&&pre&&!document.querySelector('[data-vm-home="releaseWrap"]')){
      let n=eye.parentElement;
      for(let i=0;n&&i<5;i++,n=n.parentElement){if(n.contains(title)&&n.contains(pre)){n.dataset.vmHome='releaseWrap';break}}
    }
  }
  function setText(key,value){const el=document.querySelector(`[data-vm-home="${key}"]`);if(el&&value!==undefined&&value!==null&&String(value).trim()!=='')el.textContent=String(value)}
  function setLink(key,value){const el=document.querySelector(`[data-vm-home="${key}"]`);if(!el||!value)return;const a=el.matches('a')?el:el.closest('a');if(a)a.href=String(value)}
  function apply(c){
    tag();
    setText('artistTitle',c.artistTitle);setText('artistSubtitle',c.artistSubtitle);setText('listenButtonText',c.listenButtonText);setText('releaseEyebrow',c.releaseEyebrow);setText('releaseTitle',c.releaseTitle);setText('preregisterButtonText',c.preregisterButtonText);
    setLink('listenButtonText',c.listenButtonUrl);setLink('preregisterButtonText',c.preregisterButtonUrl);
    const wrap=document.querySelector('[data-vm-home="releaseWrap"]');if(wrap)wrap.style.display=c.releaseVisible===false?'none':'';
  }
  async function refresh(force=false){if(busy)return;busy=true;try{const r=await fetch(API+'?t='+Date.now(),{mode:'cors',cache:'no-store',headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok||!d.ok||!d.content)throw Error(d.error||'Contenu accueil indisponible');const sig=JSON.stringify(d.content);if(force||sig!==last){last=sig;apply(d.content)}}catch(e){console.warn('VM RADIO contenu accueil:',e)}finally{busy=false}}
  function start(){tag();refresh(true);const obs=new MutationObserver(()=>{tag();if(last)try{apply(JSON.parse(last))}catch{}});obs.observe(document.body,{childList:true,subtree:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});window.addEventListener('focus',()=>refresh(true));setInterval(()=>{if(!document.hidden)refresh(false)},POLL_MS)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
