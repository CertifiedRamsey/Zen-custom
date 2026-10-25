// ==UserScript==
// @name           zen-custom: Starter space cleanup
// @description    On a new PC, removes the empty space Zen makes on first start once your synced spaces arrive.
// @include        main
// ==/UserScript==
//
// A brand-new Zen profile starts with one empty space. After you sign in,
// your synced spaces arrive next to it and you'd delete it by hand. This
// remembers that first space and removes it once another space shows up, as
// long as you haven't put any tabs in it. Then it switches itself off.
// Only bootstrap.ps1 turns it on (zen-custom.starter-space-cleanup = true,
// written into new profiles), so profiles you already have are never touched.
// The remembered space is in zen-custom.starter-space.

(() => {
  "use strict";

  // Sine can run a script twice in the same window; the second copy would
  // watch for the starter space twice. The mark goes on the window's root
  // element, which every copy can see.
  const loadedMark = "zc-loaded-starterCleanup";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const ON_PREF = "zen-custom.starter-space-cleanup";
  const ID_PREF = "zen-custom.starter-space";
  const EMPTY_URLS = ["about:blank", "about:newtab", "about:home"];

  const enabled = () => Services.prefs.getBoolPref(ON_PREF, false);

  function finish() {
    Services.prefs.setBoolPref(ON_PREF, false);
    Services.prefs.clearUserPref(ID_PREF);
  }

  // Tabs you'd mind losing: anything in the space that isn't an empty new tab.
  function hasRealTabs(uuid) {
    return gBrowser.tabs.some(
      tab =>
        tab.getAttribute("zen-workspace-id") === uuid &&
        !tab.hasAttribute("zen-essential") &&
        !tab.hasAttribute("zen-empty-tab") &&
        !EMPTY_URLS.includes(tab.linkedBrowser?.currentURI?.spec)
    );
  }

  let busy = false;
  async function check() {
    if (busy || !enabled()) return;
    busy = true;
    try {
      const spaces = gZenWorkspaces.getWorkspaces();
      let uuid = Services.prefs.getStringPref(ID_PREF, "");
      if (!uuid) {
        // First start of a new profile: the only space is the starter one.
        if (spaces.length === 1) Services.prefs.setStringPref(ID_PREF, spaces[0].uuid);
        else finish();
        return;
      }
      const starter = spaces.find(s => s.uuid === uuid);
      if (!starter) return finish(); // already gone
      if (spaces.length < 2) return; // synced spaces not here yet
      if (hasRealTabs(uuid)) return finish(); // you're using it, keep it
      if (gZenWorkspaces.activeWorkspace === uuid) {
        await gZenWorkspaces.changeWorkspace(spaces.find(s => s.uuid !== uuid));
      }
      await gZenWorkspaces.removeWorkspace(uuid);
      finish();
    } catch (e) {
      console.error("zen-custom starter space cleanup:", e);
    } finally {
      busy = false;
    }
  }

  // Only while there's work to do, and only in windows with spaces.
  if (!enabled() || !window.gZenWorkspaces) return;
  gZenWorkspaces.promiseInitialized.then(() => {
    check();
    window.addEventListener("ZenWorkspacesUIUpdate", () => check());
    // sync can add spaces without a UI update in this window
    const timer = setInterval(() => (enabled() ? check() : clearInterval(timer)), 10000);
  });
})();
