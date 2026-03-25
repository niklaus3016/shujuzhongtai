import axios from 'axios';

// 测试彩票历史记录API
async function testLotteryHistoryApi() {
  try {
    console.log('测试彩票历史记录API...');
    
    // 使用现有的token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiY3VpZGluZyIsIm5hbWUiOiLkuLvluqYiLCJ1c2VybmFtZSI6ImN1aWRpbmciLCJyb2xlIjoxLCJ0ZWFtTmFtZSI6IuiuvuWPr+W4puWun+W6puWlvea1t+S4gOaIkeS4g+i9nCIsIm1vZGlmaWVkIjp0cnVlLCJhdmF0YXIiOiJodHRwczovL2xhdW5jaHBhZ2UuY29tL3N0YXRpYy9pbWFnZXMvaW1hZ2VzX25vdGljZS5zdmcifSwiaWF0IjoxNzczNTA3NDEyLCJleHAiOjE4MDUxMjk4MTJ9.C2oY9K3L5Q3Z6Y7X8V9B0N1M2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8';
    console.log('使用现有token:', token);
    
    // 测试不传递日期参数
    console.log('\n1. 测试不传递日期参数:');
    const response1 = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/lottery/history?page=1&limit=20', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('响应状态:', response1.status);
    console.log('返回数据长度:', response1.data.data.history.length);
    console.log('前3条记录的日期:', response1.data.data.history.slice(0, 3).map(item => {
      return new Date(item.drawTime).toLocaleDateString();
    }));
    
    // 测试传递日期参数
    console.log('\n2. 测试传递日期参数 (2026-03-27):');
    const response2 = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/lottery/history?page=1&limit=20&date=2026-03-27', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('响应状态:', response2.status);
    console.log('返回数据长度:', response2.data.data.history.length);
    console.log('前3条记录的日期:', response2.data.data.history.slice(0, 3).map(item => {
      return new Date(item.drawTime).toLocaleDateString();
    }));
    
    // 测试传递另一个日期参数
    console.log('\n3. 测试传递日期参数 (2026-03-25):');
    const response3 = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/lottery/history?page=1&limit=20&date=2026-03-25', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('响应状态:', response3.status);
    console.log('返回数据长度:', response3.data.data.history.length);
    console.log('前3条记录的日期:', response3.data.data.history.slice(0, 3).map(item => {
      return new Date(item.drawTime).toLocaleDateString();
    }));
    
  } catch (error) {
    console.error('测试API失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

testLotteryHistoryApi();
