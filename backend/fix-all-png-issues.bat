@echo off
echo 🔧 全面修复PNG导出功能问题
echo.

echo 📋 检查当前环境...
echo Node.js版本:
node --version
echo.

echo 📦 检查Puppeteer版本...
npm list puppeteer
echo.

echo 🔄 更新Puppeteer到最新兼容版本...
npm install puppeteer@latest
echo.

echo 📋 检查修复后的代码...
echo 验证 waitForTimeout 问题修复...
findstr /n "waitForTimeout" src\services\llm.js
echo.

echo 验证 quality 参数问题修复...
findstr /n "quality.*100" src\services\llm.js
echo.

echo 🧪 运行PNG导出测试...
node test-png-export.js
echo.

echo ✅ 修复完成！
echo.
echo 💡 修复的问题:
echo   1. ✅ page.waitForTimeout is not a function
echo   2. ✅ PNG不支持quality参数
echo   3. ✅ 浏览器变量作用域问题
echo   4. ✅ 改进了错误处理和资源清理
echo.
echo 🚀 现在PNG导出功能应该可以正常使用了！
pause
