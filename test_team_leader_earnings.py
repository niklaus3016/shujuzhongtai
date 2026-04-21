import requests
import json

# API基础URL
BASE_URL = "https://wfqmaepvjkdd.sealoshzh.site/api"

# 登录函数
def login(username, password):
    url = f"{BASE_URL}/admin/login"
    headers = {
        "Content-Type": "application/json"
    }
    data = {
        "username": username,
        "password": password
    }
    
    response = requests.post(url, headers=headers, data=json.dumps(data))
    print(f"登录响应状态码: {response.status_code}")
    print(f"登录响应内容: {response.text}")
    
    if response.status_code == 200:
        result = response.json()
        return result.get("token"), result.get("admin")
    else:
        raise Exception(f"登录失败: {response.text}")

# 获取团队组长收益数据
def get_team_leader_earnings(token, range_type):
    url = f"{BASE_URL}/admin/dashboard/team-leader"
    params = {
        "range": range_type
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(url, headers=headers, params=params)
    print(f"\n团队组长收益响应状态码: {response.status_code}")
    print(f"团队组长收益响应内容: {response.text}")
    
    if response.status_code == 200:
        result = response.json()
        return result
    else:
        raise Exception(f"获取团队组长收益失败: {response.text}")

if __name__ == "__main__":
    try:
        # 登录cuiding帐号
        print("=== 登录cuiding帐号 ===")
        token, admin_info = login("cuiding", "66668888")
        print(f"登录成功，token: {token[:20]}...")
        print(f"用户信息: {admin_info}")
        
        # 获取今日团队组长收益
        print("\n=== 获取今日团队组长收益 ===")
        earnings_data = get_team_leader_earnings(token, "today")
        
        # 提取并打印团队组长收益
        if earnings_data:
            total_commission = earnings_data.get("totalCommission", 0)
            print(f"\n团队组长收益(今日): {total_commission} 分 = {total_commission / 1000} 元")
            
            # 打印完整数据结构
            print("\n完整数据结构:")
            print(json.dumps(earnings_data, indent=2, ensure_ascii=False))
            
    except Exception as e:
        print(f"测试失败: {e}")
