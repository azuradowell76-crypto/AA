// 思维导图AI助手 - Background Script
// 处理popup和content script之间的通信

class MindmapBackground {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api/mindmap';
        this.init();
    }

    init() {
        this.listenForMessages();
        this.listenForActionClicks();
    }

    listenForMessages() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Background received message:', request);
            
            switch (request.action) {
                case 'showSplitScreen':
                    this.showSplitScreen(sendResponse);
                    break;
                case 'hideSplitScreen':
                    this.hideSplitScreen(sendResponse);
                    break;
                case 'generateMindmap':
                    this.generateMindmap(request, sendResponse);
                    break;
                case 'updateStatus':
                    this.updateStatus(request, sendResponse);
                    break;
                case 'splitScreenClosed':
                    this.handleSplitScreenClosed(sendResponse);
                    break;
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
            
                    return true; // 保持消息通道开放
        });
    }

    async showSplitScreen(sendResponse) {
        try {
            console.log('📨 Background: 收到显示分屏请求');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                console.error('❌ Background: 未找到活动标签页');
                sendResponse({ success: false, error: 'No active tab found' });
                return;
            }

            console.log('📨 Background: 向标签页发送消息，标签ID:', tab.id);
            
            // 发送消息到content script，添加超时处理
            try {
                const response = await Promise.race([
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'showSplitScreen'
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('消息超时')), 5000)
                    )
                ]);

                console.log('✅ Background: 收到content script响应:', response);
                sendResponse({ success: true, data: response });
            } catch (messageError) {
                console.error('❌ Background: 发送消息失败:', messageError);
                
                // 如果消息发送失败，可能是content script未加载，尝试注入
                try {
                    console.log('🔄 Background: 尝试注入content script...');
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    // 等待一下让脚本加载
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // 再次尝试发送消息
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: 'showSplitScreen'
                    });
                    
                    console.log('✅ Background: 注入后收到响应:', response);
                    sendResponse({ success: true, data: response });
                } catch (injectError) {
                    console.error('❌ Background: 注入脚本也失败:', injectError);
                    sendResponse({ success: false, error: `消息发送失败: ${messageError.message}, 注入失败: ${injectError.message}` });
                }
            }
        } catch (error) {
            console.error('❌ Background: 显示分屏失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async hideSplitScreen(sendResponse) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                sendResponse({ success: false, error: 'No active tab found' });
                return;
            }

            // 发送消息到content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'hideSplitScreen'
            });

            sendResponse({ success: true, data: response });
        } catch (error) {
            console.error('隐藏分屏失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async generateMindmap(request, sendResponse) {
        try {
            console.log('Background: 开始生成思维导图');
            
            // 将 'default' 映射为 'deepseek'
            const provider = (request.provider === 'default' || !request.provider) ? 'deepseek' : request.provider;
            const model = (request.model === 'default' || !request.model) ? 'deepseek-chat' : request.model;
            
            console.log(`Background: 使用 provider=${provider}, model=${model}`);
            
            const response = await fetch(`${this.apiBaseUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: request.content,
                    title: '思维导图',
                    provider: provider,
                    model: model
                })
            });

            console.log('Background: API响应状态:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Background: API响应数据:', data);

            if (data.success) {
                console.log('Background: 思维导图生成成功');
                
                // 发送思维导图数据到content script
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'showMindmap',
                        data: data.data
                    });
                }
                
                sendResponse({ success: true, data: data.data });
            } else {
                console.error('Background: API返回失败:', data);
                sendResponse({ success: false, error: data.message || '生成失败' });
            }
        } catch (error) {
            console.error('Background: 生成思维导图失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async updateStatus(request, sendResponse) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                sendResponse({ success: false, error: 'No active tab found' });
                return;
            }

            // 发送状态更新到content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'updateStatus',
                message: request.message,
                type: request.type
            });

            sendResponse({ success: true, data: response });
        } catch (error) {
            console.error('更新状态失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    handleSplitScreenClosed(sendResponse) {
        console.log('分屏已关闭');
        sendResponse({ success: true });
    }

    // 监听插件图标点击事件
    listenForActionClicks() {
        chrome.action.onClicked.addListener(async (tab) => {
            console.log('插件图标被点击，直接显示分屏模式');
            await this.handleDirectSplitScreen(tab);
        });
    }

    // 直接处理分屏显示（无popup）
    async handleDirectSplitScreen(tab) {
        try {
            console.log('开始直接显示分屏模式...');
            
            // 检查是否是特殊页面
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
                console.log('检测到浏览器内部页面，无法显示分屏');
                return;
            }

            // 直接显示分屏界面
            await this.showSplitScreenDirectly(tab);
            
            // 不再自动生成思维导图，用户需要手动点击"生成思维导图"按钮
            
        } catch (error) {
            console.error('直接显示分屏失败:', error);
        }
    }

    // 直接显示分屏界面
    async showSplitScreenDirectly(tab) {
        try {
            console.log('📨 Background: 开始直接显示分屏，标签ID:', tab.id);
            
            // 发送消息到content script显示分屏，添加超时处理
            try {
                const response = await Promise.race([
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'showSplitScreen'
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('消息超时')), 5000)
                    )
                ]);

                if (response && response.success) {
                    console.log('✅ Background: 分屏模式已直接显示');
                } else {
                    console.error('❌ Background: 显示分屏失败:', response);
                    // 尝试注入脚本后重试
                    await this.retryWithInjection(tab);
                }
            } catch (messageError) {
                console.error('❌ Background: 发送消息失败:', messageError);
                
                // 如果消息发送失败，可能是content script未加载，尝试注入
                await this.retryWithInjection(tab);
            }
        } catch (error) {
            console.error('❌ Background: 直接显示分屏失败:', error);
        }
    }

    // 重试注入脚本
    async retryWithInjection(tab) {
        try {
            console.log('🔄 Background: 尝试注入content script...');
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            // 等待一下让脚本加载和初始化
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 再次尝试发送消息
            const response = await Promise.race([
                chrome.tabs.sendMessage(tab.id, {
                    action: 'showSplitScreen'
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('消息超时')), 5000)
                )
            ]);
            
            if (response && response.success) {
                console.log('✅ Background: 注入后分屏模式已显示');
            } else {
                console.error('❌ Background: 注入后仍然失败:', response);
            }
        } catch (injectError) {
            console.error('❌ Background: 注入脚本也失败:', injectError);
            
            // 如果是特殊页面，给出友好提示
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') || 
                tab.url.startsWith('moz-extension://')) {
                console.log('ℹ️ Background: 当前页面不支持插件功能，请在普通网页上使用');
            } else {
                console.error('❌ Background: 无法在页面上显示分屏，请尝试刷新页面后重试');
            }
        }
    }

    // 异步抓取内容并生成思维导图
    async loadPageContentAndGenerateMindmap(tab) {
        try {
            console.log('开始异步抓取网页内容...');
            
            // 通知content script开始抓取内容
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startContentExtraction'
            });
            
            // 在background中抓取内容
            const pageContent = await this.extractPageContent(tab);
            
            if (pageContent && pageContent.length > 10) {
                console.log('网页内容抓取完成，开始生成思维导图');
                
                // 生成思维导图
                const response = await fetch(`${this.apiBaseUrl}/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: pageContent,
                        title: '思维导图',
                        provider: 'deepseek',
                        model: 'deepseek-chat'
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success) {
                        console.log('思维导图生成成功，发送到分屏界面');
                        
                        // 发送思维导图数据到content script
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'renderMindmap',
                            data: data.data
                        });
                    } else {
                        console.error('思维导图生成失败:', data.message);
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'contentExtractionFailed'
                        });
                    }
                } else {
                    console.error('API调用失败:', response.status);
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'contentExtractionFailed'
                    });
                }
            } else {
                console.log('网页内容抓取失败或内容不足');
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'contentExtractionFailed'
                });
            }
        } catch (error) {
            console.error('异步处理失败:', error);
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'contentExtractionFailed'
                });
            } catch (sendError) {
                console.error('发送失败消息时出错:', sendError);
            }
        }
    }

    // 提取页面内容
    async extractPageContent(tab) {
        try {
            // 注入脚本提取页面内容
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    // 内容提取函数
                    const contentSelectors = [
                        'article', 'main', 'section',
                        '.content', '.main-content', '.post-content', '.entry-content',
                        '.article-content', '#content', '.main', '.primary',
                        '.markdown-body', '.post', '.entry', '.article',
                        '.story', '.news-content', '.blog-content'
                    ];
                    
                    let mainElement = null;
                    let maxTextLength = 0;
                    
                    for (const selector of contentSelectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const element of elements) {
                            const textLength = element.textContent?.length || 0;
                            if (textLength > maxTextLength && textLength > 100) {
                                maxTextLength = textLength;
                                mainElement = element;
                            }
                        }
                    }
                    
                    if (!mainElement) {
                        mainElement = document.body;
                    }
                    
                    const clone = mainElement.cloneNode(true);
                    
                    // 移除不需要的元素
                    const unwantedSelectors = [
                        'script', 'style', 'nav', 'header', 'footer', 'aside',
                        '.sidebar', '.menu', '.navigation', '.nav', '.breadcrumb',
                        '.comments', '.comment', '.social', '.share', '.advertisement',
                        '.ad', '.ads', '.banner', '.popup', '.modal', '.tooltip'
                    ];
                    
                    unwantedSelectors.forEach(selector => {
                        const elements = clone.querySelectorAll(selector);
                        elements.forEach(el => el.remove());
                    });
                    
                    let content = '';
                    
                    // 提取标题
                    const headings = clone.querySelectorAll('h1, h2, h3, h4, h5, h6');
                    headings.forEach(heading => {
                        const text = heading.textContent?.trim();
                        if (text && text.length > 0) {
                            content += text + '\n';
                        }
                    });
                    
                    // 提取段落
                    const paragraphs = clone.querySelectorAll('p');
                    paragraphs.forEach(p => {
                        const text = p.textContent?.trim();
                        if (text && text.length > 20) {
                            content += text + '\n';
                        }
                    });
                    
                    // 提取列表
                    const lists = clone.querySelectorAll('ul, ol');
                    lists.forEach(list => {
                        const items = list.querySelectorAll('li');
                        items.forEach(item => {
                            const text = item.textContent?.trim();
                            if (text && text.length > 10) {
                                content += '• ' + text + '\n';
                            }
                        });
                    });
                    
                    if (!content.trim()) {
                        content = clone.textContent || '';
                    }
                    
                    content = content
                        .replace(/\s+/g, ' ')
                        .replace(/\n\s*\n/g, '\n')
                        .trim();
                    
                    if (content.length > 10000) {
                        content = content.substring(0, 10000) + '...';
                    }
                    
                    return {
                        title: document.title,
                        url: window.location.href,
                        content: content
                    };
                }
            });

            if (results && results[0] && results[0].result) {
                return results[0].result.content;
            }
            
            return null;
        } catch (error) {
            console.error('提取页面内容失败:', error);
            return null;
        }
    }
}

// 初始化background
const mindmapBackground = new MindmapBackground();
console.log('思维导图Background Script已初始化');

