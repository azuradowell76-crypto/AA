const fs = require('fs');
const path = require('path');
const FileProcessor = require('./src/services/fileProcessor');

async function testFileProcessing() {
  console.log('🧪 测试文件处理功能\n');
  
  const fileProcessor = new FileProcessor();
  
  // 测试文件类型检测
  console.log('📋 测试文件类型检测:');
  const testFiles = [
    { name: 'test.pdf', mime: 'application/pdf' },
    { name: 'document.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: 'spreadsheet.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { name: 'presentation.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { name: 'image.png', mime: 'image/png' },
    { name: 'script.js', mime: 'text/javascript' }
  ];
  
  testFiles.forEach(file => {
    const type = fileProcessor.detectFileType(file.name, file.mime);
    console.log(`  ${file.name} (${file.mime}) -> ${type}`);
  });
  
  console.log('\n✅ 文件类型检测测试完成');
  
  // 测试文本文件处理
  console.log('\n📄 测试文本文件处理:');
  try {
    const testContent = '这是一个测试文件\n包含多行内容\n用于验证文件处理功能';
    const testFilePath = path.join(__dirname, 'test-file.txt');
    
    // 创建测试文件
    fs.writeFileSync(testFilePath, testContent, 'utf8');
    
    const result = await fileProcessor.processText(testFilePath);
    console.log('✅ 文本文件处理成功:');
    console.log(`  内容长度: ${result.content.length} 字符`);
    console.log(`  标题: ${result.summary.title}`);
    console.log(`  大小: ${result.summary.size} 字符`);
    
  } catch (error) {
    console.log('❌ 文本文件处理失败:', error.message);
  }
  
  console.log('\n🎯 文件处理功能测试完成！');
  console.log('\n💡 要测试完整功能，请:');
  console.log('1. 运行: npm start');
  console.log('2. 在前端上传文件');
  console.log('3. 查看控制台日志');
}

testFileProcessing().catch(console.error);

