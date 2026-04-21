import requests
import time

# 登录获取令牌
def get_token():
    login_url = 'http://localhost:3013/api/auth/login'
    data = {
        'username': 'cuiding',
        'password': '66668888'
    }
    response = requests.post(login_url, json=data)
    if response.status_code == 200:
        return response.json().get('data', {}).get('token')
    return None

# 测试API响应速度
def test_api_speed(token, range_value):
    url = f'http://localhost:3013/api/admin/dashboard/team-leader?range={range_value}'
    headers = {
        'Authorization': f'Bearer {token}'
    }
    start_time = time.time()
    response = requests.get(url, headers=headers)
    end_time = time.time()
    response_time = (end_time - start_time) * 1000  # 转换为毫秒
    return response_time, response.status_code

# 主函数
def main():
    print('=== 获取认证令牌 ===')
    token = get_token()
    if not token:
        print('获取令牌失败')
        return
    print(f'获取到令牌: {token[:20]}...')
    
    print('\n=== 测试团队长API响应速度 ===')
    ranges = ['today', 'yesterday', 'week', 'month']
    for range_value in ranges:
        response_time, status_code = test_api_speed(token, range_value)
        print(f'\n团队长 cuiding {range_value} 数据:')
        print(f'响应时间: {response_time:.2f} ms')
        print(f'状态码: {status_code}')

if __name__ == '__main__':
    main()
