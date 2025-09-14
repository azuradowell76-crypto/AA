#!/bin/bash

echo "📦 安装文件处理依赖包"
echo

echo "🔄 安装multer (文件上传)..."
npm install multer@^1.4.5-lts.1

echo "🔄 安装pdf-parse (PDF解析)..."
npm install pdf-parse@^1.1.1

echo "🔄 安装mammoth (Word文档解析)..."
npm install mammoth@^1.6.0

echo "🔄 安装xlsx (Excel解析)..."
npm install xlsx@^0.18.5

echo "🔄 安装pptx-parser (PowerPoint解析)..."
npm install pptx-parser@^1.0.0

echo "🔄 安装tesseract.js (OCR图片识别)..."
npm install tesseract.js@^5.0.4

echo
echo "✅ 所有文件处理依赖安装完成！"
echo
echo "📋 已安装的包:"
echo "  - multer: 文件上传处理"
echo "  - pdf-parse: PDF文档解析"
echo "  - mammoth: Word文档解析"
echo "  - xlsx: Excel表格解析"
echo "  - pptx-parser: PowerPoint解析"
echo "  - tesseract.js: 图片OCR识别"
echo
echo "🚀 现在可以处理多种文件格式了！"
