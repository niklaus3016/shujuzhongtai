import fetch from 'node-fetch';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImN1aWRpbmciLCJyb2xlIjoiTk9STUFMX0FETUlOIiwiaWF0IjoxNzczODMxODIxLCJleHAiOjE3NzM5MTgyMjF9.42TNkhEngTarh-Ited2QKCvujvW5USZ9jBECWnuEB58';
const teamName = '鼎盛战队';
const timeRange = 'today';

async function testTeamLeaderCommission() {
  try {
    console.log('开始测试团队组长提成计算');
    console.log('团队名称:', teamName);
    console.log('时间范围:', timeRange);
    
    // 1. 获取团队列表
    console.log('\n1. 获取团队列表');
    const teamsResponse = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/team/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const teamsData = await teamsResponse.json();
    console.log('团队列表API返回:', teamsData);
    
    // 2. 找到对应的团队
    console.log('\n2. 找到对应的团队');
    const team = teamsData.data.find(t => t.leader === teamName);
    console.log('找到的团队:', team);
    
    if (!team) {
      console.error('找不到团队:', teamName);
      return;
    }
    
    // 3. 获取团队的组列表
    console.log('\n3. 获取团队的组列表');
    const groupsResponse = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/group/list?teamId=${team.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const groupsData = await groupsResponse.json();
    console.log('组列表API返回:', groupsData);
    
    const groups = groupsData.data || [];
    console.log('团队下的组:', groups.map(g => g.name));
    
    // 4. 遍历所有组，获取组长提成
    console.log('\n4. 遍历所有组，获取组长提成');
    let totalCommission = 0;
    
    for (const group of groups) {
      if (group.id) {
        console.log(`\n请求组 ${group.name} 的提成数据`);
        const commissionResponse = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/admin/group-leader-commission/${group.id}?range=${timeRange}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const commissionData = await commissionResponse.json();
        console.log(`组 ${group.name} API返回数据:`, commissionData);
        
        if (commissionData.success && commissionData.data && commissionData.data.totalCommission) {
          const commission = commissionData.data.totalCommission;
          totalCommission += commission;
          console.log(`组 ${group.name}: 组长提成=${commission}`);
        } else {
          console.log(`组 ${group.name}: 没有totalCommission字段`);
        }
      }
    }
    
    // 5. 输出结果
    console.log('\n5. 输出结果');
    console.log(`团队 ${teamName} 今日的所有组长提成总金额:`, totalCommission);
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

testTeamLeaderCommission();
