const fs = require('fs');
const path = require('path');

// 配置文件路径
const configPath = path.join(__dirname, 'chromium-config.json');

function createConfig() {
  console.log('🔧 Chromium配置工具\n');
  
  // 检查当前配置
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('📋 当前配置:');
      console.log(`   Chromium路径: ${config.executablePath || '未设置'}`);
    } catch (error) {
      console.log('⚠️ 配置文件损坏，将重新创建');
    }
  }
  
  // 常见的Chromium路径
  const commonPaths = [
    '/snap/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  
  console.log('\n🔍 检查常见Chromium路径:');
  const availablePaths = [];
  
  for (const chromiumPath of commonPaths) {
    const exists = fs.existsSync(chromiumPath);
    console.log(`  ${exists ? '✅' : '❌'} ${chromiumPath}`);
    if (exists) {
      availablePaths.push(chromiumPath);
    }
  }
  
  if (availablePaths.length === 0) {
    console.log('\n❌ 未找到任何Chromium安装');
    console.log('💡 请先安装Chromium:');
    console.log('   sudo snap install chromium');
    console.log('   或');
    console.log('   sudo apt install chromium-browser');
    return;
  }
  
  // 自动选择第一个可用的路径
  const selectedPath = availablePaths[0];
  console.log(`\n🚀 自动选择: ${selectedPath}`);
  
  // 保存配置
  config.executablePath = selectedPath;
  config.lastUpdated = new Date().toISOString();
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ 配置已保存到 chromium-config.json');
  
  console.log('\n📝 配置内容:');
  console.log(JSON.stringify(config, null, 2));
}

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.log('⚠️ 配置文件读取失败:', error.message);
    return null;
  }
}

// 导出函数供其他模块使用
module.exports = {
  createConfig,
  loadConfig,
  configPath
};

// 如果直接运行此脚本
if (require.main === module) {
  createConfig();
}
