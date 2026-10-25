// ==UserScript==
// @name           zen-custom: Tab Monitor
// @description    See which tab in which space is using memory and CPU, and put tabs to sleep.
// @include        main
// ==/UserScript==
//
// Open with Shift+Esc (replaces the old Process Manager shortcut, which stays
// one click away at the top of the panel), Ctrl+Alt+M, or the toolbar button. Switch off with zen-custom.tab-monitor = false.

(() => {
  "use strict";

  // Sine can run a script twice in the same window; the second copy would add
  // its buttons and key handlers again.
  // The mark goes on the window's root element, which every copy can see.
  const loadedMark = "zc-loaded-tabMonitor";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const PREF = "zen-custom.tab-monitor";
  const REFRESH_MS = 2000;
  const HEAVY_MB = 500;
  const HTML = "http://www.w3.org/1999/xhtml";

  // read on each use, so switching the pref off works without a restart
  const enabled = () => Services.prefs.getBoolPref(PREF, true);

  const MB = b => b / (1024 * 1024);
  const fmtMem = b => (MB(b) >= 1024 ? (MB(b) / 1024).toFixed(1) + " GB" : Math.round(MB(b)) + " MB");
  const fmtCpu = p => (p < 0.1 ? "0%" : p < 10 ? p.toFixed(1) + "%" : Math.round(p) + "%");

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

  function tabPid(tab) {
    const b = tab.linkedBrowser;
    try {
      return b?.browsingContext?.currentWindowGlobal?.osPid || b?.frameLoader?.remoteTab?.osPid || 0;
    } catch (e) {
      return 0;
    }
  }

  // CPU % needs two samples, so remember the last one per pid.
  let lastSample = null;

  async function sample() {
    const info = await ChromeUtils.requestProcInfo();
    // ms -> ns, same unit as cpuTime (Cu.now() no longer exists in Firefox 158,
    // and its error left the panel empty)
    const now = performance.now() * 1e6;
    const procs = new Map();
    for (const p of [info, ...info.children]) procs.set(p.pid, { mem: p.memory || 0, cpu: p.cpuTime || 0 });

    const cpuPct = new Map();
    if (lastSample) {
      const dt = now - lastSample.at;
      for (const [pid, p] of procs) {
        const prev = lastSample.procs.get(pid);
        if (prev && dt > 0) cpuPct.set(pid, Math.max(0, ((p.cpu - prev.cpu) / dt) * 100));
      }
    }
    lastSample = { at: now, procs };

    let totalMem = 0, totalCpu = 0;
    for (const [pid, p] of procs) {
      totalMem += p.mem;
      totalCpu += cpuPct.get(pid) || 0;
    }
    return { procs, cpuPct, totalMem, totalCpu };
  }

  async function collect() {
    const s = await sample();
    const tabs = gBrowser.tabs.filter(t => !t.closing);

    // Tabs from the same site share one process; split its numbers between them.
    const sharers = new Map();
    for (const t of tabs) {
      if (isAsleep(t)) continue;
      const pid = tabPid(t);
      if (pid) sharers.set(pid, (sharers.get(pid) || 0) + 1);
    }

    const rows = tabs.map(t => {
      const asleep = isAsleep(t);
      const pid = asleep ? 0 : tabPid(t);
      const n = sharers.get(pid) || 1;
      const p = s.procs.get(pid);
      return {
        tab: t,
        title: t.label || t.linkedBrowser?.currentURI?.spec || "New tab",
        asleep,
        sound: t.hasAttribute("soundplaying"),
        current: t === gBrowser.selectedTab,
        shared: n > 1 ? n : 0,
        mem: p ? p.mem / n : 0,
        cpu: p ? (s.cpuPct.get(pid) || 0) / n : 0,
        space: t.hasAttribute("zen-essential") ? "__essentials" : t.getAttribute("zen-workspace-id") || "__none",
      };
    });

    const tabMem = rows.reduce((a, r) => a + r.mem, 0);
    const tabCpu = rows.reduce((a, r) => a + r.cpu, 0);
    return { rows, totalMem: s.totalMem, totalCpu: s.totalCpu, zenMem: Math.max(0, s.totalMem - tabMem), zenCpu: Math.max(0, s.totalCpu - tabCpu) };
  }

  function sleepTab(tab) {
    if (tab === gBrowser.selectedTab || isAsleep(tab)) return;
    try { gBrowser.discardBrowser(tab); } catch (e) { console.error("Tab Monitor:", e); }
  }

  async function goToTab(tab) {
    try {
      const wsId = tab.getAttribute("zen-workspace-id");
      const zw = workspaces();
      if (wsId && !tab.hasAttribute("zen-essential") && zw?.activeWorkspace !== wsId) {
        const ws = (await spaceList()).find(w => w.uuid === wsId);
        if (ws) await zw.changeWorkspace(ws);
      }
    } catch (e) { console.error("Tab Monitor:", e); }
    gBrowser.selectedTab = tab;
    panel.hidePopup();
  }

  // ---------- UI ----------

  const css = `
    #ztm-panel { --panel-padding: 0; }
    #ztm { width: 420px; max-height: 70vh; overflow-y: auto; padding: 12px 14px; font: menu; font-size: 13px; }
    #ztm .switch { display: flex; gap: 4px; margin-bottom: 10px; padding: 3px; border-radius: 8px; background: color-mix(in srgb, currentColor 7%, transparent); }
    #ztm .switch button { flex: 1; border: 0; padding: 4px 8px; font-size: 12px; }
    #ztm .switch button.on { background: color-mix(in srgb, currentColor 15%, transparent); font-weight: 600; }
    #ztm .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    #ztm .big { font-size: 15px; font-weight: 600; }
    #ztm .sub { opacity: .7; font-size: 12px; margin-bottom: 10px; }
    #ztm button { font: inherit; font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: transparent; color: inherit; cursor: pointer; }
    #ztm button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
    #ztm .space { margin-top: 12px; }
    #ztm .shead { display: flex; justify-content: space-between; align-items: center; font-weight: 600; padding: 4px 0; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
    #ztm .shead small { font-weight: 400; opacity: .7; margin-left: 6px; }
    #ztm .row { display: grid; grid-template-columns: 1fr 70px 44px 58px; gap: 8px; align-items: center; padding: 5px 4px; border-radius: 6px; cursor: pointer; }
    #ztm .row:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
    #ztm .title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #ztm .title small { opacity: .6; }
    #ztm .mem, #ztm .cpu { text-align: right; font-variant-numeric: tabular-nums; }
    #ztm .heavy { color: #e5484d; font-weight: 600; }
    #ztm .state { font-size: 11px; text-align: center; border-radius: 10px; padding: 1px 0; }
    #ztm .awake { color: #30a46c; border: 1px solid #30a46c; }
    #ztm .sound { color: #f5a524; border: 1px solid #f5a524; }
    #ztm .row .sleep { display: none; }
    #ztm .row:hover .sleep { display: block; }
    #ztm .row:hover .state.awake { display: none; }
    #ztm .asleep-line { opacity: .6; padding: 5px 4px; cursor: pointer; }
    #ztm .asleep-line:hover { opacity: .9; }
    #ztm .foot { margin-top: 12px; opacity: .6; font-size: 11px; }
  `;

  const panel = document.createXULElement("panel");
  panel.id = "ztm-panel";
  panel.setAttribute("type", "arrow");
  panel.setAttribute("role", "dialog");
  const root = h("div", { id: "ztm" });
  const style = h("style", { text: css });
  panel.append(style, root);
  document.getElementById("mainPopupSet").append(panel);

  const openAsleep = new Set(); // spaces where the user expanded the sleeping tabs
  let timer = null;

  async function render() {
    const [data, spaces] = await Promise.all([collect(), spaceList()]);
    const names = new Map(spaces.map(w => [w.uuid, `${w.icon && !w.icon.includes("/") ? w.icon + " " : ""}${w.name}`]));
    names.set("__essentials", "⭐ Essentials");
    names.set("__none", "Other tabs");

    const groups = new Map();
    for (const r of data.rows) {
      if (!groups.has(r.space)) groups.set(r.space, []);
      groups.get(r.space).push(r);
    }
    const order = ["__essentials", ...spaces.map(w => w.uuid), "__none"].filter(id => groups.has(id));
    for (const id of groups.keys()) if (!order.includes(id)) order.push(id);

    const awakeCount = data.rows.filter(r => !r.asleep).length;
    const frag = document.createDocumentFragment();
    frag.append(
      h("div", { class: "switch" },
        h("button", { class: "on", text: "Tab Monitor" }),
        h("button", { text: "Process Manager (detailed)", title: "Firefox's built-in about:processes",
          onclick: () => { panel.hidePopup(); openTrustedLinkIn("about:processes", "tab"); } })),
      h("div", { class: "top" },
        h("span", { class: "big", text: `Zen is using ${fmtMem(data.totalMem)}` }),
        h("button", { text: "Sleep all except this tab", title: "Puts every other tab to sleep. They reload when you click them.",
          onclick: () => { data.rows.forEach(r => sleepTab(r.tab)); setTimeout(render, 300); } })),
      h("div", { class: "sub", text: `CPU ${fmtCpu(data.totalCpu)} · ${awakeCount} tabs awake · ${data.rows.length - awakeCount} asleep` })
    );

    for (const id of order) {
      const rows = groups.get(id);
      const awake = rows.filter(r => !r.asleep).sort((a, b) => b.mem - a.mem);
      const asleep = rows.filter(r => r.asleep);
      const mem = awake.reduce((a, r) => a + r.mem, 0);
      const cpu = awake.reduce((a, r) => a + r.cpu, 0);

      const sec = h("div", { class: "space" },
        h("div", { class: "shead" },
          h("span", { text: names.get(id) || "Space" },
            h("small", { text: awake.length ? `${fmtMem(mem)} · CPU ${fmtCpu(cpu)}` : "all asleep" })),
          awake.some(r => !r.current)
            ? h("button", { text: "Sleep this space", onclick: () => { rows.forEach(r => sleepTab(r.tab)); setTimeout(render, 300); } })
            : null));

      for (const r of awake) {
        const heavy = MB(r.mem) >= HEAVY_MB;
        const label = r.current ? "Open now" : r.sound ? "Sound" : "Awake";
        sec.append(h("div", { class: "row", title: "Click to go to this tab", onclick: () => goToTab(r.tab) },
          h("span", { class: "title", text: (r.sound ? "🔊 " : "") + r.title },
            r.shared ? h("small", { text: ` · shares with ${r.shared - 1} other` }) : null),
          h("span", { class: "mem" + (heavy ? " heavy" : ""), text: fmtMem(r.mem) }),
          h("span", { class: "cpu" + (r.cpu >= 5 ? " heavy" : ""), text: fmtCpu(r.cpu) }),
          h("span", { class: "state " + (r.sound ? "sound" : "awake"), text: label }),
          r.current ? null : h("button", { class: "sleep", text: "Sleep", title: "Frees this tab's memory. It reloads when you click it.",
            onclick: e => { e.stopPropagation(); sleepTab(r.tab); setTimeout(render, 300); } })));
      }

      if (asleep.length) {
        const open = openAsleep.has(id);
        sec.append(h("div", { class: "asleep-line", text: `${open ? "▾" : "▸"} ${asleep.length} asleep tab${asleep.length > 1 ? "s" : ""} (using no memory)`,
          onclick: () => { open ? openAsleep.delete(id) : openAsleep.add(id); render(); } }));
        if (open) for (const r of asleep) {
          sec.append(h("div", { class: "row", title: "Click to go to this tab (it will reload)", onclick: () => goToTab(r.tab) },
            h("span", { class: "title", style: "opacity:.6", text: r.title }), h("span"), h("span"),
            h("span", { class: "state", style: "opacity:.6", text: "Asleep" })));
        }
      }
      frag.append(sec);
    }

    frag.append(h("div", { class: "foot", text: `Zen itself, extensions and graphics: ${fmtMem(data.zenMem)} · CPU ${fmtCpu(data.zenCpu)}. Click a tab to go to it, hover it to put it to sleep.` }));
    root.replaceChildren(frag);
  }

  panel.addEventListener("popupshowing", () => {
    lastSample = null;
    render().then(() => setTimeout(render, 500)); // second pass fills in CPU
    timer = setInterval(() => render().catch(e => console.error("Tab Monitor:", e)), REFRESH_MS);
  });
  panel.addEventListener("popuphidden", () => { clearInterval(timer); timer = null; });

  // A button tucked under » (or not shown) has no box to hang the panel on:
  // the panel would open and shut at once, so use the page instead.
  const onScreen = el => !!el && !el.hasAttribute("overflowedItem") && el.getBoundingClientRect().width > 0;

  function toggle(anchor) {
    if (panel.state === "open" || panel.state === "showing") return panel.hidePopup();
    if (!enabled()) return;
    const button = document.getElementById("zen-custom-tab-monitor-button");
    const a = onScreen(anchor) ? anchor : onScreen(button) ? button : gBrowser.selectedBrowser;
    panel.openPopup(a, a === gBrowser.selectedBrowser ? "overlap" : "bottom-start");
  }

  try {
    CustomizableUI.createWidget({
      id: "zen-custom-tab-monitor-button",
      label: "Tab Monitor",
      tooltiptext: "See which tabs use memory and CPU (Shift+Esc)",
      // No default spot: in Zen's single toolbar the nav bar is the top bar,
      // already full with the eight buttons chosen for it, and a ninth would
      // push five back under ». Add it from Customize Toolbar if wanted.
      onCommand: e => toggle(e.target),
      onCreated: node => node.style.setProperty("list-style-image", 'url("chrome://global/skin/icons/performance.svg")'),
    });
  } catch (e) {
    // Already registered in an earlier window.
  }

  // Take over Shift+Esc from the built-in Process Manager. (Zen sets up its
  // shortcut keys after this script runs, so disabling key_aboutProcesses
  // here never stuck; stopping the key event is what keeps it from opening.)
  window.addEventListener("keydown", e => {
    if (!enabled()) return;
    const shiftEsc = e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && e.key === "Escape";
    const ctrlAltM = e.ctrlKey && e.altKey && !e.shiftKey && e.code === "KeyM";
    if (shiftEsc || ctrlAltM) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  }, true);
})();
