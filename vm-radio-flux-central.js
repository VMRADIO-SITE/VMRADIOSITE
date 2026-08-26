/* VM RADIO — moteur, métadonnées et flux audio uniques */
(function(){
"use strict";
const ENGINE="https://admin.vmradio.fr/api/radio/nowplaying";
const STREAM="https://radio.vmradio.fr/radio.mp3";
const DEFAULT_ARTIST="Music IA By Valentin";
const REFRESH=8000;
window.__VMRADIO_STREAM_URL__=STREAM;

function first(){for(let i=0;i<arguments.length;i++){const v=arguments[i];if(v!==undefined&&v!==null&&String(v).trim()!=="")return v}return ""}
function titleCaseFirst(v){const s=String(v??"").trim();return s?s.charAt(0).toLocaleUpperCase("fr-FR")+s.slice(1):""}
function engineTrack(song,meta){if(!song||typeof song!=="object")return null;const title=first(song.title,song.name);if(!title)return null;const playlist=String(meta?.playlist||"").toLowerCase();const request=meta?.is_request===true;const type=request?"request":playlist.includes("jingle")?"jingle":"music";return{id:String(first(song.id,song.track_id,title)),title:titleCaseFirst(title),artist:String(first(song.artist,song.artist_name)||DEFAULT_ARTIST).trim(),cover:String(first(song.art,song.cover,song.cover_url,song.artwork,song.artwork_url)||""),time:first(meta?.played_at,meta?.started_at,meta?.time),type}}
async function get(url){const r=await fetch(url+(url.includes("?")?"&":"?")+"_="+Date.now(),{cache:"no-store",credentials:"omit"});if(!r.ok)throw Error("VM RADIO API "+r.status);return r.json()}
function clock(v){if(!v)return"--:--";const d=typeof v==="number"?new Date(v*1000):new Date(v);return Number.isNaN(d.getTime())?"--:--":d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
function text(sel,v){document.querySelectorAll(sel).forEach(e=>e.textContent=String(v??""))}
function image(sel,v){document.querySelectorAll(sel).forEach(e=>{if(e.tagName!=="IMG"||!v)return;e.src=v})}

function enforceAudioStream(){document.querySelectorAll("audio").forEach(a=>{let current="";try{current=a.currentSrc||a.src||""}catch{}if(current===STREAM)return;const wasPlaying=!a.paused&&!a.ended;try{a.src=STREAM;a.setAttribute("src",STREAM);a.load();if(wasPlaying)a.play().catch(()=>{})}catch(e){console.warn("VM RADIO flux audio:",e)}})}
function startAudioGuard(){const run=()=>enforceAudioStream();if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();document.addEventListener("play",run,true);const root=document.documentElement||document;if(root&&window.MutationObserver){new MutationObserver(ms=>{if(ms.some(m=>m.target?.tagName==="AUDIO"||Array.from(m.addedNodes||[]).some(n=>n?.tagName==="AUDIO")))run()}).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["src"]})}}

function mediaSession(c){try{if(!("mediaSession" in navigator)||!c)return;navigator.mediaSession.metadata=new MediaMetadata({title:c.title||"VM RADIO",artist:c.artist||DEFAULT_ARTIST,album:"VM RADIO",artwork:c.cover?[{src:c.cover}]:[]})}catch{}}

function render(c,n,h){if(!c)return;text("[data-current-title],#currentTitle,#title,#programCurrent,.current-title",c.title);text("[data-current-artist],#currentArtist,#artist,.current-artist",c.artist);text("[data-current-time],#broadcastTime,.current-time",clock(c.time));image("[data-current-cover],#currentCover,#cover,.current-cover,.cover-wrap img",c.cover);if(n){text("[data-next-title],#nextTitle,#programNext,.next-title",n.title);text("[data-next-artist],#nextArtist,.next-artist",n.artist);text("[data-next-time],#nextTime,.next-time",clock(n.time));image("[data-next-cover],#nextCover,.next-cover,.next-card img",n.cover)}text("[data-news-current]",c.title);text("[data-news-current-artist]",c.artist);text("[data-news-current-time]",clock(c.time));image("[data-news-current-cover]",c.cover);if(n){text("[data-news-next]",n.title);text("[data-news-next-artist]",n.artist);text("[data-news-next-time]",clock(n.time));image("[data-news-next-cover]",n.cover)}const musicHistory=(h||[]).filter(x=>x&&x.id!==c.id&&x.type==="music").slice(0,3);const last=musicHistory[0];if(last){text("[data-news-last]",last.title);text("[data-news-last-artist]",last.artist);text("[data-news-last-time]",clock(last.time));image("[data-news-last-cover]",last.cover)}document.querySelectorAll("[data-previous]").forEach(box=>{if(!musicHistory.length)return;box.innerHTML="";musicHistory.forEach(x=>{const row=document.createElement("div");row.className="vm-programme-previous-item";row.innerHTML='<img alt=""><div class="previous-info"><strong class="previous-title"></strong><small class="previous-artist"></small><em class="previous-time"></em></div>';const im=row.querySelector("img");if(x.cover)im.src=x.cover;row.querySelector(".previous-title").textContent=x.title;row.querySelector(".previous-artist").textContent=x.artist||DEFAULT_ARTIST;row.querySelector(".previous-time").textContent=x.time?"Diffusé à "+clock(x.time):"";box.appendChild(row)})});mediaSession(c);enforceAudioStream()}

async function update(){try{const d=await get(ENGINE);const c=engineTrack(d?.now_playing?.song,d?.now_playing);if(!c)throw Error("État moteur incomplet");const n=engineTrack(d?.playing_next?.song,d?.playing_next);const h=(Array.isArray(d?.song_history)?d.song_history:[]).map(x=>engineTrack(x?.song,x)).filter(Boolean);render(c,n,h)}catch(e){console.warn("VM RADIO moteur indisponible",e)}}

startAudioGuard();
if(!window.__VMRADIO_ENGINE_SYNC_ACTIVE__){window.__VMRADIO_ENGINE_SYNC_ACTIVE__=true;update();setInterval(update,REFRESH)}
})();