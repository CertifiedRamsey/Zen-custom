// ==UserScript==
// @name           zen-custom: Space Keys
// @description    Keeps the switch-space shortcuts working on every page, whatever the settings say.
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

(() => {
  "use strict";

  // Sine can run a script twice in the same window; the second copy would
  // switch spaces twice per key press.
  // The mark goes on the window's root element, which every copy can see.
  const loadedMark = "zc-loaded-spaceKeys";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const PREF = "zen-custom.space-keys";

  // read on each use, so switching the pref off works without a restart
  const enabled = () => Services.prefs.getBoolPref(PREF, true);

  // Zen's own commands, so a switch behaves exactly like Zen's shortcut
  // (private windows, the space-switch animation and so on).
  function run(commandId, fallback) {
    const cmd = document.getElementById(commandId);
    if (cmd) cmd.doCommand();
    else fallback();
  }

  // Zia's tab numbers (hold a key, type a tab's number) can be set to Alt,
  // and then Alt+digits are Zia's: only the arrows stay with spaces.
  const ziaOwnsAltDigits = () => Services.prefs.getStringPref("zia.tab-numbers.key", "cmd") === "alt";

  // What a key press means: a space number (0-based), a step, or nothing.
  function action(e) {
    if (e.metaKey || e.shiftKey || e.getModifierState("AltGraph")) return null;
    if (e.altKey && !e.ctrlKey && !ziaOwnsAltDigits()) {
      const m = /^Digit([0-9])$/.exec(e.code);
      if (m) return { index: m[1] === "0" ? 9 : Number(m[1]) - 1 };
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
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat || e.timeStamp === lastStamp) return;
    lastStamp = e.timeStamp;
    const ws = window.gZenWorkspaces;
    if ("index" in a) {
      run(`cmd_zenWorkspaceSwitch${a.index + 1}`, () => ws?.shortcutSwitchTo(a.index));
    } else {
      run(a.step > 0 ? "cmd_zenWorkspaceForward" : "cmd_zenWorkspaceBackward",
        () => ws?.changeWorkspaceShortcut(a.step));
    }
  }, true);
})();
