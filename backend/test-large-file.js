const express = require('express');
const multer = require('multer');

// 测试大文件处理
const app = express();

// 设置大文件限制
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 配置multer
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// 测试路由
app.post('/test-large', upload.single('file'), (req, res) => {
  console.log('收到文件:', req.file ? req.file.originalname : '无文件');
  console.log('文件大小:', req.file ? (req.file.size / 1024 / 1024).toFixed(2) + 'MB' : '无文件');
  
  res.json({
    success: true,
    message: '大文件处理成功',
    fileSize: req.file ? req.file.size : 0
  });
});

app.post('/test-large-json', (req, res) => {
  console.log('收到JSON数据大小:', JSON.stringify(req.body).length);
  
  res.json({
    success: true,
    message: '大JSON处理成功',
    dataSize: JSON.stringify(req.body).length
  });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🧪 测试服务器运行在 http://localhost:${PORT}`);
  console.log('测试端点:');
  console.log('  POST /test-large - 测试大文件上传');
  console.log('  POST /test-large-json - 测试大JSON数据');
});


