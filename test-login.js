import axios from 'axios';

// 测试超级管理员登录
async function testSuperAdminLogin() {
  try {
    console.log('开始测试超级管理员登录...');
    
    // 基础 API 地址
    const baseUrl = 'https://wfqmaepvjkdd.sealoshzh.site/api';
    
    // 超级管理员账号密码
    const username = 'admin';
    const password = 'admin123';
    
    // 测试登录
    console.log(`测试登录: ${username} / ${password}`);
    
    try {
      const response = await axios.post(`${baseUrl}/admin/login`, {
        username,
        password
      });
      
      console.log(`✓ 登录成功 - 状态码: ${response.status}`);
      console.log(`  响应数据: ${JSON.stringify(response.data)}`);
      
      if (response.data.data && response.data.data.token) {
        console.log(`  认证令牌: ${response.data.data.token}`);
        
        // 使用获取到的令牌测试其他需要认证的接口
        const token = response.data.data.token;
        const authenticatedApi = axios.create({
          baseURL: baseUrl,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // 测试仪表盘接口
        console.log('\n测试仪表盘接口...');
        try {
          const dashboardResponse = await authenticatedApi.get('/admin/dashboard/users', {
            params: { range: 'today', limit: 1000 }
          });
          console.log(`✓ 仪表盘接口成功 - 状态码: ${dashboardResponse.status}`);
          console.log(`  响应数据类型: ${typeof dashboardResponse.data}`);
          if (dashboardResponse.data && typeof dashboardResponse.data === 'object') {
            if (Array.isArray(dashboardResponse.data)) {
              console.log(`  响应数据长度: ${dashboardResponse.data.length}`);
            } else {
              console.log(`  响应数据键: ${Object.keys(dashboardResponse.data).join(', ')}`);
            }
          }
        } catch (error) {
          console.log(`✗ 仪表盘接口失败`);
          if (error.response) {
            console.log(`  状态码: ${error.response.status}`);
            console.log(`  错误数据: ${JSON.stringify(error.response.data)}`);
          } else {
            console.log(`  错误: ${error.message}`);
          }
        }
        
        // 测试员工列表接口
        console.log('\n测试员工列表接口...');
        try {
          const employeeResponse = await authenticatedApi.get('/admin/employee/list', {
            params: { pageSize: 1000 }
          });
          console.log(`✓ 员工列表接口成功 - 状态码: ${employeeResponse.status}`);
          console.log(`  响应数据类型: ${typeof employeeResponse.data}`);
          if (employeeResponse.data && typeof employeeResponse.data === 'object') {
            if (Array.isArray(employeeResponse.data)) {
              console.log(`  响应数据长度: ${employeeResponse.data.length}`);
            } else {
              console.log(`  响应数据键: ${Object.keys(employeeResponse.data).join(', ')}`);
            }
          }
        } catch (error) {
          console.log(`✗ 员工列表接口失败`);
          if (error.response) {
            console.log(`  状态码: ${error.response.status}`);
            console.log(`  错误数据: ${JSON.stringify(error.response.data)}`);
          } else {
            console.log(`  错误: ${error.message}`);
          }
        }
        
      } else {
        console.log('✗ 登录成功但未返回令牌');
      }
      
    } catch (error) {
      console.log(`✗ 登录失败`);
      if (error.response) {
        console.log(`  状态码: ${error.response.status}`);
        console.log(`  错误数据: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.log(`  请求发送失败: ${error.message}`);
      } else {
        console.log(`  错误: ${error.message}`);
      }
    }
    
    console.log('\n登录测试完成！');
    
  } catch (error) {
    console.error('测试登录失败:', error.message);
    console.error('错误详情:', error);
  }
}

testSuperAdminLogin();