# 原文内容弹窗图片抓取功能

## ✅ **修改完成**

已成功为原文内容弹窗添加图片抓取功能，现在可以抓取并显示网页中的图片。

## 🎯 **主要修改**

### **1. 创建新的图片提取方法**

#### **新增方法：`extractFullPageContentWithImages()`**
- **位置**：`extension/content.js` 第1344-1574行
- **功能**：提取包含图片的完整页面内容
- **特点**：
  - 保留网页中的图片元素
  - 为图片添加信息容器（alt、title、链接）
  - 生成HTML格式的内容
  - 按文档顺序排列所有内容

### **2. 修改showSourceModal方法**

#### **修改前**
```javascript
showSourceModal() {
    const modal = this.rightPanel.querySelector('#splitSourceModal');
    if (modal) {
        const content = this.rightPanel.querySelector('#splitSourceContent');
        if (content) {
            // 使用新的方法提取完整内容，不做截断
            content.textContent = this.extractFullPageContent();
        }
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}
```

#### **修改后**
```javascript
showSourceModal() {
    const modal = this.rightPanel.querySelector('#splitSourceModal');
    if (modal) {
        const content = this.rightPanel.querySelector('#splitSourceContent');
        if (content) {
            // 使用新的方法提取包含图片的完整内容
            const htmlContent = this.extractFullPageContentWithImages();
            content.innerHTML = htmlContent;
        }
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}
```

### **3. 图片处理逻辑**

#### **图片提取和处理**
```javascript
// 4. 处理图片元素
const pageImages = clone.querySelectorAll('img');
pageImages.forEach(img => {
    // 确保图片有合适的尺寸
    if (!img.style.maxWidth) {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
    }
    if (!img.style.display) {
        img.style.display = 'block';
    }
    if (!img.style.margin) {
        img.style.margin = '10px 0';
    }
    
    // 添加图片信息
    const alt = img.alt || '图片';
    const src = img.src || '';
    const title = img.title || '';
    
    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.className = 'extracted-image-container';
    // ... 添加样式和信息
});
```

#### **图片信息展示**
- **图片描述**：显示alt和title属性
- **图片链接**：显示图片的src地址
- **图片容器**：为每个图片创建独立的容器
- **样式优化**：自动调整图片尺寸和布局

### **4. 更新CSS样式支持图片显示**

#### **图片容器样式**
```css
/* 提取的图片容器样式 */
.extracted-image-container {
    margin: 15px 0;
    padding: 10px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #f9f9f9;
    text-align: center;
}

.extracted-image-container img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10px auto;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.extracted-image-info {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
    text-align: left;
    font-weight: 500;
}

.extracted-image-link {
    font-size: 11px;
    color: #999;
    margin-top: 5px;
    word-break: break-all;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}
```

#### **内容样式优化**
```css
/* 提取的页面信息样式 */
.extracted-page-info {
    margin-bottom: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 4px solid #667eea;
}

/* 提取的内容样式 */
.extracted-content h1,
.extracted-content h2,
.extracted-content h3,
.extracted-content h4,
.extracted-content h5,
.extracted-content h6 {
    margin: 15px 0 10px 0;
    color: #333;
    font-weight: 600;
}

.extracted-content p {
    margin: 10px 0;
    line-height: 1.6;
    color: #444;
}
```

## 🚀 **功能特点**

### **图片抓取能力**
- **完整提取**：抓取网页中的所有图片
- **信息保留**：保留图片的alt、title、src属性
- **尺寸优化**：自动调整图片尺寸适应弹窗
- **链接显示**：显示图片的原始链接地址

### **图片显示效果**
- **独立容器**：每个图片有独立的容器
- **信息展示**：显示图片描述和链接信息
- **美观布局**：图片居中显示，有阴影效果
- **响应式设计**：图片自适应弹窗宽度

### **内容组织**
- **结构化显示**：按HTML结构组织内容
- **页面信息**：显示页面标题、URL、提取时间
- **混合内容**：文本、图片、表格混合显示
- **顺序保持**：保持原网页的内容顺序

## 🧪 **测试建议**

### **1. 基础功能测试**
1. 打开包含图片的网页
2. 点击思维导图插件图标
3. 点击"查看抓取网页内容"按钮
4. 确认弹窗显示图片和文本内容
5. 测试滚动功能是否正常

### **2. 图片显示测试**
1. 测试不同尺寸的图片
2. 测试有alt和title属性的图片
3. 测试没有alt属性的图片
4. 确认图片链接信息正确显示

### **3. 内容完整性测试**
1. 测试包含多张图片的页面
2. 测试图片与文本混合的页面
3. 测试包含表格和图片的页面
4. 确认所有内容都完整显示

### **4. 视觉效果测试**
1. 确认图片容器样式美观
2. 确认图片信息清晰可读
3. 确认图片与文本布局协调
4. 确认滚动体验流畅

## 📝 **使用说明**

### **查看包含图片的完整内容**
1. **点击按钮**：点击"查看抓取网页内容"按钮
2. **弹窗显示**：原文内容弹窗自动打开
3. **完整内容**：显示完整的网页内容，包括：
   - 页面标题和URL
   - 提取时间
   - 所有文本内容（标题、段落、列表、表格）
   - 所有图片（带描述和链接信息）

### **图片信息说明**
- **🖼️ 图片**：图片标识
- **图片描述**：显示alt和title属性
- **链接信息**：显示图片的src地址
- **图片显示**：图片自动调整尺寸适应弹窗

### **滚动浏览**
- **鼠标滚轮**：使用鼠标滚轮上下滚动
- **拖拽滚动条**：拖拽右侧滚动条
- **键盘操作**：使用上下箭头键滚动
- **触摸设备**：支持触摸滑动

## 🎉 **修改效果**

### **功能增强**
- **图片抓取**：从纯文本提取升级为HTML内容提取
- **视觉丰富**：原文内容弹窗现在包含图片
- **信息完整**：图片的描述和链接信息完整保留
- **布局美观**：图片有独立的容器和样式

### **用户体验**
- **直观显示**：用户可以直接看到网页中的图片
- **信息丰富**：图片的描述和链接信息一目了然
- **布局协调**：图片与文本内容协调显示
- **操作便捷**：滚动浏览所有内容

### **技术改进**
- **HTML渲染**：从textContent改为innerHTML
- **DOM操作**：动态创建图片容器
- **样式优化**：专门的CSS样式支持图片显示
- **错误处理**：修复变量重复声明问题

## 🔍 **技术说明**

### **图片提取算法**
- **DOM克隆**：使用cloneNode避免影响原页面
- **元素过滤**：移除不需要的元素但保留图片
- **信息提取**：提取图片的alt、title、src属性
- **容器创建**：为每个图片创建独立的信息容器

### **HTML生成**
- **结构化内容**：按HTML结构组织内容
- **样式内联**：使用内联样式确保显示效果
- **信息丰富**：包含页面信息和图片信息
- **顺序保持**：保持原网页的内容顺序

### **CSS优化**
- **响应式设计**：图片自适应弹窗宽度
- **视觉层次**：不同的背景色和边框区分内容
- **美观效果**：阴影、圆角、间距等视觉效果
- **可读性**：合适的字体大小和行高

用户现在可以在原文内容弹窗中看到完整的网页内容，包括所有图片，享受更丰富的视觉体验！
