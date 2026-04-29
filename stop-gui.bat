@echo off
setlocal
title Career-Ops-GUI-cn Stop

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ==============================================
echo         Career-Ops-GUI-cn One-Click Stop
echo ==============================================
echo.

echo [1/2] Closing project windows...
taskkill /F /T /FI "WINDOWTITLE eq Career-Ops-GUI-cn API*" >nul 2>nul
taskkill /F /T /FI "WINDOWTITLE eq Career-Ops-GUI-cn Frontend*" >nul 2>nul

echo [2/2] Killing processes on ports 3001 and 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = @(3001,5173); " ^
  "$procIds = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | " ^
  "Where-Object { $ports -contains $_.LocalPort } | " ^
  "Select-Object -ExpandProperty OwningProcess -Unique; " ^
  "foreach ($procId in $procIds) { " ^
  "  if ($procId -and $procId -match '^\d+$') { taskkill /F /T /PID $procId *> $null } " ^
  "}"

timeout /t 2 /nobreak >nul

echo.
echo ==============================================
echo Project services have been stopped.
echo Frontend port: 5173
echo Backend port : 3001
echo ==============================================
echo.
pause
