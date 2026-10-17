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

## Features

Each one can be switched off live in `about:config`:

| Pref | What it does | Default |
| --- | --- | --- |
| `zen-custom.soft-tiles` | Faint hairline instead of dark outlines on Essentials and the selected tab (edge colour bar kept) | on |
| `zen-custom.top-bar` | ⋯ menu first, all buttons spread across the top bar, no » overflow | on |
| `zen-custom.folder-icon` | Outline folder icon in the folder's colour, animation kept | on |
| `zen-custom.tight-footer` | Space icons sit right next to the library button | on |
| `zen-custom.square-tiles` | Essentials tiles get small square-ish corners instead of big rounded ones | on |
| `zen-custom.container-dot` | Small dot in the container colour at the bottom-right of every container tab, Essentials too | on |
| `zen-custom.hide-container-bar` | Hides the coloured container edge bar (turn on if the dot should replace it) | off |
| `zen-custom.tab-monitor` | Shift+Esc (or Ctrl+Alt+M / toolbar button) opens a panel of tabs grouped by space with memory, CPU and awake/asleep state; one-click sleep per tab or space; Process Manager one click away (JS, needs Sine/fx-autoconfig) | on |
| `zen-custom.compact-tabs` | Shorter, rounder vertical tabs | off |
| `zen-custom.hover-close` | Close buttons only on the hovered tab | off |
| `zen-custom.floating-urlbar` | Address bar opens as a centered command palette | off |
| `zen-custom.clean-toolbar` | Hides rarely used URL bar icons | off |
| `zen-custom.clean-newtab` | Removes sponsored and news blocks from the new tab page | off |
| `zen-custom.routes-helper` | A "Routes" button on each space card in the Library that walks you through sending sites to that space (JS, needs Sine/fx-autoconfig) | on |

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
4. Open Zen. In Settings > Zen Mods (and in Sine, if you use it), disable
   the mods this repo now covers.

To update later: `git pull`, close Zen, run the installer again.
The installer backs up your old `chrome` files and `user.js` to
`<profile>\zen-custom-backup-<date>` each time.

## Layout

```
chrome/zen-custom/userChrome.css   load order for browser UI modules
chrome/zen-custom/modules/*.css    one file per feature
chrome/zen-custom/userContent.css  styles for web/about: pages
js/*.uc.js                         behaviour features (needs Sine/fx-autoconfig)
user.js                            default on/off switches
install/                           Windows installer and uninstaller
```
