(function () {
  "use strict";

  if (window.__vmradioCentralDedicationsFeed) return;

  const APP_MODE = false;
  const API = "https://admin.vmradio.fr/api/dedications";
  const STORAGE_KEY = "vmradio_dedications_central_v1";
  const CHANNEL_NAME = "vmradio-dedications";
  const POLL_MS = 3000;
  const subscribers = new Set();
  let rows = [];
  let timer = 0;
  let channel = null;
  let publishingRemote = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function normalize(items) {
    return (Array.isArray(items) ? items : [])
      .filter(function (item) {
        return item && String(item.name || "").trim() && String(item.message || "").trim();
      })
      .map(function (item) {
        return {
          id: String(item.id || item.clientId || ""),
          name: String(item.name || "").trim(),
          to: String(item.to || "").trim(),
          message: String(item.message || "").trim(),
          song: String(item.song || item.title || "").trim(),
          createdAt: item.createdAt || item.date || null
        };
      })
      .sort(function (left, right) {
        return (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0);
      })
      .slice(0, 50);
  }

  function messageHtml(item, app) {
    return (app ? "♡ " : "💜 ") +
      escapeHtml(item.name) +
      (item.to ? " → " + escapeHtml(item.to) : "") +
      " : " + escapeHtml(item.message) +
      (item.song ? " 🎵 " + escapeHtml(item.song) : "");
  }

  function injectAppStyles() {
    if (!APP_MODE || document.getElementById("vm-central-dedications-style")) return;
    const style = document.createElement("style");
    style.id = "vm-central-dedications-style";
    style.textContent = "#vmSharedDedicationBar{position:fixed!important;top:0!important;left:50%!important;transform:translateX(-50%)!important;width:min(100%,520px)!important;height:38px!important;z-index:99998!important;display:flex!important;align-items:center!important;overflow:hidden!important;background:#170d20!important;border-bottom:1px solid rgba(190,105,255,.28)!important;border-radius:0 0 14px 14px!important}#vmSharedDedicationBar .vmDedLabel{flex:none;height:100%;display:flex;align-items:center;padding:0 10px;background:#2b153d;color:#fff;font:800 10px Arial,sans-serif;letter-spacing:.8px;z-index:2}#vmSharedDedicationBar .vmDedWindow{position:relative;flex:1;min-width:0;height:100%;overflow:hidden}#vmSharedDedicationBar .vmDedTrack{position:absolute;left:0;top:0;height:100%;display:flex;align-items:center;width:max-content;white-space:nowrap;will-change:transform}#vmSharedDedicationBar .vmDedText{display:block;flex:none;color:#fff;font:12px/38px Arial,sans-serif;white-space:nowrap;padding-right:40px}body{padding-top:38px!important}";
    document.head.appendChild(style);
  }

  function ensureAppBanner() {
    if (!APP_MODE) return null;
    injectAppStyles();
    let banner = document.getElementById("vmSharedDedicationBar");
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "vmSharedDedicationBar";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Dédicaces des auditeurs");
    banner.innerHTML = '<div class="vmDedLabel">DÉDICACES</div><div class="vmDedWindow"><div class="vmDedTrack"><span class="vmDedText"></span><span class="vmDedText"></span></div></div>';
    document.body.insertBefore(banner, document.body.firstChild);
    return banner;
  }

  function renderSite() {
    const html = rows.length
      ? rows.slice(0, 30).map(function (item) {
          return '<span class="vm-common-dedication-message">' + messageHtml(item, false) + "</span>";
        }).join("")
      : '<span class="vm-common-dedication-message">♡ Aucune dédicace pour le moment.</span>';

    document.querySelectorAll(".vm-common-dedication-track").forEach(function (track) {
      if (track.dataset.vmCentralText === html) return;
      track.dataset.vmCentralText = html;
      track.classList.remove("is-scrolling");
      track.innerHTML = html;
      void track.offsetWidth;
      if (rows.length) track.classList.add("is-scrolling");
    });
  }

  function renderApp() {
    const banner = ensureAppBanner();
    if (!banner) return;
    const html = rows.length
      ? rows.slice(0, 30).map(function (item) {
          return '<span class="vmDedItem">' + messageHtml(item, true) + "</span>";
        }).join('<span aria-hidden="true"> · </span>')
      : '<span class="vmDedItem">♡ Aucune dédicace pour le moment.</span>';
    const track = banner.querySelector(".vmDedTrack");
    if (!track || track.dataset.vmCentralText === html) return;
    track.dataset.vmCentralText = html;
    const texts = track ? track.querySelectorAll(".vmDedText") : [];
    texts.forEach(function (node) {
      node.innerHTML = html;
    });
  }

  function render() {
    renderSite();
    if (APP_MODE) renderApp();
  }

  function store(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {}
  }

  function publish(items, remote) {
    rows = normalize(items);
    store(rows);
    render();
    subscribers.forEach(function (subscriber) {
      try { subscriber(rows.slice()); } catch (error) { console.error(error); }
    });
    window.dispatchEvent(new CustomEvent("vmradio:dedications", { detail: rows.slice() }));
    if (!remote && channel) {
      try { channel.postMessage({ type: "rows", rows: rows }); } catch (error) {}
    }
  }

  function restore() {
    try {
      publish(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"), true);
    } catch (error) {
      publish([], true);
    }
  }

  async function refresh() {
    try {
      const response = await fetch(API + "?t=" + Date.now(), {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "HTTP " + response.status);
      publish(payload.data || payload.dedications || payload.items || [], false);
      return rows.slice();
    } catch (error) {
      console.warn("Synchronisation des dédicaces indisponible", error);
      render();
      return rows.slice();
    }
  }

  function subscribe(callback) {
    if (typeof callback !== "function") return function () {};
    subscribers.add(callback);
    callback(rows.slice());
    return function () { subscribers.delete(callback); };
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(async function tick() {
      await refresh();
      schedule();
    }, POLL_MS);
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", function (event) {
      if (event.data && event.data.type === "rows") publish(event.data.rows, true);
    });
  } catch (error) {}

  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { publish(JSON.parse(event.newValue), true); } catch (error) {}
  });
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  window.addEventListener("vmradio:pagechange", function () {
    render();
    refresh();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });

  new MutationObserver(function () { render(); }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.__vmradioCentralDedicationsFeed = { api: API, refresh: refresh, subscribe: subscribe, get: function () { return rows.slice(); } };
  if (!window.vmradioDedicacesCentral) window.vmradioDedicacesCentral = window.__vmradioCentralDedicationsFeed;

  function boot() {
    restore();
    refresh();
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
