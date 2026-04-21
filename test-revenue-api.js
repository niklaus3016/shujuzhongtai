import axios from 'axios';

async function testApi() {
  try {
    console.log('=== 登录获取token ===');
    const loginResponse = await axios.post('http://localhost:3003/api/admin/login', {
      username: 'cuiding',
      password: '66668888'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const token = loginResponse.data.token;
    console.log('Token:', token);
    
    if (!token) {
      console.log('登录失败，无法获取token');
      return;
    }
    
    console.log('\n=== 测试团队长收益数据接口 ===');
    const startTime = Date.now();
    const revenueResponse = await axios.get('http://localhost:3003/api/admin/dashboard/team-leader/revenue', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log('响应时间:', responseTime, 'ms');
    console.log('返回值:');
    console.log(JSON.stringify(revenueResponse.data, null, 2));
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('错误响应:', error.response.data);
    }
  }
}

testApi();