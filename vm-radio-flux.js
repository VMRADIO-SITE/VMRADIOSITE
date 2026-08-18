/* VM RADIO — source unique du flux
   Ce fichier ne contient aucun CSS et ne modifie jamais la structure/design des pages. */
(function(){
  "use strict";

  const ENDPOINTS = {
    current: "https://api.radioking.io/widget/radio/vm-radio2/track/current",
    next: "https://api.radioking.io/widget/radio/vm-radio2/track/next?limit=1",
    history: "https://api.radioking.io/widget/radio/vm-radio2/track/ckoi?limit=3"
  };

  const DEFAULT_ARTIST = "Music IA By Valentin";
  const FALLBACK_COVER = "https://image.radioking.io/radios/917591/cover/custom/73962df6-7c51-4f8a-a9d0-801882271ca1.png";
  const REFRESH_MS = 10000;

  const first = (...v) => v.find(x => x !== undefined && x !== null && String(x).trim() !== "");

  function normalise(raw){
    let x = raw;
    if (Array.isArray(x)) x = x[0];
    if (!x || typeof x !== "object") return null;
    if (x.track) x = x.track;
    if (x.data && x.data.track) x = x.data.track;

    const title = first(x.title, x.name, x.song, x.track_title);
    if (!title) return null;

    return {
      id: String(first(x.id, x.track_id, title)),
      title: String(title).trim(),
      artist: String(first(x.artist, x.author, x.track_artist) || DEFAULT_ARTIST).trim(),
      cover: String(first(x.cover, x.cover_url, x.artwork, x.image, x.picture) || FALLBACK_COVER),
      time: first(x.started_at, x.start_at, x.played_at, x.scheduled_at, x.time) || null,
      type: String(x.type || "music").toLowerCase()
    };
  }

  async function json(url){
    const r = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
      cache: "no-store",
      credentials: "omit"
    });
    if (!r.ok) throw new Error("RadioKing " + r.status);
    return r.json();
  }

  function clock(v){
    if (!v) return "--:--";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "--:--" :
      d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
  }

  function text(selector, value){
    document.querySelectorAll(selector).forEach(el => {
      el.textContent = value == null ? "" : value;
    });
  }

  function image(selector, value){
    document.querySelectorAll(selector).forEach(el => {
      if (el.tagName !== "IMG") return;
      el.src = value || FALLBACK_COVER;
      el.onerror = () => { el.src = FALLBACK_COVER; };
    });
  }

  function ensureDownloadButton(){
    if (document.querySelector(".vm-download-app-wrap")) return;

    const nav = document.querySelector(".page > .nav");
    const programTitle = document.querySelector(".page > .program-title");
    if (!nav || !programTitle) return;

    const wrap = document.createElement("div");
    wrap.className = "vm-download-app-wrap";
    wrap.innerHTML = `
      <a class="vm-download-app-btn" href="https://app.vmradio.fr/" aria-label="Télécharger l'application VM RADIO">
        <span class="vm-download-app-icon" aria-hidden="true">▦</span>
        <span>Télécharger l’application VM RADIO</span>
      </a>
      <div class="vm-download-app-subtitle">Accéder au système officiel de téléchargement de l’application VM RADIO.</div>
    `;

    nav.insertAdjacentElement("afterend", wrap);

    if (!document.getElementById("vm-download-app-style")) {
      const style = document.createElement("style");
      style.id = "vm-download-app-style";
      style.textContent = `
        .vm-download-app-wrap{
          width:100%;
          margin:18px 0 0;
          text-align:center;
        }
        .vm-download-app-btn{
          width:min(975px,calc(100% - 70px));
          min-height:74px;
          margin:0 auto;
          padding:0 24px;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:12px;
          border:1px solid #b85cff;
          border-radius:17px;
          background:linear-gradient(100deg,#7722d0,#b23ff0);
          color:#fff;
          text-decoration:none;
          font-size:22px;
          font-weight:800;
          line-height:1.15;
          box-shadow:0 0 24px rgba(153,62,239,.28);
          transition:transform .15s ease,box-shadow .15s ease,filter .15s ease;
        }
        .vm-download-app-btn:hover{
          transform:translateY(-1px);
          filter:brightness(1.06);
          box-shadow:0 0 30px rgba(153,62,239,.40);
        }
        .vm-download-app-btn:active{transform:scale(.99)}
        .vm-download-app-icon{
          width:24px;
          height:24px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:#fff;
          font-size:24px;
          line-height:1;
          flex:0 0 24px;
        }
        .vm-download-app-subtitle{
          margin:9px auto 0;
          color:#bdb6c8;
          font-size:15px;
          line-height:1.4;
        }
        @media(max-width:700px){
          .vm-download-app-wrap{margin:14px 0 0}
          .vm-download-app-btn{
            width:100%;
            min-height:58px;
            padding:0 12px;
            border-radius:13px;
            gap:8px;
            font-size:16px;
          }
          .vm-download-app-icon{font-size:19px;width:20px;height:20px;flex-basis:20px}
          .vm-download-app-subtitle{font-size:10px;margin-top:7px}
        }
      `;
      document.head.appendChild(style);
    }
  }

  function render(data){
    ensureDownloadButton();

    const c = data.current;
    const n = data.next;
    if (!c) return;

    // CARTE EN DIRECT
    text("[data-current-title]", c.title);
    text("[data-current-artist]", c.artist);
    text("[data-current-time]", clock(c.time));
    image("[data-current-cover]", c.cover);

    // CARTE À SUIVRE
    if (n) {
      text("[data-next-title]", n.title);
      text("[data-next-artist]", n.artist);
      text("[data-next-time]", clock(n.time));
      image("[data-next-cover]", n.cover);
    }

    // CARTES À LA UNE / EN DIRECT
    text("[data-news-current]", c.title);
    text("[data-news-current-artist]", c.artist);
    text("[data-news-current-time]", clock(c.time));
    image("[data-news-current-cover]", c.cover);

    // CARTES À LA UNE / À SUIVRE
    if (n) {
      text("[data-news-next]", n.title);
      text("[data-news-next-artist]", n.artist);
      text("[data-news-next-time]", clock(n.time));
      image("[data-news-next-cover]", n.cover);
    }

    // DERNIER TITRE TERMINÉ : vient directement de l'historique RadioKing.
    const last = data.history.find(x => x.id !== c.id && x.type === "music") || null;
    if (last) {
      text("[data-news-last]", last.title);
      text("[data-news-last-artist]", last.artist);
      text("[data-news-last-time]", clock(last.time));
      image("[data-news-last-cover]", last.cover);
    }

    // MODULE "TITRES PRÉCÉDENTS" DE L'ACCUEIL.
    const previous = document.querySelector("[data-previous]");
    if (previous && Array.isArray(data.history)) {
      const tracks = data.history
        .filter(x => x.id !== c.id && x.type === "music")
        .slice(0,3);

      previous.innerHTML = "";
      tracks.forEach(x => {
        const row = document.createElement("div");
        row.className = "vm-programme-previous-item";
        row.innerHTML =
          '<img alt="">' +
          '<div class="previous-info">' +
          '<strong class="previous-title"></strong>' +
          '<small class="previous-artist"></small>' +
          '<em class="previous-time"></em>' +
          '</div>';

        const im = row.querySelector("img");
        im.src = x.cover || FALLBACK_COVER;
        im.onerror = () => { im.src = FALLBACK_COVER; };

        row.querySelector(".previous-title").textContent = x.title;
        row.querySelector(".previous-artist").textContent = x.artist;
        row.querySelector(".previous-time").textContent = clock(x.time);
        previous.appendChild(row);
      });
    }
  }

  async function update(){
    try {
      // Les 3 sources sont indépendantes : une panne de "next" ne casse pas "current".
      const [curRaw, nextRaw, historyRaw] = await Promise.allSettled([
        json(ENDPOINTS.current),
        json(ENDPOINTS.next),
        json(ENDPOINTS.history)
      ]);

      const current = curRaw.status === "fulfilled" ? normalise(curRaw.value) : null;
      if (!current) return;

      const next = nextRaw.status === "fulfilled"
        ? normalise(nextRaw.value)
        : null;

      let history = [];
      if (historyRaw.status === "fulfilled") {
        const arr = Array.isArray(historyRaw.value) ? historyRaw.value : [historyRaw.value];
        history = arr.map(normalise).filter(Boolean);
      }

      // Si le endpoint historique renvoie un titre publicitaire, on l'ignore.
      history = history.filter(x => x.type === "music");

      render({ current, next, history, updated: Date.now() });
    } catch (e) {
      console.warn("VM RADIO flux:", e);
      ensureDownloadButton();
    }
  }

  function init(){
    ensureDownloadButton();
    update();
    setInterval(update, REFRESH_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();