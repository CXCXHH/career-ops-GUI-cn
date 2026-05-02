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
start "Career-Ops-GUI-cn API" /min cmd /k "cd /d ""%ROOT%"" && node gui/server.mjs"

timeout /t 3 /nobreak >nul

echo [3/4] Starting frontend server...
start "Career-Ops-GUI-cn Frontend" /min cmd /k "cd /d ""%ROOT%gui"" && npm run dev"

timeout /t 5 /nobreak >nul

echo [4/4] Opening browser...
start "" "http://localhost:5173"

echo.
echo ==============================================
echo Start finished.
echo Frontend: http://localhost:5173
echo Backend : http://localhost:3001
echo If the page is not ready yet, wait a few seconds and refresh.
echo ==============================================
echo.
pause
