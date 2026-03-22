import axios from 'axios';

// 测试团队列表接口
async function testTeamList() {
  try {
    console.log('测试团队列表接口...');
    
    // 获取团队列表
    const teamsResponse = await axios.get('https://wfqmaepvjkdd.sealoshzh.site/api/team/list');
    console.log('团队列表API响应:', teamsResponse.data);
    console.log('团队数量:', teamsResponse.data.length);
    
    // 查看团队数据结构
    if (teamsResponse.data.length > 0) {
      console.log('第一个团队的字段:', Object.keys(teamsResponse.data[0]));
      console.log('第一个团队的详细信息:', teamsResponse.data[0]);
    }
    
  } catch (error) {
    console.error('测试团队列表接口失败:', error.message);
  }
}

testTeamList();