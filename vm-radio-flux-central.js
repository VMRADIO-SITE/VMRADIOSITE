/* VM RADIO — source unique moteur + flux v4 */
(function(){
  'use strict';

  const ENGINE='https://admin.vmradio.fr/api/radio/nowplaying';
  const STREAM='https://radio.vmradio.fr/radio.mp3';
  const DEFAULT_ARTIST='Music IA By Valentin';
  const REFRESH=5000;

  window.__VMRADIO_STREAM_URL__=STREAM;
  if(window.__VMRADIO_CENTRAL_V4__) return;
  window.__VMRADIO_CENTRAL_V4__=true;

  const first=(...v)=>v.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='')??'';
  const cap=v=>{const s=String(v??'').trim();return s?s.charAt(0).toLocaleUpperCase('fr-FR')+s.slice(1):''};
  const clock=v=>{if(!v)return'--:--';const d=typeof v==='number'?new Date(v*1000):new Date(v);return Number.isNaN(d.getTime())?'--:--':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})};

  function track(song,meta){
    if(!song||typeof song!=='object') return null;
    const title=first(song.title,song.name);
    if(!title) return null;
    const playlist=String(meta?.playlist||'').toLowerCase();
    return {
      id:String(first(song.id,song.track_id,title)),
      title:cap(title),
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
      if((el.getAttribute('src')||'')===v || el.dataset.vmPendingCover===v) return;
      el.dataset.vmPendingCover=v;
      const probe=new Image();
      probe.onload=()=>{
        if(el.dataset.vmPendingCover===v && (el.getAttribute('src')||'')!==v){
          el.setAttribute('src',v);
        }
        delete el.dataset.vmPendingCover;
      };
      probe.onerror=()=>{if(el.dataset.vmPendingCover===v)delete el.dataset.vmPendingCover};
      probe.src=v;
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
          title:current.title||'VM RADIO',artist:current.artist||DEFAULT_ARTIST,album:'VM RADIO',artwork:current.cover?[{src:current.cover}]:[]
        });
      }
    }catch(_){ }
  }

  async function refresh(){
    try{
      const d=await getEngine();
      render(
        track(d?.now_playing?.song,d?.now_playing),
        track(d?.playing_next?.song,d?.playing_next),
        (Array.isArray(d?.song_history)?d.song_history:[]).map(x=>track(x?.song,x)).filter(Boolean)
      );
    }catch(e){console.warn('VM RADIO moteur indisponible',e)}
  }

  function getAudio(){return document.getElementById('radioAudio')||document.querySelector('audio')}
  function getStatus(){return document.getElementById('statusText')||document.querySelector('[data-player-status]')}

  function forceStream(audio){
    if(!audio) return;
    audio.removeAttribute('crossorigin');
    try{audio.crossOrigin=null}catch(_){ }
    if((audio.getAttribute('src')||'')!==STREAM){
      audio.setAttribute('src',STREAM);
      audio.src=STREAM;
      audio.load();
    }
  }

  function syncPlayer(audio){
    if(!audio) return;
    const playing=!audio.paused&&!audio.ended;
    const path=document.getElementById('playPausePath');
    if(path)path.setAttribute('d',playing?'M7 5h4v14H7zm6 0h4v14h-4z':'M8 5.2v13.6L19 12 8 5.2z');
    document.querySelectorAll('#playBtn,.play-btn,[data-play-player]').forEach(btn=>btn.setAttribute('aria-label',playing?'Mettre en pause':'Écouter VM RADIO'));
    const status=getStatus();
    if(status)status.textContent=playing?'EN DIRECT':'PRÊT À ÉCOUTER';
  }

  async function togglePlayer(e){
    const btn=e.target?.closest?.('#playBtn,.play-btn,[data-play-player]');
    if(!btn) return;
    const audio=getAudio();
    if(!audio) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(!audio.paused){
      audio.pause();
      syncPlayer(audio);
      return;
    }

    forceStream(audio);
    const status=getStatus();
    if(status)status.textContent='CONNEXION…';
    try{
      await audio.play();
      syncPlayer(audio);
    }catch(err){
      if(status)status.textContent='FLUX INDISPONIBLE';
      console.warn('VM RADIO lecture impossible',err);
    }
  }

  function initAudio(){
    const audio=getAudio();
    if(!audio) return;
    forceStream(audio);
    audio.preload='none';
    audio.addEventListener('play',()=>syncPlayer(audio));
    audio.addEventListener('playing',()=>syncPlayer(audio));
    audio.addEventListener('pause',()=>syncPlayer(audio));
    audio.addEventListener('error',()=>{const s=getStatus();if(s)s.textContent='FLUX INDISPONIBLE'});
    const volume=document.getElementById('volume');
    if(volume){audio.volume=Number(volume.value||0.85);volume.addEventListener('input',()=>{audio.volume=Number(volume.value)})}
    new MutationObserver(()=>{if((audio.getAttribute('src')||'')!==STREAM)forceStream(audio)}).observe(audio,{attributes:true,attributeFilter:['src','crossorigin']});
    window.VMRadioPlayer={play:async()=>{forceStream(audio);return audio.play()},pause:()=>audio.pause(),stream:STREAM};
    syncPlayer(audio);
  }

  document.addEventListener('click',togglePlayer,true);

  const init=()=>{initAudio();refresh()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  setInterval(refresh,REFRESH);
})();