const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const Tesseract = require('tesseract.js');

class FileProcessor {
  constructor() {
    this.supportedTypes = {
      pdf: ['application/pdf'],
      doc: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      xlsx: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ppt: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
      text: ['text/plain', 'text/csv', 'application/json', 'text/javascript', 'text/html', 'text/css', 'text/xml']
    };
  }

  // 检测文件类型
  detectFileType(fileName, mimeType) {
    const ext = path.extname(fileName).toLowerCase();
    
    // 根据扩展名判断
    if (['.pdf'].includes(ext)) return 'pdf';
    if (['.doc', '.docx'].includes(ext)) return 'doc';
    if (['.xls', '.xlsx'].includes(ext)) return 'xlsx';
    if (['.ppt', '.pptx'].includes(ext)) return 'ppt';
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) return 'image';
    if (['.txt', '.csv', '.json', '.js', '.html', '.css', '.xml'].includes(ext)) return 'text';
    
    // 根据MIME类型判断
    for (const [type, mimes] of Object.entries(this.supportedTypes)) {
      if (mimes.includes(mimeType)) return type;
    }
    
    return 'unknown';
  }

  // 处理PDF文件
  async processPDF(filePath) {
    try {
      console.log('📄 处理PDF文件:', filePath);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      return {
        content: data.text,
        summary: {
          title: data.info?.Title || path.basename(filePath, '.pdf'),
          pages: data.numpages,
          author: data.info?.Author,
          creator: data.info?.Creator
        }
      };
    } catch (error) {
      console.error('PDF处理错误:', error);
      throw new Error('PDF文件处理失败: ' + error.message);
    }
  }

  // 处理Word文档
  async processDOC(filePath) {
    try {
      console.log('📝 处理Word文档:', filePath);
      const result = await mammoth.extractRawText({ path: filePath });
      
      return {
        content: result.value,
        summary: {
          title: path.basename(filePath, path.extname(filePath)),
          messages: result.messages
        }
      };
    } catch (error) {
      console.error('Word文档处理错误:', error);
      throw new Error('Word文档处理失败: ' + error.message);
    }
  }

  // 处理Excel文件
  async processXLSX(filePath) {
    try {
      console.log('📊 处理Excel文件:', filePath);
      const workbook = XLSX.readFile(filePath);
      let content = '';
      let summary = {
        title: path.basename(filePath, path.extname(filePath)),
        sheets: []
      };

      const MAX_ROWS_PER_SHEET = 100; // 限制每个工作表最多100行
      const MAX_CONTENT_LENGTH = 50000; // 限制总内容长度

      // 遍历所有工作表
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        summary.sheets.push({
          name: sheetName,
          rows: jsonData.length,
          processedRows: Math.min(jsonData.length, MAX_ROWS_PER_SHEET)
        });

        // 将表格数据转换为文本，限制行数
        content += `\n=== 工作表: ${sheetName} ===\n`;
        const rowsToProcess = Math.min(jsonData.length, MAX_ROWS_PER_SHEET);
        
        for (let index = 0; index < rowsToProcess; index++) {
          const row = jsonData[index];
          if (row && row.length > 0) {
            content += `第${index + 1}行: ${row.join(' | ')}\n`;
          }
        }
        
        // 如果内容过长，添加提示
        if (jsonData.length > MAX_ROWS_PER_SHEET) {
          content += `\n[注意：工作表${sheetName}共有${jsonData.length}行，仅显示前${MAX_ROWS_PER_SHEET}行]\n`;
        }
        
        // 检查总内容长度
        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.substring(0, MAX_CONTENT_LENGTH);
          content += '\n\n[注意：内容过长，已截断]';
          break;
        }
      }

      console.log(`📊 Excel处理完成，内容长度: ${content.length} 字符`);
      return { content, summary };
    } catch (error) {
      console.error('Excel文件处理错误:', error);
      throw new Error('Excel文件处理失败: ' + error.message);
    }
  }

  // 处理PowerPoint文件
  async processPPT(filePath) {
    try {
      console.log('📽️ 处理PowerPoint文件:', filePath);
      // 暂时提供基础支持，后续可以添加更完善的PowerPoint解析
      const content = `PowerPoint文件: ${path.basename(filePath)}\n\n注意：PowerPoint文件内容提取功能正在开发中，请手动输入内容。`;
      
      return {
        content,
        summary: {
          title: path.basename(filePath, path.extname(filePath)),
          note: 'PowerPoint文件内容提取功能正在开发中'
        }
      };
    } catch (error) {
      console.error('PowerPoint文件处理错误:', error);
      throw new Error('PowerPoint文件处理失败: ' + error.message);
    }
  }

  // 处理图片文件（OCR）
  async processImage(filePath) {
    try {
      console.log('🖼️ 处理图片文件:', filePath);
      const { data: { text } } = await Tesseract.recognize(filePath, 'chi_sim+eng', {
        logger: m => console.log(m)
      });
      
      return {
        content: text,
        summary: {
          title: path.basename(filePath, path.extname(filePath)),
          type: '图片OCR识别'
        }
      };
    } catch (error) {
      console.error('图片处理错误:', error);
      throw new Error('图片文件处理失败: ' + error.message);
    }
  }

  // 处理文本文件
  async processText(filePath) {
    try {
      console.log('📄 处理文本文件:', filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      return {
        content,
        summary: {
          title: path.basename(filePath, path.extname(filePath)),
          size: content.length
        }
      };
    } catch (error) {
      console.error('文本文件处理错误:', error);
      throw new Error('文本文件处理失败: ' + error.message);
    }
  }

  // 主处理函数
  async processFile(filePath, originalName, mimeType) {
    try {
      const fileType = this.detectFileType(originalName, mimeType);
      console.log(`🔍 检测到文件类型: ${fileType}`);

      let result;
      switch (fileType) {
        case 'pdf':
          result = await this.processPDF(filePath);
          break;
        case 'doc':
          result = await this.processDOC(filePath);
          break;
        case 'xlsx':
          result = await this.processXLSX(filePath);
          break;
        case 'ppt':
          result = await this.processPPT(filePath);
          break;
        case 'image':
          result = await this.processImage(filePath);
          break;
        case 'text':
          result = await this.processText(filePath);
          break;
        default:
          throw new Error('不支持的文件类型');
      }

      // 清理临时文件
      try {
        fs.unlinkSync(filePath);
        console.log('🗑️ 临时文件已清理:', filePath);
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
      }

      return result;
    } catch (error) {
      console.error('文件处理失败:', error);
      throw error;
    }
  }
}

module.exports = FileProcessor;
