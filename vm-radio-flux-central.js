/* VM RADIO — synchronisation unique du flux */
(function(){
"use strict";
const ENGINE="https://admin.vmradio.fr/api/radio/nowplaying";
const API={
 current:"https://api.radioking.io/widget/radio/vm-radio2/track/current",
 next:"https://api.radioking.io/widget/radio/vm-radio2/track/next?limit=1",
 history:"https://api.radioking.io/widget/radio/vm-radio2/track/ckoi?limit=3"
};
const DEFAULT_ARTIST="Music IA By Valentin";
const FALLBACK="https://image.radioking.io/radios/917591/cover/custom/73962df6-7c51-4f8a-a9d0-801882271ca1.png";
const REFRESH=10000;

function first(){for(let i=0;i<arguments.length;i++){let v=arguments[i];if(v!==undefined&&v!==null&&String(v).trim()!=="")return v}return ""}
function normal(raw){
 let x=Array.isArray(raw)?raw[0]:raw;
 if(!x)return null;
 if(x.track)x=x.track;
 if(x.data&&x.data.track)x=x.data.track;
 let title=first(x.title,x.name,x.song,x.track_title);
 if(!title)return null;
 return {
  id:String(first(x.id,x.track_id,title)),
  title:String(title).trim(),
  artist:String(first(x.artist,x.author,x.track_artist)||DEFAULT_ARTIST).trim(),
  cover:String(first(x.cover,x.cover_url,x.artwork,x.artwork_url,x.image,x.picture,x.art)||FALLBACK),
  time:first(x.started_at,x.start_at,x.played_at,x.scheduled_at,x.time),
  type:String(x.type||"music").toLowerCase()
 };
}
function engineTrack(song,meta){
 if(!song||typeof song!=="object")return null;
 const title=first(song.title,song.name);
 if(!title)return null;
 const playlist=String(meta?.playlist||"").toLowerCase();
 const request=meta?.is_request===true;
 const type=request?"request":playlist.includes("jingle")?"jingle":"music";
 return {
  id:String(first(song.id,song.track_id,title)),
  title:String(title).trim(),
  artist:String(first(song.artist,song.artist_name)||DEFAULT_ARTIST).trim(),
  cover:String(first(song.art,song.cover,song.cover_url,song.artwork,song.artwork_url)||FALLBACK),
  time:first(meta?.played_at,meta?.started_at,meta?.time),
  type
 };
}
async function get(url){
 const r=await fetch(url+(url.includes("?")?"&":"?")+"_="+Date.now(),{cache:"no-store",credentials:"omit"});
 if(!r.ok)throw Error("API "+r.status);
 return r.json();
}
function clock(v){
 if(!v)return "--:--";
 const d=typeof v==="number"?new Date(v*1000):new Date(v);
 return Number.isNaN(d.getTime())?"--:--":d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
}
function setText(selectors,v){document.querySelectorAll(selectors).forEach(e=>{e.textContent=String(v??"")})}
function setImg(selectors,v){document.querySelectorAll(selectors).forEach(e=>{if(e.tagName!=="IMG")return;e.src=v||FALLBACK;e.onerror=()=>{e.onerror=null;e.src=FALLBACK}})}
function render(c,n,h){
 if(!c)return;
 setText("[data-current-title],#currentTitle,.current-title",c.title);
 setText("[data-current-artist],#currentArtist,.current-artist",c.artist);
 setText("[data-current-time],#broadcastTime,.current-time",clock(c.time));
 setImg("[data-current-cover],#currentCover,.current-cover,.cover-wrap img",c.cover);
 if(n){
  setText("[data-next-title],#nextTitle,.next-title",n.title);
  setText("[data-next-artist],#nextArtist,.next-artist",n.artist);
  setText("[data-next-time],#nextTime,.next-time",clock(n.time));
  setImg("[data-next-cover],#nextCover,.next-cover,.next-card img",n.cover);
 }
 setText("[data-news-current]",c.title);
 setText("[data-news-current-artist]",c.artist);
 setText("[data-news-current-time]",clock(c.time));
 setImg("[data-news-current-cover]",c.cover);
 if(n){
  setText("[data-news-next]",n.title);
  setText("[data-news-next-artist]",n.artist);
  setText("[data-news-next-time]",clock(n.time));
  setImg("[data-news-next-cover]",n.cover);
 }
 const last=(h||[]).find(x=>x&&x.id!==c.id&&x.type==="music");
 if(last){
  setText("[data-news-last]",last.title);
  setText("[data-news-last-artist]",last.artist);
  setText("[data-news-last-time]",clock(last.time));
  setImg("[data-news-last-cover]",last.cover);
 }
 document.querySelectorAll("[data-previous]").forEach(box=>{
  const tracks=(h||[]).filter(x=>x&&x.id!==c.id&&x.type==="music").slice(0,3);
  if(!tracks.length)return;
  box.innerHTML="";
  tracks.forEach(x=>{
   const row=document.createElement("div");
   row.className="vm-programme-previous-item";
   row.innerHTML='<img alt=""><div class="previous-info"><strong class="previous-title"></strong><small class="previous-artist"></small><em class="previous-time"></em></div>';
   const im=row.querySelector("img");im.src=x.cover||FALLBACK;im.onerror=()=>{im.onerror=null;im.src=FALLBACK};
   row.querySelector(".previous-title").textContent=x.title;
   row.querySelector(".previous-artist").textContent=x.artist||DEFAULT_ARTIST;
   row.querySelector(".previous-time").textContent=x.time?"Diffusé à "+clock(x.time):"";
   box.appendChild(row);
  });
 });
}
async function updateFromEngine(){
 const d=await get(ENGINE);
 const c=engineTrack(d?.now_playing?.song,d?.now_playing);
 if(!c)throw Error("État moteur incomplet");
 const n=engineTrack(d?.playing_next?.song,d?.playing_next);
 const h=(Array.isArray(d?.song_history)?d.song_history:[]).map(x=>engineTrack(x?.song,x)).filter(Boolean);
 render(c,n,h);
}
async function updateFromRadioKing(){
 const results=await Promise.allSettled([get(API.current),get(API.next),get(API.history)]);
 const c=results[0].status==="fulfilled"?normal(results[0].value):null;
 if(!c)return;
 const n=results[1].status==="fulfilled"?normal(results[1].value):null;
 let h=[];
 if(results[2].status==="fulfilled"){
  const raw=Array.isArray(results[2].value)?results[2].value:[results[2].value];
  h=raw.map(normal).filter(Boolean);
 }
 render(c,n,h);
}
async function update(){
 try{await updateFromEngine()}
 catch(e){console.warn("VM RADIO engine indisponible, fallback RadioKing",e);await updateFromRadioKing()}
}
update();
setInterval(update,REFRESH);
})();