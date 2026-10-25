# Copies your settings from this PC's Zen into setup\my-settings.js, so
# bootstrap.ps1 can put them on another PC (the work desktop).
# Run it on the PC whose Zen looks the way you like (Zen can stay open):
#   powershell -ExecutionPolicy Bypass -File .\setup\capture-settings.ps1
# Then commit and push setup\my-settings.js.
# Optional: -ProfilePath "<profile folder>"
param([string]$ProfilePath)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding $false
$repo = Split-Path -Parent $PSScriptRoot
. (Join-Path (Join-Path $repo "install") "find-profile.ps1")
if (-not $ProfilePath) { $ProfilePath = Find-ZenProfile }
$prefsJs = Join-Path $ProfilePath "prefs.js"
if (-not (Test-Path $prefsJs)) { throw "There's no prefs.js in $ProfilePath" }

# What gets copied: Zia's and the other Sine mods' settings, zen-custom's
# switches, Zen's own settings, and a few Firefox ones (toolbar layout,
# languages, bookmarks bar). Left out: things Zen keeps track of by itself
# (update and migration markers, history, which space is open).
$include = '^(zia\.|zen-custom\.|mod\.forkedtidypopup\.|librarytweaks-|zen\.)|^(sine\.allow-unsafe-js|sine\.auto-updates|browser\.tabs\.inTitlebar|browser\.tabs\.loadInBackground|browser\.toolbars\.bookmarks\.visibility|browser\.uiCustomization\.state|intl\.accept_languages|intl\.locale\.requested|intl\.regional_prefs\.use_os_locales|layout\.spellcheckDefault|sidebar\.visibility)$'
$exclude = '^zen\.(keyboard\.shortcuts\.version|library\.history\.|library\.migrated|mods\.|session-store\.|spaces-sync\.first-sync|ui\.migration\.|updates\.|urlbar\.suggestions-learner|workspaces\.active)'

$out = @(
  "// Settings copied from Zen on $env:COMPUTERNAME on $(Get-Date -Format 'yyyy-MM-dd') by setup\capture-settings.ps1.",
  "// bootstrap.ps1 writes these into the new profile's prefs.js. Run the capture",
  "// script again (and push) whenever you change your Zia or Zen settings."
)
$n = 0
foreach ($line in [IO.File]::ReadAllLines($prefsJs, [Text.Encoding]::UTF8)) {
  if ($line -notmatch '^user_pref\("([^"]+)",') { continue }
  $name = $Matches[1]
  if ($name -match $include -and $name -notmatch $exclude) {
    $out += $line
    $n++
  }
}
$dest = Join-Path $PSScriptRoot "my-settings.js"
[IO.File]::WriteAllText($dest, ($out -join "`n") + "`n", $utf8)
Write-Host "Saved $n settings to $dest" -ForegroundColor Green
