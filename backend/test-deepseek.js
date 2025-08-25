// test-deepseek.js - 创建这个文件来测试 DeepSeek 连接
require('dotenv').config();
const axios = require('axios');

async function testDeepSeekConnection() {
  console.log('🔍 开始测试 DeepSeek API 连接...');
  console.log('API Key:', process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置');
  
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY 环境变量未设置');
    return;
  }

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: '你好，请回复"测试成功"'
        }
      ],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ DeepSeek API 连接成功!');
    console.log('响应:', response.data.choices[0].message.content);
  } catch (error) {
    console.error('❌ DeepSeek API 连接失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testDeepSeekConnection();