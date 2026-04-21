// 测试团队相关API的响应速度
import fetch from 'node-fetch';

const config = {
  apiBase: 'https://wfqmaepvjkdd.sealoshzh.site', // 后端API地址
  adminCredentials: {
    username: 'cuiding', // 团队长账号
    password: '123456' // 密码
  },
  timeRanges: ['today', 'yesterday', 'week', 'month']
};

// 登录获取token
async function login() {
  console.log('=== 开始登录 ===');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${config.apiBase}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.adminCredentials)
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const data = await response.json();
    
    console.log(`登录响应时间: ${responseTime}ms`);
    console.log(`登录状态码: ${response.status}`);
    
    if (data.success) {
      console.log('登录成功');
      return data.token;
    } else {
      console.error('登录失败:', data.message);
      return null;
    }
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    console.log(`登录响应时间: ${responseTime}ms`);
    console.error('登录请求失败:', error);
    return null;
  }
}

// 测试API响应时间
async function testApiSpeed(token) {
  console.log('\n=== 测试团队相关API响应速度 ===');
  
  // 测试团队列表API
  console.log('\n=== 测试团队列表API ===');
  const teamListStartTime = Date.now();
  try {
    const response = await fetch(`${config.apiBase}/api/admin/dashboard/team-leader/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const teamListEndTime = Date.now();
    const teamListResponseTime = teamListEndTime - teamListStartTime;
    
    const teamListData = await response.json();
    
    console.log(`团队列表API响应时间: ${teamListResponseTime}ms`);
    console.log(`状态码: ${response.status}`);
    console.log(`团队数量: ${Array.isArray(teamListData) ? teamListData.length : (teamListData?.data ? teamListData.data.length : 0)}`);
    
    // 如果有团队，测试第一个团队的成员列表
    if (teamListData && (Array.isArray(teamListData) || teamListData.data)) {
      const teams = Array.isArray(teamListData) ? teamListData : teamListData.data;
      if (teams.length > 0) {
        const firstTeam = teams[0];
        console.log(`\n=== 测试第一个团队(${firstTeam.leader})的成员列表API ===`);
        
        // 测试今日成员数据
        const memberListStartTime = Date.now();
        try {
          const memberResponse = await fetch(`${config.apiBase}/api/admin/dashboard/team-leader/teams/${firstTeam.id}/members?mode=today`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const memberListEndTime = Date.now();
          const memberListResponseTime = memberListEndTime - memberListStartTime;
          
          const memberListData = await response.json();
          
          console.log(`团队成员列表API响应时间: ${memberListResponseTime}ms`);
          console.log(`状态码: ${memberResponse.status}`);
          console.log(`成员数量: ${Array.isArray(memberListData) ? memberListData.length : (memberListData?.data ? memberListData.data.length : 0)}`);
        } catch (error) {
          const memberListEndTime = Date.now();
          const memberListResponseTime = memberListEndTime - memberListStartTime;
          console.log(`团队成员列表API响应时间: ${memberListResponseTime}ms`);
          console.error('团队成员列表API请求失败:', error);
        }
      }
    }
  } catch (error) {
    const teamListEndTime = Date.now();
    const teamListResponseTime = teamListEndTime - teamListStartTime;
    console.log(`团队列表API响应时间: ${teamListResponseTime}ms`);
    console.error('团队列表API请求失败:', error);
  }
  
  // 测试团队长KPI数据API（作为参考）
  console.log('\n=== 测试团队长KPI数据API ===');
  for (const range of config.timeRanges) {
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
      
      const data = await response.json();
      
      console.log(`\n=== 团队长KPI数据API (${range}) ===`);
      console.log(`响应时间: ${responseTime}ms`);
      console.log(`状态码: ${response.status}`);
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`\n=== 团队长KPI数据API (${range}) ===`);
      console.log(`响应时间: ${responseTime}ms`);
      console.error('API请求失败:', error);
    }
  }
}

// 主函数
async function main() {
  try {
    const token = await login();
    if (token) {
      await testApiSpeed(token);
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
main();
