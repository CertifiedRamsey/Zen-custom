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
  Zen 1.23.3b, checked against 1.24.3b. Zen 1.24 also has its own Space
  Routing section in the Library; this button stays as the quicker way in.
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
- `starter-space-cleanup.uc.js`: on a PC set up by `bootstrap.ps1`, removes
  the empty space Zen makes on its first start once your synced spaces arrive
  (only if you haven't put tabs in it), then switches itself off. Existing
  profiles are never touched. Toggle: `zen-custom.starter-space-cleanup`.
- `space-keys.uc.js`: the switch-space shortcuts, kept working. Alt+1 to
  Alt+9 (Alt+0 for space 10) jump to a space; Ctrl+Alt+Right and
  Ctrl+Alt+Left go to the next and previous space. Zen has the same keys,
  but a page that uses them gets them first, and since Zen 1.24 they live in
  about:keyboard where they can be changed or lost. This catches them before
  the page and runs Zen's own switch command, so they always work. Holding
  the keys moves one space, not several. While it's on, these keys can't be
  recorded as a different shortcut in about:keyboard. Toggle:
  `zen-custom.space-keys`. Extras, each with its own switch: the space's
  name flashes at the top after a keyboard switch (`.flash`); holding Alt
  shows each space icon's number, drawn by `modules/space-badges.css`
  (`.badges`); Alt+Shift+number sends the tab you're on, or the selected
  tabs, to that space (`.send`). Essentials stay put, as with Zen's own Move
  to space.
- `shortcut-guide.uc.js`: Ctrl+, opens a searchable panel of every
  shortcut. Zen's and Firefox's come live from the same list as
  about:keyboard (so customized and new ones are always right), add-ons'
  from the add-ons, and zen-custom's own from a short list in the script
  (keep it in step when a zen-custom shortcut changes). Built on open and
  removed on close, so it costs nothing until used. Toggle:
  `zen-custom.shortcut-guide`.
