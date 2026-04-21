const fetch = require('node-fetch');

// API基础URL
const BASE_URL = "https://wfqmaepvjkdd.sealoshzh.site/api";

// 登录函数
async function login(username, password) {
    const url = `${BASE_URL}/admin/login`;
    const headers = {
        "Content-Type": "application/json"
    };
    const data = {
        "username": username,
        "password": password
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        
        console.log(`登录响应状态码: ${response.status}`);
        const responseText = await response.text();
        console.log(`登录响应内容: ${responseText}`);
        
        if (response.ok) {
            const result = JSON.parse(responseText);
            return { token: result.token, admin: result.admin };
        } else {
            throw new Error(`登录失败: ${responseText}`);
        }
    } catch (error) {
        console.error(`登录请求失败: ${error.message}`);
        throw error;
    }
}

// 获取团队组长收益数据
async function getTeamLeaderEarnings(token, rangeType) {
    const url = `${BASE_URL}/admin/dashboard/team-leader`;
    const params = new URLSearchParams({ range: rangeType });
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
    
    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'GET',
            headers: headers
        });
        
        console.log(`\n团队组长收益响应状态码: ${response.status}`);
        const responseText = await response.text();
        console.log(`团队组长收益响应内容: ${responseText}`);
        
        if (response.ok) {
            const result = JSON.parse(responseText);
            return result;
        } else {
            throw new Error(`获取团队组长收益失败: ${responseText}`);
        }
    } catch (error) {
        console.error(`获取团队组长收益请求失败: ${error.message}`);
        throw error;
    }
}

// 主函数
async function main() {
    try {
        // 登录cuiding帐号
        console.log('=== 登录cuiding帐号 ===');
        const loginResult = await login("cuiding", "66668888");
        console.log(`登录成功，token: ${loginResult.token.substring(0, 20)}...`);
        console.log(`用户信息: ${JSON.stringify(loginResult.admin, null, 2)}`);
        
        // 获取今日团队组长收益
        console.log('\n=== 获取今日团队组长收益 ===');
        const earningsData = await getTeamLeaderEarnings(loginResult.token, "today");
        
        // 提取并打印团队组长收益
        if (earningsData) {
            const totalCommission = earningsData.totalCommission || 0;
            console.log(`\n团队组长收益(今日): ${totalCommission} 分 = ${(totalCommission / 1000).toFixed(2)} 元`);
            
            // 打印完整数据结构
            console.log('\n完整数据结构:');
            console.log(JSON.stringify(earningsData, null, 2));
        }
        
    } catch (error) {
        console.error(`测试失败: ${error.message}`);
    }
}

// 运行主函数
main();
