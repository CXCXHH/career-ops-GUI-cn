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

echo [4/4] Starting project again...
call "%ROOT%start-gui.bat"
exit /b %errorlevel%
