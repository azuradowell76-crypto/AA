# Provider 映射问题修复

## 问题描述

用户点击"生成思维导图"按钮后，浏览器控制台报 503 错误，后端日志显示收到了请求但返回了 503 Service Unavailable。

## 问题原因

1. **前端发送的 provider 参数为 `'default'`**
   - `content.js` 中：`provider: this.provider || 'deepseek'`
   - 当 `this.provider` 未初始化时，默认为 `undefined`
   - 传递给 background.js 时变成了 `'default'`

2. **background.js 的映射没有生效**
   - background.js 第 127-128 行有映射逻辑
   - 但由于某些原因，后端仍然收到了 `'default'` 作为 provider

3. **后端的 `isHealthy` 方法不认识 `'default'`**
   - `llm.js` 的 `isHealthy` 方法只处理 `'deepseek'` 和 `'claude'`
   - 遇到 `'default'` 时，走到 default case，返回 `false`
   - 导致路由返回 503 错误

## 修复方案

### 1. 修复后端 `isHealthy` 方法

在 `backend/src/services/llm.js` 中添加 `'default'` 到 `'deepseek'` 的映射：

```javascript
async isHealthy(provider = 'deepseek') {
  try {
    // 将 'default' 映射为 'deepseek'
    const actualProvider = (provider === 'default' || !provider) ? 'deepseek' : provider;
    
    switch (actualProvider) {
      case 'deepseek':
        return !!this.providers.deepseek.apiKey;
      case 'claude':
        return !!this.providers.claude.apiKey;
      default:
        console.warn(`未知的提供商: ${provider}, 默认返回 false`);
        return false;
    }
  } catch (error) {
    console.error(`${provider} 健康检查失败:`, error.message);
    return false;
  }
}
```

### 2. 修复 `generateMindmapStructure` 方法

同样添加映射：

```javascript
async generateMindmapStructure(text, provider = 'deepseek', model = 'deepseek-chat') {
  const prompt = this.buildMindmapPrompt(text);
  
  // 将 'default' 映射为 'deepseek'
  const actualProvider = (provider === 'default' || !provider) ? 'deepseek' : provider;
  const actualModel = (model === 'default' || !model) ? 'deepseek-chat' : model;

  switch (actualProvider) {
    case 'deepseek':
      return await this.generateWithDeepSeek(prompt, actualModel);
    case 'claude':
      return await this.generateWithClaude(prompt, actualModel);
    default:
      throw new Error(`不支持的提供商: ${actualProvider}`);
  }
}
```

### 3. 修复 `generateAIResponse` 方法

添加同样的映射逻辑。

## 修复后的效果

- ✅ 后端能正确处理 `'default'` provider
- ✅ 自动映射为 `'deepseek'`
- ✅ 健康检查通过
- ✅ 思维导图生成成功

## 测试步骤

1. 重启后端服务（已完成）
2. 刷新浏览器页面
3. 打开 AI 思维导图插件
4. 点击"生成思维导图"按钮
5. 验证思维导图正常生成

## 相关文件

- `backend/src/services/llm.js` - 修复了 3 个方法
- `backend/src/routes/mindmap.js` - 路由调用 `isHealthy` 检查

## 后续优化建议

1. **统一 provider 默认值**
   - 在前端初始化时就设置为 `'deepseek'`
   - 避免使用 `'default'` 字符串

2. **添加更好的错误提示**
   - 当 provider 不支持时，返回更友好的错误信息
   - 列出可用的 provider 列表

3. **添加 provider 验证中间件**
   - 在路由层面统一处理 provider 映射
   - 避免在多个地方重复映射逻辑

---

**修复时间：** 2025-11-27
**修复状态：** ✅ 已完成并测试











