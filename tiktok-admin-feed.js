(()=>{
  'use strict';
  const API='https://admin.vmradio.fr/api/public/tiktok-videos';
  const POLL_MS=3000;
  let busy=false;
  let lastSignature='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function renderVideo(v){
    const id=Number(v.id)||0;
    const title=esc(v.title||'Vidéo VM RADIO');
    if(v.type==='mp4')return `<article class="tiktok-video vm-local-video" data-admin-video="${id}"><div class="tiktok-player"><video controls playsinline preload="metadata" src="${esc(v.url)}" title="${title}" style="width:100%;height:100%;object-fit:contain;background:#000;display:block"></video></div></article>`;
    return `<article class="tiktok-video" data-admin-video="${id}"><div class="tiktok-player"><iframe allow="autoplay; fullscreen" allowfullscreen loading="lazy" title="${title}" src="${esc(v.embedUrl||v.url)}"></iframe></div></article>`;
  }

  function signature(videos){return videos.map(v=>[Number(v.id)||0,Number(v.updatedAt)||0,String(v.url||''),String(v.embedUrl||''),String(v.type||'')].join('|')).join(';;')}
  function boxes(){return [...document.querySelectorAll('.tiktok-videos')]}

  function fitLocalVideos(root=document){
    root.querySelectorAll?.('.vm-local-video video').forEach(video=>{
      const apply=()=>{
        const w=Number(video.videoWidth)||1;
        const h=Number(video.videoHeight)||1;
        const player=video.closest('.tiktok-player');
        if(!player)return;
        player.style.aspectRatio=`${w} / ${h}`;
        player.style.height='auto';
        player.style.maxWidth=w===h?'520px':'560px';
        video.style.objectFit='contain';
      };
      if(video.readyState>=1)apply();
      else video.addEventListener('loadedmetadata',apply,{once:true});
    });
  }

  function render(videos){
    const html=videos.length?videos.map(renderVideo).join(''):'<div class="tiktok-empty" style="grid-column:1/-1;text-align:center;color:#aaa5b4;padding:24px">Aucune vidéo publiée pour le moment.</div>';
    boxes().forEach(box=>{box.innerHTML=html;box.dataset.vmTikTokManaged='1';fitLocalVideos(box)});
  }

  async function refresh(force=false){
    if(busy||!boxes().length)return;
    busy=true;
    try{
      const r=await fetch(API+'?nocache='+Date.now(),{method:'GET',mode:'cors',cache:'no-store',headers:{'Accept':'application/json'}});
      const d=await r.json();
      if(!r.ok||!d.ok||!Array.isArray(d.videos))throw Error('Flux TikTok indisponible');
      const sig=signature(d.videos);
      if(force||sig!==lastSignature||boxes().some(x=>x.dataset.vmTikTokManaged!=='1')){lastSignature=sig;render(d.videos)}
    }catch(e){console.warn('VM RADIO TikTok Manager:',e)}finally{busy=false}
  }

  function start(){
    refresh(true);
    const observer=new MutationObserver(()=>{if(boxes().some(x=>x.dataset.vmTikTokManaged!=='1'))refresh(true)});
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
    window.addEventListener('focus',()=>refresh(true));
    setInterval(()=>{if(!document.hidden)refresh(false)},POLL_MS);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
