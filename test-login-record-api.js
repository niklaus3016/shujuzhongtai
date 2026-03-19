// 测试登录记录API的脚本
import axios from 'axios';

// 认证令牌（从前端localStorage中获取）
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiY3VpZGluZyIsIm5hbWUiOiLkuLvluqYiLCJ1c2VybmFtZSI6ImN1aWRpbmciLCJyb2xlIjoxLCJ0ZWFtTmFtZSI6IuiuvuWPr+W4puWun+W6puWlvea1t+S4gOaIkeS4g+i9nCIsIm1vZGlmaWVkIjp0cnVlLCJhdmF0YXIiOiJodHRwczovL2xhdW5jaHBhZ2UuY29tL3N0YXRpYy9pbWFnZXMvaW1hZ2VzX25vdGljZS5zdmcifSwiaWF0IjoxNzczNTA3NDEyLCJleHAiOjE4MDUxMjk4MTJ9.C2oY9K3L5Q3Z6Y7X8V9B0N1M2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8';

// 创建带认证的axios实例
const api = axios.create({
  baseURL: 'https://wfqmaepvjkdd.sealoshzh.site/api',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// 构建北京时间的当天开始和结束时间
const now = new Date();
const beijingOffset = 8; // 北京时间偏移
const beijingTime = new Date(now.getTime() + beijingOffset * 60 * 60 * 1000);
const todayStart = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), 0, 0, 0);
const todayEnd = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), 23, 59, 59);

console.log('北京时间:', beijingTime);
console.log('今日开始:', todayStart);
console.log('今日结束:', todayEnd);
console.log('今日开始ISO:', todayStart.toISOString());
console.log('今日结束ISO:', todayEnd.toISOString());

// 测试登录记录API
async function testLoginRecordAPI() {
  try {
    console.log('开始测试登录记录API...');
    const response = await api.get('/user/login-record', {
      params: {
        startDate: todayStart.toISOString(),
        endDate: todayEnd.toISOString()
      }
    });
    console.log('API响应状态:', response.status);
    console.log('API响应数据:', response.data);
    
    if (response.data && Array.isArray(response.data)) {
      console.log('登录记录数量:', response.data.length);
      console.log('前5条登录记录:', response.data.slice(0, 5));
    } else if (response.data && response.data.data) {
      console.log('登录记录数量:', response.data.data.length);
      console.log('前5条登录记录:', response.data.data.slice(0, 5));
    }
  } catch (error) {
    console.error('API请求失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testLoginRecordAPI();
