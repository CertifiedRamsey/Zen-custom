# zen-custom health check. Safe to run any time, with Zen open or closed;
# it only reads, except with -MarkGood.
# Usage (from the repo folder):
#   powershell -ExecutionPolicy Bypass -File .\install\check.ps1
#   powershell -ExecutionPolicy Bypass -File .\install\check.ps1 -MarkGood
# -MarkGood saves today's Zen and mod versions as "everything works", so the
# next check can say exactly what changed since then.
# The report is also copied to the clipboard, ready to paste to Claude.
param([string]$ProfilePath, [switch]$MarkGood)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding $false
. (Join-Path $PSScriptRoot "find-profile.ps1")

if (-not $ProfilePath) { $ProfilePath = Find-ZenProfile }
if (-not (Test-Path $ProfilePath)) { throw "There's no folder at $ProfilePath" }
$ProfilePath = (Resolve-Path $ProfilePath).Path
$chrome = Join-Path $ProfilePath "chrome"
$sineMods = Join-Path $chrome "sine-mods"

$report = New-Object System.Collections.Generic.List[string]
$problems = 0
function Say([string]$text, [string]$color = "Gray") { Write-Host $text -ForegroundColor $color; $report.Add($text) }
function Ok([string]$text) { Say "  OK    $text" "Green" }
function Bad([string]$text, [string]$fix) {
  Say "  FIX   $text" "Red"
  if ($fix) { Say "        -> $fix" "Yellow" }
  $script:problems++
}

Say "zen-custom health check, $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Say "Profile: $ProfilePath"
Say ""

# What's installed now
$zenVersion = "unknown"
$compat = Join-Path $ProfilePath "compatibility.ini"
if (Test-Path $compat) {
  foreach ($l in [IO.File]::ReadAllLines($compat)) {
    if ($l -match '^LastVersion=([^_]+)') { $zenVersion = $Matches[1] }
  }
}
$now = [ordered]@{ zen = $zenVersion }
$mods = $null
$modsJson = Join-Path $sineMods "mods.json"
if (Test-Path $modsJson) {
  try {
    $asText = @{}
    if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey("DateKind")) { $asText.DateKind = "String" }
    $mods = [IO.File]::ReadAllText($modsJson, [Text.Encoding]::UTF8) | ConvertFrom-Json @asText
  } catch { $mods = $null }
}
if ($mods) {
  foreach ($p in $mods.PSObject.Properties) {
    $m = $p.Value
    if ($m.enabled) { $now[[string]$m.name] = [string]$m.version }
  }
}

Say "Versions"
foreach ($k in $now.Keys) { Say ("  {0,-24} {1}" -f $k, $now[$k]) }
Say ""

# Is zen-custom wired up?
Say "Checks"
$uj = Join-Path $ProfilePath "user.js"
if ((Test-Path $uj) -and ([IO.File]::ReadAllText($uj) -match 'legacyUserProfileCustomizations\.stylesheets",\s*true')) {
  Ok "Zen is allowed to load userChrome.css"
} else { Bad "Zen isn't told to load userChrome.css (user.js)" "Run install.ps1 again." }

foreach ($pair in @(@("userChrome.css", "zen-custom/userChrome.css"), @("userContent.css", "zen-custom/userContent.css"))) {
  $p = Join-Path $chrome $pair[0]
  if ((Test-Path $p) -and ([IO.File]::ReadAllText($p) -match [regex]::Escape($pair[1]))) {
    Ok "$($pair[0]) loads zen-custom"
  } else { Bad "$($pair[0]) doesn't load zen-custom (something replaced it)" "Run install.ps1 again." }
}

$missing = @()
foreach ($sheet in "userChrome.css", "userContent.css") {
  $p = Join-Path (Join-Path $chrome "zen-custom") $sheet
  if (-not (Test-Path $p)) { $missing += "zen-custom/$sheet"; continue }
  foreach ($m in [regex]::Matches([IO.File]::ReadAllText($p), '@import url\("([^"]+)"\)')) {
    $rel = $m.Groups[1].Value -replace '/', '\'
    if (-not (Test-Path (Join-Path (Join-Path $chrome "zen-custom") $rel))) { $missing += $m.Groups[1].Value }
  }
}
if ($missing.Count) { Bad "Style files missing: $($missing -join ', ')" "Run install.ps1 again." }
else { Ok "All style modules are in place" }

if (-not $mods) {
  Bad "Couldn't read Sine's mod list ($modsJson)" "Is Sine still installed? Open Settings > Sine Mods."
} else {
  $zc = $mods.PSObject.Properties["zen-custom"]
  if (-not $zc) { Bad "zen-custom scripts aren't in Sine's mod list (Sine or an update removed them)" "Run install.ps1 again." }
  elseif (-not $zc.Value.enabled) { Bad "zen-custom scripts are switched off in Sine" "Settings > Sine Mods > turn zen-custom on." }
  else {
    $lost = @()
    foreach ($s in $zc.Value.scripts.PSObject.Properties) {
      if (-not (Test-Path (Join-Path (Join-Path $sineMods "zen-custom") $s.Name))) { $lost += $s.Name }
    }
    if ($lost.Count) { Bad "Script files missing: $($lost -join ', ')" "Run install.ps1 again." }
    else { Ok "zen-custom scripts are registered with Sine ($(@($zc.Value.scripts.PSObject.Properties).Count) scripts)" }
  }
}

$prefsJs = Join-Path $ProfilePath "prefs.js"
$prefs = ""
if (Test-Path $prefsJs) { $prefs = [IO.File]::ReadAllText($prefsJs, [Text.Encoding]::UTF8) }
if ($prefs -match 'user_pref\("sine\.allow-unsafe-js",\s*true\)') { Ok "Sine may run your own scripts" }
else { Bad "Sine's 'Enable installing JS from unofficial sources' is off, so the scripts won't run" "Settings > Sine Mods > tick it, then restart Zen." }

$off = @([regex]::Matches($prefs, 'user_pref\("(zen-custom\.[a-z-]+)",\s*false\)') | ForEach-Object { $_.Groups[1].Value })
if ($off.Count) { Say "  INFO  Switched off in about:config: $($off -join ', ')" }
Say ""

# What changed since the last time everything worked?
$goodFile = Join-Path $ProfilePath "zen-custom-known-good.json"
if (Test-Path $goodFile) {
  $good = [IO.File]::ReadAllText($goodFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
  Say "Changed since it last worked ($($good.date))"
  $changes = 0
  foreach ($k in $now.Keys) {
    $was = $good.versions.$k
    if ($null -eq $was) { Say "  NEW   $k $($now[$k])" "Yellow"; $changes++ }
    elseif ([string]$was -ne [string]$now[$k]) { Say "  UPD   $k $was -> $($now[$k])" "Yellow"; $changes++ }
  }
  foreach ($p in $good.versions.PSObject.Properties) {
    if (-not $now.Contains($p.Name)) { Say "  GONE  $($p.Name) (was $($p.Value))" "Yellow"; $changes++ }
  }
  if (-not $changes) { Say "  Nothing. Same Zen and same mods." }
} else {
  Say "No 'it works' snapshot yet. Once things look right, run this with -MarkGood."
}
Say ""

if ($MarkGood) {
  $snap = [ordered]@{ date = (Get-Date -Format "yyyy-MM-dd HH:mm"); versions = $now }
  [IO.File]::WriteAllText($goodFile, (ConvertTo-Json -InputObject $snap -Depth 5), $utf8)
  Say "Saved today's versions as 'everything works'." "Green"
}

if ($problems) { Say "$problems thing(s) to fix, see FIX above." "Red" }
else { Say "All checks passed. If something still looks wrong, it's Zen or a mod changing; paste this report to Claude." "Green" }

try { Set-Clipboard -Value ($report -join "`r`n"); Write-Host "(Report copied. Paste it to Claude with Ctrl+V.)" } catch { }
