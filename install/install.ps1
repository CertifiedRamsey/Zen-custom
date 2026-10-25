# zen-custom installer for Windows (x64).
# Usage (from the repo folder, with Zen CLOSED):
#   powershell -ExecutionPolicy Bypass -File .\install\install.ps1
# Optional: -ProfilePath "C:\Users\you\AppData\Roaming\zen\Profiles\abc.Default (release)"
# -Yes answers yes to its one question (used by bootstrap.ps1).
param([string]$ProfilePath, [switch]$Yes)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding $false   # UTF-8 without a BOM
# Bump VERSION with every change, so Sine's mod list shows which one is installed.
$version = "0.0.0"
$vf = Join-Path $repo "VERSION"
if (Test-Path $vf) { $version = ([IO.File]::ReadAllText($vf)).Trim() }
. (Join-Path $PSScriptRoot "find-profile.ps1")

# only this login's Zen (a shared PC can show other people's too)
$mySession = (Get-Process -Id $PID).SessionId
if (Get-Process zen -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $mySession }) {
  Write-Host "Please close Zen first, then run this again." -ForegroundColor Yellow
  exit 1
}

if (-not $ProfilePath) { $ProfilePath = Find-ZenProfile }
if (-not (Test-Path $ProfilePath)) { throw "There's no folder at $ProfilePath" }
$ProfilePath = (Resolve-Path $ProfilePath).Path
Write-Host "Zen profile: $ProfilePath"

$chrome = Join-Path $ProfilePath "chrome"
New-Item -ItemType Directory -Force $chrome | Out-Null
$uj = Join-Path $ProfilePath "user.js"
$prefsJs = Join-Path $ProfilePath "prefs.js"
$sineMods = Join-Path $chrome "sine-mods"
$modsJson = Join-Path $sineMods "mods.json"

# Back up anything we're about to touch.
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProfilePath "zen-custom-backup-$stamp"
New-Item -ItemType Directory -Force $backup | Out-Null
foreach ($f in "userChrome.css", "userContent.css", "zen-custom") {
  $p = Join-Path $chrome $f
  if (Test-Path $p) { Copy-Item $p $backup -Recurse -Force }
}
foreach ($p in $uj, $prefsJs, $modsJson) {
  if (Test-Path $p) { Copy-Item $p $backup -Force }
}
Write-Host "Backup saved to $backup"

# Copy our modules into chrome\zen-custom (replaced on every install).
$dest = Join-Path $chrome "zen-custom"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item (Join-Path (Join-Path $repo "chrome") "zen-custom") $dest -Recurse

# userChrome.css / userContent.css become one-line loaders for our code.
Set-Content (Join-Path $chrome "userChrome.css") '@import url("zen-custom/userChrome.css");' -Encoding UTF8
Set-Content (Join-Path $chrome "userContent.css") '@import url("zen-custom/userContent.css");' -Encoding UTF8

# JS features run as a small local Sine mod: Sine only runs scripts from mods
# listed in chrome\sine-mods\mods.json, so files left in chrome\JS (where
# earlier versions of this installer put them) never ran.
$scripts = @(Get-ChildItem (Join-Path $repo "js") -Filter *.uc.js -ErrorAction SilentlyContinue)
foreach ($s in $scripts) {
  $old = Join-Path (Join-Path $chrome "JS") $s.Name
  if (Test-Path $old) { Remove-Item $old -Force }
}
$sineHere = (Test-Path $sineMods) -or (Test-Path (Join-Path (Join-Path $chrome "JS") "sine.sys.mjs"))
$scriptsReady = $false
if ($scripts.Count -and -not $sineHere) {
  Write-Host "Sine isn't installed in this profile, so the script features (Routes, Tab Monitor, Ctrl+Tab," -ForegroundColor Yellow
  Write-Host "Folder style, PDF night mode) can't run" -ForegroundColor Yellow
  Write-Host "(everything else works). Install Sine, then run this installer again." -ForegroundColor Yellow
} elseif ($scripts.Count) {
  try {
    $mods = New-Object PSObject
    if (Test-Path $modsJson) {
      $raw = [IO.File]::ReadAllText($modsJson, [Text.Encoding]::UTF8)
      # keep other mods' dates as written (PowerShell 7 would turn them into dates)
      $asText = @{}
      if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey("DateKind")) { $asText.DateKind = "String" }
      if ($raw.Trim()) { $mods = $raw | ConvertFrom-Json @asText }
    }
    $modDir = Join-Path $sineMods "zen-custom"
    if (Test-Path $modDir) { Remove-Item $modDir -Recurse -Force }
    New-Item -ItemType Directory -Force $modDir | Out-Null
    $scripts | Copy-Item -Destination $modDir -Force

    $entryScripts = [ordered]@{}
    foreach ($s in $scripts) { $entryScripts[$s.Name] = @{ include = @("chrome://browser/content/browser.xhtml") } }
    $entry = [ordered]@{
      id           = "zen-custom"
      name         = "zen-custom"
      description  = "Routes, Tab Monitor, Ctrl+Tab switcher, Folder style and PDF night mode from the zen-custom repo. Its installer keeps this up to date."
      version      = $version
      updatedAt    = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture)
      scripts      = $entryScripts
      enabled      = $true
      "no-updates" = $true
    }
    $mods | Add-Member -NotePropertyName "zen-custom" -NotePropertyValue $entry -Force
    [IO.File]::WriteAllText($modsJson, (ConvertTo-Json -InputObject $mods -Depth 32), $utf8)
    $scriptsReady = $true
  } catch {
    Write-Host "Couldn't add the scripts to Sine's mod list ($modsJson): $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Everything else is installed. The backup folder has the list as it was." -ForegroundColor Yellow
  }
}

# Default on/off switches go into prefs.js only when missing, so anything you
# change in about:config stays changed. (Earlier versions wrote them to
# user.js, which put them back on every start.)
$prefsText = ""
if (Test-Path $prefsJs) { $prefsText = [IO.File]::ReadAllText($prefsJs, [Text.Encoding]::UTF8) }
$add = @()
foreach ($line in [IO.File]::ReadAllLines((Join-Path $repo "user.js"), [Text.Encoding]::UTF8)) {
  # our own switches, plus the few Zen settings this repo chooses for you
  if ($line -match '^\s*user_pref\("(zen-custom\.[^"]+|zen\.view\.show-newtab-button-top)"') {
    $name = [regex]::Escape($Matches[1])
    if ($prefsText -notmatch "user_pref\(`"$name`"") { $add += $line.Trim() }
  }
}

# Sine runs scripts that aren't from its own store only when its setting
# "Enable installing JS from unofficial sources" (sine.allow-unsafe-js) is on.
if ($scriptsReady -and $prefsText -notmatch 'user_pref\("sine\.allow-unsafe-js",\s*true\)') {
  Write-Host ""
  Write-Host "Routes, Tab Monitor, Ctrl+Tab, Folder style and PDF night mode are scripts. Sine only"
  Write-Host "runs scripts that don't come from its own store when its setting"
  Write-Host "'Enable installing JS from unofficial sources' is on."
  Write-Host "These are your own scripts from this repo."
  $answer = if ($Yes) { "y" } else { Read-Host "Turn that setting on now? [Y/n]" }
  if ($answer -notmatch '^\s*n') {
    $add += 'user_pref("sine.allow-unsafe-js", true);'
  } else {
    Write-Host "Left off. The scripts stay installed and start once you tick it in Settings > Sine Mods."
  }
}

if ($add.Count) {
  $lead = ""
  if ($prefsText -and -not $prefsText.EndsWith("`n")) { $lead = "`n" }
  [IO.File]::AppendAllText($prefsJs, $lead + ($add -join "`n") + "`n", $utf8)
}

# user.js keeps one line from us: the switch that lets Zen load userChrome.css.
# Lines earlier versions copied in (prefs and their comments) come out.
$ours = @(
  "// Thato's requests",
  "// Extras, off until wanted",
  "// JS features (need fx-autoconfig, which Sine installs)",
  "// Flip any of these in about:config to turn a feature on or off live."
)
$keep = @()
if (Test-Path $uj) {
  foreach ($l in [IO.File]::ReadAllLines($uj, [Text.Encoding]::UTF8)) {
    if ($l -match 'zen-custom' -or $l -match 'legacyUserProfileCustomizations' -or $ours -contains $l.Trim()) { continue }
    # no runs of blank lines where those were
    if (-not $l.Trim() -and ($keep.Count -eq 0 -or -not $keep[-1].Trim())) { continue }
    $keep += $l
  }
  if ($keep.Count -and -not $keep[-1].Trim()) { $keep = @($keep | Select-Object -First ($keep.Count - 1)) }
}
$keep += 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true); // zen-custom'
[IO.File]::WriteAllText($uj, ($keep -join "`r`n") + "`r`n", $utf8)

Write-Host "Done: zen-custom $version. Open Zen to see the changes." -ForegroundColor Green
Write-Host "Once it looks right, run: powershell -ExecutionPolicy Bypass -File .\install\check.ps1 -MarkGood"
