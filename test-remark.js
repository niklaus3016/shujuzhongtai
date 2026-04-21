const fetch = require('node-fetch');

async function testRemark() {
  try {
    // 登录获取 token
    const loginResponse = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: 'admin', password: 'admin123456' })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('Login successful, token obtained');
    
    // 测试获取待处理记录
    const pendingResponse = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/pending?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const pendingData = await pendingResponse.json();
    console.log('Pending records:', pendingData.data.records);
    
    if (pendingData.data.records.length > 0) {
      const recordId = pendingData.data.records[0].id;
      console.log('Testing status update with remark for record:', recordId);
      
      // 测试更新状态并添加拒绝原因
      const updateResponse = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/${recordId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status: 'rejected', 
          remark: '测试拒绝原因' 
        })
      });
      
      const updateData = await updateResponse.json();
      console.log('Status update response:', updateData);
      
      // 测试获取已拒绝记录，看看是否包含 remark
      const rejectedResponse = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/list?status=rejected&page=1&limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const rejectedData = await rejectedResponse.json();
      console.log('Rejected records:', rejectedData.data.records);
      
      // 检查是否包含 remark 字段
      if (rejectedData.data.records.length > 0) {
        const firstRecord = rejectedData.data.records[0];
        console.log('First rejected record:', firstRecord);
        console.log('Has remark:', 'remark' in firstRecord);
        if ('remark' in firstRecord) {
          console.log('Remark value:', firstRecord.remark);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testRemark();
