const fs = require('fs');
const puppeteer = require('puppeteer');

async function testChromiumPath() {
  console.log('🔍 测试Chromium路径...\n');
  
  // 可能的Chromium路径列表
  const chromiumPaths = [
    '/snap/bin/chromium',           // Snap安装的Chromium
    '/usr/bin/chromium-browser',    // Ubuntu/Debian
    '/usr/bin/chromium',            // 其他Linux发行版
    '/usr/bin/google-chrome',       // Google Chrome
    '/usr/bin/google-chrome-stable' // Google Chrome稳定版
  ];
  
  console.log('📋 检查Chromium路径:');
  for (const chromiumPath of chromiumPaths) {
    const exists = fs.existsSync(chromiumPath);
    console.log(`  ${exists ? '✅' : '❌'} ${chromiumPath}`);
  }
  
  // 查找可用的Chromium路径
  let executablePath = null;
  for (const chromiumPath of chromiumPaths) {
    if (fs.existsSync(chromiumPath)) {
      executablePath = chromiumPath;
      break;
    }
  }
  
  if (!executablePath) {
    console.log('\n❌ 未找到任何Chromium安装');
    console.log('💡 请安装Chromium:');
    console.log('   sudo snap install chromium');
    console.log('   或');
    console.log('   sudo apt install chromium-browser');
    return;
  }
  
  console.log(`\n🚀 测试使用Chromium: ${executablePath}`);
  
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    // 测试简单页面
    await page.setContent('<html><body><h1>Chromium测试成功！</h1></body></html>');
    
    // 生成测试截图
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });
    
    console.log('✅ Chromium测试成功！');
    console.log(`📸 截图大小: ${screenshot.length} bytes`);
    
  } catch (error) {
    console.log('❌ Chromium测试失败:');
    console.log(error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testChromiumPath().catch(console.error);
