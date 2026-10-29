@echo off
rem ============================================================
rem  Reverse-Coach launcher - open the coach page as a desktop
rem  app window (Edge/Chrome --app: no address bar, no tabs).
rem  Uses its own profile dir so it never mixes with your
rem  daily browser windows.
rem
rem  Requires: bridge service on 8913. If it is down, run
rem  G:\Projects\19AI\workbuddy-bidge\start-keepalive.cmd first.
rem
rem  NOTE: keep this file ASCII-only. cmd.exe parses .cmd with the
rem  console codepage (GBK here), so non-ASCII comments garble and
rem  break lines.
rem ============================================================
setlocal

set "URL=http://127.0.0.1:8913/web/coach.html"
set "PROFILE=%LOCALAPPDATA%\Temp\acc-app-profile"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE64=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%URL%').StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo [X] Bridge service 8913 is not running.
  echo     Start it first: G:\Projects\19AI\workbuddy-bidge\start-keepalive.cmd
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
