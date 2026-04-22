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

# 获取团队数据
def get_team_data(token):
    url = f"{BASE_URL}/admin/dashboard/team-leader/teams"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(url, headers=headers)
    print(f"\n团队数据响应状态码: {response.status_code}")
    print(f"团队数据响应内容: {response.text}")
    
    if response.status_code == 200:
        result = response.json()
        return result
    else:
        raise Exception(f"获取团队数据失败: {response.text}")

if __name__ == "__main__":
    try:
        # 登录cuiding帐号
        print("=== 登录cuiding帐号 ===")
        token, admin_info = login("cuiding", "66668888")
        print(f"登录成功，token: {token[:20]}...")
        print(f"用户信息: {admin_info}")
        
        # 获取团队数据
        print("\n=== 获取团队数据 ===")
        team_data = get_team_data(token)
        
        # 打印团队数据
        if team_data:
            print("\n团队数据:")
            print(json.dumps(team_data, indent=2, ensure_ascii=False))
            
            # 检查数据结构
            if isinstance(team_data, list):
                print(f"\n团队数量: {len(team_data)}")
                for i, team in enumerate(team_data):
                    print(f"\n团队 {i+1}:")
                    print(f"  团队ID: {team.get('id')}")
                    print(f"  团队名称: {team.get('leader')}")
                    print(f"  成员数量: {team.get('memberCount')}")
                    print(f"  今日收益: {team.get('todayRevenue')}")
                    print(f"  总收益: {team.get('totalRevenue')}")
            else:
                print("\n团队数据不是数组格式")
        
    except Exception as e:
        print(f"测试失败: {e}")
