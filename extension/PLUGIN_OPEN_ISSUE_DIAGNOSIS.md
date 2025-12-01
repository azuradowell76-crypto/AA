# 🔍 思维导图插件无法打开问题诊断指南

## 🚨 常见原因分析

### 1. Content Script 未正确加载或初始化失败

#### 症状
- 点击插件图标后没有任何反应
- 控制台显示 "无法与页面通信" 或 "消息超时"
- 页面没有显示分屏界面

#### 可能原因
1. **页面加载状态问题**
   - Content script 在页面完全加载前尝试初始化
   - DOM 未就绪导致初始化失败

2. **特殊页面限制**
   - 在 `chrome://`、`chrome-extension://`、`moz-extension://` 等浏览器内部页面无法注入脚本
   - 某些受保护页面（如设置页）无法执行 content script

3. **Content Script 重复初始化**
   - 页面刷新后旧实例未清理
   - 多个实例冲突导致失败

#### 解决方案
```javascript
// 检查页面类型
if (tab.url.startsWith('chrome://') || 
    tab.url.startsWith('chrome-extension://') || 
    tab.url.startsWith('moz-extension://')) {
    console.log('检测到浏览器内部页面，无法显示分屏');
    return;
}
```

### 2. 消息传递失败

#### 症状
- Background script 发送消息到 content script 失败
- 控制台显示 "Could not establish connection" 错误

#### 可能原因
1. **Content Script 未注入**
   - 页面刷新后 content script 需要重新注入
   - 某些动态加载的页面 content script 未执行

2. **消息监听器未注册**
   - Content script 初始化失败，消息监听器未设置
   - 消息发送时机早于监听器注册

#### 解决方案
- Background script 已有自动注入机制（见 `background.js:73-89`）
- 增加重试机制和更长的等待时间

### 3. 后端服务未启动

#### 症状
- 插件界面可以打开，但无法生成思维导图
- 显示 "无法连接到服务器" 错误

#### 解决方案
```bash
# 检查后端服务是否运行
cd backend
npm start

# 确保服务运行在 http://localhost:3001
```

### 4. 权限问题

#### 症状
- 控制台显示权限错误
- 无法访问页面内容

#### 解决方案
1. 检查 `manifest.json` 中的权限配置
2. 确保以下权限已启用：
   - `activeTab` - 访问当前标签页
   - `scripting` - 在页面中执行脚本
   - `tabs` - 管理标签页

### 5. DOM 操作失败

#### 症状
- 初始化过程中抛出 DOM 相关错误
- 分屏容器创建失败

#### 可能原因
- 页面结构特殊，无法正常插入元素
- CSS 样式冲突导致元素不可见

## 🔧 诊断步骤

### 步骤 1: 检查控制台日志

1. **打开页面控制台**
   - 按 `F12` 打开开发者工具
   - 切换到 Console 标签页

2. **查看初始化日志**
   - 查找 `🔧 开始初始化思维导图分屏模式...`
   - 查找 `✅ 思维导图分屏模式已初始化`
   - 查找任何 `❌` 开头的错误信息

3. **查看 Background 日志**
   - 右键点击插件图标 → 检查弹出内容
   - 或访问 `chrome://extensions/` → 点击插件的"服务工作者"链接

### 步骤 2: 检查页面类型

```javascript
// 在控制台执行
console.log('当前页面URL:', window.location.href);
console.log('页面类型:', window.location.protocol);
```

如果 URL 以 `chrome://` 或 `chrome-extension://` 开头，插件无法工作。

### 步骤 3: 检查 Content Script 是否加载

```javascript
// 在页面控制台执行
console.log('splitScreen 实例:', typeof splitScreen);
console.log('分屏容器:', document.getElementById('mindmap-split-container'));
```

### 步骤 4: 手动触发初始化

```javascript
// 在页面控制台执行（如果 content script 已加载）
if (typeof initMindmapSplitScreen === 'function') {
    initMindmapSplitScreen();
}
```

### 步骤 5: 检查后端服务

```bash
# 测试后端 API
curl http://localhost:3001/api/mindmap/providers
```

## 🛠️ 快速修复方法

### 方法 1: 刷新页面
最简单的方法，可以解决大部分临时问题：
1. 刷新当前页面（`F5` 或 `Ctrl+R`）
2. 重新点击插件图标

### 方法 2: 重新加载插件
1. 访问 `chrome://extensions/`
2. 找到"思维导图AI助手"插件
3. 点击"重新加载"按钮

### 方法 3: 检查后端服务
1. 打开终端
2. 进入 `backend` 目录
3. 运行 `npm start`
4. 确保服务运行在 `http://localhost:3001`

### 方法 4: 清除并重新安装
如果以上方法都不行：
1. 在 `chrome://extensions/` 中移除插件
2. 重新加载插件文件夹

## 📋 检查清单

在报告问题前，请检查以下项目：

- [ ] 是否在普通网页上使用（非 chrome:// 页面）
- [ ] 页面是否完全加载完成
- [ ] 后端服务是否运行（`http://localhost:3001`）
- [ ] 控制台是否有错误信息
- [ ] 插件权限是否已启用
- [ ] 是否尝试过刷新页面
- [ ] 是否尝试过重新加载插件

## 🐛 已知问题

### 问题 1: 某些单页应用（SPA）页面
**症状**: 在 React、Vue 等 SPA 应用中，页面导航后插件可能失效

**解决方案**: 刷新页面后重新打开插件

### 问题 2: 动态内容页面
**症状**: 内容通过 AJAX 动态加载的页面，初始化时可能找不到内容

**解决方案**: 等待内容加载完成后再打开插件

### 问题 3: iframe 嵌套页面
**症状**: 页面包含 iframe 时，content script 可能无法正确注入

**解决方案**: 在主页面上使用插件，而非 iframe 内

## 💡 预防措施

1. **等待页面加载完成**
   - 插件会自动等待 DOM 加载，但某些动态内容可能需要额外时间

2. **在合适的页面上使用**
   - 避免在浏览器内部页面使用
   - 优先在内容丰富的网页上使用

3. **保持后端服务运行**
   - 使用插件前确保后端服务已启动

4. **定期更新插件**
   - 保持插件代码为最新版本

## 📞 获取帮助

如果以上方法都无法解决问题，请提供以下信息：

1. 浏览器版本
2. 插件版本
3. 问题发生的页面 URL
4. 控制台错误信息（截图）
5. Background 日志（截图）
6. 重现步骤


