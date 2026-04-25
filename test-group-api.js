const axios = require('axios');

// 测试更新员工分组的API
async function testUpdateEmployeeGroup() {
  try {
    // 替换为实际的token和员工ID
    const token = 'your_token_here';
    const employeeId = 'employee_id_here';
    const groupId = 'group_id_here';
    const groupName = '洁然如初组';
    
    const response = await axios.put('https://wfqmaepvjkdd.sealoshzh.site/api/admin/employee/' + employeeId, {
      parentId: 'team_leader_id',
      realName: '测试员工',
      phone: '13800138000',
      region: '测试地区',
      employeeId: '12345',
      teamGroupId: groupId,
      groupName: groupName
    }, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API响应:', response.data);
    console.log('是否包含teamGroupId:', 'teamGroupId' in response.data);
    console.log('是否包含groupName:', 'groupName' in response.data);
    console.log('teamGroupId:', response.data.teamGroupId);
    console.log('groupName:', response.data.groupName);
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 测试获取员工列表的API
async function testGetEmployees() {
  try {
    // 替换为实际的token和teamId
    const token = 'your_token_here';
    const teamId = 'team_id_here';
    
    const response = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/admin/employee/employees-simple?teamId=' + teamId, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    console.log('员工列表响应:', response.data);
    if (response.data && response.data.length > 0) {
      console.log('第一个员工的分组信息:', {
        teamGroupId: response.data[0].teamGroupId,
        groupName: response.data[0].groupName
      });
    }
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testUpdateEmployeeGroup();
testGetEmployees();
