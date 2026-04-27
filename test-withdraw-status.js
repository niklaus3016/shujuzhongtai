// 测试提现开关状态接口
const testWithdrawStatus = async () => {
  try {
    const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/settings/withdraw-status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    const text = await response.text();
    console.log('Response text:', text);
    
    try {
      const result = JSON.parse(text);
      console.log('Response JSON:', result);
      console.log('Enabled value:', result?.enabled);
      console.log('Enabled type:', typeof result?.enabled);
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }
  } catch (error) {
    console.error('Error fetching withdraw status:', error);
  }
};

testWithdrawStatus();