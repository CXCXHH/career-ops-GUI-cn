@echo off
chcp 65001 >nul

echo 正在启动 API 服务器...
start "API Server" /min node gui/server.mjs

timeout /t 3 /nobreak >nul

echo 正在启动前端服务器...
start "Frontend Server" /min cmd /k "cd gui && npm run dev"

timeout /t 5 /nobreak >nul

start http://localhost:5173