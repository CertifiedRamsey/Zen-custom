// ==UserScript==
// @name           zen-custom: Starter space cleanup
// @description    On a new PC, removes the empty space Zen makes on first start once your synced spaces arrive.
// @include        main
// ==/UserScript==
//
// A brand-new Zen profile starts with one empty space. After you sign in,
// your synced spaces arrive next to it and you'd delete it by hand. This
// remembers that first space and removes it once another space shows up.
// Tabs in it move to your first synced space first; only empty tabs and the
// sign-in pages close. If it holds a folder, it stays. Then this switches off.
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
  // Tabs that can close with the space: empty ones and the sign-in pages.
  const DISPOSABLE = /^(about:(blank|newtab|home|preferences|welcome)|https:\/\/accounts\.firefox\.com\/)/;

  const enabled = () => Services.prefs.getBoolPref(ON_PREF, false);

  function finish() {
    Services.prefs.setBoolPref(ON_PREF, false);
    Services.prefs.clearUserPref(ID_PREF);
  }

  const tabsIn = uuid =>
    gBrowser.tabs.filter(tab => tab.getAttribute("zen-workspace-id") === uuid && !tab.hasAttribute("zen-essential"));

  // Tabs worth keeping. Synced tabs arrive unloaded, so judge those by
  // what they will load, not by the blank page they show for now.
  function keepers(uuid) {
    return tabsIn(uuid).filter(tab => {
      if (tab.hasAttribute("zen-empty-tab")) return false;
      const url = tab.hasAttribute("pending")
        ? (SessionStore.getLazyTabValue?.(tab, "url") ?? "")
        : tab.linkedBrowser?.currentURI?.spec ?? "";
      return !(url && DISPOSABLE.test(url)) && !(url === "" && !tab.hasAttribute("pending"));
    });
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
      // a folder can't move tab by tab, so a space holding one stays
      if (tabsIn(uuid).some(tab => tab.group)) return finish();
      const target = spaces.find(s => s.uuid !== uuid);
      const keep = keepers(uuid);
      if (keep.length) gZenWorkspaces.moveTabsToWorkspace(keep, target.uuid);
      if (tabsIn(uuid).some(tab => keep.includes(tab))) return finish(); // a tab didn't move, so keep the space
      if (gZenWorkspaces.activeWorkspace === uuid) await gZenWorkspaces.changeWorkspace(target);
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
