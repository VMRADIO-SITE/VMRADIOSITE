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

(()=>{
  'use strict';
  const API='https://admin.vmradio.fr/api/public/newsletter/subscribe';
  const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function findBlocks(){
    const blocks=[];
    document.querySelectorAll('.box.news .signup,.newsletter .news-form').forEach(el=>blocks.push(el));
    return blocks;
  }

  function ensureStatus(block){
    let status=block.parentElement?.querySelector('.vm-newsletter-status');
    if(status)return status;
    status=document.createElement('div');
    status.className='vm-newsletter-status';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    Object.assign(status.style,{marginTop:'8px',fontSize:'11px',fontWeight:'700',minHeight:'15px'});
    block.insertAdjacentElement('afterend',status);
    return status;
  }

  function setState(block,type,message){
    const status=ensureStatus(block);
    status.textContent=message||'';
    status.style.color=type==='error'?'#b42318':type==='success'?'#15803d':'#6b5b75';
  }

  async function submit(block){
    if(block.dataset.vmNewsletterBusy==='1')return;
    const input=block.querySelector('input[type="email"],input');
    const button=block.querySelector('button');
    const email=String(input?.value||'').trim().toLowerCase();

    if(!EMAIL_RE.test(email)){
      setState(block,'error','Entre une adresse e-mail valide.');
      input?.focus();
      return;
    }

    block.dataset.vmNewsletterBusy='1';
    const oldText=button?.textContent||'';
    if(button){button.disabled=true;button.textContent='Inscription…';}
    setState(block,'info','Inscription en cours…');

    try{
      const r=await fetch(API,{
        method:'POST',
        mode:'cors',
        cache:'no-store',
        credentials:'omit',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({email,source:'site'})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d?.ok===false)throw new Error(d?.error||'Impossible de vous inscrire pour le moment.');
      setState(block,'success',d?.alreadySubscribed?'Cette adresse est déjà inscrite à VM RADIO.':(d?.message||'Vous êtes bien inscrit à VM RADIO !'));
      if(!d?.alreadySubscribed&&input)input.value='';
    }catch(e){
      console.warn('VM RADIO newsletter:',e);
      setState(block,'error',e?.message||'Impossible de vous inscrire pour le moment.');
    }finally{
      block.dataset.vmNewsletterBusy='0';
      if(button){button.disabled=false;button.textContent=oldText||'S’inscrire →';}
    }
  }

  function bind(){
    findBlocks().forEach(block=>{
      if(block.dataset.vmNewsletterBound==='1')return;
      block.dataset.vmNewsletterBound='1';
      const button=block.querySelector('button');
      const input=block.querySelector('input[type="email"],input');
      if(block.tagName==='FORM'){
        block.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();submit(block);});
      }else if(button){
        button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();submit(block);});
      }
      input?.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          submit(block);
        }
      });
    });
  }

  function boot(){
    bind();
    const obs=new MutationObserver(bind);
    obs.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('vmradio:pagechange',()=>setTimeout(bind,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
