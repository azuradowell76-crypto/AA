#!/bin/bash

echo "🚀 启动思维导图AI应用（含导出功能）"
echo

echo "📋 检查依赖..."
cd backend
if [ ! -d "node_modules/puppeteer" ]; then
    echo "❌ 缺少puppeteer依赖，正在安装..."
    npm install puppeteer
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败，请检查网络连接"
        exit 1
    fi
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖检查通过"
fi

echo
echo "🔧 启动后端服务..."
gnome-terminal --title="后端服务" -- bash -c "npm start; exec bash" &
# 如果没有gnome-terminal，使用其他终端模拟器
# xterm -title "后端服务" -e "npm start; bash" &
# konsole --title "后端服务" -e bash -c "npm start; exec bash" &

echo
echo "⏳ 等待后端服务启动..."
sleep 5

echo
echo "🌐 启动前端服务..."
cd ../frontend
gnome-terminal --title="前端服务" -- bash -c "npm start; exec bash" &
# 如果没有gnome-terminal，使用其他终端模拟器
# xterm -title "前端服务" -e "npm start; bash" &
# konsole --title "前端服务" -e bash -c "npm start; exec bash" &

echo
echo "🎉 服务启动完成！"
echo
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端地址: http://localhost:3001"
echo
echo "💡 使用说明:"
echo "   1. 等待两个服务完全启动"
echo "   2. 在浏览器中打开 http://localhost:3000"
echo "   3. 生成思维导图后即可使用导出功能"
echo
echo "按任意键退出..."
read -n 1
