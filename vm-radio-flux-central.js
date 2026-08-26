/* VM RADIO — source unique moteur + flux */
(function(){
  'use strict';

  const ENGINE='https://admin.vmradio.fr/api/radio/nowplaying';
  const STREAM='https://radio.vmradio.fr/radio.mp3';
  const DEFAULT_ARTIST='Music IA By Valentin';
  const REFRESH=8000;

  window.__VMRADIO_STREAM_URL__=STREAM;
  if(window.__VMRADIO_CENTRAL_V3__) return;
  window.__VMRADIO_CENTRAL_V3__=true;

  const first=(...values)=>values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')??'';
  const titleCaseFirst=v=>{const s=String(v??'').trim();return s?s.charAt(0).toLocaleUpperCase('fr-FR')+s.slice(1):''};
  const clock=v=>{if(!v)return '--:--';const d=typeof v==='number'?new Date(v*1000):new Date(v);return Number.isNaN(d.getTime())?'--:--':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})};

  function track(song,meta){
    if(!song||typeof song!=='object') return null;
    const title=first(song.title,song.name);
    if(!title) return null;
    const playlist=String(meta?.playlist||'').toLowerCase();
    return {
      id:String(first(song.id,song.track_id,title)),
      title:titleCaseFirst(title),
      artist:String(first(song.artist,song.artist_name)||DEFAULT_ARTIST).trim(),
      cover:String(first(song.art,song.cover,song.cover_url,song.artwork,song.artwork_url)||''),
      time:first(meta?.played_at,meta?.started_at,meta?.time),
      type:meta?.is_request===true?'request':playlist.includes('jingle')?'jingle':'music'
    };
  }

  async function getEngine(){
    const r=await fetch(ENGINE+'?_='+Date.now(),{cache:'no-store',credentials:'omit'});
    if(!r.ok) throw new Error('VM RADIO API '+r.status);
    return r.json();
  }

  function setText(selector,value){
    const v=String(value??'');
    document.querySelectorAll(selector).forEach(el=>{if(el.textContent!==v)el.textContent=v});
  }

  function setImage(selector,value){
    if(!value) return;
    const v=String(value);
    document.querySelectorAll(selector).forEach(el=>{
      if(el.tagName!=='IMG') return;
      const current=el.getAttribute('src')||'';
      if(current!==v) el.setAttribute('src',v);
    });
  }

  function render(current,next,history){
    if(!current) return;
    setText('[data-current-title],#currentTitle,#title,#programCurrent,.current-title',current.title);
    setText('[data-current-artist],#currentArtist,#artist,.current-artist',current.artist);
    setText('[data-current-time],#broadcastTime,.current-time',clock(current.time));
    setImage('[data-current-cover],#currentCover,#cover,.current-cover,.cover-wrap img',current.cover);

    if(next){
      setText('[data-next-title],#nextTitle,#programNext,.next-title',next.title);
      setText('[data-next-artist],#nextArtist,.next-artist',next.artist);
      setText('[data-next-time],#nextTime,.next-time',clock(next.time));
      setImage('[data-next-cover],#nextCover,.next-cover,.next-card img',next.cover);
    }

    setText('[data-news-current]',current.title);
    setText('[data-news-current-artist]',current.artist);
    setText('[data-news-current-time]',clock(current.time));
    setImage('[data-news-current-cover]',current.cover);

    if(next){
      setText('[data-news-next]',next.title);
      setText('[data-news-next-artist]',next.artist);
      setText('[data-news-next-time]',clock(next.time));
      setImage('[data-news-next-cover]',next.cover);
    }

    const previous=(history||[]).filter(x=>x&&x.id!==current.id&&x.type==='music').slice(0,3);
    const last=previous[0];
    if(last){
      setText('[data-news-last]',last.title);
      setText('[data-news-last-artist]',last.artist);
      setText('[data-news-last-time]',clock(last.time));
      setImage('[data-news-last-cover]',last.cover);
    }

    try{
      if('mediaSession' in navigator){
        navigator.mediaSession.metadata=new MediaMetadata({
          title:current.title||'VM RADIO',
          artist:current.artist||DEFAULT_ARTIST,
          album:'VM RADIO',
          artwork:current.cover?[{src:current.cover}]:[]
        });
      }
    }catch(_){ }
  }

  async function refresh(){
    try{
      const d=await getEngine();
      const current=track(d?.now_playing?.song,d?.now_playing);
      const next=track(d?.playing_next?.song,d?.playing_next);
      const history=(Array.isArray(d?.song_history)?d.song_history:[]).map(x=>track(x?.song,x)).filter(Boolean);
      render(current,next,history);
    }catch(e){
      console.warn('VM RADIO moteur indisponible',e);
    }
  }

  function initPlayer(){
    const audio=document.getElementById('radioAudio')||document.querySelector('audio');
    const original=document.getElementById('playBtn')||document.querySelector('.play-btn,[data-play-player]');
    if(!audio||!original) return;

    // Supprime tous les anciens listeners directs du bouton (ancien player / RadioKing).
    const button=original.cloneNode(true);
    original.replaceWith(button);

    const iconPath=button.querySelector('#playPausePath')||document.getElementById('playPausePath');
    const status=document.getElementById('statusText')||document.querySelector('[data-player-status]');
    const volume=document.getElementById('volume');

    function forceStream(){
      if(audio.getAttribute('src')!==STREAM){
        audio.pause();
        audio.setAttribute('src',STREAM);
        audio.src=STREAM;
        audio.load();
      }
    }

    function sync(){
      const playing=!audio.paused&&!audio.ended;
      if(iconPath) iconPath.setAttribute('d',playing?'M7 5h4v14H7zm6 0h4v14h-4z':'M8 5.2v13.6L19 12 8 5.2z');
      button.setAttribute('aria-label',playing?'Mettre en pause':'Écouter VM RADIO');
      if(status) status.textContent=playing?'EN DIRECT':'PRÊT À ÉCOUTER';
    }

    forceStream();
    audio.preload='none';

    button.addEventListener('click',async e=>{
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if(!audio.paused){
        audio.pause();
        sync();
        return;
      }

      forceStream();
      if(status) status.textContent='CONNEXION…';
      try{
        await audio.play();
      }catch(err){
        if(status) status.textContent='FLUX INDISPONIBLE';
        console.warn('VM RADIO lecture impossible',err);
      }
      sync();
    },true);

    audio.addEventListener('play',sync);
    audio.addEventListener('playing',sync);
    audio.addEventListener('pause',sync);
    audio.addEventListener('error',()=>{if(status)status.textContent='FLUX INDISPONIBLE'});

    if(volume){
      audio.volume=Number(volume.value||0.85);
      volume.addEventListener('input',()=>{audio.volume=Number(volume.value)});
    }

    // Empêche un ancien script de remettre une autre URL après notre initialisation.
    new MutationObserver(()=>{
      if(audio.getAttribute('src')!==STREAM) forceStream();
    }).observe(audio,{attributes:true,attributeFilter:['src']});

    window.VMRadioPlayer={
      play:async()=>{forceStream();return audio.play()},
      pause:()=>audio.pause(),
      stream:STREAM
    };

    sync();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      initPlayer();
      refresh();
    },{once:true});
  }else{
    initPlayer();
    refresh();
  }

  setInterval(refresh,REFRESH);
})();