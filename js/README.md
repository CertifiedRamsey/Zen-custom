# JS features

Behaviour changes (not just looks) live here as `*.uc.js` files. They run
through Sine: the installer copies them to `<profile>/chrome/sine-mods/zen-custom/`
and lists them in Sine's `mods.json` as a local mod called zen-custom (it shows
in Settings > Sine Mods). Sine only runs scripts from mods it lists, so files
dropped in `chrome/JS/` never load. Because these don't come from Sine's store,
Sine's "Enable installing JS from unofficial sources" has to be on; the
installer asks.

- `space-routes-helper.uc.js`: adds a "Routes · N" button to each space card
  in the Library. It opens a step-by-step builder that saves through Zen's own
  Space Routing, so routes also appear in Zen's settings and keep working
  without this script. Toggle: `zen-custom.routes-helper`. Written against
  Zen 1.23.3b.
- `tab-monitor.uc.js`: Shift+Esc (or Ctrl+Alt+M) opens a panel of your tabs
  grouped by space, showing memory, CPU and whether each is awake or asleep,
  with one-click sleep per tab or space. Its toolbar button isn't placed
  anywhere at first (the top bar is full); add it from Customize Toolbar.
  Toggle: `zen-custom.tab-monitor`.
- `ctrl-tab-switcher.uc.js`: Ctrl+Tab jumps between awake tabs in this space
  without waking sleeping ones; hold Ctrl for an Alt+Tab-style picker.
  Ctrl+Alt+Space opens a stay-open picker with search across spaces.
  Toggle: `zen-custom.ctrl-tab` (plus `.delay` and `.recent-order`).
- `folder-style.uc.js`: adds Folder style… under a folder's right-click >
  Change icon (Zia's menu). Pick Automatic, Folder or Box, for this folder,
  every folder in the space, or every folder everywhere. Toggle:
  `zen-custom.folder-style-picker`; choices in `zen-custom.folder-style`.
  The drawing is in `modules/folder-style.css`.
- `pdf-night-mode.uc.js`: night mode for the built-in PDF viewer. Alt+N, the
  moon in the address bar, or right-click > Night mode for PDFs. Remembered
  across PDFs. Toggle: `zen-custom.pdf-night` (plus `.strength`).
