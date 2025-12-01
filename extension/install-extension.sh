#!/bin/bash

echo "========================================"
echo "思维导图AI助手 - 浏览器插件安装脚本"
echo "========================================"
echo

echo "正在检查Chrome浏览器..."
if [ ! -d "$HOME/.config/google-chrome" ] && [ ! -d "$HOME/.config/chromium" ]; then
    echo "错误：未找到Chrome或Chromium浏览器"
    echo "请先安装Chrome或Chromium浏览器"
    exit 1
fi

echo "Chrome浏览器检查通过！"
echo

echo "正在检查插件文件..."
if [ ! -f "manifest.json" ]; then
    echo "错误：未找到manifest.json文件"
    echo "请确保在extension目录下运行此脚本"
    exit 1
fi

if [ ! -f "popup.html" ]; then
    echo "错误：未找到popup.html文件"
    exit 1
fi

if [ ! -f "popup.js" ]; then
    echo "错误：未找到popup.js文件"
    exit 1
fi

echo "插件文件检查通过！"
echo

echo "正在检查后端服务..."
echo "请确保后端服务正在运行在 http://localhost:3001"
echo "如果没有运行，请先执行以下命令："
echo "  cd ../backend"
echo "  npm install"
echo "  npm start"
echo

read -p "后端服务是否已启动？(y/n): " continue
if [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
    echo "请先启动后端服务，然后重新运行此脚本"
    exit 1
fi

echo
echo "========================================"
echo "安装说明："
echo "========================================"
echo "1. 打开Chrome浏览器"
echo "2. 在地址栏输入：chrome://extensions/"
echo "3. 开启右上角的"开发者模式""
echo "4. 点击"加载已解压的扩展程序""
echo "5. 选择当前目录（extension文件夹）"
echo "6. 插件将出现在扩展列表中"
echo

echo "========================================"
echo "使用方法："
echo "========================================"
echo "- 点击浏览器工具栏中的插件图标 🧠"
echo "- 或使用快捷键 Ctrl+Shift+M"
echo "- 在任意网页选择文本，点击提示快速生成"
echo "- 支持文件上传和AI问答功能"
echo

echo "安装完成后，请刷新所有Chrome标签页以确保插件正常工作"
echo

read -p "按回车键继续..."

