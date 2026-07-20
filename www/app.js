(() => {
  "use strict";

  const CFG_KEY = "watchlist.config";
  const state = {
    entries: [],
    tab: "want_to_watch",
    editingId: null,
  };

  // ---------- config ----------
  function getConfig() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function setConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  // ---------- API ----------
  // Uses the native CapacitorHttp plugin directly rather than the patched
  // fetch — Google Apps Script's internal redirect doesn't come back as
  // clean JSON through the fetch shim, but the native plugin handles it fine.
  function nativeHttp() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  }

  function parseBody(data) {
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        throw new Error("Non-JSON response: " + data.slice(0, 200));
      }
    }
    return data;
  }

  async function apiList() {
    const cfg = getConfig();
    const http = nativeHttp();
    let data;
    if (http) {
      const res = await http.get({
        url: cfg.url,
        params: { token: cfg.token, action: "list" },
      });
      data = parseBody(res.data);
    } else {
      const url = `${cfg.url}?token=${encodeURIComponent(cfg.token)}&action=list`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Request failed");
      data = await res.json();
    }
    if (data.error) throw new Error(data.error);
    return data.entries || [];
  }

  async function apiWrite(action, entry) {
    const cfg = getConfig();
    const http = nativeHttp();
    let data;
    if (http) {
      const res = await http.post({
        url: cfg.url,
        headers: { "Content-Type": "application/json" },
        data: { token: cfg.token, action, entry },
      });
      data = parseBody(res.data);
    } else {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token: cfg.token, action, entry }),
      });
      if (!res.ok) throw new Error("Request failed");
      data = await res.json();
    }
    if (data.error) throw new Error(data.error);
    return data;
  }

  // ---------- rendering ----------
  const listEl = document.getElementById("entry-list");
  const emptyEl = document.getElementById("empty-state");

  function render() {
    const filtered = state.entries.filter((e) => e.status === state.tab);
    listEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", filtered.length > 0);

    filtered
      .slice()
      .sort((a, b) => (b.date_added || "").localeCompare(a.date_added || ""))
      .forEach((entry) => {
        const li = document.createElement("li");
        li.className = "entry" + (entry.status === "watched" ? " is-watched" : "");
        li.dataset.id = entry.id;

        const title = document.createElement("div");
        title.className = "entry-title";
        title.textContent = entry.title;

        const meta = document.createElement("div");
        meta.className = "entry-meta";
        meta.textContent = entry.type === "show" ? "TV Show" : "Movie";

        li.appendChild(title);
        li.appendChild(meta);

        if (entry.status === "watched" && entry.rating) {
          const rating = document.createElement("div");
          rating.className = "entry-rating";
          rating.textContent = "★".repeat(entry.rating) + "☆".repeat(5 - entry.rating);
          li.appendChild(rating);
        }

        li.addEventListener("click", () => openSheet(entry));
        listEl.appendChild(li);
      });
  }

  // ---------- tabs ----------
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.tab = tab.dataset.status;
      render();
    });
  });

  // ---------- sheet (add/edit) ----------
  const sheetEl = document.getElementById("add-sheet");
  const scrimEl = document.getElementById("scrim");
  const fTitle = document.getElementById("f-title");
  const fType = document.getElementById("f-type");
  const fStatus = document.getElementById("f-status");
  const fRating = document.getElementById("f-rating");
  const deleteBtn = document.getElementById("delete-btn");
  const sheetTitleEl = document.getElementById("sheet-title");

  function setRatingUI(value) {
    fRating.dataset.value = value;
    fRating.querySelectorAll("span").forEach((s) => {
      s.classList.toggle("filled", Number(s.dataset.star) <= value);
    });
  }

  fRating.addEventListener("click", (e) => {
    const star = e.target.closest("span[data-star]");
    if (!star) return;
    const val = Number(star.dataset.star);
    setRatingUI(fRating.dataset.value == val ? 0 : val);
  });

  function openSheet(entry) {
    state.editingId = entry ? entry.id : null;
    sheetTitleEl.textContent = entry ? "Edit title" : "Add title";
    fTitle.value = entry ? entry.title : "";
    fType.value = entry ? entry.type : "movie";
    fStatus.value = entry ? entry.status : state.tab;
    setRatingUI(entry ? entry.rating || 0 : 0);
    deleteBtn.classList.toggle("hidden", !entry);
    sheetEl.classList.remove("hidden");
    scrimEl.classList.remove("hidden");
  }

  function closeSheet() {
    sheetEl.classList.add("hidden");
    scrimEl.classList.add("hidden");
    state.editingId = null;
  }

  document.getElementById("add-btn").addEventListener("click", () => openSheet(null));
  document.getElementById("cancel-btn").addEventListener("click", closeSheet);
  scrimEl.addEventListener("click", closeSheet);

  document.getElementById("save-btn").addEventListener("click", async () => {
    const title = fTitle.value.trim();
    if (!title) {
      fTitle.focus();
      return;
    }
    const entry = {
      id: state.editingId || crypto.randomUUID(),
      title,
      type: fType.value,
      status: fStatus.value,
      rating: Number(fRating.dataset.value) || "",
      date_added: state.editingId
        ? state.entries.find((e) => e.id === state.editingId)?.date_added
        : new Date().toISOString().slice(0, 10),
    };

    closeSheet();
    showToast(state.editingId ? "Saved" : "Added");

    try {
      await apiWrite(state.editingId ? "update" : "add", entry);
      await refresh();
    } catch (err) {
      showToast("Sync failed — try again");
    }
  });

  deleteBtn.addEventListener("click", async () => {
    const id = state.editingId;
    closeSheet();
    showToast("Deleted");
    try {
      await apiWrite("delete", { id });
      await refresh();
    } catch (err) {
      showToast("Sync failed — try again");
    }
  });

  // ---------- toast ----------
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  // ---------- setup screen ----------
  const setupEl = document.getElementById("setup-screen");
  const cfgUrl = document.getElementById("cfg-url");
  const cfgToken = document.getElementById("cfg-token");
  const cfgError = document.getElementById("cfg-error");

  document.getElementById("cfg-save").addEventListener("click", async () => {
    const url = cfgUrl.value.trim();
    const token = cfgToken.value.trim();
    if (!url || !token) return;
    setConfig({ url, token });
    cfgError.classList.add("hidden");
    try {
      await refresh();
      setupEl.classList.add("hidden");
    } catch (err) {
      cfgError.textContent = "Error: " + err.message;
      cfgError.classList.remove("hidden");
    }
  });

  // ---------- bootstrap ----------
  async function refresh() {
    state.entries = await apiList();
    render();
  }

  async function init() {
    const cfg = getConfig();
    if (!cfg) {
      setupEl.classList.remove("hidden");
      return;
    }
    try {
      await refresh();
    } catch (err) {
      setupEl.classList.remove("hidden");
      cfgUrl.value = cfg.url || "";
      cfgToken.value = cfg.token || "";
      cfgError.textContent = "Error: " + err.message;
      cfgError.classList.remove("hidden");
    }
  }

  init();
})();
