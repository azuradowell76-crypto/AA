@echo off
echo 🔧 修复PNG导出功能兼容性问题
echo.

echo 📋 检查当前Puppeteer版本...
npm list puppeteer

echo.
echo 🔄 更新Puppeteer到兼容版本...
npm install puppeteer@latest

echo.
echo 🧪 运行PNG导出测试...
node test-png-export.js

echo.
echo ✅ 修复完成！
echo 💡 如果测试成功，PNG导出功能应该可以正常使用了
pause
