// 思维导图AI助手 - 分屏模式Content Script
// 在网页中实现分屏布局，左侧显示原网页，右侧显示思维导图

class MindmapSplitScreen {
    constructor() {
        this.isActive = false;
        this.leftPanelWidth = 60; // 默认左侧占60%
        this.rightPanelWidth = 40; // 默认右侧占40%
        this.isDragging = false;
        this.isDraggingSidebar = false; // 是否正在拖动侧边栏分割线
        this.sidebarWidth = 400; // 默认侧边栏宽度（像素）
        this.mindmapData = null;
        this.currentNode = '';
        this.currentNodeLevel = 1;
        this.chatMessages = [];
        this.apiBaseUrl = 'http://localhost:3001/api/mindmap';
        this.originalBodyContent = null; // 保存原始body内容
        this.originalBodyStyles = null; // 保存原始body样式
        this.currentHighlightElement = null; // 当前高亮的元素（主要元素）
        this.currentHighlightElements = []; // 当前高亮的所有元素
        // 拖拽日志计数器（用于轻量性能打点）
        this._dragFrameCount = 0;
        this._lastDragLogTime = 0;
        
        // 智能缓存相关
        this.cachedPageUrl = null; // 缓存的页面URL
        this.cachedPageTitle = null; // 缓存的页面标题
        this.mindmapGeneratedTime = null; // 思维导图生成时间
        this.cacheTimeout = 30 * 60 * 1000; // 缓存超时时间（30分钟）
        
        // 节点编辑相关
        this.editHistory = []; // 撤销历史栈
        this.maxHistoryLength = 50; // 最大历史记录数
        this.currentEditingNode = null; // 当前正在编辑的节点
        this.editToolbar = null; // 编辑工具栏
        this.isEditMode = false; // 是否处于编辑模式
        
        // 网页内容编辑相关
        this.editedPageContent = null; // 用户编辑后的网页内容
        this.originalPageContent = null; // 原始网页内容
        this.isSourceEditMode = false; // 是否处于网页内容编辑模式
        
        // 过滤无关的错误信息
        this.setupErrorFilter();
        
        this.init();
    }

    // 清理克隆或移动到左侧面板的节点，移除可能触发跟踪或重新请求的元素
    sanitizeClonedNode(node) {
        if (!node || !node.querySelectorAll) return;

        // 移除所有脚本和 iframe，因为它们可能会触发外部请求或执行不必要的代码
        const scripts = node.querySelectorAll('script, iframe');
        scripts.forEach(el => {
            try { el.remove(); } catch (e) {}
        });

        // 移除或屏蔽可能的跟踪像素（doubleclick, user-matching, adservice 等）
        const imgs = node.querySelectorAll('img');
        imgs.forEach(img => {
            try {
                const src = (img.getAttribute('src') || '').toLowerCase();
                if (src.includes('doubleclick.net') || src.includes('user-matching') || src.includes('adservice') || src.includes('google-analytics') || src.includes('cm.g.doubleclick')) {
                    // 将跟踪像素替换为空占位或直接移除
                    img.remove();
                }
            } catch (e) {}
        });

        // 移除链接样式可能预加载的资源
        const links = node.querySelectorAll('link[rel]');
        links.forEach(link => {
            try {
                const rel = (link.getAttribute('rel') || '').toLowerCase();
                const href = (link.getAttribute('href') || '').toLowerCase();
                if (rel.includes('preload') || rel.includes('dns-prefetch') || href.includes('doubleclick.net') || href.includes('user-matching')) {
                    link.remove();
                }
            } catch (e) {}
        });

        // 移除内联样式中的跟踪 background-image
        try {
            const allWithStyle = node.querySelectorAll('[style]');
            allWithStyle.forEach(el => {
                try {
                    const styleVal = el.getAttribute('style') || '';
                    const lower = styleVal.toLowerCase();
                    if (lower.includes('url(') && (lower.includes('doubleclick.net') || lower.includes('user-matching') || lower.includes('adservice') || lower.includes('cm.g.doubleclick') || lower.includes('googlesyndication'))) {
                        // 移除 background-image 或直接清空 style
                        el.style.backgroundImage = '';
                        // 如果只有背景图则移除整个 style 属性以避免继续请求
                        if (/url\(/i.test(styleVal) && styleVal.trim().length < 200) {
                            el.removeAttribute('style');
                        }
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }
    
    // 设置错误过滤器，过滤掉网页本身的第三方资源错误
    setupErrorFilter() {
        // 要过滤的错误关键词（这些是网页本身的第三方资源，不是扩展的问题）
        const errorFilters = [
            'doubleclick.net',
            'user-matching',
            'google_cm',
            'ERR_CONNECTION_ABORTED',
            '410 (Gone)',
            'cm.g.doubleclick',
            'adservice',
            'analytics',
            'tracking'
        ];
        
        // 保存原始的console.error
        const originalError = console.error;
        const originalWarn = console.warn;
        
        // 重写console.error，过滤无关错误
        console.error = (...args) => {
            const errorMessage = args.join(' ');
            // 检查是否包含要过滤的关键词
            const shouldFilter = errorFilters.some(filter => 
                errorMessage.toLowerCase().includes(filter.toLowerCase())
            );
            
            // 如果不是要过滤的错误，正常输出
            if (!shouldFilter) {
                originalError.apply(console, args);
            }
            // 否则静默忽略（这些是网页本身的第三方资源错误）
        };
        
        // 重写console.warn，过滤无关警告
        console.warn = (...args) => {
            const warnMessage = args.join(' ');
            const shouldFilter = errorFilters.some(filter => 
                warnMessage.toLowerCase().includes(filter.toLowerCase())
            );
            
            if (!shouldFilter) {
                originalWarn.apply(console, args);
            }
        };
        
        // 拦截全局错误事件，过滤无关错误
        window.addEventListener('error', (event) => {
            const errorMessage = event.message || '';
            const errorSource = event.filename || '';
            
            const shouldFilter = errorFilters.some(filter => 
                errorMessage.toLowerCase().includes(filter.toLowerCase()) ||
                errorSource.toLowerCase().includes(filter.toLowerCase())
            );

            // 资源加载错误（resource errors）通常没有 message，但 event.target 指向 <script|img|link> 等
            try {
                const targetEl = event.target;
                if (targetEl && (targetEl.src || targetEl.href)) {
                    const url = (targetEl.src || targetEl.href || '').toLowerCase();
                    const isTracker = errorFilters.some(filter => url.includes(filter.toLowerCase()));
                    if (isTracker) {
                        // 移除触发错误的元素，避免重复请求和控制台噪音
                        try { targetEl.remove(); } catch (e) {}
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                }
            } catch (e) {
                // ignore
            }

            // 如果是第三方资源错误，阻止默认行为（不在控制台显示）
            if (shouldFilter) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        }, true);
        
        // 拦截未捕获的Promise错误
        window.addEventListener('unhandledrejection', (event) => {
            const errorMessage = event.reason?.message || String(event.reason || '');
            
            const shouldFilter = errorFilters.some(filter => 
                errorMessage.toLowerCase().includes(filter.toLowerCase())
            );
            
            if (shouldFilter) {
                event.preventDefault();
                return false;
            }
        });
    }
    
    // 解析节点文本，处理专有名词加粗和解释
    // 格式: **专有名词**(解释) -> <strong class="term">专有名词</strong><span class="term-explanation">(解释)</span>
    parseNodeText(text) {
        if (!text) return '';
        
        // 正则匹配 **专有名词**(解释) 的格式
        // 匹配模式：**xxx**(yyy) 或 **xxx**（yyy）（支持中英文括号）
        const termWithExplanationPattern = /\*\*([^*]+)\*\*[（(]([^)）]+)[)）]/g;
        
        // 正则匹配单独的 **专有名词** 格式（没有解释的情况）
        const termOnlyPattern = /\*\*([^*]+)\*\*/g;
        
        // 先处理带解释的专有名词
        let result = text.replace(termWithExplanationPattern, (match, term, explanation) => {
            return `<strong class="term">${this.escapeHtml(term)}</strong><span class="term-explanation">(${this.escapeHtml(explanation)})</span>`;
        });
        
        // 再处理没有解释的专有名词
        result = result.replace(termOnlyPattern, (match, term) => {
            return `<strong class="term">${this.escapeHtml(term)}</strong>`;
        });
        
        return result;
    }
    
    // HTML转义，防止XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 检查文本是否包含专有名词格式
    hasTermFormat(text) {
        if (!text) return false;
        return /\*\*[^*]+\*\*/.test(text);
    }

    init() {
        this.createSplitScreenLayout();
        this.bindEvents();
        this.listenForMessages();
        this.loadSavedState(); // 加载保存的状态
        this.bindEditKeyboardEvents(); // 绑定节点编辑键盘事件
    }

    createSplitScreenLayout() {
        // 检查是否已经存在分屏容器
        let existingContainer = document.getElementById('mindmap-split-container');
        if (existingContainer) {
            console.log('发现已存在的分屏容器，使用现有容器');
            this.splitContainer = existingContainer;
            this.leftPanel = document.getElementById('mindmap-left-panel');
            this.rightPanel = document.getElementById('mindmap-right-panel');
            this.divider = document.getElementById('mindmap-divider');
            
            // 如果面板不存在，需要重新创建
            if (!this.leftPanel || !this.rightPanel || !this.divider) {
                console.log('面板不完整，重新创建...');
                existingContainer.remove();
                existingContainer = null;
            } else {
                console.log('使用现有分屏容器和面板');
                return; // 使用现有的，不需要重新创建
            }
        }
        
        // 创建分屏容器
        this.splitContainer = document.createElement('div');
        this.splitContainer.id = 'mindmap-split-container';
        this.splitContainer.className = 'mindmap-split-container';
        
        // 创建左侧面板（原网页内容）
        this.leftPanel = document.createElement('div');
        this.leftPanel.id = 'mindmap-left-panel';
        this.leftPanel.className = 'mindmap-left-panel';
        
        // 创建分割线
        this.divider = document.createElement('div');
        this.divider.id = 'mindmap-divider';
        this.divider.className = 'mindmap-divider';
        
        // 创建右侧面板（思维导图）
        this.rightPanel = document.createElement('div');
        this.rightPanel.id = 'mindmap-right-panel';
        this.rightPanel.className = 'mindmap-right-panel';
        
        // 创建完整的思维导图插件界面
        this.rightPanel.innerHTML = `
            <div class="mindmap-panel-header">
                <div class="panel-title">
                 
                    <span>  AI思维导图</span>
                </div>
                <div class="panel-controls">
                    <button id="closeBtn" class="control-btn" title="关闭">✕</button>
                </div>
            </div>
            
            <div class="mindmap-full-interface">
               
                <!-- 缓存状态提示栏 -->
                <div id="splitCacheStatusBar" class="cache-status-bar" style="display: none;">
                    <div class="cache-status-content">
                        <span class="cache-icon">📌</span>
                        <span class="cache-text">缓存的思维导图</span>
                        <span class="cache-time" id="splitCacheTime">生成于 5分钟前</span>
                    </div>
                    <div class="cache-actions">
                        <button id="splitRegenerateBtn" class="cache-action-btn regenerate-btn" title="重新生成思维导图">
                            🔄 重新生成
                        </button>
                        <button id="splitClearCacheBtn" class="cache-action-btn clear-cache-btn" title="清空缓存">
                            🗑️ 清空
                        </button>
                    </div>
                </div>

                <!-- 主要内容区域 -->
                <main class="popup-main">
                    <!-- 控制面板 -->
                    <div class="control-panel" id="splitControlPanel">
                        <div class="panel-header">
                          
                            <div class="control-buttons">
                                <button id="splitRefreshContent" class="refresh-btn">重新抓取网页内容</button>
                                <button id="splitShowSourceBtn" class="floating-btn">查看抓取网页内容</button>
                            </div>
                        </div>
                        
                        <div class="panel-content">
                            <div class="content-info">
                               
                                
                                <div class="action-buttons">
                                    <button id="splitGenerateBtn" class="generate-btn">
                             
                                        <span>生成思维导图</span>
                                    </button>
                                    <button id="splitGlobalAiBtn" class="global-ai-btn" disabled title="基于整个思维导图进行AI问答">
                                        <span>💡 全局AI问答</span>
                                    </button>
                                    <button id="splitClearBtn" class="clear-btn">
                                  
                                        <span>清空</span>
                                    </button>
                                    <button id="splitExportPngBtn" class="export-btn" disabled>
                               
                                        <span>导出PNG</span>
                                    </button>
                                    <button id="splitExportMdBtn" class="export-btn" disabled>
                                        <span>导出MarkDown</span>
                                    </button>
                                    <button id="splitExportXmindBtn" class="export-btn" disabled>
                                        <span>导出Xmind</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 思维导图显示区域 -->
                    <div class="mindmap-panel" id="splitMindmapPanel">
                        <div class="panel-header">
                        </div>
                        
                        <div class="panel-content">
                            <div id="splitMindmapContent" class="mindmap-content">
                                <div class="empty-state">
                
                                    <div class="empty-text">思维导图展示区域</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <!-- 页脚 -->
                <footer class="popup-footer">
                    <div class="footer-text">自动抓取网页内容 | 点击💡进行AI问答</div>
                </footer>
            </div>
            
            <!-- 悬浮原文窗口 -->
            <div id="splitSourceModal" class="source-modal" style="display: none;">
                <div class="source-modal-content">
                    <div class="source-modal-header">
                        <div class="source-modal-title">
                            <span class="source-icon">📄</span>
                            <span>网页内容</span>
                            <span id="sourceEditIndicator" class="edit-indicator" style="display: none;">（已编辑）</span>
                        </div>
                        <div class="source-modal-actions">
                            <button id="splitToggleEditBtn" class="source-action-btn" title="编辑内容">✏️ 编辑</button>
                            <button id="splitSaveSourceBtn" class="source-action-btn source-save-btn" style="display: none;" title="保存修改">💾 保存</button>
                            <button id="splitResetSourceBtn" class="source-action-btn source-reset-btn" style="display: none;" title="恢复原始内容">↩️ 恢复</button>
                            <button id="splitCloseSourceBtn" class="close-btn">✕</button>
                        </div>
                    </div>
                    <div class="source-modal-body">
                        <div class="source-edit-hint" id="sourceEditHint" style="display: none;">
                            💡 提示：您可以直接编辑下方内容，修改后点击"保存"按钮。生成思维导图时将使用您编辑后的内容。
                        </div>
                        <div class="source-content" id="splitSourceContent" contenteditable="false">
                            <!-- 原文内容将在这里显示 -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- AI问答弹窗 -->
            <div id="splitAiModal" class="ai-modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">
                            <span class="ai-icon">🤖</span>
                            <span>AI助手</span>
                            <span id="splitCurrentNode" class="current-node"></span>
                        </div>
                        <button id="splitCloseModal" class="close-btn">✕</button>
                    </div>
                    
                    <div id="splitChatMessages" class="chat-messages"></div>
                    
                    <div class="chat-input">
                        <input type="text" id="splitChatInput" placeholder="输入您的问题...">
                        <button id="splitSendBtn">发送</button>
                    </div>
                </div>
            </div>
        `;
        
        // 组装分屏容器
        // 确保顺序：左侧面板（原文） -> 分割线 -> 右侧面板（思维导图）
        this.splitContainer.appendChild(this.leftPanel);
        this.splitContainer.appendChild(this.divider);
        this.splitContainer.appendChild(this.rightPanel);
        
        // 确保flex布局方向正确
        this.splitContainer.style.display = 'flex';
        this.splitContainer.style.flexDirection = 'row';
        this.splitContainer.style.position = 'relative';
        this.splitContainer.style.width = '100%';
        this.splitContainer.style.minHeight = '100vh';
        
        // 先不添加到页面，等show()时再添加
        // 这样可以在移动内容后再添加，确保顺序正确
        
        // 初始隐藏
        this.splitContainer.style.display = 'none';
    }

    bindEvents() {
        // 确保分割线存在
        if (!this.divider) {
            console.error('❌ 分割线不存在，无法绑定拖拽事件');
            return;
        }
        
        // 分割线拖拽事件
        this.divider.addEventListener('mousedown', (e) => {
            e.preventDefault(); // 防止默认行为
            e.stopPropagation(); // 阻止事件冒泡
            this.isDragging = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.body.style.pointerEvents = 'none'; // 拖拽时禁用其他元素的指针事件
            
            // 添加拖拽时的视觉反馈
            this.divider.classList.add('dragging');
            
            // 禁用过渡效果，使拖拽更流畅
            if (this.leftPanel) {
                this.leftPanel.style.transition = 'none';
            }
            if (this.rightPanel) {
                this.rightPanel.style.transition = 'none';
            }
            // 在全局添加标记，CSS 根据此类禁用元素过渡/动画，减少渲染延迟
            try {
                document.documentElement.classList.add('mindmap-dragging');
                // 初始化拖拽日志计时
                this._dragFrameCount = 0;
                this._lastDragLogTime = performance.now();
            } catch (err) {
                // 忽略
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                e.preventDefault(); // 防止文本选择
                e.stopPropagation(); // 阻止事件冒泡
                
                const viewportWidth = window.innerWidth;
                const mouseX = e.clientX;
                
                // 计算右侧面板宽度（从右侧到鼠标位置）
                let rightPanelWidth = viewportWidth - mouseX;
                const dividerWidth = 8;
                rightPanelWidth = Math.max(0, rightPanelWidth - dividerWidth);
                
                // 限制宽度范围（右侧最小300px，最大70%视口宽度）
                const minRightWidth = 300;
                const maxRightWidth = viewportWidth * 0.7;
                
                // 确保在有效范围内
                rightPanelWidth = Math.max(minRightWidth, Math.min(maxRightWidth, rightPanelWidth));
                
                // 更新宽度百分比
                this.rightPanelWidth = (rightPanelWidth / viewportWidth) * 100;
                this.leftPanelWidth = 100 - this.rightPanelWidth;
                
                // 实时更新布局，不等待鼠标释放
                this.updateLayout();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.body.style.pointerEvents = ''; // 恢复指针事件
                
                // 恢复分割线的视觉样式
                if (this.divider) {
                    this.divider.classList.remove('dragging');
                }
                
                // 恢复过渡效果
                if (this.leftPanel) {
                    this.leftPanel.style.transition = '';
                }
                if (this.rightPanel) {
                    this.rightPanel.style.transition = '';
                }
                // 移除拖拽标记，恢复动画
                try {
                    document.documentElement.classList.remove('mindmap-dragging');
                    // 输出最终帧率统计
                    try {
                        const now = performance.now();
                        const elapsed = now - (this._lastDragLogTime || now);
                        if (elapsed > 0) {
                            const fps = (this._dragFrameCount / (elapsed / 1000));
                            console.log(`拖拽结束 - 平均帧率: ${fps.toFixed(1)} fps, 帧数: ${this._dragFrameCount}`);
                        }
                    } catch (e) {
                        // ignore
                    }
                } catch (err) {
                    // 忽略
                }
                
                // 保存状态
                this.saveState();
            }
        });
        
        // 防止拖拽时意外触发其他事件
        this.divider.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        // 多种方式绑定关闭按钮事件
        this.bindCloseButton();
        
        // 延迟绑定（确保DOM完全渲染）
        setTimeout(() => {
            this.bindCloseButton();
        }, 100);
        
        // 再次延迟绑定（双重保险）
        setTimeout(() => {
            this.bindCloseButton();
        }, 500);
        
        // 添加键盘快捷键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // 如果弹窗打开，先关闭弹窗
                const sourceModal = document.getElementById('splitSourceModal');
                if (sourceModal && sourceModal.style.display !== 'none') {
                    console.log('ESC键被按下，关闭原文内容弹窗');
                    this.hideSourceModal();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // 如果AI问答弹窗打开，先关闭AI问答弹窗
                const aiModal = document.getElementById('splitAIModal');
                if (aiModal && aiModal.style.display !== 'none') {
                    console.log('ESC键被按下，关闭AI问答弹窗');
                    this.hideAIModal();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // 如果没有弹窗打开，关闭分屏
                if (this.isActive) {
                    console.log('ESC键被按下，关闭分屏');
                    this.forceClose();
                }
            }
        });
        
        // 添加全局点击事件监听（点击页面其他区域关闭）
        document.addEventListener('click', (e) => {
            console.log('🔍 全局点击事件触发:', {
                target: e.target,
                targetId: e.target.id,
                targetClass: e.target.className,
                isActive: this.isActive,
                inContainer: this.splitContainer ? this.splitContainer.contains(e.target) : false
            });
            
            // 排除AI问答弹窗和其内容
            const aiModal = document.getElementById('splitAIModal');
            if (aiModal && (aiModal.contains(e.target) || e.target.closest('#splitAIModal'))) {
                console.log('✅ 点击AI问答弹窗，不关闭');
                return; // 点击AI问答弹窗时不关闭分屏
            }
            
            // 排除原文内容弹窗和其内容
            const sourceModal = document.getElementById('splitSourceModal');
            if (sourceModal && (sourceModal.contains(e.target) || e.target.closest('#splitSourceModal'))) {
                console.log('✅ 点击原文弹窗，不关闭');
                return; // 点击原文内容弹窗时不关闭分屏
            }
            
            // 排除生成思维导图按钮
            if (e.target.id === 'splitGenerateBtn' || e.target.closest('#splitGenerateBtn')) {
                console.log('✅ 点击生成思维导图按钮，不关闭');
                return; // 点击生成思维导图按钮时不关闭分屏
            }
            
            // 排除导出按钮
            if (e.target.id === 'splitExportPngBtn' || e.target.closest('#splitExportPngBtn') ||
                e.target.id === 'splitExportMdBtn' || e.target.closest('#splitExportMdBtn') ||
                e.target.id === 'splitExportXmindBtn' || e.target.closest('#splitExportXmindBtn')) {
                console.log('✅ 点击导出按钮，不关闭');
                return; // 点击导出按钮时不关闭分屏
            }
            
            // 排除导出下载链接
            if (e.target.getAttribute('data-export-link') === 'true' || 
                e.target.closest('[data-export-link="true"]')) {
                console.log('✅ 点击导出下载链接，不关闭');
                return; // 点击导出下载链接时不关闭分屏
            }
            
            // 检查是否点击了插件容器内部
            if (this.splitContainer && this.splitContainer.contains(e.target)) {
                console.log('✅ 点击插件容器内部，不关闭');
                return;
            }
            
            if (this.isActive) {
                console.log('❌ 点击页面其他区域，关闭分屏');
                this.forceClose();
            }
        });

        // 控制按钮事件（备用方式）
        this.rightPanel.addEventListener('click', (e) => {
            console.log('控制按钮点击事件:', e.target.id, e.target);
            
            if (e.target.id === 'closeBtn') {
                console.log('点击关闭按钮');
                this.close();
            }
        });

        // 生成思维导图按钮
        this.rightPanel.addEventListener('click', (e) => {
            if (e.target.id === 'splitGenerateBtn' || e.target.closest('#splitGenerateBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.generateMindmap();
            }
        });

        // 清空按钮
        this.rightPanel.addEventListener('click', (e) => {
            if (e.target.id === 'splitClearBtn' || e.target.closest('#splitClearBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.clearContent();
            }
        });
        
        // 全局AI问答按钮
        this.rightPanel.addEventListener('click', (e) => {
            if (e.target.id === 'splitGlobalAiBtn' || e.target.closest('#splitGlobalAiBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.showGlobalAiModal();
            }
        });
        
        // 缓存状态栏按钮事件
        this.rightPanel.addEventListener('click', (e) => {
            // 重新生成按钮
            if (e.target.id === 'splitRegenerateBtn' || e.target.closest('#splitRegenerateBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.handleRegenerateClick();
            }
            // 清空缓存按钮
            else if (e.target.id === 'splitClearCacheBtn' || e.target.closest('#splitClearCacheBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.handleClearCacheClick();
            }
        });

        // 导出按钮事件
        this.rightPanel.addEventListener('click', (e) => {
            if (e.target.id === 'splitExportPngBtn' || e.target.closest('#splitExportPngBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.exportToPNG();
            } else if (e.target.id === 'splitExportMdBtn' || e.target.closest('#splitExportMdBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.exportToMarkdown();
            } else if (e.target.id === 'splitExportXmindBtn' || e.target.closest('#splitExportXmindBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.exportToXmind();
            }
        });

        // AI问答相关事件
        this.rightPanel.addEventListener('click', (e) => {
            // 处理AI图标点击
            if (e.target.classList.contains('ai-hint-icon')) {
                const nodeContent = e.target.closest('.node-content');
                if (nodeContent) {
                    const text = nodeContent.getAttribute('data-text');
                    const level = parseInt(nodeContent.getAttribute('data-level'));
                    this.openAIChat(text, level);
                }
                return;
            }
            
            // 处理树形节点（.node-content）点击
            const nodeContent = e.target.closest('.node-content');
            if (nodeContent && !e.target.classList.contains('ai-hint-icon')) {
                const text = nodeContent.getAttribute('data-text');
                const level = parseInt(nodeContent.getAttribute('data-level'));
                if (text && level) {
                    console.log('点击树形节点，触发高亮:', text, level);
                    this.highlightSourceParagraph(text, level);
                }
                return;
            }
            
            // 处理分支节点（.mindmap-node）点击
            const mindmapNode = e.target.closest('.mindmap-node');
            if (mindmapNode) {
                const text = mindmapNode.getAttribute('data-node-id') || mindmapNode.textContent?.trim();
                const level = parseInt(mindmapNode.getAttribute('data-level')) || 1;
                if (text) {
                    console.log('点击分支节点，触发高亮:', text, level);
                    // 阻止默认的AI问答行为，改为高亮
                    e.stopPropagation();
                    this.highlightSourceParagraph(text, level);
                }
            }
        });

        // 原文查看按钮
        this.rightPanel.addEventListener('click', (e) => {
            if (e.target.id === 'splitShowSourceBtn') {
                this.showSourceModal();
            }
        });

        // 关闭原文弹窗 - 使用事件委托，因为弹窗可能被移到 body 下
        document.addEventListener('click', (e) => {
            // 点击关闭按钮
            if (e.target.id === 'splitCloseSourceBtn') {
                e.preventDefault();
                e.stopPropagation();
                this.hideSourceModal();
                return;
            }
            
            // 点击编辑按钮
            if (e.target.id === 'splitToggleEditBtn' || e.target.closest('#splitToggleEditBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSourceEditMode();
                return;
            }
            
            // 点击保存按钮
            if (e.target.id === 'splitSaveSourceBtn' || e.target.closest('#splitSaveSourceBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.saveEditedSource();
                return;
            }
            
            // 点击恢复按钮
            if (e.target.id === 'splitResetSourceBtn' || e.target.closest('#splitResetSourceBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.resetSourceContent();
                return;
            }
            
            // 点击弹窗背景（弹窗本身，但不是内容区域）时关闭弹窗
            const sourceModal = document.getElementById('splitSourceModal');
            if (sourceModal && sourceModal.style.display !== 'none') {
                // 如果点击的是弹窗本身（背景），而不是内容区域
                if (e.target === sourceModal || (e.target.classList.contains('source-modal') && !e.target.closest('.source-modal-content'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideSourceModal();
                    return;
                }
            }
        });

        // AI问答弹窗事件
        this.rightPanel.addEventListener('click', (e) => {
            if (e.target.id === 'splitCloseModal') {
                this.hideAIModal();
            } else if (e.target.id === 'splitSendBtn') {
                this.sendMessage();
            }
        });

        // AI问答输入框回车事件
        this.rightPanel.addEventListener('keypress', (e) => {
            if (e.target.id === 'splitChatInput' && e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 模型选择事件
        this.rightPanel.addEventListener('change', (e) => {
            if (e.target.id === 'splitModelSelect') {
                this.selectedModel = e.target.value;
            }
        });
    }

    listenForMessages() {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content script received message:', request);
            
                    switch (request.action) {
                case 'showSplitScreen':
                    console.log('📨 Content Script: 收到显示分屏请求');
                    try {
                        // 确保实例存在（使用全局函数）
                        if (!splitScreen || !splitScreen.splitContainer) {
                            console.log('⚠️ Content Script: 分屏实例不存在，重新初始化...');
                            splitScreen = getOrCreateSplitScreen();
                            if (!splitScreen) {
                                throw new Error('无法创建分屏实例');
                            }
                        }
                        
                        // 确保当前实例的容器存在
                        if (!splitScreen.splitContainer) {
                            console.log('⚠️ Content Script: 分屏容器不存在，重新创建...');
                            splitScreen.createSplitScreenLayout();
                            splitScreen.bindEvents();
                        }
                        
                        splitScreen.show();
                        console.log('✅ Content Script: 分屏显示成功');
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error('❌ Content Script: 显示分屏失败:', error);
                        console.error('错误堆栈:', error.stack);
                        
                        // 尝试重新初始化
                        try {
                            console.log('🔄 Content Script: 尝试完全重新初始化...');
                            // 清理旧容器
                            const oldContainer = document.getElementById('mindmap-split-container');
                            if (oldContainer) {
                                oldContainer.remove();
                            }
                            
                            // 创建新实例
                            splitScreen = new MindmapSplitScreen();
                            splitScreen.show();
                            console.log('✅ Content Script: 完全重新初始化后显示成功');
                            sendResponse({ success: true });
                        } catch (retryError) {
                            console.error('❌ Content Script: 完全重新初始化也失败:', retryError);
                            sendResponse({ success: false, error: error.message });
                        }
                    }
                    return true; // 保持消息通道开放
                    break;
                case 'hideSplitScreen':
                    this.hide();
                    sendResponse({ success: true });
                            break;
                case 'showMindmap':
                    this.showMindmap(request.data);
                    sendResponse({ success: true });
                            break;
                case 'renderMindmap':
                    console.log('收到思维导图数据，开始渲染');
                    this.renderMindmap(request.data.markdown);
                    this.enableExportButtons();
                    sendResponse({ success: true });
                            break;
                case 'startContentExtraction':
                    console.log('开始异步内容抓取');
                    this.startContentExtraction();
                    sendResponse({ success: true });
                            break;
                case 'contentExtractionFailed':
                    console.log('内容抓取失败');
                    this.showContentExtractionFailed();
                    sendResponse({ success: true });
                            break;
                case 'updateStatus':
                    this.updateStatus(request.message, request.type);
                    sendResponse({ success: true });
                            break;
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }

    show() {
        try {
            console.log('🚀 开始显示分屏模式...');
            
            // 智能清空逻辑：检查页面是否变化
            this._checkAndClearIfPageChanged();
            
            // 确保分屏容器存在
            if (!this.splitContainer) {
                console.warn('⚠️ 分屏容器不存在，重新创建...');
                this.createSplitScreenLayout();
            }
            
            // 确保分屏容器在DOM中，并且是第一个子元素（必须在移动内容之前）
            // 添加日志以验证分屏容器插入状态
            console.log('🚀 分屏容器插入开始...');
            if (!document.body.contains(this.splitContainer)) {
                console.warn('⚠️ 分屏容器未插入，尝试插入到 body...');
                document.body.insertBefore(this.splitContainer, document.body.firstChild);
                console.log('✅ 分屏容器已插入到 body');
            } else {
                console.log('✅ 分屏容器已存在于 body 中');
            }
            
            // 验证分屏容器样式
            const containerComputedStyle = window.getComputedStyle(this.splitContainer);
            console.log('📐 分屏容器样式检查:', {
                display: containerComputedStyle.display,
                visibility: containerComputedStyle.visibility,
                opacity: containerComputedStyle.opacity,
                position: containerComputedStyle.position,
                zIndex: containerComputedStyle.zIndex
            });
            
            // 检查左侧面板是否存在，确保它在DOM中
            if (!this.leftPanel) {
                console.warn('⚠️ 左侧面板不存在，重新创建...');
                this.leftPanel = document.getElementById('mindmap-left-panel');
                if (!this.leftPanel) {
                    console.warn('⚠️ 无法找到左侧面板，创建新的...');
                    this.leftPanel = document.createElement('div');
                    this.leftPanel.id = 'mindmap-left-panel';
                    this.leftPanel.className = 'mindmap-left-panel';
                    // 立即设置左侧面板为可见
                    this.leftPanel.style.display = 'block';
                    this.leftPanel.style.visibility = 'visible';
                    this.leftPanel.style.opacity = '1';
                    if (this.splitContainer) {
                        this.splitContainer.insertBefore(this.leftPanel, this.splitContainer.firstChild);
                    }
                }
            }
            
            // 确保左侧面板在DOM中（在分屏容器内）
            if (this.leftPanel && !this.splitContainer.contains(this.leftPanel)) {
                console.warn('⚠️ 左侧面板不在分屏容器中，添加到分屏容器...');
                this.splitContainer.insertBefore(this.leftPanel, this.splitContainer.firstChild);
            }
            
            // 强制设置左侧面板为可见
            if (this.leftPanel) {
                this.leftPanel.style.display = 'block';
                this.leftPanel.style.visibility = 'visible';
                this.leftPanel.style.opacity = '1';
                console.log('✅ 已强制设置左侧面板可见');
            }
            
            // 现在移动内容到左侧面板（此时左侧面板已经在DOM中）
            try {
                this.movePageContentToLeftPanel();
                console.log('✅ 原网页内容已移动到左侧面板');
            } catch (err) {
                console.warn('⚠️ 处理原网页内容时出错（继续显示）:', err);
                // 即使出错，也要再次尝试确保左侧面板可见
                if (this.leftPanel) {
                    this.leftPanel.style.display = 'block';
                    this.leftPanel.style.visibility = 'visible';
                    this.leftPanel.style.opacity = '1';
                }
            }
            
            // 检查右侧面板是否存在
            if (!this.rightPanel) {
                console.warn('⚠️ 右侧面板不存在，重新创建...');
                this.rightPanel = document.getElementById('mindmap-right-panel');
                if (!this.rightPanel) {
                    console.warn('⚠️ 无法找到右侧面板，需要重新初始化整个分屏');
                    this.createSplitScreenLayout();
                }
            }
            
            // 确保所有必要的元素都存在
            if (!this.splitContainer || !this.leftPanel || !this.rightPanel) {
                console.error('❌ 关键元素缺失，无法显示分屏');
                throw new Error('分屏元素初始化失败');
            }
            
            this.isActive = true;
            this.splitContainer.style.display = 'flex';
            this.splitContainer.style.flexDirection = 'row'; // 确保横向排列：左 -> 中 -> 右
            this.splitContainer.style.position = 'relative'; // 使用relative，嵌入页面中
            this.splitContainer.style.width = '100%'; // 占满宽度
            this.splitContainer.style.minHeight = '100vh'; // 最小高度为视口高度
            this.splitContainer.style.visibility = 'visible';
            this.splitContainer.style.opacity = '1';
            
            // 再次确保左侧面板可见（防止其他样式覆盖）
            setTimeout(() => {
                if (this.leftPanel) {
                    this.leftPanel.style.display = 'block';
                    this.leftPanel.style.visibility = 'visible';
                    this.leftPanel.style.opacity = '1';
                    console.log('✅ 延迟检查：左侧面板仍然可见');
                    
                    // 检查左侧面板内容
                    if (this.leftPanel.children.length === 0) {
                        console.warn('⚠️ 延迟检查：左侧面板仍然没有内容');
                        // 最后尝试：创建一个简单的内容提示
                        const placeholderDiv = document.createElement('div');
                        placeholderDiv.textContent = '网页内容区域';
                        placeholderDiv.style.padding = '20px';
                        placeholderDiv.style.fontSize = '16px';
                        placeholderDiv.style.color = '#666';
                        placeholderDiv.style.textAlign = 'center';
                        this.leftPanel.appendChild(placeholderDiv);
                    }
                }
            }, 500);
            
            // 验证左右面板的顺序和内容
            const children = Array.from(this.splitContainer.children);
            const leftIndex = children.indexOf(this.leftPanel);
            const rightIndex = children.indexOf(this.rightPanel);
            const leftHasContent = this.leftPanel.innerHTML.trim().length > 0;
            const rightHasContent = this.rightPanel.innerHTML.trim().length > 0;
            
            console.log('📐 面板顺序和内容检查:', {
                '左侧面板索引': leftIndex,
                '右侧面板索引': rightIndex,
                '左侧面板有内容': leftHasContent,
                '右侧面板有内容': rightHasContent,
                '左侧面板ID': this.leftPanel.id,
                '右侧面板ID': this.rightPanel.id,
                '子元素顺序': children.map((el, idx) => `${idx}: ${el.id || el.className}`)
            });
            
            // 确保左侧面板可见，内容会自动换行（为右侧固定面板留出空间）
            if (this.leftPanel) {
                const viewportWidth = window.innerWidth;
                const rightPanelWidth = viewportWidth * (this.rightPanelWidth / 100);
                const dividerWidth = 8;
                const leftPanelWidth = viewportWidth - rightPanelWidth - dividerWidth;
                this.leftPanel.style.setProperty('position', 'relative', 'important');
                this.leftPanel.style.setProperty('width', `${leftPanelWidth}px`, 'important');
                this.leftPanel.style.setProperty('min-width', '300px', 'important');
                this.leftPanel.style.setProperty('max-width', `${viewportWidth * 0.8}px`, 'important');
                this.leftPanel.style.setProperty('margin-right', `${rightPanelWidth + dividerWidth}px`, 'important');
                this.leftPanel.style.setProperty('overflow', 'visible', 'important'); // 允许内容完整显示
                this.leftPanel.style.setProperty('background-color', 'transparent', 'important');
                this.leftPanel.style.setProperty('word-wrap', 'break-word', 'important'); // 允许文本换行
                this.leftPanel.style.setProperty('word-break', 'break-word', 'important');
                this.leftPanel.style.setProperty('overflow-wrap', 'break-word', 'important');
                this.leftPanel.style.setProperty('display', 'block', 'important'); // 确保显示
                this.leftPanel.style.setProperty('visibility', 'visible', 'important'); // 确保可见
                this.leftPanel.style.setProperty('opacity', '1', 'important'); // 确保不透明
            }
            
            // 确保右侧面板在右侧可见（固定定位，不随页面滚动）
            if (this.rightPanel) {
                const viewportWidth = window.innerWidth;
                const rightPanelWidth = viewportWidth * (this.rightPanelWidth / 100);
                // 使用setProperty强制设置样式，确保优先级最高
                this.rightPanel.style.setProperty('display', 'flex', 'important');
                this.rightPanel.style.setProperty('visibility', 'visible', 'important');
                this.rightPanel.style.setProperty('opacity', '1', 'important');
                this.rightPanel.style.setProperty('position', 'fixed', 'important'); // 固定定位
                this.rightPanel.style.setProperty('top', '0', 'important');
                this.rightPanel.style.setProperty('right', '0', 'important');
                this.rightPanel.style.setProperty('width', `${rightPanelWidth}px`, 'important');
                this.rightPanel.style.setProperty('min-width', '300px', 'important');
                this.rightPanel.style.setProperty('max-width', `${viewportWidth * 0.7}px`, 'important');
                this.rightPanel.style.setProperty('background-color', '#f8f9fa', 'important');
                this.rightPanel.style.setProperty('z-index', '2147483646', 'important');
                this.rightPanel.style.setProperty('height', '100vh', 'important'); // 固定高度为视口高度
                this.rightPanel.style.setProperty('max-height', '100vh', 'important'); // 限制最大高度
                this.rightPanel.style.setProperty('box-shadow', '-2px 0 8px rgba(0, 0, 0, 0.1)', 'important'); // 添加左侧阴影
                
                // 确保思维导图内容区域可见并可滚动
                const mindmapContent = this.rightPanel.querySelector('#splitMindmapContent');
                if (mindmapContent) {
                    mindmapContent.style.setProperty('display', 'block', 'important');
                    mindmapContent.style.setProperty('visibility', 'visible', 'important');
                    mindmapContent.style.setProperty('opacity', '1', 'important');
                    mindmapContent.style.setProperty('flex', '1', 'important'); // 占据剩余空间
                    mindmapContent.style.setProperty('overflow-y', 'auto', 'important'); // 允许垂直滚动
                    mindmapContent.style.setProperty('overflow-x', 'hidden', 'important');
                    mindmapContent.style.setProperty('min-height', '0', 'important'); // 允许flex收缩
                    mindmapContent.style.setProperty('max-height', '100%', 'important'); // 限制最大高度
                }
                
                // 获取计算后的样式
                const computedStyle = window.getComputedStyle(this.rightPanel);
                const rect = this.rightPanel.getBoundingClientRect();
                
                console.log('✅ 右侧面板已显示', {
                    '样式宽度': this.rightPanel.style.width,
                    '计算宽度': computedStyle.width,
                    '实际宽度': rect.width,
                    '显示': computedStyle.display,
                    '可见性': computedStyle.visibility,
                    '透明度': computedStyle.opacity,
                    'z-index': computedStyle.zIndex,
                    '位置': { left: rect.left, top: rect.top },
                    '在DOM中': document.body.contains(this.rightPanel) || this.splitContainer.contains(this.rightPanel)
                });
            } else {
                console.error('❌ 右侧面板不存在！');
            }
            
            // 检查分屏容器状态
            const containerComputed = window.getComputedStyle(this.splitContainer);
            const containerRect = this.splitContainer.getBoundingClientRect();
            
            console.log('✅ 分屏容器状态', {
                '显示': containerComputed.display,
                '可见性': containerComputed.visibility,
                '透明度': containerComputed.opacity,
                '宽度': containerComputed.width,
                '高度': containerComputed.height,
                '位置': { left: containerRect.left, top: containerRect.top },
                '在DOM中': document.body.contains(this.splitContainer)
            });
            
            // 更新布局（内容已经在movePageContentToLeftPanel中移动了）
            try {
                this.updateLayout();
                console.log('✅ 布局已更新');
            } catch (err) {
                console.warn('⚠️ 更新布局时出错（继续显示）:', err);
            }
            
            // 保存状态
            try {
                this.saveState();
                console.log('✅ 状态已保存');
            } catch (err) {
                console.warn('⚠️ 保存状态时出错（继续显示）:', err);
            }
            
            // 显示初始状态，等待用户点击"生成思维导图"按钮
            try {
                this.showInitialState();
                console.log('✅ 初始状态已显示');
            } catch (err) {
                console.warn('⚠️ 显示初始状态时出错（继续显示）:', err);
            }
            
            // 检查是否有缓存的思维导图需要显示
            if (this.mindmapData && this.cachedPageUrl === window.location.href) {
                console.log('📌 检测到缓存的思维导图，显示状态栏');
                this._showCacheStatusBar();
                this._startCacheTimeUpdater();
            }
            
            console.log('🎉 分屏模式显示完成');
        } catch (error) {
            console.error('❌ 显示分屏模式时出错:', error);
            console.error('错误堆栈:', error.stack);
            
            // 尝试最基本的显示
            try {
                if (this.splitContainer) {
                    this.splitContainer.style.display = 'flex';
                    this.splitContainer.style.visibility = 'visible';
                    this.isActive = true;
                    console.log('✅ 已使用基本模式显示分屏');
                }
            } catch (fallbackError) {
                console.error('❌ 基本显示也失败:', fallbackError);
            }
        }
    }

    /**
     * 检查页面是否变化，如果变化则清空缓存
     * @private
     */
    _checkAndClearIfPageChanged() {
        const currentUrl = window.location.href;
        const currentTitle = document.title;
        const currentTime = Date.now();
        
        // 检查是否需要清空
        let shouldClear = false;
        let clearReason = '';
        
        // 情况1：URL变化
        if (this.cachedPageUrl && this.cachedPageUrl !== currentUrl) {
            shouldClear = true;
            clearReason = 'URL变化';
        }
        
        // 情况2：标题变化（可能是页面内容更新）
        if (this.cachedPageTitle && this.cachedPageTitle !== currentTitle) {
            shouldClear = true;
            clearReason = clearReason ? clearReason + ' + 标题变化' : '标题变化';
        }
        
        // 情况3：缓存超时（30分钟）
        if (this.mindmapGeneratedTime && (currentTime - this.mindmapGeneratedTime > this.cacheTimeout)) {
            shouldClear = true;
            clearReason = clearReason ? clearReason + ' + 缓存超时' : '缓存超时';
        }
        
        if (shouldClear) {
            console.log(`🗑️ 检测到${clearReason}，清空缓存的思维导图`);
            this._clearCachedMindmap();
        } else if (this.cachedPageUrl) {
            console.log('✅ 页面未变化，保留缓存的思维导图');
        }
    }
    
    /**
     * 清空缓存的思维导图
     * @private
     */
    _clearCachedMindmap() {
        // 清空思维导图数据
        this.mindmapData = null;
        this.cachedPageUrl = null;
        this.cachedPageTitle = null;
        this.mindmapGeneratedTime = null;
        
        // 清空思维导图显示区域
        const mindmapContent = this.rightPanel ? this.rightPanel.querySelector('#splitMindmapContent') : null;
        if (mindmapContent) {
            mindmapContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-text">思维导图展示区域</div>
                </div>
            `;
        }
        
        // 禁用导出按钮
        this.disableExportButtons();
        
        // 重置状态
        this.updateStatus('', 'info');
        
        // 隐藏缓存状态栏（如果存在）
        this._hideCacheStatusBar();
        
        console.log('✅ 缓存已清空');
    }

    hide() {
        console.log('开始隐藏分屏...');
        
        // 清除高亮
        this.clearSourceHighlight();
        
        this.isActive = false;
        this.splitContainer.style.display = 'none';
        console.log('分屏容器已隐藏');
        
        // 恢复原网页内容
        this.restorePageContent();
        console.log('原网页内容已恢复');
        
        // 保存状态
        this.saveState();
        console.log('状态已保存');
        
        console.log('分屏隐藏完成');
    }

    // 绑定关闭按钮事件的方法
    bindCloseButton() {
        console.log('尝试绑定关闭按钮事件...');
        
        // 方法1：直接查找关闭按钮
        const closeBtn = this.rightPanel.querySelector('#closeBtn');
        if (closeBtn) {
            console.log('找到关闭按钮，绑定事件');
            
            // 移除旧的事件监听器
            if (this.handleCloseClick) {
                closeBtn.removeEventListener('click', this.handleCloseClick);
            }
            
            // 创建新的事件处理函数
            this.handleCloseClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('关闭按钮被点击 - 方法1');
                this.forceClose();
            };
            
            closeBtn.addEventListener('click', this.handleCloseClick);
            console.log('关闭按钮事件绑定成功');
            return true;
        }
        
        // 方法2：通过类名查找
        const controlBtn = this.rightPanel.querySelector('.control-btn');
        if (controlBtn) {
            console.log('通过类名找到控制按钮，绑定事件');
            
            if (this.handleControlClick) {
                controlBtn.removeEventListener('click', this.handleControlClick);
            }
            
            this.handleControlClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('控制按钮被点击 - 方法2');
                this.forceClose();
            };
            
            controlBtn.addEventListener('click', this.handleControlClick);
            console.log('控制按钮事件绑定成功');
            return true;
        }
        
        // 方法3：事件委托
        console.log('使用事件委托绑定关闭事件');
        if (this.handleDelegateClick) {
            this.rightPanel.removeEventListener('click', this.handleDelegateClick);
        }
        
        this.handleDelegateClick = (e) => {
            if (e.target && (e.target.id === 'closeBtn' || e.target.classList.contains('control-btn'))) {
                e.preventDefault();
                e.stopPropagation();
                console.log('通过事件委托关闭按钮被点击 - 方法3');
                this.forceClose();
            }
        };
        
        this.rightPanel.addEventListener('click', this.handleDelegateClick);
        console.log('事件委托绑定成功');
        return true;
    }

    // 强制关闭方法
    forceClose() {
        console.log('执行强制关闭...');
        
        try {
            // 立即隐藏分屏容器
            if (this.splitContainer) {
                console.log('找到分屏容器，开始强制隐藏');
                
                // 多重隐藏策略
                this.splitContainer.style.display = 'none';
                this.splitContainer.style.visibility = 'hidden';
                this.splitContainer.style.opacity = '0';
                this.splitContainer.style.position = 'absolute';
                this.splitContainer.style.left = '-9999px';
                this.splitContainer.style.top = '-9999px';
                this.splitContainer.style.zIndex = '-9999';
                
                console.log('分屏容器已强制隐藏');
                
                // 立即从DOM中移除
                if (this.splitContainer.parentNode) {
                    console.log('从DOM中移除分屏容器');
                    this.splitContainer.parentNode.removeChild(this.splitContainer);
                    console.log('分屏容器已从DOM中移除');
                }
            } else {
                console.log('分屏容器不存在');
            }
            
            // 设置状态
            this.isActive = false;
            console.log('状态已设置为非激活');
            
            // 恢复原网页内容
            console.log('开始恢复原网页内容...');
            this.restorePageContent();
            console.log('原网页内容已恢复');
            
            // 清理状态
            this.clearSavedState();
            console.log('保存的状态已清除');
            
            // 强制清理所有相关元素
            this.cleanupAllElements();
            console.log('所有相关元素已清理');
            
            // 通知popup分屏已关闭
            chrome.runtime.sendMessage({
                action: 'splitScreenClosed'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('发送关闭消息失败:', chrome.runtime.lastError);
                } else {
                    console.log('关闭消息发送成功:', response);
                }
            });
            
            console.log('强制关闭完成');
            
        } catch (error) {
            console.error('强制关闭时出错:', error);
            
            // 最后的保险措施
            try {
                console.log('执行最后的保险措施...');
                document.body.innerHTML = this.originalBodyContent || '';
                console.log('使用原始内容恢复页面');
            } catch (restoreError) {
                console.error('恢复页面内容失败:', restoreError);
                // 如果还是失败，使用终极关闭方法
                console.log('尝试终极关闭方法...');
                this.ultimateClose();
            }
        }
    }

    // 清理所有相关元素
    cleanupAllElements() {
        console.log('开始清理所有相关元素...');
        
        try {
            // 查找并移除所有可能的分屏相关元素
            const elementsToRemove = [
                '#mindmap-split-container',
                '.mindmap-split-container',
                '#splitContainer',
                '.split-container'
            ];
            
            elementsToRemove.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el && el.parentNode) {
                        console.log(`移除元素: ${selector}`);
                        el.parentNode.removeChild(el);
                    }
                });
            });
            
            // 清理可能残留的样式
            const styleElements = document.querySelectorAll('style[data-mindmap]');
            styleElements.forEach(el => {
                if (el && el.parentNode) {
                    console.log('移除思维导图相关样式');
                    el.parentNode.removeChild(el);
                }
            });
            
            // 重置body样式
            document.body.style.overflow = '';
            document.body.style.margin = '';
            document.body.style.padding = '';
            document.body.style.width = '';
            document.body.style.height = '';
            
            console.log('所有相关元素清理完成');
            
        } catch (error) {
            console.error('清理元素时出错:', error);
        }
    }

    // 终极关闭方法 - 最后的保险
    ultimateClose() {
        console.log('执行终极关闭方法...');
        
        try {
            // 立即清理所有可能的分屏元素
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.id && (el.id.includes('mindmap') || el.id.includes('split'))) {
                    console.log(`终极清理元素: ${el.id}`);
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                }
            });
            
            // 强制恢复页面
            if (this.originalBodyContent) {
                document.body.innerHTML = this.originalBodyContent;
                console.log('使用终极方法恢复页面');
            }
            
            // 清理所有状态
            this.isActive = false;
            this.splitContainer = null;
            this.rightPanel = null;
            this.leftPanel = null;
            
            // 清理localStorage
            localStorage.removeItem('mindmapSplitScreenState');
            
            console.log('终极关闭完成');
            
        } catch (error) {
            console.error('终极关闭时出错:', error);
        }
    }

    close() {
        console.log('开始关闭分屏模式...');
        
        try {
            // 确保分屏容器存在
            if (this.splitContainer) {
                console.log('找到分屏容器，开始关闭');
                
                // 立即隐藏分屏
                this.splitContainer.style.display = 'none';
                this.isActive = false;
                console.log('分屏容器已隐藏');
                
                // 恢复原网页内容
                this.restorePageContent();
                console.log('原网页内容已恢复');
                
                // 清除保存的状态
                this.clearSavedState();
                console.log('保存的状态已清除');
                
                // 通知popup分屏已关闭
                chrome.runtime.sendMessage({
                    action: 'splitScreenClosed'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('发送关闭消息失败:', chrome.runtime.lastError);
                    } else {
                        console.log('关闭消息发送成功:', response);
                    }
                });
                
                console.log('分屏关闭完成');
            } else {
                console.error('分屏容器不存在，无法关闭');
                    }
                } catch (error) {
            console.error('关闭分屏时出错:', error);
        }
    }

    /**
 * 将页面内容移动到左侧面板（重写版本）
 * 功能：设置分屏布局，将原网页内容显示在左侧，思维导图显示在右侧
 */
movePageContentToLeftPanel() {
    try {
        console.log('🔄 开始设置分屏布局...');
        
        // 1. 确保必要的元素存在
        this._ensurePanelsExist();
        
        // 2. 设置面板样式
        this._setupPanelStyles();
        
        // 3. 保存原始内容（只保存一次）
        this._saveOriginalContent();
        
        // 4. 加载内容到左侧面板
        this._loadContentToLeftPanel();
        
        // 5. 验证和修复
        this._verifyAndFix();
        
        console.log('✅ 分屏布局设置完成');
        
    } catch (error) {
        console.error('❌ 设置分屏布局时出错:', error);
        this._handleError(error);
    }
}

/**
 * 确保分屏容器和面板存在
 * @private
 */
_ensurePanelsExist() {
    // 确保分屏容器存在
    if (!this.splitContainer) {
        console.log('创建分屏容器...');
        this.createSplitScreenLayout();
    }
    
    // 确保左侧面板存在
    if (!this.leftPanel) {
        this.leftPanel = document.getElementById('mindmap-left-panel');
        if (!this.leftPanel) {
            console.log('创建左侧面板...');
            this.leftPanel = document.createElement('div');
            this.leftPanel.id = 'mindmap-left-panel';
            this.leftPanel.className = 'mindmap-left-panel';
            this.splitContainer.appendChild(this.leftPanel);
        }
    }
    
    // 确保左侧面板在分屏容器内
    if (this.splitContainer && !this.splitContainer.contains(this.leftPanel)) {
        console.log('将左侧面板添加到分屏容器...');
        this.splitContainer.insertBefore(this.leftPanel, this.splitContainer.firstChild);
    }
}

/**
 * 设置面板样式
 * @private
 */
_setupPanelStyles() {
    console.log('设置面板样式...');
    
    // 设置分屏容器样式
    const containerStyles = {
        'display': 'flex',
        'flex-direction': 'row',
        'position': 'relative',
        'width': '100%',
        'min-height': '100vh',
        'visibility': 'visible',
        'opacity': '1'
    };
    
    Object.entries(containerStyles).forEach(([prop, value]) => {
        this.splitContainer.style.setProperty(prop, value, 'important');
    });
    
    // 设置左侧面板样式
    const leftPanelStyles = {
        'display': 'block',
        'visibility': 'visible',
        'opacity': '1',
        'position': 'relative',
        'width': '60%',
        'min-width': '300px',
        'height': 'auto',
        'overflow': 'visible',
        'background-color': 'transparent',
        'z-index': '2147483645'
    };
    
    Object.entries(leftPanelStyles).forEach(([prop, value]) => {
        this.leftPanel.style.setProperty(prop, value, 'important');
    });
    
    // 设置右侧面板样式
    if (this.rightPanel) {
        const viewportWidth = window.innerWidth;
        const rightPanelWidth = Math.max(viewportWidth * 0.4, 300);
        
        const rightPanelStyles = {
            'position': 'fixed',
            'top': '0',
            'right': '0',
            'width': `${rightPanelWidth}px`,
            'height': '100vh',
            'background-color': '#f8f9fa',
            'z-index': '2147483646',
            'box-shadow': '-2px 0 8px rgba(0, 0, 0, 0.1)',
            'display': 'flex',
            'visibility': 'visible',
            'opacity': '1'
        };
        
        Object.entries(rightPanelStyles).forEach(([prop, value]) => {
            this.rightPanel.style.setProperty(prop, value, 'important');
        });
    }
}

/**
 * 保存原始页面内容的引用（不克隆，直接移动）
 * @private
 */
_saveOriginalContent() {
    // 只保存一次
    if (!this.originalBodyContent) {
        console.log('保存原始页面内容引用...');
        // 保存原始元素的引用（不是克隆），以便之后移动和恢复
        this.originalBodyContent = Array.from(document.body.children).filter(
            child => child.id !== 'mindmap-split-container' && 
                     !child.classList.contains('mindmap-split-container') &&
                     child.tagName !== 'SCRIPT' && 
                     child.tagName !== 'STYLE' &&
                     child.tagName !== 'LINK'
        );
        console.log(`✅ 已保存 ${this.originalBodyContent.length} 个原始元素引用`);
    }
}

/**
 * 加载内容到左侧面板（直接移动原始元素，不克隆）
 * @private
 */
_loadContentToLeftPanel() {
    // 检查是否需要加载内容
    const needsContent = this.leftPanel.children.length === 0 || 
                        !this.leftPanel.dataset.contentLoaded;
    
    if (!needsContent) {
        console.log('左侧面板已有内容，跳过加载');
        return;
    }
    
    console.log('直接移动原始内容到左侧面板...');
    
    // 直接移动原始元素到左侧面板（不克隆）
    if (this.originalBodyContent && this.originalBodyContent.length > 0) {
        console.log(`准备移动 ${this.originalBodyContent.length} 个原始元素...`);
        
        // 清空左侧面板
        this.leftPanel.innerHTML = '';
        
        // 直接移动原始元素（appendChild 会自动从原位置移除）
        this.originalBodyContent.forEach(element => {
            try {
                // 确保元素可见
                this._makeElementVisible(element);
                // 直接移动元素到左侧面板
                this.leftPanel.appendChild(element);
            } catch (e) {
                console.warn('移动元素时出错:', e);
            }
        });
        
        console.log(`✅ 已移动 ${this.originalBodyContent.length} 个原始元素到左侧面板`);
    } else {
        // 如果没有保存的内容，添加占位符
        console.warn('没有可用内容，添加占位符...');
        this.leftPanel.innerHTML = '';
        this._addPlaceholder();
    }
    
    // 标记内容已加载
    this.leftPanel.dataset.contentLoaded = 'true';
}

/**
 * 清理元素，移除可能的跟踪脚本
 * @private
 */
_sanitizeElement(element) {
    try {
        this.sanitizeClonedNode(element);
    } catch (e) {
        console.warn('清理元素时出错:', e);
    }
}

/**
 * 确保元素可见（保留原始 display 样式）
 * @private
 */
_makeElementVisible(element) {
    // 只在元素被隐藏时恢复可见性，不强制设置 display: block
    // 这样可以保留原始的 display 样式（如 flex、inline 等）
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display === 'none') {
        element.style.removeProperty('display');
    }
    if (computedStyle.visibility === 'hidden') {
        element.style.visibility = 'visible';
    }
    if (computedStyle.opacity === '0') {
        element.style.opacity = '1';
    }
}

/**
 * 添加占位符
 * @private
 */
_addPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.innerHTML = `
        <div style="
            padding: 40px 20px;
            text-align: center;
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            margin: 20px;
        ">
            <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
            <div style="font-size: 18px; color: #495057; margin-bottom: 8px;">
                网页内容区域
            </div>
            <div style="font-size: 14px; color: #6c757d;">
                原始页面内容将显示在这里
            </div>
        </div>
    `;
    this.leftPanel.appendChild(placeholder);
}

/**
 * 验证和修复显示问题
 * @private
 */
_verifyAndFix() {
    console.log('验证左侧面板状态...');
    
    // 立即验证
    const childCount = this.leftPanel.children.length;
    console.log(`左侧面板子元素数量: ${childCount}`);
    
    // 确保所有子元素可见
    Array.from(this.leftPanel.children).forEach(child => {
        this._makeElementVisible(child);
    });
    
    // 延迟验证（300ms后）
    setTimeout(() => {
        const computedStyle = window.getComputedStyle(this.leftPanel);
        const isVisible = computedStyle.display !== 'none' && 
                         computedStyle.visibility !== 'hidden' && 
                         computedStyle.opacity !== '0';
        
        console.log('延迟验证结果:', {
            '显示': computedStyle.display,
            '可见性': computedStyle.visibility,
            '透明度': computedStyle.opacity,
            '子元素': this.leftPanel.children.length
        });
        
        if (!isVisible) {
            console.warn('⚠️ 左侧面板不可见，执行修复...');
            this._makeElementVisible(this.leftPanel);
        }
        
        if (this.leftPanel.children.length === 0) {
            console.warn('⚠️ 左侧面板无内容，添加占位符...');
            this._addPlaceholder();
        }
    }, 300);
}

/**
 * 错误处理
 * @private
 */
_handleError(error) {
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    
    try {
        if (this.leftPanel) {
            this.leftPanel.innerHTML = `
                <div style="
                    padding: 40px 20px;
                    text-align: center;
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    border-radius: 8px;
                    margin: 20px;
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <div style="font-size: 18px; color: #856404; margin-bottom: 8px;">
                        内容加载失败
                    </div>
                    <div style="font-size: 14px; color: #856404;">
                        请刷新页面重试
                    </div>
                </div>
            `;
            this._makeElementVisible(this.leftPanel);
        }
    } catch (recoverError) {
        console.error('错误恢复失败:', recoverError);
    }
}



    restorePageContent() {
        console.log('开始恢复原网页内容...');
        
        // 将左侧面板中的原始元素移回 body
        if (this.leftPanel) {
            const leftPanelChildren = Array.from(this.leftPanel.children);
            if (leftPanelChildren.length > 0) {
                // 获取分屏容器的位置，将元素插入到分屏容器之前
                const splitContainer = document.getElementById('mindmap-split-container');
                
                leftPanelChildren.forEach(child => {
                    try {
                        if (splitContainer && splitContainer.parentNode) {
                            // 将元素插入到分屏容器之前
                            splitContainer.parentNode.insertBefore(child, splitContainer);
                        } else {
                            // 如果分屏容器不存在，直接添加到 body
                            document.body.appendChild(child);
                        }
                    } catch (e) {
                        console.warn('恢复元素时出错:', e);
                    }
                });
                console.log(`✅ 已将 ${leftPanelChildren.length} 个元素移回 body`);
            }
        }
        
        // 恢复body样式
        document.body.style.removeProperty('display');
        document.body.style.removeProperty('flex-direction');
        document.body.style.removeProperty('margin');
        document.body.style.removeProperty('padding');
        document.body.style.removeProperty('width');
        document.body.style.removeProperty('min-height');
        
        // 重置左侧面板
        if (this.leftPanel) {
            this.leftPanel.dataset.setup = 'false';
            this.leftPanel.dataset.contentLoaded = 'false';
            this.leftPanel.innerHTML = '';
            this.leftPanel.style.removeProperty('position');
            this.leftPanel.style.removeProperty('width');
            this.leftPanel.style.removeProperty('min-width');
            this.leftPanel.style.removeProperty('max-width');
            this.leftPanel.style.removeProperty('overflow');
            this.leftPanel.style.removeProperty('background-color');
            this.leftPanel.style.removeProperty('word-wrap');
            this.leftPanel.style.removeProperty('word-break');
            this.leftPanel.style.removeProperty('overflow-wrap');
        }
        
        // 重置右侧面板样式（但保留内容）
        if (this.rightPanel) {
            this.rightPanel.style.removeProperty('position');
            this.rightPanel.style.removeProperty('width');
            this.rightPanel.style.removeProperty('min-width');
            this.rightPanel.style.removeProperty('max-width');
        }
        
        // 清除保存的内容引用
        this.originalBodyContent = null;
        this.originalBodyStyles = null;
        
        console.log('✅ 原网页内容恢复完成');
    }

    updateLayout() {
        // 使用 requestAnimationFrame 确保流畅的布局更新
        if (this.updateLayoutFrame) {
            cancelAnimationFrame(this.updateLayoutFrame);
        }
        
        this.updateLayoutFrame = requestAnimationFrame(() => {
            // 轻量拖拽日志：在拖拽期间统计帧数并每500ms输出一次
            if (this.isDragging) {
                try {
                    this._dragFrameCount = (this._dragFrameCount || 0) + 1;
                    const now = performance.now();
                    const last = this._lastDragLogTime || now;
                    const elapsed = now - last;
                    if (elapsed >= 500) {
                        const fps = this._dragFrameCount / (elapsed / 1000);
                        console.log(`拖拽中 - 帧率: ${fps.toFixed(1)} fps, 帧数: ${this._dragFrameCount}`);
                        this._dragFrameCount = 0;
                        this._lastDragLogTime = now;
                    }
                } catch (e) {
                    // ignore logging errors
                }
            }
            if (this.leftPanel) {
                // 更新左侧面板宽度，内容会自动换行（为右侧固定面板留出空间）
                const viewportWidth = window.innerWidth;
                const rightPanelWidth = viewportWidth * (this.rightPanelWidth / 100);
                const dividerWidth = 8;
                const leftPanelWidth = viewportWidth - rightPanelWidth - dividerWidth;
                this.leftPanel.style.setProperty('width', `${leftPanelWidth}px`, 'important');
                this.leftPanel.style.setProperty('min-width', '300px', 'important');
                this.leftPanel.style.setProperty('max-width', `${viewportWidth * 0.8}px`, 'important');
                this.leftPanel.style.setProperty('position', 'relative', 'important');
                this.leftPanel.style.setProperty('margin-right', `${rightPanelWidth + dividerWidth}px`, 'important');
                // 确保文本自动换行，内容完整显示
                this.leftPanel.style.setProperty('word-wrap', 'break-word', 'important');
                this.leftPanel.style.setProperty('word-break', 'break-word', 'important');
                this.leftPanel.style.setProperty('overflow-wrap', 'break-word', 'important');
                this.leftPanel.style.setProperty('overflow', 'visible', 'important'); // 允许内容完整显示
                this.leftPanel.style.setProperty('box-sizing', 'border-box', 'important'); // 确保宽度计算正确
                
                // 优化：避免对每个子元素逐条写样式（会导致大量重排）
                // 只设置左侧容器的必要样式，子元素的自适应交由 CSS 规则处理
                // （content.css 已定义 `.mindmap-left-panel > *`、图片、表格等适配规则）
                // 如果未来需要对单独元素做特殊处理，可在非拖拽场景下异步执行。
            }
            if (this.rightPanel) {
                // 强制设置右侧面板样式，确保在右侧可见（固定定位）
                const viewportWidth = window.innerWidth;
                const rightPanelWidth = viewportWidth * (this.rightPanelWidth / 100);
                this.rightPanel.style.setProperty('position', 'fixed', 'important');
                this.rightPanel.style.setProperty('top', '0', 'important');
                this.rightPanel.style.setProperty('right', '0', 'important');
                this.rightPanel.style.setProperty('width', `${rightPanelWidth}px`, 'important');
                this.rightPanel.style.setProperty('display', 'flex', 'important');
                this.rightPanel.style.setProperty('visibility', 'visible', 'important');
                this.rightPanel.style.setProperty('opacity', '1', 'important');
                this.rightPanel.style.setProperty('min-width', '300px', 'important');
                this.rightPanel.style.setProperty('max-width', `${viewportWidth * 0.7}px`, 'important');
                this.rightPanel.style.setProperty('height', '100vh', 'important');
                this.rightPanel.style.setProperty('max-height', '100vh', 'important');
                this.rightPanel.style.setProperty('z-index', '2147483646', 'important');
                this.rightPanel.style.setProperty('box-sizing', 'border-box', 'important'); // 确保宽度计算正确
                
                // 确保思维导图内容区域可见并可滚动
                const mindmapContent = this.rightPanel.querySelector('#splitMindmapContent');
                if (mindmapContent) {
                    mindmapContent.style.setProperty('display', 'block', 'important');
                    mindmapContent.style.setProperty('visibility', 'visible', 'important');
                    mindmapContent.style.setProperty('opacity', '1', 'important');
                    mindmapContent.style.setProperty('flex', '1', 'important'); // 占据剩余空间
                    mindmapContent.style.setProperty('overflow-y', 'auto', 'important'); // 允许垂直滚动
                    mindmapContent.style.setProperty('overflow-x', 'hidden', 'important');
                    mindmapContent.style.setProperty('min-height', '0', 'important'); // 允许flex收缩
                    mindmapContent.style.setProperty('max-height', '100%', 'important'); // 限制最大高度
                }
            }
            
            // 确保分割线在中间位置（固定定位）
            if (this.divider) {
                const viewportWidth = window.innerWidth;
                const rightPanelWidth = viewportWidth * (this.rightPanelWidth / 100);
                const dividerWidth = 8;
                this.divider.style.setProperty('position', 'fixed', 'important');
                this.divider.style.setProperty('top', '0', 'important');
                this.divider.style.setProperty('right', `${rightPanelWidth}px`, 'important');
                this.divider.style.setProperty('width', `${dividerWidth}px`, 'important');
                this.divider.style.setProperty('height', '100vh', 'important');
                this.divider.style.setProperty('z-index', '2147483647', 'important');
            }
        });
    }

    showMindmap(data) {
        this.mindmapData = data;
        
        // 保存缓存信息
        this.cachedPageUrl = window.location.href;
        this.cachedPageTitle = document.title;
        this.mindmapGeneratedTime = Date.now();
        
        // 保存状态到localStorage
        this.saveState();
        
        // 更新状态
        this.updateStatus('思维导图生成成功！', 'success');
        
        // 渲染思维导图
        this.renderMindmap(data.markdown);
        
        // 显示思维导图内容
        this.rightPanel.querySelector('.mindmap-status').style.display = 'none';
        this.rightPanel.querySelector('.mindmap-display').style.display = 'flex';
        
        // 启用导出按钮
        this.enableExportButtons();
        
        // 隐藏缓存状态栏（新生成的不显示缓存提示）
        this._hideCacheStatusBar();
    }

    // 用户点击生成思维导图时调用此方法（确保UI不被隐藏）
    async generateMindmap() {
        console.log('开始生成思维导图（来自分屏）');

        // 确保分屏显示
        try {
            this.show();
        } catch (err) {
            console.warn('尝试显示分屏时出错（继续）:', err);
        }

        // 按钮状态处理
        const genBtn = this.rightPanel ? this.rightPanel.querySelector('#splitGenerateBtn') : null;
        if (genBtn) {
            try {
                genBtn.disabled = true;
                // 保留内部结构，如果有span则替换文本
                const span = genBtn.querySelector('span');
                if (span) span.textContent = '生成中...'; else genBtn.textContent = '生成中...';
            } catch (e) {
                console.warn('更新生成按钮状态失败:', e);
            }
        }

        this.updateStatus('正在生成思维导图，请稍候...', 'loading');

        // 尝试获取页面内容（优先使用用户编辑后的内容）
        let pageContent = '';
        try {
            if (this.editedPageContent) {
                // 使用用户编辑后的内容
                pageContent = this.editedPageContent;
                console.log('📝 使用用户编辑后的内容生成思维导图');
            } else if (typeof this.getPageContent === 'function') {
                pageContent = await this.getPageContent();
            } else {
                pageContent = document.body ? document.body.innerText : '';
            }
        } catch (err) {
            console.error('获取页面内容失败，使用备用提取方法:', err);
            pageContent = document.body ? document.body.innerText : '';
        }

        // 如果内容非常短，提示用户
        if (!pageContent || pageContent.trim().length < 10) {
            console.warn('页面内容不足，可能无法生成有效思维导图');
            this.updateStatus('页面内容不足，无法生成思维导图', 'error');
            if (genBtn) {
                const span = genBtn.querySelector('span');
                if (span) span.textContent = '生成思维导图'; else genBtn.textContent = '生成思维导图';
                genBtn.disabled = false;
            }
            return;
        }

        // 向background发送生成请求
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'generateMindmap',
                    content: pageContent,
                    provider: this.provider || 'deepseek',
                    model: this.model || 'deepseek-chat'
                }, (resp) => resolve(resp));
            });

            if (!response) {
                throw new Error('未收到background响应');
            }

            if (response.success) {
                console.log('生成完成，收到数据，准备显示');
                // 显示思维导图
                try {
                    this.showMindmap(response.data);
                } catch (err) {
                    console.error('showMindmap 处理失败:', err);
                    this.updateStatus('生成完成，但展示失败', 'error');
                }
            } else {
                console.error('生成失败:', response.error || response);
                this.updateStatus(response.error || '生成失败', 'error');
            }
        } catch (error) {
            console.error('生成思维导图时出错:', error);
            this.updateStatus('生成思维导图失败，请重试', 'error');
        } finally {
            if (genBtn) {
                try {
                    const span = genBtn.querySelector('span');
                    if (span) span.textContent = '生成思维导图'; else genBtn.textContent = '生成思维导图';
                    genBtn.disabled = false;
                } catch (e) {
                    console.warn('恢复生成按钮状态失败:', e);
                }
            }
        }
    }

    renderMindmap(markdown) {
        const treeContainer = this.rightPanel.querySelector('#splitMindmapContent');
        if (!treeContainer) {
            console.error('❌ 思维导图容器不存在！');
            return;
        }
        
        // 确保容器可见
        treeContainer.style.setProperty('display', 'block', 'important');
        treeContainer.style.setProperty('visibility', 'visible', 'important');
        treeContainer.style.setProperty('opacity', '1', 'important');
        treeContainer.style.setProperty('flex', '1', 'important'); // 占据剩余空间
        treeContainer.style.setProperty('overflow-y', 'auto', 'important'); // 允许垂直滚动
        treeContainer.style.setProperty('overflow-x', 'hidden', 'important');
        treeContainer.style.setProperty('min-height', '0', 'important'); // 允许flex收缩
        treeContainer.style.setProperty('max-height', '100%', 'important'); // 限制最大高度
        
        treeContainer.innerHTML = '';
        
        if (!markdown || markdown.trim() === '') {
            treeContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text">思维导图内容为空，请重新生成</div>
                </div>
            `;
            // 如果思维导图为空，禁用导出按钮
            this.disableExportButtons();
            return;
        }

        const lines = markdown.split('\n').filter(line => line.trim());
        console.log('开始渲染思维导图，内容长度:', markdown.length);
        console.log('解析到的行数:', lines.length);

        if (lines.length === 0) {
            treeContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text">思维导图内容为空，请重新生成</div>
                </div>
            `;
            // 如果思维导图为空，禁用导出按钮
            this.disableExportButtons();
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

        const tree = buildTree(nodes);

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
            nodeContent.title = ''; // 阻止显示继承的title
            
            // 如果是AI生成的节点，添加特殊样式类
            if (node.isAI) {
                nodeContent.classList.add('ai-generated');
                treeNode.classList.add('ai-generated-node');
                nodeCircle.classList.add('ai-generated');
            }
            
            const textSpan = document.createElement('span');
            textSpan.className = 'node-text';
            
            // 检查是否包含专有名词格式，使用不同的渲染方式
            if (this.hasTermFormat(node.text)) {
                textSpan.innerHTML = this.parseNodeText(node.text);
            } else {
                textSpan.textContent = node.text;
            }
            
            // 如果是AI生成的节点，添加AI标识图标
            if (node.isAI) {
                const aiLabel = document.createElement('span');
                aiLabel.className = 'ai-label';
                aiLabel.textContent = '🤖';
                aiLabel.title = 'AI生成的内容';
                textSpan.insertBefore(aiLabel, textSpan.firstChild);
            }
            
            // 🔧 添加节点操作按钮容器
            const nodeActions = document.createElement('div');
            nodeActions.className = 'node-actions';
            nodeActions.title = ''; // 阻止继承父元素的title
            
            // 添加子节点按钮
            const addChildBtn = document.createElement('span');
            addChildBtn.className = 'node-action-btn add-child-btn';
            addChildBtn.textContent = '+';
            addChildBtn.title = '添加子节点';
            addChildBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addChildNode(treeNode, node.level + 1);
            });
            
            // 添加同级节点按钮
            const addSiblingBtn = document.createElement('span');
            addSiblingBtn.className = 'node-action-btn add-sibling-btn';
            addSiblingBtn.textContent = '↵';
            addSiblingBtn.title = '添加同级节点';
            addSiblingBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addSiblingNode(treeNode, node.level);
            });
            
            // 删除节点按钮
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'node-action-btn delete-node-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = '删除节点';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteNode(treeNode);
            });
            
            nodeActions.appendChild(addChildBtn);
            nodeActions.appendChild(addSiblingBtn);
            nodeActions.appendChild(deleteBtn);
            
            const aiIcon = document.createElement('span');
            aiIcon.className = 'ai-hint-icon';
            aiIcon.textContent = '💡';
            aiIcon.title = '点击向AI提问';
            aiIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openAIChat(node.text, node.level);
            });
            
            // 🔧 添加双击编辑功能
            nodeContent.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startNodeEdit(nodeContent, textSpan, node, treeNode);
            });
            
            // 🔧 添加节点点击事件：点击高亮左侧原文对应段落
            nodeContent.addEventListener('click', (e) => {
                // 如果点击的是AI图标，不处理高亮
                if (e.target.classList.contains('ai-hint-icon')) {
                    return;
                }
                e.stopPropagation();
                console.log('📍 点击树形节点，触发高亮:', node.text, '层级:', node.level);
                this.highlightSourceParagraph(node.text, node.level);
            });
            
            // 添加鼠标悬停效果
            nodeContent.style.cursor = 'pointer';
            
            nodeContent.appendChild(textSpan);
            nodeContent.appendChild(nodeActions);
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

        const treeContainerDiv = document.createElement('div');
        treeContainerDiv.className = 'mindmap-tree';
        
        tree.forEach(node => {
            renderNode(node, treeContainerDiv);
        });
        
        // 添加新内容到容器
        treeContainer.appendChild(treeContainerDiv);
        
        console.log('✅ 思维导图渲染完成，节点数:', treeContainerDiv.children.length);
        
        // 如果思维导图有内容，启用导出按钮
        if (tree && tree.length > 0) {
            this.enableExportButtons();
        }
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
        
        // 存储节点数据，用于高亮匹配
        nodeDiv.setAttribute('data-text', node.text);
        nodeDiv.setAttribute('data-level', level);
        nodeDiv.setAttribute('data-node-id', node.text);
        
        // 添加悬停效果
        nodeDiv.addEventListener('mouseenter', () => {
            nodeDiv.style.transform = 'scale(1.05)';
            nodeDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        });
        
        nodeDiv.addEventListener('mouseleave', () => {
            nodeDiv.style.transform = 'scale(1)';
            nodeDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        });
        
        // 添加点击事件：普通点击高亮原文，Ctrl/右键打开AI问答
        nodeDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 如果按住Ctrl键或Meta键，打开AI问答
            if (e.ctrlKey || e.metaKey) {
                this.openAIChat(node.text, level);
            } else {
                // 🔧 普通点击，直接高亮左侧原文对应段落
                console.log('📍 点击节点，触发高亮:', node.text, '层级:', level);
                this.highlightSourceParagraph(node.text, level);
            }
        });
        
        // 添加右键菜单：打开AI问答
        nodeDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
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

    // ==================== 节点编辑功能 ====================
    
    // 保存当前状态到历史栈（用于撤销）
    saveToHistory() {
        const markdown = this.getCurrentMarkdown();
        if (markdown) {
            // 避免重复保存相同状态
            if (this.editHistory.length > 0 && this.editHistory[this.editHistory.length - 1] === markdown) {
                return;
            }
            this.editHistory.push(markdown);
            if (this.editHistory.length > this.maxHistoryLength) {
                this.editHistory.shift();
            }
            console.log('📝 状态已保存到历史栈，当前历史长度:', this.editHistory.length);
        }
    }
    
    // 撤销操作
    undoEdit() {
        if (this.editHistory.length > 0) {
            const previousState = this.editHistory.pop();
            console.log('↩️ 执行撤销操作，恢复到历史状态');
            
            // 重新渲染思维导图
            this.renderMindmap(previousState);
            
            // 更新mindmapData
            if (this.mindmapData) {
                this.mindmapData.markdown = previousState;
            }
            
            // 保存状态
            this.saveState();
            
            // 显示提示
            this.showSuccessToast('已撤销操作');
        } else {
            this.showSuccessToast('没有可撤销的操作');
        }
    }
    
    // 获取当前思维导图的markdown
    getCurrentMarkdown() {
        const treeContainer = this.rightPanel?.querySelector('#splitMindmapContent');
        if (!treeContainer) return null;
        
        const nodes = treeContainer.querySelectorAll('.tree-node');
        if (nodes.length === 0) return null;
        
        const lines = [];
        nodes.forEach(node => {
            const nodeContent = node.querySelector(':scope > .tree-node-row > .node-content');
            if (nodeContent) {
                const level = parseInt(nodeContent.getAttribute('data-level') || '1');
                const textSpan = nodeContent.querySelector('.node-text');
                if (textSpan) {
                    // 获取纯文本（去除AI标识）
                    let text = '';
                    textSpan.childNodes.forEach(child => {
                        if (child.nodeType === Node.TEXT_NODE) {
                            text += child.textContent;
                        } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('ai-label')) {
                            text += child.textContent;
                        }
                    });
                    text = text.trim();
                    
                    // 检查是否有样式
                    const styledText = this.getStyledText(textSpan);
                    
                    const prefix = '#'.repeat(level);
                    const isAI = nodeContent.classList.contains('ai-generated');
                    lines.push(`${prefix} ${isAI ? '[AI] ' : ''}${styledText || text}`);
                }
            }
        });
        
        return lines.join('\n');
    }
    
    // 获取带样式标记的文本
    getStyledText(textSpan) {
        let result = '';
        textSpan.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                result += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.classList.contains('ai-label')) {
                    return; // 跳过AI标识
                }
                let text = child.textContent;
                const styles = [];
                
                if (child.style.fontWeight === 'bold' || child.tagName === 'B' || child.tagName === 'STRONG') {
                    styles.push('bold');
                }
                if (child.style.fontStyle === 'italic' || child.tagName === 'I' || child.tagName === 'EM') {
                    styles.push('italic');
                }
                if (child.style.color && child.style.color !== 'inherit') {
                    styles.push(`color:${child.style.color}`);
                }
                
                if (styles.length > 0) {
                    result += `{{${styles.join(',')}|${text}}}`;
                } else {
                    result += text;
                }
            }
        });
        return result;
    }
    
    // 开始编辑节点
    startNodeEdit(nodeContent, textSpan, nodeData, treeNode) {
        // 如果已经在编辑其他节点，先结束之前的编辑
        if (this.currentEditingNode && this.currentEditingNode !== nodeContent) {
            this.finishNodeEdit();
        }
        
        // 保存当前状态到历史栈
        this.saveToHistory();
        
        this.currentEditingNode = nodeContent;
        this.isEditMode = true;
        nodeContent.classList.add('editing');
        
        // 创建可编辑容器
        const editContainer = document.createElement('div');
        editContainer.className = 'node-edit-container';
        editContainer.contentEditable = 'true';
        
        // 复制当前文本内容（保留样式）
        const currentText = textSpan.innerHTML;
        // 移除AI标识
        const cleanText = currentText.replace(/<span class="ai-label"[^>]*>.*?<\/span>/g, '');
        editContainer.innerHTML = cleanText || textSpan.textContent;
        
        // 隐藏原始文本
        textSpan.style.display = 'none';
        
        // 插入编辑容器
        textSpan.parentNode.insertBefore(editContainer, textSpan);
        
        // 显示编辑工具栏
        this.showEditToolbar(editContainer, nodeContent);
        
        // 聚焦并选中全部文本
        editContainer.focus();
        const range = document.createRange();
        range.selectNodeContents(editContainer);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 监听编辑事件
        editContainer.addEventListener('blur', (e) => {
            // 如果点击的是工具栏，不结束编辑
            if (this.editToolbar && this.editToolbar.contains(e.relatedTarget)) {
                return;
            }
            setTimeout(() => {
                if (!this.editToolbar || !this.editToolbar.contains(document.activeElement)) {
                    this.finishNodeEdit();
                }
            }, 100);
        });
        
        editContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.finishNodeEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelNodeEdit();
            }
        });
        
        // 存储引用以便后续使用
        nodeContent._editContainer = editContainer;
        nodeContent._textSpan = textSpan;
        nodeContent._nodeData = nodeData;
        nodeContent._treeNode = treeNode;
    }
    
    // 显示编辑工具栏
    showEditToolbar(editContainer, nodeContent) {
        // 移除现有工具栏
        if (this.editToolbar) {
            this.editToolbar.remove();
        }
        
        // 创建工具栏
        this.editToolbar = document.createElement('div');
        this.editToolbar.className = 'node-edit-toolbar';
        this.editToolbar.innerHTML = `
            <button class="toolbar-btn" data-action="bold" title="加粗 (Ctrl+B)">
                <strong>B</strong>
            </button>
            <button class="toolbar-btn" data-action="italic" title="倾斜 (Ctrl+I)">
                <em>I</em>
            </button>
            <div class="toolbar-separator"></div>
            <div class="color-picker-wrapper">
                <button class="toolbar-btn color-btn" title="文字颜色">
                    <span class="color-icon">A</span>
                    <span class="color-indicator" style="background: #000;"></span>
                </button>
                <div class="color-palette">
                    <div class="color-option" data-color="#000000" style="background: #000000;"></div>
                    <div class="color-option" data-color="#e53935" style="background: #e53935;"></div>
                    <div class="color-option" data-color="#fb8c00" style="background: #fb8c00;"></div>
                    <div class="color-option" data-color="#fdd835" style="background: #fdd835;"></div>
                    <div class="color-option" data-color="#43a047" style="background: #43a047;"></div>
                    <div class="color-option" data-color="#1e88e5" style="background: #1e88e5;"></div>
                    <div class="color-option" data-color="#8e24aa" style="background: #8e24aa;"></div>
                    <div class="color-option" data-color="#ffffff" style="background: #ffffff; border: 1px solid #ccc;"></div>
                </div>
            </div>
            <div class="toolbar-separator"></div>
            <button class="toolbar-btn confirm-btn" data-action="confirm" title="确认">
                ✓
            </button>
            <button class="toolbar-btn cancel-btn" data-action="cancel" title="取消">
                ✕
            </button>
        `;
        
        // 定位工具栏
        const rect = nodeContent.getBoundingClientRect();
        this.editToolbar.style.position = 'fixed';
        this.editToolbar.style.top = `${rect.top - 40}px`;
        this.editToolbar.style.left = `${rect.left}px`;
        this.editToolbar.style.zIndex = '100000';
        
        document.body.appendChild(this.editToolbar);
        
        // 绑定工具栏事件
        this.bindToolbarEvents(editContainer);
    }
    
    // 绑定工具栏事件
    bindToolbarEvents(editContainer) {
        if (!this.editToolbar) return;
        
        // 加粗按钮
        this.editToolbar.querySelector('[data-action="bold"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.execCommand('bold', false, null);
            editContainer.focus();
        });
        
        // 倾斜按钮
        this.editToolbar.querySelector('[data-action="italic"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.execCommand('italic', false, null);
            editContainer.focus();
        });
        
        // 颜色按钮
        const colorBtn = this.editToolbar.querySelector('.color-btn');
        const colorPalette = this.editToolbar.querySelector('.color-palette');
        
        colorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            colorPalette.classList.toggle('show');
        });
        
        // 颜色选项
        this.editToolbar.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const color = option.getAttribute('data-color');
                document.execCommand('foreColor', false, color);
                this.editToolbar.querySelector('.color-indicator').style.background = color;
                colorPalette.classList.remove('show');
                editContainer.focus();
            });
        });
        
        // 确认按钮
        this.editToolbar.querySelector('[data-action="confirm"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.finishNodeEdit();
        });
        
        // 取消按钮
        this.editToolbar.querySelector('[data-action="cancel"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cancelNodeEdit();
        });
        
        // 阻止工具栏点击冒泡
        this.editToolbar.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }
    
    // 完成节点编辑
    finishNodeEdit() {
        if (!this.currentEditingNode) return;
        
        const nodeContent = this.currentEditingNode;
        const editContainer = nodeContent._editContainer;
        const textSpan = nodeContent._textSpan;
        
        if (editContainer && textSpan) {
            // 获取编辑后的内容
            const newContent = editContainer.innerHTML.trim();
            
            if (newContent) {
                // 更新文本内容
                const aiLabel = textSpan.querySelector('.ai-label');
                textSpan.innerHTML = newContent;
                
                // 如果有AI标识，重新添加
                if (aiLabel) {
                    textSpan.insertBefore(aiLabel.cloneNode(true), textSpan.firstChild);
                }
                
                // 更新节点data-text属性
                const plainText = editContainer.textContent.trim();
                nodeContent.setAttribute('data-text', plainText);
            }
            
            // 移除编辑容器
            editContainer.remove();
            textSpan.style.display = '';
        }
        
        // 移除工具栏
        if (this.editToolbar) {
            this.editToolbar.remove();
            this.editToolbar = null;
        }
        
        // 清理状态
        nodeContent.classList.remove('editing');
        nodeContent._editContainer = null;
        nodeContent._textSpan = null;
        this.currentEditingNode = null;
        this.isEditMode = false;
        
        // 更新并保存状态
        this.updateMindmapData();
        this.saveState();
        
        console.log('✅ 节点编辑完成');
    }
    
    // 取消节点编辑
    cancelNodeEdit() {
        if (!this.currentEditingNode) return;
        
        const nodeContent = this.currentEditingNode;
        const editContainer = nodeContent._editContainer;
        const textSpan = nodeContent._textSpan;
        
        if (editContainer && textSpan) {
            // 移除编辑容器，恢复原始文本
            editContainer.remove();
            textSpan.style.display = '';
        }
        
        // 移除工具栏
        if (this.editToolbar) {
            this.editToolbar.remove();
            this.editToolbar = null;
        }
        
        // 清理状态
        nodeContent.classList.remove('editing');
        nodeContent._editContainer = null;
        nodeContent._textSpan = null;
        this.currentEditingNode = null;
        this.isEditMode = false;
        
        // 从历史栈中恢复（如果有）
        if (this.editHistory.length > 0) {
            this.editHistory.pop();
        }
        
        console.log('❌ 节点编辑已取消');
    }
    
    // 添加子节点
    addChildNode(parentTreeNode, childLevel) {
        // 保存当前状态到历史栈
        this.saveToHistory();
        
        // 查找或创建子节点容器
        let childrenContainer = parentTreeNode.querySelector(':scope > .tree-node-children');
        if (!childrenContainer) {
            childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-node-children';
            parentTreeNode.appendChild(childrenContainer);
            
            // 更新父节点圆圈样式
            const nodeCircle = parentTreeNode.querySelector(':scope > .tree-node-row > .node-circle');
            if (nodeCircle) {
                nodeCircle.classList.add('has-children');
                nodeCircle.title = '点击展开/折叠';
                nodeCircle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    parentTreeNode.classList.toggle('collapsed');
                    nodeCircle.classList.toggle('collapsed');
                });
            }
        }
        
        // 创建新节点
        const newNode = this.createEditableTreeNode('新节点', childLevel, false);
        childrenContainer.appendChild(newNode);
        
        // 更新并保存
        this.updateMindmapData();
        this.saveState();
        
        // 自动开始编辑新节点
        const nodeContent = newNode.querySelector('.node-content');
        const textSpan = newNode.querySelector('.node-text');
        if (nodeContent && textSpan) {
            setTimeout(() => {
                this.startNodeEdit(nodeContent, textSpan, { text: '新节点', level: childLevel }, newNode);
            }, 100);
        }
        
        console.log('➕ 添加子节点，层级:', childLevel);
    }
    
    // 添加同级节点
    addSiblingNode(currentTreeNode, level) {
        // 保存当前状态到历史栈
        this.saveToHistory();
        
        // 创建新节点
        const newNode = this.createEditableTreeNode('新节点', level, false);
        
        // 在当前节点后插入
        currentTreeNode.parentNode.insertBefore(newNode, currentTreeNode.nextSibling);
        
        // 更新并保存
        this.updateMindmapData();
        this.saveState();
        
        // 自动开始编辑新节点
        const nodeContent = newNode.querySelector('.node-content');
        const textSpan = newNode.querySelector('.node-text');
        if (nodeContent && textSpan) {
            setTimeout(() => {
                this.startNodeEdit(nodeContent, textSpan, { text: '新节点', level: level }, newNode);
            }, 100);
        }
        
        console.log('➕ 添加同级节点，层级:', level);
    }
    
    // 删除节点
    deleteNode(treeNode) {
        // 确认删除
        const nodeText = treeNode.querySelector('.node-text')?.textContent || '该节点';
        if (!confirm(`确定要删除"${nodeText.substring(0, 20)}${nodeText.length > 20 ? '...' : ''}"及其所有子节点吗？`)) {
            return;
        }
        
        // 保存当前状态到历史栈
        this.saveToHistory();
        
        // 移除节点
        treeNode.remove();
        
        // 更新并保存
        this.updateMindmapData();
        this.saveState();
        
        this.showSuccessToast('节点已删除');
        console.log('🗑️ 节点已删除');
    }
    
    // 创建可编辑的树节点
    createEditableTreeNode(text, level, isAI = false) {
        const treeNode = document.createElement('div');
        treeNode.className = 'tree-node';
        treeNode.setAttribute('data-level', level);
        
        const nodeRow = document.createElement('div');
        nodeRow.className = 'tree-node-row';
        
        const nodeCircle = document.createElement('div');
        nodeCircle.className = `node-circle level-${level}`;
        
        const nodeContent = document.createElement('div');
        nodeContent.className = `node-content level-${level}`;
        nodeContent.setAttribute('data-level', level);
        nodeContent.setAttribute('data-text', text);
        nodeContent.title = ''; // 阻止显示继承的title
        
        if (isAI) {
            nodeContent.classList.add('ai-generated');
            treeNode.classList.add('ai-generated-node');
            nodeCircle.classList.add('ai-generated');
        }
        
        const textSpan = document.createElement('span');
        textSpan.className = 'node-text';
        
        // 检查是否包含专有名词格式，使用不同的渲染方式
        if (this.hasTermFormat(text)) {
            textSpan.innerHTML = this.parseNodeText(text);
        } else {
            textSpan.textContent = text;
        }
        
        if (isAI) {
            const aiLabel = document.createElement('span');
            aiLabel.className = 'ai-label';
            aiLabel.textContent = '🤖';
            aiLabel.title = 'AI生成的内容';
            textSpan.insertBefore(aiLabel, textSpan.firstChild);
        }
        
        // 节点操作按钮
        const nodeActions = document.createElement('div');
        nodeActions.className = 'node-actions';
        nodeActions.title = ''; // 阻止继承父元素的title
        
        const addChildBtn = document.createElement('span');
        addChildBtn.className = 'node-action-btn add-child-btn';
        addChildBtn.textContent = '+';
        addChildBtn.title = '添加子节点';
        addChildBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addChildNode(treeNode, level + 1);
        });
        
        const addSiblingBtn = document.createElement('span');
        addSiblingBtn.className = 'node-action-btn add-sibling-btn';
        addSiblingBtn.textContent = '↵';
        addSiblingBtn.title = '添加同级节点';
        addSiblingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addSiblingNode(treeNode, level);
        });
        
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'node-action-btn delete-node-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = '删除节点';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteNode(treeNode);
        });
        
        nodeActions.appendChild(addChildBtn);
        nodeActions.appendChild(addSiblingBtn);
        nodeActions.appendChild(deleteBtn);
        
        const aiIcon = document.createElement('span');
        aiIcon.className = 'ai-hint-icon';
        aiIcon.textContent = '💡';
        aiIcon.title = '点击向AI提问';
        aiIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAIChat(text, level);
        });
        
        // 双击编辑
        nodeContent.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.startNodeEdit(nodeContent, textSpan, { text, level }, treeNode);
        });
        
        // 点击高亮
        nodeContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('ai-hint-icon')) return;
            e.stopPropagation();
            this.highlightSourceParagraph(text, level);
        });
        
        nodeContent.style.cursor = 'pointer';
        
        nodeContent.appendChild(textSpan);
        nodeContent.appendChild(nodeActions);
        nodeContent.appendChild(aiIcon);
        
        nodeRow.appendChild(nodeCircle);
        nodeRow.appendChild(nodeContent);
        treeNode.appendChild(nodeRow);
        
        return treeNode;
    }
    
    // 更新思维导图数据
    updateMindmapData() {
        const markdown = this.getCurrentMarkdown();
        if (markdown && this.mindmapData) {
            this.mindmapData.markdown = markdown;
            console.log('📊 思维导图数据已更新');
        }
    }
    
    // 展开所有节点
    expandAllNodes() {
        const treeContainer = this.rightPanel?.querySelector('#splitMindmapContent');
        if (!treeContainer) return;
        
        // 移除所有节点的折叠状态
        const collapsedNodes = treeContainer.querySelectorAll('.tree-node.collapsed');
        collapsedNodes.forEach(node => {
            node.classList.remove('collapsed');
        });
        
        // 移除所有圆点的折叠状态
        const collapsedCircles = treeContainer.querySelectorAll('.node-circle.collapsed');
        collapsedCircles.forEach(circle => {
            circle.classList.remove('collapsed');
        });
        
        console.log('📂 已展开所有节点');
    }
    
    // 折叠所有节点
    collapseAllNodes() {
        const treeContainer = this.rightPanel?.querySelector('#splitMindmapContent');
        if (!treeContainer) return;
        
        // 找到所有有子节点的节点并折叠
        const nodesWithChildren = treeContainer.querySelectorAll('.tree-node:has(.tree-node-children)');
        nodesWithChildren.forEach(node => {
            node.classList.add('collapsed');
            const circle = node.querySelector(':scope > .tree-node-row > .node-circle');
            if (circle) {
                circle.classList.add('collapsed');
            }
        });
        
        console.log('📁 已折叠所有节点');
    }
    
    // 绑定全局键盘事件（用于撤销）
    bindEditKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z 撤销
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                // 只在思维导图区域内有效
                if (this.isActive && this.rightPanel && this.rightPanel.contains(document.activeElement)) {
                    e.preventDefault();
                    this.undoEdit();
                }
            }
        });
    }

    // ==================== 节点编辑功能结束 ====================

    updateStatus(message, type = 'info') {
        const statusEl = this.rightPanel.querySelector('#splitMindmapStatus');
        const statusText = statusEl.querySelector('.status-text');
        const statusIcon = statusEl.querySelector('.status-icon');
        
        statusText.textContent = message;
        
        // 根据类型设置图标和样式
        switch (type) {
            case 'success':
                statusIcon.textContent = '✅';
                statusEl.className = 'mindmap-status success';
                break;
            case 'error':
                statusIcon.textContent = '❌';
                statusEl.className = 'mindmap-status error';
                break;
            case 'loading':
                statusIcon.textContent = '⏳';
                statusEl.className = 'mindmap-status loading';
                break;
            default:
                statusIcon.textContent = '🧠';
                statusEl.className = 'mindmap-status';
        }
    }

    enableExportButtons() {
        const exportPngBtn = this.rightPanel.querySelector('#splitExportPngBtn');
        const exportMdBtn = this.rightPanel.querySelector('#splitExportMdBtn');
        const exportXmindBtn = this.rightPanel.querySelector('#splitExportXmindBtn');
        const globalAiBtn = this.rightPanel.querySelector('#splitGlobalAiBtn');
        
        if (exportPngBtn) {
            exportPngBtn.disabled = false;
        }
        if (exportMdBtn) {
            exportMdBtn.disabled = false;
        }
        if (exportXmindBtn) {
            exportXmindBtn.disabled = false;
        }
        // 启用全局AI问答按钮
        if (globalAiBtn) {
            globalAiBtn.disabled = false;
        }
    }
    
    disableExportButtons() {
        const exportPngBtn = this.rightPanel.querySelector('#splitExportPngBtn');
        const exportMdBtn = this.rightPanel.querySelector('#splitExportMdBtn');
        const exportXmindBtn = this.rightPanel.querySelector('#splitExportXmindBtn');
        const globalAiBtn = this.rightPanel.querySelector('#splitGlobalAiBtn');
        
        if (exportPngBtn) {
            exportPngBtn.disabled = true;
        }
        if (exportMdBtn) {
            exportMdBtn.disabled = true;
        }
        if (exportXmindBtn) {
            exportXmindBtn.disabled = true;
        }
        // 禁用全局AI问答按钮
        if (globalAiBtn) {
            globalAiBtn.disabled = true;
        }
    }

    async exportToPNG() {
        if (!this.mindmapData) {
            this.updateStatus('请先生成思维导图！', 'error');
            return;
        }

        this.updateStatus('正在导出PNG...', 'loading');
        this.rightPanel.querySelector('#splitExportPngBtn').disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/export-png`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    markdown: this.mindmapData.markdown,
                    title: '思维导图'
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const filename = '思维导图.png';
                a.download = filename;
                a.style.display = 'none';
                a.setAttribute('data-export-link', 'true'); // 添加标识
                // 阻止下载链接的点击事件冒泡
                a.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                document.body.appendChild(a);
                a.click();
                // 延迟移除，确保下载开始
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                // 显示导出成功通知
                this.showExportNotification({
                    format: 'PNG',
                    filename: filename,
                    filesize: this.formatFileSize(blob.size)
                });
                
                this.updateStatus('思维导图已导出为PNG！', 'success');
            } else {
                throw new Error('导出失败');
            }
        } catch (error) {
            console.error('PNG导出失败:', error);
            this.updateStatus('导出PNG失败，请稍后重试', 'error');
        } finally {
            this.rightPanel.querySelector('#splitExportPngBtn').disabled = false;
        }
    }

    // 导出为MarkDown
    exportToMarkdown() {
        if (!this.mindmapData || !this.mindmapData.markdown) {
            this.updateStatus('请先生成思维导图！', 'error');
            return;
        }

        try {
            const markdown = this.mindmapData.markdown;
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const filename = '思维导图.md';
            a.download = filename;
            a.style.display = 'none';
            a.setAttribute('data-export-link', 'true'); // 添加标识
            // 阻止下载链接的点击事件冒泡
            a.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.body.appendChild(a);
            a.click();
            // 延迟移除，确保下载开始
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            // 显示导出成功通知
            this.showExportNotification({
                format: 'Markdown',
                filename: filename,
                filesize: this.formatFileSize(blob.size)
            });
            
            this.updateStatus('思维导图已导出为MarkDown文件！', 'success');
        } catch (error) {
            console.error('MarkDown导出失败:', error);
            this.updateStatus('导出MarkDown失败，请稍后重试', 'error');
        }
    }

    // 导出为Xmind
    async exportToXmind() {
        if (!this.mindmapData || !this.mindmapData.markdown) {
            this.updateStatus('请先生成思维导图！', 'error');
            return;
        }

        this.updateStatus('正在导出Xmind...', 'loading');
        this.rightPanel.querySelector('#splitExportXmindBtn').disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/export-xmind`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    markdown: this.mindmapData.markdown,
                    title: '思维导图'
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const filename = '思维导图.xmind';
                a.download = filename;
                a.style.display = 'none';
                a.setAttribute('data-export-link', 'true'); // 添加标识
                // 阻止下载链接的点击事件冒泡
                a.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                document.body.appendChild(a);
                a.click();
                // 延迟移除，确保下载开始
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                // 显示导出成功通知
                this.showExportNotification({
                    format: 'Xmind',
                    filename: filename,
                    filesize: this.formatFileSize(blob.size)
                });
                
                this.updateStatus('思维导图已导出为Xmind文件！', 'success');
            } else {
                const errorData = await response.json().catch(() => ({ error: '导出失败' }));
                throw new Error(errorData.error || '导出失败');
            }
        } catch (error) {
            console.error('Xmind导出失败:', error);
            this.updateStatus('导出Xmind失败，请稍后重试', 'error');
        } finally {
            this.rightPanel.querySelector('#splitExportXmindBtn').disabled = false;
        }
    }

    openAIChat(nodeText, nodeLevel) {
        this.currentNode = nodeText;
        this.currentNodeLevel = nodeLevel;
        this.chatMessages = [];
        this.uploadedFiles = []; // 存储已上传的文件
        
        // 如果存在侧边栏，先关闭它
        const existingSidebar = document.getElementById('splitAISidebar');
        const existingDivider = document.getElementById('sidebarDivider');
        if (existingSidebar || existingDivider) {
            // 关闭侧边栏
            if (existingSidebar) {
                existingSidebar.remove();
            }
            if (existingDivider) {
                existingDivider.remove();
            }
            // 恢复思维导图内容容器的布局
            const contentWrapper = this.rightPanel.querySelector('.content-wrapper-with-sidebar');
            if (contentWrapper) {
                const popupMain = contentWrapper.querySelector('.popup-main');
                if (popupMain) {
                    // 将popup-main移回原位置
                    const mindmapFullInterface = this.rightPanel.querySelector('.mindmap-full-interface');
                    if (mindmapFullInterface) {
                        contentWrapper.remove();
                        mindmapFullInterface.insertBefore(popupMain, mindmapFullInterface.querySelector('.popup-footer'));
                    }
                } else {
                    contentWrapper.remove();
                }
            }
        }
        
        // 创建AI问答弹窗
        this.createAIModal();
    }

    createAIModal() {
        // 移除已存在的弹窗
        const existingModal = document.getElementById('splitAIModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'splitAIModal';
        modal.className = 'ai-modal';
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.innerHTML = `
            <div class="modal-header">
                <div class="modal-title">
                    <span class="ai-icon">🤖</span>
                    <span>AI助手</span>
                    <span id="splitCurrentNode" class="current-node"></span>
                </div>
                <div class="modal-header-actions">
                    <button id="splitSwitchToGlobal" class="switch-btn" title="切换到全局问答，基于整个思维导图进行AI问答">💡 全局问答</button>
                    <button id="splitSwitchToSidebar" class="switch-btn" title="切换为侧边栏">切换为侧边栏</button>
                    <button id="splitCloseModal" class="close-btn">✕</button>
                </div>
            </div>
            
            <div id="splitChatMessages" class="chat-messages"></div>
            
            <div class="chat-input-container">
                <div id="splitFilePreview" class="file-preview"></div>
                <div class="chat-input">
                    <button id="splitFileUploadBtn" class="file-upload-btn" title="上传图片或文件">📎</button>
                    <input type="file" id="splitFileInput" accept="image/*,application/pdf,.doc,.docx,.txt,.md" multiple style="display: none;">
                    <textarea id="splitChatInput" placeholder="输入您的问题..." rows="1"></textarea>
                    <button id="splitSendBtn">发送</button>
                    <button id="splitAddToNodeBtn" title="把AI回答内容整理为该节点的子节点">添加到子节点</button>
                </div>
            </div>
        `;
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 保存 this 引用，确保在事件处理中能正确访问
        const self = this;
        
        // 绑定"切换到全局问答"按钮事件
        const switchToGlobalBtn = modal.querySelector('#splitSwitchToGlobal');
        if (switchToGlobalBtn) {
            switchToGlobalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('切换到全局问答按钮被点击');
                
                // 检查是否有思维导图数据
                if (!this.mindmapData || !this.mindmapData.markdown) {
                    alert('请先生成思维导图');
                    return;
                }
                
                // 关闭当前节点问答弹窗
                modal.remove();
                
                // 打开全局问答弹窗
                this.showGlobalAiModal();
            });
        }
        
        // 绑定"切换为侧边栏"按钮事件
        const switchToSidebarBtn = modal.querySelector('#splitSwitchToSidebar');
        if (switchToSidebarBtn) {
            switchToSidebarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('切换为侧边栏按钮被点击');
                this.switchToSidebar();
            });
        }
        
        // 绑定关闭按钮事件
        const closeBtn = modal.querySelector('#splitCloseModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('关闭按钮被点击');
                modal.remove();
                document.body.style.overflow = '';
            });
        }

        // 绑定发送按钮事件 - 使用箭头函数确保 this 正确
        const sendBtn = modal.querySelector('#splitSendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ 发送按钮被点击');
                try {
                    this.sendMessage();
                } catch (error) {
                    console.error('❌ 发送消息时出错:', error);
                }
            });
            
            // 确保按钮可以点击
            sendBtn.style.setProperty('pointer-events', 'auto', 'important');
            sendBtn.style.setProperty('cursor', 'pointer', 'important');
            sendBtn.setAttribute('type', 'button');
        } else {
            console.error('❌ 找不到发送按钮 #splitSendBtn');
        }

        // 绑定"添加到子节点"按钮事件
        const addToNodeBtn = modal.querySelector('#splitAddToNodeBtn');
        if (addToNodeBtn) {
            // 设置提示文字
            addToNodeBtn.setAttribute('title', '把AI回答内容整理为该节点的子节点');
            
            addToNodeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ "添加到子节点"按钮被点击');
                try {
                    this.addAIToChildNodes();
                } catch (error) {
                    console.error('❌ 添加到子节点时出错:', error);
                    alert('添加到子节点失败: ' + error.message);
                }
            });
            
            // 确保按钮可以点击
            addToNodeBtn.style.setProperty('pointer-events', 'auto', 'important');
            addToNodeBtn.style.setProperty('cursor', 'pointer', 'important');
            addToNodeBtn.setAttribute('type', 'button');
        } else {
            console.error('❌ 找不到"添加到子节点"按钮 #splitAddToNodeBtn');
        }

        // 绑定文件上传按钮事件
        const fileUploadBtn = modal.querySelector('#splitFileUploadBtn');
        const fileInput = modal.querySelector('#splitFileInput');
        const filePreview = modal.querySelector('#splitFilePreview');
        
        if (fileUploadBtn && fileInput) {
            fileUploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e, filePreview);
            });
            
            // 确保按钮可以点击
            fileUploadBtn.style.setProperty('pointer-events', 'auto', 'important');
            fileUploadBtn.style.setProperty('cursor', 'pointer', 'important');
        }

        // 绑定输入框回车事件和自动调整高度
        const chatInput = modal.querySelector('#splitChatInput');
        
        if (chatInput) {
            // 自动调整高度
            const adjustHeight = () => {
                chatInput.style.height = 'auto';
                const scrollHeight = chatInput.scrollHeight;
                const maxHeight = 120; // 最大高度
                chatInput.style.height = Math.min(scrollHeight, maxHeight) + 'px';
            };
            
            // 监听输入变化，自动调整高度
            chatInput.addEventListener('input', adjustHeight);
            
            // 监听粘贴事件，支持粘贴图片
            chatInput.addEventListener('paste', async (e) => {
                const clipboardData = e.clipboardData || window.clipboardData;
                if (!clipboardData) return;
                
                const items = clipboardData.items;
                if (!items) return;
                
                // 检查是否有图片
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    
                    // 如果是图片类型
                    if (item.type.indexOf('image') !== -1) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        console.log('📋 检测到粘贴的图片，类型:', item.type);
                        
                        try {
                            const file = item.getAsFile();
                            if (!file) {
                                console.error('❌ 无法从剪贴板获取文件');
                                return;
                            }
                            
                            // 检查文件大小
                            if (file.size > 50 * 1024 * 1024) {
                                alert(`图片大小超过50MB限制，无法上传`);
                                return;
                            }
                            
                            // 生成文件名（如果没有名称）
                            if (!file.name || file.name === 'image.png' || file.name === 'blob') {
                                const timestamp = Date.now();
                                const extension = file.type.split('/')[1] || 'png';
                                file.name = `粘贴图片_${timestamp}.${extension}`;
                            }
                            
                            // 添加到已上传文件列表
                            if (!this.uploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
                                this.uploadedFiles.push(file);
                                
                                // 显示预览
                                if (filePreview) {
                                    this.renderFilePreview(file, filePreview);
                                    console.log('✅ 图片已添加到上传列表');
                                } else {
                                    console.error('❌ 找不到文件预览容器');
                                }
                            } else {
                                console.log('⚠️ 图片已存在，跳过');
                            }
                        } catch (error) {
                            console.error('❌ 处理粘贴图片失败:', error);
                            alert('粘贴图片失败: ' + error.message);
                        }
                        
                        break; // 只处理第一个图片
                    }
                }
            });
            
            // 监听回车键
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✅ 回车键被按下');
                    try {
                        this.sendMessage();
                    } catch (error) {
                        console.error('❌ 发送消息时出错:', error);
                    }
                }
            });
        } else {
            console.error('❌ 找不到输入框 #splitChatInput');
        }
        
        // 防止点击输入框时事件冒泡导致插件关闭
        if (chatInput) {
            chatInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // 防止点击输入框容器时事件冒泡（但允许按钮点击）
        const chatInputContainer = modal.querySelector('.chat-input');
        if (chatInputContainer) {
            chatInputContainer.addEventListener('click', (e) => {
                // 如果点击的是发送按钮、添加到子节点按钮或文件上传按钮，不阻止事件，让按钮的点击事件正常触发
                if (e.target.id === 'splitSendBtn' || e.target.id === 'splitAddToNodeBtn' || e.target.id === 'splitFileUploadBtn' ||
                    e.target.closest('#splitSendBtn') || e.target.closest('#splitAddToNodeBtn') || e.target.closest('#splitFileUploadBtn')) {
                    // 不阻止，让事件继续传播到按钮
                    return;
                }
                // 其他情况才阻止冒泡
                e.stopPropagation();
            });
        }

        // 防止点击整个弹窗内容时事件冒泡（但允许按钮点击）
        modalContent.addEventListener('click', (e) => {
            // 如果点击的是发送按钮、添加到子节点按钮或关闭按钮，不阻止事件
            if (e.target.id === 'splitSendBtn' || e.target.id === 'splitAddToNodeBtn' || e.target.id === 'splitCloseModal' || 
                e.target.closest('#splitSendBtn') || e.target.closest('#splitAddToNodeBtn') || e.target.closest('#splitCloseModal')) {
                // 不阻止，让按钮的点击事件正常触发
                return;
            }
            // 其他情况才阻止冒泡
            e.stopPropagation();
        });

        // 显示当前节点
        modal.querySelector('#splitCurrentNode').textContent = `关于: ${this.currentNode}`;
        
        // 添加拖动调整大小功能
        this.addResizeFunctionality(modalContent);
        
        modal.style.display = 'flex';
        modal.style.setProperty('display', 'flex', 'important');
        // 不阻止页面滚动，让用户可以查看思维导图
        document.body.style.overflow = '';
        
        // 验证事件绑定
        console.log('✅ AI问答弹窗已创建');
        console.log('发送按钮:', sendBtn ? '找到' : '未找到');
        console.log('输入框:', chatInput ? '找到' : '未找到');
        
        // 确保输入框获得焦点
        if (chatInput) {
            setTimeout(() => {
                chatInput.focus();
            }, 100);
        }
    }

    // 添加拖动调整大小功能
    addResizeFunctionality(modalContent) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        // 创建调整大小手柄
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: nwse-resize;
            z-index: 1000;
            background: linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 35%, transparent 35%, transparent 65%, #ccc 65%, #ccc 70%, transparent 70%);
        `;
        modalContent.appendChild(resizeHandle);

        // 鼠标按下事件
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(window.getComputedStyle(modalContent).width, 10);
            startHeight = parseInt(window.getComputedStyle(modalContent).height, 10);
            e.preventDefault();
        });

        // 鼠标移动事件
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
            
            // 限制最小和最大尺寸
            const minWidth = 500;
            const minHeight = 400;
            const maxWidth = window.innerWidth * 0.9;
            const maxHeight = window.innerHeight * 0.85;
            
            if (width >= minWidth && width <= maxWidth) {
                modalContent.style.width = width + 'px';
            }
            if (height >= minHeight && height <= maxHeight) {
                modalContent.style.height = height + 'px';
            }
        });

        // 鼠标释放事件
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });

        // 悬停效果
        resizeHandle.addEventListener('mouseenter', () => {
            resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #667eea 30%, #667eea 35%, transparent 35%, transparent 65%, #667eea 65%, #667eea 70%, transparent 70%)';
        });

        resizeHandle.addEventListener('mouseleave', () => {
            if (!isResizing) {
                resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 35%, transparent 35%, transparent 65%, #ccc 65%, #ccc 70%, transparent 70%)';
            }
        });
    }


    renderChatMessages() {
        // 优先从 AI 模态框中获取消息容器
        const aiModal = document.getElementById('splitAIModal');
        let container = null;
        
        if (aiModal) {
            container = aiModal.querySelector('#splitChatMessages');
            console.log('从 AI 模态框中找到消息容器');
        }
        
        // 如果模态框中找不到，尝试从侧边栏中查找
        if (!container) {
            const sidebar = document.getElementById('splitAISidebar');
            if (sidebar) {
                container = sidebar.querySelector('#sidebarChatMessages');
                console.log('从侧边栏中找到消息容器');
            }
        }
        
        // 如果都找不到，再从整个文档中查找
        if (!container) {
            container = document.getElementById('splitChatMessages');
            console.log('从整个文档中查找消息容器');
        }
        
        if (!container) {
            console.error('❌ 找不到消息容器');
            return;
        }
        
        container.innerHTML = '';
        this.chatMessages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${message.type}`;
            
            // 如果是AI消息，解析markdown格式
            if (message.type === 'ai') {
                const markdownContent = this.parseMarkdownToHTML(message.content);
                messageEl.innerHTML = `<div class="message-content markdown-content">${markdownContent}</div>`;
            } else {
                // 用户消息，转义HTML以防止XSS，但保留换行
                const escapedContent = message.content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;')
                    .replace(/\n/g, '<br>');
                
                // 🆕 构建消息内容，包含附件
                let messageHtml = `<div class="message-content">${escapedContent}</div>`;
                
                // 如果有附件，显示附件
                if (message.files && message.files.length > 0) {
                    const filesHtml = message.files.map((file, fileIndex) => {
                        if (file.isImage && file.previewUrl) {
                            // 图片附件 - 显示缩略图，点击打开预览
                            const uniqueId = `img-${Date.now()}-${fileIndex}`;
                            return `
                                <div class="message-attachment image-attachment">
                                    <img src="${file.previewUrl}" 
                                         alt="${this.escapeHtml(file.name)}" 
                                         data-preview-id="${uniqueId}"
                                         data-preview-url="${file.previewUrl}"
                                         data-preview-name="${this.escapeHtml(file.name)}"
                                         class="clickable-image"
                                         title="点击查看大图">
                                    <span class="attachment-name">${this.escapeHtml(file.name)}</span>
                                </div>
                            `;
                        } else {
                            // 非图片附件 - 显示文件图标
                            const fileIcon = this.getFileIcon(file.type, file.name);
                            const fileSize = this.formatFileSize(file.size);
                            return `
                                <div class="message-attachment file-attachment">
                                    <span class="attachment-icon">${fileIcon}</span>
                                    <div class="attachment-info">
                                        <span class="attachment-name">${this.escapeHtml(file.name)}</span>
                                        <span class="attachment-size">${fileSize}</span>
                                    </div>
                                </div>
                            `;
                        }
                    }).join('');
                    
                    messageHtml += `<div class="message-attachments">${filesHtml}</div>`;
                }
                
                messageEl.innerHTML = messageHtml;
                
                // 绑定图片点击事件
                const clickableImages = messageEl.querySelectorAll('.clickable-image');
                clickableImages.forEach(img => {
                    img.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const url = img.getAttribute('data-preview-url');
                        const name = img.getAttribute('data-preview-name');
                        this.showImagePreview(url, name);
                    });
                });
            }
            
            container.appendChild(messageEl);
        });
        
        container.scrollTop = container.scrollHeight;
        console.log('✅ 已渲染', this.chatMessages.length, '条消息');
    }

    // 将Markdown转换为HTML
    parseMarkdownToHTML(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }
        
        let html = markdown;
        
        // 转义HTML特殊字符（先转义，再处理markdown）
        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // 处理代码块 ```code```
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            const escapedCode = code
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');
            return `<pre><code>${this.escapeHtml(escapedCode.trim())}</code></pre>`;
        });
        
        // 处理行内代码 `code`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 处理标题 # ## ###
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // 处理粗体 **text** 或 __text__
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        
        // 处理斜体 *text* 或 _text_
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // 处理删除线 ~~text~~
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
        
        // 处理链接 [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // 处理无序列表 - 或 *
        html = html.replace(/^[\*\-\+] (.+)$/gim, '<li>$1</li>');
        // 将连续的<li>包装在<ul>中
        html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
            return '<ul>' + match + '</ul>';
        });
        
        // 处理有序列表 1. 2. 3.
        html = html.replace(/^\d+\. (.+)$/gim, '<li>$1</li>');
        // 将连续的<li>（数字开头的）包装在<ol>中
        html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
            if (match.includes('<ol>')) return match; // 已经处理过
            return '<ol>' + match + '</ol>';
        });
        
        // 处理换行（两个换行符 = 段落，单个换行符 = <br>）
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        // 包装段落
        if (!html.startsWith('<')) {
            html = '<p>' + html;
        }
        if (!html.endsWith('>')) {
            html = html + '</p>';
        }
        
        // 恢复代码块中的HTML（代码块不应该被转义）
        html = html.replace(/&lt;pre&gt;&lt;code&gt;(.*?)&lt;\/code&gt;&lt;\/pre&gt;/g, (match, code) => {
            const unescapedCode = code
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');
            return `<pre><code>${this.escapeHtml(unescapedCode)}</code></pre>`;
        });
        
        return html;
    }

    async sendMessage(message = null) {
        console.log('=== sendMessage 被调用 ===');
        console.log('参数 message:', message);
        
        // 优先从 AI 模态框中获取输入框
        const aiModal = document.getElementById('splitAIModal');
        let chatInput = null;
        
        if (aiModal) {
            chatInput = aiModal.querySelector('#splitChatInput');
            console.log('从 AI 模态框中找到输入框');
        }
        
        // 如果模态框中找不到，尝试从侧边栏中查找
        if (!chatInput) {
            const sidebar = document.getElementById('splitAISidebar');
            if (sidebar) {
                chatInput = sidebar.querySelector('#sidebarChatInput');
                console.log('从侧边栏中找到输入框');
            }
        }
        
        // 如果都找不到，再从整个文档中查找
        if (!chatInput) {
            chatInput = document.getElementById('splitChatInput');
            console.log('从整个文档中查找输入框');
        }
        
        if (!chatInput) {
            console.error('❌ 找不到输入框元素 splitChatInput');
            alert('错误：找不到输入框，请刷新页面重试');
            return;
        }
        
        // 获取输入框的值
        const inputValue = chatInput.value || '';
        console.log('输入框原始值:', inputValue);
        console.log('输入框 value 属性:', chatInput.value);
        console.log('输入框类型:', chatInput.tagName);
        
        const messageText = message || inputValue.trim();
        console.log('处理后的消息文本:', messageText);
        console.log('消息文本长度:', messageText.length);
        
        if (!messageText || messageText.length === 0) {
            console.warn('⚠️ 消息为空，无法发送');
            console.warn('输入框元素:', chatInput);
            console.warn('输入框的所有属性:', {
                value: chatInput?.value,
                textContent: chatInput?.textContent,
                innerText: chatInput?.innerText,
                innerHTML: chatInput?.innerHTML,
                type: chatInput?.type,
                tagName: chatInput?.tagName
            });
            alert('请输入问题后再发送');
            return;
        }
        
        console.log('✅ 准备发送消息:', messageText);
        console.log('当前 chatMessages 数组长度:', this.chatMessages.length);
        console.log('当前 chatMessages 内容:', JSON.stringify(this.chatMessages));
        
        // 🆕 保存当前上传的文件信息到消息中
        const filesInfo = [];
        if (this.uploadedFiles && this.uploadedFiles.length > 0) {
            for (const file of this.uploadedFiles) {
                const fileInfo = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    isImage: file.type.startsWith('image/')
                };
                
                // 如果是图片，生成预览URL
                if (fileInfo.isImage) {
                    try {
                        fileInfo.previewUrl = await this.fileToDataUrl(file);
                    } catch (e) {
                        console.warn('生成图片预览失败:', e);
                    }
                }
                
                filesInfo.push(fileInfo);
            }
            console.log('📎 附件信息:', filesInfo.length, '个文件');
        }
        
        // 添加用户消息（包含附件信息）
        this.chatMessages.push({ 
            type: 'user', 
            content: messageText,
            files: filesInfo.length > 0 ? filesInfo : undefined
        });
        console.log('✅ 已添加用户消息到数组，新长度:', this.chatMessages.length);
        
        // 立即渲染消息
        this.renderChatMessages();
        console.log('✅ 已调用 renderChatMessages()');
        
        // 清空输入框（只清空模态框中的输入框）
        if (!message && chatInput) {
            chatInput.value = '';
            // 重置高度
            if (chatInput.tagName === 'TEXTAREA') {
                chatInput.style.height = 'auto';
            }
            console.log('✅ 已清空输入框');
        }
        
        // 🆕 立即清空文件预览区域（发送后就清除，不等待响应）
        let filePreview = null;
        if (aiModal) {
            filePreview = aiModal.querySelector('#splitFilePreview');
        }
        if (!filePreview) {
            const sidebar = document.getElementById('splitAISidebar');
            if (sidebar) {
                filePreview = sidebar.querySelector('#sidebarFilePreview');
            }
        }
        if (filePreview) {
            filePreview.innerHTML = '';
        }
        
        // 获取消息容器（优先从 AI 模态框中获取）
        const messagesContainer = aiModal ? aiModal.querySelector('#splitChatMessages') : document.getElementById('splitChatMessages');
        if (!messagesContainer) {
            console.error('❌ 找不到消息容器 splitChatMessages');
            alert('错误：找不到消息容器，请刷新页面重试');
            return;
        }
        
        // 显示AI正在思考
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'chat-message ai';
        thinkingEl.innerHTML = '<div class="message-content">🤖 正在思考中...</div>';
        messagesContainer.appendChild(thinkingEl);
        
        // 获取当前网页内容，用于AI回答时参考
        let pageContent = '';
        try {
            pageContent = this.extractPageContent();
            console.log('📄 已提取网页内容，长度:', pageContent.length);
        } catch (error) {
            console.warn('⚠️ 提取网页内容失败:', error);
            pageContent = '';
        }
        
        console.log('📤 发送请求到:', `${this.apiBaseUrl}/chat`);
        console.log('📤 请求参数:', {
            question: messageText,
            nodeText: this.currentNode,
            nodeLevel: this.currentNodeLevel,
            provider: 'deepseek',
            model: 'deepseek-chat',
            conversationHistoryLength: this.chatMessages.length,
            filesCount: this.uploadedFiles ? this.uploadedFiles.length : 0,
            pageContentLength: pageContent.length
        });
        
        try {
            // 如果有文件，使用FormData，否则使用JSON
            let requestOptions;
            
            if (this.uploadedFiles && this.uploadedFiles.length > 0) {
                // 使用FormData发送文件
                const formData = new FormData();
                formData.append('question', messageText);
                formData.append('nodeText', this.currentNode);
                formData.append('nodeLevel', this.currentNodeLevel.toString());
                formData.append('provider', 'deepseek');
                formData.append('model', 'deepseek-chat');
                formData.append('conversationHistory', JSON.stringify(this.chatMessages));
                formData.append('pageContent', pageContent); // 添加网页内容
                
                // 添加所有文件
                this.uploadedFiles.forEach((file, index) => {
                    formData.append(`files`, file);
                });
                
                requestOptions = {
                    method: 'POST',
                    body: formData
                };
                
                console.log('📤 使用FormData发送，包含', this.uploadedFiles.length, '个文件');
            } else {
                // 使用JSON发送
                requestOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: messageText,
                        nodeText: this.currentNode,
                        nodeLevel: this.currentNodeLevel,
                        provider: 'deepseek',
                        model: 'deepseek-chat',
                        conversationHistory: this.chatMessages,
                        pageContent: pageContent // 添加网页内容
                    })
                };
            }
            
            const response = await fetch(`${this.apiBaseUrl}/chat`, requestOptions);

            console.log('📥 收到响应，状态码:', response.status);
            const data = await response.json();
            console.log('📥 响应数据:', data);

            // 移除思考提示
            if (thinkingEl.parentNode) {
                thinkingEl.parentNode.removeChild(thinkingEl);
            }

            if (data.success) {
                console.log('✅ AI 回复成功，内容:', data.data.response);
                
                // 检查回答是否完整，如果不完整则自动补充
                const aiResponse = data.data.response;
                const isComplete = this.checkAnswerComplete(aiResponse);
                
                if (!isComplete) {
                    console.log('⚠️ AI回答可能不完整，自动请求补充...');
                    // 先显示当前回答
                    this.chatMessages.push({ type: 'ai', content: aiResponse });
                    this.renderChatMessages();
                    
                    // 自动请求补充回答
                    await this.continueAnswer(aiResponse, messagesContainer);
                } else {
                    // 回答完整，直接添加
                    this.chatMessages.push({ type: 'ai', content: aiResponse });
                    console.log('✅ 已添加 AI 消息到数组，新长度:', this.chatMessages.length);
                    this.renderChatMessages();
                }
                
                // 清空已上传的文件数组（预览区域已在发送时清除）
                if (this.uploadedFiles && this.uploadedFiles.length > 0) {
                    this.uploadedFiles = [];
                    console.log('✅ 已清空上传文件数组');
                }
            } else {
                console.error('❌ AI 回复失败:', data.error);
                this.chatMessages.push({ 
                    type: 'ai', 
                    content: `❌ ${data.error || '获取AI回复失败'}` 
                });
                this.renderChatMessages();
            }
        } catch (error) {
            console.error('❌ AI问答失败:', error);
            console.error('错误详情:', error.message, error.stack);
            
            // 移除思考提示
            if (thinkingEl && thinkingEl.parentNode) {
                thinkingEl.parentNode.removeChild(thinkingEl);
            }
            
            this.chatMessages.push({ 
                type: 'ai', 
                content: `❌ 抱歉，AI服务暂时不可用，请稍后重试。错误信息: ${error.message}` 
            });
            this.renderChatMessages();
        }
    }

    // 检查AI回答是否完整
    checkAnswerComplete(answer) {
        if (!answer || answer.trim().length === 0) {
            return false;
        }
        
        // 检查回答长度（如果太短可能不完整）
        if (answer.trim().length < 50) {
            return true; // 短回答可能是完整的
        }
        
        // 检查是否以未完成标记结尾
        const incompleteMarkers = ['...', '、', '，', '等', '等等', '未完待续', '待续', '（未完）'];
        const trimmedAnswer = answer.trim();
        for (const marker of incompleteMarkers) {
            if (trimmedAnswer.endsWith(marker)) {
                console.log('⚠️ 检测到未完成标记:', marker);
                return false;
            }
        }
        
        // 检查是否以完整的句子结尾（句号、问号、感叹号）
        const completeEndings = ['。', '！', '？', '.', '!', '?'];
        const lastChar = trimmedAnswer[trimmedAnswer.length - 1];
        if (completeEndings.includes(lastChar)) {
            return true;
        }
        
        // 检查回答长度（如果超过800字符且没有完整结尾，可能被截断）
        if (answer.length > 800 && !completeEndings.includes(lastChar)) {
            console.log('⚠️ 回答较长且未以完整句子结尾，可能不完整');
            return false;
        }
        
        // 默认认为完整
        return true;
    }

    // 自动继续回答
    async continueAnswer(previousAnswer, messagesContainer, maxAttempts = 3) {
        let currentAnswer = previousAnswer;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`🔄 第 ${attempts} 次尝试补充回答...`);
            
            // 显示继续思考提示
            const continueThinkingEl = document.createElement('div');
            continueThinkingEl.className = 'chat-message ai';
            continueThinkingEl.innerHTML = '<div class="message-content">🤖 正在补充回答...</div>';
            messagesContainer.appendChild(continueThinkingEl);
            
            try {
                const response = await fetch(`${this.apiBaseUrl}/continue-answer`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        previousAnswer: currentAnswer,
                        nodeText: this.currentNode,
                        nodeLevel: this.currentNodeLevel,
                        provider: 'deepseek',
                        model: 'deepseek-chat',
                        conversationHistory: this.chatMessages
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // 移除继续思考提示
                if (continueThinkingEl.parentNode) {
                    continueThinkingEl.parentNode.removeChild(continueThinkingEl);
                }

                if (data.success) {
                    const continuedAnswer = data.data.response;
                    const isComplete = data.data.isComplete;
                    
                    console.log('✅ 补充回答成功，是否完整:', isComplete);
                    
                    // 更新最后一条AI消息的内容
                    const lastAIMessage = this.chatMessages.filter(msg => msg.type === 'ai').pop();
                    if (lastAIMessage) {
                        lastAIMessage.content = currentAnswer + '\n\n' + continuedAnswer;
                        currentAnswer = lastAIMessage.content;
                    } else {
                        // 如果没有找到，添加新消息
                        this.chatMessages.push({ type: 'ai', content: continuedAnswer });
                        currentAnswer = continuedAnswer;
                    }
                    
                    // 重新渲染消息
                    this.renderChatMessages();
                    
                    // 如果回答已完整，停止继续
                    if (isComplete) {
                        console.log('✅ 回答已完整，停止补充');
                        break;
                    }
                    
                    // 如果回答仍然不完整，继续尝试
                    if (!this.checkAnswerComplete(currentAnswer)) {
                        console.log('⚠️ 补充后回答仍不完整，继续尝试...');
                        // 继续循环
                    } else {
                        console.log('✅ 补充后回答已完整');
                        break;
                    }
                } else {
                    throw new Error(data.error || '补充回答失败');
                }
            } catch (error) {
                console.error('❌ 补充回答失败:', error);
                
                // 移除继续思考提示
                if (continueThinkingEl.parentNode) {
                    continueThinkingEl.parentNode.removeChild(continueThinkingEl);
                }
                
                // 如果失败，停止尝试
                break;
            }
        }
        
        if (attempts >= maxAttempts) {
            console.log('⚠️ 已达到最大补充次数，停止补充');
        }
    }

    handleFileSelect(event, filePreviewContainer) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        console.log('📁 选择了', files.length, '个文件');
        
        files.forEach(file => {
            // 检查文件大小（限制为10MB）
            if (file.size > 50 * 1024 * 1024) {
                alert(`文件 ${file.name} 超过50MB限制，已跳过`);
                return;
            }
            
            // 添加到已上传文件列表
            if (!this.uploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.uploadedFiles.push(file);
                this.renderFilePreview(file, filePreviewContainer);
            }
        });
        
        // 清空文件选择器的值，允许重复选择同一文件
        event.target.value = '';
    }

    renderFilePreview(file, container) {
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        previewItem.setAttribute('data-filename', file.name);
        
        // 判断文件类型
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
            // 图片预览
            const reader = new FileReader();
            reader.onload = (e) => {
                previewItem.innerHTML = `
                    <div class="file-preview-content">
                        <img src="${e.target.result}" alt="${file.name}" class="file-preview-image">
                        <div class="file-preview-info">
                            <span class="file-name">${this.escapeHtml(file.name)}</span>
                            <span class="file-size">${this.formatFileSize(file.size)}</span>
                        </div>
                        <button class="file-remove-btn" data-filename="${this.escapeHtml(file.name)}">×</button>
                    </div>
                `;
                
                // 绑定删除按钮
                const removeBtn = previewItem.querySelector('.file-remove-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.removeFile(file.name);
                        previewItem.remove();
                    });
                }
            };
            reader.readAsDataURL(file);
        } else {
            // 文件预览
            previewItem.innerHTML = `
                <div class="file-preview-content">
                    <div class="file-icon">📄</div>
                    <div class="file-preview-info">
                        <span class="file-name">${this.escapeHtml(file.name)}</span>
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                    </div>
                    <button class="file-remove-btn" data-filename="${this.escapeHtml(file.name)}">×</button>
                </div>
            `;
            
            // 绑定删除按钮
            const removeBtn = previewItem.querySelector('.file-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.removeFile(file.name);
                    previewItem.remove();
                });
            }
        }
        
        container.appendChild(previewItem);
    }

    removeFile(filename) {
        this.uploadedFiles = this.uploadedFiles.filter(f => f.name !== filename);
        console.log('🗑️ 已移除文件:', filename, '剩余文件数:', this.uploadedFiles.length);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 将文件转换为 Data URL
     * @param {File} file - 文件对象
     * @returns {Promise<string>} Data URL
     */
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * 显示图片预览弹窗
     * @param {string} imageUrl - 图片URL
     * @param {string} imageName - 图片名称
     */
    showImagePreview(imageUrl, imageName) {
        // 移除已存在的预览弹窗
        const existingPreview = document.getElementById('image-preview-modal');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        // 创建预览弹窗
        const modal = document.createElement('div');
        modal.id = 'image-preview-modal';
        modal.className = 'image-preview-modal';
        
        modal.innerHTML = `
            <div class="image-preview-backdrop"></div>
            <div class="image-preview-container">
                <div class="image-preview-header">
                    <span class="image-preview-title">${imageName || '图片预览'}</span>
                    <div class="image-preview-actions">
                        <button class="image-preview-btn" id="imagePreviewZoomIn" title="放大">🔍+</button>
                        <button class="image-preview-btn" id="imagePreviewZoomOut" title="缩小">🔍-</button>
                        <button class="image-preview-btn" id="imagePreviewReset" title="重置">↺</button>
                        <button class="image-preview-btn" id="imagePreviewDownload" title="下载">⬇️</button>
                        <button class="image-preview-close" id="imagePreviewClose" title="关闭">✕</button>
                    </div>
                </div>
                <div class="image-preview-body">
                    <img src="${imageUrl}" alt="${imageName || '预览图片'}" id="previewImage" draggable="false">
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 当前缩放比例
        let scale = 1;
        const previewImage = modal.querySelector('#previewImage');
        
        // 绑定关闭事件
        const closeModal = () => {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 200);
        };
        
        modal.querySelector('#imagePreviewClose').addEventListener('click', closeModal);
        modal.querySelector('.image-preview-backdrop').addEventListener('click', closeModal);
        
        // ESC 键关闭
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        // 放大
        modal.querySelector('#imagePreviewZoomIn').addEventListener('click', () => {
            scale = Math.min(scale + 0.25, 5);
            previewImage.style.transform = `scale(${scale})`;
        });
        
        // 缩小
        modal.querySelector('#imagePreviewZoomOut').addEventListener('click', () => {
            scale = Math.max(scale - 0.25, 0.25);
            previewImage.style.transform = `scale(${scale})`;
        });
        
        // 重置
        modal.querySelector('#imagePreviewReset').addEventListener('click', () => {
            scale = 1;
            previewImage.style.transform = `scale(1)`;
        });
        
        // 下载
        modal.querySelector('#imagePreviewDownload').addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = imageName || 'image';
            link.click();
        });
        
        // 鼠标滚轮缩放
        modal.querySelector('.image-preview-body').addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                scale = Math.min(scale + 0.1, 5);
            } else {
                scale = Math.max(scale - 0.1, 0.25);
            }
            previewImage.style.transform = `scale(${scale})`;
        });
        
        // 添加打开动画
        requestAnimationFrame(() => {
            modal.classList.add('open');
        });
    }
    
    /**
     * 根据文件类型获取图标
     * @param {string} mimeType - MIME类型
     * @param {string} filename - 文件名
     * @returns {string} 图标emoji
     */
    getFileIcon(mimeType, filename) {
        if (!mimeType && filename) {
            const ext = filename.split('.').pop()?.toLowerCase();
            const extMap = {
                'pdf': '📄',
                'doc': '📝', 'docx': '📝',
                'xls': '📊', 'xlsx': '📊',
                'ppt': '📽️', 'pptx': '📽️',
                'txt': '📃', 'md': '📃',
                'zip': '📦', 'rar': '📦', '7z': '📦',
                'mp3': '🎵', 'wav': '🎵', 'flac': '🎵',
                'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
                'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️'
            };
            return extMap[ext] || '📎';
        }
        
        if (mimeType) {
            if (mimeType.startsWith('image/')) return '🖼️';
            if (mimeType.startsWith('video/')) return '🎬';
            if (mimeType.startsWith('audio/')) return '🎵';
            if (mimeType.includes('pdf')) return '📄';
            if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
            if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
            if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
            if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
            if (mimeType.startsWith('text/')) return '📃';
        }
        
        return '📎';
    }
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async addAIToChildNodes() {
        console.log('=== 开始添加到子节点 ===');
        
        // 检查是否有思维导图数据
        if (!this.mindmapData || !this.mindmapData.markdown) {
            alert('请先生成思维导图');
            return;
        }
        
        // 检查是否有当前节点
        if (!this.currentNode) {
            alert('请先选择一个节点进行AI问答');
            return;
        }
        
        // 检查是否有对话记录
        if (!this.chatMessages || this.chatMessages.length === 0) {
            alert('请先进行AI问答');
            return;
        }
        
        // 检查是否有AI回复
        const aiMessages = this.chatMessages.filter(msg => msg.type === 'ai');
        if (aiMessages.length === 0) {
            alert('请先获取AI回答');
            return;
        }
        
        // 🔧 如果有多条对话（超过2条消息），显示选择弹窗让用户勾选
        if (this.chatMessages.length > 2) {
            console.log('检测到多轮对话，显示选择弹窗');
            this.showChatSelectModal();
            return;
        }
        
        // 单轮对话，直接使用最后一条AI回复
        const lastAIMessage = aiMessages[aiMessages.length - 1];
        
        console.log('当前节点:', this.currentNode);
        console.log('AI回答内容:', lastAIMessage.content);
        
        // 获取所有"添加到子节点"按钮（弹窗和侧边栏）
        const addToNodeBtns = [
            document.querySelector('#splitAddToNodeBtn'),
            document.querySelector('#sidebarAddToNodeBtn')
        ].filter(btn => btn !== null);
        
        // 保存按钮原始状态
        const originalBtnStates = addToNodeBtns.map(btn => ({
            btn,
            text: btn.textContent,
            disabled: btn.disabled
        }));
        
        // 设置按钮为加载状态
        const setButtonLoading = (loading) => {
            addToNodeBtns.forEach(btn => {
                if (loading) {
                    btn.textContent = '添加中...';
                    btn.disabled = true;
                    btn.style.opacity = '0.7';
                    btn.style.cursor = 'wait';
                } else {
                    // 恢复原始状态
                    const original = originalBtnStates.find(s => s.btn === btn);
                    if (original) {
                        btn.textContent = original.text;
                        btn.disabled = original.disabled;
                    } else {
                        btn.textContent = '添加到子节点';
                        btn.disabled = false;
                    }
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }
            });
        };
        
        // 🔄 显示加载状态
        setButtonLoading(true);
        
        try {
            // 调用API将AI回答整理成子节点
            console.log('📤 发送请求到:', `${this.apiBaseUrl}/add-child-nodes`);
            const response = await fetch(`${this.apiBaseUrl}/add-child-nodes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parentNode: this.currentNode,
                    parentLevel: this.currentNodeLevel,
                    aiResponse: lastAIMessage.content,
                    currentMarkdown: this.mindmapData.markdown
                })
            });
            
            console.log('📥 收到响应，状态码:', response.status);
            
            // 检查响应状态
            if (!response.ok) {
                // 如果状态码不是2xx，尝试读取错误信息
                let errorMessage = `服务器错误 (${response.status})`;
                try {
                    const errorText = await response.text();
                    // 如果是HTML响应，说明可能是404页面
                    if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
                        if (response.status === 404) {
                            errorMessage = 'API端点不存在，请检查后端服务是否实现了 /api/mindmap/add-child-nodes 端点';
                        } else {
                            errorMessage = `服务器返回了HTML页面 (${response.status})，可能是错误页面`;
                        }
                    } else {
                        // 尝试解析为JSON
                        try {
                            const errorData = JSON.parse(errorText);
                            errorMessage = errorData.error || errorData.message || errorMessage;
                        } catch (e) {
                            errorMessage = errorText.substring(0, 200) || errorMessage;
                        }
                    }
                } catch (e) {
                    console.error('读取错误响应失败:', e);
                }
                throw new Error(errorMessage);
            }
            
            // 检查响应内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const responseText = await response.text();
                console.warn('⚠️ 响应不是JSON格式:', responseText.substring(0, 200));
                throw new Error('服务器返回了非JSON格式的响应，请检查API端点是否正确');
            }
            
            const data = await response.json();
            console.log('📥 响应数据:', data);
            
            if (data.success) {
                // 更新思维导图数据
                this.mindmapData.markdown = data.data.markdown;
                this.mindmapData = data.data;
                
                // 重新渲染思维导图
                this.renderMindmap(data.data.markdown);
                
                // 保存状态
                this.saveState();
                
                // ✅ 恢复按钮状态
                setButtonLoading(false);
                
                // 显示成功提示
                this.showSuccessToast('已经成功添加为子节点');
                console.log('✅ 子节点添加成功');
            } else {
                throw new Error(data.error || '添加到子节点失败');
            }
        } catch (error) {
            console.error('❌ 添加到子节点失败:', error);
            console.error('错误详情:', error.message, error.stack);
            
            // 提供更友好的错误提示
            let errorMessage = error.message;
            if (error.message.includes('404') || error.message.includes('端点不存在')) {
                errorMessage = '后端API端点未实现。\n\n请确保后端服务已实现 /api/mindmap/add-child-nodes 端点，或者使用前端备选方案。\n\n是否使用前端备选方案（简单文本处理）？';
                
                // 提供备选方案
                if (confirm(errorMessage)) {
                    // 备选方案会自己处理按钮状态恢复
                    this.addAIToChildNodesFallback(lastAIMessage.content, setButtonLoading);
                    return;
                }
            } else {
                alert('添加到子节点失败: ' + errorMessage);
            }
            
            // ❌ 失败时恢复按钮状态
            setButtonLoading(false);
        }
    }

    // 前端备选方案：直接将AI回答作为子节点添加
    addAIToChildNodesFallback(aiResponse, setButtonLoading = null) {
        console.log('🔄 使用前端备选方案添加子节点');
        
        try {
            // 解析当前markdown
            const lines = this.mindmapData.markdown.split('\n');
            const nodes = [];
            
            // 找到当前节点在markdown中的位置
            let parentNodeIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#')) {
                    const level = (line.match(/^#+/) || [''])[0].length;
                    const text = line.replace(/^#+\s*/, '').trim();
                    nodes.push({ level, text, index: i });
                    
                    // 检查是否是当前节点
                    if (text === this.currentNode && level === this.currentNodeLevel) {
                        parentNodeIndex = nodes.length - 1;
                    }
                }
            }
            
            if (parentNodeIndex === -1) {
                throw new Error('找不到当前节点在思维导图中的位置');
            }
            
            // 将AI回答按段落分割，每个段落作为一个子节点
            const childLevel = this.currentNodeLevel + 1;
            const childPrefix = '#'.repeat(childLevel) + ' ';
            const paragraphs = aiResponse.split(/\n\n+/).filter(p => p.trim().length > 0);
            
            // 如果段落太多，只取前5个
            const selectedParagraphs = paragraphs.slice(0, 5);
            
            // 构建新的子节点markdown，添加[AI]标记表示是AI生成的内容
            const childNodesMarkdown = selectedParagraphs
                .map(p => {
                    // 清理段落文本，移除多余的空格和换行
                    const cleanText = p.trim().replace(/\n+/g, ' ').substring(0, 100);
                    // 添加[AI]标记，用于在渲染时识别AI生成的节点
                    return childPrefix + '[AI] ' + cleanText;
                })
                .join('\n');
            
            // 找到插入位置（当前节点的下一行）
            const parentNode = nodes[parentNodeIndex];
            let insertIndex = parentNode.index + 1;
            
            // 找到当前节点的最后一个子节点位置
            for (let i = parentNodeIndex + 1; i < nodes.length; i++) {
                if (nodes[i].level > parentNode.level) {
                    insertIndex = nodes[i].index + 1;
                } else {
                    break;
                }
            }
            
            // 插入新的子节点
            lines.splice(insertIndex, 0, childNodesMarkdown);
            const newMarkdown = lines.join('\n');
            
            // 更新思维导图数据
            this.mindmapData.markdown = newMarkdown;
            
            // 重新渲染思维导图
            this.renderMindmap(newMarkdown);
            
            // 保存状态
            this.saveState();
            
            // ✅ 恢复按钮状态
            if (setButtonLoading) {
                setButtonLoading(false);
            }
            
            // 显示成功提示
            this.showSuccessToast('已经成功添加为子节点');
            console.log('✅ 前端备选方案执行成功');
        } catch (error) {
            console.error('❌ 前端备选方案失败:', error);
            
            // ❌ 失败时恢复按钮状态
            if (setButtonLoading) {
                setButtonLoading(false);
            }
            
            alert('前端备选方案也失败了: ' + error.message);
        }
    }

    /**
     * 显示对话选择弹窗，让用户勾选要添加的对话内容
     */
    showChatSelectModal() {
        console.log('显示对话选择弹窗');
        
        // 检查是否有对话记录
        if (!this.chatMessages || this.chatMessages.length === 0) {
            alert('没有可选择的对话内容');
            return;
        }
        
        // 移除已存在的弹窗
        const existingModal = document.getElementById('chat-select-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 创建弹窗
        const modal = document.createElement('div');
        modal.id = 'chat-select-modal';
        modal.className = 'chat-select-modal';
        
        // 生成对话列表HTML
        const chatItemsHtml = this.chatMessages.map((msg, index) => {
            const roleText = msg.type === 'user' ? '👤 用户' : '🤖 AI';
            const roleClass = msg.type === 'user' ? 'user' : 'ai';
            const contentPreview = msg.content.length > 200 
                ? msg.content.substring(0, 200) + '...' 
                : msg.content;
            
            return `
                <div class="chat-select-item" data-index="${index}">
                    <input type="checkbox" id="chat-item-${index}" ${msg.type === 'ai' ? 'checked' : ''}>
                    <div class="chat-select-item-content">
                        <div class="chat-select-item-role ${roleClass}">${roleText}</div>
                        <div class="chat-select-item-text">${contentPreview}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        modal.innerHTML = `
            <div class="chat-select-content">
                <div class="chat-select-header">
                    <div class="chat-select-title">
                        <span>📝</span>
                        <span>选择要添加的对话内容</span>
                    </div>
                    <button class="close-btn" id="chatSelectCloseBtn">✕</button>
                </div>
                <div class="chat-select-body">
                    ${chatItemsHtml}
                </div>
                <div class="chat-select-footer">
                    <label class="select-all-label">
                        <input type="checkbox" id="chatSelectAll">
                        <span>全选</span>
                    </label>
                    <div class="chat-select-actions">
                        <button class="chat-select-cancel" id="chatSelectCancelBtn">取消</button>
                        <button class="chat-select-confirm" id="chatSelectConfirmBtn">确认添加</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定事件
        const closeBtn = modal.querySelector('#chatSelectCloseBtn');
        const cancelBtn = modal.querySelector('#chatSelectCancelBtn');
        const confirmBtn = modal.querySelector('#chatSelectConfirmBtn');
        const selectAllCheckbox = modal.querySelector('#chatSelectAll');
        const chatItems = modal.querySelectorAll('.chat-select-item');
        
        // 关闭弹窗
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // 点击对话项切换选中状态
        chatItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                item.classList.toggle('selected', item.querySelector('input').checked);
                this.updateSelectAllState(modal);
            });
        });
        
        // 全选/取消全选
        selectAllCheckbox.addEventListener('change', () => {
            const checkboxes = modal.querySelectorAll('.chat-select-item input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
                cb.closest('.chat-select-item').classList.toggle('selected', selectAllCheckbox.checked);
            });
        });
        
        // 初始化选中状态
        chatItems.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox.checked) {
                item.classList.add('selected');
            }
        });
        this.updateSelectAllState(modal);
        
        // 确认添加
        confirmBtn.addEventListener('click', () => {
            const selectedIndexes = [];
            modal.querySelectorAll('.chat-select-item input[type="checkbox"]:checked').forEach(cb => {
                const item = cb.closest('.chat-select-item');
                selectedIndexes.push(parseInt(item.dataset.index));
            });
            
            if (selectedIndexes.length === 0) {
                alert('请至少选择一条对话内容');
                return;
            }
            
            // 获取选中的对话内容
            const selectedMessages = selectedIndexes.map(i => this.chatMessages[i]);
            
            // 🔧 显示加载状态
            confirmBtn.textContent = '添加中...';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.7';
            cancelBtn.disabled = true;
            closeBtn.disabled = true;
            
            // 执行添加操作（传入回调来关闭弹窗）
            this.addSelectedChatsToNode(selectedMessages, () => {
                closeModal();
            }, (error) => {
                // 失败时恢复按钮状态
                confirmBtn.textContent = '确认添加';
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                cancelBtn.disabled = false;
                closeBtn.disabled = false;
            });
        });
    }
    
    /**
     * 更新全选复选框状态
     */
    updateSelectAllState(modal) {
        const allCheckboxes = modal.querySelectorAll('.chat-select-item input[type="checkbox"]');
        const checkedCheckboxes = modal.querySelectorAll('.chat-select-item input[type="checkbox"]:checked');
        const selectAllCheckbox = modal.querySelector('#chatSelectAll');
        
        if (checkedCheckboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length === allCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    /**
     * 将选中的对话内容添加为子节点
     * @param {Array} selectedMessages - 选中的对话消息
     * @param {Function} onSuccess - 成功回调
     * @param {Function} onError - 失败回调
     */
    async addSelectedChatsToNode(selectedMessages, onSuccess = null, onError = null) {
        console.log('添加选中的对话到子节点:', selectedMessages);
        
        // 获取所有"添加到子节点"按钮
        const addToNodeBtns = [
            document.querySelector('#splitAddToNodeBtn'),
            document.querySelector('#sidebarAddToNodeBtn')
        ].filter(btn => btn !== null);
        
        // 设置按钮加载状态
        const setButtonLoading = (loading) => {
            addToNodeBtns.forEach(btn => {
                if (loading) {
                    btn.textContent = '添加中...';
                    btn.disabled = true;
                    btn.style.opacity = '0.7';
                } else {
                    btn.textContent = '添加到子节点';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });
        };
        
        setButtonLoading(true);
        
        // 组合选中的对话内容
        const combinedContent = selectedMessages.map(msg => {
            const prefix = msg.type === 'user' ? '【用户问题】' : '【AI回答】';
            return prefix + msg.content;
        }).join('\n\n');
        
        try {
            // 调用API将内容整理成子节点
            const response = await fetch(`${this.apiBaseUrl}/add-child-nodes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parentNode: this.currentNode,
                    parentLevel: this.currentNodeLevel,
                    aiResponse: combinedContent,
                    currentMarkdown: this.mindmapData.markdown
                })
            });
            
            if (!response.ok) {
                throw new Error(`服务器错误 (${response.status})`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.mindmapData.markdown = data.data.markdown;
                this.mindmapData = data.data;
                this.renderMindmap(data.data.markdown);
                this.saveState();
                setButtonLoading(false);
                
                // 调用成功回调
                if (onSuccess) {
                    onSuccess();
                }
                
                this.showSuccessToast('已成功添加为子节点');
            } else {
                throw new Error(data.error || '添加失败');
            }
        } catch (error) {
            console.error('添加子节点失败:', error);
            setButtonLoading(false);
            
            // 提供备选方案
            if (confirm('API调用失败，是否使用简单文本处理方式添加？')) {
                // 使用备选方案，成功后也调用成功回调
                this.addAIToChildNodesFallback(combinedContent, (loading) => {
                    setButtonLoading(loading);
                    if (!loading && onSuccess) {
                        onSuccess();
                    }
                });
            } else {
                // 调用失败回调
                if (onError) {
                    onError(error);
                }
            }
        }
    }

    /**
     * 显示全局AI问答弹窗
     */
    showGlobalAiModal() {
        console.log('显示全局AI问答弹窗');
        
        if (!this.mindmapData || !this.mindmapData.markdown) {
            alert('请先生成思维导图');
            return;
        }
        
        // 移除已存在的弹窗
        const existingModal = document.getElementById('global-ai-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 创建弹窗
        const modal = document.createElement('div');
        modal.id = 'global-ai-modal';
        modal.className = 'global-ai-modal';
        
        modal.innerHTML = `
            <div class="global-ai-content">
                <div class="global-ai-header">
                    <div class="global-ai-title">
                        <span>💡</span>
                        <span>全局AI问答</span>
                    </div>
                    <div class="global-ai-header-actions">
                        <button class="switch-btn" id="globalAiSwitchToNode" title="切换到节点问答">🎯 节点问答</button>
                        <button class="switch-btn" id="globalAiSwitchToSidebar" title="切换为侧边栏">切换为侧边栏</button>
                        <button class="close-btn" id="globalAiCloseBtn">✕</button>
                    </div>
                </div>
                <div class="global-ai-body">
                    <div class="global-ai-input-section">
                        <label>向AI提问（AI能看到整个思维导图内容）：</label>
                        <div class="global-ai-input-wrapper">
                            <div id="globalAiFilePreview" class="file-preview"></div>
                            <div class="global-ai-input-row">
                                <button id="globalAiFileUploadBtn" class="file-upload-btn" title="上传图片或文件">📎</button>
                                <input type="file" id="globalAiFileInput" accept="image/*,application/pdf,.doc,.docx,.txt,.md" multiple style="display: none;">
                                <textarea id="globalAiInput" placeholder="例如：&#10;• 帮我补充"市场分析"这个部分的内容&#10;• 这个思维导图还缺少什么重要内容？&#10;• 帮我给整个思维导图写一个总结"></textarea>
                            </div>
                        </div>
                        <div class="global-ai-options">
                            <label>
                                <input type="radio" name="globalAiMode" value="integrate" checked>
                                <span>智能整合到思维导图</span>
                            </label>
                            <label>
                                <input type="radio" name="globalAiMode" value="answer">
                                <span>仅回答，不修改</span>
                            </label>
                        </div>
                    </div>
                    <div class="global-ai-preview-section">
                        <div class="global-ai-preview-title">
                            <span>📋</span>
                            <span>预览修改</span>
                        </div>
                        <div class="global-ai-preview-content" id="globalAiPreviewContent">
                            <div class="global-ai-preview-empty">
                                输入问题并点击"发送提问"后，这里将显示AI的回答和预览修改
                            </div>
                        </div>
                    </div>
                </div>
                <div class="global-ai-footer">
                    <div class="global-ai-footer-left">
                        <span id="globalAiStatus"></span>
                    </div>
                    <div class="global-ai-footer-actions">
                        <button class="global-ai-cancel-btn" id="globalAiCancelBtn">取消</button>
                        <button class="global-ai-ask-btn" id="globalAiAskBtn">发送提问</button>
                        <button class="global-ai-apply-btn" id="globalAiApplyBtn" disabled>应用修改</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 保存预览数据
        this.globalAiPreviewData = null;
        
        // 绑定事件
        const closeBtn = modal.querySelector('#globalAiCloseBtn');
        const cancelBtn = modal.querySelector('#globalAiCancelBtn');
        const askBtn = modal.querySelector('#globalAiAskBtn');
        const applyBtn = modal.querySelector('#globalAiApplyBtn');
        const inputTextarea = modal.querySelector('#globalAiInput');
        
        const closeModal = () => {
            modal.remove();
            this.globalAiPreviewData = null;
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // 切换到节点问答
        const switchToNodeBtn = modal.querySelector('#globalAiSwitchToNode');
        if (switchToNodeBtn) {
            switchToNodeBtn.addEventListener('click', () => {
                console.log('从全局问答切换到节点问答');
                closeModal();
                // 显示提示让用户选择节点
                this.showNodeSelectHint();
            });
        }
        
        // 切换为侧边栏
        const switchToSidebarBtn = modal.querySelector('#globalAiSwitchToSidebar');
        if (switchToSidebarBtn) {
            switchToSidebarBtn.addEventListener('click', () => {
                console.log('全局问答切换为侧边栏');
                // 保存当前输入和预览状态
                const currentQuestion = inputTextarea.value;
                const currentMode = modal.querySelector('input[name="globalAiMode"]:checked')?.value || 'integrate';
                closeModal();
                // 创建全局问答侧边栏
                this.showGlobalAiSidebar(currentQuestion, currentMode);
            });
        }
        
        // 🆕 初始化全局问答的上传文件数组
        this.globalUploadedFiles = [];
        
        // 🆕 绑定文件上传事件
        const fileUploadBtn = modal.querySelector('#globalAiFileUploadBtn');
        const fileInput = modal.querySelector('#globalAiFileInput');
        const filePreview = modal.querySelector('#globalAiFilePreview');
        
        if (fileUploadBtn && fileInput) {
            fileUploadBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleGlobalFileSelect(e, filePreview);
            });
        }
        
        // 发送提问
        askBtn.addEventListener('click', () => {
            const question = inputTextarea.value.trim();
            if (!question) {
                alert('请输入问题');
                return;
            }
            
            const mode = modal.querySelector('input[name="globalAiMode"]:checked').value;
            this.sendGlobalAiQuestion(question, mode, modal);
        });
        
        // 应用修改
        applyBtn.addEventListener('click', () => {
            if (this.globalAiPreviewData) {
                this.applyGlobalAiChanges(this.globalAiPreviewData, modal);
            }
        });
        
        // 关闭时清除上传文件
        const originalCloseModal = closeModal;
        const self = this;
        const newCloseModal = () => {
            self.globalUploadedFiles = [];
            originalCloseModal();
        };
        
        // 重新绑定关闭事件
        closeBtn.removeEventListener('click', closeModal);
        cancelBtn.removeEventListener('click', closeModal);
        closeBtn.addEventListener('click', newCloseModal);
        cancelBtn.addEventListener('click', newCloseModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) newCloseModal();
        });
        
        // 聚焦输入框
        setTimeout(() => inputTextarea.focus(), 100);
    }
    
    /**
     * 处理全局问答的文件选择
     */
    handleGlobalFileSelect(event, filePreviewContainer) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        console.log('📎 全局问答选择了', files.length, '个文件');
        
        for (const file of files) {
            // 检查文件大小（限制 10MB）
            if (file.size > 50 * 1024 * 1024) {
                alert(`文件 "${file.name}" 超过50MB限制`);
                continue;
            }
            
            // 避免重复添加
            if (!this.globalUploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.globalUploadedFiles.push(file);
                this.renderGlobalFilePreview(file, filePreviewContainer);
            }
        }
        
        // 清空 input 以便再次选择相同文件
        event.target.value = '';
    }
    
    /**
     * 渲染全局问答的文件预览
     */
    renderGlobalFilePreview(file, container) {
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        previewItem.dataset.filename = file.name;
        
        if (file.type.startsWith('image/')) {
            // 图片预览
            const reader = new FileReader();
            reader.onload = (e) => {
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="${this.escapeHtml(file.name)}" class="file-preview-image">
                    <button class="file-remove-btn" data-filename="${this.escapeHtml(file.name)}">✕</button>
                `;
                this.bindGlobalFileRemoveEvent(previewItem.querySelector('.file-remove-btn'), container);
            };
            reader.readAsDataURL(file);
        } else {
            // 非图片文件
            const fileIcon = this.getFileIcon(file.type, file.name);
            previewItem.innerHTML = `
                <div class="file-preview-doc">
                    <span class="file-icon">${fileIcon}</span>
                    <span class="file-name">${this.escapeHtml(file.name)}</span>
                </div>
                <button class="file-remove-btn" data-filename="${this.escapeHtml(file.name)}">✕</button>
            `;
            this.bindGlobalFileRemoveEvent(previewItem.querySelector('.file-remove-btn'), container);
        }
        
        container.appendChild(previewItem);
    }
    
    /**
     * 绑定全局问答文件移除事件
     */
    bindGlobalFileRemoveEvent(btn, container) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const filename = btn.dataset.filename;
            this.globalUploadedFiles = this.globalUploadedFiles.filter(f => f.name !== filename);
            const previewItem = container.querySelector(`[data-filename="${filename}"]`);
            if (previewItem) {
                previewItem.remove();
            }
            console.log('🗑️ 已移除全局问答文件:', filename);
        });
    }
    
    /**
     * 发送全局AI问答请求
     */
    async sendGlobalAiQuestion(question, mode, modal) {
        const previewContent = modal.querySelector('#globalAiPreviewContent');
        const askBtn = modal.querySelector('#globalAiAskBtn');
        const applyBtn = modal.querySelector('#globalAiApplyBtn');
        const statusEl = modal.querySelector('#globalAiStatus');
        const filePreview = modal.querySelector('#globalAiFilePreview');
        
        // 显示加载状态
        previewContent.innerHTML = `
            <div class="global-ai-preview-loading">
                <div class="loading-spinner">🔄</div>
                <div>AI正在思考中...</div>
            </div>
        `;
        askBtn.disabled = true;
        askBtn.textContent = '处理中...';
        applyBtn.disabled = true;
        
        try {
            let requestOptions;
            
            // 🆕 如果有文件，使用 FormData
            if (this.globalUploadedFiles && this.globalUploadedFiles.length > 0) {
                const formData = new FormData();
                formData.append('question', question);
                formData.append('mode', mode);
                formData.append('currentMarkdown', this.mindmapData.markdown);
                formData.append('pageTitle', document.title);
                formData.append('pageUrl', window.location.href);
                
                // 添加所有文件
                this.globalUploadedFiles.forEach((file) => {
                    formData.append('files', file);
                });
                
                requestOptions = {
                    method: 'POST',
                    body: formData
                };
                
                console.log('📤 全局问答使用FormData发送，包含', this.globalUploadedFiles.length, '个文件');
                
                // 清空文件预览
                if (filePreview) {
                    filePreview.innerHTML = '';
                }
                this.globalUploadedFiles = [];
            } else {
                // 没有文件，使用 JSON
                requestOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: question,
                        mode: mode,
                        currentMarkdown: this.mindmapData.markdown,
                        pageTitle: document.title,
                        pageUrl: window.location.href
                    })
                };
            }
            
            const response = await fetch(`${this.apiBaseUrl}/global-chat`, requestOptions);
            
            if (!response.ok) {
                throw new Error(`服务器错误 (${response.status})`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                if (mode === 'integrate' && data.data.changes) {
                    // 显示修改预览
                    this.globalAiPreviewData = data.data;
                    this.showGlobalAiPreview(data.data, previewContent);
                    applyBtn.disabled = false;
                    statusEl.textContent = `✅ AI建议进行 ${data.data.changes.length} 处修改`;
                } else {
                    // 仅显示回答
                    previewContent.innerHTML = `
                        <div class="global-ai-diff">
                            <div style="white-space: pre-wrap; line-height: 1.6;">${data.data.answer || data.data.response || '无回答内容'}</div>
                        </div>
                    `;
                    statusEl.textContent = '✅ AI已回答';
                }
            } else {
                throw new Error(data.error || '请求失败');
            }
        } catch (error) {
            console.error('全局AI问答失败:', error);
            previewContent.innerHTML = `
                <div class="global-ai-preview-empty" style="color: #f44336;">
                    ❌ 请求失败: ${error.message}
                </div>
            `;
            statusEl.textContent = '❌ 请求失败';
        } finally {
            askBtn.disabled = false;
            askBtn.textContent = '发送提问';
        }
    }
    
    /**
     * 显示全局AI修改预览
     */
    showGlobalAiPreview(data, container) {
        const changes = data.changes || [];
        
        if (changes.length === 0) {
            container.innerHTML = `
                <div class="global-ai-preview-empty">
                    AI没有建议任何修改
                </div>
            `;
            return;
        }
        
        const changesHtml = changes.map(change => {
            let icon = '➕';
            let type = 'add';
            
            if (change.type === 'modify') {
                icon = '✏️';
                type = 'modify';
            } else if (change.type === 'delete') {
                icon = '🗑️';
                type = 'delete';
            }
            
            return `
                <div class="global-ai-diff-item ${type}">
                    <span class="global-ai-diff-icon">${icon}</span>
                    <div class="global-ai-diff-text">
                        <div>${change.content}</div>
                        ${change.location ? `<div class="global-ai-diff-location">📍 位置：${change.location}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="global-ai-diff">
                ${data.explanation ? `<div style="margin-bottom: 12px; padding: 12px; background: #e3f2fd; border-radius: 6px; font-size: 13px;">${data.explanation}</div>` : ''}
                ${changesHtml}
            </div>
        `;
    }
    
    /**
     * 应用全局AI修改
     */
    async applyGlobalAiChanges(previewData, modal) {
        const applyBtn = modal.querySelector('#globalAiApplyBtn');
        const statusEl = modal.querySelector('#globalAiStatus');
        
        applyBtn.disabled = true;
        applyBtn.textContent = '应用中...';
        statusEl.textContent = '正在应用修改...';
        
        try {
            // 如果后端返回了新的markdown，直接使用
            if (previewData.newMarkdown) {
                this.mindmapData.markdown = previewData.newMarkdown;
                this.renderMindmap(previewData.newMarkdown);
                
                // 展开所有节点
                this.expandAllNodes();
                
                this.saveState();
                
                this.showSuccessToast('修改已应用');
                modal.remove();
                this.globalAiPreviewData = null;
            } else {
                throw new Error('没有可应用的修改');
            }
        } catch (error) {
            console.error('应用修改失败:', error);
            statusEl.textContent = '❌ 应用失败: ' + error.message;
            applyBtn.disabled = false;
            applyBtn.textContent = '应用修改';
        }
    }

    // 显示成功提示弹窗
    showSuccessToast(message) {
        // 移除已存在的提示弹窗
        const existingToast = document.getElementById('success-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // 创建提示弹窗
        const toast = document.createElement('div');
        toast.id = 'success-toast';
        toast.className = 'success-toast';
        toast.textContent = message;
        
        // 添加到body
        document.body.appendChild(toast);
        
        // 触发动画
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // 3秒后自动消失
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300); // 等待淡出动画完成
        }, 3000);
    }
    
    /**
     * 显示节点选择提示
     * 引导用户点击思维导图节点进行节点问答
     */
    showNodeSelectHint() {
        // 移除已存在的提示
        const existingHint = document.getElementById('node-select-hint');
        if (existingHint) {
            existingHint.remove();
        }
        
        const hint = document.createElement('div');
        hint.id = 'node-select-hint';
        hint.className = 'node-select-hint';
        hint.innerHTML = `
            <div class="node-select-hint-content">
                <span class="hint-icon">🎯</span>
                <span class="hint-text">请点击思维导图中的节点小灯泡 💡 进行节点问答</span>
                <button class="hint-close" id="nodeSelectHintClose">✕</button>
            </div>
        `;
        
        document.body.appendChild(hint);
        
        // 绑定关闭事件
        const closeBtn = hint.querySelector('#nodeSelectHintClose');
        closeBtn.addEventListener('click', () => hint.remove());
        
        // 5秒后自动消失
        setTimeout(() => {
            if (hint.parentNode) {
                hint.classList.add('fade-out');
                setTimeout(() => hint.remove(), 300);
            }
        }, 5000);
    }
    
    /**
     * 显示全局AI问答侧边栏
     */
    showGlobalAiSidebar(initialQuestion = '', initialMode = 'integrate') {
        console.log('=== 创建全局AI问答侧边栏 ===');
        
        if (!this.mindmapData || !this.mindmapData.markdown) {
            alert('请先生成思维导图');
            return;
        }
        
        // 移除已存在的侧边栏
        const existingSidebar = document.getElementById('globalAiSidebar');
        if (existingSidebar) {
            existingSidebar.remove();
        }
        const existingDivider = document.getElementById('globalAiSidebarDivider');
        if (existingDivider) {
            existingDivider.remove();
        }
        
        // 获取思维导图内容容器
        const mindmapFullInterface = this.rightPanel.querySelector('.mindmap-full-interface');
        if (!mindmapFullInterface) {
            console.error('未找到思维导图界面容器');
            return;
        }
        
        // 创建内容包装器
        let contentWrapper = this.rightPanel.querySelector('.content-wrapper-with-global-sidebar');
        if (!contentWrapper) {
            contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper-with-global-sidebar';
            contentWrapper.style.cssText = 'display: flex; flex: 1; min-height: 0; overflow: hidden;';
            
            // 将 popup-main 移动到包装器中
            const popupMain = mindmapFullInterface.querySelector('.popup-main');
            if (popupMain) {
                const popupMainParent = popupMain.parentNode;
                popupMainParent.insertBefore(contentWrapper, popupMain);
                contentWrapper.appendChild(popupMain);
            }
        }
        
        // 创建侧边栏
        const sidebar = document.createElement('div');
        sidebar.id = 'globalAiSidebar';
        sidebar.className = 'global-ai-sidebar';
        sidebar.style.width = (this.globalSidebarWidth || 400) + 'px';
        sidebar.style.flexShrink = '0';
        
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-title">
                    <span class="ai-icon">💡</span>
                    <span>全局AI问答</span>
                </div>
                <div class="sidebar-header-actions">
                    <button id="globalSidebarSwitchToNode" class="switch-btn" title="切换到节点问答">🎯 节点</button>
                    <button id="globalSidebarSwitchToModal" class="switch-btn" title="切换为弹窗">弹窗</button>
                    <button id="globalSidebarCloseBtn" class="close-btn">✕</button>
                </div>
            </div>
            
            <div class="global-ai-sidebar-body">
                <div class="global-ai-input-section">
                    <label>向AI提问（AI能看到整个思维导图）：</label>
                    <div id="globalSidebarFilePreview" class="file-preview"></div>
                    <div class="global-ai-sidebar-input-row">
                        <button id="globalSidebarFileUploadBtn" class="file-upload-btn" title="上传图片或文件">📎</button>
                        <input type="file" id="globalSidebarFileInput" accept="image/*,application/pdf,.doc,.docx,.txt,.md" multiple style="display: none;">
                        <textarea id="globalSidebarInput" placeholder="例如：帮我补充某个部分的内容...">${initialQuestion}</textarea>
                    </div>
                    <div class="global-ai-options">
                        <label>
                            <input type="radio" name="globalSidebarMode" value="integrate" ${initialMode === 'integrate' ? 'checked' : ''}>
                            <span>整合到导图</span>
                        </label>
                        <label>
                            <input type="radio" name="globalSidebarMode" value="answer" ${initialMode === 'answer' ? 'checked' : ''}>
                            <span>仅回答</span>
                        </label>
                    </div>
                    <div class="global-ai-sidebar-actions">
                        <button id="globalSidebarAskBtn" class="global-ai-ask-btn">发送提问</button>
                    </div>
                </div>
                <div class="global-ai-preview-section">
                    <div class="global-ai-preview-title">
                        <span>📋</span>
                        <span>预览</span>
                    </div>
                    <div class="global-ai-preview-content" id="globalSidebarPreviewContent">
                        <div class="global-ai-preview-empty">
                            输入问题后点击发送
                        </div>
                    </div>
                    <div class="global-ai-sidebar-apply">
                        <span id="globalSidebarStatus"></span>
                        <button id="globalSidebarApplyBtn" class="global-ai-apply-btn" disabled>应用修改</button>
                    </div>
                </div>
            </div>
        `;
        
        // 创建分割线
        const sidebarDivider = document.createElement('div');
        sidebarDivider.id = 'globalAiSidebarDivider';
        sidebarDivider.className = 'sidebar-divider';
        sidebarDivider.style.cursor = 'ew-resize';
        
        // 添加到容器
        contentWrapper.appendChild(sidebarDivider);
        contentWrapper.appendChild(sidebar);
        
        // 保存预览数据
        this.globalSidebarPreviewData = null;
        
        // 绑定事件
        this.bindGlobalAiSidebarEvents(sidebar, sidebarDivider);
        
        // 聚焦输入框
        setTimeout(() => {
            const input = sidebar.querySelector('#globalSidebarInput');
            if (input) input.focus();
        }, 100);
    }
    
    /**
     * 绑定全局AI侧边栏事件
     */
    bindGlobalAiSidebarEvents(sidebar, divider) {
        const self = this;
        
        // 🆕 初始化侧边栏的上传文件数组
        this.globalSidebarUploadedFiles = [];
        
        // 关闭侧边栏
        const closeBtn = sidebar.querySelector('#globalSidebarCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.globalSidebarUploadedFiles = [];
                this.closeGlobalAiSidebar();
            });
        }
        
        // 切换到节点问答
        const switchToNodeBtn = sidebar.querySelector('#globalSidebarSwitchToNode');
        if (switchToNodeBtn) {
            switchToNodeBtn.addEventListener('click', () => {
                console.log('从全局侧边栏切换到节点问答');
                this.globalSidebarUploadedFiles = [];
                this.closeGlobalAiSidebar();
                this.showNodeSelectHint();
            });
        }
        
        // 切换为弹窗
        const switchToModalBtn = sidebar.querySelector('#globalSidebarSwitchToModal');
        if (switchToModalBtn) {
            switchToModalBtn.addEventListener('click', () => {
                console.log('全局侧边栏切换为弹窗');
                const currentQuestion = sidebar.querySelector('#globalSidebarInput')?.value || '';
                const currentMode = sidebar.querySelector('input[name="globalSidebarMode"]:checked')?.value || 'integrate';
                this.globalSidebarUploadedFiles = [];
                this.closeGlobalAiSidebar();
                this.showGlobalAiModal();
                // 恢复输入
                setTimeout(() => {
                    const modal = document.getElementById('global-ai-modal');
                    if (modal) {
                        const input = modal.querySelector('#globalAiInput');
                        if (input && currentQuestion) input.value = currentQuestion;
                        const radio = modal.querySelector(`input[name="globalAiMode"][value="${currentMode}"]`);
                        if (radio) radio.checked = true;
                    }
                }, 100);
            });
        }
        
        // 🆕 绑定文件上传事件
        const fileUploadBtn = sidebar.querySelector('#globalSidebarFileUploadBtn');
        const fileInput = sidebar.querySelector('#globalSidebarFileInput');
        const filePreview = sidebar.querySelector('#globalSidebarFilePreview');
        
        if (fileUploadBtn && fileInput) {
            fileUploadBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleGlobalSidebarFileSelect(e, filePreview);
            });
        }
        
        // 发送提问
        const askBtn = sidebar.querySelector('#globalSidebarAskBtn');
        if (askBtn) {
            askBtn.addEventListener('click', () => {
                const question = sidebar.querySelector('#globalSidebarInput')?.value?.trim();
                if (!question) {
                    alert('请输入问题');
                    return;
                }
                const mode = sidebar.querySelector('input[name="globalSidebarMode"]:checked')?.value || 'integrate';
                this.sendGlobalAiQuestionFromSidebar(question, mode, sidebar);
            });
        }
        
        // 应用修改
        const applyBtn = sidebar.querySelector('#globalSidebarApplyBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (this.globalSidebarPreviewData) {
                    this.applyGlobalAiChangesFromSidebar(this.globalSidebarPreviewData, sidebar);
                }
            });
        }
        
        // 分割线拖动
        if (divider) {
            divider.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.isDraggingGlobalSidebar = true;
                const startX = e.clientX;
                const startWidth = sidebar.offsetWidth;
                
                const onMouseMove = (e) => {
                    if (!this.isDraggingGlobalSidebar) return;
                    const diff = startX - e.clientX;
                    let newWidth = startWidth + diff;
                    newWidth = Math.max(300, Math.min(800, newWidth));
                    this.globalSidebarWidth = newWidth;
                    sidebar.style.width = newWidth + 'px';
                };
                
                const onMouseUp = () => {
                    this.isDraggingGlobalSidebar = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }
    }
    
    /**
     * 关闭全局AI侧边栏
     */
    closeGlobalAiSidebar() {
        const sidebar = document.getElementById('globalAiSidebar');
        const divider = document.getElementById('globalAiSidebarDivider');
        
        if (sidebar) sidebar.remove();
        if (divider) divider.remove();
        
        // 恢复布局
        const contentWrapper = this.rightPanel.querySelector('.content-wrapper-with-global-sidebar');
        if (contentWrapper) {
            const popupMain = contentWrapper.querySelector('.popup-main');
            if (popupMain) {
                const mindmapFullInterface = this.rightPanel.querySelector('.mindmap-full-interface');
                if (mindmapFullInterface) {
                    contentWrapper.remove();
                    mindmapFullInterface.insertBefore(popupMain, mindmapFullInterface.querySelector('.popup-footer'));
                }
            } else {
                contentWrapper.remove();
            }
        }
        
        this.globalSidebarPreviewData = null;
    }
    
    /**
     * 处理全局侧边栏的文件选择
     */
    handleGlobalSidebarFileSelect(event, filePreviewContainer) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        console.log('📎 全局侧边栏选择了', files.length, '个文件');
        
        for (const file of files) {
            if (file.size > 50 * 1024 * 1024) {
                alert(`文件 "${file.name}" 超过50MB限制`);
                continue;
            }
            
            if (!this.globalSidebarUploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.globalSidebarUploadedFiles.push(file);
                this.renderGlobalSidebarFilePreview(file, filePreviewContainer);
            }
        }
        
        event.target.value = '';
    }
    
    /**
     * 渲染全局侧边栏的文件预览
     */
    renderGlobalSidebarFilePreview(file, container) {
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        previewItem.dataset.filename = file.name;
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="${this.escapeHtml(file.name)}" class="file-preview-image">
                    <button class="file-remove-btn" data-filename="${this.escapeHtml(file.name)}">✕</button>
                `;
                this.bindGlobalSidebarFileRemoveEvent(previewItem.querySelector('.file-remove-btn'), container);
            };
            reader.readAsDataURL(file);
        } else {
            const fileIcon = this.getFileIcon(file.type, file.name);
            previewItem.innerHTML = `
                <div class="file-preview-doc">
                    <span class="file-icon">${fileIcon}</span>
                    <span class="file-name">${this.escapeHtml(file.name)}</span>
                </div>
                <button class="file-remove-btn" data-filename="${this.escapeHtml(file.name)}">✕</button>
            `;
            this.bindGlobalSidebarFileRemoveEvent(previewItem.querySelector('.file-remove-btn'), container);
        }
        
        container.appendChild(previewItem);
    }
    
    /**
     * 绑定全局侧边栏文件移除事件
     */
    bindGlobalSidebarFileRemoveEvent(btn, container) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const filename = btn.dataset.filename;
            this.globalSidebarUploadedFiles = this.globalSidebarUploadedFiles.filter(f => f.name !== filename);
            const previewItem = container.querySelector(`[data-filename="${filename}"]`);
            if (previewItem) {
                previewItem.remove();
            }
            console.log('🗑️ 已移除全局侧边栏文件:', filename);
        });
    }
    
    /**
     * 从侧边栏发送全局AI问题
     */
    async sendGlobalAiQuestionFromSidebar(question, mode, sidebar) {
        const previewContent = sidebar.querySelector('#globalSidebarPreviewContent');
        const askBtn = sidebar.querySelector('#globalSidebarAskBtn');
        const applyBtn = sidebar.querySelector('#globalSidebarApplyBtn');
        const statusEl = sidebar.querySelector('#globalSidebarStatus');
        const filePreview = sidebar.querySelector('#globalSidebarFilePreview');
        
        // 显示加载状态
        previewContent.innerHTML = `
            <div class="global-ai-preview-loading">
                <div class="loading-spinner">🔄</div>
                <div>AI正在思考中...</div>
            </div>
        `;
        askBtn.disabled = true;
        askBtn.textContent = '处理中...';
        applyBtn.disabled = true;
        
        try {
            let requestOptions;
            
            // 🆕 如果有文件，使用 FormData
            if (this.globalSidebarUploadedFiles && this.globalSidebarUploadedFiles.length > 0) {
                const formData = new FormData();
                formData.append('question', question);
                formData.append('mode', mode);
                formData.append('currentMarkdown', this.mindmapData.markdown);
                formData.append('pageTitle', document.title);
                formData.append('pageUrl', window.location.href);
                
                this.globalSidebarUploadedFiles.forEach((file) => {
                    formData.append('files', file);
                });
                
                requestOptions = {
                    method: 'POST',
                    body: formData
                };
                
                console.log('📤 全局侧边栏使用FormData发送，包含', this.globalSidebarUploadedFiles.length, '个文件');
                
                // 清空文件预览
                if (filePreview) {
                    filePreview.innerHTML = '';
                }
                this.globalSidebarUploadedFiles = [];
            } else {
                requestOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question,
                        mode,
                        currentMarkdown: this.mindmapData.markdown,
                        pageTitle: document.title,
                        pageUrl: window.location.href
                    })
                };
            }
            
            const response = await fetch(`${this.apiBaseUrl}/global-chat`, requestOptions);
            
            if (!response.ok) {
                throw new Error(`服务器错误 (${response.status})`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                if (mode === 'integrate' && data.data.changes) {
                    this.globalSidebarPreviewData = data.data;
                    this.showGlobalAiPreview(data.data, previewContent);
                    applyBtn.disabled = false;
                    statusEl.textContent = `✅ ${data.data.changes.length} 处修改`;
                } else {
                    previewContent.innerHTML = `
                        <div class="global-ai-diff">
                            <div style="white-space: pre-wrap; line-height: 1.6; font-size: 13px;">${data.data.answer || data.data.response || '无回答'}</div>
                        </div>
                    `;
                    statusEl.textContent = '✅ 已回答';
                }
            } else {
                throw new Error(data.error || '请求失败');
            }
        } catch (error) {
            console.error('全局AI问答失败:', error);
            previewContent.innerHTML = `
                <div class="global-ai-preview-empty" style="color: #f44336;">
                    ❌ ${error.message}
                </div>
            `;
            statusEl.textContent = '❌ 失败';
        } finally {
            askBtn.disabled = false;
            askBtn.textContent = '发送提问';
        }
    }
    
    /**
     * 从侧边栏应用全局AI修改
     */
    async applyGlobalAiChangesFromSidebar(previewData, sidebar) {
        const applyBtn = sidebar.querySelector('#globalSidebarApplyBtn');
        const statusEl = sidebar.querySelector('#globalSidebarStatus');
        
        applyBtn.disabled = true;
        applyBtn.textContent = '应用中...';
        statusEl.textContent = '正在应用...';
        
        try {
            if (previewData.newMarkdown) {
                this.mindmapData.markdown = previewData.newMarkdown;
                this.renderMindmap(previewData.newMarkdown);
                
                // 展开所有节点
                this.expandAllNodes();
                
                this.saveState();
                
                this.showSuccessToast('修改已应用');
                statusEl.textContent = '✅ 已应用';
                applyBtn.textContent = '已应用';
                
                // 清空预览
                this.globalSidebarPreviewData = null;
            } else {
                throw new Error('没有可应用的修改');
            }
        } catch (error) {
            console.error('应用修改失败:', error);
            statusEl.textContent = '❌ ' + error.message;
            applyBtn.disabled = false;
            applyBtn.textContent = '应用修改';
        }
    }

    // 切换到侧边栏模式
    switchToSidebar() {
        console.log('=== 切换到侧边栏模式 ===');
        
        // 关闭弹窗
        const modal = document.getElementById('splitAIModal');
        if (modal) {
            modal.remove();
        }
        
        // 创建侧边栏
        this.createAISidebar();
    }
    
    // 创建侧边栏形式的AI问答界面
    createAISidebar() {
        // 移除已存在的侧边栏和分割线
        const existingSidebar = document.getElementById('splitAISidebar');
        const existingDivider = document.getElementById('sidebarDivider');
        if (existingSidebar) {
            existingSidebar.remove();
        }
        if (existingDivider) {
            existingDivider.remove();
        }
        
        // 确保右侧面板存在
        if (!this.rightPanel) {
            console.error('❌ 右侧面板不存在，无法创建侧边栏');
            return;
        }
        
        // 获取思维导图内容容器
        const mindmapFullInterface = this.rightPanel.querySelector('.mindmap-full-interface');
        if (!mindmapFullInterface) {
            console.error('❌ 找不到思维导图内容容器');
            return;
        }
        
        // 获取主要内容区域
        const popupMain = mindmapFullInterface.querySelector('.popup-main');
        if (!popupMain) {
            console.error('❌ 找不到主要内容区域');
            return;
        }
        
        // 创建一个横向容器来包裹思维导图内容和侧边栏
        let contentWrapper = mindmapFullInterface.querySelector('.content-wrapper-with-sidebar');
        if (!contentWrapper) {
            contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper-with-sidebar';
            contentWrapper.style.display = 'flex';
            contentWrapper.style.flexDirection = 'row';
            contentWrapper.style.flex = '1';
            contentWrapper.style.minHeight = '0';
            contentWrapper.style.overflow = 'hidden';
            
            // 将popup-main移动到新容器中
            popupMain.parentNode.insertBefore(contentWrapper, popupMain);
            contentWrapper.appendChild(popupMain);
        }
        
        // 创建侧边栏容器
        const sidebar = document.createElement('div');
        sidebar.id = 'splitAISidebar';
        sidebar.className = 'ai-sidebar';
        sidebar.style.width = this.sidebarWidth + 'px';
        sidebar.style.flexShrink = '0';
        
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-title">
                    <span class="ai-icon">🤖</span>
                    <span>AI助手</span>
                    <span id="sidebarCurrentNode" class="current-node"></span>
                </div>
                <div class="sidebar-header-actions">
                    <button id="sidebarSwitchToGlobal" class="switch-btn" title="切换到全局问答">💡 全局</button>
                    <button id="sidebarSwitchToModal" class="switch-btn" title="切换为弹窗">弹窗</button>
                    <button id="sidebarCloseBtn" class="close-btn">✕</button>
                </div>
            </div>
            
            <div id="sidebarChatMessages" class="chat-messages"></div>
            
            <div class="chat-input-container">
                <div id="sidebarFilePreview" class="file-preview"></div>
                <div class="chat-input">
                    <button id="sidebarFileUploadBtn" class="file-upload-btn" title="上传图片或文件">📎</button>
                    <input type="file" id="sidebarFileInput" accept="image/*,application/pdf,.doc,.docx,.txt,.md" multiple style="display: none;">
                    <textarea id="sidebarChatInput" placeholder="输入您的问题..." rows="1"></textarea>
                    <button id="sidebarSendBtn">发送</button>
                    <button id="sidebarAddToNodeBtn" title="把AI回答内容整理为该节点的子节点">添加到子节点</button>
                </div>
            </div>
        `;
        
        // 创建侧边栏分割线
        const sidebarDivider = document.createElement('div');
        sidebarDivider.id = 'sidebarDivider';
        sidebarDivider.className = 'sidebar-divider';
        sidebarDivider.style.cursor = 'ew-resize';
        
        // 将分割线和侧边栏添加到内容包装器
        contentWrapper.appendChild(sidebarDivider);
        contentWrapper.appendChild(sidebar);
        
        // 绑定分割线拖动事件
        this.bindSidebarDividerEvents(sidebarDivider, sidebar);
        
        // 更新当前节点显示
        const currentNodeSpan = sidebar.querySelector('#sidebarCurrentNode');
        if (currentNodeSpan && this.currentNode) {
            currentNodeSpan.textContent = ` - ${this.currentNode}`;
        }
        
        // 重新渲染消息（如果有的话）
        if (this.chatMessages && this.chatMessages.length > 0) {
            this.renderChatMessages();
        }
        
        // 绑定事件
        this.bindSidebarEvents(sidebar);
        
        console.log('✅ 侧边栏已创建');
    }
    
    // 绑定侧边栏事件
    bindSidebarEvents(sidebar) {
        // 绑定"切换到全局问答"按钮事件
        const switchToGlobalBtn = sidebar.querySelector('#sidebarSwitchToGlobal');
        if (switchToGlobalBtn) {
            switchToGlobalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('侧边栏切换到全局问答按钮被点击');
                
                // 检查是否有思维导图数据
                if (!this.mindmapData || !this.mindmapData.markdown) {
                    alert('请先生成思维导图');
                    return;
                }
                
                // 关闭侧边栏
                this.closeSidebar();
                
                // 打开全局问答弹窗
                this.showGlobalAiModal();
            });
        }
        
        // 绑定"切换为弹窗"按钮事件
        const switchToModalBtn = sidebar.querySelector('#sidebarSwitchToModal');
        if (switchToModalBtn) {
            switchToModalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('切换为弹窗按钮被点击');
                this.switchToModal();
            });
        }
        
        // 绑定关闭按钮事件
        const closeBtn = sidebar.querySelector('#sidebarCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('侧边栏关闭按钮被点击');
                this.closeSidebar();
            });
        }
        
        // 绑定发送按钮事件
        const sendBtn = sidebar.querySelector('#sidebarSendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ 侧边栏发送按钮被点击');
                try {
                    this.sendMessage();
                } catch (error) {
                    console.error('❌ 发送消息时出错:', error);
                }
            });
        }
        
        // 绑定输入框回车事件
        const chatInput = sidebar.querySelector('#sidebarChatInput');
        if (chatInput) {
            // 自动调整高度
            const adjustHeight = () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = chatInput.scrollHeight + 'px';
            };
            chatInput.addEventListener('input', adjustHeight);
            
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✅ 侧边栏输入框回车键被按下');
                    try {
                        this.sendMessage();
                    } catch (error) {
                        console.error('❌ 发送消息时出错:', error);
                    }
                }
            });
        }
        
        // 绑定"添加到子节点"按钮事件
        const addToNodeBtn = sidebar.querySelector('#sidebarAddToNodeBtn');
        if (addToNodeBtn) {
            addToNodeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ 侧边栏"添加到子节点"按钮被点击');
                try {
                    this.addAIToChildNodes();
                } catch (error) {
                    console.error('❌ 添加到子节点时出错:', error);
                    alert('添加到子节点失败: ' + error.message);
                }
            });
        }
        
        // 绑定文件上传按钮事件
        const fileUploadBtn = sidebar.querySelector('#sidebarFileUploadBtn');
        const fileInput = sidebar.querySelector('#sidebarFileInput');
        const filePreview = sidebar.querySelector('#sidebarFilePreview');
        
        if (fileUploadBtn && fileInput) {
            fileUploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e, filePreview);
            });
        }
        
        // 绑定粘贴事件
        if (chatInput) {
            chatInput.addEventListener('paste', async (e) => {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        e.preventDefault();
                        const file = items[i].getAsFile();
                        if (file) {
                            this.uploadedFiles = this.uploadedFiles || [];
                            this.uploadedFiles.push(file);
                            this.renderFilePreview(file, filePreview);
                        }
                    }
                }
            });
        }
        
        // 聚焦输入框
        if (chatInput) {
            setTimeout(() => {
                chatInput.focus();
            }, 100);
        }
    }
    
    // 关闭侧边栏
    closeSidebar() {
        console.log('=== 关闭侧边栏 ===');
        
        // 移除侧边栏和分割线
        const sidebar = document.getElementById('splitAISidebar');
        const sidebarDivider = document.getElementById('sidebarDivider');
        if (sidebar) {
            sidebar.remove();
        }
        if (sidebarDivider) {
            sidebarDivider.remove();
        }
        
        // 恢复思维导图内容容器的布局
        const contentWrapper = this.rightPanel.querySelector('.content-wrapper-with-sidebar');
        if (contentWrapper) {
            const popupMain = contentWrapper.querySelector('.popup-main');
            if (popupMain) {
                // 将popup-main移回原位置
                const mindmapFullInterface = this.rightPanel.querySelector('.mindmap-full-interface');
                if (mindmapFullInterface) {
                    contentWrapper.remove();
                    mindmapFullInterface.insertBefore(popupMain, mindmapFullInterface.querySelector('.popup-footer'));
                }
            } else {
                contentWrapper.remove();
            }
        }
    }
    
    // 切换到弹窗模式
    switchToModal() {
        console.log('=== 切换到弹窗模式 ===');
        
        // 关闭侧边栏
        this.closeSidebar();
        
        // 创建弹窗
        this.createAIModal();
    }
    
    // 绑定侧边栏分割线拖动事件
    bindSidebarDividerEvents(divider, sidebar) {
        divider.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDraggingSidebar = true;
            const startX = e.clientX;
            const startWidth = sidebar.offsetWidth;
            
            const onMouseMove = (e) => {
                if (!this.isDraggingSidebar) return;
                
                const diff = startX - e.clientX; // 向左拖动时，clientX减小，diff增大
                let newWidth = startWidth + diff;
                
                // 限制最小和最大宽度
                const minWidth = 300;
                const maxWidth = 800;
                newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                
                this.sidebarWidth = newWidth;
                sidebar.style.width = newWidth + 'px';
                
                // 动态调整输入框布局
                this.adjustSidebarInputLayout(sidebar);
            };
            
            const onMouseUp = () => {
                this.isDraggingSidebar = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                // 拖动结束后再次调整布局
                this.adjustSidebarInputLayout(sidebar);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        // 使用ResizeObserver监听侧边栏宽度变化
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                this.adjustSidebarInputLayout(sidebar);
            });
            resizeObserver.observe(sidebar);
        }
    }
    
    // 根据侧边栏宽度动态调整输入框布局
    adjustSidebarInputLayout(sidebar) {
        const chatInput = sidebar.querySelector('.chat-input');
        if (!chatInput) return;
        
        const sidebarWidth = sidebar.offsetWidth;
        const isNarrow = sidebarWidth < 400;
        
        if (isNarrow) {
            chatInput.style.flexDirection = 'column';
            chatInput.style.alignItems = 'stretch';
            
            const textarea = chatInput.querySelector('textarea');
            const buttons = chatInput.querySelectorAll('button');
            
            if (textarea) {
                textarea.style.width = '100%';
                textarea.style.minWidth = '100%';
                textarea.style.marginBottom = '8px';
            }
            
            buttons.forEach((btn, index) => {
                btn.style.width = '100%';
                btn.style.margin = '0';
                if (index < buttons.length - 1) {
                    btn.style.marginBottom = '8px';
                }
            });
        } else {
            chatInput.style.flexDirection = '';
            chatInput.style.alignItems = '';
            
            const textarea = chatInput.querySelector('textarea');
            const buttons = chatInput.querySelectorAll('button');
            
            if (textarea) {
                textarea.style.width = '';
                textarea.style.minWidth = '';
                textarea.style.marginBottom = '';
            }
            
            buttons.forEach(btn => {
                btn.style.width = '';
                btn.style.margin = '';
                btn.style.marginBottom = '';
            });
        }
    }

    // 生成当前页面的存储key
    getStorageKey() {
        // 使用URL的hash来生成唯一key，避免key过长
        const url = window.location.href;
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            const char = url.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `mindmap-state-${Math.abs(hash)}`;
    }
    
    // 状态保存和恢复方法
    saveState() {
        if (this.mindmapData) {
            const state = {
                mindmapData: this.mindmapData,
                leftPanelWidth: this.leftPanelWidth,
                rightPanelWidth: this.rightPanelWidth,
                isActive: this.isActive,
                pageUrl: window.location.href,
                pageTitle: document.title,
                generatedTime: this.mindmapGeneratedTime,
                savedAt: new Date().toISOString()
            };
            
            const storageKey = this.getStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(state));
            
            // 同时更新页面索引（用于管理多个页面的状态）
            this.updatePageIndex(storageKey, state.pageUrl, state.pageTitle);
            
            console.log('状态已保存:', storageKey);
        }
    }
    
    // 更新页面索引
    updatePageIndex(storageKey, pageUrl, pageTitle) {
        try {
            let pageIndex = JSON.parse(localStorage.getItem('mindmap-page-index') || '{}');
            pageIndex[storageKey] = {
                url: pageUrl,
                title: pageTitle,
                savedAt: new Date().toISOString()
            };
            
            // 清理过期的索引（超过7天的）
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            Object.keys(pageIndex).forEach(key => {
                const savedTime = new Date(pageIndex[key].savedAt).getTime();
                if (savedTime < sevenDaysAgo) {
                    delete pageIndex[key];
                    localStorage.removeItem(key); // 同时清理对应的状态
                }
            });
            
            localStorage.setItem('mindmap-page-index', JSON.stringify(pageIndex));
        } catch (error) {
            console.warn('更新页面索引失败:', error);
        }
    }

    loadSavedState() {
        try {
            const storageKey = this.getStorageKey();
            const savedState = localStorage.getItem(storageKey);
            
            if (savedState) {
                const state = JSON.parse(savedState);
                console.log('加载保存的状态:', storageKey);
                
                // 验证URL匹配（双重保险）
                if (state.pageUrl === window.location.href && state.mindmapData) {
                    // 恢复布局设置
                    this.leftPanelWidth = state.leftPanelWidth || 60;
                    this.rightPanelWidth = state.rightPanelWidth || 40;
                    
                    // 恢复思维导图数据
                    this.mindmapData = state.mindmapData;
                    
                    // 恢复缓存信息
                    this.cachedPageUrl = state.pageUrl;
                    this.cachedPageTitle = state.pageTitle;
                    this.mindmapGeneratedTime = state.generatedTime || Date.now();
                    
                    // 如果之前是激活状态，自动显示分屏
                    if (state.isActive) {
                        setTimeout(() => {
                            this.show();
                            // 直接恢复思维导图显示，不重复调用showMindmap
                            this.restoreMindmapDisplay(state.mindmapData);
                        }, 100);
                    }
                }
            }
        } catch (error) {
            console.error('加载保存状态失败:', error);
        }
    }

    clearSavedState() {
        const storageKey = this.getStorageKey();
        localStorage.removeItem(storageKey);
        
        // 从索引中移除
        try {
            let pageIndex = JSON.parse(localStorage.getItem('mindmap-page-index') || '{}');
            delete pageIndex[storageKey];
            localStorage.setItem('mindmap-page-index', JSON.stringify(pageIndex));
        } catch (error) {
            console.warn('清理页面索引失败:', error);
        }
        
        console.log('保存的状态已清除:', storageKey);
    }
    
    // 获取所有已保存的页面列表
    getSavedPagesList() {
        try {
            const pageIndex = JSON.parse(localStorage.getItem('mindmap-page-index') || '{}');
            return Object.entries(pageIndex).map(([key, info]) => ({
                storageKey: key,
                ...info
            }));
        } catch (error) {
            console.error('获取页面列表失败:', error);
            return [];
        }
    }
    
    // 清除所有页面的保存状态
    clearAllSavedStates() {
        try {
            const pageIndex = JSON.parse(localStorage.getItem('mindmap-page-index') || '{}');
            Object.keys(pageIndex).forEach(key => {
                localStorage.removeItem(key);
            });
            localStorage.removeItem('mindmap-page-index');
            console.log('所有保存的状态已清除');
        } catch (error) {
            console.error('清除所有状态失败:', error);
        }
    }

    // 恢复思维导图显示（不保存状态）
    restoreMindmapDisplay(data) {
        // 更新状态
        this.updateStatus('思维导图已恢复', 'success');
        
        // 渲染思维导图
        this.renderMindmap(data.markdown);
        
        // 显示思维导图内容
        this.rightPanel.querySelector('.mindmap-status').style.display = 'none';
        this.rightPanel.querySelector('.mindmap-display').style.display = 'flex';
        
        // 启用导出按钮
        this.enableExportButtons();
        
        console.log('思维导图显示已恢复');
    }

    // 显示加载状态
    showLoadingState() {
        const mindmapContent = this.rightPanel.querySelector('#splitMindmapContent');
        if (mindmapContent) {
            mindmapContent.innerHTML = `
                <div class="loading-state">
                    <div class="loading-icon">⏳</div>
                    <div class="loading-text">正在抓取网页内容...</div>
                    <div class="loading-subtitle">请稍候，系统正在分析页面内容</div>
                </div>
            `;
        }
        
        // 更新页面信息显示
        // 页面信息显示已移除
    }

    // 开始异步内容抓取
    async startContentExtraction() {
        try {
            console.log('开始异步内容抓取...');
            
            // 更新状态
            this.updateStatus('正在抓取网页内容...', 'loading');
            
            // 获取页面内容
            const content = await this.getPageContent();
            
            if (content && content.length > 10) {
                console.log('内容抓取成功，长度:', content.length);
                this.updateStatus('网页内容抓取完成', 'success');
                
                // 更新页面信息显示
                // 页面信息显示已移除
            } else {
                console.log('内容抓取失败或内容不足');
                this.showContentExtractionFailed();
            }
        } catch (error) {
            console.error('异步内容抓取失败:', error);
            this.showContentExtractionFailed();
        }
    }

    // 显示内容抓取失败状态
    showContentExtractionFailed() {
        const mindmapContent = this.rightPanel.querySelector('#splitMindmapContent');
        if (mindmapContent) {
            mindmapContent.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">网页内容抓取失败</div>
                    <div class="error-subtitle">请手动点击"生成思维导图"按钮重试</div>
                </div>
            `;
        }
        
        this.updateStatus('网页内容抓取失败，请手动生成', 'error');
    }

    updateStatus(message, type = 'info') {
        console.log(`状态更新: ${message} (${type})`);
        
        // 在控制台显示状态
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${message}`);
        
        // 如果界面中有状态显示区域，更新显示
        const statusEl = this.rightPanel.querySelector('.status-display');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status-display ${type}`;
        }
        
        // 根据状态类型设置不同的样式
        switch (type) {
            case 'success':
                console.log('✅', message);
                break;
            case 'error':
                console.error('❌', message);
                break;
            case 'warning':
                console.warn('⚠️', message);
                break;
            case 'loading':
                console.log('⏳', message);
                break;
            default:
                console.log('ℹ️', message);
        }
    }

    showSourceModal() {
        let modal = this.rightPanel.querySelector('#splitSourceModal');
        if (!modal) {
            // 如果弹窗不存在，尝试从 body 中查找（可能已经被移到去了）
            modal = document.getElementById('splitSourceModal');
        }
        
        if (modal) {
            // 如果弹窗还在 rightPanel 内部或其他容器内，将其移到 body 的最后，脱离父元素的层叠上下文
            if (modal.parentElement !== document.body) {
                // 先移除弹窗
                modal.remove();
                // 然后添加到 body 的最后，确保它在 DOM 中的顺序也是最后的
                document.body.appendChild(modal);
            } else {
                // 如果已经在 body 下，确保它在最后
                modal.remove();
                document.body.appendChild(modal);
            }
            
            const content = modal.querySelector('#splitSourceContent');
            const indicator = modal.querySelector('#sourceEditIndicator');
            
            if (content) {
                // 如果用户已经编辑过，显示编辑后的内容
                if (this.editedPageContent) {
                    content.innerText = this.editedPageContent;
                    if (indicator) indicator.style.display = 'inline';
                } else {
                    // 使用新的方法提取包含图片的完整内容
                    const htmlContent = this.extractFullPageContentWithImages();
                    content.innerHTML = htmlContent;
                    // 保存原始内容
                    this.originalPageContent = content.innerText;
                    if (indicator) indicator.style.display = 'none';
                }
            }
            
            // 临时降低分屏容器和所有面板的 z-index，确保弹窗可以覆盖它们
            if (this.splitContainer) {
                this.splitContainer.style.setProperty('z-index', '0', 'important');
            }
            if (this.leftPanel) {
                this.leftPanel.style.setProperty('z-index', '0', 'important');
            }
            if (this.rightPanel) {
                this.rightPanel.style.setProperty('z-index', '0', 'important');
            }
            if (this.divider) {
                this.divider.style.setProperty('z-index', '0', 'important');
            }
            
            // 确保弹窗显示在最上层，使用最高的 z-index
            modal.style.setProperty('z-index', '2147483649', 'important');
            modal.style.setProperty('position', 'fixed', 'important');
            modal.style.setProperty('top', '0', 'important');
            modal.style.setProperty('left', '0', 'important');
            modal.style.setProperty('width', '100vw', 'important');
            modal.style.setProperty('height', '100vh', 'important');
            modal.style.setProperty('pointer-events', 'auto', 'important');
            modal.style.setProperty('display', 'flex', 'important'); // 使用 setProperty 确保优先级
            // 只禁止弹窗背景区域的滚动，不影响网页内容
            // 注意：不设置 body overflow，避免影响网页内容显示
        }
    }

    hideSourceModal() {
        // 尝试从 body 中查找弹窗（可能已经被移出去了）
        let modal = document.getElementById('splitSourceModal');
        if (!modal) {
            // 如果不在 body 中，尝试从 rightPanel 中查找
            modal = this.rightPanel.querySelector('#splitSourceModal');
        }
        
        if (modal) {
            modal.style.setProperty('display', 'none', 'important'); // 使用 setProperty 确保优先级
            
            // 退出编辑模式
            this.exitSourceEditMode();
            
            // 恢复分屏容器和所有面板的 z-index
            if (this.splitContainer) {
                this.splitContainer.style.setProperty('z-index', '1', 'important');
            }
            if (this.leftPanel) {
                this.leftPanel.style.setProperty('z-index', '1', 'important');
            }
            if (this.rightPanel) {
                this.rightPanel.style.setProperty('z-index', '2', 'important');
            }
            if (this.divider) {
                this.divider.style.setProperty('z-index', '2147483647', 'important');
            }
            
            // 如果弹窗在 body 下，可以选择不移回去，或者移回 rightPanel
            // 为了保持 DOM 结构的一致性，可以选择不移回去
            // document.body.style.overflow = '';
        }
    }
    
    // 切换网页内容编辑模式
    toggleSourceEditMode() {
        if (this.isSourceEditMode) {
            this.exitSourceEditMode();
        } else {
            this.enterSourceEditMode();
        }
    }
    
    // 进入编辑模式
    enterSourceEditMode() {
        const content = document.getElementById('splitSourceContent');
        const editBtn = document.getElementById('splitToggleEditBtn');
        const saveBtn = document.getElementById('splitSaveSourceBtn');
        const resetBtn = document.getElementById('splitResetSourceBtn');
        const editHint = document.getElementById('sourceEditHint');
        
        if (content) {
            // 保存原始内容（如果还没有保存过）
            if (!this.originalPageContent) {
                this.originalPageContent = content.innerText;
            }
            
            content.contentEditable = 'true';
            content.style.border = '2px dashed #667eea';
            content.style.backgroundColor = '#fafafa';
            content.style.padding = '15px';
            content.focus();
        }
        
        if (editBtn) {
            editBtn.innerHTML = '✏️ 编辑中';
            editBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            editBtn.style.color = 'white';
        }
        
        if (saveBtn) saveBtn.style.display = 'inline-flex';
        if (resetBtn) resetBtn.style.display = 'inline-flex';
        if (editHint) editHint.style.display = 'block';
        
        this.isSourceEditMode = true;
        console.log('📝 进入网页内容编辑模式');
    }
    
    // 退出编辑模式
    exitSourceEditMode() {
        const content = document.getElementById('splitSourceContent');
        const editBtn = document.getElementById('splitToggleEditBtn');
        const saveBtn = document.getElementById('splitSaveSourceBtn');
        const resetBtn = document.getElementById('splitResetSourceBtn');
        const editHint = document.getElementById('sourceEditHint');
        
        if (content) {
            content.contentEditable = 'false';
            content.style.border = '';
            content.style.backgroundColor = '';
        }
        
        if (editBtn) {
            editBtn.innerHTML = '✏️ 编辑';
            editBtn.style.background = '';
            editBtn.style.color = '';
        }
        
        if (saveBtn) saveBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
        if (editHint) editHint.style.display = 'none';
        
        this.isSourceEditMode = false;
    }
    
    // 保存编辑后的内容
    saveEditedSource() {
        const content = document.getElementById('splitSourceContent');
        const indicator = document.getElementById('sourceEditIndicator');
        
        if (content) {
            this.editedPageContent = content.innerText;
            console.log('💾 已保存编辑后的网页内容，长度:', this.editedPageContent.length);
            
            // 显示已编辑指示器
            if (indicator) {
                indicator.style.display = 'inline';
            }
            
            // 退出编辑模式
            this.exitSourceEditMode();
            
            // 显示成功提示
            this.showSuccessToast('内容已保存，生成思维导图时将使用编辑后的内容');
        }
    }
    
    // 恢复原始内容
    resetSourceContent() {
        const content = document.getElementById('splitSourceContent');
        const indicator = document.getElementById('sourceEditIndicator');
        
        if (content && this.originalPageContent) {
            content.innerText = this.originalPageContent;
            this.editedPageContent = null;
            
            // 隐藏已编辑指示器
            if (indicator) {
                indicator.style.display = 'none';
            }
            
            console.log('↩️ 已恢复原始网页内容');
            this.showSuccessToast('已恢复原始内容');
        }
    }

    hideAIModal() {
        const modal = this.rightPanel.querySelector('#splitAiModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    // 标准化文本：去除标点、统一空格、转小写（改进版：保留冒号作为分隔符）
    normalizeText(text) {
        if (!text) return '';
        // 先将冒号替换为空格，这样"环境:重要性"会变成"环境 重要性"
        return text
            .toLowerCase()
            .replace(/[:：]/g, ' ') // 将冒号替换为空格
            .replace(/[，。！？；、""''（）【】《》〈〉「」『』]/g, '') // 去除其他中文标点
            .replace(/[,.!?'"()\[\]{}<>]/g, '') // 去除其他英文标点
            .replace(/\s+/g, ' ') // 统一空格
            .trim();
    }

    // 计算文本相似度（使用编辑距离和公共子串）
    calculateTextSimilarity(text1, text2) {
        const normalized1 = this.normalizeText(text1);
        const normalized2 = this.normalizeText(text2);
        
        if (!normalized1 || !normalized2) return 0;
        
        // 完全匹配
        if (normalized1 === normalized2) return 1.0;
        
        // 包含关系
        if (normalized2.includes(normalized1)) {
            return 0.8 + (normalized1.length / normalized2.length) * 0.1;
        }
        if (normalized1.includes(normalized2)) {
            return 0.7 + (normalized2.length / normalized1.length) * 0.1;
        }
        
        // 计算最长公共子串比例
        const lcsLength = this.getLongestCommonSubstring(normalized1, normalized2);
        const maxLength = Math.max(normalized1.length, normalized2.length);
        const lcsRatio = lcsLength / maxLength;
        
        // 计算关键词匹配度（改进版：支持部分匹配）
        const words1 = normalized1.split(/\s+/).filter(w => w.length > 0); // 降低长度要求
        const words2 = normalized2.split(/\s+/).filter(w => w.length > 0);
        let matchedWords = 0;
        let partialMatches = 0;
        
        words1.forEach(word => {
            // 完全匹配
            if (words2.includes(word)) {
                matchedWords++;
            }
            // 包含匹配
            else if (words2.some(w => w.includes(word) || word.includes(w))) {
                matchedWords++;
            }
            // 部分匹配（至少3个字符匹配）
            else if (word.length >= 3) {
                const hasPartial = words2.some(w => {
                    const minLen = Math.min(word.length, w.length);
                    const matchLen = this.getLongestCommonSubstring(word, w);
                    return matchLen >= Math.min(3, minLen * 0.6); // 至少3个字符或60%长度匹配
                });
                if (hasPartial) {
                    partialMatches++;
                }
            }
        });
        
        // 完全匹配权重更高
        const wordMatchRatio = words1.length > 0 
            ? (matchedWords / words1.length) * 0.8 + (partialMatches / words1.length) * 0.2
            : 0;
        
        // 综合相似度：LCS比例和关键词匹配度的加权平均
        return lcsRatio * 0.5 + wordMatchRatio * 0.5; // 调整权重，更重视关键词匹配
    }

    // 高亮左侧原文中对应的段落
    // ========== 高亮原文段落相关方法（重构版本） ==========
    
    /**
 * 获取思维导图中所有节点的有序列表（按文档顺序）
 * @returns {Array} 节点文本数组
 * @private
 */
_getAllNodesInOrder() {
    const nodes = [];
    
    if (!this.mindmapData || !this.mindmapData.markdown) {
        return nodes;
    }
    
    // 解析 markdown 获取所有节点
    const lines = this.mindmapData.markdown.split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#') || trimmedLine.startsWith('-')) {
            // 提取节点文本
            let text = trimmedLine;
            if (trimmedLine.startsWith('#')) {
                // 移除 # 符号
                text = trimmedLine.replace(/^#+\s*/, '').trim();
            } else if (trimmedLine.startsWith('-')) {
                // 移除 - 符号
                text = trimmedLine.replace(/^-\s*/, '').trim();
            }
            if (text) {
                nodes.push(text);
            }
        }
    }
    
    console.log(`📊 思维导图共有 ${nodes.length} 个节点`);
    return nodes;
}

/**
 * 计算节点在有序列表中的位置比例
 * @param {string} nodeText - 节点文本
 * @returns {number} 位置比例 (0-1)，-1 表示未找到
 * @private
 */
_getNodePositionRatio(nodeText) {
    const allNodes = this._getAllNodesInOrder();
    if (allNodes.length === 0) return -1;
    
    // 查找节点位置（模糊匹配）
    let bestMatchIndex = -1;
    let bestMatchScore = 0;
    
    for (let i = 0; i < allNodes.length; i++) {
        const node = allNodes[i];
        // 精确匹配
        if (node === nodeText) {
            bestMatchIndex = i;
            break;
        }
        // 包含匹配
        if (node.includes(nodeText) || nodeText.includes(node)) {
            const score = Math.min(node.length, nodeText.length) / Math.max(node.length, nodeText.length);
            if (score > bestMatchScore) {
                bestMatchScore = score;
                bestMatchIndex = i;
            }
        }
    }
    
    if (bestMatchIndex === -1) {
        console.log(`⚠️ 未找到节点位置: ${nodeText.substring(0, 30)}...`);
        return -1;
    }
    
    const ratio = allNodes.length > 1 ? bestMatchIndex / (allNodes.length - 1) : 0;
    console.log(`📍 节点位置: ${bestMatchIndex + 1}/${allNodes.length}，比例: ${(ratio * 100).toFixed(1)}%`);
    return ratio;
}

/**
 * 高亮左侧原文中对应的段落（重构版本 - 基于顺序匹配）
 * @param {string} nodeText - 节点文本
 * @param {number} nodeLevel - 节点层级
 */
highlightSourceParagraph(nodeText, nodeLevel) {
    const debugConfig = {
        enabled: true,
        logLevel: 'info',
        showStats: true
    };
    
    const matchStats = {
        startTime: performance.now(),
        totalElements: 0,
        keywords: { extracted: 0, details: [] },
        finalMatches: 0,
        executionTime: 0
    };
    
    try {
        console.log('🔍 开始查找并高亮原文段落，节点文本长度:', nodeText?.length || 0);
        
        // 清除之前的高亮
        this.clearSourceHighlight();
        
        // 验证基本条件
        if (!this._validateHighlightConditions(nodeText)) {
            return;
        }
        
        // 获取文本元素
        const textElements = this._getTextElements();
        if (!textElements || textElements.length === 0) {
            console.warn('⚠️ 没有找到可搜索的文本元素');
            return;
        }
        
        matchStats.totalElements = textElements.length;
        console.log(`📊 在 ${textElements.length} 个文本元素中查找匹配...`);
        
        // 🆕 计算节点在思维导图中的位置比例
        const nodePositionRatio = this._getNodePositionRatio(nodeText);
        console.log(`📍 节点位置比例: ${nodePositionRatio >= 0 ? (nodePositionRatio * 100).toFixed(1) + '%' : '未知'}`);
        
        // 提取关键词
        const keywords = this.extractKeywords(nodeText);
        matchStats.keywords.extracted = keywords.length;
        matchStats.keywords.details = keywords;
        
        // 🆕 使用基于位置的匹配策略
        let bestMatches = this._findBestMatchesByPosition(textElements, nodeText, nodeLevel, keywords, nodePositionRatio);
        
        // 如果位置匹配失败，回退到原有策略
        if (!bestMatches || bestMatches.length === 0) {
            console.log('🔄 位置匹配未找到结果，尝试传统匹配...');
            bestMatches = this._findBestMatches(textElements, nodeText, nodeLevel, keywords);
        }
        
        // 如果还没有找到匹配，尝试更宽松的策略
        if (!bestMatches || bestMatches.length === 0) {
            console.log('🔄 尝试宽松匹配策略...');
            bestMatches = this._findMatchesWithRelaxedCriteria(textElements, nodeText, keywords);
        }
        
        // 高亮匹配的元素（传递节点级别用于设置对应颜色）
        if (bestMatches && bestMatches.length > 0) {
            this._highlightMatches(bestMatches, nodeLevel);
            matchStats.finalMatches = bestMatches.length;
            console.log(`✅ 成功高亮 ${bestMatches.length} 个段落`);
        } else {
            console.warn('❌ 无法找到匹配的段落，可能该节点是AI生成的总结');
        }
        
    } catch (error) {
        console.error('❌ 高亮原文段落失败:', error);
        this.clearSourceHighlight();
    } finally {
        matchStats.executionTime = performance.now() - matchStats.startTime;
        if (debugConfig.showStats) {
            console.log('📊 === 匹配结果统计 ===');
            console.log(`   总文本元素: ${matchStats.totalElements}`);
            console.log(`   提取关键词数: ${matchStats.keywords.extracted}`);
            console.log(`   最终高亮段落数: ${matchStats.finalMatches}`);
            console.log(`   执行时间: ${matchStats.executionTime.toFixed(2)}ms`);
            console.log('====================');
        }
    }
}

/**
 * 验证高亮的基本条件
 * @private
 */
_validateHighlightConditions(nodeText) {
    if (!this.leftPanel) {
        console.warn('⚠️ 左侧面板不存在，无法高亮');
        return false;
    }
    
    if (this.leftPanel.style.display === 'none' || this.leftPanel.style.visibility === 'hidden') {
        console.warn('⚠️ 左侧面板不可见，尝试修复...');
        this.leftPanel.style.display = 'block';
        this.leftPanel.style.visibility = 'visible';
        this.leftPanel.style.opacity = '1';
    }
    
    if (!nodeText || typeof nodeText !== 'string' || nodeText.trim() === '') {
        console.warn('⚠️ 无效的节点文本');
        return false;
    }
    
    return true;
}

/**
 * 获取可搜索的文本元素
 * @private
 */
_getTextElements() {
    let textElements = this.leftPanel.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div');
    
    if (textElements.length === 0) {
        console.warn('⚠️ 左侧面板中没有找到文本元素，尝试全局搜索...');
        textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div');
    }
    
    return textElements;
}

/**
 * 🆕 基于位置的最佳匹配方法
 * 利用思维导图节点顺序与原文段落顺序的对应关系进行匹配
 * @param {NodeList} textElements - 文本元素列表
 * @param {string} nodeText - 节点文本
 * @param {number} nodeLevel - 节点层级
 * @param {Array} keywords - 关键词列表
 * @param {number} nodePositionRatio - 节点位置比例 (0-1)
 * @private
 */
_findBestMatchesByPosition(textElements, nodeText, nodeLevel, keywords, nodePositionRatio) {
    // 如果没有位置信息，直接返回空
    if (nodePositionRatio < 0) {
        return [];
    }
    
    const normalizedNodeText = this.normalizeText(nodeText);
    const totalElements = textElements.length;
    
    // 🆕 特殊处理：根节点和一级节点通常对应文章开头
    let targetIndex;
    let searchRange;
    
    if (nodeLevel === 1 || nodePositionRatio < 0.05) {
        // 根节点或文章开头的节点，在开头区域搜索
        targetIndex = Math.floor(totalElements * 0.1); // 前10%的位置
        searchRange = Math.max(15, Math.floor(totalElements * 0.2)); // 搜索前20%
        console.log(`📌 检测到根节点/开头节点，优先搜索文章开头`);
    } else if (nodePositionRatio > 0.95) {
        // 文章末尾的节点
        targetIndex = Math.floor(totalElements * 0.9); // 后90%的位置
        searchRange = Math.max(15, Math.floor(totalElements * 0.2));
        console.log(`📌 检测到末尾节点，优先搜索文章结尾`);
    } else {
        // 普通节点，按比例计算目标位置
        targetIndex = Math.floor(nodePositionRatio * (totalElements - 1));
        // 搜索范围根据总元素数动态调整
        searchRange = Math.max(15, Math.floor(totalElements * 0.15)); // 至少15个元素，或总数的15%
    }
    
    const startIndex = Math.max(0, targetIndex - searchRange);
    const endIndex = Math.min(totalElements - 1, targetIndex + searchRange);
    
    console.log(`🔍 基于位置搜索: 目标索引=${targetIndex}, 搜索范围=[${startIndex}, ${endIndex}], 共${endIndex - startIndex + 1}个元素`);
    
    const matches = [];
    
    for (let i = startIndex; i <= endIndex; i++) {
        const element = textElements[i];
        const elementText = element.textContent?.trim() || '';
        if (elementText.length < 5) continue;
        
        // 计算基础匹配分数
        const baseScore = this._calculateMatchScore(element, elementText, nodeText, normalizedNodeText, nodeLevel, keywords);
        
        // 🆕 位置加权：距离目标位置越近，加权越高
        const distance = Math.abs(i - targetIndex);
        const maxDistance = searchRange || 1;
        const positionBonus = 1 + (1 - distance / maxDistance) * 0.6; // 最多增加60%的分数
        
        // 🆕 标题标签加权：如果节点级别较高（1-2级），且元素是标题标签，额外加分
        const tagName = element.tagName.toLowerCase();
        let tagBonus = 1;
        if (nodeLevel <= 2 && ['h1', 'h2', 'h3'].includes(tagName)) {
            tagBonus = 1.3; // 标题节点匹配标题标签，加分30%
        } else if (nodeLevel <= 3 && ['h2', 'h3', 'h4'].includes(tagName)) {
            tagBonus = 1.2;
        }
        
        const finalScore = baseScore * positionBonus * tagBonus;
        
        // 降低阈值，因为位置信息提供了额外的置信度
        if (finalScore > 15) {
            matches.push({ 
                element, 
                score: finalScore, 
                text: elementText,
                index: i,
                distance: distance,
                tagName: tagName
            });
        }
    }
    
    // 按分数排序
    matches.sort((a, b) => b.score - a.score);
    
    // 🆕 智能筛选：如果最高分匹配周围有连续的高分匹配，一起返回
    if (matches.length > 0) {
        const topScore = matches[0].score;
        const topMatch = matches[0];
        const maxHighlights = 3;
        
        // 首先选择最高分的匹配
        const filtered = [topMatch];
        
        // 然后查找与最高分匹配相邻的其他高分匹配
        for (const match of matches.slice(1)) {
            if (filtered.length >= maxHighlights) break;
            
            // 如果分数足够高，或者与已选中的某个匹配相邻
            const isAdjacent = filtered.some(f => Math.abs(f.index - match.index) <= 3);
            const scoreThreshold = isAdjacent ? topScore * 0.4 : topScore * 0.6;
            
            if (match.score >= scoreThreshold) {
                filtered.push(match);
            }
        }
        
        // 按原文顺序排序
        filtered.sort((a, b) => a.index - b.index);
        
        console.log(`✅ 基于位置找到 ${filtered.length} 个匹配，最高分: ${topScore.toFixed(1)}`);
        filtered.forEach((m, i) => {
            console.log(`  ${i+1}. [${m.tagName}] 索引=${m.index}, 分数=${m.score.toFixed(1)}, 内容前30字: "${m.text.substring(0, 30)}..."`);
        });
        
        return filtered;
    }
    
    return [];
}

/**
 * 查找最佳匹配的元素（传统方法）
 * @private
 */
_findBestMatches(textElements, nodeText, nodeLevel, keywords) {
    const normalizedNodeText = this.normalizeText(nodeText);
    const matches = [];
    
    textElements.forEach((element) => {
        const elementText = element.textContent?.trim() || '';
        if (elementText.length < 5) return;
        
        // 计算匹配分数
        const score = this._calculateMatchScore(element, elementText, nodeText, normalizedNodeText, nodeLevel, keywords);
        
        // 只保留分数足够高的匹配
        if (score > 30) {
            matches.push({ element, score, text: elementText });
        }
    });
    
    // 按分数排序并限制数量
    matches.sort((a, b) => b.score - a.score);
    const maxHighlights = 8;
    const topScore = matches.length > 0 ? matches[0].score : 0;
    
    return matches
        .filter((match, index) => index < maxHighlights && match.score >= topScore * 0.6)
        .slice(0, maxHighlights);
}

/**
 * 使用宽松条件查找匹配
 * @private
 */
_findMatchesWithRelaxedCriteria(textElements, nodeText, keywords) {
    if (keywords.length === 0) {
        return [];
    }
    
    const matches = [];
    const normalizedNodeText = this.normalizeText(nodeText);
    
    textElements.forEach((element) => {
        const elementText = element.textContent?.trim() || '';
        if (elementText.length < 10) return;
        
        // 关键词匹配
        const matchedKeywords = keywords.filter(keyword => 
            elementText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length > 0) {
            const matchRatio = matchedKeywords.length / keywords.length;
            const similarity = this.calculateTextSimilarity(nodeText, elementText);
            const score = matchRatio * 50 + similarity * 50;
            
            if (score > 20) {
                matches.push({ element, score, text: elementText });
            }
        }
    });
    
    // 排序并限制数量
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 5);
}

/**
 * 计算元素的匹配分数
 * @private
 */
_calculateMatchScore(element, elementText, nodeText, normalizedNodeText, nodeLevel, keywords) {
    // 基础相似度分数
    const similarity = this.calculateTextSimilarity(nodeText, elementText);
    let score = similarity * 100;
    
    // 元素类型加权
    const tagName = element.tagName.toLowerCase();
    const tagWeights = {
        'h1': 1.3, 'h2': 1.3, 'h3': 1.3,
        'h4': 1.2, 'h5': 1.2, 'h6': 1.2,
        'p': 1.1,
        'li': 1.05
    };
    score *= (tagWeights[tagName] || 1.0);
    
    // 长度相似度加权
    const lengthRatio = Math.min(elementText.length, normalizedNodeText.length) / 
                       Math.max(elementText.length, normalizedNodeText.length);
    if (lengthRatio > 0.7) {
        score *= 1.1;
    }
    
    // 避免匹配过长的段落
    if (elementText.length > normalizedNodeText.length * 5) {
        score *= 0.7;
    }
    
    // 节点级别与元素类型匹配
    if (nodeLevel <= 3 && ['h1', 'h2', 'h3'].includes(tagName)) {
        score *= 1.4;
    }
    
    // 关键词匹配加分
    const keywordMatchCount = keywords.filter(keyword => 
        elementText.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    if (keywordMatchCount > 0) {
        score *= (1 + keywordMatchCount * 0.1);
    }
    
    return score;
}

/**
 * 高亮匹配的元素
 * @param {Array} matches - 匹配的元素数组
 * @param {number} nodeLevel - 节点层级，用于设置对应的高亮颜色
 * @private
 */
_highlightMatches(matches, nodeLevel = 1) {
    this.currentHighlightElements = [];
    
    // 获取对应节点级别的高亮颜色
    const highlightColors = this._getHighlightColorsByLevel(nodeLevel);
    
    matches.forEach((match, index) => {
        match.element.classList.add('mindmap-highlight');
        
        // 🎨 应用与节点颜色一致的高亮样式
        match.element.style.setProperty('background', highlightColors.background, 'important');
        match.element.style.setProperty('border-left', `4px solid ${highlightColors.border}`, 'important');
        match.element.style.setProperty('border-radius', '4px', 'important');
        match.element.style.setProperty('padding', '8px 12px', 'important');
        match.element.style.setProperty('margin', '4px 0', 'important');
        match.element.style.setProperty('box-shadow', `0 2px 8px ${highlightColors.shadow}`, 'important');
        match.element.style.setProperty('transition', 'all 0.3s ease', 'important');
        
        // 存储元素和原始样式信息
        this.currentHighlightElements.push({
            element: match.element,
            originalBackground: match.element.style.background,
            originalBorderLeft: match.element.style.borderLeft,
            originalBorderRadius: match.element.style.borderRadius,
            originalPadding: match.element.style.padding,
            originalMargin: match.element.style.margin,
            originalBoxShadow: match.element.style.boxShadow
        });
        
        if (index === 0) {
            // 滚动到第一个匹配元素
            setTimeout(() => {
                match.element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            }, 100);
            
            this.currentHighlightElement = match.element;
        }
    });
}

/**
 * 根据节点级别获取对应的高亮颜色
 * @param {number} level - 节点层级
 * @returns {Object} 包含背景色、边框色和阴影色的对象
 * @private
 */
_getHighlightColorsByLevel(level) {
    const colorMap = {
        1: { // 一级节点 - 紫色
            background: 'linear-gradient(135deg, #e1bee7 0%, #ce93d8 100%)',
            border: '#9c27b0',
            shadow: 'rgba(156, 39, 176, 0.3)'
        },
        2: { // 二级节点 - 橙色
            background: 'linear-gradient(135deg, #ffe0b2 0%, #ffcc80 100%)',
            border: '#ff9800',
            shadow: 'rgba(255, 152, 0, 0.3)'
        },
        3: { // 三级节点 - 黄色
            background: 'linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)',
            border: '#ffc107',
            shadow: 'rgba(255, 193, 7, 0.3)'
        },
        4: { // 四级节点 - 青色
            background: 'linear-gradient(135deg, #b2ebf2 0%, #80deea 100%)',
            border: '#00bcd4',
            shadow: 'rgba(0, 188, 212, 0.3)'
        },
        5: { // 五级节点 - 蓝色
            background: 'linear-gradient(135deg, #bbdefb 0%, #90caf9 100%)',
            border: '#2196f3',
            shadow: 'rgba(33, 150, 243, 0.3)'
        },
        6: { // 六级及之后 - 灰色
            background: 'linear-gradient(135deg, #eeeeee 0%, #e0e0e0 100%)',
            border: '#9e9e9e',
            shadow: 'rgba(158, 158, 158, 0.3)'
        }
    };
    
    // 返回对应级别的颜色，默认使用六级颜色
    return colorMap[level] || colorMap[6];
}

        // 清除高亮
    clearSourceHighlight() {
        try {
            console.log('🧹 开始清除所有高亮元素');
            
            // 1. 处理新格式的currentHighlightElements（对象数组）
            if (this.currentHighlightElements && Array.isArray(this.currentHighlightElements)) {
                console.log(`🧹 处理 ${this.currentHighlightElements.length} 个存储的高亮元素`);
                
                this.currentHighlightElements.forEach(item => {
                    try {
                        // 处理对象格式的存储项
                        if (item && item.element && item.element.classList) {
                            item.element.classList.remove('mindmap-highlight');
                            
                            // 恢复原始样式状态
                            if (item.originalDisplay !== undefined) {
                                item.element.style.display = item.originalDisplay;
                            }
                            if (item.originalVisibility !== undefined) {
                                item.element.style.visibility = item.originalVisibility;
                            }
                            if (item.originalOpacity !== undefined) {
                                item.element.style.opacity = item.originalOpacity;
                            }
                            
                            // 🎨 恢复高亮颜色相关的样式
                            if (item.originalBackground !== undefined) {
                                item.element.style.background = item.originalBackground;
                            } else {
                                item.element.style.removeProperty('background');
                            }
                            if (item.originalBorderLeft !== undefined) {
                                item.element.style.borderLeft = item.originalBorderLeft;
                            } else {
                                item.element.style.removeProperty('border-left');
                            }
                            if (item.originalBorderRadius !== undefined) {
                                item.element.style.borderRadius = item.originalBorderRadius;
                            } else {
                                item.element.style.removeProperty('border-radius');
                            }
                            if (item.originalPadding !== undefined) {
                                item.element.style.padding = item.originalPadding;
                            } else {
                                item.element.style.removeProperty('padding');
                            }
                            if (item.originalMargin !== undefined) {
                                item.element.style.margin = item.originalMargin;
                            } else {
                                item.element.style.removeProperty('margin');
                            }
                            if (item.originalBoxShadow !== undefined) {
                                item.element.style.boxShadow = item.originalBoxShadow;
                            } else {
                                item.element.style.removeProperty('box-shadow');
                            }
                        }
                        // 向后兼容：处理旧格式（直接存储元素）
                        else if (item && item.classList) {
                            item.classList.remove('mindmap-highlight');
                            // 清除可能残留的内联样式
                            item.style.removeProperty('background');
                            item.style.removeProperty('border-left');
                            item.style.removeProperty('border-radius');
                            item.style.removeProperty('padding');
                            item.style.removeProperty('margin');
                            item.style.removeProperty('box-shadow');
                        }
                    } catch (err) {
                        console.warn('⚠️ 清除单个元素高亮失败:', err);
                    }
                });
            }
            
            // 2. 清除单个主要高亮元素（向后兼容）
            if (this.currentHighlightElement && this.currentHighlightElement.classList) {
                try {
                    this.currentHighlightElement.classList.remove('mindmap-highlight');
                    console.log('✅ 已清除主要高亮元素');
                } catch (err) {
                    console.warn('⚠️ 清除主要高亮元素失败:', err);
                } finally {
                    this.currentHighlightElement = null;
                }
            }
            
            // 3. 在左侧面板中全局查找并清除所有高亮元素
            if (this.leftPanel) {
                try {
                    const highlightedElements = this.leftPanel.querySelectorAll('.mindmap-highlight');
                    console.log(`🧹 在左侧面板中找到 ${highlightedElements.length} 个额外的高亮元素`);
                    
                    highlightedElements.forEach(element => {
                        try {
                            if (element && element.classList) {
                                element.classList.remove('mindmap-highlight');
                                // 🎨 清除高亮相关的内联样式
                                element.style.removeProperty('background');
                                element.style.removeProperty('border-left');
                                element.style.removeProperty('border-radius');
                                element.style.removeProperty('padding');
                                element.style.removeProperty('margin');
                                element.style.removeProperty('box-shadow');
                            }
                        } catch (err) {
                            console.warn('⚠️ 清除面板元素高亮失败:', err);
                        }
                    });
                } catch (err) {
                    console.warn('⚠️ 查询左侧面板高亮元素失败:', err);
                }
            }
            
            // 4. 全局查找整个文档中的高亮元素（保险措施）
            try {
                const globalHighlights = document.querySelectorAll('.mindmap-highlight');
                console.log(`🧹 在整个文档中找到 ${globalHighlights.length} 个额外的高亮元素`);
                
                globalHighlights.forEach(element => {
                    try {
                        if (element && element.classList) {
                            element.classList.remove('mindmap-highlight');
                            // 🎨 清除高亮相关的内联样式
                            element.style.removeProperty('background');
                            element.style.removeProperty('border-left');
                            element.style.removeProperty('border-radius');
                            element.style.removeProperty('padding');
                            element.style.removeProperty('margin');
                            element.style.removeProperty('box-shadow');
                        }
                    } catch (err) {
                        // 静默忽略错误
                    }
                });
            } catch (err) {
                console.warn('⚠️ 全局查找高亮元素失败:', err);
            }
            
            // 5. 重置存储
            this.currentHighlightElements = [];
            
            console.log('✅ 高亮清除完成，所有.mindmap-highlight类已移除');
        } catch (error) {
            console.error('❌ 清除高亮时出错:', error);
            // 即使出错也要确保重置存储
            this.currentHighlightElements = [];
            this.currentHighlightElement = null;
        }
    }
    
    // 提取关键词
    extractKeywords(text) {
        if (!text || typeof text !== 'string') return [];
        
        // 移除常见停用词
        const stopWords = ['的', '了', '和', '是', '在', '我', '有', '个', '这', '那', '也', '就', '都', '而', '及', '与', '或', '一个', '不是', '可以', '因为', '所以', '如果', '这些', '那些', '对于', '关于', '为了', '通过', '随着', '但是', '不过'];
        
        // 分割文本并过滤
        let words = text.split(/[,，;；:：.。\s\n]+/)
            .map(word => word.trim())
            .filter(word => word.length > 1 && !stopWords.includes(word));
        
        // 去重并限制数量
        return [...new Set(words)].slice(0, 5);
    }

    // 计算两个字符串的最长公共子串长度
    getLongestCommonSubstring(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        let maxLength = 0;
        
        // 使用动态规划
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                    maxLength = Math.max(maxLength, dp[i][j]);
                } else {
                    dp[i][j] = 0;
                }
            }
        }
        
        return maxLength;
    }
    
    // ========== 缓存状态管理方法 ==========
    
    /**
     * 显示缓存状态栏
     * @private
     */
    _showCacheStatusBar() {
        const statusBar = this.rightPanel ? this.rightPanel.querySelector('#splitCacheStatusBar') : null;
        if (!statusBar) {
            console.warn('⚠️ 缓存状态栏不存在');
            return;
        }
        
        // 更新时间显示
        this._updateCacheTimeDisplay();
        
        // 显示状态栏
        statusBar.style.display = 'flex';
        
        console.log('✅ 缓存状态栏已显示');
    }
    
    /**
     * 隐藏缓存状态栏
     * @private
     */
    _hideCacheStatusBar() {
        const statusBar = this.rightPanel ? this.rightPanel.querySelector('#splitCacheStatusBar') : null;
        if (statusBar) {
            statusBar.style.display = 'none';
        }
    }
    
    /**
     * 更新缓存时间显示
     * @private
     */
    _updateCacheTimeDisplay() {
        if (!this.mindmapGeneratedTime) return;
        
        const cacheTimeElement = this.rightPanel ? this.rightPanel.querySelector('#splitCacheTime') : null;
        if (!cacheTimeElement) return;
        
        const now = Date.now();
        const elapsed = now - this.mindmapGeneratedTime;
        const timeText = this._formatTimeAgo(elapsed);
        
        cacheTimeElement.textContent = `生成于 ${timeText}`;
    }
    
    /**
     * 格式化时间为"xx前"的格式
     * @private
     */
    _formatTimeAgo(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小时前`;
        if (minutes > 0) return `${minutes}分钟前`;
        if (seconds > 10) return `${seconds}秒前`;
        return '刚刚';
    }
    
    /**
     * 开始定时更新缓存时间显示
     * @private
     */
    _startCacheTimeUpdater() {
        // 清除之前的定时器
        if (this._cacheTimeUpdateInterval) {
            clearInterval(this._cacheTimeUpdateInterval);
        }
        
        // 每30秒更新一次时间显示
        this._cacheTimeUpdateInterval = setInterval(() => {
            if (this.mindmapData && this.cachedPageUrl === window.location.href) {
                this._updateCacheTimeDisplay();
            } else {
                // 如果没有缓存数据，停止更新
                this._stopCacheTimeUpdater();
            }
        }, 30000); // 30秒
    }
    
    /**
     * 停止定时更新缓存时间
     * @private
     */
    _stopCacheTimeUpdater() {
        if (this._cacheTimeUpdateInterval) {
            clearInterval(this._cacheTimeUpdateInterval);
            this._cacheTimeUpdateInterval = null;
        }
    }
    
    /**
     * 处理重新生成按钮点击
     */
    handleRegenerateClick() {
        console.log('🔄 用户点击重新生成按钮');
        
        // 清空当前思维导图
        this._clearCachedMindmap();
        
        // 触发生成
        this.generateMindmap();
    }
    
    /**
     * 处理清空缓存按钮点击
     */
    handleClearCacheClick() {
        console.log('🗑️ 用户点击清空缓存按钮');
        
        // 清空缓存
        this._clearCachedMindmap();
        
        // 显示提示
        this.updateStatus('缓存已清空', 'success');
        setTimeout(() => {
            this.updateStatus('', 'info');
        }, 2000);
    }
    
    /**
     * 清空思维导图内容（清空按钮调用）
     */
    clearContent() {
        console.log('🗑️ 清空思维导图内容');
        this._clearCachedMindmap();
    }
    
    // ========== 导出通知方法 ==========
    
    /**
     * 显示导出成功通知
     * @param {Object} options - 通知选项
     * @param {string} options.format - 导出格式 (PNG/Markdown/Xmind)
     * @param {string} options.filename - 文件名
     * @param {string} options.filesize - 文件大小（可选）
     */
    showExportNotification(options) {
        const { format, filename, filesize } = options;
        
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'export-notification-overlay';
        
        // 创建通知容器
        const notification = document.createElement('div');
        notification.className = 'export-notification';
        
        // 根据格式选择图标和颜色
        let icon = '✅';
        let title = '导出成功！';
        let message = '';
        
        switch (format.toUpperCase()) {
            case 'PNG':
                icon = '🖼️';
                message = '思维导图已成功导出为 PNG 图片';
                break;
            case 'MARKDOWN':
            case 'MD':
                icon = '📝';
                message = '思维导图已成功导出为 Markdown 文件';
                break;
            case 'XMIND':
                icon = '🧠';
                message = '思维导图已成功导出为 XMind 文件';
                break;
            default:
                icon = '✅';
                message = '文件已成功导出';
        }
        
        // 构建通知内容
        notification.innerHTML = `
            <div class="export-notification-icon">${icon}</div>
            <div class="export-notification-title">${title}</div>
            <div class="export-notification-message">${message}</div>
            <div class="export-notification-details">
                <div class="export-notification-detail-item">
                    <span class="export-notification-detail-label">文件名：</span>
                    <span class="export-notification-detail-value">${filename}</span>
                </div>
                <div class="export-notification-detail-item">
                    <span class="export-notification-detail-label">格式：</span>
                    <span class="export-notification-detail-value">${format.toUpperCase()}</span>
                </div>
                ${filesize ? `
                <div class="export-notification-detail-item">
                    <span class="export-notification-detail-label">大小：</span>
                    <span class="export-notification-detail-value">${filesize}</span>
                </div>
                ` : ''}
            </div>
            <div class="export-notification-actions">
                <button class="export-notification-btn export-notification-btn-primary" id="exportNotificationOk">
                    知道了
                </button>
            </div>
            <div class="export-notification-progress"></div>
        `;
        
        // 添加到页面
        document.body.appendChild(overlay);
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            overlay.classList.add('show');
            notification.classList.add('show');
        }, 10);
        
        // 关闭通知的函数
        const closeNotification = () => {
            notification.classList.remove('show');
            notification.classList.add('hide');
            overlay.classList.remove('show');
            
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            }, 300);
        };
        
        // 按钮点击事件
        const okBtn = notification.querySelector('#exportNotificationOk');
        if (okBtn) {
            okBtn.addEventListener('click', closeNotification);
        }
        
        // 点击遮罩层关闭
        overlay.addEventListener('click', closeNotification);
        
        // 3秒后自动关闭
        setTimeout(closeNotification, 3000);
        
        console.log('✅ 导出通知已显示');
    }
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// 初始化分屏模式
let splitScreen = null;

// 获取或创建 splitScreen 实例
function getOrCreateSplitScreen() {
    // 如果实例已存在且有效，直接返回
    if (splitScreen && splitScreen.splitContainer) {
        return splitScreen;
    }
    
    // 否则创建新实例
    try {
        console.log('📦 创建新的分屏实例...');
        splitScreen = new MindmapSplitScreen();
        console.log('✅ 分屏实例创建成功');
        return splitScreen;
    } catch (error) {
        console.error('❌ 创建分屏实例失败:', error);
        return null;
    }
}

// 等待DOM加载完成后再初始化
function initMindmapSplitScreen() {
    try {
        console.log('🔧 开始初始化思维导图分屏模式...');
        console.log('📄 当前页面URL:', window.location.href);
        console.log('📄 当前页面标题:', document.title);
        console.log('📄 DOM状态:', document.readyState);
        
        // 检查是否是特殊页面
        if (window.location.href.startsWith('chrome://') || 
            window.location.href.startsWith('chrome-extension://') || 
            window.location.href.startsWith('moz-extension://')) {
            console.log('⚠️ 检测到浏览器内部页面，跳过初始化');
            return;
        }
        
        // 检查是否已经存在分屏
        const existingContainer = document.getElementById('mindmap-split-container');
        if (!existingContainer) {
            splitScreen = getOrCreateSplitScreen();
            if (splitScreen) {
                console.log('✅ 思维导图分屏模式已初始化');
            }
        } else {
            console.log('⚠️ 发现已存在的分屏容器，尝试重新初始化...');
            // 如果已存在但可能有问题，清理后重新初始化
            try {
                existingContainer.remove();
                splitScreen = getOrCreateSplitScreen();
                if (splitScreen) {
                    console.log('✅ 清理后重新初始化成功');
                }
            } catch (cleanupError) {
                console.error('❌ 清理后重新初始化失败:', cleanupError);
                // 最后尝试：直接创建新实例
                try {
                    splitScreen = new MindmapSplitScreen();
                    console.log('✅ 强制创建新实例成功');
                } catch (forceError) {
                    console.error('❌ 强制创建也失败:', forceError);
                }
            }
        }
        
        // 验证初始化是否成功
        if (splitScreen && splitScreen.splitContainer) {
            console.log('✅ 分屏容器验证成功');
        } else {
            console.warn('⚠️ 分屏容器验证失败，将在收到消息时重新初始化');
        }
    } catch (error) {
        console.error('❌ 初始化思维导图分屏模式失败:', error);
        console.error('错误堆栈:', error.stack);
        
        // 尝试基本初始化
        try {
            console.log('🔄 尝试基本初始化...');
            splitScreen = new MindmapSplitScreen();
            console.log('✅ 基本初始化成功');
        } catch (fallbackError) {
            console.error('❌ 基本初始化也失败:', fallbackError);
            console.warn('⚠️ 初始化失败，将在收到消息时重试');
        }
    }
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
    console.log('⏳ 等待DOM加载完成...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ DOM加载完成，开始初始化');
        initMindmapSplitScreen();
    });
} else {
    // DOM已经加载完成
    console.log('✅ DOM已加载完成，立即初始化');
    initMindmapSplitScreen();
}


