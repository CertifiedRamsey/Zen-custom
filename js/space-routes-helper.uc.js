// ==UserScript==
// @name           Space Routes Helper
// @description    Adds a "Routes" button to each space card in the Library that opens a step-by-step route builder.
// @include        main
// ==/UserScript==

// Turn off live with zen-custom.routes-helper = false in about:config.
// Saves through Zen's own Space Routing manager, so routes made here also
// show up in Zen's Space Routing Settings dialog and keep working without
// this script.

(() => {
  const PREF = "zen-custom.routes-helper";
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const MOST_RECENT = "most-recent-space";

  let manager;
  try {
    ({ gZenSpaceRoutingManager: manager } = ChromeUtils.importESModule(
      "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs"
    ));
  } catch (e) {
    console.error("[Space Routes Helper] Space Routing is not available in this Zen version.", e);
    return;
  }

  const enabled = () => Services.prefs.getBoolPref(PREF, true);

  const CSS = `
    .zch-routes-pill {
      appearance: none; font: inherit; font-size: 11px; font-weight: 600;
      color: inherit; cursor: pointer; border-radius: 999px; padding: 3px 9px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
      background: color-mix(in srgb, currentColor 10%, transparent);
      margin-inline: auto 4px;
    }
    .zch-routes-pill:hover { background: color-mix(in srgb, currentColor 18%, transparent); }
    #zch-routes-panel { --panel-padding: 0; }
    #zch-routes-panel .zch { width: 380px; padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
    #zch-routes-panel h3 { margin: 0; font-size: 14px; }
    #zch-routes-panel .zch-label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; opacity: .65; }
    #zch-routes-panel .zch-step { display: flex; flex-direction: column; gap: 6px; }
    #zch-routes-panel input[type=text] { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; margin: 0; }
    #zch-routes-panel .zch-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    #zch-routes-panel .zch-chip { appearance: none; font: inherit; font-size: 11px; cursor: pointer; color: inherit;
      background: transparent; border: 1px dashed color-mix(in srgb, currentColor 35%, transparent); border-radius: 999px; padding: 2px 8px; }
    #zch-routes-panel .zch-chip:hover { border-style: solid; }
    #zch-routes-panel .zch-scope { display: flex; flex-direction: column; gap: 4px; }
    #zch-routes-panel .zch-scope label { display: flex; gap: 8px; align-items: flex-start; padding: 7px 8px; border-radius: 8px; cursor: pointer;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
    #zch-routes-panel .zch-scope label:has(input:checked) { border-color: var(--zen-primary-color, AccentColor);
      background: color-mix(in srgb, var(--zen-primary-color, AccentColor) 14%, transparent); }
    #zch-routes-panel .zch-scope small, #zch-routes-panel code { font-family: monospace; font-size: 11px; opacity: .8; overflow-wrap: anywhere; }
    #zch-routes-panel .zch-sentence { padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, currentColor 7%, transparent); }
    #zch-routes-panel .zch-warn { padding: 8px 10px; border-radius: 8px; border: 1px solid #d9a93c; background: color-mix(in srgb, #d9a93c 12%, transparent); }
    #zch-routes-panel .zch-err { color: #e07070; font-size: 11px; }
    #zch-routes-panel .zch-row { display: flex; gap: 6px; justify-content: flex-end; }
    #zch-routes-panel .zch-rule { display: flex; gap: 8px; align-items: center; padding: 5px 8px; border-radius: 6px;
      background: color-mix(in srgb, currentColor 6%, transparent); }
    #zch-routes-panel .zch-rule span:nth-child(2) { flex: 1; min-width: 0; }
    #zch-routes-panel .zch-rule .zch-n { font-size: 10px; opacity: .55; }
    #zch-routes-panel .zch-link { appearance: none; background: none; border: none; color: inherit; opacity: .7; cursor: pointer; font: inherit; font-size: 11px; }
    #zch-routes-panel .zch-link:hover { opacity: 1; text-decoration: underline; }
    #zch-routes-panel .zch-muted { opacity: .65; }
    #zch-routes-panel hr { border: none; border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); margin: 0; width: 100%; }
  `;
  window.windowUtils.loadSheetUsingURIString(
    "data:text/css;charset=utf-8," + encodeURIComponent(CSS),
    window.windowUtils.AUTHOR_SHEET
  );

  // ---------- helpers ----------

  const h = (tag, props = {}, ...kids) => {
    const el = document.createElementNS(HTML_NS, tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid != null && kid !== false) el.append(kid);
    }
    return el;
  };

  const spaceName = id =>
    id === MOST_RECENT ? "the space I used last" : gZenWorkspaces.getWorkspaceFromId(id)?.name ?? "a deleted space";

  function parseSite(raw) {
    let t = (raw || "").trim();
    if (!t) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = "https://" + t;
    try {
      const u = new URL(t);
      const host = u.host.replace(/^www\./i, "");
      if (!host.includes(".") && !host.startsWith("localhost")) return null;
      const path = u.pathname.replace(/\/$/, "");
      return { host, path, full: host + path + u.search };
    } catch {
      return null;
    }
  }

  function describe(route) {
    const ref = h("code", {}, route.reference);
    if (route.matchType === "contains") return ["Links containing ", ref];
    if (route.matchType === "equal-to") return ["Exactly ", ref];
    return ["Links matching ", ref];
  }

  const save = () => manager.saveRoutes();

  function snapshot() {
    return manager.getAllRoutes();
  }

  // Zen has no bulk setter, so an undo rebuilds the list in its old order.
  function restore(routes) {
    for (const r of manager.getAllRoutes()) manager.removeRoute(r.id);
    for (const r of routes) {
      const fresh = manager.createNewRoute();
      manager.updateRoute({ ...r, id: fresh.id });
    }
    save();
  }

  function tabHostsInSpace(spaceId) {
    const hosts = [];
    for (const tab of gBrowser.tabs) {
      if (tab.getAttribute("zen-workspace-id") !== spaceId) continue;
      try {
        const uri = tab.linkedBrowser.currentURI;
        if (!/^https?$/.test(uri.scheme)) continue;
        const host = uri.hostPort.replace(/^www\./i, "");
        if (host && !hosts.includes(host)) hosts.push(host);
      } catch {}
    }
    return hosts;
  }

  // ---------- panel ----------

  let panel, body, currentSpace, anchorPill;
  const draft = { input: "", scope: "site", adv: "" };
  let lastUndo = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createXULElement("panel");
    panel.id = "zch-routes-panel";
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautofocus", "true");
    body = h("div", { class: "zch" });
    panel.append(body);
    panel.addEventListener("popuphidden", () => {
      lastUndo = null;
      refreshPills();
    });
    document.getElementById("mainPopupSet").append(panel);
    return panel;
  }

  function openFor(spaceId, pill) {
    ensurePanel();
    currentSpace = spaceId;
    anchorPill = pill;
    Object.assign(draft, { input: "", scope: "site", adv: "" });
    lastUndo = null;
    render();
    panel.openPopup(pill, "after_end");
    body.querySelector("#zch-site")?.focus();
  }

  function draftRoute() {
    if (draft.adv.trim()) {
      try {
        new RegExp(draft.adv.trim());
      } catch {
        return null;
      }
      return { reference: draft.adv.trim(), matchType: "regex" };
    }
    const p = parseSite(draft.input);
    if (!p) return null;
    if (draft.scope === "section") {
      const first = p.path.split("/").filter(Boolean)[0];
      return { reference: first ? `${p.host}/${first}` : p.host, matchType: "contains" };
    }
    if (draft.scope === "page") return { reference: p.full, matchType: "equal-to" };
    return { reference: p.host, matchType: "contains" };
  }

  // A route that already catches the draft's site, so saving would clash.
  function findClash(d) {
    const ref = d.reference.toLowerCase();
    return manager
      .getAllRoutes()
      .find(r => r.reference.toLowerCase() === ref || (d.matchType !== "regex" && manager.isRouteMatching("https://" + d.reference, r)));
  }

  function render() {
    const name = spaceName(currentSpace);
    const all = manager.getAllRoutes();
    const mine = all.map((r, i) => ({ r, i })).filter(x => x.r.openIn === currentSpace);
    const suggestions = tabHostsInSpace(currentSpace).filter(host => !mine.some(x => x.r.reference.toLowerCase() === host.toLowerCase()));

    const siteInput = h("input", {
      type: "text", id: "zch-site", placeholder: "Paste a link, or type a site like amboss.com", value: draft.input,
      oninput: e => { draft.input = e.target.value; renderDraft(); },
    });
    const advInput = h("input", {
      type: "text", id: "zch-adv", placeholder: "e.g. github\\.com/halosystems", value: draft.adv,
      oninput: e => { draft.adv = e.target.value; renderDraft(); },
    });

    // flattened and null-free like h()'s children: replaceChildren would
    // print an array or a null as text ("[object HTMLDivElement]", "null")
    const kids = [
      h("h3", {}, `Send a site to ${name}`),
      h("div", { class: "zch-step" },
        h("span", { class: "zch-label" }, "1 · Which site?"),
        siteInput,
        suggestions.length
          ? h("div", { class: "zch-chips" },
              h("span", { class: "zch-muted" }, "Open here now:"),
              suggestions.slice(0, 6).map(host =>
                h("button", { class: "zch-chip", onclick: () => { draft.input = host; draft.scope = "site"; siteInput.value = host; renderDraft(); } }, `+ ${host}`)))
          : null),
      h("div", { class: "zch-step", id: "zch-scope" }),
      h("div", { id: "zch-preview", class: "zch-step" }),
      h("details", { open: !!draft.adv },
        h("summary", { class: "zch-muted" }, "Advanced: write my own pattern"),
        h("div", { class: "zch-step" }, advInput, h("span", { class: "zch-err", id: "zch-adv-err" }))),
      h("div", { class: "zch-row" },
        h("button", { id: "zch-save", onclick: onSave }, "Save route")),
      h("hr"),
      h("span", { class: "zch-label" }, `Already going to ${name}`),
      mine.length
        ? mine.map(({ r, i }) =>
            h("div", { class: "zch-rule" },
              h("span", { class: "zch-n" }, `#${i + 1}`),
              h("span", {}, describe(r)),
              h("button", { class: "zch-link", onclick: () => onRemove(r) }, "Remove")))
        : h("span", { class: "zch-muted" }, "No routes yet. Add a site above and its links will always open here."),
      h("div", { class: "zch-step" },
        h("span", { class: "zch-label" }, "Test a link"),
        h("input", { type: "text", placeholder: "Paste any link to see where it opens", oninput: e => onTest(e.target.value) }),
        h("div", { class: "zch-sentence", id: "zch-test" }, "Paste a link above.")),
      lastUndo
        ? h("div", { class: "zch-row" },
            h("span", { class: "zch-muted" }, lastUndo.msg),
            h("button", { class: "zch-link", onclick: onUndo }, "Undo"))
        : null,
    ];
    body.replaceChildren(...kids.flat().filter(k => k != null && k !== false));
    renderDraft();
  }

  function renderDraft() {
    const scope = body.querySelector("#zch-scope");
    const preview = body.querySelector("#zch-preview");
    const saveBtn = body.querySelector("#zch-save");
    const advErr = body.querySelector("#zch-adv-err");
    const usingAdv = !!draft.adv.trim();

    advErr.textContent = "";
    if (usingAdv) {
      try {
        new RegExp(draft.adv.trim());
      } catch {
        advErr.textContent = "This pattern has a typo, so Zen would ignore it.";
      }
    }

    const p = parseSite(draft.input);
    if (p && !usingAdv) {
      const first = p.path.split("/").filter(Boolean)[0];
      const opts = [["site", "The whole site", p.host]];
      if (first) opts.push(["section", "Only this part of the site", `${p.host}/${first}/…`]);
      if (p.path) opts.push(["page", "Only this exact page", p.full]);
      if (!opts.some(o => o[0] === draft.scope)) draft.scope = "site";
      scope.replaceChildren(
        h("span", { class: "zch-label" }, "2 · How much of it?"),
        h("div", { class: "zch-scope" },
          opts.map(([value, title, example]) =>
            h("label", {},
              h("input", { type: "radio", name: "zch-scope", value, checked: draft.scope === value, onchange: () => { draft.scope = value; renderDraft(); } }),
              h("span", {}, h("b", {}, title), h("br"), h("small", {}, example)))))
      );
    } else if (draft.input.trim() && !usingAdv) {
      scope.replaceChildren(h("span", { class: "zch-err" }, "That doesn't look like a link or a site. Try something like amboss.com or localhost:5173."));
    } else {
      scope.replaceChildren();
    }

    const d = draftRoute();
    saveBtn.disabled = !d;
    if (!d) {
      preview.replaceChildren();
      return;
    }
    const kids = [h("div", { class: "zch-sentence" }, describe(d), " will always open in ", h("b", {}, spaceName(currentSpace)), ".")];
    const clash = findClash(d);
    if (clash && clash.openIn !== currentSpace) {
      kids.push(h("div", { class: "zch-warn" }, h("b", {}, clash.reference), " already goes to ", h("b", {}, spaceName(clash.openIn)), ". Saving will move it here."));
    } else if (clash) {
      kids.push(h("div", { class: "zch-warn" }, "This is already covered by a route to this space."));
      saveBtn.disabled = true;
    }
    preview.replaceChildren(...kids);
  }

  function onSave() {
    const d = draftRoute();
    if (!d) return;
    const before = snapshot();
    const clash = findClash(d);
    if (clash && clash.openIn !== currentSpace) {
      // Move the old route instead of adding a second one that would never win.
      manager.updateRoute({ ...clash, reference: d.reference, matchType: d.matchType, openIn: currentSpace });
    } else {
      const route = manager.createNewRoute();
      manager.updateRoute({ ...route, ...d, openIn: currentSpace });
    }
    save();
    lastUndo = { routes: before, msg: `Saved. ${d.reference} now opens in ${spaceName(currentSpace)}.` };
    Object.assign(draft, { input: "", scope: "site", adv: "" });
    render();
  }

  function onRemove(route) {
    const before = snapshot();
    manager.removeRoute(route.id);
    save();
    lastUndo = { routes: before, msg: `Removed ${route.reference}.` };
    render();
  }

  function onUndo() {
    if (!lastUndo) return;
    restore(lastUndo.routes);
    lastUndo = null;
    render();
  }

  function onTest(value) {
    const out = body.querySelector("#zch-test");
    const url = value.trim();
    if (!url) {
      out.textContent = "Paste a link above.";
      return;
    }
    const full = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : "https://" + url;
    const routes = manager.getAllRoutes();
    const i = routes.findIndex(r => manager.isRouteMatching(full, r));
    if (i !== -1) {
      out.replaceChildren("Opens in ", h("b", {}, spaceName(routes[i].openIn)), `, because of route #${i + 1} (`, ...describe(routes[i]), ").");
    } else {
      out.replaceChildren("No route matches. Clicked inside a page, it stays where you are. From another app, it opens in ",
        h("b", {}, spaceName(manager.getDefaultExternalRoute())), ".");
    }
  }

  // ---------- pills on the Library's space cards ----------

  function pillLabel(spaceId) {
    const n = manager.getAllRoutes().filter(r => r.openIn === spaceId).length;
    return `Routes · ${n}`;
  }

  function refreshPills() {
    for (const pill of document.querySelectorAll(".zch-routes-pill")) {
      pill.textContent = pillLabel(pill.dataset.space);
    }
  }

  function inject(root = document) {
    if (!enabled()) return;
    for (const card of root.querySelectorAll(".zen-library-space[data-uuid]")) {
      const footer = card.querySelector(".zen-library-space-footer");
      if (!footer || footer.querySelector(".zch-routes-pill")) continue;
      const spaceId = card.dataset.uuid;
      const pill = h("button", {
        class: "zch-routes-pill",
        "data-space": spaceId,
        title: "Choose which sites always open in this space",
        onclick: e => { e.stopPropagation(); openFor(spaceId, pill); },
        onpointerdown: e => e.stopPropagation(),
      }, pillLabel(spaceId));
      const actions = footer.querySelector(".zen-library-space-actions");
      actions ? actions.before(pill) : footer.append(pill);
    }
  }

  function removeAll() {
    document.querySelectorAll(".zch-routes-pill").forEach(p => p.remove());
    panel?.hidePopup();
  }

  // The Library builds its sections lazily and re-renders cards, so watch for
  // them. Only a new space card (or something holding one) needs a pill, so
  // the many rows the Library builds while you browse folders are skipped
  // without touching the page; and once the Library exists, only it is
  // watched instead of the whole window.
  const CARD = ".zen-library-space[data-uuid]";
  const bringsCard = n =>
    n.nodeType === 1 && (n.matches(CARD) || (n.firstElementChild && !n.closest(".zen-library-space-tabs") && n.querySelector(CARD)));
  let queued = false;
  let watching = null;
  const observer = new MutationObserver(records => {
    if (!watching) watchLibrary();
    if (queued) return;
    if (!records.some(r => [...r.addedNodes].some(bringsCard))) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      inject(watching || document);
    });
  });
  function watchLibrary() {
    const library = document.querySelector("zen-library");
    if (!library || library === watching) return;
    watching = library;
    observer.disconnect();
    observer.observe(library, { childList: true, subtree: true });
  }
  watchLibrary();
  if (!watching) observer.observe(document.documentElement, { childList: true, subtree: true });
  inject();

  Services.prefs.addObserver(PREF, () => (enabled() ? inject() : removeAll()));
  window.addEventListener("unload", () => observer.disconnect(), { once: true });
})();
