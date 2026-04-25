import axios from 'axios';

// 测试脚本：测试组长界面三个接口的响应速度
async function testApiResponseTime() {
  try {
    console.log('=== 测试组长界面接口响应速度 ===');
    
    // 使用前端开发服务器地址，通过代理访问后端API
    const baseURL = 'http://localhost:3011';
    
    // 首先登录获取token
    console.log('1. 正在登录...');
    const loginStartTime = Date.now();
    const loginResponse = await axios.post(`${baseURL}/api/admin/login`, {
      username: 'fanjie',
      password: '11112222'
    });
    const loginEndTime = Date.now();
    
    const token = loginResponse.data.data.token;
    console.log(`登录成功，获取到token，响应时间: ${loginEndTime - loginStartTime}ms`);
    
    // 创建带认证的axios实例
    const api = axios.create({
      baseURL: baseURL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('使用前端开发服务器地址:', baseURL);
    
    // 3. 测试组长统计数据接口
    console.log('\n3. 测试组长统计数据接口...');
    const timeRanges = ['today', 'yesterday', 'week', 'month'];
    for (const timeRange of timeRanges) {
      const statsStartTime = Date.now();
      try {
        await api.get(`/group-leader/stats?range=${timeRange}`);
        const statsEndTime = Date.now();
        console.log(`${timeRange} - 响应时间: ${statsEndTime - statsStartTime}ms`);
      } catch (error) {
        console.log(`${timeRange} - 错误: ${error.message}`);
      }
    }
    
    // 4. 测试用户实时表现接口
    console.log('\n4. 测试用户实时表现接口...');
    for (const timeRange of timeRanges) {
      const usersStartTime = Date.now();
      try {
        await api.get(`/admin/dashboard/users?range=${timeRange}&sortBy=earnings`);
        const usersEndTime = Date.now();
        console.log(`${timeRange} - 响应时间: ${usersEndTime - usersStartTime}ms`);
      } catch (error) {
        console.log(`${timeRange} - 错误: ${error.message}`);
      }
    }
    
    // 5. 测试组长提成统计接口
    console.log('\n5. 测试组长提成统计接口...');
    const commissionStartTime = Date.now();
    try {
      await api.get('/group-leader/commission-stats');
      const commissionEndTime = Date.now();
      console.log(`响应时间: ${commissionEndTime - commissionStartTime}ms`);
    } catch (error) {
      console.log(`错误: ${error.message}`);
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testApiResponseTime();
