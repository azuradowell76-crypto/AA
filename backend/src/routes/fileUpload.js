const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FileProcessor = require('../services/fileProcessor');

const router = express.Router();
const fileProcessor = new FileProcessor();

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  },
  fileFilter: function (req, file, cb) {
    // 检查文件类型
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/json',
      'text/javascript',
      'text/html',
      'text/css',
      'text/xml',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp'
    ];

    const allowedExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.json', '.js', '.html', '.css', '.xml',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'
    ];

    const fileExt = path.extname(file.originalname).toLowerCase();
    const isValidType = allowedTypes.includes(file.mimetype) || 
                       allowedExtensions.includes(fileExt);

    if (isValidType) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

// 文件上传处理路由
router.post('/process-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    console.log('📁 收到文件上传:', req.file.originalname);
    console.log('📊 文件信息:', {
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // 处理文件
    const result = await fileProcessor.processFile(
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    console.log('✅ 文件处理成功:', {
      contentLength: result.content.length,
      summary: result.summary
    });

    res.json({
      success: true,
      data: {
        content: result.content,
        summary: result.summary,
        originalName: req.file.originalname,
        fileSize: req.file.size
      }
    });

  } catch (error) {
    console.error('❌ 文件处理失败:', error);
    
    // 清理临时文件
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || '文件处理失败'
    });
  }
});

// 获取支持的文件类型
router.get('/supported-types', (req, res) => {
  res.json({
    success: true,
    data: {
      types: [
        { name: 'PDF文档', extensions: ['.pdf'], mimeTypes: ['application/pdf'] },
        { name: 'Word文档', extensions: ['.doc', '.docx'], mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
        { name: 'Excel表格', extensions: ['.xls', '.xlsx'], mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
        { name: 'PowerPoint演示', extensions: ['.ppt', '.pptx'], mimeTypes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'] },
        { name: '图片文件', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'], mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'] },
        { name: '文本文件', extensions: ['.txt', '.csv', '.json', '.js', '.html', '.css', '.xml'], mimeTypes: ['text/plain', 'text/csv', 'application/json', 'text/javascript', 'text/html', 'text/css', 'text/xml'] }
      ],
      maxFileSize: '50MB'
    }
  });
});

module.exports = router;

