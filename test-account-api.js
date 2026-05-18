// 测试账号管理接口
const API_BASE_URL = 'https://wfqmaepvjkdd.sealoshzh.site/api';

async function testAccountAPI() {
  console.log('=== 开始测试账号管理接口 ===\n');
  
  // 1. 登录获取token
  console.log('1. 登录获取token...');
  const loginRes = await fetch(`${API_BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' })
  });
  const loginData = await loginRes.json();
  
  const token = loginData.data?.token || loginData.token;
  if (!token) {
    console.log('登录失败:', loginData);
    return;
  }
  console.log('✓ 登录成功，获取到token\n');
  
  // 2. 调用账号列表接口
  console.log('2. 调用 /admin/account/list 接口...');
  const accountRes = await fetch(`${API_BASE_URL}/admin/account/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  const accountData = await accountRes.json();
  
  if (!accountData.success) {
    console.log('获取账号列表失败:', accountData);
    return;
  }
  
  const accounts = accountData.admins || [];
  console.log(`✓ 获取到 ${accounts.length} 个账号\n`);
  
  // 3. 统计各类账号
  console.log('3. 账号分类统计：');
  console.log('-------------------');
  
  const normalAdmins = accounts.filter(a => a.role === 'NORMAL_ADMIN');
  const groupLeaders = accounts.filter(a => a.role === 'GROUP_LEADER' || a.role === 'group_leader');
  const superAdmins = accounts.filter(a => a.role === 'SUPER_ADMIN');
  
  console.log(`NORMAL_ADMIN (团队长): ${normalAdmins.length} 个`);
  console.log(`GROUP_LEADER (组长): ${groupLeaders.length} 个`);
  console.log(`SUPER_ADMIN (超管): ${superAdmins.length} 个`);
  console.log(`总计: ${accounts.length} 个\n`);
  
  // 4. 列出所有团队长
  console.log('4. 团队长列表：');
  console.log('-------------------');
  normalAdmins.forEach((a, i) => {
    console.log(`${i + 1}. ${a.realName || a.username} - ${a.teamName || '无团队'} (${a._id})`);
  });
  
  console.log('\n=== 测试完成 ===');
  
  return {
    total: accounts.length,
    normalAdmins: normalAdmins.length,
    groupLeaders: groupLeaders.length,
    superAdmins: superAdmins.length,
    accounts: accounts
  };
}

testAccountAPI().then(result => {
  if (result) {
    console.log('\n📊 最终结果：');
    console.log(`团队长数量: ${result.normalAdmins}`);
  }
}).catch(err => {
  console.error('测试出错:', err);
});
