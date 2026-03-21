import axios from 'axios';

// 测试 API 所有端点的状态
async function testApiStatus() {
  try {
    console.log('开始测试 API 所有端点的状态...');
    
    // 基础 API 地址
    const baseUrl = 'https://wfqmaepvjkdd.sealoshzh.site/api';
    
    // 测试端点列表
    const endpoints = [
      // 认证相关
      { method: 'POST', url: '/admin/login', data: { username: 'admin', password: 'password' } },
      
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
      { method: 'GET', url: '/admin/team/members', params: { teamId: '69af8e34132651c70aa85608', mode: 'today' } },
      
      // 账号管理相关
      { method: 'GET', url: '/admin/account/list' },
      { method: 'POST', url: '/admin/account/create' },
      { method: 'POST', url: '/admin/account/update' },
      { method: 'POST', url: '/admin/account/delete' },
      
      // 密码相关
      { method: 'POST', url: '/admin/update-password' },
    ];
    
    // 测试每个端点
    for (const endpoint of endpoints) {
      console.log(`\n测试 ${endpoint.method} ${baseUrl}${endpoint.url}`);
      
      try {
        let response;
        if (endpoint.method === 'GET') {
          response = await axios.get(`${baseUrl}${endpoint.url}`, {
            params: endpoint.params
          });
        } else if (endpoint.method === 'POST') {
          response = await axios.post(`${baseUrl}${endpoint.url}`, endpoint.data || {});
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
    
    console.log('\n所有 API 端点测试完成！');
    
  } catch (error) {
    console.error('测试 API 失败:', error.message);
    console.error('错误详情:', error);
  }
}

testApiStatus();