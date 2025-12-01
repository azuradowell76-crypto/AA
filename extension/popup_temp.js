                            // ID选择�?                            '#content', '#main', '#article', '#post',
                            // 特定平台
                            '.markdown-body', '.post', '.entry', '.article',
                            '.story', '.news-content', '.blog-content'
                        ];
                        
                        let mainElement = null;
                        let maxTextLength = 0;
                        
                        // 尝试多个选择器，选择文本最多的元素
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
                        
                        // 如果没有找到合适的内容区域，使用body
                        if (!mainElement) {
                            mainElement = document.body;
                        }
                        
                        // 3. 提取结构化内�?                        const clone = mainElement.cloneNode(true);
                        
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
                        
                        // 4. 提取标题结构
                        const headings = clone.querySelectorAll('h1, h2, h3, h4, h5, h6');
                        if (headings.length > 0) {
                            content += '标题结构:\n';
                            headings.forEach((heading, index) => {
                                if (index < 10) { // 限制标题数量
                                    const level = heading.tagName.toLowerCase();
                                    const text = heading.textContent?.trim();
                                    if (text) {
                                        content += `${level}: ${text}\n`;
                                    }
                                }
                            });
                            content += '\n';
                        }
                        
                        // 5. 提取段落内容
                        const paragraphs = clone.querySelectorAll('p');
                        let paragraphText = '';
                        paragraphs.forEach((p, index) => {
                            if (index < 20) { // 限制段落数量
                                const text = p.textContent?.trim();
                                if (text && text.length > 20) { // 过滤太短的段�?                                    paragraphText += text + '\n\n';
                                }
                            }
                        });
                        
                        // 6. 提取列表内容
                        const lists = clone.querySelectorAll('ul, ol');
                        let listText = '';
                        lists.forEach((list, index) => {
                            if (index < 5) { // 限制列表数量
                                const items = list.querySelectorAll('li');
                                items.forEach((item, itemIndex) => {
                                    if (itemIndex < 10) { // 限制每个列表的项目数
                                        const text = item.textContent?.trim();
                                        if (text && text.length > 10) {
                                            listText += `�?${text}\n`;
                                        }
                                    }
                                });
                                if (listText) listText += '\n';
                            }
                        });
                        
                        // 7. 组合主要内容
                        let mainText = '';
                        if (paragraphText) {
                            mainText += '段落内容:\n' + paragraphText;
                        }
                        if (listText) {
                            mainText += '列表内容:\n' + listText;
                        }
                        
                        // 如果没有提取到结构化内容，使用原始文�?                        if (!mainText) {
                            const text = clone.textContent || clone.innerText || '';
                            mainText = text.replace(/\s+/g, ' ').trim();
                        }
                        
                        // 智能截断：保留完整句�?                        if (mainText.length > 8000) {
                            const sentences = mainText.split(/[.!?。！？]/);
                            let truncated = '';
                            for (const sentence of sentences) {
                                if (truncated.length + sentence.length > 8000) break;
                                truncated += sentence + '.';
                            }
                            mainText = truncated + '...';
                        }
                        
                        if (mainText) {
                            content += `主要内容:\n${mainText}\n\n`;
                        }
                        
                        // 8. 提取图片信息（更智能�?                        const images = document.querySelectorAll('img');
                        const imageInfo = [];
                        images.forEach((img, index) => {
                            if (index < 8) { // 增加图片数量
                                const alt = img.alt || '';
                                const title = img.title || '';
                                const src = img.src || '';
                                
                                // 优先使用alt，其次title，最后src
                                let imageDesc = alt || title || '';
                                
                                // 如果图片描述太短，尝试从父元素获取上下文
                                if (imageDesc.length < 10) {
                                    const parent = img.parentElement;
                                    if (parent) {
                                        const parentText = parent.textContent?.trim();
                                        if (parentText && parentText.length < 50) {
                                            imageDesc = parentText;
                                        }
                                    }
                                }
                                
                                if (imageDesc && imageDesc.length > 3) {
                                    imageInfo.push(imageDesc);
                                }
                            }
                        });
                        
                        if (imageInfo.length > 0) {
                            content += `图片信息:\n${imageInfo.join('\n')}\n\n`;
                        }
                        
                        // 9. 提取重要链接（更智能�?                        const links = document.querySelectorAll('a[href]');
                        const linkInfo = [];
                        const linkTexts = new Set(); // 避免重复
                        
                        links.forEach((link, index) => {
                            if (index < 15) { // 增加链接数量
                                const text = link.textContent?.trim();
                                const href = link.href;
                                
                                // 过滤条件
                                if (text && href && 
                                    !href.startsWith('javascript:') &&
                                    !href.startsWith('#') &&
                                    text.length > 3 &&
                                    text.length < 100 &&
                                    !linkTexts.has(text)) {
                                    
                                    linkTexts.add(text);
                                    
                                    // 简化URL显示
                                    let displayUrl = href;
                                    try {
                                        const url = new URL(href);
                                        if (url.hostname !== window.location.hostname) {
                                            displayUrl = url.hostname + url.pathname;
                                        } else {
                                            displayUrl = url.pathname;
                                        }
                                    } catch (e) {
                                        // 保持原始URL
                                    }
                                    
                                    linkInfo.push(`${text} (${displayUrl})`);
                                }
                            }
                        });
                        
                        // 10. 提取表格信息
                        const tables = document.querySelectorAll('table');
                        if (tables.length > 0) {
                            content += '表格信息:\n';
                            tables.forEach((table, index) => {
                                if (index < 3) { // 限制表格数量
                                    const rows = table.querySelectorAll('tr');
                                    rows.forEach((row, rowIndex) => {
                                        if (rowIndex < 5) { // 限制每表格的行数
                                            const cells = row.querySelectorAll('td, th');
                                            const rowText = Array.from(cells).map(cell => 
                                                cell.textContent?.trim()
                                            ).filter(text => text).join(' | ');
                                            if (rowText) {
                                                content += `${rowText}\n`;
                                            }
            console.log('内容抓取结果:', response);

            if (response && response.success) {
                this.pageContent = response.pageContent;
                this.isContentLoaded = true;
                this.pageTitle = response.pageTitle;
                this.pageUrl = response.pageUrl;
                
                console.log('抓取到的内容长度:', this.pageContent.length);
                console.log('抓取到的内容预览:', this.pageContent.substring(0, 500));
                
                // 内容质量检�?                this.analyzeContentQuality();
                
                // 更新内容摘要
                this.updateContentSummary();
                this.showStatus('网页内容获取成功�?, 'success');
            } else {
                throw new Error(response?.error || '无法提取网页内容，结果为�?);
            }

        } catch (error) {
            console.error('获取网页内容失败:', error);
            let errorMessage = '获取网页内容失败';
            
            if (error.message.includes('Cannot access')) {
                errorMessage = '无法访问此页面，请尝试在其他网页上使�?;
            } else if (error.message.includes('permission')) {
                errorMessage = '权限不足，请检查插件权限设�?;
            } else if (error.message.includes('scripting')) {
                errorMessage = '脚本执行失败，请刷新页面后重�?;
            }
            
            this.showStatus(errorMessage + '，请重试', 'error');
            this.isContentLoaded = false;
        }
    }

    updatePageInfo() {
        document.getElementById('pageTitle').textContent = this.pageTitle || '未知标题';
        document.getElementById('pageUrl').textContent = this.pageUrl || '';
    }

    updateContentSummary() {
        const summary = this.pageContent ? 
            this.pageContent.substring(0, 200) + (this.pageContent.length > 200 ? '...' : '') :
            '暂无内容';
        document.getElementById('contentSummary').textContent = summary;
    }

    analyzeContentQuality() {
        if (!this.pageContent) return;
        
        const content = this.pageContent;
        const analysis = {
            totalLength: content.length,
            hasTitle: content.includes('标题:'),
            hasHeadings: content.includes('标题结构:'),
            hasParagraphs: content.includes('段落内容:'),
            hasLists: content.includes('列表内容:'),
            hasImages: content.includes('图片信息:'),
            hasLinks: content.includes('重要链接:'),
            hasTables: content.includes('表格信息:'),
            wordCount: content.split(/\s+/).length,
            lineCount: content.split('\n').length
        };
        
        console.log('内容质量分析:', analysis);
        
        // 质量评分
        let qualityScore = 0;
        let qualityIssues = [];
        
        if (analysis.totalLength < 100) {
            qualityIssues.push('内容过短');
        } else if (analysis.totalLength > 500) {
            qualityScore += 20;
        }
        
        if (analysis.hasTitle) qualityScore += 10;
        if (analysis.hasHeadings) qualityScore += 15;
        if (analysis.hasParagraphs) qualityScore += 20;
        if (analysis.hasLists) qualityScore += 10;
        if (analysis.hasImages) qualityScore += 10;
        if (analysis.hasLinks) qualityScore += 10;
        if (analysis.hasTables) qualityScore += 5;
        
        if (analysis.wordCount < 50) {
            qualityIssues.push('词汇量不�?);
        } else if (analysis.wordCount > 200) {
            qualityScore += 10;
        }
        
        console.log(`内容质量评分: ${qualityScore}/100`);
        if (qualityIssues.length > 0) {
            console.log('质量问题:', qualityIssues);
        }
        
        // 如果质量太低，给出建�?        if (qualityScore < 30) {
            console.warn('内容质量较低，建议检查网页结构或尝试其他页面');
        }
        
        return { qualityScore, qualityIssues, analysis };
    }

    async reExtractContent() {
        try {
            this.showStatus('正在重新抓取网页内容...', 'loading');
            
            // 清除之前的内�?            this.pageContent = '';
            this.isContentLoaded = false;
            this.updateContentSummary();
            
            // 重新抓取内容
            await this.loadPageContent();
            
            // 如果抓取成功，自动生成思维导图
            if (this.isContentLoaded && this.pageContent) {
                this.showStatus('内容抓取完成，正在生成思维导图...', 'loading');
                await this.generateMindmap();
            }
            
        } catch (error) {
            console.error('重新抓取内容失败:', error);
            this.showStatus('重新抓取失败，请重试', 'error');
        }
    }

    // 输入面板控制
    toggleInputPanel() {
        const inputPanel = document.getElementById('inputPanel');
        if (inputPanel.style.display === 'none') {
            this.showInputPanel();
        } else {
            this.hideInputPanel();
        }
    }

    showInputPanel() {
        document.getElementById('inputPanel').style.display = 'flex';
        // 显示输入面板后，恢复思维导图面板高度
        const mindmapPanel = document.querySelector('.mindmap-panel');
        if (mindmapPanel) {
            mindmapPanel.style.minHeight = '300px';
        }
    }

    hideInputPanel() {
        document.getElementById('inputPanel').style.display = 'none';
        // 隐藏输入面板后，增加思维导图面板高度
        const mindmapPanel = document.querySelector('.mindmap-panel');
        if (mindmapPanel) {
            mindmapPanel.style.minHeight = '500px';
        }
    }

    // 添加测试思维导图按钮（用于调试）
    addTestMindmapButton() {
        const controlButtons = document.querySelector('.control-buttons');
        if (controlButtons) {
            const testBtn = document.createElement('button');
            testBtn.textContent = '🧪';
            testBtn.title = '测试思维导图显示';
            testBtn.className = 'toggle-btn';
            testBtn.style.background = '#ff9800';
            testBtn.addEventListener('click', () => {
                this.testMindmapDisplay();
            });
            controlButtons.appendChild(testBtn);
        }
    }

    // 添加API测试按钮
    addApiTestButton() {
        const controlButtons = document.querySelector('.control-buttons');
        if (controlButtons) {
            const apiTestBtn = document.createElement('button');
            apiTestBtn.textContent = '🔗';
            apiTestBtn.title = '测试API连接';
            apiTestBtn.className = 'toggle-btn';
            apiTestBtn.style.background = '#2196f3';
            apiTestBtn.addEventListener('click', () => {
                this.testApiConnection();
            });
            controlButtons.appendChild(apiTestBtn);
        }
    }

    // 测试思维导图显示
    testMindmapDisplay() {
        console.log('🧪 开始测试思维导图显示...');
        
        // 创建测试数据
        const testMindmap = `# 测试思维导图
## 主要概念
### 人工智能
#### 机器学习
#### 深度学习
### 数据分析
#### 统计方法
#### 可视�?## 应用领域
### 医疗健康
### 金融服务
### 教育培训`;

        this.mindmapResult = testMindmap;
        console.log('📊 设置测试思维导图数据:', this.mindmapResult);
        
        // 先清空现有内�?        const container = document.getElementById('mindmapContent');
        if (container) {
            container.innerHTML = '';
        }
        
        this.renderMindmap();
        this.showStatus('测试思维导图已加�?, 'success');
        this.enableExportButtons();
        
        // 验证渲染结果
        setTimeout(() => {
            if (container && container.querySelector('.mindmap-tree')) {
                console.log('�?测试成功：思维导图已显�?);
                this.showStatus('测试成功！思维导图可见', 'success');
            } else {
                console.error('�?测试失败：思维导图未显�?);
                this.showStatus('测试失败，请检查控制台', 'error');
            }
        }, 200);
    }

    // 测试API连接
    async testApiConnection() {
        console.log('开始测试API连接...');
        this.showStatus('正在测试API连接...', 'loading');
        
        try {
            // 测试基本连接
            const testUrl = `${this.apiBaseUrl}/generate`;
            console.log('测试URL:', testUrl);
            
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: '这是一个测试文本，用于验证API连接是否正常�?,
                    title: 'API连接测试',
                    provider: this.selectedProvider,
                    model: this.selectedModel
                })
            });
            
            console.log('API响应状�?', response.status);
            console.log('API响应�?', Object.fromEntries(response.headers.entries()));
            
            if (response.ok) {
                const data = await response.json();
                console.log('API响应数据:', data);
                
                if (data.success) {
                    this.showStatus('�?API连接正常�?, 'success');
                    console.log('API连接测试成功');
                } else {
                    this.showStatus(`�?API返回错误: ${data.message}`, 'error');
                    console.error('API返回错误:', data);
                }
            } else {
                const errorText = await response.text();
                this.showStatus(`�?HTTP错误 ${response.status}: ${errorText}`, 'error');
                console.error('HTTP错误:', response.status, errorText);
            }
            
        } catch (error) {
            console.error('API连接测试失败:', error);
            
            let errorMessage = '�?API连接失败';
            if (error.message.includes('Failed to fetch')) {
                errorMessage = '�?无法连接到后端服务，请确保服务正在运�?;
            } else if (error.message.includes('CORS')) {
                errorMessage = '�?CORS错误，请检查后端CORS配置';
            } else if (error.message.includes('NetworkError')) {
                errorMessage = '�?网络错误，请检查网络连�?;
            }
            
            this.showStatus(errorMessage, 'error');
        }
    }

    // 绑定悬浮原文窗口事件
    bindSourceModalEvents() {
        // 显示原文按钮
        document.getElementById('showSourceBtn').addEventListener('click', () => {
            this.showSourceModal();
        });

        // 关闭原文按钮
        document.getElementById('closeSourceBtn').addEventListener('click', () => {
            this.hideSourceModal();
        });

        // 点击背景关闭
        document.getElementById('sourceModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideSourceModal();
            }
        });

        // ESC键关�?        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('sourceModal').style.display !== 'none') {
                this.hideSourceModal();
            }
        });
    }

    // 显示原文悬浮�?    showSourceModal() {
        const modal = document.getElementById('sourceModal');
        const sourceContent = document.getElementById('sourceContent');
        
        if (!this.pageContent) {
            sourceContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📄</div>
                    <div class="empty-text">暂无网页内容</div>
                    <div class="empty-text" style="font-size: 12px; margin-top: 10px;">请确保在有效网页上使用本插件</div>
                </div>
            `;
        } else {
            // 格式化显示原文内�?            let formattedContent = '';
            
            if (this.pageTitle) {
                formattedContent += `📝 页面标题:\n${this.pageTitle}\n\n`;
            }
            
            if (this.pageUrl) {
                formattedContent += `🌐 页面URL:\n${this.pageUrl}\n\n`;
            }
            
            formattedContent += `📖 完整内容:\n${this.pageContent}`;
            
            sourceContent.textContent = formattedContent;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    // 隐藏原文悬浮�?    hideSourceModal() {
        document.getElementById('sourceModal').style.display = 'none';
        document.body.style.overflow = ''; // 恢复滚动
    }

}

// 初始化应�?const mindmapAI = new MindmapAIExtension();
