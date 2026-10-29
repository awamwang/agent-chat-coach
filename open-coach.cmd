@echo off
rem ============================================================
rem  Reverse-Coach launcher - open the coach page as a desktop
rem  app window (Edge/Chrome --app: no address bar, no tabs).
rem  Uses its own profile dir so it never mixes with your
rem  daily browser windows.
rem
rem  Requires: bridge service on 8913. If it is down, run
rem  start-keepalive.cmd in the bridge repo. The bridge repo is
rem  expected next to the skills dir (..\..\workbuddy-bidge);
rem  set BRIDGE_REPO in the environment to point elsewhere.
rem
rem  NOTE: keep this file ASCII-only and free of literal drive
rem  letters. cmd.exe parses .cmd with the console codepage
rem  (GBK here), so non-ASCII comments garble and break lines;
rem  hardcoded drive letters make the file useless on other
rem  machines, so use %ProgramFiles% / %~dp0 instead.
rem ============================================================
setlocal

set "URL=http://127.0.0.1:8913/web/coach.html"
set "PROFILE=%LOCALAPPDATA%\Temp\acc-app-profile"
set "KEEPALIVE=%~dp0..\..\workbuddy-bidge\start-keepalive.cmd"
if defined BRIDGE_REPO set "KEEPALIVE=%BRIDGE_REPO%\start-keepalive.cmd"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE64=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%URL%').StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo [X] Bridge service 8913 is not running.
  echo     Start it first: %KEEPALIVE%
  echo     Then run this launcher again.
  pause
  exit /b 1
)

if exist "%EDGE%"     ( start "" "%EDGE%"     --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )
if exist "%EDGE64%"   ( start "" "%EDGE64%"   --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )
if exist "%CHROME%"   ( start "" "%CHROME%"   --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )
if exist "%CHROME86%" ( start "" "%CHROME86%" --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )

echo [!] Edge/Chrome not found, falling back to default browser.
start "" "%URL%"
goto :ok

:ok
echo [OK] Opened in app mode: %URL%
echo      Close the window to close the page; bridge and host keep running.
exit /b 0
