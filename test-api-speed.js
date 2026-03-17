// 测试API响应速度的脚本
const BASE_URL = 'https://wfqmaepvjkdd.sealoshzh.site/api';
const API_ENDPOINTS = [
  '/account/list',
  '/employee/list?pageSize=100',
  '/group/list'
];

async function testApiResponse() {
  console.log('开始测试API响应速度...');
  console.log('====================================');
  
  for (const endpoint of API_ENDPOINTS) {
    const startTime = Date.now();
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`${endpoint}: ${responseTime}ms - 成功`);
        console.log(`  响应数据大小: ${JSON.stringify(data).length} 字节`);
        if (data.data) {
          console.log(`  数据项数量: ${Array.isArray(data.data) ? data.data.length : 'N/A'}`);
        } else if (Array.isArray(data)) {
          console.log(`  数据项数量: ${data.length}`);
        }
      } else {
        console.log(`${endpoint}: ${responseTime}ms - 失败 (${response.status})`);
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`${endpoint}: ${responseTime}ms - 错误: ${error.message}`);
    }
    console.log('------------------------------------');
  }
  
  console.log('测试完成!');
}

testApiResponse();