// 测试团队长API响应速度
import fetch from 'node-fetch';

// 测试配置
const config = {
  username: 'cuiding',
  password: '66668888',
  apiBase: 'http://localhost:3012',
  timeRanges: ['today', 'yesterday', 'week', 'month']
};

// 登录获取token
async function login() {
  try {
    const response = await fetch(`${config.apiBase}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: config.username,
        password: config.password
      })
    });
    
    const data = await response.json();
    console.log('登录响应:', data);
    if (data.success) {
      console.log('登录成功，获取到token');
      return data.token || data.data?.token;
    } else {
      console.error('登录失败:', data.message);
      return null;
    }
  } catch (error) {
    console.error('登录请求失败:', error);
    return null;
  }
}

// 测试API响应时间
async function testApiSpeed(token) {
  console.log('\n=== 测试团队长API响应速度 ===');
  
  // 只测试today范围，减少输出
  const range = 'today';
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${config.apiBase}/api/admin/dashboard/team-leader?range=${range}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`\n=== 团队长KPI数据API (${range}) ===`);
    console.log(`响应时间: ${responseTime}ms`);
    console.log(`状态码: ${response.status}`);
    console.log(`响应头: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);
    
    const data = await response.json();
    console.log(`响应数据类型: ${typeof data}`);
    console.log(`响应数据结构: ${JSON.stringify(Object.keys(data), null, 2)}`);
    console.log(`响应数据: ${JSON.stringify(data, null, 2)}`);
    
    // 检查kpi数据
    if (data?.data?.kpi) {
      console.log('\n=== KPI数据 (格式1: data.kpi) ===');
      console.log(JSON.stringify(data.data.kpi, null, 2));
    } else if (data?.kpi) {
      console.log('\n=== KPI数据 (格式2: kpi) ===');
      console.log(JSON.stringify(data.kpi, null, 2));
    } else {
      console.log('\n=== KPI数据 (格式3: 直接返回) ===');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    console.log(`\n=== 团队长KPI数据API (${range}) ===`);
    console.log(`响应时间: ${responseTime}ms`);
    console.error('API请求失败:', error);
  }
  
  // 测试用户数据API（用于对比）
  console.log('\n=== 测试用户数据API ===');
  try {
    const startTime = Date.now();
    const response = await fetch(`${config.apiBase}/api/admin/dashboard/users?range=today`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const data = await response.json();
    console.log(`响应时间: ${responseTime}ms`);
    console.log(`状态码: ${response.status}`);
    console.log(`响应数据长度: ${data?.data?.length || 0}`);
  } catch (error) {
    console.error('用户数据API请求失败:', error);
  }
}

// 主函数
async function main() {
  console.log('开始测试API响应速度...');
  const token = await login();
  if (token) {
    await testApiSpeed(token);
  }
  console.log('\n测试完成');
}

main();
