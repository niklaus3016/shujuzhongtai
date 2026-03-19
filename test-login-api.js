import axios from 'axios';

// 测试登录记录API
async function testLoginApi() {
  try {
    console.log('测试登录记录API...');
    
    // 认证令牌（从前端localStorage中获取）
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiY3VpZGluZyIsIm5hbWUiOiLkuLvluqYiLCJ1c2VybmFtZSI6ImN1aWRpbmciLCJyb2xlIjoxLCJ0ZWFtTmFtZSI6IuiuvuWPr+W4puWun+W6puWlvea1t+S4gOaIkeS4g+i9nCIsIm1vZGlmaWVkIjp0cnVlLCJhdmF0YXIiOiJodHRwczovL2xhdW5jaHBhZ2UuY29tL3N0YXRpYy9pbWFnZXMvaW1hZ2VzX25vdGljZS5zdmcifSwiaWF0IjoxNzczNTA3NDEyLCJleHAiOjE4MDUxMjk4MTJ9.C2oY9K3L5Q3Z6Y7X8V9B0N1M2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8';
    
    // 创建带认证的axios实例
    const api = axios.create({
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 1. 测试登录记录API（带参数）
    try {
      const loginRecordResponse = await api.get('https://wfqmaepvjkdd.sealoshzh.site/api/user/login-stats', {
        params: {
          userId: '8202',
          employeeId: '8202'
        }
      });
      console.log('登录记录API响应状态:', loginRecordResponse.status);
      console.log('登录记录API响应数据:', loginRecordResponse.data);
    } catch (error) {
      console.log('\n登录记录API失败:', error.message);
      if (error.response) {
        console.log('错误响应数据:', error.response.data);
      }
    }
    
    // 2. 测试登录记录API（备用端点）
    try {
      const loginRecordResponse2 = await api.get('https://wfqmaepvjkdd.sealoshzh.site/api/user/login-record');
      console.log('\n备用登录记录API响应状态:', loginRecordResponse2.status);
      console.log('备用登录记录API响应数据:', loginRecordResponse2.data);
      if (loginRecordResponse2.data && typeof loginRecordResponse2.data === 'object') {
        console.log('备用登录记录API响应数据的键:', Object.keys(loginRecordResponse2.data));
        if ('data' in loginRecordResponse2.data) {
          console.log('备用登录记录API响应的data字段:', loginRecordResponse2.data.data);
          console.log('备用登录记录API响应的data字段类型:', typeof loginRecordResponse2.data.data);
          console.log('备用登录记录API响应的data字段是否为数组:', Array.isArray(loginRecordResponse2.data.data));
          if (Array.isArray(loginRecordResponse2.data.data)) {
            console.log('备用登录记录API响应的data字段长度:', loginRecordResponse2.data.data.length);
            if (loginRecordResponse2.data.data.length > 0) {
              console.log('备用登录记录API响应的第一个数据:', loginRecordResponse2.data.data[0]);
              console.log('备用登录记录API响应的第一个数据的键:', Object.keys(loginRecordResponse2.data.data[0]));
            }
          }
        }
      }
    } catch (error) {
      console.log('\n备用登录记录API失败:', error.message);
      if (error.response) {
        console.log('错误响应数据:', error.response.data);
      }
    }
    
    // 3. 测试新人API
    const newUsersResponse = await api.get('https://wfqmaepvjkdd.sealoshzh.site/api/user/new-users?days=15');
    console.log('\n新人API响应状态:', newUsersResponse.status);
    console.log('新人API响应数据长度:', newUsersResponse.data.length);
    if (newUsersResponse.data.length > 0) {
      console.log('新人API响应的前5个数据:', newUsersResponse.data.slice(0, 5));
    }
    
    // 4. 测试今日数据API
    try {
      const todayDataResponse = await api.get('https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/users', {
        params: {
          range: 'today',
          team: '鼎盛战队',
          limit: 1000
        }
      });
      console.log('\n今日数据API响应状态:', todayDataResponse.status);
      console.log('今日数据API响应数据长度:', todayDataResponse.data.length);
      if (todayDataResponse.data.length > 0) {
        console.log('今日数据API响应的前5个数据:', todayDataResponse.data.slice(0, 5));
        console.log('今日数据API响应的第一个数据的键:', Object.keys(todayDataResponse.data[0]));
      }
    } catch (error) {
      console.log('\n今日数据API失败:', error.message);
      if (error.response) {
        console.log('错误响应数据:', error.response.data);
      }
    }
    
  } catch (error) {
    console.error('测试API失败:', error.message);
    console.error('错误详情:', error);
  }
}

testLoginApi();
