# JS features

Behaviour changes (not just looks) live here as `*.uc.js` files. They need
fx-autoconfig, which Sine already installs. The installer copies them into
`<profile>/chrome/JS/`.

- `space-routes-helper.uc.js`: adds a "Routes · N" button to each space card
  in the Library. It opens a step-by-step builder that saves through Zen's own
  Space Routing, so routes also appear in Zen's settings and keep working
  without this script. Toggle: `zen-custom.routes-helper`. Written against
  Zen 1.23.3b.
