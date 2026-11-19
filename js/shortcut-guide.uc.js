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
// At the top, "Open" and "Spaces and containers" list places you'd otherwise
// go through the sidebar or menus for: Zen's and Zia's settings (and Zen's
// settings pages), Sine mods, downloads, history, new space, rename space,
// new container, a new tab in each of your containers, and more. Each runs
// Zen's own command and is listed only when this Zen has it. Type a few
// letters and press Enter, or click one. Restart asks twice.
//
// Zen's and Firefox's shortcuts (Zen's own plus everything in Firefox's
// menus) are read live, so a shortcut you change in about:keyboard shows up
// changed here. about:keyboard still has the complete list. Add-on shortcuts
// come from the add-ons you have on; Zia's and zen-custom's own are listed
// below, each only while its feature is switched on.
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

  // Zia's tab numbers, if Zia runs here with them on: "ctrl", "alt" or null.
  const ziaNumbersKey = () =>
    document.documentElement.hasAttribute("zia-js") && pref("zia.features.tab-numbers")
      ? (Services.prefs.getStringPref("zia.tab-numbers.key", "cmd") === "alt" ? "alt" : "ctrl")
      : null;

  // Keys another script takes over, so the original owner's row would be wrong
  // or a duplicate.
  function takenOver() {
    const skip = new Set();
    const zia = ziaNumbersKey();
    if (pref("zen-custom.space-keys")) {
      // listed in the zen-custom section instead
      skip.add("zen-workspace-forward").add("zen-workspace-backward");
      for (let i = 1; i <= 10; i++) skip.add(`zen-workspace-switch-${i}`);
    }
    if (zia === "alt") for (let i = 1; i <= 10; i++) skip.add(`zen-workspace-switch-${i}`);
    if (zia === "ctrl") {
      for (let i = 1; i <= 8; i++) skip.add(`key_selectTab${i}`);
      skip.add("key_selectLastTab");
    }
    if (pref("zen-custom.tab-monitor")) skip.add("key_aboutProcesses"); // Shift+Esc
    return skip;
  }

  // zen-custom's own shortcuts, each shown only while its feature is on.
  function ourShortcuts() {
    const spaceKeys = pref("zen-custom.space-keys");
    const ziaAlt = ziaNumbersKey() === "alt";
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
    if (pref("zen-custom.fake-terminal")) {
      list.push(["Fake coding screen over Zen (screensaver)", "Ctrl+Alt+L"],
        ["Leave the fake coding screen", "Ctrl+T"]);
    }
    const rows = list.map(([title, shortcut]) => ({ title, shortcut }));
    // typed in PowerShell rather than pressed; a click copies it
    rows.push({ title: "Fake coding screensaver in PowerShell (click to copy, Ctrl+T ends it)", shortcut: "zen ss", copy: "zen ss" });
    return rows;
  }

  // Zia's shortcuts, only those switched on in Zia's settings ("zia-js" on
  // the window means Zia is running here). Zia applies a switch after a
  // restart, so right after flipping one this can be a step ahead.
  function ziaShortcuts() {
    if (!document.documentElement.hasAttribute("zia-js")) return [];
    const list = [];
    const numbers = ziaNumbersKey();
    if (numbers) {
      const key = numbers === "alt" ? "Alt" : "Ctrl";
      list.push({ title: "Show tab numbers", shortcut: `Hold ${key}` },
        { title: "Go to a tab by its number (for tab 12 type 1 then 2; it opens when you let go)", shortcut: `${key}+1 … 9` });
    }
    if (pref("zia.features.undo-close")) {
      list.push({ title: "Reopen the tab you just closed (within 10 seconds)", shortcut: "Ctrl+Z" });
    }
    return list;
  }

  // Add-on key names (manifest style) as they're printed on the keyboard.
  const KEY_NAMES = { Comma: ",", Period: ".", Space: "Space", Up: "↑", Down: "↓", Left: "←", Right: "→",
    MacCtrl: "Ctrl", Command: "Ctrl", PageUp: "Page Up", PageDown: "Page Down" };
  const prettyKeys = shortcut => shortcut.split("+").map(k => KEY_NAMES[k] ?? k).join("+");

  // Shortcuts that add-ons set up (about:addons > Manage Extension Shortcuts).
  async function addonShortcuts() {
    const out = [];
    const isPrivate = window.PrivateBrowsingUtils?.isWindowPrivate(window) ?? false;
    for (const policy of WebExtensionPolicy.getActiveExtensions()) {
      try {
        if (isPrivate && !policy.privateBrowsingAllowed) continue;
        const shortcuts = policy.extension?.shortcuts;
        if (!shortcuts) continue;
        for (const cmd of await shortcuts.allCommands()) {
          if (!cmd.shortcut) continue;
          const what = cmd.description ||
            ({ _execute_browser_action: "Open", _execute_action: "Open",
              _execute_sidebar_action: "Open sidebar", _execute_page_action: "Open (address bar)" })[cmd.name] ||
            cmd.name;
          out.push({ title: `${policy.name}: ${what}`, shortcut: prettyKeys(cmd.shortcut) });
        }
      } catch (e) {
        console.error("[zen-custom shortcut guide] Couldn't read an add-on's shortcuts:", e);
      }
    }
    return out;
  }

  // Zen's own shortcuts, grouped as about:keyboard groups them (copied from
  // Zen's ZenKeyboardShortcuts.sys.mjs; a key Zen drops is skipped, and the
  // titles come from Zen's own translations).
  const ZEN_GROUPS = [
    ["zenCKSOption-group-zen-workspace", "zen-spaces-menubar", [
      ...Array.from({ length: 10 }, (_, i) => [`zen-workspace-switch-${i + 1}`, `zen-workspace-shortcut-switch-${i + 1}`]),
      ["zen-workspace-forward", null, "Next space"],
      ["zen-workspace-backward", null, "Previous space"],
      ["zen-workspace-create", "zen-workspace-shortcut-create"],
    ]],
    ["zenCKSOption-group-zen-tabs", null, [
      ["zen-toggle-pin-tab", "zen-toggle-pin-tab-shortcut"],
      ["zen-pinned-tab-reset-shortcut", "zen-pinned-tab-shortcut-reset"],
      ["zen-duplicate-tab", "zen-duplicate-tab-shortcut"],
      ["zen-close-all-unpinned-tabs", "zen-close-all-unpinned-tabs-shortcut"],
      ["zen-glance-expand", "zen-glance-expand"],
      ["zen-copy-url", "zen-text-action-copy-url-shortcut"],
      ["zen-copy-url-markdown", "zen-text-action-copy-url-markdown-shortcut"],
    ]],
    ["zenCKSOption-group-zen-split-view", null, [
      ["zen-split-view-grid", "zen-split-view-shortcut-grid"],
      ["zen-split-view-vertical", "zen-split-view-shortcut-vertical"],
      ["zen-split-view-horizontal", "zen-split-view-shortcut-horizontal"],
      ["zen-split-view-unsplit", "zen-split-view-shortcut-unsplit"],
      ["zen-new-empty-split-view", "zen-new-empty-split-view-shortcut"],
    ]],
    ["zenCKSOption-group-zen-layout", null, [
      ["zen-compact-mode-toggle", "zen-compact-mode-shortcut-toggle"],
      ["zen-compact-mode-show-sidebar", "zen-compact-mode-shortcut-show-sidebar"],
      ["zen-toggle-sidebar", "zen-sidebar-shortcut-toggle"],
      ["zen-library-toggle", "zen-library-shortcut-toggle"],
    ]],
  ];

  const FIREFOX_EXTRA = [
    ["key_restoreLastClosedTabOrWindowOrSession", "customkeys-history-reopen-tab"],
    ["key_undoCloseTab", "customkeys-history-reopen-tab-current-window"],
    ["key_undoCloseWindow", "customkeys-history-reopen-window"],
    ["goBackKb", "customkeys-nav-back"], ["goForwardKb", "customkeys-nav-forward"], ["goHome", "customkeys-nav-home"],
    ["key_reload", "customkeys-nav-reload"], ["key_reload2", "customkeys-nav-reload"],
    ["key_reload_skip_cache", "customkeys-nav-reload-skip-cache"], ["key_stop", "customkeys-nav-stop"],
    ...Array.from({ length: 8 }, (_, i) => [`key_selectTab${i + 1}`, `customkeys-nav-select-tab-${i + 1}`]),
    ["key_selectLastTab", "customkeys-nav-select-last-tab"], ["key_toggleMute", "customkeys-nav-toggle-mute"],
    ["key_duplicateTab", "customkeys-file-duplicate-tab"], ["key_copyTabURL", "customkeys-file-copy-tab-url"],
    ["key_search", "customkeys-file-focus-search"], ["key_findPrevious", "customkeys-edit-find-previous"],
    ["toggleSidebarKb", "customkeys-sidebar-toggle"], ["viewBookmarksToolbarKb", "customkeys-view-bookmarks-toolbar"],
    ["key_togglePictureInPicture", "customkeys-view-picture-in-picture"], ["key_screenshot", "customkeys-tools-screenshot"],
    ["key_toggleToolboxF12", "customkeys-dev-tools"], ["key_inspector", "customkeys-dev-inspector"],
    ["key_webconsole", "customkeys-dev-webconsole"],
  ];

  // Zen's and Firefox's shortcuts. Zen's ready-made full list
  // (ZenKeyboardShortcuts.getShortcuts) would start all of DevTools and keep
  // it in memory until restart, so this reads the keys one by one instead:
  // Zen's from the table above, Firefox's from its menu bar (File, Edit,
  // View ...). Each key's current binding, including changes made in
  // about:keyboard, comes from Zen.
  async function browserShortcuts() {
    try {
      const { ZenKeyboardShortcuts: kbs } = ChromeUtils.importESModule("resource:///modules/zen/kbs/ZenKeyboardShortcuts.sys.mjs");
      const read = id => {
        try { return document.getElementById(id) ? kbs.getShortcut(window, id) : null; } catch { return null; }
      };
      const out = [];
      const seen = takenOver();

      const zenL10n = new Localization(["browser/preferences/zen-preferences.ftl"]);
      const ids = ZEN_GROUPS.flatMap(([g, , keys]) => [g, ...keys.map(k => k[1]).filter(Boolean)]);
      const values = await zenL10n.formatValues(ids.map(id => ({ id })));
      const text = Object.fromEntries(ids.map((id, i) => [id, values[i]]));
      for (const [groupId, menuId, keys] of ZEN_GROUPS) {
        const list = [];
        for (const [id, l10nId, fallback] of keys) {
          if (seen.has(id)) continue;
          const data = read(id);
          seen.add(id);
          if (!data?.shortcut) continue;
          list.push({ ...data, title: (l10nId && text[l10nId]) || fallback || id });
        }
        const label = (menuId && document.getElementById(menuId)?.label) || text[groupId] || "";
        if (list.length) out.push({ label: label ? `Zen: ${label}` : "Zen", keys: list });
      }

      for (const menu of document.querySelectorAll("#main-menubar > menu")) {
        // the Recently Closed lists label their first item with a page title
        const items = [...menu.querySelectorAll("menuitem[key]")]
          .filter(m => !m.closest("#historyUndoMenu, #historyUndoWindowMenu"));
        // menus that were never opened may not have their labels yet
        const missing = items.filter(m => !m.label && m.getAttribute("data-l10n-id"));
        if (missing.length) {
          try {
            const msgs = await document.l10n.formatMessages(missing.map(m => ({ id: m.getAttribute("data-l10n-id") })));
            missing.forEach((m, i) => {
              m._zcLabel = msgs[i]?.attributes?.find(a => a.name === "label")?.value;
            });
          } catch {}
        }
        const list = [];
        for (const m of items) {
          const id = m.getAttribute("key");
          if (seen.has(id)) continue;
          seen.add(id);
          const data = read(id);
          const title = m.label || m._zcLabel;
          delete m._zcLabel;
          if (data?.shortcut && title) list.push({ ...data, title });
        }
        if (list.length) out.push({ label: menu.label || menu.id, keys: list });
      }

      // Keys about:keyboard lists that aren't in any menu (reopen tab, back, reload ...).
      const fxText = await new Localization(["browser/customkeys.ftl"]).formatValues(FIREFOX_EXTRA.map(([, id]) => ({ id })));
      const extra = [];
      FIREFOX_EXTRA.forEach(([id], i) => {
        if (seen.has(id)) return;
        seen.add(id);
        const data = read(id);
        if (data?.shortcut && fxText[i] && !extra.some(e => e.shortcut === data.shortcut && e.title === fxText[i])) {
          extra.push({ ...data, title: fxText[i] });
        }
      });
      if (extra.length) out.push({ label: "Navigation and more", keys: extra });
      return out;
    } catch (e) {
      console.error("[zen-custom shortcut guide] Couldn't read Zen's shortcuts:", e);
      return null;
    }
  }

  // ---------- things the guide opens ----------
  //
  // Each item runs the same command Zen's own menus and buttons run, and is
  // only listed when that command exists in this Zen, so a row can't sit
  // there doing nothing. If one still fails, the row says so.

  const openTab = url => switchToTabHavingURI(url, true, { ignoreFragment: "whenComparingAndReplace" });
  const hasCommand = id => {
    const cmd = document.getElementById(id);
    return !!cmd && cmd.getAttribute("disabled") !== "true";
  };
  const runCommand = id => {
    const cmd = document.getElementById(id);
    if (!cmd) throw new Error(`Zen has no ${id} here`);
    cmd.doCommand();
  };
  const command = id => ({ ok: () => hasCommand(id), run: () => runCommand(id) });

  // Zen's settings window (Zen 1.24+), optionally on one page of it
  function zenSettings() {
    try {
      return ChromeUtils.importESModule("resource:///modules/zen/settings/ZenSettings.sys.mjs").ZenSettings;
    } catch {
      return null;
    }
  }
  const settingsPage = pane => ({ ok: () => !!zenSettings(), run: () => zenSettings().open(pane) });

  // Containers on, and the ones you made yourself (not Temporary Containers'
  // throwaway "Patient …" ones)
  const containersOn = () => Services.prefs.getBoolPref("privacy.userContext.enabled", false);
  function containerService() {
    if (window.ContextualIdentityService) return window.ContextualIdentityService;
    for (const url of ["moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
      "resource://gre/modules/ContextualIdentityService.sys.mjs"]) {
      try { return ChromeUtils.importESModule(url).ContextualIdentityService; } catch {}
    }
    return null;
  }
  function myContainers() {
    if (!containersOn()) return [];
    const service = containerService();
    if (!service) return [];
    return service.getPublicIdentities()
      .map(c => ({ id: c.userContextId, name: service.getUserContextLabel(c.userContextId) }))
      .filter(c => c.name && !/^patient\b/i.test(c.name));
  }

  // "New container" is the + button on Zen's Containers settings page; this
  // opens that page and presses it, so you get Zen's own form.
  async function newContainer() {
    const settings = zenSettings();
    const win = settings.open("containers");
    for (let i = 0; i < 40; i++) { // up to 4 s while the window loads
      const add = win.document?.readyState === "complete" && win.gZenSettingsWindow &&
        win.document.querySelector('[data-action="containers-add"]');
      if (add) {
        add.click();
        return;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error("Zen's Containers page has no add button");
  }

  // Zia opens its settings only from the "Zia Settings" item it adds to the
  // ⋯ menu the first time that menu opens.
  async function openZiaSettings() {
    let item = document.getElementById("zia-settings-menu-button");
    if (!item) {
      const popup = document.getElementById("appMenu-popup");
      const shown = new Promise(done => {
        popup?.addEventListener("popupshown", () => done(true), { once: true });
        setTimeout(() => done(false), 5000);
      });
      PanelUI.show();
      const opened = await shown;
      item = document.getElementById("zia-settings-menu-button");
      if (!item) {
        if (opened) PanelUI.hide();
        openPreferences("paneSineMods"); // Zia's settings are also under Zia there
        return;
      }
    }
    item.doCommand(); // also closes the ⋯ menu
  }

  function restartZen() {
    // the same steps as Firefox's own Restart (about:support): open pages
    // can say no, and Zen brings your windows and tabs back
    const cancel = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
    Services.obs.notifyObservers(cancel, "quit-application-requested", "restart");
    if (cancel.data) return;
    Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
  }

  const always = () => true;

  // Rows: section, title, words people search with, then how it runs.
  // key: a shortcut that does exactly the same, shown on the row.
  // confirm: asks for a second Enter or click first.
  function openItems() {
    const zia = document.documentElement.hasAttribute("zia-js");
    const items = [
      ["Open", "Zen settings", "settings preferences options", { ok: always, run: () => openPreferences() }],
      ["Open", "Zia settings", "zia settings mod theme options", { ok: () => zia, run: openZiaSettings }],
      ["Open", "Sine mods (switch mods on or off)", "sine mods themes store", { ok: always, run: () => openPreferences("paneSineMods") }],
      ["Open", "Downloads", "downloads files", command("Tools:Downloads")],
      ["Open", "History", "history visited", command("Browser:ShowAllHistory")],
      ["Open", "Bookmarks", "bookmarks favourites favorites", { ...command("Browser:ShowAllBookmarks"), key: "manBookmarkKb" }],
      ["Open", "Passwords", "passwords logins", { ok: always, run: () => {
        const { LoginHelper } = ChromeUtils.importESModule("resource://gre/modules/LoginHelper.sys.mjs");
        LoginHelper.openPasswordManager(window, { entryPoint: "mainmenu" });
      } }],
      ["Open", "Add-ons and extensions", "addons add-ons extensions", { ...command("Tools:Addons"), key: "key_openAddons" }],
      ["Open", "Clear browsing data (cookies, cache, history)", "clear cookies cache wipe", { ...command("Tools:Sanitize"), key: "key_sanitize" }],
      ["Open", "Zen settings: Look and feel", "appearance look feel theme colours colors", settingsPage("appearance")],
      ["Open", "Zen settings: Tabs", "tabs settings", settingsPage("tabs")],
      ["Open", "Zen settings: Links", "links settings", settingsPage("links")],
      ["Open", "Zen settings: Search engine", "search engine settings google", settingsPage("search")],
      ["Open", "Zen settings: Keyboard shortcuts (change them)", "keyboard shortcuts keys change rebind", settingsPage("shortcuts")],
      ["Open", "Zen settings: Privacy", "privacy security permissions cookies", settingsPage("privacy")],
      ["Open", "Advanced settings (about:config)", "about:config advanced prefs config zen-custom", { ok: always, run: () => openTab("about:config") }],
      ["Open", "Profile folder (where zen-custom is installed)", "profile folder chrome explorer zen-custom", { ok: always, run: () => {
        Services.dirsvc.get("ProfD", Ci.nsIFile).launch();
      } }],
      ["Open", "Restart Zen", "restart relaunch reboot", { ok: always, run: restartZen, confirm: "Press Enter or click again to restart Zen" }],

      ["Spaces and containers", "New space", "new space create workspace", command("cmd_zenOpenWorkspaceCreation")],
      ["Spaces and containers", "Rename this space", "rename space name workspace", command("cmd_zenChangeWorkspaceName")],
      ["Spaces and containers", "Change this space's icon", "space icon emoji workspace", command("cmd_zenChangeWorkspaceIcon")],
      ["Spaces and containers", "All spaces (Library)", "manage spaces workspaces library", command("cmd_zenManageWorkspaces")],
      ["Spaces and containers", "Space routing (which sites open in which space)", "space routing routes rules", command("cmd_zenOpenSpaceRoutingSettings")],
      ["Spaces and containers", "New folder", "new folder group", command("cmd_zenOpenFolderCreation")],
      ["Spaces and containers", "Containers (edit, reorder, delete)", "containers manage edit settings", { ok: () => containersOn() && !!zenSettings(), run: () => zenSettings().open("containers") }],
      ["Spaces and containers", "New container", "new container create add", { ok: () => containersOn() && !!zenSettings(), run: newContainer }],
    ];
    const emoji = window.zcContainerEmoji; // container-emoji.uc.js, when on
    const containers = myContainers();
    for (const c of containers) {
      items.push(["Spaces and containers", `New tab in ${c.name} container`, `container tab new ${c.name}`,
        { ok: always, run: () => openTrustedLinkIn(BROWSER_NEW_TAB_URL, "tab", { userContextId: c.id }),
          pick: `${c.name} container`, // Enter picks it for its name, not for "tab"
          icon: emoji?.get(c.id) }]);
    }
    if (emoji && window.gZenEmojiPicker && Services.prefs.getBoolPref("zen-custom.container-emoji", true)) {
      for (const c of containers) {
        items.push(["Spaces and containers", `Container emoji: ${c.name}`, `emoji icon container ${c.name}`,
          { ok: always, run: () => emoji.pick(c.id), pick: `emoji icon ${c.name}`, icon: emoji.get(c.id) }]);
      }
    }
    return items.filter(([, , , how]) => {
      try { return how.ok(); } catch { return false; }
    });
  }

  // A key's current shortcut, from Zen (null if it has none).
  function readKey(id) {
    try {
      if (!document.getElementById(id)) return null;
      const { ZenKeyboardShortcuts } = ChromeUtils.importESModule("resource:///modules/zen/kbs/ZenKeyboardShortcuts.sys.mjs");
      return ZenKeyboardShortcuts.getShortcut(window, id)?.shortcut || null;
    } catch {
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
      background: var(--arrowpanel-background, light-dark(#fff, #222226)); border: 1px solid light-dark(rgba(0,0,0,.08), rgba(255,255,255,.08));
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
      padding: 6px 8px; border-radius: 7px; box-sizing: border-box; min-height: 30px; }
    #zc-keys-guide .row:hover { background: light-dark(rgba(0,0,0,.04), rgba(255,255,255,.05)); }
    #zc-keys-guide .row .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #zc-keys-guide .row .mine { margin-left: 6px; font-size: 11px; color: var(--zen-primary-color, #5b6cff); }
    #zc-keys-guide .act { cursor: pointer; }
    #zc-keys-guide .row .ico { flex: none; width: 16px; height: 16px; margin-right: -8px;
      -moz-context-properties: fill; fill: currentColor; }
    #zc-keys-guide .act.sel { background: light-dark(rgba(0,0,0,.06), rgba(255,255,255,.08)); }
    #zc-keys-guide .go { display: none; flex: none; font-size: 12px; color: light-dark(#8a8a90, #8c8c94); }
    #zc-keys-guide .act.sel .go { display: inline; }
    #zc-keys-guide .act.sel .keys { display: none; }
    #zc-keys-guide .keys { flex: none; display: flex; gap: 4px; }
    #zc-keys-guide kbd { font: 600 11.5px/1 system-ui, sans-serif; min-width: 20px; text-align: center;
      padding: 4px 6px; border-radius: 5px; color: inherit; background: light-dark(#fff, #2f2f35);
      border: 1px solid light-dark(rgba(0,0,0,.1), rgba(255,255,255,.1)); border-bottom-width: 2px; }
    #zc-keys-guide [hidden] { display: none !important; }
    #zc-keys-guide .empty { padding: 28px 8px; text-align: center; color: light-dark(#8a8a90, #8c8c94); }
    #zc-keys-guide .foot.bad { color: light-dark(#b42318, #ff8a80); }
    #zc-keys-guide .foot { padding: 8px 16px; font-size: 12px; color: light-dark(#8a8a90, #8c8c94);
      border-top: 1px solid light-dark(rgba(0,0,0,.07), rgba(255,255,255,.07)); }
    /* Light or dark exactly as Zen's own pop-ups (Settings > Look and Feel). */
    #zc-keys-guide { color-scheme: light; }
    @media -moz-pref("zen.view.window.scheme", 0) { #zc-keys-guide { color-scheme: dark; } }
    @media -moz-pref("zen.view.window.scheme", 2) and (-moz-system-dark-theme) { #zc-keys-guide { color-scheme: dark; } }
    /* ...and as dark or light as the sidebar when a space's colours make Zen switch */
    :root[zen-should-be-dark-mode="true"] #zc-keys-guide { color-scheme: dark; }
    :root[zen-should-be-dark-mode="false"] #zc-keys-guide { color-scheme: light; }
    :root[privatebrowsingmode="temporary"] #zc-keys-guide { color-scheme: dark; }
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

  // Words people search with that the titles don't use.
  const ALSO = [
    [/location/, "address bar url"], [/reload/, "refresh"], [/reopen/, "restore undo close"],
    [/split view/, "split screen"], [/private/, "incognito"], [/full screen/, "fullscreen"],
    [/developer|inspector|console/, "devtools dev tools inspect"], [/mute/, "sound audio"],
    [/glance/, "preview peek"], [/fake coding|screensaver/, "screensaver screen saver hide away lock terminal"], [/\besc\b/, "escape"], [/[←→↑↓]/, "arrow"],
  ];
  const MODS = new Set(["ctrl", "alt", "shift"]);
  const KEY_ALIAS = { escape: "esc", comma: ",", period: ".", plus: "+", minus: "-", left: "←", right: "→",
    up: "↑", down: "↓", delete: "del" };
  // "ctrl shift", "Ctrl+S", "alt 3": match the keys themselves, exactly when a key is given.
  function shortcutQuery(q) {
    const parts = q.replace(/\+$/, " plus").split(/\s*\+\s*|\s+/).filter(Boolean);
    if (!parts.length || !MODS.has(parts[0]) || parts.slice(0, -1).some(p => !MODS.has(p))) return null;
    const want = parts.filter(p => MODS.has(p));
    const last = parts.at(-1);
    const key = MODS.has(last) ? null : (KEY_ALIAS[last] ?? last);
    return caps => {
      const mods = caps.filter(c => MODS.has(c));
      if (!want.every(m => mods.includes(m))) return false;
      if (!key) return true;
      const k = caps.at(-1);
      return mods.length === want.length && (k === key || k.split(" … ").includes(key) ||
        (/^\d$/.test(key) && /^1 … 9$/.test(k) && key !== "0"));
    };
  }

  let overlay = null;
  let opening = false;
  let returnFocus = null;

  let cancelled = false;
  let lastError = null; // shown once in the footer when an item failed to open

  async function open() {
    if (overlay || opening) return;
    opening = true;
    cancelled = false;
    returnFocus = document.commandDispatcher?.focusedElement ?? null;
    try {
      const browser = await browserShortcuts();
      const sections = [];
      for (const [label, title, also, how] of openItems()) {
        let sec = sections.find(s => s.label === label);
        if (!sec) sections.push(sec = { label, keys: [] });
        sec.keys.push({ title, also, run: how.run, confirm: how.confirm, pick: how.pick, icon: how.icon, shortcut: how.key ? readKey(how.key) : null });
      }
      sections.push({ label: "zen-custom", keys: ourShortcuts(), mine: true });
      const zia = ziaShortcuts();
      if (zia.length) sections.push({ label: "Zia", keys: zia });
      const addons = await addonShortcuts();
      if (addons.length) sections.push({ label: "Add-ons", keys: addons });
      if (browser) sections.push(...browser);
      if (!cancelled) build(sections, !browser);
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
    input.placeholder = "Search, or open: settings, downloads, containers …";
    const count = el("span", "count");
    top.append(input, count);

    const list = el("div", "list");
    const rows = [];
    const acts = []; // the rows that open something
    let sel = null;  // the one Enter opens
    const select = (row, scroll = true) => {
      sel?.classList.remove("sel");
      sel = row;
      if (!row) return;
      row.classList.add("sel");
      if (scroll) row.scrollIntoView({ block: "nearest" });
    };
    const shownActs = () => acts.filter(r => !r.hidden);
    const run = row => {
      // Restart asks once more first
      if (row._zcConfirm && !row._zcArmed) {
        row._zcArmed = true;
        row.querySelector(".t").textContent = row._zcConfirm;
        select(row);
        return;
      }
      const title = row.title;
      close();
      Promise.resolve().then(row._zcRun).catch(e => {
        console.error("[zen-custom shortcut guide] Couldn't open", title, e);
        // say so, instead of quietly doing nothing
        lastError = `Couldn't open “${title}” (${e?.message || e}). Tell Claude.`;
        open();
      });
    };
    for (const s of sections) {
      if (!s.keys.length) continue;
      const sec = el("section");
      sec.append(el("h3", null, s.label));
      for (const k of s.keys) {
        const row = el("div", "row");
        const t = el("span", "t", k.title);
        if (k.icon) {
          const img = el("img", "ico");
          img.src = k.icon;
          img.alt = "";
          row.append(img);
        }
        if (k.isCustomized) t.append(el("span", "mine", "changed"));
        row.append(t);
        if (k.shortcut) row.append(keycaps(k.shortcut));
        const hay = `${k.title} ${k.shortcut ?? ""} ${s.label} ${k.also ?? ""}`.toLowerCase();
        row._zcFind = hay + ALSO.filter(([re]) => re.test(hay)).map(([, w]) => " " + w).join("");
        row._zcCaps = k.shortcut ? k.shortcut.toLowerCase().replace(/^hold /, "").split(/\+(?!$)/) : [];
        row.title = k.title;
        if (k.run) {
          row.classList.add("act");
          row.append(el("span", "go", "Open ↵"));
          row._zcRun = k.run;
          row._zcConfirm = k.confirm;
          // what Enter may pick on its own: words that start with what you type
          row._zcWords = (k.pick ?? `${k.title} ${k.also ?? ""}`).toLowerCase().split(/[^\p{L}\p{N}:+-]+/u).filter(Boolean);
          row.addEventListener("click", () => run(row));
          row.addEventListener("mousemove", () => { if (sel !== row) select(row, false); });
          acts.push(row);
        }
        if (k.copy) {
          row.style.cursor = "pointer";
          row.addEventListener("click", () => {
            try {
              Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(k.copy);
              t.firstChild.textContent = "Copied. Paste it into PowerShell and press Enter.";
            } catch (e) {
              console.error("[zen-custom shortcut guide] Couldn't copy:", e);
            }
          });
        }
        sec.append(row);
        rows.push(row);
      }
      list.append(sec);
    }
    const empty = el("div", "empty", "No shortcut matches that.");
    empty.hidden = true;
    list.append(empty);

    const foot = el("div", "foot", lastError || (browserFailed
      ? "Couldn't read Zen's own shortcuts this time; Zen settings > Keyboard shortcuts has the full list."
      : "Type, then Enter opens the highlighted item. ↑ ↓ choose, Esc closes."));
    if (lastError) foot.classList.add("bad");
    lastError = null;

    box.append(top, list, foot);
    overlay.append(box);
    (document.body || document.documentElement).append(overlay);

    const filter = () => {
      const q = input.value.trim().toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const keyQuery = shortcutQuery(q);
      let shown = 0;
      for (const row of rows) {
        const hit = keyQuery ? keyQuery(row._zcCaps) : words.every(w => row._zcFind.includes(w));
        row.hidden = !hit;
        if (hit) shown++;
      }
      for (const sec of list.querySelectorAll("section")) {
        sec.hidden = !sec.querySelector(".row:not([hidden])");
      }
      empty.hidden = shown > 0;
      count.textContent = words.length ? `${shown} found` : `${rows.length - acts.length} shortcuts`;
      // Enter opens the first item whose words start with what you typed;
      // never Restart, and nothing before you type
      // (a whole-word match beats a start: "work" picks the Work container)
      let pick = null, best = 0;
      if (!keyQuery && words.length) {
        for (const r of shownActs()) {
          if (r._zcConfirm || !words.every(w => r._zcWords.some(x => x.startsWith(w)))) continue;
          const score = 1 + words.filter(w => r._zcWords.includes(w)).length;
          if (score > best) { best = score; pick = r; }
        }
      }
      select(pick, false);
    };
    input.addEventListener("input", filter);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && sel) {
        e.preventDefault();
        run(sel);
        return;
      }
      // ↑ and ↓ move between the things to open while any are showing
      const showing = shownActs();
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && showing.length) {
        e.preventDefault();
        const i = showing.indexOf(sel);
        const next = e.key === "ArrowDown" ? showing[i + 1] : showing[i - 1];
        if (next) select(next);
        else {
          // past the list of things to open: just scroll, with nothing chosen
          select(null);
          list.scrollBy(0, e.key === "ArrowDown" ? 40 : -40);
        }
        return;
      }
      const step = { ArrowDown: 40, ArrowUp: -40, PageDown: list.clientHeight - 40, PageUp: 40 - list.clientHeight }[e.key];
      if (step) { e.preventDefault(); list.scrollBy(0, step); }
    });
    box.addEventListener("mousedown", e => { if (e.target !== input) e.preventDefault(); });
    overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });
    filter();
    input.focus();
  }

  function close() {
    if (opening) cancelled = true;
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    // back to where you were typing, or the page
    if (returnFocus?.isConnected) returnFocus.focus();
    else gBrowser.selectedBrowser?.focus();
    returnFocus = null;
  }

  // Capture phase on the window, so a page can't take Ctrl+, first.
  // The same key press can come back from the page; it's ignored then.
  let lastStamp = 0;
  window.addEventListener("keydown", e => {
    const plainEsc = e.key === "Escape" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
    if ((overlay || opening) && plainEsc) {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
      return;
    }
    if ((e.code !== "Comma" && e.key !== ",") || !e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.getModifierState("AltGraph")) return;
    if (!Services.prefs.getBoolPref(PREF, true)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat || e.timeStamp === lastStamp) return;
    lastStamp = e.timeStamp;
    if (overlay) close();
    else if (opening) cancelled = !cancelled;
    else open();
  }, true);

  // A tab or space switch, or the window losing focus, closes it.
  window.addEventListener("TabSelect", close);
  window.addEventListener("blur", () => { if (overlay && !document.hasFocus()) close(); });
})();
