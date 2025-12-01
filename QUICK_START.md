# 快速启动指南

## 🚀 启动步骤

### 1. 启动后端服务

**方法一：使用启动脚本（推荐）**
```bash
双击运行: start-backend.bat
```

**方法二：手动启动**
```bash
cd backend
npm start
```

### 2. 验证后端服务

打开浏览器访问：
- 健康检查：http://localhost:3001/api/health
- 应该看到：`{"status":"OK","message":"Server is running"}`

### 3. 加载浏览器扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `extension` 文件夹

### 4. 使用扩展

1. 打开任意论文或文章网页
2. 点击浏览器工具栏中的扩展图标
3. 或者右键点击页面，选择"打开 AI 思维导图"
4. 点击"生成思维导图"按钮
5. 等待生成完成

## ⚠️ 常见问题

### 问题：点击"生成思维导图"后报错 "HTTP 503: Service Unavailable"

**原因：** 后端服务没有启动

**解决方案：**
1. 运行 `start-backend.bat` 启动后端服务
2. 等待看到 "🚀 Server running on http://localhost:3001"
3. 刷新网页，重新尝试生成思维导图

### 问题：后端启动失败

**检查项：**
1. 确保已安装 Node.js（建议 v18 或更高版本）
2. 确保已运行 `npm install` 安装依赖
3. 检查 `.env` 文件是否存在并配置了 API Keys

### 问题：生成失败或返回错误

**检查项：**
1. 检查 `.env` 文件中的 API Keys 是否正确
2. 查看后端终端输出的错误信息
3. 检查网络连接是否正常

## 📝 配置说明

### 后端配置 (backend/.env)

```env
# DeepSeek API Key (默认使用)
DEEPSEEK_API_KEY=your_deepseek_api_key

# Claude API Key (备用)
ANTHROPIC_AUTH_TOKEN=your_claude_api_key

# 服务端口（默认 3001）
PORT=3001
```

### 扩展配置

扩展默认连接到 `http://localhost:3001`，如需修改：
- 编辑 `extension/background.js` 第 6 行
- 编辑 `extension/content.js` 第 16 行

## 🎯 功能特性

- ✅ 自动抓取网页内容
- ✅ AI 生成思维导图
- ✅ 点击节点高亮原文
- ✅ AI 问答功能
- ✅ 导出 PNG/Markdown/Xmind
- ✅ 分屏显示模式

## 📚 更多文档

- [浏览器扩展指南](BROWSER_EXTENSION_GUIDE.md)
- [重构总结](REFACTORING_SUMMARY.md)
- [扩展功能总结](EXTENSION_SUMMARY.md)

---

**最后更新：** 2025-11-27











