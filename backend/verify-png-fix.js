const fs = require('fs');
const path = require('path');

console.log('🔍 验证PNG导出功能修复状态...\n');

// 检查关键文件是否存在
const filesToCheck = [
  'src/services/llm.js',
  'test-png-export.js',
  'fix-png-export.bat',
  'fix-all-png-issues.bat'
];

console.log('📁 检查必要文件:');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});

// 检查代码修复状态
console.log('\n🔧 检查代码修复状态:');
const llmServicePath = 'src/services/llm.js';

if (fs.existsSync(llmServicePath)) {
  const content = fs.readFileSync(llmServicePath, 'utf8');
  
  // 检查waitForTimeout问题
  const hasWaitForTimeout = content.includes('waitForTimeout');
  console.log(`   ${!hasWaitForTimeout ? '✅' : '❌'} waitForTimeout问题已修复`);
  
  // 检查quality参数问题
  const hasQualityParam = content.includes('quality: 100') || content.includes('quality:100');
  console.log(`   ${!hasQualityParam ? '✅' : '❌'} PNG quality参数问题已修复`);
  
  // 检查浏览器变量作用域
  const hasBrowserScope = content.includes('let browser = null;') || content.includes('var browser = null;');
  console.log(`   ${hasBrowserScope ? '✅' : '❌'} 浏览器变量作用域问题已修复`);
  
  // 检查Promise替代方案
  const hasPromiseTimeout = content.includes('new Promise(resolve => setTimeout(resolve, 1000))');
  console.log(`   ${hasPromiseTimeout ? '✅' : '❌'} Promise替代方案已实现`);
  
  // 检查错误处理
  const hasErrorHandling = content.includes('if (browser)') && content.includes('await browser.close()');
  console.log(`   ${hasErrorHandling ? '✅' : '❌'} 错误处理已改进`);
  
} else {
  console.log('   ❌ 无法找到LLM服务文件');
}

// 检查package.json中的puppeteer版本
console.log('\n📦 检查依赖版本:');
const packagePath = 'package.json';
if (fs.existsSync(packagePath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const puppeteerVersion = packageJson.dependencies?.puppeteer || '未找到';
    console.log(`   Puppeteer版本: ${puppeteerVersion}`);
    
    if (puppeteerVersion !== '未找到') {
      const version = puppeteerVersion.replace('^', '').replace('~', '');
      const majorVersion = parseInt(version.split('.')[0]);
      if (majorVersion >= 21) {
        console.log('   ⚠️  注意: 使用Puppeteer v21+，需要兼容性修复');
      } else {
        console.log('   ✅ Puppeteer版本兼容');
      }
    }
  } catch (error) {
    console.log('   ❌ 无法解析package.json');
  }
}

// 提供修复建议
console.log('\n💡 修复建议:');
console.log('   1. 如果发现问题，运行: fix-all-png-issues.bat');
console.log('   2. 测试功能: node test-png-export.js');
console.log('   3. 查看详细说明: PNG_EXPORT_FIX.md');

console.log('\n🎯 验证完成！');
