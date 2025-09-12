const axios = require('axios');
const puppeteer = require('puppeteer');

class LLMService {
  constructor() {
    this.providers = {
      // ollama: {
      //   baseUrl: 'http://localhost:11434',
      //   models: ['llama3:latest', 'qwen2:latest', 'gemma2:latest']
      // },
      deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY,
        models: ['deepseek-chat', 'deepseek-coder']
      }
    };
  }

  // 获取可用的提供商列表
  async getAvailableProviders() {
    const result = [];
    
    // 检查 Ollama
    // try {
    //   const ollamaHealthy = await this.isHealthy('ollama');
    //   if (ollamaHealthy) {
    //     const availableModels = await this.getOllamaModels();
    //     result.push({
    //       name: 'ollama',
    //       models: availableModels.length > 0 ? availableModels : this.providers.ollama.models
    //     });
    //   }
    // } catch (error) {
    //   console.log('Ollama 不可用:', error.message);
    // }

    // 检查 DeepSeek
    if (this.providers.deepseek.apiKey) {
      result.push({
        name: 'deepseek',
        models: this.providers.deepseek.models
      });
    } else {
      console.log('DeepSeek API Key 未配置');
    }

    // 如果没有可用的提供商，返回默认配置
    if (result.length === 0) {
      // result.push({
      //   name: 'ollama',
      //   models: this.providers.ollama.models
      // });
      console.log('没有可用的AI提供商');
    }

    return result;
  }

  // 获取 Ollama 实际可用的模型
  // async getOllamaModels() {
  //   try {
  //     const response = await axios.get(`${this.providers.ollama.baseUrl}/api/tags`);
  //     return response.data.models?.map(model => model.name) || [];
  //   } catch (error) {
  //     return [];
  //   }
  // }

  // 生成思维导图结构
  async generateMindmapStructure(text, provider = 'deepseek', model = 'deepseek-chat') {
    const prompt = this.buildMindmapPrompt(text);

    switch (provider) {
      // case 'ollama':
      //   return await this.generateWithOllama(prompt, model);
      case 'deepseek':
        return await this.generateWithDeepSeek(prompt, model);
      default:
        throw new Error(`不支持的提供商: ${provider}`);
    }
  }

  // 生成AI问答回复
  async generateAIResponse(question, nodeText, nodeLevel, provider = 'deepseek', model = 'deepseek-chat', conversationHistory = []) {
    const prompt = this.buildChatPrompt(question, nodeText, nodeLevel, conversationHistory);

    switch (provider) {
      // case 'ollama':
      //   return await this.generateWithOllama(prompt, model);
      case 'deepseek':
        return await this.generateWithDeepSeek(prompt, model, true);
      default:
        throw new Error(`不支持的提供商: ${provider}`);
    }
  }

  // 将AI回答整理为思维导图子节点 - 改进版本
  async organizeResponseToNodes(aiResponse, parentNodeText, parentNodeLevel, provider = 'deepseek', model = 'deepseek-chat') {
    const prompt = this.buildOrganizePrompt(aiResponse, parentNodeText, parentNodeLevel);

    switch (provider) {
      // case 'ollama':
      //   const result = await this.generateWithOllama(prompt, model);
      //   return this.parseOrganizedResponse(result);
      case 'deepseek':
        const result = await this.generateWithDeepSeek(prompt, model);
        return this.parseOrganizedNodes(result, parentNodeLevel);
      default:
        throw new Error(`不支持的提供商: ${provider}`);
    }
  }

  // 生成继续回答
  async generateContinuedAnswer(previousAnswer, nodeText, nodeLevel, provider = 'deepseek', model = 'deepseek-chat', conversationHistory = []) {
    const prompt = this.buildContinueAnswerPrompt(previousAnswer, nodeText, nodeLevel, conversationHistory);

    switch (provider) {
      case 'deepseek':
        const result = await this.generateWithDeepSeek(prompt, model);
        return result.trim();
      default:
        throw new Error(`不支持的提供商: ${provider}`);
    }
  }

  // 构建继续回答的 prompt
  buildContinueAnswerPrompt(previousAnswer, nodeText, nodeLevel, conversationHistory) {
    let contextInfo = '';
    
    // 添加对话历史上下文
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-3); // 只取最近3条对话
      contextInfo = '\n\n对话历史：\n';
      recentHistory.forEach(msg => {
        if (msg.type === 'user') {
          contextInfo += `用户：${msg.content}\n`;
        } else if (msg.type === 'ai') {
          contextInfo += `AI：${msg.content}\n`;
        }
      });
    }

    return `请继续完善以下关于"${nodeText}"的回答。

之前的回答：
${previousAnswer}

${contextInfo}

要求：
1. 首先判断之前的回答是否已经完整回答了用户的问题
2. 如果回答已经完整，请回复："[COMPLETE] 回答已经完整，无需继续补充。"
3. 如果回答不完整，请继续之前的回答，不要重复已经说过的内容
4. 补充更多细节、例子或相关信息
5. 确保回答的完整性和连贯性
6. 根据节点层级(${nodeLevel})调整回答的深度
7. 保持回答的实用性和价值

请直接输出继续的内容，不要添加"继续"、"补充"等前缀。`;
  }

  // 生成推荐问题
  async generateSuggestedQuestions(nodeText, nodeLevel, provider = 'deepseek', model = 'deepseek-chat') {
    const prompt = this.buildSuggestedQuestionsPrompt(nodeText, nodeLevel);

    switch (provider) {
      case 'deepseek':
        const result = await this.generateWithDeepSeek(prompt, model);
        return this.parseSuggestedQuestions(result);
      default:
        throw new Error(`不支持的提供商: ${provider}`);
    }
  }

  // 构建推荐问题的 prompt
  buildSuggestedQuestionsPrompt(nodeText, nodeLevel) {
    return `请根据以下思维导图节点信息，生成3个相关的推荐问题。

节点信息：
- 节点内容：${nodeText}
- 节点层级：${nodeLevel}

要求：
1. 问题应该与节点内容高度相关
2. 问题应该有助于深入理解该节点
3. 问题应该实用且有价值
4. 问题长度适中，表达清晰
5. 根据节点层级调整问题的深度和复杂度

请直接输出3个问题，每行一个问题，不要添加任何编号、前缀或解释。`;
  }

  // 解析推荐问题
  parseSuggestedQuestions(response) {
    if (!response || typeof response !== 'string') {
      return [];
    }

    // 按行分割，过滤空行
    const questions = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 3); // 最多取3个问题

    // 如果问题数量不足，添加默认问题
    if (questions.length < 3) {
      const defaultQuestions = [
        '这个概念的详细解释是什么？',
        '有哪些实际应用场景？',
        '需要注意哪些要点？'
      ];
      
      for (let i = questions.length; i < 3; i++) {
        questions.push(defaultQuestions[i - questions.length]);
      }
    }

    return questions;
  }

  // 构建思维导图的 prompt
  buildMindmapPrompt(text) {
    return `请将以下内容转换为清晰的思维导图结构，使用标准的Markdown格式。

要求：
1. 使用 # ## ### #### ##### ###### 表示层级关系（可根据内容复杂度灵活使用）
2. 每个标题独占一行
3. 提取核心概念和关键信息
4. 确保层级关系逻辑清晰
5. 避免重复内容
6. 只输出Markdown格式的结构，不要任何解释

示例格式：
# 主题
## 核心概念1
### 子概念1.1
#### 细节1.1.1
### 子概念1.2
## 核心概念2
### 子概念2.1

现在请处理以下内容：
${text}

请输出思维导图结构：`;
  }

  // 构建AI问答的 prompt
  buildChatPrompt(question, nodeText, nodeLevel, conversationHistory = []) {
    let systemContext = `你是一个专业的AI助手，正在为用户解答关于"${nodeText}"的问题。`;
    
    // 根据节点层级提供不同的上下文
    if (nodeLevel === 1) {
      systemContext += `这是一个顶级主题，请提供全面且深入的回答，包括核心原理、主要应用和发展趋势。`;
    } else if (nodeLevel === 2) {
      systemContext += `这是一个重要的分类概念，请详细解释其含义、特点和相关应用。`;
    } else if (nodeLevel === 3) {
      systemContext += `这是一个具体的子概念，请提供精确的说明和实际应用案例。`;
    } else if (nodeLevel >= 4) {
      systemContext += `这是一个详细的知识点，请提供准确、具体和实用的信息，可以包含技术细节。`;
    }

    // 构建完整的对话prompt
    let fullPrompt = `${systemContext}

用户的问题是："${question}"

请以专业、友好的方式回答，确保信息准确、有用且易于理解。回答应该：
1. 直接针对用户的问题
2. 提供具体的信息和例子
3. 如果相关，可以包含实际应用场景
4. 保持简洁但内容丰富

`;

    // 如果有对话历史，添加上下文
    if (conversationHistory.length > 0) {
      fullPrompt += `\n对话历史（供参考）：\n`;
      conversationHistory.slice(-3).forEach((msg, index) => {
        fullPrompt += `${msg.type === 'user' ? '用户' : 'AI'}：${msg.content}\n`;
      });
      fullPrompt += `\n请基于以上对话历史回答新问题：\n`;
    }

    return fullPrompt;
  }

  // 改进的节点整理 prompt - 支持更详细的内容
  buildOrganizePrompt(aiResponse, parentNodeText, parentNodeLevel) {
    const childLevel = parentNodeLevel + 1;
    const levelSymbol = '#'.repeat(childLevel);

    return `请将以下AI回答内容整理成思维导图的子节点形式。这些子节点需要尽可能完整地保留原回答的核心信息。

父节点："${parentNodeText}" (层级: ${parentNodeLevel})
子节点层级应该是: ${childLevel} (使用 ${levelSymbol} 表示)

AI回答内容：
${aiResponse}

整理要求：
1. 仔细分析AI回答，提取出主要的信息点和逻辑结构
2. 将内容组织成4-8个子节点（根据内容复杂度调整）
3. 每个子节点应该包含完整的表述，可以适当长一些（20-40字以内）
4. 保留重要的细节信息，不要过度简化
5. 使用 ${levelSymbol} 作为子节点的标记
6. 保持逻辑顺序和层次清晰
7. 如果有数字编号的要点，请保留这些结构
8. 只输出节点列表，不要其他解释文字

输出格式示例：
${levelSymbol} 会议核心目标：探索机器模拟人类学习和智能行为
${levelSymbol} 首次提出"人工智能"概念并确立独立学科地位
${levelSymbol} 主要讨论方向：自然语言处理、神经网络、计算理论
${levelSymbol} 应用场景设想：机器翻译、棋类游戏、问题求解器
${levelSymbol} 研究方法争议：符号主义与连接主义的分歧
${levelSymbol} 历史意义：奠定AI研究基础，启发后续数十年发展

请开始整理：`;
  }

  // 改进的节点解析 - 支持更长的节点文本
  parseOrganizedNodes(organizedResult, parentLevel) {
    const lines = organizedResult.split('\n').filter(line => line.trim());
    const nodes = [];
    const childLevel = parentLevel + 1;
    const expectedPrefix = '#'.repeat(childLevel);

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(expectedPrefix + ' ')) {
        const nodeText = trimmedLine.replace(expectedPrefix + ' ', '').trim();
        if (nodeText && nodeText.length > 0) {
          nodes.push({
            level: childLevel,
            text: nodeText,
            markdown: trimmedLine
          });
        }
      }
    });

    // 如果没有解析到有效节点，尝试手动创建基于内容的节点
    if (nodes.length === 0) {
      console.log('警告：AI输出格式不标准，尝试手动解析...');
      
      // 尝试按行分割，寻找可能的要点
      const contentLines = organizedResult.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('以下是') && 
               !trimmed.startsWith('请开始') &&
               !trimmed.startsWith('输出格式');
      });

      // 如果找到内容行，创建节点
      if (contentLines.length > 0) {
        contentLines.slice(0, 6).forEach((line, index) => { // 最多取6行
          const cleanLine = line.replace(/^[\d\.\-\*\s]+/, '').trim(); // 去掉可能的编号或符号
          if (cleanLine.length > 0) {
            nodes.push({
              level: childLevel,
              text: cleanLine,
              markdown: `${expectedPrefix} ${cleanLine}`
            });
          }
        });
      }

      // 如果还是没有节点，创建一个默认节点
      if (nodes.length === 0) {
        nodes.push({
          level: childLevel,
          text: 'AI回答要点（详见完整对话记录）',
          markdown: `${expectedPrefix} AI回答要点（详见完整对话记录）`
        });
      }
    }

    console.log(`📋 成功解析 ${nodes.length} 个子节点 (层级: ${childLevel})`);
    nodes.forEach((node, index) => {
      console.log(`   ${index + 1}. [${node.level}级] ${node.text.substring(0, 50)}${node.text.length > 50 ? '...' : ''}`);
    });
    
    return nodes;
  }

  // 使用 Ollama 生成
  // async generateWithOllama(prompt, model) {
  //   try {
  //     console.log(`🤖 正在调用Ollama模型: ${model}`);
  //     const response = await axios.post(`${this.providers.ollama.baseUrl}/api/generate`, {
  //       model: model,
  //       prompt: prompt,
  //       stream: false,
  //       options: {
  //         temperature: 0.3,
  //         top_p: 0.8,
  //         num_predict: 1500  // 增加输出长度限制
  //       }
  //     });

  //     console.log('✅ Ollama响应成功');
  //     return this.cleanMarkdownOutput(response.data.response);
  //   } catch (error) {
  //     console.error('❌ Ollama API Error:', error.message);
  //     throw new Error(`Ollama生成失败: ${error.message}`);
  //   }
  // }

  // 使用 DeepSeek 生成 - 支持对话模式
  async generateWithDeepSeek(prompt, model, isChat = false) {
    try {
      if (!this.providers.deepseek.apiKey) {
        throw new Error('DeepSeek API Key 未配置');
      }

      console.log(`🤖 正在调用DeepSeek模型: ${model}`);

      // 创建 axios 实例
      const axiosInstance = axios.create({
        timeout: 60000,
        headers: {
          'Authorization': `Bearer ${this.providers.deepseek.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MindMap-AI/1.0'
        }
      });

      const requestData = {
        model: model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: isChat ? 0.7 : 0.3,
        max_tokens: isChat ? 1000 : 2000, // 增加输出长度限制
        stream: false
      };

      console.log('发送请求到 DeepSeek API...');

      const response = await axiosInstance.post(`${this.providers.deepseek.baseUrl}/chat/completions`, requestData);

      console.log('✅ DeepSeek响应成功');

      if (!response.data.choices || response.data.choices.length === 0) {
        throw new Error('DeepSeek API 响应格式异常：缺少 choices 字段');
      }

      const content = response.data.choices[0].message.content;
      if (!content) {
        throw new Error('DeepSeek API 响应内容为空');
      }

      return isChat ? content.trim() : this.cleanMarkdownOutput(content);

    } catch (error) {
      console.error('❌ DeepSeek API Error详情:');
      console.error('错误类型:', error.constructor.name);
      console.error('错误消息:', error.message);
      
      if (error.response) {
        console.error('HTTP状态码:', error.response.status);
        
        if (error.response.status === 401) {
          throw new Error('DeepSeek API Key 无效，请检查配置');
        } else if (error.response.status === 429) {
          throw new Error('DeepSeek API 请求频率限制，请稍后重试');
        } else if (error.response.status >= 500) {
          throw new Error('DeepSeek 服务器错误，请稍后重试');
        }
      } else if (error.request) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('DeepSeek API 请求超时，请检查网络连接');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new Error('无法连接到 DeepSeek API，请检查网络连接');
        }
      }
      
      throw new Error(`DeepSeek生成失败: ${error.message}`);
    }
  }

  // 清理和优化输出
  cleanMarkdownOutput(output) {
    return output
      .replace(/```markdown/g, '')
      .replace(/```/g, '')
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .join('\n');
  }

  // 健康检查
  async isHealthy(provider = 'deepseek') {
    try {
      switch (provider) {
        // case 'ollama':
        //   const ollamaResponse = await axios.get(`${this.providers.ollama.baseUrl}/api/tags`, {
        //     timeout: 5000
        //   });
        //   return ollamaResponse.status === 200;
          
        case 'deepseek':
          return !!this.providers.deepseek.apiKey;
        
        default:
          return false;
      }
    } catch (error) {
      console.error(`${provider} 健康检查失败:`, error.message);
      return false;
    }
  }

  // 新增：导出思维导图为PNG
  async exportToPNG(markdown, title = '思维导图') {
    let browser = null;
    
    try {
      console.log('🖼️ 开始生成PNG图片...');
      
      // 启动浏览器 - 使用配置的Chromium路径
      const { loadConfig } = require('../../configure-chromium');
      const fs = require('fs');
      
      // 加载Chromium配置
      const config = loadConfig();
      let executablePath = null;
      
      if (config && config.executablePath) {
        // 检查配置的路径是否仍然存在
        if (fs.existsSync(config.executablePath)) {
          executablePath = config.executablePath;
          console.log(`🔍 使用配置的Chromium: ${executablePath}`);
        } else {
          console.log(`⚠️ 配置的Chromium路径不存在: ${config.executablePath}`);
        }
      }
      
      // 如果配置的路径不可用，自动检测
      if (!executablePath) {
        const chromiumPaths = [
          '/snap/bin/chromium',           // Snap安装的Chromium
          '/usr/bin/chromium-browser',    // Ubuntu/Debian
          '/usr/bin/chromium',            // 其他Linux发行版
          '/usr/bin/google-chrome',       // Google Chrome
          '/usr/bin/google-chrome-stable' // Google Chrome稳定版
        ];
        
        for (const chromiumPath of chromiumPaths) {
          if (fs.existsSync(chromiumPath)) {
            executablePath = chromiumPath;
            console.log(`🔍 自动检测到Chromium: ${chromiumPath}`);
            break;
          }
        }
      }
      
      const launchOptions = {
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
      };
      
      // 如果找到自定义Chromium路径，则使用它
      if (executablePath) {
        launchOptions.executablePath = executablePath;
        console.log(`🚀 启动Chromium: ${executablePath}`);
      } else {
        console.log('⚠️ 未找到自定义Chromium，使用Puppeteer默认浏览器');
      }
      
      browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      
      // 设置页面尺寸
      await page.setViewport({ width: 1200, height: 800 });
      
      // 将Markdown转换为HTML
      const htmlContent = this.convertMarkdownToHTML(markdown, title);
      
      // 设置HTML内容
      console.log('📄 设置HTML内容到页面...');
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // 等待内容渲染完成 - 使用新的方法替代 waitForTimeout
      console.log('⏳ 等待内容渲染完成...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 获取页面实际高度
      console.log('📏 计算页面实际高度...');
      const bodyHeight = await page.evaluate(() => {
        return document.body.scrollHeight;
      });
      
      console.log(`📐 页面高度: ${bodyHeight}px`);
      
      // 重新设置页面高度
      await page.setViewport({ width: 1200, height: Math.max(800, bodyHeight) });
      
      // 生成PNG - PNG格式不支持quality参数
      console.log('📸 开始生成PNG截图...');
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true
        // 移除 quality 参数，PNG格式不支持
      });
      
      await browser.close();
      browser = null;
      
      console.log('✅ PNG生成成功');
      return screenshot;
      
    } catch (error) {
      console.error('❌ PNG生成失败:', error);
      
      // 确保浏览器被关闭
      try {
        if (browser) {
          await browser.close();
          console.log('🔒 浏览器已关闭');
        }
      } catch (closeError) {
        console.error('⚠️ 关闭浏览器时出错:', closeError.message);
      }
      
      throw new Error(`PNG生成失败: ${error.message}`);
    }
  }

  // 将Markdown转换为HTML
  convertMarkdownToHTML(markdown, title) {
    const lines = markdown.split('\n').filter(line => line.trim());
    let html = '';
    
    lines.forEach(line => {
      const level = (line.match(/^#+/) || [''])[0].length;
      const text = line.replace(/^#+\s*/, '');
      
      if (level === 1) {
        html += `<h1 style="color: #2196f3; font-size: 28px; margin: 20px 0; padding: 15px; background: #e3f2fd; border-left: 6px solid #2196f3; border-radius: 8px;">${text}</h1>`;
      } else if (level === 2) {
        html += `<h2 style="color: #9c27b0; font-size: 24px; margin: 15px 0; padding: 12px; background: #f3e5f5; border-left: 5px solid #9c27b0; border-radius: 6px; margin-left: 20px;">${text}</h2>`;
      } else if (level === 3) {
        html += `<h3 style="color: #4caf50; font-size: 20px; margin: 12px 0; padding: 10px; background: #e8f5e8; border-left: 4px solid #4caf50; border-radius: 4px; margin-left: 40px;">${text}</h3>`;
      } else if (level === 4) {
        html += `<h4 style="color: #ff9800; font-size: 18px; margin: 10px 0; padding: 8px; background: #fff3e0; border-left: 3px solid #ff9800; border-radius: 3px; margin-left: 60px;">${text}</h4>`;
      } else if (level === 5) {
        html += `<h5 style="color: #e91e63; font-size: 16px; margin: 8px 0; padding: 6px; background: #fce4ec; border-left: 2px solid #e91e63; border-radius: 2px; margin-left: 80px;">${text}</h5>`;
      } else if (level >= 6) {
        html += `<h6 style="color: #673ab7; font-size: 14px; margin: 6px 0; padding: 4px; background: #f3e5f5; border-left: 2px solid #673ab7; border-radius: 2px; margin-left: 100px;">${text}</h6>`;
      }
    });
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
          }
          .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #667eea;
          }
          .title {
            font-size: 36px;
            color: #333;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .subtitle {
            color: #666;
            font-size: 18px;
            margin-top: 10px;
          }
          .content {
            line-height: 1.6;
          }
          h1, h2, h3, h4, h5, h6 {
            margin: 0;
            font-weight: 600;
            line-height: 1.3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">${title}</h1>
            <div class="subtitle">思维导图 - 由AI智能生成</div>
          </div>
          <div class="content">
            ${html}
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new LLMService();