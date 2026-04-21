// 测试团队长API
// 后端返回完整KPI数据的API结构设计

// API路径: GET /admin/dashboard/team-leader-full?range={range}
// 响应格式:
const response = {
  "code": 200,
  "data": {
    "kpi": {
      "teamLeaderRevenue": 42.17, // 团队组长收益
      "teamShare": 84.34, // 团队提成收益
      "userShare": 632.55, // 团队用户收益
      "activeUsers": 30, // 活跃用户数
      "totalUsers": 150, // 总用户数
      "impressions": 125000, // 广告总曝光
      "averageCoins": 5.06, // 单条平均金币
      "teamLeaderRevenuePercentage": 6.67, // 团队组长收益占比
      "teamSharePercentage": 13.33, // 团队提成收益占比
      "coinsGrowth": 12.5, // 收益增长率
      "impressionsGrowth": 8.3, // 曝光增长率
      "ecpmGrowth": 5.2 // 平均金币增长率
    }
  },
  "message": "success"
};

console.log('后端API响应结构:', response);
