# 🧠 思维导图AI助手 - 浏览器插件版

## 📖 项目概述

本项目将原有的思维导图AI生成器改造为浏览器插件版本，让用户可以在任何网页上快速生成思维导图，并提供AI问答功能。

## 🏗️ 项目结构

```
mindmap-ai-extension/
├── backend/                    # 后端服务（保持不变）
│   ├── src/
│   ├── package.json
│   └── ...
├── frontend/                   # 原前端应用（保持不变）
│   ├── src/
│   ├── package.json
│   └── ...
├── extension/                  # 🆕 浏览器插件
│   ├── manifest.json          # 插件配置文件
│   ├── popup.html             # 弹窗界面
│   ├── popup.css              # 弹窗样式
│   ├── popup.js               # 弹窗逻辑
│   ├── content.js             # 页面内容脚本
│   ├── content.css            # 内容脚本样式
│   ├── background.js          # 后台服务脚本
│   ├── icons/                 # 插件图标
│   │   ├── icon16.png
│   │   ├── icon32.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── install-extension.bat   # Windows安装脚本
│   ├── install-extension.sh   # Linux/Mac安装脚本
│   └── README.md              # 插件说明文档
└── BROWSER_EXTENSION_GUIDE.md # 本文档
```

## 🚀 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 `http://localhost:3001` 启动。

### 2. 安装浏览器插件

#### Windows用户
```bash
cd extension
install-extension.bat
```

#### Linux/Mac用户
```bash
cd extension
chmod +x install-extension.sh
./install-extension.sh
```

#### 手动安装
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `extension` 文件夹

### 3. 使用插件

- 点击浏览器工具栏中的🧠图标
- 或使用快捷键 `Ctrl+Shift+M`
- 在任意网页选择文本，点击提示快速生成思维导图

## ✨ 主要功能

### 🎯 核心功能
- **思维导图生成**：输入文本或上传文件，AI自动生成结构化思维导图
- **AI问答对话**：点击思维导图节点，与AI进行深度对话
- **多格式导出**：支持Markdown和PNG格式导出
- **文件处理**：支持PDF、Word、图片等多种文件格式

### 🌐 浏览器集成
- **页面文本选择**：在任意网页选择文本，快速生成思维导图
- **浮动按钮**：每个页面右上角显示🧠浮动按钮
- **快捷键支持**：`Ctrl+Shift+M` 快速打开插件
- **智能提示**：选择文本后显示快速操作提示

## 🔧 技术实现

### 插件架构

1. **Manifest V3**：使用最新的Chrome扩展API
2. **Popup界面**：主要的用户交互界面
3. **Content Script**：页面集成和文本选择功能
4. **Background Script**：消息传递和插件管理
5. **API集成**：与后端服务通信

### 关键文件说明

- `manifest.json`：插件配置文件，定义权限和入口点
- `popup.html/css/js`：弹窗界面，包含完整的思维导图生成功能
- `content.js`：页面内容脚本，实现文本选择和浮动按钮
- `background.js`：后台服务，处理消息传递和插件生命周期

## 🎨 界面设计

### 设计理念
- **简洁直观**：保持原有功能的简洁性
- **响应式设计**：适配不同屏幕尺寸
- **现代化UI**：使用渐变色彩和圆角设计
- **一致性**：与原有Web版本保持视觉一致性

### 交互体验
- **一键生成**：简化的操作流程
- **智能提示**：上下文相关的操作建议
- **快速访问**：多种方式快速打开插件
- **无缝集成**：与浏览器环境完美融合

## 🔒 安全考虑

### 权限最小化
- 只请求必要的权限
- 明确说明权限用途
- 遵循Chrome扩展安全最佳实践

### 数据安全
- 本地存储用户设置
- 不收集敏感信息
- API调用使用HTTPS

## 🐛 故障排除

### 常见问题

1. **插件无法加载**
   - 检查manifest.json格式
   - 确保所有文件路径正确
   - 查看Chrome控制台错误

2. **API调用失败**
   - 确保后端服务运行在localhost:3001
   - 检查网络连接
   - 验证API密钥配置

3. **功能异常**
   - 刷新浏览器页面
   - 重新加载插件
   - 检查浏览器控制台

### 调试方法

1. **插件调试**
   - 右键插件图标 → 检查弹出内容
   - Chrome扩展管理页面查看错误

2. **网络调试**
   - Chrome开发者工具 → Network标签
   - 查看API请求状态

## 📈 未来规划

### 功能增强
- [ ] 支持更多AI模型
- [ ] 添加思维导图模板
- [ ] 支持协作功能
- [ ] 云端同步功能

### 技术优化
- [ ] 性能优化
- [ ] 离线模式支持
- [ ] 多语言支持
- [ ] 主题定制

## 🤝 贡献指南

### 开发环境
1. 克隆项目
2. 安装依赖：`npm install`
3. 启动后端：`npm start`
4. 加载插件到Chrome

### 提交规范
- 使用清晰的提交信息
- 遵循代码规范
- 添加必要的测试
- 更新文档

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。

---

🎉 现在您可以在任何网页上享受思维导图AI助手的强大功能了！

