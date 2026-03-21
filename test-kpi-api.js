import axios from 'axios';

// 测试KPI API的活跃用户数（直接调用，不登录）
async function testKPIActiveUsers() {
  console.log('开始测试KPI API的活跃用户数...');
  
  try {
    // 1. 测试今日KPI数据
    console.log('1. 测试今日KPI数据');
    const todayResponse = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/kpi?range=today', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('今日KPI API响应:', todayResponse.data);
    
    const todayActiveUsers = todayResponse.data.data?.activeUsers || todayResponse.data.activeUsers;
    console.log('今日活跃用户数:', todayActiveUsers);
    
    // 2. 测试昨日KPI数据
    console.log('\n2. 测试昨日KPI数据');
    const yesterdayResponse = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/kpi?range=yesterday', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('昨日KPI API响应:', yesterdayResponse.data);
    
    const yesterdayActiveUsers = yesterdayResponse.data.data?.activeUsers || yesterdayResponse.data.activeUsers;
    console.log('昨日活跃用户数:', yesterdayActiveUsers);
    
    // 3. 测试本周KPI数据
    console.log('\n3. 测试本周KPI数据');
    const weekResponse = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/kpi?range=week', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('本周KPI API响应:', weekResponse.data);
    
    const weekActiveUsers = weekResponse.data.data?.activeUsers || weekResponse.data.activeUsers;
    console.log('本周活跃用户数:', weekActiveUsers);
    
    // 4. 测试本月KPI数据
    console.log('\n4. 测试本月KPI数据');
    const monthResponse = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/kpi?range=month', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('本月KPI API响应:', monthResponse.data);
    
    const monthActiveUsers = monthResponse.data.data?.activeUsers || monthResponse.data.activeUsers;
    console.log('本月活跃用户数:', monthActiveUsers);
    
    // 5. 输出测试结果
    console.log('\n📊 测试结果总结');
    console.log('今日活跃用户数:', todayActiveUsers);
    console.log('昨日活跃用户数:', yesterdayActiveUsers);
    console.log('本周活跃用户数:', weekActiveUsers);
    console.log('本月活跃用户数:', monthActiveUsers);
    
    // 6. 验证前端显示是否正确
    console.log('\n🔍 前端显示验证');
    console.log('当选择"今日"时间范围时，前端应显示:', todayActiveUsers);
    console.log('当选择"昨日"时间范围时，前端应显示:', yesterdayActiveUsers);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testKPIActiveUsers();
