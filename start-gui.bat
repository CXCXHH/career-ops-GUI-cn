@echo off
setlocal enabledelayedexpansion
title Career-Ops-GUI-cn Start

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ==============================================
echo        Career-Ops-GUI-cn One-Click Start
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js 18 or later first:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Please make sure Node.js is installed correctly.
  echo.
  pause
  exit /b 1
)

echo [1/4] Running environment check and installing dependencies...
echo       This may take a few minutes on first run...
echo.

call npm run doctor -- --auto-start
if errorlevel 1 (
  echo.
  echo ==============================================
  echo [ERROR] Environment check failed.
  echo Please read the messages above and fix the issues.
  echo ==============================================
  echo.
  pause
  exit /b 1
)

echo.
echo [2/4] Starting API server...
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\start-api.vbs"
echo WshShell.Run "cmd /c cd /d ""%ROOT%"" && node gui/server.mjs > ""%ROOT%logs\api.log"" 2> ""%ROOT%logs\api.err.log""", 0, False >> "%TEMP%\start-api.vbs"
cscript //nologo "%TEMP%\start-api.vbs"
del "%TEMP%\start-api.vbs"
echo       API server started (logs: logs\api.log)

timeout /t 3 /nobreak >nul

echo [3/4] Starting frontend server...
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\start-frontend.vbs"
echo WshShell.Run "cmd /c cd /d ""%ROOT%gui"" && npm run dev > ""%ROOT%logs\frontend.log"" 2> ""%ROOT%logs\frontend.err.log""", 0, False >> "%TEMP%\start-frontend.vbs"
cscript //nologo "%TEMP%\start-frontend.vbs"
del "%TEMP%\start-frontend.vbs"
echo       Frontend server started (logs: logs\frontend.log)

timeout /t 5 /nobreak >nul

echo [4/4] Opening browser...
start "" "http://localhost:5173"

echo.
echo ==============================================
echo Start finished.
echo Frontend: http://localhost:5173
echo Backend : http://localhost:3001
echo Logs    : %ROOT%logs\ (api.log / frontend.log)
echo If the page is not ready yet, wait a few seconds and refresh.
echo ==============================================
echo.
echo This window will close automatically in 5 seconds...
timeout /t 5 /nobreak >nul
