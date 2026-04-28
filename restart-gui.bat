@echo off
chcp 65001 >nul
title Career Ops - 重启脚本

echo ==============================================
echo          Career Ops GUI 重启脚本
echo ==============================================
echo.

echo 正在停止现有服务...
taskkill /F /IM node.exe 2>NUL
timeout /t 2 /nobreak >nul

echo 正在清除缓存...
rmdir /s /q "gui\node_modules\.vite" 2>NUL
rmdir /s /q "gui\dist" 2>NUL

echo 正在重新安装依赖...
cd gui && npm install
cd ..

echo 正在启动 API 服务器...
start "API Server" /min node gui/server.mjs

timeout /t 3 /nobreak >nul

echo 正在启动前端服务器...
start "Frontend Server" /min cmd /k "cd gui && npm run dev"

timeout /t 5 /nobreak >nul

echo 正在打开浏览器...
start http://localhost:5173

echo.
echo ==============================================
echo 启动完成！浏览器将自动打开。
echo API 服务器: http://localhost:3001
echo 前端页面: http://localhost:5173
echo ==============================================
echo.
echo 按任意键关闭此窗口...
pause >nul