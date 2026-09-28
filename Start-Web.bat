@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22.12 or later.
  set "launcherExit=1"
  goto done
)
node "%~dp0tooling\scripts\launch.mjs" web %*
set "launcherExit=%errorlevel%"
:done
popd
if not "%launcherExit%"=="0" if not defined CI pause
exit /b %launcherExit%
