require('dotenv').config();
// 验证环境变量是否加载成功
console.log('DeepSeek API Key loaded:', process.env.DEEPSEEK_API_KEY ? '✅' : '❌');

const express = require('express');
const cors = require('cors');
const mindmapRoutes = require('./routes/mindmap');
const fileUploadRoutes = require('./routes/fileUpload');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 路由
app.use('/api/mindmap', mindmapRoutes);
app.use('/api/mindmap', fileUploadRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    message: 'Mindmap AI Backend Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      mindmap: '/api/mindmap'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧠 Mindmap API: http://localhost:${PORT}/api/mindmap`);
});

module.exports = app;