import axios from 'axios';

// 测试脚本：测试组长用户实时表现接口
async function testGroupLeaderUsers() {
  try {
    console.log('=== 测试组长用户实时表现接口 ===');
    
    // 1. 登录获取token
    console.log('1. 正在登录...');
    const loginResponse = await axios.post('http://localhost:3009/api/auth/login', {
      username: 'fanjie',
      password: '11112222'
    });
    
    const token = loginResponse.data.token;
    console.log('登录成功，获取到token');
    
    // 2. 获取用户信息
    console.log('2. 获取用户信息...');
    const userResponse = await axios.get('http://localhost:3009/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const currentUser = userResponse.data;
    console.log('用户信息:', currentUser);
    
    // 3. 调用用户实时表现接口
    console.log('3. 调用用户实时表现接口...');
    const usersResponse = await axios.get('http://localhost:3009/api/admin/dashboard/users?range=today', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const users = usersResponse.data;
    console.log('\n=== 测试结果 ===');
    console.log('返回的员工数量:', Array.isArray(users) ? users.length : (users.data ? users.data.length : 0));
    
    if (Array.isArray(users)) {
      console.log('\n员工列表:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.employeeId || user.userId}) - 组: ${user.groupName || user.teamGroupId || '无'}`);
      });
    } else if (users.data && Array.isArray(users.data)) {
      console.log('\n员工列表:');
      users.data.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.employeeId || user.userId}) - 组: ${user.groupName || user.teamGroupId || '无'}`);
      });
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
testGroupLeaderUsers();
