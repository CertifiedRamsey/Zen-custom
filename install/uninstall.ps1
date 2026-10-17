# Removes zen-custom from your Zen profile. Your backups stay where they are.
# Usage (from the repo folder, with Zen CLOSED):
#   powershell -ExecutionPolicy Bypass -File .\install\uninstall.ps1
# Optional: -ProfilePath "<profile folder>" (install.ps1 prints it)
param([string]$ProfilePath)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding $false   # UTF-8 without a BOM
. (Join-Path $PSScriptRoot "find-profile.ps1")

if (Get-Process zen -ErrorAction SilentlyContinue) {
  Write-Host "Please close Zen first, then run this again." -ForegroundColor Yellow
  exit 1
}

if (-not $ProfilePath) { $ProfilePath = Find-ZenProfile }
if (-not (Test-Path $ProfilePath)) { throw "There's no folder at $ProfilePath" }
$ProfilePath = (Resolve-Path $ProfilePath).Path
Write-Host "Zen profile: $ProfilePath"
$chrome = Join-Path $ProfilePath "chrome"

# The looks
Remove-Item (Join-Path $chrome "zen-custom") -Recurse -Force -ErrorAction SilentlyContinue
foreach ($f in "userChrome.css", "userContent.css") {
  $p = Join-Path $chrome $f
  if ((Test-Path $p) -and ((Get-Content $p -Raw) -match 'zen-custom/')) { Remove-Item $p }
}

# The scripts: the local Sine mod, and copies earlier versions left in chrome\JS
$sineMods = Join-Path $chrome "sine-mods"
Remove-Item (Join-Path $sineMods "zen-custom") -Recurse -Force -ErrorAction SilentlyContinue
$modsJson = Join-Path $sineMods "mods.json"
if (Test-Path $modsJson) {
  $asText = @{}
  if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey("DateKind")) { $asText.DateKind = "String" }
  $mods = [IO.File]::ReadAllText($modsJson, [Text.Encoding]::UTF8) | ConvertFrom-Json @asText
  if ($mods.PSObject.Properties["zen-custom"]) {
    $mods.PSObject.Properties.Remove("zen-custom")
    [IO.File]::WriteAllText($modsJson, (ConvertTo-Json -InputObject $mods -Depth 32), $utf8)
  }
}
foreach ($n in "space-routes-helper.uc.js", "tab-monitor.uc.js", "ctrl-tab-switcher.uc.js") {
  Remove-Item (Join-Path (Join-Path $chrome "JS") $n) -Force -ErrorAction SilentlyContinue
}

# The switches: our lines in user.js and our prefs in prefs.js
$uj = Join-Path $ProfilePath "user.js"
if (Test-Path $uj) {
  $keep = @([IO.File]::ReadAllLines($uj, [Text.Encoding]::UTF8) | Where-Object { $_ -notmatch 'zen-custom' })
  [IO.File]::WriteAllText($uj, ($keep -join "`r`n") + "`r`n", $utf8)
}
$prefsJs = Join-Path $ProfilePath "prefs.js"
if (Test-Path $prefsJs) {
  $keep = @([IO.File]::ReadAllLines($prefsJs, [Text.Encoding]::UTF8) | Where-Object { $_ -notmatch '^user_pref\("zen-custom\.' })
  [IO.File]::WriteAllText($prefsJs, ($keep -join "`n") + "`n", $utf8)
}

Write-Host "zen-custom removed. Restore a backup folder if you want your old files back."
Write-Host "Sine's 'Enable installing JS from unofficial sources' was left as it is; untick it in Settings > Sine Mods if nothing else needs it."
