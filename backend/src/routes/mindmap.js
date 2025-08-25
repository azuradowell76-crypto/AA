const express = require('express');
const router = express.Router();
const llmService = require('../services/llm');

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

// AI问答接口
router.post('/chat', async (req, res) => {
  try {
    const { 
      question, 
      nodeText, 
      nodeLevel, 
      provider = 'deepseek', 
      model = 'deepseek-chat',
      conversationHistory = [] 
    } = req.body;

    if (!question || !nodeText) {
      return res.status(400).json({ error: '请提供问题和节点信息' });
    }

    console.log(`💬 收到AI问答请求: "${question}" (节点: ${nodeText}, 层级: ${nodeLevel})`);

    // 检查指定提供商的服务状态
    const isHealthy = await llmService.isHealthy(provider);
    if (!isHealthy) {
      return res.status(503).json({ 
        error: `${provider} 服务不可用，请检查服务状态` 
      });
    }

    // 生成AI回答
    const aiResponse = await llmService.generateAIResponse(
      question, 
      nodeText, 
      nodeLevel, 
      provider, 
      model,
      conversationHistory
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