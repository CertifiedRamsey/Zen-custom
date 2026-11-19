// ==UserScript==
// @name           zen-custom: Shortcut Guide
// @description    Ctrl+, opens a searchable list of every shortcut: Zen's, Firefox's, add-ons' and zen-custom's.
// @include        main
// ==/UserScript==
//
// Press Ctrl+, anywhere in Zen (also on pages that use the key themselves) and
// a panel opens in the middle of the window listing every shortcut, with a
// search box. Esc, Ctrl+, again or a click outside closes it.
//
// Zen's and Firefox's shortcuts are read live from the same list as
// about:keyboard, so a shortcut you change there shows up changed here, and
// a new Zen version's new shortcuts show up by themselves. Add-on shortcuts
// come from the add-ons themselves. zen-custom's own are listed below.
//
// Light on memory and CPU: until you press Ctrl+, this is one key listener.
// The panel is built when it opens and thrown away when it closes.
// Switch off with zen-custom.shortcut-guide = false.

(() => {
  "use strict";

  // Sine can run a script twice in the same window.
  const loadedMark = "zc-loaded-shortcutGuide";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const PREF = "zen-custom.shortcut-guide";
  const HTML = "http://www.w3.org/1999/xhtml";
  const pref = (name, fallback = true) => Services.prefs.getBoolPref(name, fallback);

  // zen-custom's own shortcuts, each shown only while its feature is on.
  function ourShortcuts() {
    const spaceKeys = pref("zen-custom.space-keys");
    const ziaAlt =
      pref("zia.features.tab-numbers") &&
      Services.prefs.getStringPref("zia.tab-numbers.key", "cmd") === "alt";
    const list = [
      ["Open this shortcut guide", "Ctrl+,"],
    ];
    if (spaceKeys && !ziaAlt) {
      list.push(["Go to space 1 to 9", "Alt+1 … 9"], ["Go to space 10", "Alt+0"]);
    }
    if (spaceKeys) {
      list.push(["Next space", "Ctrl+Alt+→"], ["Previous space", "Ctrl+Alt+←"]);
    }
    if (spaceKeys && pref("zen-custom.space-keys.send")) {
      list.push(["Move tab to space 1 to 9 (and go there)", "Alt+Shift+1 … 9"],
        ["Move tab to space 10", "Alt+Shift+0"]);
    }
    if (spaceKeys && pref("zen-custom.space-keys.badges") && !ziaAlt) {
      list.push(["Show space numbers", "Hold Alt"]);
    }
    if (pref("zen-custom.ctrl-tab")) {
      list.push(["Next awake tab in this space", "Ctrl+Tab"],
        ["Tab picker (keep holding Ctrl)", "Hold Ctrl+Tab"],
        ["Search all tabs, every space", "Ctrl+Alt+Space"]);
    }
    if (pref("zen-custom.tab-monitor")) {
      list.push(["Tab Monitor (memory and CPU per tab)", "Shift+Esc"],
        ["Tab Monitor (other key)", "Ctrl+Alt+M"]);
    }
    if (pref("zen-custom.pdf-night")) {
      list.push(["Night mode for PDFs", "Alt+N"]);
    }
    return list.map(([title, shortcut]) => ({ title, shortcut }));
  }

  // Shortcuts that add-ons set up (about:addons > Manage Extension Shortcuts).
  async function addonShortcuts() {
    const out = [];
    for (const policy of WebExtensionPolicy.getActiveExtensions()) {
      try {
        const shortcuts = policy.extension?.shortcuts;
        if (!shortcuts) continue;
        for (const cmd of await shortcuts.allCommands()) {
          if (!cmd.shortcut) continue;
          const what = cmd.description ||
            ({ _execute_browser_action: "Open", _execute_action: "Open",
              _execute_sidebar_action: "Open sidebar", _execute_page_action: "Open (address bar)" })[cmd.name] ||
            cmd.name;
          out.push({ title: `${policy.name}: ${what}`, shortcut: cmd.shortcut });
        }
      } catch (e) {
        console.error("[zen-custom shortcut guide] Couldn't read an add-on's shortcuts:", e);
      }
    }
    return out;
  }

  // Zen's and Firefox's, the same list about:keyboard shows.
  async function browserShortcuts() {
    try {
      const { ZenKeyboardShortcuts } = ChromeUtils.importESModule("resource:///modules/zen/kbs/ZenKeyboardShortcuts.sys.mjs");
      const categories = await ZenKeyboardShortcuts.getShortcuts(window);
      return categories
        .map(c => ({ label: c.label, keys: c.keys.filter(k => k.shortcut) }))
        .filter(c => c.keys.length);
    } catch (e) {
      console.error("[zen-custom shortcut guide] Couldn't read Zen's shortcuts:", e);
      return null;
    }
  }

  // ---------- the panel ----------

  const css = `
    #zc-keys-guide { position: fixed; inset: 0; z-index: 2147483645; display: flex; align-items: flex-start;
      justify-content: center; padding-top: 12vh; background: rgba(0,0,0,.32); font: menu; font-size: 13.5px;
      animation: zcKeysFade .12s ease-out; }
    #zc-keys-guide .box { width: min(640px, calc(100vw - 40px)); max-height: 72vh; display: flex; flex-direction: column;
      border-radius: 14px; overflow: hidden; color: light-dark(#1d1d1f, #ececef);
      background: light-dark(#fff, #222226); border: 1px solid light-dark(rgba(0,0,0,.08), rgba(255,255,255,.08));
      box-shadow: 0 24px 64px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.12); animation: zcKeysPop .14s ease-out; }
    #zc-keys-guide .top { display: flex; align-items: center; gap: 10px; padding: 14px 16px;
      border-bottom: 1px solid light-dark(rgba(0,0,0,.07), rgba(255,255,255,.07)); }
    #zc-keys-guide .top svg { flex: none; opacity: .5; }
    #zc-keys-guide input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: inherit;
      font: inherit; font-size: 16px; padding: 0; appearance: none; }
    #zc-keys-guide input::placeholder { color: light-dark(#8a8a90, #8c8c94); }
    #zc-keys-guide .count { flex: none; font-size: 12px; color: light-dark(#8a8a90, #8c8c94); }
    #zc-keys-guide .list { overflow-y: auto; padding: 6px 8px 10px; overscroll-behavior: contain; }
    #zc-keys-guide h3 { margin: 12px 8px 4px; font-size: 11.5px; font-weight: 600; letter-spacing: .02em;
      text-transform: uppercase; color: light-dark(#8a8a90, #8c8c94); }
    #zc-keys-guide .row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 6px 8px; border-radius: 7px; }
    #zc-keys-guide .row:hover { background: light-dark(rgba(0,0,0,.04), rgba(255,255,255,.05)); }
    #zc-keys-guide .row .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #zc-keys-guide .row .mine { margin-left: 6px; font-size: 11px; color: var(--zen-primary-color, #5b6cff); }
    #zc-keys-guide .keys { flex: none; display: flex; gap: 4px; }
    #zc-keys-guide kbd { font: 600 11.5px/1 system-ui, sans-serif; min-width: 20px; text-align: center;
      padding: 4px 6px; border-radius: 5px; color: inherit; background: light-dark(#f3f3f5, #2f2f35);
      border: 1px solid light-dark(rgba(0,0,0,.1), rgba(255,255,255,.1)); border-bottom-width: 2px; }
    #zc-keys-guide .empty { padding: 28px 8px; text-align: center; color: light-dark(#8a8a90, #8c8c94); }
    #zc-keys-guide .foot { padding: 8px 16px; font-size: 12px; color: light-dark(#8a8a90, #8c8c94);
      border-top: 1px solid light-dark(rgba(0,0,0,.07), rgba(255,255,255,.07)); }
    @keyframes zcKeysFade { from { opacity: 0; } }
    @keyframes zcKeysPop { from { opacity: 0; transform: translateY(-6px) scale(.985); } }
    @media (prefers-reduced-motion: reduce) { #zc-keys-guide, #zc-keys-guide .box { animation: none; } }
  `;

  const el = (tag, cls, text) => {
    const n = document.createElementNS(HTML, tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // "Ctrl+Shift+T" -> three keycaps; "Ctrl++" keeps its plus.
  function keycaps(shortcut) {
    const box = el("span", "keys");
    for (const part of shortcut.split(/\+(?!$)/)) box.append(el("kbd", null, part));
    return box;
  }

  let overlay = null;
  let opening = false;
  let returnFocus = null;

  async function open() {
    if (overlay || opening) return;
    opening = true;
    returnFocus = document.commandDispatcher?.focusedElement ?? null;
    try {
      const browser = await browserShortcuts();
      const sections = [{ label: "zen-custom", keys: ourShortcuts(), mine: true }];
      const addons = await addonShortcuts();
      if (addons.length) sections.push({ label: "Add-ons", keys: addons });
      if (browser) sections.push(...browser);
      build(sections, !browser);
    } finally {
      opening = false;
    }
  }

  function build(sections, browserFailed) {
    if (!document.getElementById("zc-keys-guide-style")) {
      const style = el("style");
      style.id = "zc-keys-guide-style";
      style.textContent = css;
      (document.body || document.documentElement).append(style);
    }
    overlay = el("div");
    overlay.id = "zc-keys-guide";
    const box = el("div", "box");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Keyboard shortcuts");

    const top = el("div", "top");
    top.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.6"/><path d="m10.5 10.5 3.5 3.5"/></svg>';
    const input = el("input");
    input.type = "search";
    input.placeholder = "Search shortcuts (try “space”, “tab” or “Ctrl+Shift”)";
    const count = el("span", "count");
    top.append(input, count);

    const list = el("div", "list");
    const rows = [];
    for (const s of sections) {
      if (!s.keys.length) continue;
      const sec = el("section");
      sec.append(el("h3", null, s.label));
      for (const k of s.keys) {
        const row = el("div", "row");
        const t = el("span", "t", k.title);
        if (k.isCustomized) t.append(el("span", "mine", "changed"));
        row.append(t, keycaps(k.shortcut));
        row.dataset.find = `${k.title} ${k.shortcut} ${s.label}`.toLowerCase();
        sec.append(row);
        rows.push(row);
      }
      list.append(sec);
    }
    const empty = el("div", "empty", "No shortcut matches that.");
    empty.hidden = true;
    list.append(empty);

    const foot = el("div", "foot", browserFailed
      ? "Couldn't read Zen's own shortcuts this time; about:keyboard has the full list."
      : "Change Zen's and Firefox's shortcuts in about:keyboard. Esc closes.");

    box.append(top, list, foot);
    overlay.append(box);
    (document.body || document.documentElement).append(overlay);

    const filter = () => {
      const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const row of rows) {
        const hit = words.every(w => row.dataset.find.includes(w));
        row.hidden = !hit;
        if (hit) shown++;
      }
      for (const sec of list.querySelectorAll("section")) {
        sec.hidden = !sec.querySelector(".row:not([hidden])");
      }
      empty.hidden = shown > 0;
      count.textContent = words.length ? `${shown} found` : `${rows.length} shortcuts`;
    };
    input.addEventListener("input", filter);
    overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });
    filter();
    input.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    // back to where you were typing, or the page
    if (returnFocus?.isConnected) returnFocus.focus();
    else gBrowser.selectedBrowser?.focus();
    returnFocus = null;
  }

  // Capture phase on the window, so a page can't take Ctrl+, first.
  window.addEventListener("keydown", e => {
    if (overlay && e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
      return;
    }
    if (e.code !== "Comma" || e.altKey || e.shiftKey || e.getModifierState("AltGraph")) return;
    if (!e.ctrlKey || e.metaKey) return;
    if (!Services.prefs.getBoolPref(PREF, true)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (overlay) close();
    else open();
  }, true);

  // A tab or space switch, or the window losing focus, closes it.
  window.addEventListener("TabSelect", close);
  window.addEventListener("blur", () => { if (overlay && !document.hasFocus()) close(); });
})();
