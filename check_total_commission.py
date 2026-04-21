import json

# 模拟API返回数据（从之前的curl结果中提取）
api_response = '''
{
  "kpi": {
    "coins": 519680,
    "impressions": 5897,
    "activeUsers": 20,
    "coinsGrowth": -69.8,
    "impressionsGrowth": -52.2,
    "ecpmGrowth": -45.2
  },
  "totalCommission": 4217,
  "users": [
    // 用户列表数据
  ],
  "employees": [
    // 员工列表数据
  ]
}
'''

# 解析JSON数据
try:
    data = json.loads(api_response)
    total_commission = data.get('totalCommission', 0)
    print(f"totalCommission: {total_commission}")
    print(f"团队组长收益: {total_commission / 1000} 元")
except json.JSONDecodeError as e:
    print(f"JSON解析错误: {e}")

# 检查TeamLeaderDashboard组件中的数据处理逻辑
print("\n=== TeamLeaderDashboard组件数据处理逻辑 ===")
print("teamLeaderEarnings = Number(responseData?.totalCommission || 0) / 1000")
print("假设totalCommission为4217，计算结果:")
print(f"teamLeaderEarnings = {4217 / 1000} 元")
