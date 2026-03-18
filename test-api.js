

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImN1aWRpbmciLCJyb2xlIjoiTk9STUFMX0FETUlOIiwiaWF0IjoxNzczODMxODIxLCJleHAiOjE3NzM5MTgyMjF9.42TNkhEngTarh-Ited2QKCvujvW5USZ9jBECWnuEB58';
const teamName = '鼎盛战队';
const timeRange = 'today';

async function testAPI() {
  try {
    console.log('开始测试API请求');
    console.log('使用的token:', token);
    
    // 测试KPI API
    console.log('\n1. 测试KPI API');
    const kpiUrl = `https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/kpi?range=${timeRange}&team=${encodeURIComponent(teamName)}`;
    const kpiResponse = await fetch(kpiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('KPI API响应状态:', kpiResponse.status);
    const kpiData = await kpiResponse.json();
    console.log('KPI API响应数据:', kpiData);
    
    // 测试用户API
    console.log('\n2. 测试用户API');
    const userUrl = `https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/users?range=${timeRange}&team=${encodeURIComponent(teamName)}&limit=30`;
    const userResponse = await fetch(userUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('用户API响应状态:', userResponse.status);
    const userData = await userResponse.json();
    console.log('用户API响应数据:', userData);
    
    // 测试团队列表API
    console.log('\n3. 测试团队列表API');
    const teamsUrl = 'https://wfqmaepvjkdd.sealoshzh.site/api/team/list';
    const teamsResponse = await fetch(teamsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('团队列表API响应状态:', teamsResponse.status);
    const teamsData = await teamsResponse.json();
    console.log('团队列表API响应数据:', teamsData);
    
    // 测试组列表API
    if (teamsData.data && teamsData.data.length > 0) {
      const team = teamsData.data.find(t => t.leader === teamName);
      if (team) {
        console.log('\n4. 测试组列表API');
        const groupsUrl = `https://wfqmaepvjkdd.sealoshzh.site/api/group/list?teamId=${team.id}`;
        const groupsResponse = await fetch(groupsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('组列表API响应状态:', groupsResponse.status);
        const groupsData = await groupsResponse.json();
        console.log('组列表API响应数据:', groupsData);
        
        // 测试组长提成API
        if (groupsData.data && groupsData.data.length > 0) {
          const group = groupsData.data[0];
          console.log('\n5. 测试组长提成API');
          const commissionUrl = `https://wfqmaepvjkdd.sealoshzh.site/api/admin/group-leader-commission/${group.id}?range=${timeRange}`;
          const commissionResponse = await fetch(commissionUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          console.log('组长提成API响应状态:', commissionResponse.status);
          const commissionData = await commissionResponse.json();
          console.log('组长提成API响应数据:', commissionData);
        }
      }
    }
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

testAPI();
