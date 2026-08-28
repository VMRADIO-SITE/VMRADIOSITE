(() => {
  'use strict';

  const API='https://admin.vmradio.fr/api/public/top-titres';
  const VOTER_KEY='vmradioTopTitresVoterIdV3';
  const FALLBACK='./vm-radio-default-cover.jpeg';
  const TOP_LIMIT=5;
  let voteBusy=false;
  let votedId='';
  let refreshBusy=false;

  const clean=v=>String(v??'').trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
  const idOf=t=>slug(`${t.artist}-${t.title}`)||slug(t.title)||'titre';

  function voterId(){
    let id='';
    try{id=localStorage.getItem(VOTER_KEY)||''}catch{}
    if(id)return id;
    const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);
    id=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    try{localStorage.setItem(VOTER_KEY,id)}catch{}
    return id;
  }

  async function request(url,options={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      const r=await fetch(url,{cache:'no-store',mode:'cors',...options,signal:controller.signal});
      const d=await r.json().catch(()=>({}));
      return {r,d};
    }finally{clearTimeout(timer)}
  }

  function topBox(){return document.querySelector('[data-favorites]')}
  function renderTop(items){
    const box=topBox();if(!box)return;
    const rows=Array.isArray(items)?items.slice(0,TOP_LIMIT):[];
    if(!rows.length){
      box.innerHTML='<div class="hint">Appuyez sur le ❤️ du player pour ajouter vos titres préférés ici.</div>';
      return;
    }
    box.innerHTML=rows.map((x,i)=>`<div class="vm-top-title-row"><span class="vm-top-rank">${i+1}</span><img class="vm-top-cover" src="${esc(x.cover||FALLBACK)}" alt=""><div class="vm-top-info"><b>${esc(x.title||'Titre')}</b><span>${esc(x.artist||'Music IA By Valentin')}</span></div><strong class="vm-top-votes">♥ ${Number(x.votes||0)}</strong></div>`).join('');
  }

  async function refreshTop(){
    const box=topBox();if(!box||refreshBusy)return;
    refreshBusy=true;
    try{
      const u=new URL(API);u.searchParams.set('limit',String(TOP_LIMIT));u.searchParams.set('_',Date.now());
      const {r,d}=await request(u,{headers:{Accept:'application/json'}});
      if(!r.ok||d?.ok!==true)throw new Error(d?.error||`HTTP ${r.status}`);
      renderTop(d.items||[]);
    }catch(e){
      console.warn('[VM RADIO] Top Titres D1',e);
    }finally{refreshBusy=false}
  }

  function currentTrack(){
    const title=clean(document.querySelector('[data-current-title],#currentTitle,#title')?.textContent);
    const artist=clean(document.querySelector('[data-current-artist],#currentArtist,#artist')?.textContent)||'Music IA By Valentin';
    const image=document.querySelector('[data-current-cover],#currentCover,#cover');
    return {title,artist,cover:clean(image?.currentSrc||image?.src)||FALLBACK};
  }

  function heart(){return document.querySelector('[data-heart]')}
  function paintHeart(voted){
    const h=heart();if(!h)return;
    h.classList.toggle('liked',!!voted);h.classList.toggle('active',!!voted);
    h.setAttribute('aria-pressed',voted?'true':'false');
    h.title=voted?'Déjà dans tes J’aime':'Ajouter aux Top Titres';
  }

  async function refreshVoteStatus(){
    const h=heart();if(!h)return;
    const t=currentTrack();
    if(!t.title||/^chargement|vm radio$/i.test(t.title)){votedId='';paintHeart(false);return}
    const id=idOf(t);
    try{
      const u=new URL(API+'/vote-status');u.searchParams.set('voter_id',voterId());u.searchParams.set('track_id',id);u.searchParams.set('_',Date.now());
      const {r,d}=await request(u,{headers:{Accept:'application/json'}});
      const yes=r.ok&&d?.voted===true;votedId=yes?id:'';paintHeart(yes);
    }catch(e){votedId='';paintHeart(false);console.warn('[VM RADIO] état J’aime',e)}
  }

  async function vote(){
    if(voteBusy)return;
    const t=currentTrack();const id=idOf(t);
    if(!t.title||/^chargement|vm radio$/i.test(t.title))return;
    if(votedId===id){paintHeart(true);return}
    voteBusy=true;
    try{
      const {r,d}=await request(API+'/vote',{
        method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',Accept:'application/json'},
        body:JSON.stringify({title:t.title,artist:t.artist,cover:t.cover,voter_id:voterId()})
      });
      if(!r.ok||d?.ok!==true)throw new Error(d?.details||d?.error||`HTTP ${r.status}`);
      votedId=id;paintHeart(true);
      try{window.parent?.postMessage({type:'vmradio-top-titres-updated'},location.origin)}catch{}
      refreshTop();
    }catch(e){console.warn('[VM RADIO] vote Top Titres D1',e);paintHeart(false)}
    finally{voteBusy=false}
  }

  function bindHeart(){
    const h=heart();if(!h||h.dataset.vmD1Bound==='1')return;
    h.dataset.vmD1Bound='1';
    h.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();vote()},true);
    const title=document.querySelector('[data-current-title],#currentTitle,#title');
    if(title)new MutationObserver(()=>setTimeout(refreshVoteStatus,80)).observe(title,{childList:true,subtree:true,characterData:true});
    refreshVoteStatus();
  }

  function boot(){
    refreshTop();bindHeart();
    setInterval(refreshTop,30000);
    window.addEventListener('focus',()=>{refreshTop();refreshVoteStatus()});
    window.addEventListener('pageshow',()=>{refreshTop();refreshVoteStatus()});
    window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='vmradio-top-titres-updated')refreshTop()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshTop();refreshVoteStatus()}});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
