#!/bin/bash

# 登录获取令牌
echo "=== 获取认证令牌 ==="
token_response=$(curl -s -X POST http://localhost:3013/api/auth/login -H "Content-Type: application/json" -d '{"username":"cuiding","password":"66668888"}')

# 提取令牌（使用bash字符串操作）
token=$(echo "$token_response" | grep -o '"token":"[^"]*"' | cut -d '"' -f 4)

if [ -z "$token" ]; then
    echo "获取令牌失败: $token_response"
    exit 1
fi

echo "获取到令牌: ${token:0:20}..."

# 测试API响应速度
echo "\n=== 测试团队长API响应速度 ==="

ranges=("today" "yesterday" "week" "month")

for range_value in "${ranges[@]}"; do
    echo "\n团队长 cuiding $range_value 数据:"
    start_time=$(date +%s.%N)
    response=$(curl -s "http://localhost:3013/api/admin/dashboard/team-leader?range=$range_value" -H "Authorization: Bearer $token")
    end_time=$(date +%s.%N)
    response_time=$(echo "$end_time - $start_time" | bc)
    status_code=$(echo "$response" | grep -o '"success":[a-zA-Z]\+' | cut -d ':' -f 2)
    
    echo "响应时间: $(echo "$response_time * 1000" | bc | awk '{printf "%.2f", $0}') ms"
    echo "成功状态: $status_code"
done
