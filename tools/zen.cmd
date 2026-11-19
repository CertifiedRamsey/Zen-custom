@echo off
setlocal
rem The "zen" command that zen-custom's installer adds (zen ss = fake coding screensaver).
rem The screensaver is read as text and run, so it works even where PowerShell
rem won't run script files (a school PC's policy).
if /i "%~1"=="ss" (
  set "ZC_SS=%~dp0lib\screensaver.ps1"
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([IO.File]::ReadAllText($env:ZC_SS)))"
  exit /b
)
echo zen-custom commands:
echo   zen ss    fake coding screensaver (Ctrl+T ends it)
