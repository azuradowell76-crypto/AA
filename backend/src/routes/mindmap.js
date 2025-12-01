const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const llmService = require('../services/llm');
const FileProcessor = require('../services/fileProcessor');

const fileProcessor = new FileProcessor();

// 配置multer用于文件上传（磁盘存储）
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
    cb(null, `chat-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  },
  fileFilter: function (req, file, cb) {
    // 允许所有文件类型（FileProcessor会处理支持的类型）
    cb(null, true);
  }
});

// 获取可用的提供商列表
router.get('/providers', async (req, res) => {
  try {
    const providers = await llmService.getAvailableProviders();
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({ 
      error: error.message || '获取提供商列表失败' 
    });
  }
});

// 生成思维导图
router.post('/generate', async (req, res) => {
  try {
    const { text, title, provider = 'deepseek', model = 'deepseek-chat' } = req.body;

    if (!text) {
      return res.status(400).json({ error: '请提供要分析的文本内容' });
    }

    console.log(`📝 收到思维导图生成请求: ${title || '无标题'}, 使用 ${provider}/${model}`);

    // 检查指定提供商的服务状态
    const isHealthy = await llmService.isHealthy(provider);
    if (!isHealthy) {
      return res.status(503).json({ 
        error: `${provider} 服务不可用，请检查服务状态` 
      });
    }

    // 生成思维导图结构
    const markdownStructure = await llmService.generateMindmapStructure(text, provider, model);

    console.log('🎯 思维导图生成成功');

    res.json({
      success: true,
      data: {
        title: title || '思维导图',
        markdown: markdownStructure,
        provider: provider,
        model: model,
        timestamp: new Date().toISOString(),
        inputLength: text.length
      }
    });

  } catch (error) {
    console.error('Generate mindmap error:', error);
    res.status(500).json({ 
      error: error.message || '生成思维导图时发生错误' 
    });
  }
});

// AI问答接口（支持文件上传）
router.post('/chat', upload.array('files'), async (req, res) => {
  try {
    // 从req.body或req.files中获取数据
    let question, nodeText, nodeLevel, provider, model, conversationHistory, pageContent;
    
    // 检查是否是FormData格式（有文件上传）
    if (req.files && req.files.length > 0) {
      // FormData格式：字段在req.body中，文件在req.files中
      question = req.body.question;
      nodeText = req.body.nodeText;
      nodeLevel = req.body.nodeLevel ? parseInt(req.body.nodeLevel) : 1;
      provider = req.body.provider || 'deepseek';
      model = req.body.model || 'deepseek-chat';
      pageContent = req.body.pageContent || '';
      
      // 解析conversationHistory（如果是字符串需要JSON.parse）
      try {
        conversationHistory = typeof req.body.conversationHistory === 'string' 
          ? JSON.parse(req.body.conversationHistory) 
          : req.body.conversationHistory || [];
      } catch (e) {
        conversationHistory = [];
      }
      
      console.log(`💬 收到AI问答请求（带文件）: "${question}" (节点: ${nodeText}, 层级: ${nodeLevel}, 文件数: ${req.files.length}, 网页内容长度: ${pageContent.length})`);
    } else {
      // JSON格式：所有数据在req.body中
      ({ 
        question, 
        nodeText, 
        nodeLevel, 
        provider = 'deepseek', 
        model = 'deepseek-chat',
        conversationHistory = [],
        pageContent = ''
      } = req.body);
      
      console.log(`💬 收到AI问答请求: "${question}" (节点: ${nodeText}, 层级: ${nodeLevel}, 网页内容长度: ${pageContent.length})`);
    }

    if (!question || !nodeText) {
      return res.status(400).json({ error: '请提供问题和节点信息' });
    }

    // 处理上传的文件
    let fileContents = [];
    if (req.files && req.files.length > 0) {
      console.log(`📁 处理 ${req.files.length} 个上传的文件...`);
      
      for (const file of req.files) {
        try {
          // multer已经将文件保存到磁盘，file.path是文件路径
          // 处理文件（processFile会自动清理临时文件）
          const result = await fileProcessor.processFile(
            file.path,
            file.originalname,
            file.mimetype
          );
          
          fileContents.push({
            filename: file.originalname,
            content: result.content,
            summary: result.summary,
            type: file.mimetype
          });
          
          console.log(`✅ 文件处理成功: ${file.originalname}`);
        } catch (fileError) {
          console.error(`❌ 处理文件失败 ${file.originalname}:`, fileError);
          
          // 清理临时文件（如果processFile失败，文件可能还在）
          try {
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (cleanupError) {
            console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
          }
          
          // 继续处理其他文件，不中断整个请求
        }
      }
    }

    // 检查指定提供商的服务状态
    const isHealthy = await llmService.isHealthy(provider);
    if (!isHealthy) {
      return res.status(503).json({ 
        error: `${provider} 服务不可用，请检查服务状态` 
      });
    }

    // 生成AI回答（如果有文件，将文件内容包含在问题中）
    let enhancedQuestion = question;
    if (fileContents.length > 0) {
      const fileInfo = fileContents.map(f => {
        return `文件: ${f.filename}\n内容:\n${f.content.substring(0, 5000)}${f.content.length > 5000 ? '...' : ''}`;
      }).join('\n\n');
      enhancedQuestion = `${question}\n\n以下是用户上传的文件内容：\n\n${fileInfo}`;
    }

    // 生成AI回答（包含网页内容）
    const aiResponse = await llmService.generateAIResponse(
      enhancedQuestion, 
      nodeText, 
      nodeLevel, 
      provider, 
      model,
      conversationHistory,
      pageContent // 传递网页内容
    );

    console.log('✅ AI问答生成成功');

    res.json({
      success: true,
      data: {
        response: aiResponse,
        nodeText: nodeText,
        nodeLevel: nodeLevel,
        provider: provider,
        model: model,
        filesProcessed: fileContents.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ 
      error: error.message || 'AI问答时发生错误' 
    });
  }
});

// 新增：继续回答接口
router.post('/continue-answer', async (req, res) => {
  try {
    const { 
      previousAnswer, 
      nodeText, 
      nodeLevel, 
      provider = 'deepseek', 
      model = 'deepseek-chat',
      conversationHistory = [] 
    } = req.body;

    if (!previousAnswer || !nodeText) {
      return res.status(400).json({ error: '请提供之前的回答和节点信息' });
    }

    console.log(`🔄 收到继续回答请求: 节点 "${nodeText}" (层级: ${nodeLevel})`);

    // 检查指定提供商的服务状态
    const isHealthy = await llmService.isHealthy(provider);
    if (!isHealthy) {
      return res.status(503).json({ 
        error: `${provider} 服务不可用，请检查服务状态` 
      });
    }

    // 生成继续回答
    const continuedAnswer = await llmService.generateContinuedAnswer(
      previousAnswer, 
      nodeText, 
      nodeLevel, 
      provider, 
      model,
      conversationHistory
    );

    // 检查AI是否判断回答已经完整
    const isComplete = continuedAnswer.includes('[COMPLETE]');
    const cleanAnswer = isComplete ? continuedAnswer.replace('[COMPLETE]', '').trim() : continuedAnswer;

    console.log('✅ 继续回答生成成功', { isComplete });

    res.json({
      success: true,
      data: {
        response: cleanAnswer,
        isComplete: isComplete,
        nodeText: nodeText,
        nodeLevel: nodeLevel,
        provider: provider,
        model: model,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Continue answer error:', error);
    res.status(500).json({ 
      error: error.message || '继续回答时发生错误' 
    });
  }
});

// 新增：获取推荐问题
router.post('/suggest-questions', async (req, res) => {
  try {
    const { 
      nodeText, 
      nodeLevel, 
      provider = 'deepseek', 
      model = 'deepseek-chat' 
    } = req.body;

    if (!nodeText) {
      return res.status(400).json({ error: '请提供节点信息' });
    }

    console.log(`💡 收到推荐问题请求: 节点 "${nodeText}" (层级: ${nodeLevel})`);

    // 检查指定提供商的服务状态
    const isHealthy = await llmService.isHealthy(provider);
    if (!isHealthy) {
      return res.status(503).json({ 
        error: `${provider} 服务不可用，请检查服务状态` 
      });
    }

    // 生成推荐问题
    const questions = await llmService.generateSuggestedQuestions(
      nodeText, 
      nodeLevel, 
      provider, 
      model
    );

    console.log('✅ 推荐问题生成成功');

    res.json({
      success: true,
      data: {
        questions: questions,
        nodeText: nodeText,
        nodeLevel: nodeLevel,
        provider: provider,
        model: model,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Generate suggested questions error:', error);
    res.status(500).json({ 
      error: error.message || '生成推荐问题时发生错误' 
    });
  }
});

// 新增：将AI回答整理为子节点
router.post('/organize-response', async (req, res) => {
  try {
    const { 
      aiResponse, 
      parentNodeText, 
      parentNodeLevel,
      provider = 'deepseek', 
      model = 'deepseek-chat' 
    } = req.body;

    if (!aiResponse || !parentNodeText || !parentNodeLevel) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const nodes = await llmService.organizeResponseToNodes(
      aiResponse, 
      parentNodeText, 
      parentNodeLevel, 
      provider, 
      model
    );

    res.json({
      success: true,
      data: { nodes }
    });

  } catch (error) {
    console.error('整理AI回答失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 新增：添加到子节点 - 完整实现
router.post('/add-child-nodes', async (req, res) => {
  try {
    const { 
      parentNode, 
      parentLevel, 
      aiResponse, 
      currentMarkdown,
      provider = 'deepseek', 
      model = 'deepseek-chat' 
    } = req.body;

    if (!parentNode || parentLevel === undefined || !aiResponse || !currentMarkdown) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：parentNode, parentLevel, aiResponse, currentMarkdown'
      });
    }

    console.log(`📝 收到添加到子节点请求: 父节点 "${parentNode}" (层级: ${parentLevel})`);

    // 检查指定提供商的服务状态
    const isHealthy = await llmService.isHealthy(provider);
    if (!isHealthy) {
      return res.status(503).json({ 
        success: false,
        error: `${provider} 服务不可用，请检查服务状态` 
      });
    }

    // 使用LLM服务整理AI回答为子节点
    const childNodes = await llmService.organizeResponseToNodes(
      aiResponse, 
      parentNode, 
      parentLevel, 
      provider, 
      model
    );

    if (!childNodes || childNodes.length === 0) {
      return res.status(500).json({
        success: false,
        error: '未能从AI回答中提取出有效的子节点'
      });
    }

    // 将子节点插入到当前markdown中
    const updatedMarkdown = llmService.insertChildNodesToMarkdown(
      currentMarkdown,
      parentNode,
      parentLevel,
      childNodes
    );

    console.log(`✅ 成功添加 ${childNodes.length} 个子节点`);

    res.json({
      success: true,
      data: {
        markdown: updatedMarkdown,
        addedNodes: childNodes.length,
        nodes: childNodes
      }
    });

  } catch (error) {
    console.error('添加到子节点失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '添加到子节点时发生错误'
    });
  }
});

// 新增：导出思维导图为PNG
router.post('/export-png', async (req, res) => {
  try {
    const { markdown, title = '思维导图' } = req.body;

    if (!markdown) {
      return res.status(400).json({
        success: false,
        error: '缺少思维导图内容'
      });
    }

    const pngBuffer = await llmService.exportToPNG(markdown, title);

    // 处理文件名，避免中文字符导致的HTTP头部错误
    let safeTitle = title;
    if (title && title.trim()) {
      // 移除或替换可能导致问题的字符
      safeTitle = title.replace(/[^\w\s-]/g, '').trim();
      if (!safeTitle) safeTitle = 'mindmap';
    } else {
      safeTitle = 'mindmap';
    }
    
    // 使用 encodeURIComponent 对文件名进行编码，确保HTTP头部有效
    const encodedFilename = encodeURIComponent(`${safeTitle}.png`);
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': pngBuffer.length
    });

    res.send(pngBuffer);

  } catch (error) {
    console.error('导出PNG失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 新增：导出思维导图为XMind
router.post('/export-xmind', async (req, res) => {
  try {
    const { markdown, title = '思维导图' } = req.body;

    if (!markdown) {
      return res.status(400).json({
        success: false,
        error: '缺少思维导图内容'
      });
    }

    const xmindBuffer = await llmService.exportToXMind(markdown, title);

    // 处理文件名，避免中文字符导致的HTTP头部错误
    let safeTitle = title;
    if (title && title.trim()) {
      // 移除或替换可能导致问题的字符
      safeTitle = title.replace(/[^\w\s-]/g, '').trim();
      if (!safeTitle) safeTitle = 'mindmap';
    } else {
      safeTitle = 'mindmap';
    }
    
    // 使用 encodeURIComponent 对文件名进行编码，确保HTTP头部有效
    const encodedFilename = encodeURIComponent(`${safeTitle}.xmind`);
    
    res.set({
      'Content-Type': 'application/vnd.xmind',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': xmindBuffer.length
    });

    res.send(xmindBuffer);

  } catch (error) {
    console.error('导出XMind失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 全局AI问答接口（用于整体修改思维导图）
router.post('/global-chat', upload.array('files'), async (req, res) => {
  try {
    let question, mode, currentMarkdown, pageTitle, pageUrl, provider, model;
    
    // 检查是否是FormData格式（有文件上传）
    if (req.files && req.files.length > 0) {
      question = req.body.question;
      mode = req.body.mode || 'integrate';
      currentMarkdown = req.body.currentMarkdown;
      pageTitle = req.body.pageTitle || '';
      pageUrl = req.body.pageUrl || '';
      provider = req.body.provider || 'deepseek';
      model = req.body.model || 'deepseek-chat';
      
      console.log(`🌐 收到全局AI问答请求（带文件）: "${question}" 模式: ${mode}, 文件数: ${req.files.length}`);
    } else {
      ({ 
        question, 
        mode = 'integrate',
        currentMarkdown,
        pageTitle = '',
        pageUrl = '',
        provider = 'deepseek', 
        model = 'deepseek-chat'
      } = req.body);
      
      console.log(`🌐 收到全局AI问答请求: "${question}" 模式: ${mode}`);
    }

    if (!question) {
      return res.status(400).json({ error: '请提供问题' });
    }

    if (!currentMarkdown) {
      return res.status(400).json({ error: '请提供当前思维导图内容' });
    }

    // 处理上传的文件
    let fileContents = [];
    if (req.files && req.files.length > 0) {
      console.log(`📁 处理 ${req.files.length} 个上传的文件...`);
      
      for (const file of req.files) {
        try {
          const result = await fileProcessor.processFile(
            file.path,
            file.originalname,
            file.mimetype
          );
          
          fileContents.push({
            filename: file.originalname,
            content: result.content,
            summary: result.summary,
            type: file.mimetype
          });
          
          console.log(`✅ 文件处理成功: ${file.originalname}`);
        } catch (fileError) {
          console.error(`❌ 处理文件失败 ${file.originalname}:`, fileError);
          try {
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (cleanupError) {
            console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
          }
        }
      }
    }

    // 检查指定提供商的服务状态
    const isHealthy = await llmService.isHealthy(provider);
    if (!isHealthy) {
      return res.status(503).json({ 
        error: `${provider} 服务不可用，请检查服务状态` 
      });
    }

    // 构建增强的问题（包含文件内容）
    let enhancedQuestion = question;
    if (fileContents.length > 0) {
      const fileInfo = fileContents.map(f => {
        return `文件: ${f.filename}\n内容:\n${f.content.substring(0, 5000)}${f.content.length > 5000 ? '...' : ''}`;
      }).join('\n\n');
      enhancedQuestion = `${question}\n\n以下是用户上传的文件内容：\n\n${fileInfo}`;
    }

    // 根据模式生成不同的响应
    if (mode === 'integrate') {
      // 整合模式：修改思维导图
      const result = await llmService.modifyMindmapWithAI(
        currentMarkdown,
        enhancedQuestion,
        pageTitle,
        provider,
        model
      );

      console.log('✅ 全局AI问答成功（整合模式）');

      res.json({
        success: true,
        data: {
          changes: result.changes || [],
          newMarkdown: result.newMarkdown,
          summary: result.summary || '已根据您的要求修改思维导图',
          filesProcessed: fileContents.length
        }
      });
    } else {
      // 问答模式：仅回答问题
      const answer = await llmService.answerAboutMindmap(
        currentMarkdown,
        enhancedQuestion,
        pageTitle,
        provider,
        model
      );

      console.log('✅ 全局AI问答成功（问答模式）');

      res.json({
        success: true,
        data: {
          answer: answer,
          filesProcessed: fileContents.length
        }
      });
    }

  } catch (error) {
    console.error('全局AI问答失败:', error);
    res.status(500).json({ 
      error: error.message || '全局AI问答时发生错误' 
    });
  }
});

// 健康检查
router.get('/health', async (req, res) => {
  try {
    const { provider = 'deepseek' } = req.query;
    const isHealthy = await llmService.isHealthy(provider);
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      provider: provider,
      healthy: isHealthy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;