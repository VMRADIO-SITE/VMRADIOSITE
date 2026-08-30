(()=>{
  'use strict';
  const API='https://admin.vmradio.fr/api/public/tiktok-videos';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderVideo(v){
    const title=esc(v.title||'Vidéo TikTok');
    if(v.type==='mp4')return `<article class="tiktok-video" data-admin-video="${Number(v.id)||0}"><div class="tiktok-player"><video controls playsinline preload="metadata" src="${esc(v.url)}" title="${title}"></video></div></article>`;
    return `<article class="tiktok-video" data-admin-video="${Number(v.id)||0}"><div class="tiktok-player"><iframe allow="autoplay; fullscreen" allowfullscreen loading="lazy" title="${title}" src="${esc(v.embedUrl||v.url)}"></iframe></div></article>`;
  }
  async function refresh(){
    const box=document.querySelector('.tiktok-videos');
    if(!box)return;
    try{
      const r=await fetch(API+'?v='+Date.now(),{cache:'no-store',mode:'cors'});
      const d=await r.json();
      if(!r.ok||!d.ok||!Array.isArray(d.videos))throw Error('Flux TikTok indisponible');
      if(d.videos.length)box.innerHTML=d.videos.map(renderVideo).join('');
      else box.innerHTML='<div class="tiktok-empty" style="grid-column:1/-1;text-align:center;color:#aaa5b4;padding:24px">Aucune vidéo publiée pour le moment.</div>';
    }catch(e){console.warn('VM RADIO TikTok Manager:',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  setInterval(()=>{if(!document.hidden)refresh()},60000);
})();
