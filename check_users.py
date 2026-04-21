import requests
import json

# 读取token
with open('/tmp/token.txt', 'r') as f:
    token = f.read().strip()

# API URL
url = 'https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/users?range=today&team=团队&limit=30'

# 请求头
headers = {
    'Authorization': f'Bearer {token}'
}

# 发送请求
response = requests.get(url, headers=headers)

# 解析响应
if response.status_code == 200:
    data = response.json()
    if isinstance(data, list):
        print(f'返回用户数量: {len(data)}')
        # 打印前几个用户的信息
        for i, user in enumerate(data[:5]):
            print(f'用户{i+1}: {user.get("name", "无姓名")}, 次数: {user.get("watched", 0)}, 收益: {user.get("earnings", 0)}')
    else:
        print('响应不是列表格式')
        print('响应内容:', data)
else:
    print(f'请求失败，状态码: {response.status_code}')
    print('响应内容:', response.text)
