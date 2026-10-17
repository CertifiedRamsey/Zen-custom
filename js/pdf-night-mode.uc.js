// ==UserScript==
// @name           zen-custom: PDF Night Mode
// @description    Dark pages in Zen's built-in PDF viewer, for reading at night.
// @include        main
// ==/UserScript==
//
// On a PDF, press Alt+N, click the moon in the address bar, or right-click the
// page > "Night mode for PDFs". The choice is remembered for every PDF until you
// switch it back. Pages are inverted with their colours turned back round, so
// diagrams keep their hues. Switch the whole feature off with
// zen-custom.pdf-night = false; zen-custom.pdf-night.strength (50-100, default
// 90) sets how dark the page gets.

(() => {
  "use strict";

  const PREF = "zen-custom.pdf-night";
  const ON = "zen-custom.pdf-night.on";
  const STRENGTH = "zen-custom.pdf-night.strength";
  const XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

  // read on each use, so switching the prefs works without a restart
  const enabled = () => Services.prefs.getBoolPref(PREF, true);
  const nightOn = () => enabled() && Services.prefs.getBoolPref(ON, false);
  const strength = () => Math.min(100, Math.max(50, Services.prefs.getIntPref(STRENGTH, 90))) / 100;

  const isPdf = (browser = gBrowser.selectedBrowser) => {
    try {
      if (browser.contentPrincipal?.originNoSuffix === "resource://pdf.js") return true;
    } catch (e) {}
    return browser.documentContentType === "application/pdf";
  };

  // One sheet for every window and tab. The style sheet service hands it to the
  // page processes too, so only the first window registers it.
  const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  let sheet = null;

  function sheetFor(k) {
    const dark = Math.round(255 * (1 - k)); // what white turns into
    // canvas = the drawn page; thumbnails in the sidebar follow along
    const css = `
      #viewerContainer .pdfViewer .page .canvasWrapper,
      #thumbnailView .thumbnailImage {
        filter: invert(${k}) hue-rotate(180deg) !important;
      }
      #viewerContainer .pdfViewer .page {
        background-color: rgb(${dark}, ${dark}, ${dark}) !important;
      }`;
    return Services.io.newURI("data:text/css;charset=utf-8," + encodeURIComponent(css));
  }

  function applySheet() {
    const want = nightOn() ? sheetFor(strength()) : null;
    if (sheet && want && sheet.spec === want.spec) return;
    if (sheet && sss.sheetRegistered(sheet, sss.USER_SHEET)) sss.unregisterSheet(sheet, sss.USER_SHEET);
    sheet = want;
    if (sheet && !sss.sheetRegistered(sheet, sss.USER_SHEET)) sss.loadAndRegisterSheet(sheet, sss.USER_SHEET);
  }

  function toggle() {
    Services.prefs.setBoolPref(ON, !Services.prefs.getBoolPref(ON, false));
  }

  // Moon button inside the address bar, shown only on PDFs (the top bar is
  // full, so it stays out of the toolbar).
  const button = document.createXULElement("hbox");
  button.id = "zen-custom-pdf-night-button";
  button.className = "urlbar-page-action";
  button.setAttribute("role", "button");
  button.hidden = true;
  const icon = document.createXULElement("image");
  icon.className = "urlbar-icon";
  button.append(icon);
  button.addEventListener("click", e => { if (e.button === 0) toggle(); });
  (document.getElementById("page-action-buttons") ||
   document.getElementById("urlbar-input-container"))?.prepend(button);

  // Right-click on the page
  const menu = document.getElementById("contentAreaContextMenu");
  const item = document.createXULElement("menuitem");
  item.id = "zen-custom-pdf-night-menuitem";
  item.setAttribute("type", "checkbox");
  item.setAttribute("label", "Night mode for PDFs");
  item.setAttribute("acceltext", "Alt+N");
  item.addEventListener("command", toggle);
  menu?.prepend(item);
  menu?.addEventListener("popupshowing", e => {
    if (e.target !== menu) return;
    item.hidden = !enabled() || !isPdf();
    item.setAttribute("checked", String(nightOn()));
  });

  function refresh() {
    const on = nightOn();
    button.hidden = !enabled() || !isPdf();
    button.toggleAttribute("night", on);
    button.setAttribute("tooltiptext", on ? "Night mode on: click for normal pages (Alt+N)" : "Night mode for PDFs (Alt+N)");
  }

  const style = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
  style.textContent = `
    #zen-custom-pdf-night-button > .urlbar-icon {
      fill: currentColor;
      -moz-context-properties: fill, fill-opacity;
      opacity: .6;
    }
    #zen-custom-pdf-night-button[night] > .urlbar-icon {
      fill: var(--zen-primary-color, AccentColor);
      opacity: 1;
    }
    #zen-custom-pdf-night-button > .urlbar-icon {
      list-style-image: url("data:image/svg+xml;utf8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="context-fill" fill-opacity="context-fill-opacity" d="M6.2 1.1a.6.6 0 0 1 .7.8 5.4 5.4 0 0 0 7.2 7.2.6.6 0 0 1 .8.7A7 7 0 1 1 6.2 1.1z"/></svg>'
      )}");
    }`;
  document.documentElement.append(style);

  // Alt+N, only while a PDF is showing so other pages keep the key. Capture
  // phase, as Zen moves <key> elements around after scripts run.
  let lastStamp = 0;
  window.addEventListener("keydown", e => {
    if (e.timeStamp === lastStamp) return; // the same key event coming back from the page
    if (e.code !== "KeyN" || !e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
    if (!enabled() || !isPdf()) return;
    lastStamp = e.timeStamp;
    e.preventDefault();
    e.stopImmediatePropagation();
    toggle();
  }, true);

  const observer = { observe: () => { applySheet(); refresh(); } };
  for (const p of [PREF, ON, STRENGTH]) Services.prefs.addObserver(p, observer);
  window.addEventListener("unload", () => {
    for (const p of [PREF, ON, STRENGTH]) Services.prefs.removeObserver(p, observer);
  });

  gBrowser.tabContainer.addEventListener("TabSelect", refresh);
  gBrowser.addTabsProgressListener({
    onLocationChange(browser) {
      if (browser !== gBrowser.selectedBrowser) return;
      refresh();
      setTimeout(refresh, 300); // the viewer's principal can land a moment later
    },
  });

  applySheet();
  refresh();
})();
