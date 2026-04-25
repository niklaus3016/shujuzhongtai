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
        result = response.json()
        print("登录成功!")
        print("用户信息:", json.dumps(result, indent=2, ensure_ascii=False))
        return result.get("token"), result.get("user", {}).get("id")
    else:
        print(f"登录失败: {response.status_code}")
        print(response.text)
        return None, None

# 测试新的团队长组API
def test_team_leader_groups_api(token, team_id):
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 测试不同时间范围的API
    time_ranges = ["today", "month"]
    
    for time_range in time_ranges:
        print(f"\n{'='*60}")
        print(f"=== 测试时间范围: {time_range} ===")
        print(f"{'='*60}")
        
        url = f"http://localhost:3000/api/admin/employee/team-leader/groups?teamId={team_id}&range={time_range}"
        print(f"请求URL: {url}")
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("\nAPI返回值:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 查看返回的数组
            if isinstance(data, dict) and 'data' in data:
                groups_array = data['data']
            else:
                groups_array = data if isinstance(data, list) else []
            
            if groups_array and len(groups_array) > 0:
                print(f"\n{'='*60}")
                print("=== 第一个组的完整字段 ===")
                print(f"{'='*60}")
                print(json.dumps(groups_array[0], indent=2, ensure_ascii=False))
                print(f"\n所有字段名: {list(groups_array[0].keys())}")
                
                # 检查增长率字段
                print(f"\n增长率字段:")
                print(f"  growthRate: {groups_array[0].get('growthRate', '不存在')}")
                print(f"  growth_rate: {groups_array[0].get('growth_rate', '不存在')}")
                print(f"  growth: {groups_array[0].get('growth', '不存在')}")
                print(f"  rate: {groups_array[0].get('rate', '不存在')}")
            else:
                print("\n没有返回组数据")
        else:
            print(f"\n请求失败: {response.status_code}")
            print(response.text)

if __name__ == "__main__":
    token, user_id = get_token()
    if token and user_id:
        test_team_leader_groups_api(token, user_id)
