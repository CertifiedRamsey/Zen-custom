# zen-custom one-command setup for a fresh Windows PC (no admin, no Git).
# Paste this into PowerShell:
#   irm https://raw.githubusercontent.com/CertifiedRamsey/Zen-custom/main/bootstrap.ps1 | iex
#
# It puts Zen in your user folder (%LOCALAPPDATA%\Zen Browser), makes a
# profile, adds Sine, the Sine mods and add-ons listed in setup\setup.json,
# your settings from setup\my-settings.js, then zen-custom, and opens Zen.
# Safe to run again: it reuses Zen and the profile it made last time.
#
# To try another branch first:
#   $env:ZC_BRANCH = "some-branch"; irm https://raw.githubusercontent.com/CertifiedRamsey/Zen-custom/some-branch/bootstrap.ps1 | iex

function Invoke-ZenCustomSetup {
  $ErrorActionPreference = "Stop"
  $ProgressPreference = "SilentlyContinue"   # Windows PowerShell downloads crawl with the progress bar on
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $utf8 = New-Object System.Text.UTF8Encoding $false

  $repoName = "CertifiedRamsey/Zen-custom"
  $branch = if ($env:ZC_BRANCH) { $env:ZC_BRANCH } else { "main" }
  $zenDir = Join-Path $env:LOCALAPPDATA "Zen Browser"
  $zenExe = Join-Path $zenDir "zen.exe"
  $marker = Join-Path $zenDir "zen-custom-profile.txt"   # which profile this copy of Zen uses
  $work = Join-Path $env:TEMP ("zen-custom-setup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Force $work | Out-Null
  $started = Get-Date

  function Step([string]$text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
  function Note([string]$text) { Write-Host "   $text" }
  function Warn([string]$text) { Write-Host "   $text" -ForegroundColor Yellow }

  function Get-File([string]$url, [string]$dest) {
    for ($try = 1; $try -le 3; $try++) {
      try { Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing; return }
      catch {
        if ($try -eq 3) { throw "Couldn't download $url ($($_.Exception.Message))" }
        Start-Sleep -Seconds (2 * $try)
      }
    }
  }
  function Get-Json([string]$url) {
    $f = Join-Path $work ("j" + [guid]::NewGuid().ToString("N") + ".json")
    Get-File $url $f
    return [IO.File]::ReadAllText($f, [Text.Encoding]::UTF8) | ConvertFrom-Json
  }
  # Unzips into a new folder and returns it.
  function Expand-Zip([string]$zip, [string]$name) {
    $d = Join-Path $work $name
    if (Test-Path $d) { Remove-Item $d -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $d -Force
    return $d
  }
  function Stop-Zen {
    $p = @(Get-Process zen -ErrorAction SilentlyContinue)
    if ($p.Count) {
      $p | Stop-Process -Force
      Start-Sleep -Seconds 2
    }
  }
  function Get-InstallDefaults([string]$ini) {
    # profile folders named by the [Install...] sections of profiles.ini
    $out = @()
    if (-not (Test-Path $ini)) { return $out }
    $inInstall = $false
    foreach ($l in [IO.File]::ReadAllLines($ini)) {
      if ($l -match '^\[') { $inInstall = $l -match '^\[Install'; continue }
      if ($inInstall -and $l -match '^Default=(.+)$') {
        $v = $Matches[1].Trim()
        if (-not [IO.Path]::IsPathRooted($v)) { $v = Join-Path (Split-Path $ini) ($v -replace '/', '\') }
        $out += $v
      }
    }
    return $out
  }

  Write-Host "zen-custom setup ($branch). Takes a few minutes; leave this window open." -ForegroundColor Green
  if (Get-Process zen -ErrorAction SilentlyContinue) {
    Warn "Zen is open. Closing it in 5 seconds (press Ctrl+C to stop)..."
    Start-Sleep -Seconds 5
    Stop-Zen
  }

  # 1. zen-custom itself, as a zip (no Git needed). Everything else is listed in it.
  Step "1/8 Downloading zen-custom"
  $zip = Join-Path $work "zen-custom.zip"
  Get-File "https://codeload.github.com/$repoName/zip/refs/heads/$branch" $zip
  $x = Expand-Zip $zip "zen-custom"
  $repo = @(Get-ChildItem $x -Directory)[0].FullName
  $keep = Join-Path $env:LOCALAPPDATA "zen-custom"
  if (Test-Path $keep) { Remove-Item $keep -Recurse -Force }
  Copy-Item $repo $keep -Recurse
  $repo = $keep
  $setup = [IO.File]::ReadAllText((Join-Path $repo "setup\setup.json"), [Text.Encoding]::UTF8) | ConvertFrom-Json
  Note "Saved to $repo"

  # 2. Zen. Its installer is a 7-Zip archive; unpacking it ourselves needs no admin.
  Step "2/8 Getting Zen"
  if (Test-Path $zenExe) {
    Note "Zen is already in $zenDir, keeping it (it updates itself)."
  } else {
    $installer = Join-Path $work "zen.installer.exe"
    $7zr = Join-Path $work "7zr.exe"
    Note "Downloading Zen (about 120 MB)..."
    Get-File "https://github.com/zen-browser/desktop/releases/latest/download/zen.installer.exe" $installer
    Get-File "https://github.com/ip7z/7zip/releases/latest/download/7zr.exe" $7zr
    $out = Join-Path $work "zen-unpacked"
    & $7zr x -t7z $installer "-o$out" -y -bso0 -bsp0 | Out-Null
    $core = Join-Path $out "core"
    if (-not (Test-Path (Join-Path $core "zen.exe"))) { throw "Unpacking the Zen installer didn't give zen.exe (7-Zip exit code $LASTEXITCODE)." }
    New-Item -ItemType Directory -Force $zenDir | Out-Null
    Copy-Item (Join-Path $core "*") $zenDir -Recurse -Force
    Note "Zen is in $zenDir"
  }

  # Shortcuts on the desktop and in the Start menu.
  $shell = New-Object -ComObject WScript.Shell
  foreach ($dir in [Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("Programs")) {
    $lnk = $shell.CreateShortcut((Join-Path $dir "Zen Browser.lnk"))
    $lnk.TargetPath = $zenExe
    $lnk.WorkingDirectory = $zenDir
    $lnk.Save()
  }

  # 3. Add-ons and quiet first start, through Zen's policies file (in Zen's own folder).
  Step "3/8 Setting up add-ons"
  $ext = [ordered]@{}
  foreach ($e in $setup.extensions) {
    $ext[$e.id] = [ordered]@{
      installation_mode = "normal_installed"
      install_url       = "https://addons.mozilla.org/firefox/downloads/latest/$($e.slug)/latest.xpi"
    }
    Note $e.name
  }
  $policies = [ordered]@{ policies = [ordered]@{ DontCheckDefaultBrowser = $true; ExtensionSettings = $ext } }
  $dist = Join-Path $zenDir "distribution"
  New-Item -ItemType Directory -Force $dist | Out-Null
  [IO.File]::WriteAllText((Join-Path $dist "policies.json"), (ConvertTo-Json -InputObject $policies -Depth 8), $utf8)
  Note "They install themselves the first time Zen opens."

  # 4. A profile. Zen makes its own on first start, so start it once, hidden.
  Step "4/8 Making your Zen profile"
  $zenData = Join-Path $env:APPDATA "zen"
  $ini = Join-Path $zenData "profiles.ini"
  $prof = $null
  if (Test-Path $marker) {
    $p = [IO.File]::ReadAllText($marker).Trim()
    if ($p -and (Test-Path $p)) { $prof = $p; Note "Using the profile from last time." }
  }
  if (-not $prof) {
    $before = @(Get-InstallDefaults $ini)
    $proc = Start-Process $zenExe -ArgumentList "-headless", "about:blank" -PassThru
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline -and -not $prof) {
      Start-Sleep -Seconds 2
      foreach ($p in @(Get-InstallDefaults $ini)) {
        if ($before -notcontains $p -and (Test-Path (Join-Path $p "times.json"))) { $prof = $p }
      }
    }
    Start-Sleep -Seconds 3
    if (-not $proc.HasExited) { $proc | Stop-Process -Force }
    Stop-Zen
    if (-not $prof) {
      # Zen picked a profile it already knew about; take the newest.
      $prof = @(Get-InstallDefaults $ini | Where-Object { Test-Path $_ } |
          Sort-Object { (Get-Item $_).LastWriteTime } -Descending)[0]
    }
    if (-not $prof) { throw "Zen didn't make a profile. Open Zen once, close it, and run this again." }
    [IO.File]::WriteAllText($marker, $prof, $utf8)
  }
  $prof = (Resolve-Path $prof).Path
  $chrome = Join-Path $prof "chrome"
  $sineMods = Join-Path $chrome "sine-mods"
  New-Item -ItemType Directory -Force $sineMods | Out-Null
  Note $prof

  # 5. Sine: its loader goes next to zen.exe, its engine into the profile.
  Step "5/8 Installing Sine"
  $engine = Get-Json "https://raw.githubusercontent.com/CosmoCreeper/Sine/main/engine.json"
  $sineVer = $engine.updates[0].version
  $boot = $engine.bootloader
  $z = Join-Path $work "program.zip"; Get-File "https://github.com/sineorg/bootloader/releases/download/v$boot/program.zip" $z
  Copy-Item (Join-Path (Expand-Zip $z "program") "*") $zenDir -Recurse -Force
  $z = Join-Path $work "profile.zip"; Get-File "https://github.com/sineorg/bootloader/releases/download/v$boot/profile.zip" $z
  Copy-Item (Join-Path (Expand-Zip $z "profile") "*") $chrome -Recurse -Force
  $z = Join-Path $work "engine.zip"; Get-File "https://github.com/CosmoCreeper/Sine/releases/download/v$sineVer/engine.zip" $z
  $js = Join-Path $chrome "JS"
  if (Test-Path $js) { Remove-Item $js -Recurse -Force }
  Copy-Item (Join-Path (Expand-Zip $z "engine") "*") $chrome -Recurse -Force
  Note "Sine $sineVer"

  # 6. Sine mods, fetched the way Sine's own store does it.
  Step "6/8 Installing Sine mods"
  $modsJson = Join-Path $sineMods "mods.json"
  $mods = New-Object PSObject
  if (Test-Path $modsJson) {
    $raw = [IO.File]::ReadAllText($modsJson, [Text.Encoding]::UTF8)
    if ($raw.Trim()) { $mods = $raw | ConvertFrom-Json }
  }
  $market = $null
  foreach ($m in $setup.sineMods) {
    try {
      if ($m.from -eq "store") {
        if (-not $market) { $market = Get-Json "https://raw.githubusercontent.com/sineorg/store/main/marketplace.json" }
        $data = $market.($m.id)
        if (-not $data) { throw "it isn't in Sine's store any more" }
        $homeUrl = $data.homepage; $ref = $data.commit
      } else {
        $data = Get-Json "https://raw.githubusercontent.com/$($m.repo)/HEAD/theme.json"
        $homeUrl = "https://github.com/$($m.repo)"; $ref = "HEAD"
      }
      if ($homeUrl -notmatch 'github\.com/([^/]+)/([^/?#]+?)(?:\.git)?(?:/tree/[^/]+/(.+?))?/*$') { throw "can't read its GitHub link $homeUrl" }
      $owner = $Matches[1]; $name = $Matches[2]; $folder = $Matches[3]
      if (-not $ref) { $ref = "HEAD" }

      $z = Join-Path $work "mod-$($m.id).zip"
      Get-File "https://codeload.github.com/$owner/$name/zip/$ref" $z
      $src = @(Get-ChildItem (Expand-Zip $z "mod-$($m.id)") -Directory)[0].FullName
      if ($folder) { $src = Join-Path $src ($folder -replace '/', '\') }
      $dest = Join-Path $sineMods $m.id
      if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
      Copy-Item $src $dest -Recurse

      # Where the mod's CSS and settings live inside its folder (same rules as Sine).
      $findFile = {
        param($want, [string[]]$names)
        if ($want -is [string] -and $want) {
          $w = $want
          if ($w -match '^https://raw\.githubusercontent\.com/[^/]+/[^/]+/(?:refs/heads/)?[^/]+/(.+)$') { $w = $Matches[1] }
          elseif ($w -match '^https://github\.com/[^/]+/[^/]+/(?:blob|raw|tree)/[^/]+/(.+)$') { $w = $Matches[1] }
          if ($folder -and $w.StartsWith("$folder/")) { $w = $w.Substring($folder.Length + 1) }
          if (Test-Path (Join-Path $dest ($w -replace '/', '\'))) { return $w }
        }
        $hits = @(Get-ChildItem $dest -Recurse -File | Where-Object { $names -contains $_.Name } | ForEach-Object {
            $_.FullName.Substring($dest.Length + 1) -replace '\\', '/' })
        if ($hits.Count -eq 0) { return "" }
        $min = ($hits | ForEach-Object { ($_ -split '/').Count } | Measure-Object -Minimum).Minimum
        $top = @($hits | Where-Object { ($_ -split '/').Count -eq $min })
        if ($top.Count -eq 1) { return $top[0] } else { return "" }
      }
      $chromeWant = $null; $contentWant = $null
      if ($data.style -is [string]) { $chromeWant = $data.style }
      elseif ($data.style) { $chromeWant = $data.style.chrome; $contentWant = $data.style.content }
      $style = [ordered]@{
        chrome  = & $findFile $chromeWant @("userChrome.css", "chrome.css")
        content = & $findFile $contentWant @("userContent.css")
      }
      $prefsFile = & $findFile $data.preferences @("preferences.json")

      $entry = $data
      $entry | Add-Member -NotePropertyName style -NotePropertyValue $style -Force
      $entry | Add-Member -NotePropertyName preferences -NotePropertyValue $prefsFile -Force
      if ($m.from -eq "store") { $entry | Add-Member -NotePropertyName origin -NotePropertyValue "store" -Force }
      elseif ($entry.PSObject.Properties["origin"]) { $entry.PSObject.Properties.Remove("origin") }
      $entry | Add-Member -NotePropertyName "no-updates" -NotePropertyValue $false -Force
      $entry | Add-Member -NotePropertyName enabled -NotePropertyValue $true -Force
      $mods | Add-Member -NotePropertyName $m.id -NotePropertyValue $entry -Force
      $ver = if ($data.version) { " $($data.version)" } else { "" }
      Note "$($m.name)$ver"
    } catch {
      Warn "Skipped $($m.name): $($_.Exception.Message)"
    }
  }
  [IO.File]::WriteAllText($modsJson, (ConvertTo-Json -InputObject $mods -Depth 32), $utf8)

  # 7. Your settings (Zia's config, the mods', Zen's), written straight into prefs.js.
  Step "7/8 Restoring your settings"
  $prefsJs = Join-Path $prof "prefs.js"
  $mine = @([IO.File]::ReadAllLines((Join-Path $repo "setup\my-settings.js"), [Text.Encoding]::UTF8) |
      Where-Object { $_ -match '^user_pref\("' })
  $names = @{}
  foreach ($l in $mine) { if ($l -match '^user_pref\("([^"]+)"') { $names[$Matches[1]] = $true } }
  $old = @()
  if (Test-Path $prefsJs) {
    $old = @([IO.File]::ReadAllLines($prefsJs, [Text.Encoding]::UTF8) | Where-Object {
        -not ($_ -match '^user_pref\("([^"]+)"' -and $names.ContainsKey($Matches[1])) })
  }
  [IO.File]::WriteAllText($prefsJs, ((@($old) + $mine) -join "`n") + "`n", $utf8)
  Note "$($mine.Count) settings"

  # 8. zen-custom's own installer (CSS, scripts, its switches).
  Step "8/8 Installing zen-custom"
  $ps = Join-Path $PSHOME "powershell.exe"
  if (-not (Test-Path $ps)) { $ps = "powershell.exe" }
  & $ps -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo "install\install.ps1") -ProfilePath $prof -Yes
  if ($LASTEXITCODE) { throw "zen-custom's installer stopped (exit code $LASTEXITCODE)." }

  $cache = Join-Path (Join-Path $env:LOCALAPPDATA "zen\Profiles") (Split-Path $prof -Leaf)
  Remove-Item (Join-Path $cache "startupCache") -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue

  $mins = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
  Write-Host ""
  Write-Host "All done in $mins min. Opening Zen..." -ForegroundColor Green
  Write-Host "Sign in to your Mozilla account in Zen to bring back bookmarks and passwords."
  Start-Process $zenExe
}

try { Invoke-ZenCustomSetup }
catch {
  Write-Host ""
  Write-Host "Setup stopped: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Copy this window's text and send it to Claude."
}
