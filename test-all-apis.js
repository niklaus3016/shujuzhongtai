import axios from 'axios';

// 测试所有 API 端点
async function testAllApis() {
  try {
    console.log('开始测试所有 API 端点...');
    
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
    
    // 测试端点列表
    const endpoints = [
      // 登录相关
      { method: 'POST', url: '/admin/login', data: { username: 'admin', password: 'password' }, skipAuth: true },
      
      // 仪表盘相关
      { method: 'GET', url: '/admin/dashboard/users', params: { range: 'today', limit: 1000 } },
      
      // 员工相关
      { method: 'GET', url: '/admin/employee/list', params: { pageSize: 1000 } },
      
      // 登录记录相关
      { method: 'GET', url: '/user/login-stats', params: { userId: '8202', employeeId: '8202' } },
      { method: 'GET', url: '/user/login-record' },
      
      // 新人相关
      { method: 'GET', url: '/user/new-users', params: { days: 15 } },
      
      // 团队相关
      { method: 'GET', url: '/admin/team/list' },
    ];
    
    // 测试每个端点
    for (const endpoint of endpoints) {
      console.log(`\n测试 ${endpoint.method} ${endpoint.url}`);
      
      try {
        let response;
        if (endpoint.skipAuth) {
          // 不使用认证的请求
          response = await axios[endpoint.method.toLowerCase()](`https://wfqmaepvjkdd.sealoshzh.site/api${endpoint.url}`, {
            data: endpoint.data,
            params: endpoint.params
          });
        } else {
          // 使用认证的请求
          response = await api[endpoint.method.toLowerCase()](endpoint.url, {
            data: endpoint.data,
            params: endpoint.params
          });
        }
        
        console.log(`✓ 成功 - 状态码: ${response.status}`);
        console.log(`  响应数据类型: ${typeof response.data}`);
        if (response.data && typeof response.data === 'object') {
          if (Array.isArray(response.data)) {
            console.log(`  响应数据长度: ${response.data.length}`);
          } else {
            console.log(`  响应数据键: ${Object.keys(response.data).join(', ')}`);
          }
        }
      } catch (error) {
        console.log(`✗ 失败`);
        if (error.response) {
          console.log(`  状态码: ${error.response.status}`);
          console.log(`  错误数据: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          console.log(`  请求发送失败: ${error.message}`);
        } else {
          console.log(`  错误: ${error.message}`);
        }
      }
    }
    
    console.log('\n所有 API 测试完成！');
    
  } catch (error) {
    console.error('测试 API 失败:', error.message);
    console.error('错误详情:', error);
  }
}

testAllApis();