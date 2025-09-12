@echo off
echo 🔧 配置Puppeteer使用云服务器Chromium
echo.

echo 📋 运行Chromium配置工具...
node configure-chromium.js
echo.

echo 🧪 测试Chromium路径...
node test-chromium-path.js
echo.

echo ✅ 配置完成！
echo.
echo 💡 现在Puppeteer将使用云服务器中的Chromium
echo 📍 路径: /snap/bin/chromium
echo.
pause
