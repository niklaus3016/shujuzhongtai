#!/bin/bash

# 测试账号信息
username="cuiding"
password="66668888"

# 登录获取token
echo "=== 登录获取token ==="
token=$(curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "'"$username"'", "password": "'"$password"'"}' \
  | grep -o '"token":"[^"]*"' \
  | cut -d '"' -f 4)

echo "Token: $token"

if [ -z "$token" ]; then
  echo "登录失败，无法获取token"
  exit 1
fi

# 测试团队长API
echo "\n=== 测试团队长API ==="
time_ranges=("today" "yesterday" "week" "month")

for time_range in "${time_ranges[@]}"; do
  echo "\n--- 时间范围: $time_range ---
"
  response=$(curl -X GET "http://localhost:3000/admin/dashboard/team-leader?range=$time_range" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json")
  
  echo "API返回值:"
  echo "$response"
  
  echo "\n关键字段:"
  # 提取关键字段
  coins=$(echo "$response" | grep -o '"coins":[0-9]*' | cut -d ':' -f 2)
  if [ -n "$coins" ]; then
    user_share=$(echo "scale=2; $coins / 1000" | bc)
    echo "团队用户收益: $user_share 元"
  else
    echo "团队用户收益: 0 元"
  fi
  
  team_leader_revenue=$(echo "$response" | grep -o '"teamLeaderRevenue":[0-9]*' | cut -d ':' -f 2)
  if [ -n "$team_leader_revenue" ]; then
    echo "团队组长收益: $team_leader_revenue 元"
  else
    echo "团队组长收益: 0 元"
  fi
  
  impressions=$(echo "$response" | grep -o '"impressions":[0-9]*' | cut -d ':' -f 2)
  if [ -n "$impressions" ]; then
    echo "广告总曝光: $impressions"
  else
    echo "广告总曝光: 0"
  fi
  
  active_users=$(echo "$response" | grep -o '"activeUsers":[0-9]*' | cut -d ':' -f 2)
  if [ -n "$active_users" ]; then
    echo "活跃用户数: $active_users"
  else
    echo "活跃用户数: 0"
  fi
done

# 测试组长列表API
echo "\n=== 测试组长列表API ==="
# 假设team_id为1，根据实际情况调整
team_id="1"
response=$(curl -X GET "http://localhost:3000/admin/employee/group-leaders?teamId=$team_id&includeStats=true" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json")

echo "API返回值:"
echo "$response"

echo "\n关键字段:"
# 提取团队统计
team_stats=$(echo "$response" | grep -o '"teamStats":{[^}]*}' | head -1)
if [ -n "$team_stats" ]; then
  echo "团队统计: $team_stats"
else
  echo "团队统计: 无"
fi
