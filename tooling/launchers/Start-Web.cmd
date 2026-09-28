@echo off
setlocal
cd /d "%~dp0..\.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22.12 or later.
  pause
  exit /b 1
)
node "%~dp0..\scripts\launch.mjs" web %*
set "launcherExit=%errorlevel%"
if not "%launcherExit%"=="0" pause
exit /b %launcherExit%
