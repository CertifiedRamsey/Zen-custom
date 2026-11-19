// ==UserScript==
// @name           zen-custom: Container emoji
// @description    Give each container an emoji, picked with Zen's own emoji picker, shown in container menus.
// @include        main
// ==/UserScript==
//
// Ctrl+, > "Container emoji: Work" opens the same emoji picker Zen uses for
// spaces and folders. The emoji then replaces that container's icon in the
// container menus (new tab button, "Open in new container tab", links) and
// in the Ctrl+, guide. Tabs keep their coloured dot. Choosing "none" in the
// picker puts the container's own icon back.
//
// Emojis live in the zen-custom.container-emoji.icons pref, by container id.
// Light: one small stylesheet, rewritten only when an emoji changes.
// Switch off with zen-custom.container-emoji = false.

(() => {
  "use strict";

  const loadedMark = "zc-loaded-containerEmoji";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const ON_PREF = "zen-custom.container-emoji";
  const ICONS_PREF = "zen-custom.container-emoji.icons";
  const HTML = "http://www.w3.org/1999/xhtml";

  const enabled = () => Services.prefs.getBoolPref(ON_PREF, true);

  // { "2": "data:image/svg+xml;base64,…" } — what Zen's picker hands back
  function readIcons() {
    try {
      const icons = JSON.parse(Services.prefs.getStringPref(ICONS_PREF, "{}"));
      return icons && typeof icons === "object" ? icons : {};
    } catch {
      return {};
    }
  }
  // only pictures Zen's picker makes: its emoji SVGs and its own icon files
  const safe = url => typeof url === "string" &&
    (/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(url) || /^chrome:\/\/browser\/skin\/zen-icons\/[\w/.-]+\.svg$/.test(url));

  let style = null;
  function paint() {
    const icons = enabled() ? readIcons() : {};
    const rules = [];
    for (const [id, url] of Object.entries(icons)) {
      if (!/^\d+$/.test(id) || !safe(url)) continue;
      // menus built by Firefox's createUserContextMenu (menuitems and panel lists)
      rules.push(`[data-usercontextid="${id}"] { --identity-icon: url("${url}") !important; ` +
        `--panel-item-icon: url("${url}") !important; }`);
    }
    if (!rules.length) {
      style?.remove();
      style = null;
      return;
    }
    if (!style) {
      style = document.createElementNS(HTML, "style");
      style.id = "zc-container-emoji-style";
      document.documentElement.append(style);
    }
    style.textContent = rules.join("\n");
  }

  function save(id, url) {
    const icons = readIcons();
    if (url) icons[id] = url;
    else delete icons[id];
    Services.prefs.setStringPref(ICONS_PREF, JSON.stringify(icons));
  }

  // Opens Zen's emoji picker under the middle of the toolbar area.
  async function pick(userContextId) {
    const picker = window.gZenEmojiPicker;
    if (!picker) throw new Error("Zen's emoji picker isn't here");
    // the picker needs an element to hang from (and marks it and its parent)
    const holder = document.createElementNS(HTML, "div");
    holder.style.cssText = "position: fixed; top: 64px; left: calc(50% - 180px); width: 1px; height: 1px; pointer-events: none;";
    const anchor = document.createElementNS(HTML, "div");
    anchor.style.cssText = "width: 1px; height: 1px;";
    holder.append(anchor);
    document.documentElement.append(holder);
    try {
      const chosen = picker.open(anchor, { emojiAsSVG: true, allowNone: true });
      if (!chosen) return; // the picker is already open somewhere
      let url;
      try {
        url = await chosen;
      } catch {
        return; // closed without choosing
      }
      if (url && !safe(url)) throw new Error("Zen's picker gave back an icon this can't show");
      save(String(userContextId), url || null);
    } finally {
      holder.remove();
    }
  }

  window.zcContainerEmoji = {
    get: id => (enabled() ? readIcons()[String(id)] : null) || null,
    pick,
  };

  paint();
  const observer = { observe: paint };
  Services.prefs.addObserver(ICONS_PREF, observer);
  Services.prefs.addObserver(ON_PREF, observer);
  window.addEventListener("unload", () => {
    Services.prefs.removeObserver(ICONS_PREF, observer);
    Services.prefs.removeObserver(ON_PREF, observer);
  }, { once: true });
})();
