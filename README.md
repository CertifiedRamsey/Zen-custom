# zen-custom

One codebase for all my Zen Browser customizations. It replaces the mix of
Zen Mods and Sine mods that kept overriding each other.

## Why mods were fighting

- **Zen Mods** are CSS only. Zen merges every enabled mod into one generated
  stylesheet, so two mods that style the same element just win or lose by
  load order and `!important`.
- **Sine** loads its own mods (CSS plus JS) through fx-autoconfig on top of
  that. Its styles and Zen's land in separate sheets, so who wins changes
  between updates.
- This repo fixes that by owning the styling in one place with one load
  order (`chrome/zen-custom/userChrome.css`). Turn off the Zen/Sine mods it
  replaces.
- The Sine mods you keep (Zia above all) load after this repo's styles. Where
  one styles the same thing, the module sets that mod's own variables
  (`--zia-*`) or puts an id in its selector (`:root:not(#zc)`) so it still wins.

## Features

Each one can be switched off live in `about:config`:

| Pref | What it does | Default |
| --- | --- | --- |
| `zen-custom.soft-tiles` | Faint hairline instead of dark outlines on Essentials and the selected tab, which gets a soft fill | on |
| `zen-custom.top-bar` | ⋯ menu first, all buttons spread across the top bar, no » overflow | on |
| `zen-custom.folder-icon` | Outline folder icon in the folder's colour, animation kept | on |
| `zen-custom.tight-footer` | Space icons sit just after the library button, evenly spaced | on |
| `zen-custom.square-tiles` | Essentials tiles get small square-ish corners instead of big rounded ones | on |
| `zen-custom.container-dot` | Small dot in the container colour at the bottom-left of every container tab, Essentials too | on |
| `zen-custom.hide-container-bar` | Hides the coloured container edge bar so the dot replaces it | on |
| `zen-custom.smooth-topbar` | Stops the bookmarks bar flickering and the page jumping when you move the mouse to the top (window then drags from the sidebar top, not the bookmarks bar) | on |
| `zen-custom.steady-sidebar` | Stops the compact-mode sidebar sliding away and back while the mouse rests on its top row of buttons (while compact mode hides the sidebar, the window can't be dragged from it; Win+arrow keys still move it) | on |
| `zen-custom.tab-monitor` | Shift+Esc (or Ctrl+Alt+M) opens a panel of tabs grouped by space with memory, CPU and awake/asleep state; one-click sleep per tab or space; Process Manager one click away. Its toolbar button is in Customize Toolbar (JS, runs through Sine) | on |
| `zen-custom.folder-style-picker` | Right-click a folder > Change icon > Folder style… to pick Zia's folder, Zia's box, or Automatic (box past 3 tabs), for one folder, a space or every space. Choices are kept in `zen-custom.folder-style` (JS, needs Sine) | on |
| `zen-custom.pdf-night` | Night mode for the built-in PDF viewer: Alt+N, the moon in the address bar, or right-click > Night mode for PDFs. `zen-custom.pdf-night.strength` (50-100) sets how dark (JS, needs Sine) | on |
| `zen.view.show-newtab-button-top` | Zen's own setting, set to false: new tabs (Ctrl+T, +) open at the bottom of the space, and the + New Tab button moves to the bottom too. The uninstaller leaves it as it is | false |
| `zen-custom.ctrl-tab` | Ctrl+Tab skips sleeping tabs (hold Ctrl for a picker); Ctrl+Alt+Space opens a searchable tab picker. Tune with `zen-custom.ctrl-tab.delay` and `zen-custom.ctrl-tab.recent-order` (JS, runs through Sine) | on |
| `zen-custom.compact-tabs` | Shorter, rounder vertical tabs | off |
| `zen-custom.hover-close` | Close buttons only on the hovered tab | off |
| `zen-custom.floating-urlbar` | Address bar opens as a centered command palette | off |
| `zen-custom.clean-toolbar` | Hides rarely used URL bar icons | off |
| `zen-custom.clean-newtab` | Removes sponsored and news blocks from the new tab page | off |
| `zen-custom.routes-helper` | A "Routes" button on each space card in the Library that walks you through sending sites to that space (JS, runs through Sine) | on |

Colors, radius and spacing live in `chrome/zen-custom/modules/tokens.css`.

## Install on Windows x64

1. Install [Git for Windows](https://git-scm.com/download/win) if you don't have it.
2. Close Zen completely.
3. In PowerShell:
   ```powershell
   cd $HOME\Documents
   git clone https://github.com/CertifiedRamsey/zen-custom.git
   cd zen-custom
   powershell -ExecutionPolicy Bypass -File .\install\install.ps1
   ```
   The first time, it asks whether to switch on Sine's "Enable installing JS
   from unofficial sources". Press Enter for yes: Routes, Tab Monitor,
   Ctrl+Tab, Folder style and PDF night mode are scripts, and Sine only runs
   scripts from outside its store with that on. Say no and everything else still works; you can tick it
   later in Settings > Sine Mods.
4. Open Zen. In Settings > Zen Mods (and in Sine, if you use it), disable
   the mods this repo now covers.

To update later: `git pull`, close Zen, run the installer again. It never
resets a switch you changed in `about:config`; it only adds new ones.
The installer backs up your old `chrome` files, `user.js`, `prefs.js` and
Sine's mod list to `<profile>\zen-custom-backup-<date>` each time.

To remove it: close Zen, then
`powershell -ExecutionPolicy Bypass -File .\install\uninstall.ps1`.

Have more than one Zen profile? The installer picks the one you opened last
and prints the others; add `-ProfilePath "<folder>"` to choose.

## When something breaks

After a Zen or mod update, if something looks wrong, run the health check
from the repo folder (safe with Zen open; it only reads):
```powershell
powershell -ExecutionPolicy Bypass -File .\install\check.ps1
```
It checks every piece of zen-custom is still wired up, says how to fix
anything that isn't, and lists which Zen or mod versions changed since it
last worked. The report is copied to the clipboard: paste it to Claude.
Once everything looks right, run it once with `-MarkGood` so later checks
know what "working" looked like.

## Layout

```
chrome/zen-custom/userChrome.css   load order for browser UI modules
chrome/zen-custom/modules/*.css    one file per feature
chrome/zen-custom/userContent.css  styles for web/about: pages
js/*.uc.js                         behaviour features (installed as a local Sine mod)
user.js                            default on/off switches (added to prefs.js when missing)
install/                           Windows installer, uninstaller and health check
```
