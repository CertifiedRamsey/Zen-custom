// ==UserScript==
// @name           zen-custom: Folder style
// @description    Pick whether a folder shows Zia's folder or Zia's box, for one folder, a space or everywhere.
// @include        main
// ==/UserScript==
//
// Zia draws a folder, then swaps it for a box once a folder holds more than
// three tabs. Right-click a folder > Change icon > Folder style… to choose:
// Automatic (Zia's swap), always the folder, or always the box; for this
// folder, every folder in this space, or every folder everywhere.
// Choices live in the zen-custom.folder-style pref; folder-style.css does the
// drawing by reading the zc-fstyle attribute this puts on each folder.
// Switch off with zen-custom.folder-style-picker = false.

(() => {
  "use strict";

  // Sine can run a script twice in the same window; the second copy would add
  // its buttons and key handlers again.
  // The mark goes on the window's root element, which every copy can see.
  const loadedMark = "zc-loaded-folderStyle";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const PREF = "zen-custom.folder-style";
  const ON_PREF = "zen-custom.folder-style-picker";
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const STYLES = ["auto", "folder", "box"];

  const enabled = () => Services.prefs.getBoolPref(ON_PREF, true);

  // { all: "auto"|"folder"|"box", spaces: { id: style }, folders: { id: style } }
  function readChoices() {
    let c = {};
    try {
      c = JSON.parse(Services.prefs.getStringPref(PREF, "{}")) || {};
    } catch {}
    return { all: STYLES.includes(c.all) ? c.all : "auto", spaces: c.spaces || {}, folders: c.folders || {} };
  }

  function writeChoices(c) {
    Services.prefs.setStringPref(PREF, JSON.stringify(c));
  }

  const spaceOf = folder => folder.getAttribute("zen-workspace-id") || "";

  // The folder's own choice wins, then its space's, then everywhere's.
  function resolve(folder, c = readChoices()) {
    if (c.folders[folder.id]) return { style: c.folders[folder.id], from: "folder" };
    if (c.spaces[spaceOf(folder)]) return { style: c.spaces[spaceOf(folder)], from: "space" };
    return { style: c.all, from: c.all === "auto" ? "default" : "all" };
  }

  function applyTo(folder, c) {
    const style = enabled() ? resolve(folder, c).style : "auto";
    if (style === "auto") folder.removeAttribute("zc-fstyle");
    else if (folder.getAttribute("zc-fstyle") !== style) folder.setAttribute("zc-fstyle", style);
  }

  // Real folders only: the Library's copies carry renamed ids, and copy the
  // real folder's attribute each time the Library builds them.
  const realFolders = () => [...gBrowser.tabContainer.querySelectorAll("zen-folder")];

  function applyAll() {
    const c = readChoices();
    for (const folder of realFolders()) applyTo(folder, c);
  }

  // ---------- drawing for the picker's previews ----------

  const FOLDER_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 52" class="zcfs-art zcfs-folder" aria-hidden="true">
      <path class="back" d="M6 10a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z"/>
      <rect class="sheet s1" x="13" y="14" width="38" height="24" rx="2"/>
      <rect class="sheet s2" x="15" y="12" width="34" height="24" rx="2"/>
      <rect class="front" x="5" y="20" width="54" height="28" rx="4"/>
    </svg>`;

  const BOX_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 52" class="zcfs-art zcfs-box" aria-hidden="true">
      <rect class="sheet s1" x="12" y="14" width="40" height="22" rx="2"/>
      <rect class="sheet s2" x="14" y="12" width="36" height="22" rx="2"/>
      <rect class="front" x="7" y="22" width="50" height="26" rx="4"/>
      <rect class="lid" x="4" y="15" width="56" height="8" rx="3"/>
    </svg>`;

  const CSS = `
    #zcfs-panel { --panel-padding: 0; }
    #zcfs-panel .zcfs { width: 360px; padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
    #zcfs-panel h3 { margin: 0; font-size: 14px; }
    #zcfs-panel .zcfs-label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; opacity: .65; }
    #zcfs-panel .zcfs-now { opacity: .7; font-size: 12px; }
    #zcfs-panel .zcfs-styles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    #zcfs-panel .zcfs-style { appearance: none; font: inherit; color: inherit; cursor: pointer; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px 8px; border-radius: 10px;
      background: color-mix(in srgb, currentColor 6%, transparent); border: 2px solid transparent; }
    #zcfs-panel .zcfs-style:hover { background: color-mix(in srgb, currentColor 11%, transparent); }
    #zcfs-panel .zcfs-style[aria-pressed="true"] { border-color: var(--zcfs-accent);
      background: color-mix(in srgb, var(--zcfs-accent) 16%, transparent); }
    #zcfs-panel .zcfs-style b { font-size: 12px; }
    #zcfs-panel .zcfs-style small { font-size: 10.5px; opacity: .65; line-height: 1.3; }
    #zcfs-panel .zcfs-pair { display: flex; align-items: center; gap: 2px; height: 44px; }
    #zcfs-panel .zcfs-pair .zcfs-art { width: 34px; }
    #zcfs-panel .zcfs-art { width: 52px; height: 44px; overflow: visible; }
    #zcfs-panel .zcfs-art :is(.back, .front, .lid) { fill: color-mix(in srgb, var(--zcfs-accent) 14%, transparent);
      stroke: var(--zcfs-accent); stroke-width: 2.4; }
    #zcfs-panel .zcfs-art .back { fill: none; }
    #zcfs-panel .zcfs-art .sheet { fill: color-mix(in srgb, var(--zcfs-accent) 30%, transparent); stroke: none;
      transition: transform .35s cubic-bezier(.3,.9,.4,1); }
    #zcfs-panel .zcfs-art .front { transform-box: fill-box; transform-origin: 50% 100%;
      transition: transform .4s cubic-bezier(.3,.9,.4,1); }
    #zcfs-panel .zcfs-art .lid { transform-box: fill-box; transform-origin: 0% 100%;
      transition: transform .35s cubic-bezier(.3,.9,.4,1); }
    /* hovered or picked: the folder opens, the box's lid lifts */
    #zcfs-panel .zcfs-style:is(:hover, [aria-pressed="true"]) .zcfs-folder .front { transform: skewX(-12deg) scaleY(.86); }
    #zcfs-panel .zcfs-style:is(:hover, [aria-pressed="true"]) .zcfs-art .s2 { transform: translateY(-5px); }
    #zcfs-panel .zcfs-style:is(:hover, [aria-pressed="true"]) .zcfs-art .s1 { transform: translateY(-2px); }
    #zcfs-panel .zcfs-style:is(:hover, [aria-pressed="true"]) .zcfs-box .lid { transform: translate(-2px, -6px) rotate(-14deg); }
    #zcfs-panel .zcfs-scope { display: flex; flex-direction: column; gap: 4px; }
    #zcfs-panel .zcfs-scope label { display: flex; gap: 8px; align-items: center; padding: 7px 9px; border-radius: 8px; cursor: pointer;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
    #zcfs-panel .zcfs-scope label:has(input:checked) { border-color: var(--zcfs-accent);
      background: color-mix(in srgb, var(--zcfs-accent) 14%, transparent); }
    #zcfs-panel .zcfs-scope small { opacity: .65; margin-inline-start: auto; font-size: 11px; }
    #zcfs-panel .zcfs-note { font-size: 11px; opacity: .65; }
    #zcfs-panel .zcfs-row { display: flex; gap: 6px; justify-content: flex-end; }
    @media (prefers-reduced-motion: reduce) {
      #zcfs-panel .zcfs-art * { transition: none !important; }
    }
  `;
  window.windowUtils.loadSheetUsingURIString(
    "data:text/css;charset=utf-8," + encodeURIComponent(CSS),
    window.windowUtils.AUTHOR_SHEET
  );

  const h = (tag, props = {}, ...kids) => {
    const el = document.createElementNS(HTML_NS, tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "svg") el.append(...v.map(svg));
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid != null && kid !== false) el.append(kid);
    }
    return el;
  };

  // the preview drawings, parsed as SVG (chrome pages sanitize innerHTML)
  const svg = text => document.importNode(new DOMParser().parseFromString(text.trim(), "image/svg+xml").documentElement, true);

  const spaceName = id => gZenWorkspaces.getWorkspaceFromId(id)?.name || "this space";
  const STYLE_NAMES = { auto: "Automatic", folder: "Folder", box: "Box" };

  // ---------- panel ----------

  let panel, body, folder;
  const draft = { style: "auto", scope: "folder" };

  function ensurePanel() {
    if (panel) return;
    panel = document.createXULElement("panel");
    panel.id = "zcfs-panel";
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautofocus", "true");
    body = h("div", { class: "zcfs" });
    panel.append(body);
    document.getElementById("mainPopupSet").append(panel);
  }

  function openFor(target) {
    ensurePanel();
    folder = target;
    const now = resolve(folder);
    draft.style = now.style;
    draft.scope = now.from === "space" ? "space" : now.from === "all" ? "all" : "folder";
    // the previews use the folder's own colour (Zia's), or the space's
    const icon = folder.querySelector(":scope > .tab-group-label-container .zia-fi");
    const accent = icon ? getComputedStyle(icon).getPropertyValue("--fi-accent").trim() : "";
    body.style.setProperty("--zcfs-accent", accent || "var(--zen-primary-color, AccentColor)");
    render();
    const anchor = folder.querySelector(":scope > .tab-group-label-container") || folder;
    panel.openPopup(anchor, "after_start");
  }

  function render() {
    const now = resolve(folder);
    const where = { folder: "chosen for this folder", space: `chosen for ${spaceName(spaceOf(folder))}`, all: "chosen for every space", default: "Zia's default" }[now.from];
    const styleCard = (style, art, note) =>
      h("button", {
        class: "zcfs-style",
        "aria-pressed": String(draft.style === style),
        onclick: () => { draft.style = style; render(); },
      }, art, h("b", {}, STYLE_NAMES[style]), h("small", {}, note));

    const scopeOpt = (value, title, hint) =>
      h("label", {},
        h("input", { type: "radio", name: "zcfs-scope", value, checked: draft.scope === value, onchange: () => { draft.scope = value; render(); } }),
        h("span", {}, title),
        hint ? h("small", {}, hint) : null);

    const folderCount = realFolders().filter(f => spaceOf(f) === spaceOf(folder)).length;

    body.replaceChildren(
      h("h3", {}, `Folder style for “${folder.label || folder.name || "this folder"}”`),
      h("span", { class: "zcfs-now" }, `Now: ${STYLE_NAMES[now.style]} (${where})`),
      h("div", { class: "zcfs-styles" },
        styleCard("auto", h("span", { class: "zcfs-pair", svg: [FOLDER_SVG, BOX_SVG] }), "Folder, then a box past 3 tabs"),
        styleCard("folder", h("span", { svg: [FOLDER_SVG] }), "Always the folder"),
        styleCard("box", h("span", { svg: [BOX_SVG] }), "Always the box")),
      h("span", { class: "zcfs-label" }, "Use it for"),
      h("div", { class: "zcfs-scope" },
        scopeOpt("folder", "Just this folder"),
        scopeOpt("space", `Every folder in ${spaceName(spaceOf(folder))}`, `${folderCount} folder${folderCount === 1 ? "" : "s"}`),
        scopeOpt("all", "Every folder in every space")),
      draft.scope !== "folder"
        ? h("span", { class: "zcfs-note" }, draft.scope === "space"
            ? "This replaces any style picked for single folders in this space."
            : "This replaces every style picked for single folders and spaces.")
        : null,
      h("div", { class: "zcfs-row" },
        h("button", { onclick: () => panel.hidePopup() }, "Cancel"),
        h("button", { onclick: onApply, default: true }, "Apply"))
    );
  }

  function onApply() {
    const c = readChoices();
    const set = (map, key) => {
      if (draft.style === "auto") delete map[key];
      else map[key] = draft.style;
    };
    if (draft.scope === "folder") {
      set(c.folders, folder.id);
    } else if (draft.scope === "space") {
      const space = spaceOf(folder);
      for (const f of realFolders()) {
        if (spaceOf(f) === space) delete c.folders[f.id];
      }
      set(c.spaces, space);
    } else {
      c.all = draft.style;
      c.spaces = {};
      c.folders = {};
    }
    writeChoices(c); // the pref observer redraws every folder
    panel.hidePopup();
  }

  // ---------- menu item, under Change icon ----------

  let item, separator, menuFolder;
  document.addEventListener(
    "popupshowing",
    event => {
      const menu = event.target;
      if (menu?.id !== "zenFolderActions") return;
      const node = menu.triggerNode;
      menuFolder = node?.closest?.("zen-folder") || null;
      // a Library copy opens the menu for its real folder
      if (menuFolder && !gBrowser.tabContainer.contains(menuFolder)) menuFolder = null;
      // Zia's Change icon submenu; the styles are Zia's drawings, so without
      // Zia there's nothing to pick between
      const popup = menu.querySelector(".zia-own-icon-menu > menupopup");
      const show = enabled() && !!popup && !!menuFolder?.querySelector(".zia-fi");
      if (popup && !item) {
        separator = document.createXULElement("menuseparator");
        item = document.createXULElement("menuitem");
        item.id = "zcfs-menuitem";
        item.setAttribute("label", "Folder style…");
        item.addEventListener("command", () => {
          const f = menuFolder;
          // let the menu close first, so the panel anchors to the folder
          if (f) setTimeout(() => openFor(f), 0);
        });
        popup.append(separator, item);
      }
      if (item) item.hidden = separator.hidden = !show;
    },
    true
  );

  // ---------- keep every folder's attribute right ----------

  Services.prefs.addObserver(PREF, applyAll);
  Services.prefs.addObserver(ON_PREF, applyAll);

  // New folders, and folders moved to another space. Only folders matter, so
  // the callback skips everything else cheaply.
  const observer = new MutationObserver(records => {
    let c = null;
    for (const r of records) {
      if (r.type === "attributes") {
        if (r.target.localName === "zen-folder") applyTo(r.target, (c ??= readChoices()));
        continue;
      }
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.localName === "zen-folder") applyTo(n, (c ??= readChoices()));
        else if (n.firstElementChild && n.querySelector("zen-folder")) {
          for (const f of n.querySelectorAll("zen-folder")) applyTo(f, (c ??= readChoices()));
        }
      }
    }
  });
  const start = () => {
    observer.observe(gBrowser.tabContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["zen-workspace-id"] });
    applyAll();
  };
  if (gBrowser?.tabContainer) start();
  else window.addEventListener("load", start, { once: true });

  window.addEventListener("unload", () => {
    observer.disconnect();
    Services.prefs.removeObserver(PREF, applyAll);
    Services.prefs.removeObserver(ON_PREF, applyAll);
  }, { once: true });
})();
