// ==UserScript==
// @name           zen-custom: Space Keys
// @description    Space shortcuts that always work, plus a name flash, number badges and send-tab-to-space.
// @include        main
// ==/UserScript==
//
// Alt+1 ... Alt+9 go to space 1-9 (Alt+0 to space 10), Ctrl+Alt+Right and
// Ctrl+Alt+Left go to the next and previous space. These are Zen's own
// defaults on Windows, but Zen's versions are ordinary shortcuts: a page that
// uses the same keys (Google Docs, Notion and other web apps do) gets them
// first and they never reach Zen, and since 1.24 they can be changed or lost
// in about:keyboard. This catches the keys before the page does and switches
// space itself, so they always work and nothing in settings changes them.
// Switch off with zen-custom.space-keys = false (Zen's own shortcuts then
// behave as before). If Zia's tab numbers are set to Alt, Alt+digits are left
// to Zia.
//
// Also, each with its own switch:
// - zen-custom.space-keys.flash: after a keyboard switch, the space's name
//   shows for a moment at the top of the window.
// - zen-custom.space-keys.badges: hold Alt and each space icon at the bottom
//   of the sidebar gets its number (drawn by modules/space-badges.css).
// - zen-custom.space-keys.send: Alt+Shift+1 ... 9 (0 = space 10) moves the
//   tab you're on (or the selected tabs) to that space and goes with it, the
//   same as right-click > Move to space.

(() => {
  "use strict";

  // Sine can run a script twice in the same window; the second copy would
  // switch spaces twice per key press.
  // The mark goes on the window's root element, which every copy can see.
  const loadedMark = "zc-loaded-spaceKeys";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const PREF = "zen-custom.space-keys";
  const HTML = "http://www.w3.org/1999/xhtml";

  // read on each use, so switching the prefs off works without a restart
  const enabled = () => Services.prefs.getBoolPref(PREF, true);
  const sub = name => enabled() && Services.prefs.getBoolPref(`${PREF}.${name}`, true);

  // Zen's own commands, so a switch behaves exactly like Zen's shortcut
  // (private windows, the space-switch animation and so on).
  function run(commandId, fallback) {
    const cmd = document.getElementById(commandId);
    if (cmd) cmd.doCommand();
    else fallback();
  }

  // Zia's tab numbers (hold a key, type a tab's number) can be set to Alt,
  // and then Alt+digits are Zia's: only the arrows stay with spaces.
  // Zia only listens for them while its tab-numbers feature is on.
  const ziaOwnsAltDigits = () =>
    Services.prefs.getBoolPref("zia.features.tab-numbers", true) &&
    Services.prefs.getStringPref("zia.tab-numbers.key", "cmd") === "alt";

  const digitIndex = e => {
    const m = /^Digit([0-9])$/.exec(e.code);
    return m ? (m[1] === "0" ? 9 : Number(m[1]) - 1) : -1;
  };

  // What a key press means: a space number (0-based), a step, a space to
  // send the tab to, or nothing.
  function action(e) {
    if (e.metaKey || e.getModifierState("AltGraph")) return null;
    if (e.shiftKey) {
      if (e.altKey && !e.ctrlKey && sub("send") && digitIndex(e) !== -1) return { send: digitIndex(e) };
      return null;
    }
    if (e.altKey && !e.ctrlKey && !ziaOwnsAltDigits() && digitIndex(e) !== -1) {
      return { index: digitIndex(e) };
    }
    if (e.altKey && e.ctrlKey) {
      if (e.code === "ArrowRight") return { step: 1 };
      if (e.code === "ArrowLeft") return { step: -1 };
    }
    return null;
  }

  // Capture phase on the window: chrome sees the key before the page does,
  // so a page can't swallow it. The same event can come back from the page;
  // it's eaten again then, so Zen's own shortcut doesn't switch a second time.
  let lastStamp = 0;
  window.addEventListener("keydown", e => {
    const a = action(e);
    if (!a || !enabled()) return;
    if (document.documentElement.hasAttribute("zen-little-window")) return;
    // The Ctrl+Tab switcher (ctrl-tab-switcher.uc.js) uses the arrows while
    // it's open, and Ctrl+Alt is still held after Ctrl+Alt+Space opened it.
    // Script load order isn't guaranteed, so don't rely on it eating them first.
    if ("step" in a && document.getElementById("zcts")?.hidden === false) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat || e.timeStamp === lastStamp) return;
    lastStamp = e.timeStamp;
    hideBadges();
    const ws = window.gZenWorkspaces;
    if ("send" in a) {
      sendTabs(a.send);
      return;
    }
    const before = ws?.activeWorkspace;
    if ("index" in a) {
      run(`cmd_zenWorkspaceSwitch${a.index + 1}`, () => ws?.shortcutSwitchTo(a.index));
    } else {
      run(a.step > 0 ? "cmd_zenWorkspaceForward" : "cmd_zenWorkspaceBackward",
        () => ws?.changeWorkspaceShortcut(a.step));
    }
    flashWhenSwitched(before);
  }, true);

  // ---------- send the tab to a space ----------

  async function sendTabs(index) {
    const ws = window.gZenWorkspaces;
    const target = ws?.getWorkspaces()?.[index];
    if (!target || ws.privateWindowOrDisabled) return;
    if (target.uuid === ws.activeWorkspace) {
      flash(target, "Already here");
      return;
    }
    // Essentials belong to every space, so Zen doesn't move them.
    const tabs = gBrowser.selectedTabs.filter(t => !t.hasAttribute("zen-essential"));
    if (!tabs.length) return;
    try {
      ws.moveTabsToWorkspace(tabs, target.uuid);
      // land on the moved tab, as Zen's own Move to space does
      if (ws.lastSelectedWorkspaceTabs) {
        const last = tabs[tabs.length - 1];
        ws.lastSelectedWorkspaceTabs[target.uuid] = window.gZenGlanceManager?.getTabOrGlanceParent?.(last) ?? last;
      }
      await ws.changeWorkspace(target);
      flash(target, tabs.length > 1 ? `Moved ${tabs.length} tabs` : "Moved here");
    } catch (err) {
      console.error("[zen-custom space keys] Couldn't move the tab:", err);
    }
  }

  // ---------- the name flash ----------

  const css = `
    #zc-space-flash { position: fixed; top: 14px; left: 50%; z-index: 2147483646; pointer-events: none;
      transform: translate(-50%, -8px); opacity: 0; transition: opacity .16s ease, transform .16s ease;
      padding: 6px 14px; border-radius: 999px; font: menu; font-size: 13px; font-weight: 600; white-space: nowrap;
      color: light-dark(#fff, #111); background: light-dark(rgba(20,20,24,.88), rgba(245,245,247,.92));
      box-shadow: 0 4px 18px rgba(0,0,0,.22); }
    #zc-space-flash[show] { opacity: 1; transform: translate(-50%, 0); }
    #zc-space-flash .muted { opacity: .65; font-weight: 500; }
    @media (prefers-reduced-motion: reduce) { #zc-space-flash { transition: none; } }
  `;
  const pill = document.createElementNS(HTML, "div");
  pill.id = "zc-space-flash";
  const style = document.createElementNS(HTML, "style");
  style.textContent = css;
  (document.body || document.documentElement).append(style, pill);
  let flashTimer = 0;

  function flash(space, note) {
    if (!sub("flash") || !space) return;
    const all = window.gZenWorkspaces?.getWorkspaces() ?? [];
    const pos = all.findIndex(w => w.uuid === space.uuid);
    // emoji icons only; an SVG icon path would read as text
    const icon = space.icon && !space.icon.endsWith(".svg") ? `${space.icon} ` : "";
    const muted = document.createElementNS(HTML, "span");
    muted.className = "muted";
    muted.textContent = note ? ` · ${note}` : pos >= 0 ? ` · ${pos + 1} of ${all.length}` : "";
    pill.replaceChildren(`${icon}${space.name}`, muted);
    pill.setAttribute("show", "");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => pill.removeAttribute("show"), 1100);
  }

  // Zen switches asynchronously; show the name once the space has changed.
  function flashWhenSwitched(before) {
    if (!sub("flash")) return;
    const started = performance.now();
    const check = () => {
      const ws = window.gZenWorkspaces;
      const now = ws?.activeWorkspace;
      if (now && now !== before) {
        flash(ws.getWorkspaceFromId(now));
      } else if (performance.now() - started < 800) {
        setTimeout(check, 30);
      }
    };
    check();
  }

  // ---------- number badges while Alt is held ----------

  // Shown after a short hold, so a quick Alt+key doesn't make them blink.
  let badgeTimer = 0;
  const root = document.documentElement;
  function hideBadges() {
    clearTimeout(badgeTimer);
    root.removeAttribute("zc-alt-held");
  }
  window.addEventListener("keydown", e => {
    if (e.key !== "Alt" || e.repeat) {
      if (e.key !== "Alt") hideBadges();
      return;
    }
    if (e.ctrlKey || e.shiftKey || e.metaKey || e.getModifierState("AltGraph")) return;
    if (!sub("badges") || ziaOwnsAltDigits()) return;
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => root.setAttribute("zc-alt-held", ""), 250);
  }, true);
  window.addEventListener("keyup", e => { if (e.key === "Alt" || !e.altKey) hideBadges(); }, true);
  window.addEventListener("blur", hideBadges);
  window.addEventListener("mousedown", hideBadges, true);
})();
