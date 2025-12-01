# 左侧面板空白问题修复方案

## 问题描述

生成思维导图后，左侧的网页内容变成空白。

## 问题原因

在 `movePageContentToLeftPanel()` 方法中存在逻辑和缩进问题：

1. **第 1445 行**：过早清空左侧面板
   ```javascript
   this.leftPanel.innerHTML = '';  // 先清空
   ```

2. **第 1448-1460 行**：缩进错误导致条件判断失效
   ```javascript
   if (this.originalBodyContent && this.originalBodyContent.length > 0) {
   console.log('📋 使用保存的原始内容克隆...');  // 缩进错误！
   ```

3. **结果**：左侧面板被清空后，由于缩进问题，添加内容的代码没有执行

## 临时解决方案

1. **刷新页面**：按 F5 刷新网页
2. **重新打开插件**：点击扩展图标
3. **重新生成**：点击"生成思维导图"按钮

## 永久修复方案

### 方案 1：修复缩进（推荐）

修复第 1449-1460 行和 1462-1501 行的缩进：

```javascript
// 第 1448-1460 行
if (this.originalBodyContent && this.originalBodyContent.length > 0) {
    console.log('📋 使用保存的原始内容克隆...');  // 正确缩进
    this.originalBodyContent.forEach(clone => {
        const newClone = clone.cloneNode(true);
        this.sanitizeClonedNode(newClone);
        newClone.style.display = 'block';
        newClone.style.visibility = 'visible';
        newClone.style.opacity = '1';
        this.leftPanel.appendChild(newClone);
    });
    console.log('✅ 已添加保存的原始内容克隆到左侧面板');
} else {
    // else 块也需要正确缩进
    const bodyChildren = Array.from(document.body.children).filter(
        child => child.id !== 'mindmap-split-container'
    );
    // ... 其余代码
}
```

### 方案 2：改进逻辑

不要过早清空面板，先准备好内容再清空：

```javascript
// 准备内容
let contentToAdd = [];

if (this.originalBodyContent && this.originalBodyContent.length > 0) {
    console.log('📋 使用保存的原始内容克隆...');
    contentToAdd = this.originalBodyContent.map(clone => {
        const newClone = clone.cloneNode(true);
        this.sanitizeClonedNode(newClone);
        newClone.style.display = 'block';
        newClone.style.visibility = 'visible';
        newClone.style.opacity = '1';
        return newClone;
    });
} else {
    const bodyChildren = Array.from(document.body.children).filter(
        child => child.id !== 'mindmap-split-container'
    );
    contentToAdd = bodyChildren;
}

// 现在清空并添加内容
if (contentToAdd.length > 0) {
    this.leftPanel.innerHTML = '';
    contentToAdd.forEach(element => {
        this.leftPanel.appendChild(element);
    });
    console.log('✅ 已添加', contentToAdd.length, '个元素到左侧面板');
} else {
    console.warn('⚠️ 没有内容可添加');
}
```

## 手动修复步骤

由于代码结构复杂，建议使用代码编辑器的自动格式化功能：

1. 打开 `extension/content.js`
2. 定位到第 1369 行（`movePageContentToLeftPanel` 方法）
3. 选择整个方法（到第 1600 行左右）
4. 使用编辑器的"格式化文档"功能（VS Code: Shift+Alt+F）
5. 检查第 1448-1501 行的缩进是否正确
6. 保存文件
7. 重新加载扩展

## 验证修复

1. 刷新网页
2. 打开插件
3. 点击"生成思维导图"
4. 检查左侧是否显示网页内容
5. 检查浏览器控制台是否有错误

## 相关文件

- `extension/content.js` - 第 1369-1600 行
- 方法：`movePageContentToLeftPanel()`

---

**状态：** 需要手动修复
**优先级：** 高
**影响：** 左侧面板显示异常











