@echo off
setlocal
title Career-Ops-GUI-cn Restart

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ==============================================
echo       Career-Ops-GUI-cn One-Click Restart
echo ==============================================
echo.

echo [1/4] Closing project windows...
taskkill /F /T /FI "WINDOWTITLE eq Career-Ops-GUI-cn API*" >nul 2>nul
taskkill /F /T /FI "WINDOWTITLE eq Career-Ops-GUI-cn Frontend*" >nul 2>nul

echo [2/4] Killing processes on ports 3001 and 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = @(3001,5173); " ^
  "$procIds = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | " ^
  "Where-Object { $ports -contains $_.LocalPort } | " ^
  "Select-Object -ExpandProperty OwningProcess -Unique; " ^
  "foreach ($procId in $procIds) { " ^
  "  if ($procId -and $procId -match '^\d+$') { taskkill /F /T /PID $procId *> $null } " ^
  "}"

timeout /t 2 /nobreak >nul

echo [3/4] Clearing frontend cache...
if exist "gui\node_modules\.vite" rmdir /s /q "gui\node_modules\.vite"

echo [4/4] Starting services...
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

echo       Starting API server...
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\start-api.vbs"
echo WshShell.Run "cmd /c cd /d ""%ROOT%"" && node gui/server.mjs > ""%ROOT%logs\api.log"" 2> ""%ROOT%logs\api.err.log""", 0, False >> "%TEMP%\start-api.vbs"
cscript //nologo "%TEMP%\start-api.vbs"
del "%TEMP%\start-api.vbs"
echo       API server started (logs: logs\api.log)

timeout /t 3 /nobreak >nul

echo       Starting frontend server...
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\start-frontend.vbs"
echo WshShell.Run "cmd /c cd /d ""%ROOT%gui"" && npm run dev > ""%ROOT%logs\frontend.log"" 2> ""%ROOT%logs\frontend.err.log""", 0, False >> "%TEMP%\start-frontend.vbs"
cscript //nologo "%TEMP%\start-frontend.vbs"
del "%TEMP%\start-frontend.vbs"
echo       Frontend server started (logs: logs\frontend.log)

timeout /t 5 /nobreak >nul

start "" "http://localhost:5173"

echo.
echo ==============================================
echo Restart finished.
echo Frontend: http://localhost:5173
echo Backend : http://localhost:3001
echo Logs    : %ROOT%logs\ (api.log / frontend.log)
echo ==============================================
echo.
echo This window will close automatically in 5 seconds...
timeout /t 5 /nobreak >nul
