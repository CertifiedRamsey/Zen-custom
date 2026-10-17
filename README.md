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

| Pref | What it does |
| --- | --- |
| `zen-custom.compact-tabs` | Shorter, rounder vertical tabs |
| `zen-custom.hover-close` | Close buttons only on the hovered tab |
| `zen-custom.floating-urlbar` | Address bar opens as a centered command palette |
| `zen-custom.clean-toolbar` | Hides rarely used URL bar icons |
| `zen-custom.essentials-grid` | Tidier Essentials with an accent ring on the active one |
| `zen-custom.clean-newtab` | Removes sponsored and news blocks from the new tab page |

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
