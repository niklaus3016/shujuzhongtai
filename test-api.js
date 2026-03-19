import axios from 'axios';

// 测试API返回值
async function testApi() {
  try {
    console.log('测试API返回值...');
    
    // 1. 获取新人列表
    const newUsersResponse = await axios.get('http://localhost:3001/api/user/new-users?days=15');
    console.log('新人API响应长度:', newUsersResponse.data.length);
    console.log('新人API响应前5个用户:', newUsersResponse.data.slice(0, 5));
    
    // 2. 获取今日详细数据
    const todayDataResponse = await axios.get('http://localhost:3001/api/admin/dashboard/users?range=today&team=鼎盛战队&limit=1000');
    console.log('今日数据API响应长度:', todayDataResponse.data.length);
    console.log('今日数据API响应前5个用户:', todayDataResponse.data.slice(0, 5));
    
    // 3. 查看今日数据中的字段
    if (todayDataResponse.data.length > 0) {
      console.log('今日数据第一个用户的字段:', Object.keys(todayDataResponse.data[0]));
    }
    
    // 4. 构建映射并检查
    const todayDataMap = {};
    todayDataResponse.data.forEach(user => {
      const userId = user.employeeId || user.userId || '';
      if (userId) {
        todayDataMap[userId] = user;
      }
    });
    console.log('今日数据映射长度:', Object.keys(todayDataMap).length);
    
    // 5. 检查具体用户的上线状态
    console.log('检查具体用户的上线状态:');
    newUsersResponse.data.forEach(user => {
      const userId = user.employeeId || user.userId || '';
      const isOnline = !!todayDataMap[userId];
      console.log(`用户 ${userId}: 上线状态=${isOnline}`);
    });
    
  } catch (error) {
    console.error('测试API失败:', error.message);
  }
}

testApi();
