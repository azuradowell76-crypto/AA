@echo off
echo 🚀 启动思维导图AI应用（含导出功能）
echo.

echo 📋 检查依赖...
cd backend
if not exist "node_modules\puppeteer" (
    echo ❌ 缺少puppeteer依赖，正在安装...
    npm install puppeteer
    if errorlevel 1 (
        echo ❌ 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ 依赖检查通过
)

echo.
echo 🔧 启动后端服务...
start "后端服务" cmd /k "npm start"

echo.
echo ⏳ 等待后端服务启动...
timeout /t 5 /nobreak >nul

echo.
echo 🌐 启动前端服务...
cd ..\frontend
start "前端服务" cmd /k "npm start"

echo.
echo 🎉 服务启动完成！
echo.
echo 📱 前端地址: http://localhost:3000
echo 🔧 后端地址: http://localhost:3001
echo.
echo 💡 使用说明:
echo    1. 等待两个服务完全启动
echo    2. 在浏览器中打开 http://localhost:3000
echo    3. 生成思维导图后即可使用导出功能
echo.
pause
