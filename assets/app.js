(function () {
  const cfg = window.SITE_CONFIG || {};
  const sessions = window.ATDW_SESSIONS || [];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }

  function slugify(value = "") {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function inlineMarkdown(text) {
    let safe = escapeHtml(text);
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return safe;
  }

  function renderMarkdown(md = "") {
    const lines = md.replace(/\r/g, "").split("\n");
    let html = "", paragraph = [], listType = null;
    const flushParagraph = () => {
      if (paragraph.length) { html += `<p>${inlineMarkdown(paragraph.join(" "))}</p>`; paragraph = []; }
    };
    const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { flushParagraph(); closeList(); continue; }
      if (/^---+$/.test(line.trim())) { flushParagraph(); closeList(); html += "<hr>"; continue; }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) { flushParagraph(); closeList(); const n = heading[1].length; html += `<h${n}>${inlineMarkdown(heading[2])}</h${n}>`; continue; }
      const quote = line.match(/^>\s?(.*)$/);
      if (quote) { flushParagraph(); closeList(); html += `<blockquote>${inlineMarkdown(quote[1])}</blockquote>`; continue; }
      const ul = line.match(/^[-*]\s+(.+)$/);
      const ol = line.match(/^\d+\.\s+(.+)$/);
      if (ul || ol) {
        flushParagraph();
        const wanted = ul ? "ul" : "ol";
        if (listType !== wanted) { closeList(); html += `<${wanted}>`; listType = wanted; }
        html += `<li>${inlineMarkdown((ul || ol)[1])}</li>`;
        continue;
      }
      closeList(); paragraph.push(line.trim());
    }
    flushParagraph(); closeList();
    return html;
  }

  function initAmbientAudio() {
    const toggle = document.getElementById("audio-toggle");
    if (!toggle || !cfg.ambientAudioUrl) return;

    const label = document.getElementById("audio-label");
    const credit = document.getElementById("audio-credit");
    const enabledKey = "atdwAmbientEnabled";
    const timeKey = "atdwAmbientTime";
    const audio = new Audio(cfg.ambientAudioUrl);
    audio.loop = true;
    audio.preload = "metadata";
    audio.volume = Number.isFinite(Number(cfg.ambientVolume)) ? Math.max(0, Math.min(1, Number(cfg.ambientVolume))) : 0.28;

    const readStore = (store, key) => { try { return store.getItem(key); } catch (_) { return null; } };
    const writeStore = (store, key, value) => { try { store.setItem(key, value); } catch (_) {} };

    let wanted = readStore(localStorage, enabledKey) === "true";
    let restored = false;

    function updateUi(state) {
      toggle.classList.toggle("is-on", state === "on");
      toggle.classList.toggle("needs-resume", state === "resume");
      toggle.setAttribute("aria-pressed", String(state === "on"));
      if (label) label.textContent = state === "on" ? "AMBIENCE ON" : state === "resume" ? "RESUME AUDIO" : "AMBIENCE OFF";
    }

    function restorePosition() {
      if (restored) return;
      restored = true;
      const saved = Number(readStore(sessionStorage, timeKey));
      if (Number.isFinite(saved) && saved > 0) {
        try { audio.currentTime = saved; } catch (_) {}
      }
    }

    async function startAudio() {
      wanted = true;
      writeStore(localStorage, enabledKey, "true");
      if (audio.readyState >= 1) restorePosition();
      try {
        await audio.play();
        updateUi("on");
      } catch (_) {
        updateUi("resume");
      }
    }

    function stopAudio() {
      wanted = false;
      writeStore(localStorage, enabledKey, "false");
      audio.pause();
      updateUi("off");
    }

    audio.addEventListener("loadedmetadata", restorePosition, { once: true });
    audio.addEventListener("play", () => updateUi("on"));
    audio.addEventListener("pause", () => { if (wanted) updateUi("resume"); });
    audio.addEventListener("error", () => {
      if (label) label.textContent = "AUDIO UNAVAILABLE";
      toggle.classList.remove("is-on", "needs-resume");
    });

    toggle.addEventListener("click", () => {
      if (!audio.paused || toggle.classList.contains("is-on")) stopAudio();
      else startAudio();
    });

    const savePosition = () => {
      if (Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
        writeStore(sessionStorage, timeKey, String(audio.currentTime));
      }
    };
    window.addEventListener("pagehide", savePosition);

    if (credit) {
      credit.href = cfg.ambientAudioSourceUrl || cfg.ambientAudioUrl;
      credit.textContent = cfg.ambientCreditLabel || "AMBIENCE // CC0 AUDIO";
      credit.title = [cfg.ambientAudioTitle, cfg.ambientAudioCreator, cfg.ambientAudioLicense].filter(Boolean).join(" — ");
    }

    if (wanted) {
      updateUi("resume");
      startAudio();
    } else {
      updateUi("off");
    }

    window.ATDW_AMBIENT_AUDIO = audio;
  }

  function resolveSession(identifier) {
    if (!identifier) return null;
    const raw = String(identifier);
    const exact = sessions.find(s => String(s.key) === raw);
    if (exact) return exact;

    // Backward compatibility for old links such as ?log=001. If several
    // Divers now have LOG 001, the newest matching record is used.
    return sessions.find(s => String(s.id) === raw) || null;
  }

  function buildDiverGroups() {
    const map = new Map();
    sessions.forEach(session => {
      const key = session.diver_slug || slugify(session.diver) || "diver";
      if (!map.has(key)) map.set(key, { key, name: session.diver || "UNASSIGNED DIVER", sessions: [] });
      map.get(key).sessions.push(session);
    });

    const groups = Array.from(map.values());
    groups.forEach(group => {
      group.sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
      group.latest = group.sessions[0];
      group.status = group.sessions.some(s => s.diver_status === "deceased") ? "deceased" : "active";
    });

    groups.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const dateSort = String(b.latest?.date || "").localeCompare(String(a.latest?.date || ""));
      return dateSort || a.name.localeCompare(b.name);
    });
    return groups;
  }

  let goatCounterInitialTracked = false;

  function goatCounterPathForSession(session) {
    if (!session) return "/";
    const titleSlug = slugify(session.title || session.source || session.id);
    return `/diver/${session.diver_slug || slugify(session.diver)}/log/${session.id}-${titleSlug}`;
  }

  function trackGoatCounter(path, title) {
    let attempts = 0;
    const send = () => {
      if (window.goatcounter && typeof window.goatcounter.count === "function") {
        window.goatcounter.count({ path, title });
        return;
      }
      attempts += 1;
      if (attempts < 50) window.setTimeout(send, 100);
    };
    send();
  }

  function trackCurrentView(session) {
    const path = session ? goatCounterPathForSession(session) : "/";
    const title = session ? `${session.diver} — Expedition ${session.id} — ${session.title}` : (cfg.archiveName || "Expedition Archive");
    trackGoatCounter(path, title);
  }

  function initStationCounter() {
    const value = document.getElementById("station-connections");
    const state = document.getElementById("station-network-state");
    if (!value || !cfg.goatCounterTotalUrl) return;

    fetch(cfg.goatCounterTotalUrl, { mode: "cors", cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error(`GoatCounter returned ${response.status}`);
        return response.json();
      })
      .then(data => {
        const raw = String(data.count ?? "").replace(/[^0-9]/g, "");
        value.textContent = raw ? raw.padStart(6, "0") : "000000";
        if (state) {
          state.textContent = "ACTIVE";
          state.classList.add("is-online");
          state.classList.remove("is-offline");
        }
      })
      .catch(() => {
        value.textContent = "------";
        if (state) {
          state.textContent = "OFFLINE";
          state.classList.add("is-offline");
          state.classList.remove("is-online");
        }
      });
  }

  function bindConfig() {
    document.querySelectorAll("[data-config]").forEach(el => {
      const key = el.dataset.config;
      if (cfg[key] != null) el.textContent = cfg[key];
    });
    document.querySelectorAll("[data-official-url]").forEach(el => el.href = cfg.officialUrl || "#");
  }

  function renderLogCard(session) {
    return `
      <a class="log-card" data-session-key="${escapeHtml(session.key)}" href="?log=${encodeURIComponent(session.key)}">
        <div class="log-meta">
          <span class="log-number">EXPEDITION ${escapeHtml(session.id)}</span>
          <span>${escapeHtml(session.date)}</span>
          <span>${escapeHtml(session.location)}</span>
          <span class="status">${escapeHtml(session.status)}</span>
        </div>
        <h3>${escapeHtml(session.title)}</h3>
        <p>${escapeHtml(session.summary)}</p>
        <div class="tags">${(session.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      </a>`;
  }

  function renderArchive() {
    const archive = document.getElementById("archive-list");
    if (!archive) return;

    const groups = buildDiverGroups();
    const latest = sessions[0];

    document.getElementById("stat-logs").textContent = sessions.length;
    document.getElementById("stat-divers").textContent = groups.length;
    document.getElementById("stat-latest").textContent = latest ? `${latest.diver} / ${latest.id}` : "—";

    const stationDivers = document.getElementById("station-divers");
    const stationExpeditions = document.getElementById("station-expeditions");
    const stationLastTransmission = document.getElementById("station-last-transmission");
    if (stationDivers) stationDivers.textContent = String(groups.length).padStart(3, "0");
    if (stationExpeditions) stationExpeditions.textContent = String(sessions.length).padStart(3, "0");
    if (stationLastTransmission) {
      const latestDate = latest?.date;
      stationLastTransmission.textContent = latestDate ? String(latestDate).replaceAll("-", ".") : "—";
    }

    if (!sessions.length) {
      archive.innerHTML = '<div class="empty">NO DEEP DIVER RECORDS FOUND. Add a Markdown file to <code>/logs</code> and push it to GitHub.</div>';
      return;
    }

    archive.innerHTML = groups.map(group => {
      const isDeceased = group.status === "deceased";
      const transmissionLabel = isDeceased ? "FINAL TRANSMISSION" : "LAST TRANSMISSION";
      return `
        <details class="diver-dossier ${isDeceased ? "is-deceased" : "is-active"}" ${isDeceased ? "" : "open"}>
          <summary class="diver-summary">
            <div class="diver-primary">
              <span class="diver-label">DEEP DIVER RECORD // ${isDeceased ? "DECEASED" : "ACTIVE"}</span>
              <strong>${escapeHtml(group.name)}</strong>
            </div>
            <div class="diver-metrics">
              <span><small>EXPEDITIONS</small><b>${String(group.sessions.length).padStart(3, "0")}</b></span>
              <span><small>${transmissionLabel}</small><b>${escapeHtml(String(group.latest?.date || "—").replaceAll("-", "."))}</b></span>
              <span class="diver-toggle-label">${isDeceased ? "OPEN ARCHIVE" : "COLLAPSE"}</span>
            </div>
          </summary>
          <div class="diver-record-body">
            <div class="diver-record-note">${isDeceased ? "PERSONNEL FILE CLOSED // HISTORICAL RECORD PRESERVED" : "PERSONNEL FILE ACTIVE // NEW TRANSMISSIONS EXPECTED"}</div>
            <div class="archive-grid">${group.sessions.map(renderLogCard).join("")}</div>
          </div>
        </details>`;
    }).join("");

    archive.querySelectorAll("details.diver-dossier").forEach(details => {
      details.addEventListener("toggle", () => {
        const label = details.querySelector(".diver-toggle-label");
        if (!label) return;
        label.textContent = details.open ? "COLLAPSE" : (details.classList.contains("is-deceased") ? "OPEN ARCHIVE" : "EXPAND");
      });
    });
  }

  function setFooterState(isSession) {
    const footerState = document.getElementById("footer-terminal-state");
    if (footerState) footerState.textContent = isSession ? "RECORD TERMINATED //" : "END OF TRANSMISSION //";
  }

  function showHome(target, updateHistory) {
    const home = document.getElementById("home-view");
    const session = document.getElementById("session-view");
    if (home) home.hidden = false;
    if (session) session.hidden = true;
    document.title = cfg.archiveName || "Deep Diver // Expedition Archive";
    setFooterState(false);

    const hash = target ? `#${target}` : "";
    if (updateHistory) {
      history.pushState({ view: "home" }, "", `${location.pathname}${hash}`);
      trackCurrentView(null);
    }

    requestAnimationFrame(() => {
      if (target) document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function showSession(identifier, updateHistory) {
    const s = resolveSession(identifier);
    if (!s) {
      showHome("logs", updateHistory);
      return;
    }

    const home = document.getElementById("home-view");
    const session = document.getElementById("session-view");
    if (home) home.hidden = true;
    if (session) session.hidden = false;

    document.title = `${s.diver} // ${s.title}`;
    document.getElementById("session-title").textContent = s.title;
    document.getElementById("session-id").textContent = `${String(s.diver).toUpperCase()} // EXPEDITION LOG ${s.id}`;
    document.getElementById("session-diver").textContent = s.diver;
    document.getElementById("session-date").textContent = s.date;
    document.getElementById("session-location").textContent = s.location;
    document.getElementById("session-status").textContent = s.status;
    document.getElementById("session-diver-status").textContent = s.diver_status === "deceased" ? "DECEASED" : "ACTIVE";
    document.getElementById("session-summary").textContent = s.summary;
    document.getElementById("session-body").innerHTML = renderMarkdown(s.body);
    setFooterState(true);

    if (updateHistory) {
      history.pushState({ view: "session", key: s.key }, "", `${location.pathname}?log=${encodeURIComponent(s.key)}`);
      trackCurrentView(s);
    }
    window.scrollTo({ top: 0, behavior: updateHistory ? "smooth" : "auto" });
  }

  function routeFromLocation(shouldTrack = false) {
    const id = new URLSearchParams(location.search).get("log");
    if (id) {
      const s = resolveSession(id);
      showSession(id, false);
      if (shouldTrack && s) trackCurrentView(s);
      return;
    }
    const target = location.hash ? location.hash.slice(1) : "";
    showHome(target, false);
    if (shouldTrack) trackCurrentView(null);
  }

  function bindRouting() {
    document.addEventListener("click", event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const logLink = event.target.closest("a[data-session-key]");
      if (logLink) {
        event.preventDefault();
        showSession(logLink.dataset.sessionKey, true);
        return;
      }

      const homeLink = event.target.closest("a[data-route-home]");
      if (homeLink) {
        event.preventDefault();
        showHome(homeLink.dataset.target || "", true);
      }
    });

    window.addEventListener("popstate", () => routeFromLocation(true));
  }

  bindConfig();
  renderArchive();
  initAmbientAudio();
  initStationCounter();
  bindRouting();
  routeFromLocation(false);

  if (!goatCounterInitialTracked) {
    goatCounterInitialTracked = true;
    const initialId = new URLSearchParams(location.search).get("log");
    trackCurrentView(resolveSession(initialId) || null);
  }
})();
