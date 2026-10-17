// ==UserScript==
// @name           zen-custom: Ctrl+Tab switcher
// @description    Ctrl+Tab skips sleeping tabs; hold Ctrl for an Alt+Tab-style picker.
// @include        main
// ==/UserScript==
//
// Ctrl+Tab / Ctrl+Shift+Tab: tap to jump to the next/previous AWAKE tab in this
// space (Essentials included). Sleeping tabs are skipped, so they never wake.
// Keep holding Ctrl and a picker of awake tabs appears, like Windows Alt+Tab:
// Tab or arrows to move, let go of Ctrl to open, Esc to cancel, click works too.
// Ctrl+Alt+Space opens the picker so it stays open: search box, awake tabs from
// every space, and this space's sleeping tabs (dimmed, opening one wakes it).
//
// Prefs: zen-custom.ctrl-tab (on/off), zen-custom.ctrl-tab.delay (ms before
// the picker shows, default 200), zen-custom.ctrl-tab.recent-order (true =
// most recently used first, like Alt+Tab; default false = tab bar order).

(() => {
  "use strict";

  const PREF = "zen-custom.ctrl-tab";
  const HTML = "http://www.w3.org/1999/xhtml";

  if (!Services.prefs.getBoolPref(PREF, true)) return;

  const delay = () => Services.prefs.getIntPref(PREF + ".delay", 200);
  const recentFirst = () => Services.prefs.getBoolPref(PREF + ".recent-order", false);

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElementNS(HTML, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "onclick") el.addEventListener("click", v);
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids) if (kid) el.append(kid);
    return el;
  }

  const workspaces = () => window.gZenWorkspaces || window.ZenWorkspaces;

  async function spaceList() {
    try {
      const ws = await workspaces()?.getWorkspaces();
      return Array.isArray(ws) ? ws : ws?.workspaces || [];
    } catch (e) {
      return [];
    }
  }

  const isAsleep = tab => !tab.linkedPanel || tab.hasAttribute("pending") || tab.hasAttribute("discarded");
  const usable = tab => !tab.closing && !tab.hasAttribute("zen-empty-tab") && !tab.hasAttribute("zen-glance-tab");

  function ordered(tabs) {
    // lastAccessed is Infinity for the selected tab, so it stays first.
    return recentFirst() ? [...tabs].sort((a, b) => b.lastAccessed - a.lastAccessed) : tabs;
  }

  const awakeHere = () => ordered(gBrowser.visibleTabs.filter(t => usable(t) && !isAsleep(t)));

  function host(tab) {
    try {
      return tab.linkedBrowser.currentURI.host || tab.linkedBrowser.currentURI.spec;
    } catch (e) {
      return "";
    }
  }

  function subtitle(tab) {
    if (tab.hasAttribute("soundplaying")) return "🔊 Playing";
    if (tab.hasAttribute("zen-essential")) return "Essential";
    if (tab.pinned) return "Pinned · " + host(tab);
    return host(tab);
  }

  async function goToTab(tab) {
    try {
      const wsId = tab.getAttribute("zen-workspace-id");
      const zw = workspaces();
      if (wsId && !tab.hasAttribute("zen-essential") && zw?.activeWorkspace !== wsId) {
        const ws = (await spaceList()).find(w => w.uuid === wsId);
        if (ws) await zw.changeWorkspace(ws);
      }
    } catch (e) { console.error("Ctrl+Tab switcher:", e); }
    gBrowser.selectedTab = tab;
  }

  // ---------- UI ----------

  const css = `
    #zcts { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,.18); font: menu; font-size: 13px; }
    #zcts[hidden] { display: none; }
    #zcts .box { width: min(960px, 90vw); max-height: 80vh; overflow-y: auto; padding: 14px; border-radius: 14px;
      background: var(--arrowpanel-background, Canvas); color: var(--arrowpanel-color, CanvasText);
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent); box-shadow: 0 12px 40px rgba(0,0,0,.35); }
    #zcts .hint { display: flex; justify-content: space-between; gap: 12px; opacity: .65; font-size: 12px; margin-bottom: 10px; }
    #zcts input { width: 100%; box-sizing: border-box; margin: 0 0 10px; padding: 7px 10px; border-radius: 8px; font: inherit; color: inherit;
      background: color-mix(in srgb, currentColor 7%, transparent); border: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
    #zcts .shead { font-weight: 600; margin: 12px 2px 6px; }
    #zcts .shead:first-of-type { margin-top: 0; }
    #zcts .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    #zcts .card { padding: 6px; border-radius: 10px; cursor: pointer; border: 2px solid transparent;
      background: color-mix(in srgb, currentColor 5%, transparent); min-width: 0; }
    #zcts .card.sel { border-color: var(--zen-primary-color, AccentColor); background: color-mix(in srgb, var(--zen-primary-color, AccentColor) 18%, transparent); }
    #zcts .thumb { height: 96px; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, currentColor 8%, transparent); }
    #zcts .thumb canvas { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    #zcts .thumb > img { width: 32px; height: 32px; opacity: .8; }
    #zcts .title { display: flex; align-items: center; gap: 6px; margin-top: 6px; white-space: nowrap; overflow: hidden; }
    #zcts .title img { width: 16px; height: 16px; flex: none; }
    #zcts .title span { overflow: hidden; text-overflow: ellipsis; }
    #zcts .card.sel .title span { font-weight: 600; }
    #zcts .sub { opacity: .6; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #zcts .row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 8px; cursor: pointer; opacity: .6;
      border: 2px solid transparent; white-space: nowrap; overflow: hidden; }
    #zcts .row img { width: 16px; height: 16px; flex: none; }
    #zcts .row.sel { opacity: 1; border-color: var(--zen-primary-color, AccentColor); }
    #zcts .empty { opacity: .6; padding: 12px 2px; }
  `;

  const overlay = h("div", { id: "zcts", hidden: "true" });
  const box = h("div", { class: "box" });
  overlay.append(h("style", { text: css }), box);
  (document.body || document.documentElement).append(overlay);

  let mode = null;        // null, "hold" (Ctrl+Tab) or "sticky" (Ctrl+Alt+Space)
  let items = [];         // tabs in the order they can be selected
  let index = 0;
  let showTimer = null;
  let prevFocus = null;
  let search = null;
  let lastStamp = -1;

  function icon(tab) {
    const src = tab.getAttribute("image");
    return src ? h("img", { src }) : null;
  }

  async function fillThumb(tab, el) {
    try {
      const pic = await window.tabPreviews?.get(tab);
      if (!pic || !el.isConnected) return;
      const c = h("canvas");
      c.width = pic.width || pic.naturalWidth;
      c.height = pic.height || pic.naturalHeight;
      c.getContext("2d").drawImage(pic, 0, 0);
      el.replaceChildren(c);
    } catch (e) {
      // No preview for this page; the favicon stays.
    }
  }

  function card(tab) {
    const thumb = h("div", { class: "thumb" }, icon(tab));
    const el = h("div", { class: "card", title: tab.label },
      thumb,
      h("div", { class: "title" }, icon(tab), h("span", { text: tab.label })),
      h("div", { class: "sub", text: subtitle(tab) }));
    el.addEventListener("click", () => pick(tab));
    el.addEventListener("mousemove", () => select(items.indexOf(tab)));
    fillThumb(tab, thumb);
    return el;
  }

  function row(tab) {
    const el = h("div", { class: "row", title: "Asleep. Opening it wakes it." }, icon(tab),
      h("span", { text: `${tab.label} · ${host(tab)}` }));
    el.addEventListener("click", () => pick(tab));
    el.addEventListener("mousemove", () => select(items.indexOf(tab)));
    return el;
  }

  function renderHold() {
    box.replaceChildren(
      h("div", { class: "hint" },
        h("span", { text: "Tab / Shift+Tab or arrows to move · let go of Ctrl to open · Esc to cancel" }),
        h("span", { text: `${items.length} awake` })),
      h("div", { class: "grid" }, ...items.map(card)));
    markSelected();
  }

  async function renderSticky() {
    const q = (search.value || "").trim().toLowerCase();
    const match = t => !q || t.label.toLowerCase().includes(q) || host(t).toLowerCase().includes(q);

    const here = gBrowser.visibleTabs.filter(usable);
    const groups = [["This space", ordered(here.filter(t => !isAsleep(t) && match(t)))]];
    const active = workspaces()?.activeWorkspace;
    for (const ws of await spaceList()) {
      if (ws.uuid === active) continue;
      const tabs = gBrowser.tabs.filter(t => usable(t) && !isAsleep(t) && !t.hasAttribute("zen-essential") &&
        t.getAttribute("zen-workspace-id") === ws.uuid && match(t));
      const name = `${ws.icon && !ws.icon.includes("/") ? ws.icon + " " : ""}${ws.name}`;
      if (tabs.length) groups.push([name, ordered(tabs)]);
    }
    const asleep = here.filter(t => isAsleep(t) && match(t));
    if (mode !== "sticky") return; // closed while we waited for the space list

    items = [...groups.flatMap(g => g[1]), ...asleep];
    const frag = document.createDocumentFragment();
    for (const [name, tabs] of groups) {
      if (!tabs.length) continue;
      frag.append(h("div", { class: "shead", text: name }), h("div", { class: "grid" }, ...tabs.map(card)));
    }
    if (asleep.length) {
      frag.append(h("div", { class: "shead", text: `Asleep in this space (${asleep.length}) · opening one wakes it` }),
        ...asleep.map(row));
    }
    if (!items.length) frag.append(h("div", { class: "empty", text: "No tabs match." }));
    box.querySelector(".list")?.replaceChildren(frag);
    index = Math.min(index, Math.max(items.length - 1, 0));
    markSelected();
  }

  function markSelected() {
    const els = box.querySelectorAll(".card, .row");
    els.forEach((el, i) => el.classList.toggle("sel", i === index));
    els[index]?.scrollIntoView({ block: "nearest" });
  }

  function select(i) {
    if (i < 0 || !items.length) return;
    index = i;
    markSelected();
  }

  function move(step) {
    if (!items.length) return;
    index = (index + step + items.length) % items.length;
    if (!overlay.hidden) markSelected();
  }

  function columns() {
    const grid = box.querySelector(".grid");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 1;
  }

  function show() {
    clearTimeout(showTimer);
    showTimer = null;
    if (mode === "hold") renderHold();
    overlay.hidden = false;
  }

  function close() {
    clearTimeout(showTimer);
    showTimer = null;
    overlay.hidden = true;
    box.replaceChildren();
    const wasSticky = mode === "sticky";
    mode = null;
    items = [];
    search = null;
    if (wasSticky && prevFocus?.isConnected) prevFocus.focus();
    prevFocus = null;
  }

  function pick(tab) {
    close();
    if (tab && !tab.closing && tab !== gBrowser.selectedTab) goToTab(tab);
  }

  const commit = () => pick(items[index]);

  function startHold(step) {
    items = awakeHere();
    if (items.length < 2) { items = []; return; } // nothing awake to switch to
    mode = "hold";
    index = Math.max(items.indexOf(gBrowser.selectedTab), 0);
    move(step);
    showTimer = setTimeout(show, delay());
  }

  function openSticky() {
    mode = "sticky";
    index = 0;
    prevFocus = document.activeElement;
    search = h("input", { type: "search", placeholder: "Type to search tabs…" });
    search.addEventListener("input", () => { index = 0; renderSticky(); });
    box.replaceChildren(
      h("div", { class: "hint" },
        h("span", { text: "Arrows to move · Enter to open · Esc to close" }),
        h("span", { text: "Ctrl+Alt+Space" })),
      search, h("div", { class: "list" }));
    show();
    search.focus();
    renderSticky();
  }

  const eat = e => { e.preventDefault(); e.stopImmediatePropagation(); };

  window.addEventListener("keydown", e => {
    if (e.timeStamp === lastStamp) return; // the same key event coming back from the page
    const tabKey = e.key === "Tab" && e.ctrlKey && !e.altKey && !e.metaKey;
    const stickyKey = e.code === "Space" && e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey;
    if (!mode && !tabKey && !stickyKey) return;
    lastStamp = e.timeStamp;

    if (!mode) {
      eat(e);
      tabKey ? startHold(e.shiftKey ? -1 : 1) : openSticky();
      return;
    }
    if (tabKey) { eat(e); move(e.shiftKey ? -1 : 1); return; }
    if (stickyKey) { eat(e); close(); return; }
    switch (e.key) {
      case "Escape": eat(e); close(); return;
      case "Enter": eat(e); commit(); return;
      case "ArrowRight": eat(e); move(1); return;
      case "ArrowLeft": eat(e); move(-1); return;
      case "ArrowDown": eat(e); move(columns()); return;
      case "ArrowUp": eat(e); move(-columns()); return;
    }
    if (mode === "hold" && !e.ctrlKey) commit(); // Ctrl was let go without us seeing it
  }, true);

  window.addEventListener("keyup", e => {
    if (mode === "hold" && (e.key === "Control" || !e.ctrlKey)) commit();
  }, true);

  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  window.addEventListener("deactivate", () => { if (mode) close(); });
  gBrowser.tabContainer.addEventListener("TabClose", e => {
    if (!mode || !items.includes(e.target)) return;
    if (mode === "sticky") return renderSticky();
    const sel = items[index];
    items = items.filter(t => t !== e.target);
    if (items.length < 2) return close();
    index = Math.max(items.indexOf(sel), 0);
    if (!overlay.hidden) renderHold();
  });
})();
