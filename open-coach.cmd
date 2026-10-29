@echo off
rem ============================================================
rem  反向输出师 · 外部程序启动器（不在 WorkBuddy 里打开）
rem  行为：优先用 Edge / Chrome 的「应用模式」开一个独立窗口
rem        （--app，无地址栏无标签页，像原生程序）；
rem        独立 user-data-dir，不和你日常浏览器的窗口混在一起。
rem  前提：8913 桥服务在线。不在线就双击
rem        G:\Projects\19AI\workbuddy-bidge\start-keepalive.cmd
rem  说明：本文件只负责「打开页面」。判定能力仍在 WorkBuddy 会话里的教练，
rem        页面右下角显示「已连接 server」但下拉里没有在线宿主 = 需要挂宿主。
rem ============================================================
chcp 65001 >nul
setlocal

set "URL=http://127.0.0.1:8913/web/coach.html"
set "PROFILE=%LOCALAPPDATA%\Temp\acc-app-profile"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE64=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

rem ---- 先探服务（页面是服务端渲染的静态页，服务没起就必然是错误页）----
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%URL%').StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo [!] 8913 桥服务没在线。
  echo     请先双击: G:\Projects\19AI\workbuddy-bidge\start-keepalive.cmd
  echo     然后重新运行本文件。
  pause
  exit /b 1
)

if exist "%EDGE%"     ( start "" "%EDGE%"     --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )
if exist "%EDGE64%"   ( start "" "%EDGE64%"   --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )
if exist "%CHROME%"   ( start "" "%CHROME%"   --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )
if exist "%CHROME86%" ( start "" "%CHROME86%" --app="%URL%" --user-data-dir="%PROFILE%" & goto :ok )

echo [!] 没找到 Edge 或 Chrome，改用系统默认浏览器。
start "" "%URL%"
goto :ok

:ok
echo [ok] 已用应用模式打开: %URL%
echo      关闭窗口 = 关闭页面，不影响桥服务和教练宿主。
timeout /t 2 >nul
exit /b 0
