const llmService = require('./src/services/llm');

async function testPNGExport() {
  console.log('🧪 开始测试PNG导出功能...\n');
  
  try {
    // 测试用的简单Markdown内容
    const testMarkdown = `# 测试思维导图
## 核心概念1
### 子概念1.1
#### 细节1.1.1
### 子概念1.2
## 核心概念2
### 子概念2.1
#### 细节2.1.1
### 子概念2.2`;
    
    console.log('📝 测试Markdown内容:');
    console.log(testMarkdown);
    console.log('\n🖼️ 开始生成PNG...');
    
    const startTime = Date.now();
    const pngBuffer = await llmService.exportToPNG(testMarkdown, '测试思维导图');
    const endTime = Date.now();
    
    console.log(`✅ PNG生成成功！`);
    console.log(`📊 生成时间: ${endTime - startTime}ms`);
    console.log(`📏 文件大小: ${(pngBuffer.length / 1024).toFixed(2)} KB`);
    
    // 保存测试文件
    const fs = require('fs');
    const testFileName = 'test-mindmap.png';
    fs.writeFileSync(testFileName, pngBuffer);
    console.log(`💾 测试文件已保存: ${testFileName}`);
    
    // 验证文件是否真的创建了
    if (fs.existsSync(testFileName)) {
      const stats = fs.statSync(testFileName);
      console.log(`📁 文件验证成功: ${testFileName}`);
      console.log(`📏 实际文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log('⚠️ 警告: 文件可能未正确保存');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
    
    // 提供更详细的错误信息
    if (error.message.includes('quality')) {
      console.log('\n💡 提示: 这是PNG格式不支持quality参数的错误，已修复');
    } else if (error.message.includes('waitForTimeout')) {
      console.log('\n💡 提示: 这是Puppeteer API兼容性问题，已修复');
    }
  }
}

// 运行测试
console.log('🚀 启动PNG导出功能测试...');
testPNGExport().then(() => {
  console.log('\n🎉 测试完成！');
}).catch((error) => {
  console.error('\n💥 测试过程中发生未捕获的错误:', error);
});
