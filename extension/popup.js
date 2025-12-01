// 思维导图AI助手 - 浏览器插件版本
class MindmapAIExtension {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api/mindmap';
        this.selectedProvider = 'deepseek';
        this.selectedModel = 'deepseek-chat';
        this.mindmapResult = '';
        this.currentNode = '';
        this.currentNodeLevel = 1;
        this.chatMessages = [];
        this.suggestedQuestions = [];
        
        // 网页内容抓取相关
        this.pageContent = '';
        this.pageTitle = '';
        this.pageUrl = '';
        this.isContentLoaded = false;
        
        // 分屏模式相关
        this.isSplitScreenMode = true; // 默认使用分屏模式
        this.splitScreenVisible = false;
        
        // 立即执行分屏显示，不等待DOM加载
        this.showSplitScreenImmediately();
        
        this.init().catch(error => {
            console.error('初始化失败:', error);
        });
    }

    async init() {
        // 立即显示分屏模式，不等待任何初始化
        console.log('立即显示分屏模式');
        this.showSplitScreenImmediately();
        
        // 在后台进行其他初始化
        this.bindEvents();
        this.loadSettings();
        this.loadProviders();
        this.listenForBackgroundMessages();
    }

    bindEvents() {
        // 生成按钮 - 直接触发分屏模式
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.showSplitScreen();
        });

        // 清空按钮
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAll();
        });

        // 文件上传
        document.getElementById('fileButton').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // 导出按钮
        document.getElementById('exportMdBtn').addEventListener('click', () => {
            this.exportToMarkdown();
        });

        document.getElementById('exportPngBtn').addEventListener('click', () => {
            this.exportToPNG();
        });

        // AI问答相关
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeAIModal();
        });

        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 点击弹窗外部关闭
        document.getElementById('aiModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeAIModal();
            }
        });

        // 模型选择变化
        document.getElementById('modelSelect').addEventListener('change', (e) => {
            this.onModelChange(e.target.value);
        });

        // 输入面板切换
        document.getElementById('toggleInput').addEventListener('click', () => {
            this.toggleInputPanel();
        });

        // 关闭输入面板
        document.getElementById('closeInput').addEventListener('click', () => {
            this.hideInputPanel();
        });

        // 重新抓取内容按钮
        document.getElementById('refreshContent').addEventListener('click', () => {
            this.reExtractContent();
        });

        // 添加测试思维导图功能（用于调试）
        this.addTestMindmapButton();
        
        // 添加API连接测试功能
        this.addApiTestButton();
        
        // 绑定悬浮原文窗口
        this.bindSourceModalEvents();
    }

    loadSettings() {
        // 从存储中加载设置
        chrome.storage.sync.get(['selectedModel', 'leftPanelWidth'], (result) => {
            if (result.selectedModel) {
                // 检查是否是新的格式 (provider-model)
                if (result.selectedModel.includes('-')) {
                    const [provider, model] = result.selectedModel.split('-');
                    this.selectedProvider = provider;
                    this.selectedModel = model;
                    document.getElementById('modelSelect').value = result.selectedModel;
                } else {
                    // 兼容旧格式
                    this.selectedModel = result.selectedModel;
                    this.selectedProvider = 'deepseek'; // 默认提供商
                    document.getElementById('modelSelect').value = `deepseek-${result.selectedModel}`;
                }
            }
            
            if (result.leftPanelWidth) {
                this.setPanelWidths(result.leftPanelWidth);
            }
        });
    }

    async loadProviders() {
        try {
            console.log('正在加载AI提供商...');
            const response = await fetch(`${this.apiBaseUrl}/providers`);
            const data = await response.json();
            
            if (data.success && data.data) {
                console.log('获取到的提供商:', data.data);
                this.populateModelSelect(data.data);
            } else {
                console.error('获取提供商失败:', data);
                this.showStatus('获取AI模型失败', 'error');
            }
        } catch (error) {
            console.error('加载提供商时出错:', error);
            this.showStatus('连接AI服务失败', 'error');
        }
    }

    populateModelSelect(providers) {
        const modelSelect = document.getElementById('modelSelect');
        
        // 清空现有选项
        modelSelect.innerHTML = '';
        
        // 为每个提供商添加选项
        providers.forEach(provider => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = provider.name === 'deepseek' ? 'DeepSeek' : 
                           provider.name === 'claude' ? 'Claude' : provider.name;
            
            provider.models.forEach(model => {
                const option = document.createElement('option');
                option.value = `${provider.name}-${model}`;
                option.textContent = model;
                optgroup.appendChild(option);
            });
            
            modelSelect.appendChild(optgroup);
        });
        
        // 设置默认选择
        if (providers.length > 0) {
            const firstProvider = providers[0];
            const firstModel = firstProvider.models[0];
            const defaultValue = `${firstProvider.name}-${firstModel}`;
            modelSelect.value = defaultValue;
            
            // 更新当前选择的提供商和模型
            this.selectedProvider = firstProvider.name;
            this.selectedModel = firstModel;
        }
        
        console.log('模型选择器已更新');
    }

    onModelChange(selectedValue) {
        // 解析选择的模型值 (格式: provider-model)
        const [provider, model] = selectedValue.split('-');
        
        if (provider && model) {
            this.selectedProvider = provider;
            this.selectedModel = model;
            
            console.log('模型已更改:', { provider, model });
            
            // 保存设置
            this.saveSettings();
        }
    }

    saveSettings() {
        // 保存设置到存储
        chrome.storage.sync.set({
            selectedModel: `${this.selectedProvider}-${this.selectedModel}`
        });
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }

    async generateMindmap() {
        console.log('=== 开始生成思维导图 ===');
        
        const contentInput = document.getElementById('contentInput');
        const fileInput = document.getElementById('fileInput');
        
        let content = '';
        
        // 调试信息：检查内容状态
        console.log('内容状态检查:');
        console.log('- isContentLoaded:', this.isContentLoaded);
        console.log('- pageContent 长度:', this.pageContent ? this.pageContent.length : 0);
        console.log('- pageContent 预览:', this.pageContent ? this.pageContent.substring(0, 100) : '无');
        console.log('- contentInput 值:', contentInput ? contentInput.value : '无输入框');
        
        // 优先使用抓取的网页内容
        if (this.isContentLoaded && this.pageContent) {
            content = this.pageContent;
            console.log('使用网页内容，长度:', content.length);
        }
        // 其次使用手动输入的内容
        else if (contentInput && contentInput.value.trim()) {
            content = contentInput.value.trim();
            console.log('使用手动输入内容，长度:', content.length);
        }
        // 最后处理文件
        else if (fileInput && fileInput.files.length > 0) {
            console.log('处理文件上传');
            await this.processFile();
            return;
        }
        // 尝试重新抓取内容
        else {
            console.log('没有找到任何内容，尝试重新抓取...');
            this.showStatus('正在重新抓取网页内容...', 'loading');
            
            try {
                await this.reExtractContent();
                
                // 重新检查内容
                if (this.isContentLoaded && this.pageContent && this.pageContent.length > 10) {
                    content = this.pageContent;
                    console.log('重新抓取成功，使用网页内容，长度:', content.length);
                } else {
                    console.log('重新抓取后仍无有效内容，自动显示输入面板');
                    this.showStatus('网页内容获取失败，请手动输入内容', 'error');
                    this.showInputPanel(); // 自动显示输入面板
            return;
                }
            } catch (error) {
                console.error('重新抓取失败:', error);
                this.showStatus('无法获取网页内容，请手动输入内容', 'error');
                this.showInputPanel(); // 自动显示输入面板
                return;
            }
        }

        if (!content || content.length < 10) {
            console.log('内容太短，无法生成思维导图');
            this.showStatus('内容太短，请提供更多内容', 'error');
            return;
        }

        this.showStatus('正在生成思维导图...', 'loading');
        document.getElementById('generateBtn').disabled = true;

        try {
            console.log('开始生成思维导图，内容长度:', content.length);
            console.log('API URL:', `${this.apiBaseUrl}/generate`);
            console.log('请求参数:', {
                text: content.substring(0, 100) + '...',
                title: '思维导图',
                provider: this.selectedProvider,
                model: this.selectedModel
            });

            // 分屏模式：通过background script生成思维导图
            if (this.isSplitScreenMode) {
                console.log('使用分屏模式生成思维导图');
                
                const response = await chrome.runtime.sendMessage({
                    action: 'generateMindmap',
                    content: content,
                    provider: this.selectedProvider,
                    model: this.selectedModel
                });

                if (response.success) {
                    this.mindmapResult = response.data.markdown;
                    console.log('思维导图生成成功，Markdown长度:', this.mindmapResult.length);
                    
                    this.showStatus('✨ 思维导图生成成功！已在页面右侧显示', 'success');
                    this.enableExportButtons();
                    
                    // 显示分屏模式
                    this.showSplitScreen();
                } else {
                    throw new Error(response.error || '生成失败');
                }
            } else {
                // 传统模式：直接在popup中生成
                const response = await fetch(`${this.apiBaseUrl}/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: content,
                        title: '思维导图',
                        provider: this.selectedProvider,
                        model: this.selectedModel
                    })
                });

                console.log('API响应状态:', response.status);
                console.log('API响应头:', response.headers);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('API响应数据:', data);

                if (data.success) {
                    this.mindmapResult = data.data.markdown;
                    console.log('思维导图生成成功，Markdown长度:', this.mindmapResult.length);
                    console.log('思维导图内容预览:', this.mindmapResult.substring(0, 300));
                    
                    // 确保思维导图面板可见
                    const mindmapPanel = document.getElementById('mindmapPanel');
                    if (mindmapPanel) {
                        mindmapPanel.style.display = 'block';
                        mindmapPanel.style.minHeight = '400px';
                    }
                    
                    await this.renderMindmap();
                    this.showStatus('✨ 思维导图生成成功！', 'success');
                    this.enableExportButtons();
                    
                    // 额外验证
                    setTimeout(() => {
                        const container = document.getElementById('mindmapContent');
                        if (container && container.querySelector('.mindmap-tree')) {
                            console.log('✅ 验证：思维导图已成功渲染到页面');
                            this.showStatus('思维导图显示正常', 'success');
                        } else {
                            console.error('❌ 验证失败：思维导图未正确渲染');
                            console.log('容器内容:', container ? container.innerHTML.substring(0, 200) : '容器不存在');
                            this.showStatus('思维导图渲染异常，请检查控制台', 'error');
                        }
                    }, 100);
                } else {
                    console.error('API返回失败:', data);
                    this.showStatus(`生成失败: ${data.message || '未知错误'}`, 'error');
                }
            }
        } catch (error) {
            console.error('生成思维导图失败:', error);
            let errorMessage = '生成思维导图失败';
            
            if (error.message.includes('Failed to fetch')) {
                errorMessage = '无法连接到服务器，请确保后端服务正在运行';
            } else if (error.message.includes('HTTP 500')) {
                errorMessage = '服务器内部错误，请检查后端服务';
            } else if (error.message.includes('HTTP 400')) {
                errorMessage = '请求参数错误，请检查输入内容';
            } else if (error.message.includes('HTTP 401')) {
                errorMessage = 'API密钥无效，请检查配置';
            }
            
            this.showStatus(errorMessage, 'error');
        } finally {
            document.getElementById('generateBtn').disabled = false;
        }
    }

    async processFile() {
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showStatus('请先选择文件', 'error');
            return;
        }

        this.showStatus('正在处理文件...', 'loading');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.apiBaseUrl}/process-file`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                const { content } = data.data;
                document.getElementById('contentInput').value = content;
                this.showStatus(`文件处理成功！提取了 ${content.length} 个字符的内容`, 'success');
                
                // 自动生成思维导图
                await this.generateMindmap();
            } else {
                this.showStatus(`文件处理失败: ${data.message || '未知错误'}`, 'error');
            }
        } catch (error) {
            console.error('文件处理失败:', error);
            this.showStatus('文件处理失败，请重试', 'error');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            document.getElementById('fileName').textContent = `📄 ${file.name}`;
        }
    }

    async renderMindmap() {
        const mindmapContent = document.getElementById('mindmapContent');
        
        console.log('=== 开始渲染思维导图 ===');
        console.log('容器元素:', mindmapContent);
        console.log('思维导图数据:', this.mindmapResult ? '已存在' : '不存在');
        
        if (!mindmapContent) {
            console.error('❌ 找不到思维导图容器元素 mindmapContent');
            return;
        }
        
        if (!this.mindmapResult) {
            console.log('⚠️ 没有思维导图数据，显示空状态');
            mindmapContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🧠</div>
                    <div class="empty-text">思维导图将在这里显示</div>
                    <div class="empty-text" style="font-size: 12px; margin-top: 10px;">点击"生成思维导图"开始分析网页内容</div>
                </div>
            `;
            return;
        }

        console.log('✅ 开始渲染思维导图，内容长度:', this.mindmapResult.length);
        console.log('📊 思维导图内容预览:', this.mindmapResult.substring(0, 200));

        // 清空容器
        mindmapContent.innerHTML = '';

        const lines = this.mindmapResult.split('\n').filter(line => line.trim());
        console.log('📝 解析到的行数:', lines.length);
        
        if (lines.length === 0) {
            mindmapContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text">思维导图内容为空，请重新生成</div>
                </div>
            `;
            return;
        }

        // 解析节点数据，构建树结构
        const nodes = [];
        lines.forEach((line, index) => {
            const level = (line.match(/^#+/) || [''])[0].length;
            let text = line.replace(/^#+\s*/, '').trim();
            
            // 检测是否是AI生成的节点（以[AI]开头）
            let isAI = false;
            if (text.startsWith('[AI]')) {
                isAI = true;
                text = text.replace(/^\[AI\]\s*/, '').trim();
            }
            
            if (text) {
                nodes.push({ level, text, index, isAI });
            }
        });

        // 构建节点树结构
        const buildTree = (nodes, startIndex = 0, parentLevel = 0) => {
            const result = [];
            let i = startIndex;
            
            while (i < nodes.length) {
                const node = nodes[i];
                if (node.level <= parentLevel) {
                    break;
                }
                if (node.level === parentLevel + 1) {
                    const treeNode = {
                        ...node,
                        children: buildTree(nodes, i + 1, node.level)
                    };
                    result.push(treeNode);
                    i++;
                } else {
                    i++;
                }
            }
            return result;
        };

        let tree = buildTree(nodes);
        
        // 加载并应用保存的节点文本
        try {
            tree = await this.applySavedNodeTexts(tree);
            console.log('✅ 已应用保存的节点文本');
        } catch (error) {
            console.error('❌ 应用保存节点时出错:', error);
        }

        // 渲染节点树
        const renderNode = (node, container) => {
            const treeNode = document.createElement('div');
            treeNode.className = 'tree-node';
            treeNode.setAttribute('data-level', node.level);
            
            // 创建节点行容器
            const nodeRow = document.createElement('div');
            nodeRow.className = 'tree-node-row';
            
            const nodeCircle = document.createElement('div');
            nodeCircle.className = `node-circle level-${node.level}`;
            
            // 如果有子节点，添加展开/折叠功能
            if (node.children && node.children.length > 0) {
                nodeCircle.classList.add('has-children');
                nodeCircle.title = '点击展开/折叠';
                
                nodeCircle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    treeNode.classList.toggle('collapsed');
                    nodeCircle.classList.toggle('collapsed');
                });
            }
            
            const nodeContent = document.createElement('div');
            nodeContent.className = `node-content level-${node.level}`;
            nodeContent.setAttribute('data-level', node.level);
            nodeContent.setAttribute('data-text', node.text);
            
            // 如果是AI生成的节点，添加特殊样式类
            if (node.isAI) {
                nodeContent.classList.add('ai-generated');
                treeNode.classList.add('ai-generated-node');
                nodeCircle.classList.add('ai-generated');
            }
            
            const textSpan = document.createElement('span');
            textSpan.className = 'node-text';
            textSpan.textContent = node.text;
            
            // 如果是AI生成的节点，添加AI标识图标
            if (node.isAI) {
                const aiLabel = document.createElement('span');
                aiLabel.className = 'ai-label';
                aiLabel.textContent = '🤖';
                aiLabel.title = 'AI生成的内容';
                textSpan.insertBefore(aiLabel, textSpan.firstChild);
            }
            
            const aiIcon = document.createElement('span');
            aiIcon.className = 'ai-hint-icon';
            aiIcon.textContent = '💡';
            aiIcon.title = '点击向AI提问';
            aiIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openAIChat(node.text, node.level);
            });
            
            // 添加双击编辑功能
            textSpan.addEventListener('dblclick', (e) => {
                console.log('✅ 检测到双击事件 - 节点编辑开始');
                e.stopPropagation();
                const originalText = node.text;
                console.log('📝 原始文本:', originalText);
                const editInput = document.createElement('input');
                editInput.type = 'text';
                editInput.value = originalText;
                editInput.className = 'node-edit-input';
                editInput.style.width = (textSpan.offsetWidth + 40) + 'px';
                editInput.style.fontSize = window.getComputedStyle(textSpan).fontSize;
                editInput.style.fontWeight = window.getComputedStyle(textSpan).fontWeight;
                editInput.style.border = 'none';
                editInput.style.background = 'rgba(255, 255, 255, 0.9)';
                editInput.style.padding = '2px 5px';
                editInput.style.borderRadius = '4px';
                editInput.style.outline = '2px solid #2196f3';
                editInput.style.zIndex = '100';
                
                // 替换文本为输入框
                nodeContent.insertBefore(editInput, textSpan);
                nodeContent.removeChild(textSpan);
                console.log('🔍 输入框已创建并获取焦点');
                editInput.focus();
                
                // 处理输入完成
                const finishEditing = () => {
                    const newText = editInput.value.trim() || originalText;
                    textSpan.textContent = newText;
                    node.text = newText;
                    nodeContent.setAttribute('data-text', newText);
                    nodeContent.insertBefore(textSpan, editInput);
                    nodeContent.removeChild(editInput);
                    
                    // 调用保存函数（稍后实现）
                    this.saveNodeText(node.id || node.text, newText);
                };
                
                // 失焦时完成编辑
                editInput.addEventListener('blur', finishEditing);
                
                // 按Enter键完成编辑
                editInput.addEventListener('keydown', (e) => {
                    console.log('⌨️  按键事件:', e.key);
                    if (e.key === 'Enter') {
                        console.log('✅ Enter键 - 完成编辑');
                        finishEditing();
                    } else if (e.key === 'Escape') {
                        console.log('❌ Escape键 - 取消编辑');
                        // 按Esc键取消编辑
                        nodeContent.insertBefore(textSpan, editInput);
                        nodeContent.removeChild(editInput);
                    }
                });
            });
            
            nodeContent.appendChild(textSpan);
            nodeContent.appendChild(aiIcon);
            
            nodeRow.appendChild(nodeCircle);
            nodeRow.appendChild(nodeContent);
            treeNode.appendChild(nodeRow);
            
            // 如果有子节点，创建子容器
            if (node.children && node.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-node-children';
                node.children.forEach(child => {
                    renderNode(child, childrenContainer);
                });
                treeNode.appendChild(childrenContainer);
            }
            
            container.appendChild(treeNode);
        };

        // 使用DOM方法创建元素，避免HTML注入问题
        const treeContainer = document.createElement('div');
        treeContainer.className = 'mindmap-tree';
        
        tree.forEach(node => {
            renderNode(node, treeContainer);
        });
        
        // 添加新内容到容器
        mindmapContent.appendChild(treeContainer);
        
        // 强制刷新显示
        mindmapContent.style.display = 'none';
        mindmapContent.offsetHeight; // 触发重排
        mindmapContent.style.display = 'block';
        
        console.log('✅ 思维导图渲染完成，节点数:', treeContainer.children.length);
        console.log('📏 思维导图容器尺寸:', {
            width: mindmapContent.offsetWidth,
            height: mindmapContent.offsetHeight,
            scrollHeight: mindmapContent.scrollHeight
        });
        
        // 确保容器可见
        const mindmapPanel = document.getElementById('mindmapPanel');
        if (mindmapPanel) {
            mindmapPanel.style.display = 'block';
            mindmapPanel.style.minHeight = '400px';
        }
        
        // 滚动到思维导图区域
        mindmapContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // 检查生成的HTML结构
        console.log('🏗️ 生成的HTML结构:', mindmapContent.innerHTML.substring(0, 500) + '...');
        
        // 验证树容器是否存在
        const trees = mindmapContent.querySelectorAll('.mindmap-tree');
        console.log('🌲 树容器数量:', trees.length);
        
        if (trees.length === 0) {
            console.error('❌ 树容器没有成功创建');
        } else {
            const nodes = trees[0].querySelectorAll('.tree-node');
            console.log('🌿 节点数量:', nodes.length);
        }
        
        // 检查CSS计算样式
        const computedStyle = window.getComputedStyle(mindmapContent);
        console.log('🎨 容器样式:', {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            overflow: computedStyle.overflow,
            height: computedStyle.height,
            maxHeight: computedStyle.maxHeight
        });
    }

    // 渲染标准思维导图格式（中心节点向外辐射）
    renderStandardMindmap(tree, container) {
        // 创建思维导图容器
        const mindmapWrapper = document.createElement('div');
        mindmapWrapper.className = 'standard-mindmap-wrapper';
        mindmapWrapper.style.cssText = 'width: 100%; height: 100%; overflow: auto; position: relative;';
        
        // 创建SVG容器用于绘制连接线
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'mindmap-svg');
        svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;';
        
        // 创建节点容器
        const nodesContainer = document.createElement('div');
        nodesContainer.className = 'mindmap-nodes-container';
        nodesContainer.style.cssText = 'position: relative; width: 100%; min-height: 600px; padding: 40px; z-index: 2;';
        
        // 计算布局参数
        const centerX = 300;
        const centerY = 300;
        const nodeWidth = 150;
        const nodeHeight = 60;
        const levelSpacing = 200;
        const branchSpacing = 80;
        
        // 存储所有节点的位置信息
        const nodePositions = new Map();
        
        // 渲染中心节点（第一个一级节点）
        if (tree.length > 0) {
            const rootNode = tree[0];
            const rootElement = this.createMindmapNode(rootNode, centerX, centerY, nodeWidth, nodeHeight, 1, true);
            nodesContainer.appendChild(rootElement);
            nodePositions.set(rootNode, { x: centerX, y: centerY });
            
            // 渲染子节点
            if (rootNode.children && rootNode.children.length > 0) {
                this.renderMindmapBranches(rootNode.children, centerX, centerY, levelSpacing, branchSpacing, 
                    nodeWidth, nodeHeight, 2, nodesContainer, nodePositions, svg);
            }
        }
        
        mindmapWrapper.appendChild(svg);
        mindmapWrapper.appendChild(nodesContainer);
        container.appendChild(mindmapWrapper);
        
        // 绘制连接线
        this.drawMindmapConnections(nodePositions, svg, nodeWidth, nodeHeight);
    }
    
    // 创建思维导图节点
    createMindmapNode(node, x, y, width, height, level, isRoot = false) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = `mindmap-node level-${level} ${isRoot ? 'root-node' : ''}`;
        nodeDiv.setAttribute('data-node-id', node.text);
        nodeDiv.setAttribute('data-level', level);
        nodeDiv.style.cssText = `
            position: absolute;
            left: ${x - width/2}px;
            top: ${y - height/2}px;
            width: ${width}px;
            min-height: ${height}px;
            padding: 10px;
            background: ${isRoot ? '#2196f3' : this.getNodeColor(level)};
            color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            cursor: pointer;
            text-align: center;
            font-size: ${isRoot ? '16px' : '14px'};
            font-weight: ${isRoot ? 'bold' : 'normal'};
            word-wrap: break-word;
            transition: transform 0.2s, box-shadow 0.2s;
            z-index: 10;
        `;
        
        nodeDiv.textContent = node.text;
        
        // 添加双击编辑功能
        nodeDiv.addEventListener('dblclick', (e) => {
            console.log('✅ createMindmapNode - 检测到双击事件 - 节点编辑开始');
            e.stopPropagation();
            const originalText = node.text;
            console.log('📝 createMindmapNode - 原始文本:', originalText);
            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.value = originalText;
            editInput.className = 'node-edit-input';
            editInput.style.width = (nodeDiv.offsetWidth + 20) + 'px';
            editInput.style.fontSize = '14px';
            editInput.style.fontWeight = isRoot ? 'bold' : 'normal';
            editInput.style.border = 'none';
            editInput.style.background = 'rgba(255, 255, 255, 0.9)';
            editInput.style.color = isRoot ? '#2196f3' : this.getNodeColor(level);
            editInput.style.padding = '8px';
            editInput.style.borderRadius = '8px';
            editInput.style.outline = '2px solid #2196f3';
            editInput.style.zIndex = '100';
            editInput.style.textAlign = 'center';
            
            // 替换节点为输入框
            const parent = nodeDiv.parentNode;
            const rect = nodeDiv.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            
            editInput.style.position = 'absolute';
            editInput.style.left = (rect.left - parentRect.left) + 'px';
            editInput.style.top = (rect.top - parentRect.top) + 'px';
            editInput.style.width = rect.width + 'px';
            editInput.style.height = rect.height + 'px';
            
            parent.insertBefore(editInput, nodeDiv);
            nodeDiv.style.display = 'none';
            console.log('🔍 createMindmapNode - 输入框已创建并获取焦点');
            editInput.focus();
            
            // 处理输入完成
            const finishEditing = () => {
                const newText = editInput.value.trim() || originalText;
                nodeDiv.textContent = newText;
                node.text = newText;
                nodeDiv.style.display = 'block';
                parent.removeChild(editInput);
                
                // 调用保存函数（稍后实现）
                this.saveNodeText(node.id || node.text, newText);
            };
            
            // 失焦时完成编辑
            editInput.addEventListener('blur', () => {
                console.log('👁️  编辑框失焦 - 完成编辑');
                finishEditing();
            });
            
            // 按Enter键完成编辑
            editInput.addEventListener('keydown', (e) => {
                console.log('⌨️  createMindmapNode - 按键事件:', e.key);
                if (e.key === 'Enter') {
                    console.log('✅ createMindmapNode - Enter键 - 完成编辑');
                    finishEditing();
                } else if (e.key === 'Escape') {
                    console.log('❌ createMindmapNode - Escape键 - 取消编辑');
                    // 按Esc键取消编辑
                    nodeDiv.style.display = 'block';
                    parent.removeChild(editInput);
                }
            });
        });
        
        // 添加悬停效果
        nodeDiv.addEventListener('mouseenter', () => {
            nodeDiv.style.transform = 'scale(1.05)';
            nodeDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        });
        
        nodeDiv.addEventListener('mouseleave', () => {
            nodeDiv.style.transform = 'scale(1)';
            nodeDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        });
        
        // 添加AI提问功能
        nodeDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAIChat(node.text, level);
        });
        
        return nodeDiv;
    }
    
    // 获取节点颜色
    getNodeColor(level) {
        const colors = {
            1: '#2196f3',
            2: '#9c27b0',
            3: '#4caf50',
            4: '#ff9800',
            5: '#e91e63',
            6: '#00bcd4'
        };
        return colors[level] || '#757575';
    }
    
    // 渲染思维导图分支
    renderMindmapBranches(children, parentX, parentY, levelSpacing, branchSpacing, 
                         nodeWidth, nodeHeight, level, container, nodePositions, svg) {
        if (!children || children.length === 0) return;
        
        const totalHeight = children.length * branchSpacing;
        const startY = parentY - totalHeight / 2 + branchSpacing / 2;
        
        children.forEach((child, index) => {
            const angle = this.calculateBranchAngle(children.length, index);
            const childX = parentX + Math.cos(angle) * levelSpacing;
            const childY = parentY + Math.sin(angle) * levelSpacing;
            
            const childElement = this.createMindmapNode(child, childX, childY, nodeWidth, nodeHeight, level);
            container.appendChild(childElement);
            nodePositions.set(child, { x: childX, y: childY, parentX, parentY });
            
            // 递归渲染子节点
            if (child.children && child.children.length > 0) {
                this.renderMindmapBranches(child.children, childX, childY, levelSpacing * 0.8, 
                    branchSpacing * 0.9, nodeWidth, nodeHeight, level + 1, container, nodePositions, svg);
            }
        });
    }
    
    // 计算分支角度（均匀分布）
    calculateBranchAngle(totalBranches, index) {
        if (totalBranches === 1) return Math.PI / 2; // 向下
        const spread = Math.PI * 0.8; // 160度范围
        const startAngle = Math.PI / 2 - spread / 2;
        return startAngle + (spread / (totalBranches - 1)) * index;
    }
    
    // 绘制连接线
    drawMindmapConnections(nodePositions, svg, nodeWidth, nodeHeight) {
        // 延迟设置SVG尺寸，确保容器已渲染
        setTimeout(() => {
            const container = svg.parentElement;
            if (container) {
                svg.setAttribute('width', container.scrollWidth || '100%');
                svg.setAttribute('height', container.scrollHeight || '100%');
                svg.setAttribute('viewBox', `0 0 ${container.scrollWidth || 1000} ${container.scrollHeight || 1000}`);
            }
            
            nodePositions.forEach((pos, node) => {
                if (pos.parentX !== undefined && pos.parentY !== undefined) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', pos.parentX);
                    line.setAttribute('y1', pos.parentY);
                    line.setAttribute('x2', pos.x);
                    line.setAttribute('y2', pos.y);
                    line.setAttribute('stroke', '#667eea');
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('stroke-linecap', 'round');
                    line.style.opacity = '0.6';
                    svg.appendChild(line);
                }
            });
        }, 100);
    }

    openAIChat(nodeText, nodeLevel) {
        this.currentNode = nodeText;
        this.currentNodeLevel = nodeLevel;
        this.chatMessages = [{
            type: 'ai',
            content: `您好！我是AI助手，很高兴为您解答关于"${nodeText}"的问题。您可以直接输入问题，或者选择下方的推荐问题。`
        }];
        
        this.renderChatMessages();
        this.getSuggestedQuestions();
        document.getElementById('aiModal').style.display = 'flex';
    }

    closeAIModal() {
        document.getElementById('aiModal').style.display = 'none';
        this.chatMessages = [];
        this.suggestedQuestions = [];
    }

    async getSuggestedQuestions() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/suggest-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nodeText: this.currentNode,
                    nodeLevel: this.currentNodeLevel,
                    provider: this.selectedProvider,
                    model: this.selectedModel
                })
            });

            const data = await response.json();

            if (data.success) {
                this.suggestedQuestions = data.data.questions || [];
            } else {
                // 使用默认问题
                this.suggestedQuestions = [
                    `"${this.currentNode}"的核心概念是什么？`,
                    `"${this.currentNode}"的主要应用有哪些？`,
                    `"${this.currentNode}"的详细解释是什么？`
                ];
            }
        } catch (error) {
            console.error('获取推荐问题失败:', error);
            this.suggestedQuestions = [
                `"${this.currentNode}"的核心概念是什么？`,
                `"${this.currentNode}"的主要应用有哪些？`,
                `"${this.currentNode}"的详细解释是什么？`
            ];
        }

        this.renderSuggestedQuestions();
    }

    renderSuggestedQuestions() {
        const container = document.getElementById('suggestedQuestions');
        container.innerHTML = '';
        
        this.suggestedQuestions.forEach(question => {
            const btn = document.createElement('button');
            btn.className = 'question-btn';
            btn.textContent = question;
            btn.onclick = () => this.sendMessage(question);
            container.appendChild(btn);
        });
    }

    renderChatMessages() {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        
        this.chatMessages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${msg.type}`;
            
            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            contentEl.textContent = msg.content;
            
            messageEl.appendChild(contentEl);
            container.appendChild(messageEl);
        });
        
        // 滚动到底部
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage(message = null) {
        const chatInput = document.getElementById('chatInput');
        const messageText = message || chatInput.value.trim();
        
        if (!messageText) return;
        
        // 添加用户消息
        this.chatMessages.push({ type: 'user', content: messageText });
        this.renderChatMessages();
        
        if (!message) {
            chatInput.value = '';
        }
        
        // 显示AI正在思考
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'chat-message ai';
        thinkingEl.innerHTML = '<div class="message-content">🤖 正在思考中...</div>';
        document.getElementById('chatMessages').appendChild(thinkingEl);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: messageText,
                    nodeText: this.currentNode,
                    nodeLevel: this.currentNodeLevel,
                    provider: this.selectedProvider,
                    model: this.selectedModel,
                    conversationHistory: this.chatMessages
                })
            });

            const data = await response.json();

            // 移除思考提示
            document.getElementById('chatMessages').removeChild(thinkingEl);

            if (data.success) {
                this.chatMessages.push({ type: 'ai', content: data.data.response });
                this.renderChatMessages();
            } else {
                this.chatMessages.push({ 
                    type: 'ai', 
                    content: `❌ ${data.error || '获取AI回复失败'}` 
                });
                this.renderChatMessages();
            }
        } catch (error) {
            console.error('AI问答失败:', error);
            document.getElementById('chatMessages').removeChild(thinkingEl);
            this.chatMessages.push({ 
                type: 'ai', 
                content: '❌ 抱歉，AI服务暂时不可用，请稍后重试。' 
            });
            this.renderChatMessages();
        }
    }

    exportToMarkdown() {
        if (!this.mindmapResult) {
            this.showStatus('请先生成思维导图！', 'error');
            return;
        }
        
        const blob = new Blob([this.mindmapResult], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '思维导图.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showStatus('思维导图已导出为Markdown文件！', 'success');
    }

    async exportToPNG() {
        if (!this.mindmapResult) {
            this.showStatus('请先生成思维导图！', 'error');
            return;
        }

        this.showStatus('正在导出PNG...', 'loading');
        document.getElementById('exportPngBtn').disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/export-png`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    markdown: this.mindmapResult,
                    title: '思维导图'
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '思维导图.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.showStatus('思维导图已导出为PNG！', 'success');
            } else {
                throw new Error('导出失败');
            }
        } catch (error) {
            console.error('PNG导出失败:', error);
            this.showStatus('导出PNG失败，请稍后重试', 'error');
        } finally {
            document.getElementById('exportPngBtn').disabled = false;
        }
    }

    enableExportButtons() {
        document.getElementById('exportMdBtn').disabled = false;
        document.getElementById('exportPngBtn').disabled = false;
    }

    async clearAll() {
        document.getElementById('contentInput').value = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('fileName').textContent = '未选择文件';
        this.mindmapResult = '';
        await this.renderMindmap();
        document.getElementById('exportMdBtn').disabled = true;
        document.getElementById('exportPngBtn').disabled = true;
        this.showStatus('', 'info');
    }

    // 分屏布局相关方法
    bindResizeEvents() {
        this.resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            document.body.classList.add('resizing');
            
            const startX = e.clientX;
            const startLeftWidth = this.getLeftPanelWidth();
            
            const handleMouseMove = (e) => {
                if (!this.isResizing) return;
                
                const deltaX = e.clientX - startX;
                const containerWidth = this.leftPanel.parentElement.offsetWidth;
                const newLeftWidth = startLeftWidth + (deltaX / containerWidth) * 100;
                
                this.setPanelWidths(Math.max(20, Math.min(80, newLeftWidth)));
            };
            
            const handleMouseUp = () => {
                this.isResizing = false;
                document.body.classList.remove('resizing');
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                
                // 保存布局设置
                this.saveLayoutSettings();
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // 双击重置布局
        this.resizeHandle.addEventListener('dblclick', () => {
            this.setPanelWidths(this.defaultLeftWidth);
            this.saveLayoutSettings();
        });
    }

    setPanelWidths(leftPercentage) {
        const rightPercentage = 100 - leftPercentage;
        this.leftPanel.style.flex = `0 0 ${leftPercentage}%`;
        this.rightPanel.style.flex = `0 0 ${rightPercentage}%`;
    }

    getLeftPanelWidth() {
        const containerWidth = this.leftPanel.parentElement.offsetWidth;
        return (this.leftPanel.offsetWidth / containerWidth) * 100;
    }

    toggleLayout() {
        const currentLeftWidth = this.getLeftPanelWidth();
        let newLeftWidth;
        
        if (currentLeftWidth > 60) {
            // 当前左侧较宽，切换到右侧较宽
            newLeftWidth = 30;
        } else if (currentLeftWidth < 40) {
            // 当前右侧较宽，切换到左侧较宽
            newLeftWidth = 70;
        } else {
            // 当前基本平衡，切换到默认
            newLeftWidth = this.defaultLeftWidth;
        }
        
        this.setPanelWidths(newLeftWidth);
        this.saveLayoutSettings();
    }

    saveLayoutSettings() {
        const leftWidth = this.getLeftPanelWidth();
        chrome.storage.sync.set({
            leftPanelWidth: leftWidth
        });
    }

    // 网页内容抓取相关方法
    async loadPageContent() {
        try {
            this.showStatus('正在获取网页内容...', 'loading');
            
            console.log('=== 开始获取网页内容 ===');
            
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                console.error('无法获取当前标签页');
                this.showStatus('无法获取当前标签页', 'error');
                return;
            }

            console.log('当前标签页:', tab);
            console.log('标签页ID:', tab.id);
            console.log('标签页URL:', tab.url);
            console.log('标签页标题:', tab.title);

            this.pageUrl = tab.url;
            this.pageTitle = tab.title;

            // 更新页面信息显示
            this.updatePageInfo();

            // 检查是否是特殊页面
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
                console.log('检测到浏览器内部页面，跳过内容抓取');
                this.showStatus('无法在浏览器内部页面抓取内容', 'error');
                return;
            }

            // 直接使用脚本注入方式获取内容
            console.log('开始直接注入脚本获取内容...');
            console.log('目标标签页ID:', tab.id);
            console.log('目标URL:', tab.url);
            
            let response;
            try {
                // 直接注入脚本执行内容提取
                console.log('执行脚本注入...');
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        console.log('脚本开始执行...');
                        try {
                            // 提取页面内容
                            let content = document.body.innerText || document.body.textContent || '';
                            console.log('初始内容长度:', content.length);
                            
                            // 如果内容太少，尝试获取更多内容
                            if (content.length < 100) {
                                console.log('内容太少，尝试其他选择器...');
                                const mainSelectors = ['main', 'article', '.content', '#content', '.post', '.entry'];
                                for (const selector of mainSelectors) {
                                    const element = document.querySelector(selector);
                                    if (element) {
                                        const text = element.innerText || element.textContent || '';
                                        console.log(`选择器 ${selector} 找到内容长度:`, text.length);
                                        if (text.length > content.length) {
                                            content = text;
                                        }
                                    }
                                }
                            }
                            
                            // 清理文本
                            content = content.replace(/\s+/g, ' ').trim();
                            console.log('最终内容长度:', content.length);
                            
                            const result = {
                                success: true,
                                pageContent: content || '无法提取页面内容',
                                pageTitle: document.title || '未知标题',
                                pageUrl: window.location.href,
                                length: content.length
                            };
                            
                            console.log('脚本执行完成，返回结果:', result);
                            return result;
                        } catch (error) {
                            console.error('脚本执行错误:', error);
                            return {
                                success: false,
                                error: error.message
                            };
                        }
                    }
                });
                
                console.log('脚本注入完成，结果:', results);
                
                if (results && results[0] && results[0].result) {
                    response = results[0].result;
                    console.log('直接脚本注入结果:', response);
                } else {
                    console.error('脚本注入返回空结果:', results);
                    throw new Error('脚本注入返回空结果');
                }
            } catch (error) {
                console.error('直接脚本注入失败:', error);
                console.error('错误详情:', error.message);
                throw new Error('无法提取网页内容，请刷新页面后重试');
            }
            
            console.log('响应检查:', {
                hasResponse: !!response,
                success: response?.success,
                hasPageContent: !!response?.pageContent,
                contentLength: response?.pageContent?.length || 0,
                responseKeys: response ? Object.keys(response) : 'no response'
            });
            
            // 检查响应是否为null或undefined
            if (!response) {
                console.error('响应为空，可能是脚本注入失败');
                throw new Error('脚本注入失败，响应为空');
            }
            
            // 检查响应结构
            console.log('详细响应分析:', {
                response: response,
                success: response.success,
                successType: typeof response.success,
                pageContent: response.pageContent,
                pageContentType: typeof response.pageContent,
                pageContentLength: response.pageContent ? response.pageContent.length : 0
            });
            
            // 更宽松的检查条件
            if (response && response.success && response.pageContent && response.pageContent.length > 0) {
                console.log('✅ 进入成功处理分支');
                this.pageContent = response.pageContent;
                this.isContentLoaded = true;
                this.pageTitle = response.pageTitle || document.title;
                this.pageUrl = response.pageUrl || window.location.href;
                
                console.log('抓取到的内容长度:', this.pageContent.length);
                console.log('抓取到的内容预览:', this.pageContent.substring(0, 500));
                
                // 内容质量检测
                this.analyzeContentQuality();
                
                // 更新内容摘要
                this.updateContentSummary();
                this.showStatus('网页内容获取成功！', 'success');
            } else if (response && response.pageContent && response.pageContent.length > 0) {
                // 即使没有success字段，但有内容就使用
                console.log('⚠️ 响应没有success字段，但内容存在，使用内容');
                this.pageContent = response.pageContent;
                this.isContentLoaded = true;
                this.pageTitle = response.pageTitle || document.title;
                this.pageUrl = response.pageUrl || window.location.href;
                
                console.log('抓取到的内容长度:', this.pageContent.length);
                console.log('抓取到的内容预览:', this.pageContent.substring(0, 500));
                
                // 内容质量检测
                this.analyzeContentQuality();
                
                // 更新内容摘要
                this.updateContentSummary();
                this.showStatus('网页内容获取成功！', 'success');
            } else {
                console.error('❌ 响应处理失败:', {
                    response: response,
                    success: response?.success,
                    pageContent: response?.pageContent,
                    pageContentLength: response?.pageContent?.length || 0,
                    error: response?.error
                });
                throw new Error(response?.error || '无法提取网页内容，结果为空');
            }

        } catch (error) {
            console.error('获取网页内容失败:', error);
            console.error('错误堆栈:', error.stack);
            
            // 检查是否已经有内容了
            if (this.pageContent && this.pageContent.length > 0) {
                console.log('⚠️ 虽然有错误，但已有内容，使用现有内容');
                this.isContentLoaded = true;
                this.showStatus('网页内容获取成功！', 'success');
                return;
            }
            
            let errorMessage = '获取网页内容失败';
            
            if (error.message.includes('Cannot access')) {
                errorMessage = '无法访问此页面，请尝试在其他网页上使用';
            } else if (error.message.includes('permission')) {
                errorMessage = '权限不足，请检查插件权限设置';
            } else if (error.message.includes('scripting')) {
                errorMessage = '脚本执行失败，请刷新页面后重试';
            } else if (error.message.includes('无法与页面通信')) {
                errorMessage = '无法与页面通信，请刷新页面后重试';
            } else if (error.message.includes('脚本注入')) {
                errorMessage = '脚本注入失败，请刷新页面后重试';
            }
            
            this.showStatus(errorMessage + '，请重试', 'error');
            this.isContentLoaded = false;
            
            // 显示详细错误信息
            console.log('=== 详细错误信息 ===');
            console.log('错误类型:', error.constructor.name);
            console.log('错误消息:', error.message);
            console.log('错误堆栈:', error.stack);
            console.log('当前标签页:', tab);
            console.log('当前页面内容长度:', this.pageContent ? this.pageContent.length : 0);
            console.log('==================');
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
            qualityIssues.push('词汇量不足');
        } else if (analysis.wordCount > 200) {
            qualityScore += 10;
        }
        
        console.log(`内容质量评分: ${qualityScore}/100`);
        if (qualityIssues.length > 0) {
            console.log('质量问题:', qualityIssues);
        }
        
        // 如果质量太低，给出建议
        if (qualityScore < 30) {
            console.warn('内容质量较低，建议检查网页结构或尝试其他页面');
        }
        
        return { qualityScore, qualityIssues, analysis };
    }

    async reExtractContent() {
        try {
            this.showStatus('正在重新抓取网页内容...', 'loading');
            
            // 清除之前的内容
            this.pageContent = '';
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
    async testMindmapDisplay() {
        console.log('🧪 开始测试思维导图显示...');
        
        // 创建测试数据
        const testMindmap = `# 测试思维导图
## 主要概念
### 人工智能
#### 机器学习
#### 深度学习
### 数据分析
#### 统计方法
#### 可视化
## 应用领域
### 医疗健康
### 金融服务
### 教育培训`;

        this.mindmapResult = testMindmap;
        console.log('📊 设置测试思维导图数据:', this.mindmapResult);
        
        // 先清空现有内容
        const container = document.getElementById('mindmapContent');
        if (container) {
            container.innerHTML = '';
        }
        
        await this.renderMindmap();
        this.showStatus('测试思维导图已加载', 'success');
        this.enableExportButtons();
        
        // 验证渲染结果
        setTimeout(() => {
            if (container && container.querySelector('.mindmap-tree')) {
                console.log('✅ 测试成功：思维导图已显示');
                this.showStatus('测试成功！思维导图可见', 'success');
            } else {
                console.error('❌ 测试失败：思维导图未显示');
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
                    text: '这是一个测试文本，用于验证API连接是否正常。',
                    title: 'API连接测试',
                    provider: this.selectedProvider,
                    model: this.selectedModel
                })
            });
            
            console.log('API响应状态:', response.status);
            console.log('API响应头:', Object.fromEntries(response.headers.entries()));
            
            if (response.ok) {
                const data = await response.json();
                console.log('API响应数据:', data);
                
                if (data.success) {
                    this.showStatus('✅ API连接正常！', 'success');
                    console.log('API连接测试成功');
                } else {
                    this.showStatus(`❌ API返回错误: ${data.message}`, 'error');
                    console.error('API返回错误:', data);
                }
            } else {
                const errorText = await response.text();
                this.showStatus(`❌ HTTP错误 ${response.status}: ${errorText}`, 'error');
                console.error('HTTP错误:', response.status, errorText);
            }
            
        } catch (error) {
            console.error('API连接测试失败:', error);
            
            let errorMessage = '❌ API连接失败';
            if (error.message.includes('Failed to fetch')) {
                errorMessage = '❌ 无法连接到后端服务，请确保服务正在运行';
            } else if (error.message.includes('CORS')) {
                errorMessage = '❌ CORS错误，请检查后端CORS配置';
            } else if (error.message.includes('NetworkError')) {
                errorMessage = '❌ 网络错误，请检查网络连接';
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

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('sourceModal').style.display !== 'none') {
                this.hideSourceModal();
            }
        });
    }

    // 显示原文悬浮窗
    showSourceModal() {
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
            // 格式化显示原文内容
            let formattedContent = '';
            
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

    // 隐藏原文悬浮窗
    hideSourceModal() {
        document.getElementById('sourceModal').style.display = 'none';
        document.body.style.overflow = ''; // 恢复滚动
    }

    // 立即显示分屏模式
    async showSplitScreenImmediately() {
        try {
            console.log('立即显示分屏模式...');
            
            // 立即显示分屏界面
            const response = await chrome.runtime.sendMessage({
                action: 'showSplitScreen'
            });
            
            if (response.success) {
                this.splitScreenVisible = true;
                console.log('分屏模式已显示');
                
                // 立即关闭popup（无延迟）
                window.close();
                
                // 在后台异步抓取内容
                this.loadPageContentAsync();
            } else {
                console.error('显示分屏模式失败:', response.error);
            }
        } catch (error) {
            console.error('显示分屏模式失败:', error);
        }
    }

    // 异步抓取网页内容
    async loadPageContentAsync() {
        try {
            console.log('开始异步抓取网页内容...');
            
            // 通知content script开始抓取内容
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'startContentExtraction'
                });
            }
            
            // 在popup中抓取内容
            await this.loadPageContent();
            
            // 抓取完成后生成思维导图
            if (this.isContentLoaded && this.pageContent && this.pageContent.length > 10) {
                console.log('网页内容抓取完成，开始生成思维导图');
                this.generateMindmapForSplitScreen();
            } else {
                console.log('网页内容抓取失败或内容不足');
                // 通知content script内容抓取失败
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'contentExtractionFailed'
                    });
                }
            }
        } catch (error) {
            console.error('异步抓取内容失败:', error);
            // 通知content script抓取失败
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'contentExtractionFailed'
                    });
                }
            } catch (sendError) {
                console.error('发送失败消息时出错:', sendError);
            }
        }
    }

    // 分屏模式相关方法（保留原有方法作为备用）
    async showSplitScreen() {
        try {
            console.log('开始显示分屏模式...');
            
            // 首先显示分屏界面
            const response = await chrome.runtime.sendMessage({
                action: 'showSplitScreen'
            });
            
            if (response.success) {
                this.splitScreenVisible = true;
                console.log('分屏模式已显示');
                
                // 如果有网页内容，自动生成思维导图
                if (this.isContentLoaded && this.pageContent && this.pageContent.length > 10) {
                    console.log('检测到网页内容，自动生成思维导图');
                    setTimeout(() => {
                        this.generateMindmapForSplitScreen();
                    }, 500); // 等待分屏界面完全加载
                } else {
                    console.log('没有检测到有效网页内容，等待用户手动生成');
                }
            } else {
                console.error('显示分屏模式失败:', response.error);
            }
        } catch (error) {
            console.error('显示分屏模式失败:', error);
        }
    }

    // 为分屏模式生成思维导图
    async generateMindmapForSplitScreen() {
        try {
            console.log('为分屏模式生成思维导图...');
            
            // 获取内容
            let content = '';
            if (this.isContentLoaded && this.pageContent) {
                content = this.pageContent;
                console.log('使用网页内容，长度:', content.length);
            } else {
                console.log('没有网页内容，无法生成思维导图');
                return;
            }

            if (!content || content.length < 10) {
                console.log('内容太短，无法生成思维导图');
                return;
            }

            // 调用API生成思维导图
            const response = await fetch(`${this.apiBaseUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: content,
                    title: '思维导图',
                    provider: this.selectedProvider,
                    model: this.selectedModel
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                console.log('思维导图生成成功，发送到分屏界面');
                
                // 发送思维导图数据到content script
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'renderMindmap',
                        data: data.data
                    });
                }
            } else {
                throw new Error(data.message || '生成失败');
            }
        } catch (error) {
            console.error('生成思维导图失败:', error);
        }
    }

    async hideSplitScreen() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'hideSplitScreen'
            });
            
            if (response.success) {
                this.splitScreenVisible = false;
                console.log('分屏模式已隐藏');
            } else {
                console.error('隐藏分屏模式失败:', response.error);
            }
        } catch (error) {
            console.error('隐藏分屏模式失败:', error);
        }
    }

    async updateSplitStatus(message, type = 'info') {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'updateStatus',
                message: message,
                type: type
            });
            
            if (!response.success) {
                console.error('更新分屏状态失败:', response.error);
            }
        } catch (error) {
            console.error('更新分屏状态失败:', error);
        }
    }

    // 监听来自background的消息
    listenForBackgroundMessages() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Popup received message:', request);
            
            switch (request.action) {
                case 'refreshMindmapRequest':
                    // 重新生成思维导图
                    this.generateMindmap();
                    sendResponse({ success: true });
                    break;
                case 'splitScreenClosed':
                    this.splitScreenVisible = false;
                    sendResponse({ success: true });
                    break;
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }
    
    // 保存节点文本到Chrome存储
    async saveNodeText(nodeIdentifier, newText) {
        try {
            // 为每个思维导图创建唯一的存储键
            const mindmapKey = this.currentMindmapId || 'default-mindmap';
            
            // 从存储中获取现有节点数据
            const result = await chrome.storage.local.get(`mindmap_${mindmapKey}_nodes`);
            const nodesMap = result[`mindmap_${mindmapKey}_nodes`] || {};
            
            // 更新节点文本
            nodesMap[nodeIdentifier] = newText;
            
            // 保存回存储
            await chrome.storage.local.set({
                [`mindmap_${mindmapKey}_nodes`]: nodesMap
            });
            
            // 记录保存状态
            console.log(`✅ 节点保存成功: ${nodeIdentifier} -> ${newText}`);
            
            // 更新当前思维导图ID（如果需要）
            if (!this.currentMindmapId) {
                // 使用当前时间戳作为默认ID
                this.currentMindmapId = `mindmap_${Date.now()}`;
                await chrome.storage.local.set({
                    'last_mindmap_id': this.currentMindmapId
                });
            }
            
        } catch (error) {
            console.error('❌ 节点保存失败:', error);
        }
    }
    
    // 加载保存的节点文本
    async loadNodeTexts() {
        try {
            // 获取最后使用的思维导图ID或使用默认值
            const idResult = await chrome.storage.local.get('last_mindmap_id');
            const mindmapKey = idResult.last_mindmap_id || 'default-mindmap';
            this.currentMindmapId = mindmapKey;
            
            // 获取保存的节点数据
            const result = await chrome.storage.local.get(`mindmap_${mindmapKey}_nodes`);
            const nodesMap = result[`mindmap_${mindmapKey}_nodes`] || {};
            
            console.log(`📁 加载了 ${Object.keys(nodesMap).length} 个保存的节点`);
            return nodesMap;
        } catch (error) {
            console.error('❌ 加载节点失败:', error);
            return {};
        }
    }
    
    // 在渲染思维导图前应用保存的节点文本
    async applySavedNodeTexts(nodes) {
        const savedTexts = await this.loadNodeTexts();
        
        // 递归遍历并更新节点文本
        const updateNodes = (nodeList) => {
            nodeList.forEach(node => {
                const identifier = node.id || node.text;
                if (savedTexts[identifier]) {
                    node.text = savedTexts[identifier];
                }
                if (node.children && node.children.length > 0) {
                    updateNodes(node.children);
                }
            });
        };
        
        updateNodes(nodes);
        return nodes;
    }

}

// 初始化应用
const mindmapAI = new MindmapAIExtension();