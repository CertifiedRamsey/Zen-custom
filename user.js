// zen-custom defaults. The installer adds any of these your profile doesn't
// have yet to its prefs.js, so what you change in about:config stays changed.
// Flip any of these in about:config to turn a feature on or off live.
// (The installer puts this first one in your profile's user.js instead,
// since Zen ignores userChrome.css without it.)
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// Thato's requests
user_pref("zen-custom.soft-tiles", true);
user_pref("zen-custom.top-bar", true);
user_pref("zen-custom.folder-icon", true);
user_pref("zen-custom.tight-footer", true);
user_pref("zen-custom.square-tiles", true);
user_pref("zen-custom.container-dot", true);
user_pref("zen-custom.hide-container-bar", true);
user_pref("zen-custom.smooth-topbar", true);
user_pref("zen-custom.ctrl-tab", true);
user_pref("zen-custom.ctrl-tab.delay", 200);
user_pref("zen-custom.ctrl-tab.recent-order", false);
user_pref("zen-custom.tab-monitor", true);

// Extras, off until wanted
user_pref("zen-custom.compact-tabs", false);
user_pref("zen-custom.hover-close", false);
user_pref("zen-custom.floating-urlbar", false);
user_pref("zen-custom.clean-toolbar", false);
user_pref("zen-custom.clean-newtab", false);

// JS features (run through Sine, see js/README.md)
user_pref("zen-custom.routes-helper", true);
