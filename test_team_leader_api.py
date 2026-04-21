import requests
import json

# 测试账号信息
username = "cuiding"
password = "66668888"

# 登录获取token
def get_token():
    login_url = "http://localhost:3000/api/auth/login"
    data = {
        "username": username,
        "password": password
    }
    response = requests.post(login_url, json=data)
    if response.status_code == 200:
        return response.json().get("token")
    else:
        print(f"登录失败: {response.status_code}")
        print(response.text)
        return None

# 测试团队长API
def test_team_leader_api(token):
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 测试不同时间范围的API
    time_ranges = ["today", "yesterday", "week", "month"]
    
    for time_range in time_ranges:
        print(f"\n=== 测试时间范围: {time_range} ===")
        url = f"http://localhost:3000/admin/dashboard/team-leader?range={time_range}"
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("API返回值:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 提取关键字段
            print("\n关键字段:")
            print(f"团队用户收益: {data.get('kpi', {}).get('coins', 0) / 1000} 元")
            print(f"团队组长收益: {data.get('teamLeaderRevenue', 0)} 元")
            print(f"广告总曝光: {data.get('kpi', {}).get('impressions', 0)}")
            print(f"活跃用户数: {data.get('kpi', {}).get('activeUsers', 0)}")
        else:
            print(f"请求失败: {response.status_code}")
            print(response.text)

# 测试组长列表API
def test_group_leaders_api(token, team_id):
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    url = f"http://localhost:3000/admin/employee/group-leaders?teamId={team_id}&includeStats=true"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("\n=== 测试组长列表API ===")
        print("API返回值:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # 提取关键字段
        print("\n关键字段:")
        print(f"团队统计: {data.get('teamStats', {})}")
    else:
        print(f"请求失败: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    token = get_token()
    if token:
        test_team_leader_api(token)
        # 假设team_id为1，根据实际情况调整
        test_group_leaders_api(token, "1")
