#!/bin/bash

echo "=============================================="
echo "         Career Ops GUI 启动脚本"
echo "=============================================="
echo ""

echo "正在启动 API 服务器..."
node gui/server.mjs &
API_PID=$!

sleep 3

echo "正在启动前端服务器..."
cd gui && npm run dev &
FRONTEND_PID=$!

sleep 5

echo "正在打开浏览器..."
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
elif command -v open &> /dev/null; then
    open http://localhost:5173
fi

echo ""
echo "=============================================="
echo "启动完成！浏览器将自动打开。"
echo "API 服务器: http://localhost:3001"
echo "前端页面: http://localhost:5173"
echo "=============================================="
echo ""
echo "按 Ctrl+C 停止所有服务..."

trap "kill $API_PID $FRONTEND_PID" EXIT

wait