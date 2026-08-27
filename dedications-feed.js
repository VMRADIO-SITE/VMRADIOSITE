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


  function deviceId() {
    const key = "vmradio_dedication_device_v1";
    try {
      const existing = localStorage.getItem(key) || "";
      if (/^ded_device_[A-Za-z0-9_-]{12,96}$/.test(existing)) return existing;
      const random = (crypto && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID().replace(/-/g, "")
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const value = "ded_device_" + Date.now().toString(36) + "_" + random.slice(0, 24);
      localStorage.setItem(key, value);
      return value;
    } catch (error) {
      return "ded_device_session_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 18);
    }
  }

  function clientId() {
    const random = (crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID().replace(/-/g, "")
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return "ded_client_" + Date.now().toString(36) + "_" + random.slice(0, 24);
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


  function renderLatest() {
    const list = document.getElementById("publishedDedicationsList");
    if (!list) return;
    const recent = rows.slice(0, 10);
    let html = '<div class="empty">Aucune dédicace pour le moment.</div>';

    if (recent.length) {
      html = recent.map(function (item) {
        let date = "";
        if (item.createdAt) {
          const value = new Date(item.createdAt);
          if (!Number.isNaN(value.getTime())) {
            date = value.toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            });
          }
        }
        return '<div class="recent-item recent-dedication">' +
          '<div class="recent-head recent-dedication-head"><b>💜 ' +
          escapeHtml(item.name) +
          (item.to ? " → " + escapeHtml(item.to) : "") +
          '</b><span class="recent-time">' + escapeHtml(date) + '</span></div>' +
          '<div class="recent-msg recent-dedication-message">' + escapeHtml(item.message) + '</div>' +
          (item.song ? '<div class="recent-dedication-song">🎵 ' + escapeHtml(item.song) + '</div>' : "") +
          '</div>';
      }).join("");
    }

    // Évite une boucle MutationObserver → render → mutation → render.
    if (list.dataset.vmCentralText === html) return;
    list.dataset.vmCentralText = html;
    list.innerHTML = html;
  }

  function formMessage(value) {
    const feedback = document.getElementById("dedicationFeedback");
    if (feedback) feedback.textContent = value;
  }

  async function submit(data) {
    const payload = Object.assign({}, data || {}, {
      clientId: clientId(),
      deviceId: deviceId(),
      source: String((data && data.source) || (APP_MODE ? "app" : "site"))
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 15000);
    try {
      const response = await fetch(API, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || ("API HTTP " + response.status));
      }
      await refresh();
      return result;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function bindForm() {
    const form = document.getElementById("dedicationForm");
    if (!form || form.dataset.vmDedicationCentralBound === "1") return;
    form.dataset.vmDedicationCentralBound = "1";
    const message = document.getElementById("dedMessage");
    const count = document.getElementById("charCount");
    const button = document.getElementById("dedicationSubmit");
    if (message && count) {
      count.textContent = String(message.value.length);
      message.addEventListener("input", function () {
        count.textContent = String(message.value.length);
      });
    }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const name = String(document.getElementById("dedName")?.value || "").trim();
      const to = String(document.getElementById("dedTo")?.value || "").trim();
      const text = String(message?.value || "").trim();
      if (!name || !text) {
        formMessage("Merci de remplir votre prénom / pseudo et votre message.");
        return;
      }
      if (text.length > 240) {
        formMessage("La dédicace est limitée à 240 caractères.");
        return;
      }
      if (button) {
        button.disabled = true;
        button.dataset.vmOriginalText = button.textContent || "";
        button.textContent = "ENVOI...";
      }
      formMessage("Envoi de votre dédicace…");
      try {
        await submit({ name: name, to: to, message: text, song: "" });
        form.reset();
        if (count) count.textContent = "0";
        formMessage("✓ Votre dédicace a bien été envoyée !");
      } catch (error) {
        console.error("VM RADIO — envoi de la dédicace", error);
        formMessage(error && error.name === "AbortError"
          ? "Le serveur met trop de temps à répondre. Réessaie dans un instant."
          : (error.message || "Impossible d’envoyer la dédicace."));
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.vmOriginalText || "♡ ENVOYER LA DÉDICACE";
        }
      }
    });
  }

  function render() {
    renderSite();
    if (APP_MODE) renderApp();
    renderLatest();
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
    bindForm();
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

  window.__vmradioCentralDedicationsFeed = { api: API, refresh: refresh, submit: submit, subscribe: subscribe, get: function () { return rows.slice(); } };
  if (!window.vmradioDedicacesCentral) window.vmradioDedicacesCentral = window.__vmradioCentralDedicationsFeed;

  function boot() {
    restore();
    bindForm();
    refresh();
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
