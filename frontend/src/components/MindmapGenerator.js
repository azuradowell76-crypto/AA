import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MindmapGenerator = () => {
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [providers, setProviders] = useState([
    {
      name: 'deepseek',
      models: ['deepseek-chat']
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mindmapResult, setMindmapResult] = useState('');
  
  // AI问答相关状态
  const [showAIModal, setShowAIModal] = useState(false);
  const [currentNode, setCurrentNode] = useState('');
  const [currentNodeLevel, setCurrentNodeLevel] = useState(1);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // 推荐问题相关状态
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  // 继续回答相关状态
  const [isContinuing, setIsContinuing] = useState(false);
  
  // 节点添加相关状态
  const [isOrganizing, setIsOrganizing] = useState(false);
  
  // PNG导出loading状态
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  
  // 文件上传相关状态
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');

  // 工具函数：处理文件名，确保下载文件名安全
  const getSafeFileName = (mindmapContent, extension) => {
    let safeTitle = '思维导图';
    
    if (mindmapContent && mindmapContent.trim()) {
      // 从思维导图内容中提取最高级节点（一级节点）的文本
      const lines = mindmapContent.split('\n');
      console.log('🔍 开始提取文件名，思维导图内容行数:', lines.length);
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        console.log('📝 检查行:', trimmedLine);
        
        // 查找一级节点（以单个#开头，不是##或更多#）
        if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('##')) {
          const nodeText = trimmedLine.replace(/^#\s*/, '').trim();
          console.log('✅ 找到一级节点:', nodeText);
          if (nodeText) {
            safeTitle = nodeText;
            break;
          }
        }
      }
      
      console.log('🎯 提取到的标题:', safeTitle);
    }
    
    // 清理文件名，保留中文字符、字母、数字、空格和连字符
    if (safeTitle && safeTitle.trim()) {
      const originalTitle = safeTitle;
      // 保留中文字符、字母、数字、空格和连字符，移除其他特殊字符
      safeTitle = safeTitle.replace(/[^\u4e00-\u9fa5\w\s-]/g, '').trim();
      if (!safeTitle) {
        safeTitle = 'mindmap';
        console.log('⚠️ 清理后标题为空，使用默认名称');
      } else {
        console.log('🧹 清理后的标题:', safeTitle, '(原标题:', originalTitle, ')');
      }
    } else {
      safeTitle = 'mindmap';
      console.log('⚠️ 标题为空，使用默认名称');
    }
    
    const finalFileName = `${safeTitle}.${extension}`;
    console.log('📁 最终文件名:', finalFileName);
    return finalFileName;
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  // 自动清除成功提示
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000); // 3秒后自动清除

      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchProviders = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/mindmap/providers');
      if (response.data.success) {
        setProviders(response.data.data);
      }
    } catch (error) {
      console.error('获取提供商列表失败:', error);
      // 设置默认提供商，确保UI始终显示
      setProviders([
        {
          name: 'deepseek',
          models: ['deepseek-chat']
        }
      ]);
    }
  };

  const handleProviderChange = (provider) => {
    setSelectedProvider(provider);
    const providerData = providers.find(p => p.name === provider);
    if (providerData && providerData.models.length > 0) {
      setSelectedModel(providerData.models[0]);
    }
  };

  // 文件处理函数
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // 清空之前的内容和状态
      setFileContent('');
      setInputText('');
      setTitle('');
      setError('');
      setSuccess('');
      setMindmapResult('');
      
      setSelectedFile(file);
      setFileName(file.name);
      
      // 检查文件类型
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      
      // 支持的文件类型
      const supportedTypes = [
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
      
      const supportedExtensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.csv', '.json', '.js', '.html', '.css', '.xml',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'
      ];
      
      const isSupported = supportedTypes.includes(fileType) || 
                         supportedExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isSupported) {
        setError('不支持的文件类型，请选择PDF、DOC、XLSX、PPT、图片、文本或代码文件');
        return;
      }
      
      setError('');
      console.log('📁 选择文件:', file.name, '类型:', fileType);
    }
  };

  const processFile = async () => {
    if (!selectedFile) {
      setError('请先选择文件');
      return;
    }

    setIsProcessingFile(true);
    setError('');
    setFileContent('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('🔄 开始处理文件:', selectedFile.name);
      
      const response = await axios.post('http://localhost:3001/api/mindmap/process-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const { content, summary } = response.data.data;
        setFileContent(content);
        
        // 如果文件有标题，自动设置
        if (summary && summary.title) {
          setTitle(summary.title);
        }
        
        setSuccess(`文件处理成功！提取了 ${content.length} 个字符的内容`);
        console.log('✅ 文件处理成功:', summary);
        
        // 自动生成思维导图
        await generateMindmapFromContent(content);
      } else {
        console.error('文件处理失败:', response.data);
        setError('文件处理失败: ' + (response.data.message || '未知错误'));
      }
    } catch (error) {
      console.error('文件处理错误:', error);
      setError('文件处理失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsProcessingFile(false);
    }
  };

  // 从文件内容生成思维导图
  const generateMindmapFromContent = async (content) => {
    if (!content.trim()) {
      setError('文件内容为空');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('http://localhost:3001/api/mindmap/generate', {
        text: content,
        title: title || '思维导图',
        provider: selectedProvider,
        model: selectedModel
      });

      if (response.data.success) {
        const { markdown, provider, model } = response.data.data;
        setMindmapResult(markdown);
        setSuccess(`思维导图生成成功！使用了 ${selectedProvider}/${selectedModel}`);
      } else {
        setError('生成思维导图失败');
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 
        '生成思维导图失败，请检查网络连接或稍后重试'
      );
    } finally {
      setLoading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFileName('');
    setFileContent('');
    setInputText('');
    setTitle('');
    setError('');
  };

  const generateMindmap = async () => {
    // 如果有选中的文件，先处理文件
    if (selectedFile && !fileContent) {
      await processFile();
      return;
    }

    // 检查是否有内容可以生成思维导图
    if (!inputText.trim() && !fileContent) {
      setError('请输入要分析的内容或选择文件');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 优先使用文件内容，如果没有文件内容则使用输入文本
      const contentToUse = fileContent || inputText.trim();
      const response = await axios.post('http://localhost:3001/api/mindmap/generate', {
        text: contentToUse,
        title: title || '思维导图',
        provider: selectedProvider,
        model: selectedModel
      });

      if (response.data.success) {
        const { markdown, provider, model } = response.data.data;
        setMindmapResult(markdown);
        setSuccess(`思维导图生成成功！使用了 ${selectedProvider}/${selectedModel}`);
      } else {
        console.error('生成思维导图失败:', response.data);
        setError(`生成思维导图失败: ${response.data.message || '未知错误'}`);
      }
    } catch (err) {
      console.error('生成思维导图错误:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        '无法连接到服务器，请确保后端服务正在运行'
      );
    } finally {
      setLoading(false);
    }
  };

  const clearMindmap = () => {
    setInputText('');
    setTitle('');
    setError('');
    setSuccess('');
    setMindmapResult('');
    setShowAIModal(false);
    setChatMessages([]);
    // 清空文件相关状态
    setSelectedFile(null);
    setFileName('');
    setFileContent('');
    setIsProcessingFile(false);
  };

  // 打开AI对话框
  const openAIChat = async (nodeText, nodeLevel) => {
    setCurrentNode(nodeText);
    setCurrentNodeLevel(nodeLevel);
    setChatMessages([
      {
        type: 'ai',
        content: `您好！我是AI助手，很高兴为您解答关于"${nodeText}"的问题。您可以直接输入问题，或者选择下方的推荐问题。`
      }
    ]);
    setChatInput('');
    setShowAIModal(true);
    
    // 自动获取推荐问题
    await getSuggestedQuestions(nodeLevel, nodeText);
  };

  // 关闭AI对话框
  const closeAIChat = () => {
    setShowAIModal(false);
    setChatMessages([]);
    setChatInput('');
    setIsOrganizing(false);
    setSuggestedQuestions([]);
    setIsLoadingSuggestions(false);
    setIsContinuing(false);
  };

  // 获取推荐问题 - 通过AI API动态生成
  const getSuggestedQuestions = async (level, nodeText) => {
    if (!nodeText || !nodeText.trim()) {
      return [];
    }

    setIsLoadingSuggestions(true);
    
    try {
      const response = await axios.post('http://localhost:3001/api/mindmap/suggest-questions', {
        nodeText: nodeText,
        nodeLevel: level,
        provider: selectedProvider,
        model: selectedModel
      });

      if (response.data.success) {
        const questions = response.data.data.questions || [];
        setSuggestedQuestions(questions);
        return questions;
      } else {
        throw new Error(response.data.error || '获取推荐问题失败');
      }
    } catch (error) {
      console.error('获取推荐问题失败:', error);
      // 如果API调用失败，返回默认问题
      const defaultQuestions = [
        `"${nodeText}"的核心概念是什么？`,
        `"${nodeText}"的主要应用有哪些？`,
        `"${nodeText}"的详细解释是什么？`
      ];
      setSuggestedQuestions(defaultQuestions);
      return defaultQuestions;
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // 继续回答功能
  const continueAnswer = async (lastMessageIndex) => {
    if (isContinuing || isTyping) return;

    setIsContinuing(true);

    try {
      // 获取最后一条AI回答
      const lastAIMessage = chatMessages[lastMessageIndex];
      if (!lastAIMessage || lastAIMessage.type !== 'ai') {
        throw new Error('未找到AI回答');
      }

      // 调用后端API继续回答
      const response = await axios.post('http://localhost:3001/api/mindmap/continue-answer', {
        previousAnswer: lastAIMessage.content,
        nodeText: currentNode,
        nodeLevel: currentNodeLevel,
        provider: selectedProvider,
        model: selectedModel,
        conversationHistory: chatMessages
      });

      if (response.data.success) {
        const { response: continuedAnswer, isComplete } = response.data.data;
        
        // 更新最后一条AI消息
        const updatedMessages = [...chatMessages];
        updatedMessages[lastMessageIndex] = {
          ...lastAIMessage,
          content: lastAIMessage.content + '\n\n' + continuedAnswer,
          showContinueButton: true,
          isComplete: isComplete
        };
        
        setChatMessages(updatedMessages);
        
        // 如果AI判断回答完整，显示提示
        if (isComplete) {
          setSuccess('AI判断回答已经完整，无需继续补充。');
        }
      } else {
        throw new Error(response.data.error || '继续回答失败');
      }
    } catch (error) {
      console.error('继续回答失败:', error);
      const errorMessage = error.response?.data?.error || '继续回答时发生错误，请重试。';
      setChatMessages(prev => [...prev, { 
        type: 'system', 
        content: `❌ ${errorMessage}` 
      }]);
    } finally {
      setIsContinuing(false);
    }
  };

  // 检查AI回答是否可能不完整
  const isAnswerIncomplete = (content) => {
    if (!content || typeof content !== 'string') return false;
    
    const trimmedContent = content.trim();
    
    // 调试信息
    console.log('🔍 检测AI回答完整性:', {
      content: trimmedContent.substring(0, 100) + '...',
      length: trimmedContent.length,
      lastChar: trimmedContent.slice(-5)
    });
    
    // 如果回答很短，可能不完整
    if (trimmedContent.length < 120) {
      console.log('✅ 检测结果: 回答太短，需要继续');
      return true;
    }
    
    // 检查不完整回答的模式 - 更精确的检测
    const incompletePatterns = [
      // 明确的未完成词汇
      /等等$/,  // 以"等等"结尾
      /\.\.\.$/,  // 以省略号结尾
      /更多$/,  // 以"更多"结尾
      /还有$/,  // 以"还有"结尾
      /另外$/,  // 以"另外"结尾
      /此外$/,  // 以"此外"结尾
      /同时$/,  // 以"同时"结尾
      /而且$/,  // 以"而且"结尾
      /并且$/,  // 以"并且"结尾
      /以及$/,  // 以"以及"结尾
      /包括$/,  // 以"包括"结尾
      /例如$/,  // 以"例如"结尾
      /比如$/,  // 以"比如"结尾
      /具体$/,  // 以"具体"结尾
      /详细$/,  // 以"详细"结尾
      /深入$/,  // 以"深入"结尾
      /进一步$/,  // 以"进一步"结尾
      /继续$/,  // 以"继续"结尾
      /补充$/,  // 以"补充"结尾
      /扩展$/,  // 以"扩展"结尾
      /完善$/,  // 以"完善"结尾
      
      // 不完整的标点符号
      /，$/,  // 以逗号结尾（可能不完整）
      /，\s*$/,  // 以逗号加空格结尾
      /：$/,  // 以冒号结尾
      /：\s*$/,  // 以冒号加空格结尾
      
      // 不完整的句子结构
      /^.{0,50}$/,  // 回答太短（少于50字符）
      /^.{50,100}$/,  // 回答较短（50-100字符），可能不完整
    ];
    
    // 检查是否以不完整的句子结尾
    const isIncomplete = incompletePatterns.some(pattern => pattern.test(trimmedContent));
    
    // 额外检查：如果回答以问号结尾，通常表示完整
    if (trimmedContent.endsWith('？') || trimmedContent.endsWith('?')) {
      console.log('❌ 检测结果: 回答以问号结尾，通常是完整的');
      return false;
    }
    
    // 额外检查：如果回答以句号结尾且长度足够，通常表示完整
    if ((trimmedContent.endsWith('。') || trimmedContent.endsWith('.')) && trimmedContent.length > 150) {
      console.log('❌ 检测结果: 回答以句号结尾且长度足够，通常是完整的');
      return false;
    }
    
    if (isIncomplete) {
      console.log('✅ 检测结果: 回答不完整，需要继续');
    } else {
      console.log('❌ 检测结果: 回答完整，不需要继续');
    }
    
    return isIncomplete;
  };

  // 发送消息 - 调用真实API
  const sendMessage = async (message) => {
    if (!message.trim()) return;

    // 添加用户消息
    const newMessages = [...chatMessages, { type: 'user', content: message }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsTyping(true);

    try {
      // 调用真实的AI API
      const response = await axios.post('http://localhost:3001/api/mindmap/chat', {
        question: message,
        nodeText: currentNode,
        nodeLevel: currentNodeLevel,
        provider: selectedProvider,
        model: selectedModel,
        conversationHistory: chatMessages
      });

      if (response.data.success) {
        const aiResponse = response.data.data.response;
        setChatMessages([...newMessages, { type: 'ai', content: aiResponse }]);
      } else {
        throw new Error(response.data.error || '获取AI回复失败');
      }
    } catch (error) {
      console.error('AI问答失败:', error);
      const errorMessage = error.response?.data?.error || '抱歉，AI服务暂时不可用，请稍后重试。';
      setChatMessages([...newMessages, { 
        type: 'ai', 
        content: `❌ ${errorMessage}` 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // 将AI回答添加为子节点
  const addResponseToMindmap = async (aiResponse) => {
    console.log('🔍 开始添加AI回答到思维导图:', {
      aiResponse: aiResponse?.substring(0, 100) + '...',
      currentNode,
      currentNodeLevel,
      mindmapResult: mindmapResult ? '存在' : '不存在'
    });
    
    if (!aiResponse || !mindmapResult) {
      console.log('❌ 缺少必要参数:', { aiResponse: !!aiResponse, mindmapResult: !!mindmapResult });
      return;
    }

    setIsOrganizing(true);

    try {
      console.log('📡 发送API请求到后端:', {
        url: 'http://localhost:3001/api/mindmap/organize-response',
        data: {
          aiResponse: aiResponse?.substring(0, 100) + '...',
          parentNodeText: currentNode,
          parentNodeLevel: currentNodeLevel,
          provider: selectedProvider,
          model: selectedModel
        }
      });
      
      // 调用后端API整理AI回答为子节点
      const response = await axios.post('http://localhost:3001/api/mindmap/organize-response', {
        aiResponse: aiResponse,
        parentNodeText: currentNode,
        parentNodeLevel: currentNodeLevel,
        provider: selectedProvider,
        model: selectedModel
      });
      
      console.log('✅ 后端API响应成功:', response.data);

      if (response.data.success) {
        const { nodes } = response.data.data;
        
        // 将新节点插入到思维导图中
        const updatedMindmap = insertNodesIntoMindmap(mindmapResult, currentNode, currentNodeLevel, nodes);
        setMindmapResult(updatedMindmap);
        
        // 显示成功消息
        setSuccess(`成功添加了 ${nodes.length} 个子节点到思维导图中！`);
        
        // 在聊天中显示成功消息
        setChatMessages(prev => [...prev, {
          type: 'system',
          content: `✅ 已成功将回答整理为 ${nodes.length} 个子节点并添加到思维导图中！\n\n新增节点：\n${nodes.map((node, index) => `${index + 1}. ${node.text}`).join('\n')}`
        }]);

      } else {
        throw new Error(response.data.error || '整理AI回答失败');
      }
    } catch (error) {
      console.error('❌ 添加节点失败:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      const errorMessage = error.response?.data?.error || '添加子节点时发生错误，请重试。';
      setChatMessages(prev => [...prev, {
        type: 'system',
        content: `❌ ${errorMessage}`
      }]);
    } finally {
      setIsOrganizing(false);
    }
  };

  // 将新节点插入到思维导图Markdown中
  const insertNodesIntoMindmap = (originalMindmap, parentNodeText, parentLevel, newNodes) => {
    const lines = originalMindmap.split('\n');
    const newLines = [];
    let foundParent = false;

    // 找到父节点的位置
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const currentLevel = (line.match(/^#+/) || [''])[0].length;
      const currentText = line.replace(/^#+\s*/, '');

      newLines.push(lines[i]);

      // 找到匹配的父节点
      if (!foundParent && currentLevel === parentLevel && currentText === parentNodeText) {
        foundParent = true;
        
        // 跳过已存在的同级或更深层级的子节点
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          const nextLevel = (nextLine.match(/^#+/) || [''])[0].length;
          
          if (nextLevel > parentLevel) {
            // 这是一个子节点，跳过
            newLines.push(lines[j]);
            j++;
          } else {
            // 遇到同级或更高级节点，在这里插入新节点
            break;
          }
        }
        
        // 插入新节点
        newNodes.forEach(node => {
          newLines.push(node.markdown);
        });
        
        // 继续处理剩余的行
        i = j - 1; // -1 因为for循环会+1
      }
    }

    // 如果没找到父节点，将新节点添加到末尾
    if (!foundParent) {
      newNodes.forEach(node => {
        newLines.push(node.markdown);
      });
    }

    return newLines.join('\n');
  };

  // 改进的思维导图渲染 - 支持更好的长文本显示
  const renderMarkdownAsTree = (markdown) => {
    const lines = markdown.split('\n').filter(line => line.trim());
    const treeData = [];
    
    lines.forEach(line => {
      const level = (line.match(/^#+/) || [''])[0].length;
      const text = line.replace(/^#+\s*/, '');
      if (text) {
        treeData.push({ level, text });
      }
    });
  
    return (
      <div className="mindmap-tree">
        {treeData.map((item, index) => (
          <div 
            key={index}
            className={`tree-node level-${item.level}`}
            data-level={item.level}
            style={{
              marginLeft: `${(item.level - 1) * 40}px`,
              position: 'relative',
              marginBottom: '8px'
            }}
          >
            {/* 连接线 */}
            {item.level > 1 && (
              <>
                <div className="horizontal-line"></div>
                <div className="vertical-line"></div>
              </>
            )}
            
            {/* 节点圆点 */}
            <div className={`node-circle level-${item.level}`}></div>
            
            {/* 节点内容 - 改进长文本显示 */}
            <div 
              className={`node-content level-${item.level} node-hoverable`}
              style={{
                backgroundColor: item.level === 1 ? '#e3f2fd' : 
                                item.level === 2 ? '#f3e5f5' : 
                                item.level === 3 ? '#e8f5e8' : 
                                item.level === 4 ? '#fff3e0' :
                                item.level === 5 ? '#fce4ec' :
                                '#f3e5f5',
                borderLeft: `4px solid ${item.level === 1 ? '#2196f3' : 
                                       item.level === 2 ? '#9c27b0' : 
                                       item.level === 3 ? '#4caf50' : 
                                       item.level === 4 ? '#ff9800' :
                                       item.level === 5 ? '#e91e63' :
                                       '#673ab7'}`,
                fontSize: item.level === 1 ? '16px' : 
                         item.level === 2 ? '14px' : 
                         item.level >= 3 ? '13px' : '12px',
                fontWeight: item.level <= 2 ? 'bold' : 'normal',
                cursor: 'pointer',
                minHeight: item.text.length > 30 ? '60px' : '40px', // 长文本增加高度
                padding: item.text.length > 30 ? '12px 50px 12px 16px' : '8px 50px 8px 16px', // 长文本增加内边距
                lineHeight: '1.4',
                wordBreak: 'break-word', // 长单词换行
                whiteSpace: 'normal', // 允许换行
                display: 'flex',
                alignItems: item.text.length > 30 ? 'flex-start' : 'center', // 长文本顶部对齐
                paddingTop: item.text.length > 30 ? '12px' : '8px'
              }}
            >
              <span style={{ 
                flex: 1, 
                paddingRight: '10px',
                wordWrap: 'break-word',
                maxWidth: 'calc(100% - 40px)' // 为AI图标留出空间
              }}>
                {item.text}
              </span>
              
              {/* AI提示图标 - 点击触发对话 */}
              <span 
                className="ai-hint-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  openAIChat(item.text, item.level);
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: item.text.length > 30 ? '12px' : '50%',
                  transform: item.text.length > 30 ? 'none' : 'translateY(-50%)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  flexShrink: 0
                }}
                title="点击向AI提问"
              >
                💡
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 导出为Markdown文件
  const exportToMarkdown = () => {
    if (!mindmapResult || !mindmapResult.trim()) {
      setError('请先生成思维导图！');
      return;
    }
    
    console.log('🚀 开始导出Markdown思维导图，思维导图内容:', mindmapResult.substring(0, 200) + '...');
    const fileName = getSafeFileName(mindmapResult, 'md');
    console.log('📄 导出的文件名:', fileName);
    
    // 直接导出原始Markdown内容
    const blob = new Blob([mindmapResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess(`思维导图已导出为Markdown文件！文件名: ${fileName}`);
  };



  // 导出为PNG
  const exportToPNG = async () => {
    if (!mindmapResult || !mindmapResult.trim()) {
      setError('请先生成思维导图！');
      return;
    }

    setIsExportingPNG(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('http://localhost:3001/api/mindmap/export-png', {
        markdown: mindmapResult,
        title: title || '思维导图'
      }, {
        responseType: 'arraybuffer' // 重要：设置响应类型为arraybuffer
      });

      // 创建Blob并下载
      const blob = new Blob([response.data], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const fileName = getSafeFileName(mindmapResult, 'png');
      console.log('🖼️ 导出的PNG文件名:', fileName);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess(`思维导图已导出为PNG！文件名: ${fileName}`);
    } catch (err) {
      console.error('PNG导出失败:', err);
      setError(
        err.response?.data?.error || 
        '导出PNG失败，请稍后重试'
      );
    } finally {
      setIsExportingPNG(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mindmap-container">
        {/* 输入区域 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">📝 输入内容</h2>
          
          <div className="space-y-4">
            {/* 模型选择 */}
            {providers.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI提供商
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {providers.map(provider => (
                      <option key={provider.name} value={provider.name}>
                        {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
                      </option>
                    ))}
                  </select>
                </div> */}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    模型
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {providers
                      .find(p => p.name === selectedProvider)
                      ?.models.map(model => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      )) || []
                    }
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                内容 *（支持文本和视频链接）
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="请输入要生成思维导图的内容..."
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* 文件上传区域 */}
            <div key="file-upload-area" className="border border-gray-300 rounded-lg p-6 bg-white" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
              minHeight: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div className="flex items-center justify-start" style={{ gap: '10px' }}>
                <input
                  key="file-input"
                  type="file"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="mindmap-file-upload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.js,.html,.css,.xml,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                />
                <label
                  key="file-label"
                  htmlFor="mindmap-file-upload"
                  className="cursor-pointer rounded-lg font-semibold transition-all duration-300 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    minWidth: '100px',
                    height: '40px',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                  }}
                >
                  📂 选择文件
                </label>
                
                <div className="text-sm text-gray-600 font-medium">
                  {selectedFile ? `📄 ${fileName}` : '未选择文件'}
                </div>
                
                {selectedFile && (
                  <button
                    onClick={clearFile}
                    className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded-md hover:bg-red-50 transition-all duration-200"
                    style={{
                      fontSize: '12px',
                      minWidth: '60px'
                    }}
                  >
                    ✕ 移除
                  </button>
                )}
              </div>
              
              <div className="text-sm text-gray-600 font-normal text-center">
                支持PDF、Word、图片文件（文件大小不超过50MB）
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                ✅ {success}
              </div>
            )}

            <div className="space-x-3">
              <button
                onClick={generateMindmap}
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center"
                style={{ fontSize: '16px' }}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    🔄 生成中...
                  </>
                ) : selectedFile && !fileContent ? (
                  '📁 处理文件并生成思维导图'
                ) : (
                  '生成思维导图'
                )}
              </button>
              
              <button
                onClick={clearMindmap}
                className="btn-secondary"
              >
                🗑️ 清空
              </button>
            </div>
          </div>
        </div>

        {/* 思维导图显示区域 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              🎨 思维导图 
              <span className="text-sm font-normal text-gray-600 ml-2">
                (点击💡进行AI问答)
              </span>
            </h2>
            
            {/* 导出功能按钮组 - 与标题拉开距离，均匀分布 */}
            <div className="export-btn-container" style={{ marginLeft: 'auto', paddingLeft: '40px' }}>
             <button
               onClick={exportToMarkdown}
               disabled={!mindmapResult || isExportingPNG}
               className="export-btn flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors duration-200"
               title={mindmapResult && mindmapResult.trim() ? "导出为Markdown文件" : "请先生成思维导图"}
               translate="no"
             >
               导出markdown
             </button>
              <button
                onClick={exportToPNG}
                disabled={!mindmapResult || isExportingPNG}
                className="export-btn flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors duration-200"
                title={mindmapResult && mindmapResult.trim() ? "导出为PNG图片" : "请先生成思维导图"}
                translate="no"
              >
                {isExportingPNG ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    🖼️ 导出中...
                  </>
                ) : (
                  '导出png'
                )}
              </button>
            </div>
          </div>

          
          <div className="border border-gray-300 rounded-lg p-4" style={{ minHeight: '400px', maxHeight: '600px', overflow: 'auto' }}>
            {mindmapResult ? (
              renderMarkdownAsTree(mindmapResult)
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-center">
                <div>
                  <div className="text-4xl mb-2">🧠</div>
                  <div>思维导图将在这里显示</div>
                  <div className="text-sm mt-1">选择AI模型并输入内容开始</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI问答弹窗 */}
      {showAIModal && (
        <div 
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAIChat();
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div 
            className="ai-chat-modal"
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '700px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* 弹窗头部 */}
            <div 
              style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '16px 16px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🤖 AI助手</span>
                <span 
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={currentNode}
                >
                  {currentNode}
                </span>
                <span 
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                >
                  {selectedProvider}/{selectedModel}
                </span>
              </div>
              <button
                onClick={closeAIChat}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px'
                }}
              >
                ✕
              </button>
            </div>

            {/* 聊天消息区域 */}
            <div 
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                background: '#f9f9f9',
                minHeight: '300px',
                maxHeight: '400px'
              }}
            >
              {chatMessages.map((msg, index) => (
                <div 
                  key={index}
                  style={{
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  {/* AI消息头像和按钮容器 */}
                  {msg.type === 'ai' && (
                    <div 
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        marginRight: '8px',
                        flexShrink: 0,
                        alignSelf: 'flex-start'
                      }}
                    >
                      {/* AI头像 */}
                      <div 
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          marginBottom: '8px'
                        }}
                      >
                        🤖
                      </div>
                      
                      {/* 添加到思维导图按钮 - 放在头像下方 */}
                      {mindmapResult && !msg.content.startsWith('❌') && !msg.content.includes('您好！我是AI助手，很高兴为您解答关于') && (
                        <button
                          onClick={() => addResponseToMindmap(msg.content)}
                          disabled={isOrganizing}
                          style={{
                            background: isOrganizing 
                              ? 'linear-gradient(135deg, #e0e0e0 0%, #cccccc 100%)'
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            padding: '6px 12px',
                            fontSize: '10px',
                            cursor: isOrganizing ? 'not-allowed' : 'pointer',
                            opacity: isOrganizing ? 0.7 : 1,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: isOrganizing 
                              ? '0 2px 4px rgba(0,0,0,0.1)'
                              : '0 3px 8px rgba(102, 126, 234, 0.3)',
                            fontWeight: '600',
                            position: 'relative',
                            overflow: 'hidden',
                            minWidth: '80px',
                            justifyContent: 'center'
                          }}
                          onMouseOver={(e) => {
                            if (!isOrganizing) {
                              e.target.style.transform = 'translateY(-1px) scale(1.05)';
                              e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isOrganizing) {
                              e.target.style.transform = 'translateY(0) scale(1)';
                              e.target.style.boxShadow = '0 3px 8px rgba(102, 126, 234, 0.3)';
                            }
                          }}
                          title="将此回答整理为子节点添加到思维导图"
                        >
                          {isOrganizing ? (
                            <>
                              <span className="loading-spinner" style={{ 
                                width: '12px', 
                                height: '12px',
                                border: '2px solid rgba(255,255,255,0.3)',
                                borderTop: '2px solid white'
                              }}></span>
                              <span style={{ fontWeight: '500' }}>整理中</span>
                            </>
                          ) : (
                            <>
                              <span style={{ 
                                fontSize: '12px',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                              }}>
                                ✨
                              </span>
                              <span style={{ fontWeight: '1000' }}>添加到思维导图</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* 系统消息头像 */}
                  {msg.type === 'system' && (
                    <div 
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#e8f5e9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '8px',
                        fontSize: '16px',
                        flexShrink: 0,
                        alignSelf: 'flex-start'
                      }}
                    >
                      ⚙️
                    </div>
                  )}
                  
                  {/* 消息内容容器 - 包含内容和继续回答按钮 */}
                  <div 
                    style={{
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* AI回答内容 */}
                    <div 
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        background: msg.type === 'user' 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                          : msg.type === 'system'
                          ? '#e8f5e9'
                          : 'white',
                        color: msg.type === 'user' ? 'white' : '#333',
                        boxShadow: msg.type === 'ai' || msg.type === 'system' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                        whiteSpace: 'pre-line',
                        position: 'relative',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}
                    >
                      {msg.content}
                    </div>
                    
                    {/* 继续回答按钮 - 紧贴在AI回答内容下方 */}
                    {msg.type === 'ai' && !msg.content.startsWith('❌') && !msg.content.includes('您好！我是AI助手，很高兴为您解答关于') && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          justifyContent: 'flex-start',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}
                      >
                        {/* 继续回答按钮 - 用户手动触发，直接执行 */}
                        {!msg.showContinueButton && (
                          <button
                            onClick={() => {
                              // 直接调用继续回答功能
                              continueAnswer(index);
                            }}
                            disabled={isContinuing || isTyping || isOrganizing}
                            style={{
                              background: (isContinuing || isTyping || isOrganizing) 
                                ? 'linear-gradient(135deg, #e0e0e0 0%, #cccccc 100%)'
                                : 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '18px',
                              padding: '6px 14px',
                              fontSize: '11px',
                              cursor: (isContinuing || isTyping || isOrganizing) ? 'not-allowed' : 'pointer',
                              opacity: (isContinuing || isTyping || isOrganizing) ? 0.7 : 1,
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              boxShadow: (isContinuing || isTyping || isOrganizing) 
                                ? '0 2px 4px rgba(0,0,0,0.1)'
                                : '0 3px 8px rgba(76, 175, 80, 0.3)',
                              fontWeight: '600',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                            onMouseOver={(e) => {
                              if (!isContinuing && !isTyping && !isOrganizing) {
                                e.target.style.transform = 'translateY(-1px) scale(1.02)';
                                e.target.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!isContinuing && !isTyping && !isOrganizing) {
                                e.target.style.transform = 'translateY(0) scale(1)';
                                e.target.style.boxShadow = '0 3px 8px rgba(76, 175, 80, 0.3)';
                              }
                            }}
                            title="让AI继续完善这个回答"
                          >
                            {isContinuing ? (
                              <>
                                <span className="loading-spinner" style={{ 
                                  width: '12px', 
                                  height: '12px',
                                  border: '2px solid rgba(255,255,255,0.3)',
                                  borderTop: '2px solid white'
                                }}></span>
                                <span style={{ fontWeight: '500' }}>继续中...</span>
                              </>
                            ) : (
                              <>
                                <span style={{ 
                                  fontSize: '12px',
                                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                                }}>
                                  ➕
                                </span>
                                <span style={{ fontWeight: '500' }}>继续回答</span>
                              </>
                            )}
                          </button>
                        )}
                        
                        {/* 回答完整提示 - 当AI判断回答完整时显示 */}
                        {msg.showContinueButton && msg.isComplete && (
                          <div
                            style={{
                              background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                              color: '#2e7d32',
                              border: '1px solid #4caf50',
                              borderRadius: '18px',
                              padding: '6px 12px',
                              fontSize: '10px',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              boxShadow: '0 2px 4px rgba(76, 175, 80, 0.2)'
                            }}
                            title="AI判断回答已经完整"
                          >
                            <span style={{ fontSize: '12px' }}>✅</span>
                            <span>回答已完整</span>
                          </div>
                        )}
                        
                        {/* 继续回答按钮 - 当AI判断回答不完整时显示 */}
                        {msg.showContinueButton && !msg.isComplete && (
                          <button
                            onClick={() => continueAnswer(index)}
                            disabled={isContinuing || isTyping || isOrganizing}
                            style={{
                              background: (isContinuing || isTyping || isOrganizing) 
                                ? 'linear-gradient(135deg, #e0e0e0 0%, #cccccc 100%)'
                                : 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '18px',
                              padding: '6px 14px',
                              fontSize: '11px',
                              cursor: (isContinuing || isTyping || isOrganizing) ? 'not-allowed' : 'pointer',
                              opacity: (isContinuing || isTyping || isOrganizing) ? 0.7 : 1,
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              boxShadow: (isContinuing || isTyping || isOrganizing) 
                                ? '0 2px 4px rgba(0,0,0,0.1)'
                                : '0 3px 8px rgba(76, 175, 80, 0.3)',
                              fontWeight: '600',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                            onMouseOver={(e) => {
                              if (!isContinuing && !isTyping && !isOrganizing) {
                                e.target.style.transform = 'translateY(-1px) scale(1.02)';
                                e.target.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!isContinuing && !isTyping && !isOrganizing) {
                                e.target.style.transform = 'translateY(0) scale(1)';
                                e.target.style.boxShadow = '0 3px 8px rgba(76, 175, 80, 0.3)';
                              }
                            }}
                            title="让AI继续完善这个回答"
                          >
                            {isContinuing ? (
                              <>
                                <span className="loading-spinner" style={{ 
                                  width: '12px', 
                                  height: '12px',
                                  border: '2px solid rgba(255,255,255,0.3)',
                                  borderTop: '2px solid white'
                                }}></span>
                                <span style={{ fontWeight: '500' }}>继续中...</span>
                              </>
                            ) : (
                              <>
                                <span style={{ 
                                  fontSize: '12px',
                                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                                }}>
                                  ➕
                                </span>
                                <span style={{ fontWeight: '500' }}>继续回答</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 用户消息头像 */}
                  {msg.type === 'user' && (
                    <div 
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: '8px',
                        fontSize: '16px',
                        color: 'white',
                        flexShrink: 0,
                        alignSelf: 'flex-start'
                      }}
                    >
                      👤
                    </div>
                  )}
                </div>
              ))}
              
              {/* 输入中提示 */}
              {isTyping && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div 
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px',
                      fontSize: '16px'
                    }}
                  >
                    🤖
                  </div>
                  <div 
                    style={{
                      padding: '12px 16px',
                      background: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'flex',
                      gap: '4px'
                    }}
                  >
                    <span className="typing-dot">•</span>
                    <span className="typing-dot" style={{ animationDelay: '0.2s' }}>•</span>
                    <span className="typing-dot" style={{ animationDelay: '0.4s' }}>•</span>
                  </div>
                </div>
              )}
            </div>

            {/* 推荐问题 */}
            <div 
              style={{
                padding: '15px 20px',
                background: '#f0f4ff',
                borderTop: '1px solid #e0e0e0'
              }}
            >
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px', fontWeight: '500' }}>
                💡 推荐问题
                {isLoadingSuggestions && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#999' }}>
                    🔄 生成中...
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isLoadingSuggestions ? (
                  <div style={{ 
                    padding: '8px 16px', 
                    background: '#f5f5f5', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    color: '#999',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <div className="loading-spinner" style={{ 
                      width: '12px', 
                      height: '12px',
                      border: '2px solid #e0e0e0',
                      borderTop: '2px solid #667eea'
                    }}></div>
                    AI正在生成推荐问题...
                  </div>
                ) : (
                  suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(question)}
                      disabled={isTyping || isOrganizing}
                      style={{
                        background: (isTyping || isOrganizing) ? '#f5f5f5' : 'white',
                        border: '1px solid #667eea',
                        color: (isTyping || isOrganizing) ? '#999' : '#667eea',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        cursor: (isTyping || isOrganizing) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s',
                        opacity: (isTyping || isOrganizing) ? 0.6 : 1
                      }}
                      onMouseOver={(e) => {
                        if (!isTyping && !isOrganizing) {
                          e.target.style.background = '#667eea';
                          e.target.style.color = 'white';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isTyping && !isOrganizing) {
                          e.target.style.background = 'white';
                          e.target.style.color = '#667eea';
                        }
                      }}
                    >
                      {question}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 输入区域 */}
            <div 
              style={{
                padding: '20px',
                background: 'white',
                borderTop: '1px solid #e0e0e0',
                borderRadius: '0 0 16px 16px'
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isTyping && !isOrganizing) {
                      sendMessage(chatInput);
                    }
                  }}
                  disabled={isTyping || isOrganizing}
                  placeholder={
                    isTyping ? "AI正在思考中..." : 
                    isOrganizing ? "正在整理节点..." :
                    "输入您的问题..."
                  }
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '25px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: (isTyping || isOrganizing) ? '#f9f9f9' : 'white',
                    color: (isTyping || isOrganizing) ? '#999' : '#333'
                  }}
                />
                <button
                  onClick={() => sendMessage(chatInput)}
                  disabled={isTyping || isOrganizing || !chatInput.trim()}
                  style={{
                    background: (isTyping || isOrganizing || !chatInput.trim()) 
                      ? '#ccc' 
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '0 20px',
                    borderRadius: '25px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (isTyping || isOrganizing || !chatInput.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (isTyping || isOrganizing || !chatInput.trim()) ? 0.6 : 1
                  }}
                >
                  {isTyping ? '思考中...' : 
                   isOrganizing ? '整理中...' : '发送'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加动画样式 */}
      <style jsx>{`
        .typing-dot {
          animation: typing 1.4s infinite;
        }
        
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }
        
        .ai-hint-icon:hover {
          transform: translateY(-50%) scale(1.2);
        }
        
        .modal-overlay.active {
          animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default MindmapGenerator;