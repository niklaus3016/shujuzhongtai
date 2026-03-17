import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Coins, Eye, Zap, Users, BarChart3, 
  TrendingUp, TrendingDown, Clock
} from 'lucide-react';
import { authService } from '../services/authService';
import { UserRole } from '../types';

interface TeamLeaderDashboardProps {
  timeRange: string;
  onRefresh: () => void;
}

type TimeRange = 'today' | 'yesterday' | 'this_week' | 'this_month';

const TeamLeaderDashboard: React.FC<TeamLeaderDashboardProps> = ({ timeRange, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any[]>([]);
  
  // 使用 useMemo 缓存 currentUser，避免每次渲染都返回新对象
  const currentUser = useMemo(() => authService.getCurrentUser(), []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      console.log('开始获取团队数据:', { currentUser, timeRange });
      
      if (!currentUser) {
        throw new Error('用户未登录');
      }
      
      // 即使没有 teamName 也继续获取数据
      // if (!currentUser?.teamName) {
      //   throw new Error('团队名称不存在');
      // }

      // 直接使用完整的 API 路径，包含 /admin 前缀
      const token = localStorage.getItem('admin_token');
      console.log('Token:', token ? '存在' : '不存在');
      
      // 直接使用用户选择的时间范围
      const formattedTimeRange = timeRange;
      console.log('格式化后的时间范围:', formattedTimeRange);
      
      // 使用正确的 API 路径 - KPI 接口
      const teamName = currentUser?.teamName || '鼎盛战队';
      const apiUrl = `https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/kpi?range=${formattedTimeRange}&team=${encodeURIComponent(teamName)}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // 即使 result.success 为 false，也尝试获取数据
      // if (!result.success) {
      //   throw new Error(result.message || '请求失败');
      // }

      const responseData = result.data || result;
      console.log('处理后的数据:', responseData);
      console.log('增长率数据:', {
        coinsGrowth: responseData?.coinsGrowth,
        impressionsGrowth: responseData?.impressionsGrowth,
        ecpmGrowth: responseData?.ecpmGrowth,
        activeUsers: responseData?.activeUsers
      });

      // 时间前缀
      const timePrefixMap: Record<string, string> = {
        today: '今日',
        yesterday: '昨日',
        week: '本周',
        month: '本月',
        this_week: '本周',
        this_month: '本月'
      };
      const timePrefix = timePrefixMap[timeRange];
      // 只在今日显示增长率，其他时间范围不显示
      const showGrowth = timeRange === 'today';
      console.log('时间范围:', timeRange, '显示增长率:', showGrowth);

      // 计算团队分成（用户分成的20%）
      const userShare = Number(responseData?.coins || 0) / 1000;
      const teamShare = userShare * 0.2;
      
      // 计算单条平均金币 = (团队用户收益 * 1000) / 广告总曝光
      const averageCoins = responseData?.impressions > 0 ? (userShare * 1000) / Number(responseData?.impressions) : 0;
      console.log('单条平均金币:', averageCoins);

      // 获取用户列表来计算团队组长收益和活跃用户数
      let teamLeaderEarnings = 0;
      let activeUsersCount = 0;
      let totalUsersCount = 0;
      try {
        const userUrl = `/dashboard/users?range=${formattedTimeRange}&team=${encodeURIComponent(teamName)}`;
        const userResponse = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/admin${userUrl}`, {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
        });
        
        if (userResponse.ok) {
          const userResult = await userResponse.json();
          const users = userResult.data || userResult || [];
          
          console.log('团队名称:', teamName);
          console.log('请求的URL:', userUrl);
          console.log('用户列表总数:', users.length);
          console.log('用户列表:', users);
          
          // 团队长只计算自己团队的用户
          const filteredUsers = users.filter((user: any) => {
            const userTeam = user.teamName || user.superior || '系统直属';
            return userTeam === teamName;
          });
          totalUsersCount = users.length;
          console.log('过滤后用户数:', filteredUsers.length);
          console.log('团队总用户数:', totalUsersCount);
          
          // 从后端获取组长提成比例，如果没有则使用默认值
          const leaderCommissionRate = responseData?.leaderCommissionRate || responseData?.groupLeaderRate || 0.05;
          console.log('组长提成比例:', leaderCommissionRate);
          
          // 计算活跃用户数：有收益或观看次数的用户（只计算本团队的用户）
          activeUsersCount = filteredUsers.filter((user: any) => (user.watched > 0 || user.earnings > 0)).length;
          console.log('活跃用户数:', activeUsersCount);
          console.log('活跃用户详情:', filteredUsers.filter((user: any) => (user.watched > 0 || user.earnings > 0)).map((u: any) => ({ id: u.userId || u.employeeId, watched: u.watched, earnings: u.earnings })));
          
          // 计算团队组长收益：每个用户如果有组长（有组别），则该用户收益的提成比例归组长（只计算本团队的用户）
          teamLeaderEarnings = filteredUsers.reduce((total: number, user: any) => {
            const userEarnings = (user.earnings || 0) / 1000;
            // 如果用户有组长（teamGroupId不为空），则计算组长收益
            const hasLeader = user.teamGroupId && user.teamGroupId !== '' && user.teamGroupId !== '无';
            const leaderEarnings = hasLeader ? userEarnings * leaderCommissionRate : 0;
            if (hasLeader) {
              console.log(`用户 ${user.userId || user.employeeId}: 收益=${userEarnings}, 组别=${user.teamGroupId}, 组长收益=${leaderEarnings}`);
            }
            return total + leaderEarnings;
          }, 0);
          
          console.log('团队组长收益总计:', teamLeaderEarnings);
        }
      } catch (error) {
        console.error('获取用户列表失败:', error);
      }

      // 转换KPI数据为前端格式
      const transformedKpis = [
        {
          title: '团队提成收益',
          value: `¥${teamShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          subValue: userShare > 0 ? `${((teamShare / userShare) * 100).toFixed(2)}%` : '0%',
          growth: showGrowth ? `${responseData?.coinsGrowth > 0 ? '+' : ''}${responseData?.coinsGrowth || 0}%` : '',
          isUp: responseData?.coinsGrowth > 0,
          icon: Users,
          color: 'text-purple-600',
          bg: 'bg-purple-50'
        },
        {
          title: '团队用户收益',
          value: `¥${userShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          growth: showGrowth ? `${responseData?.coinsGrowth > 0 ? '+' : ''}${responseData?.coinsGrowth || 0}%` : '',
          isUp: responseData?.coinsGrowth > 0,
          icon: Coins,
          color: 'text-orange-600',
          bg: 'bg-orange-50'
        },
        {
          title: '团队组长收益',
          value: `¥${teamLeaderEarnings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          subValue: userShare > 0 ? `${((teamLeaderEarnings / userShare) * 100).toFixed(2)}%` : '0%',
          growth: showGrowth ? `${responseData?.coinsGrowth > 0 ? '+' : ''}${responseData?.coinsGrowth || 0}%` : '',
          isUp: responseData?.coinsGrowth > 0,
          icon: BarChart3,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50'
        },
        {
          title: '今日活跃用户',
          value: activeUsersCount.toLocaleString(),
          subValue: `(${totalUsersCount})`,
          growth: showGrowth ? `${responseData?.activeUsersGrowth > 0 ? '+' : ''}${responseData?.activeUsersGrowth || 0}%` : '',
          isUp: responseData?.activeUsersGrowth > 0,
          icon: TrendingUp,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50'
        },
        {
          title: '广告总曝光',
          value: responseData?.impressions?.toLocaleString() || '0',
          growth: showGrowth ? `${responseData?.impressionsGrowth > 0 ? '+' : ''}${responseData?.impressionsGrowth || 0}%` : '',
          isUp: responseData?.impressionsGrowth > 0,
          icon: Eye,
          color: 'text-blue-600',
          bg: 'bg-blue-50'
        },
        {
          title: '单条平均金币',
          value: `${averageCoins.toFixed(2)}`,
          growth: showGrowth ? `${responseData?.ecpmGrowth > 0 ? '+' : ''}${responseData?.ecpmGrowth || 0}%` : '',
          isUp: responseData?.ecpmGrowth > 0,
          icon: Zap,
          color: 'text-yellow-600',
          bg: 'bg-yellow-50'
        }
      ];

      console.log('转换后的KPI数据:', transformedKpis);
      console.log('activeUsersCount:', activeUsersCount);
      console.log('totalUsersCount:', totalUsersCount);
      setKpiData(transformedKpis);
    } catch (error) {
      console.error('获取数据失败:', error);
      // 保持数据为空，不显示模拟数据
      setKpiData([]);
    } finally {
      setLoading(false);
    }
  }, [timeRange, currentUser]); // 移除 onRefresh 依赖

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 移除这个 useEffect，避免无限循环

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md mb-6">
      {/* KPI数据卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {loading ? (
          // 加载状态
          Array(6).fill(0).map((_, idx) => (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-xl bg-gray-100 shadow-sm">
                  <Clock size={20} className="text-gray-400" />
                </div>
                <div className="w-12 h-4 bg-gray-100 rounded-full"></div>
              </div>
              <div className="w-24 h-3 bg-gray-100 rounded-full mb-2"></div>
              <div className="w-16 h-5 bg-gray-100 rounded-full"></div>
            </div>
          ))
        ) : kpiData.length > 0 ? (
          kpiData.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2.5 rounded-xl ${kpi.bg} shadow-sm`}>
                    <Icon size={20} className={kpi.color} />
                  </div>
                  {kpi.growth && (
                    <div className={`text-[9px] font-bold flex items-center ${kpi.isUp ? 'text-[#10B981]' : 'text-[#EF4444]'} bg-opacity-10 px-2 py-0.5 rounded-full`}>
                      {kpi.isUp ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />}
                      {kpi.growth}
                    </div>
                  )}
                </div>
                <div className="text-gray-500 text-[10px] font-medium mb-1 uppercase tracking-wider">{kpi.title}</div>
                <div className="text-lg font-bold leading-none text-gray-900">
                  {kpi.value}
                  {kpi.subValue && (
                    <span className="ml-1.5 text-[10px] font-bold text-gray-600">
                      ({kpi.subValue})
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          // 空状态
          <div className="col-span-2 p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            <div className="text-sm mb-2">暂无数据</div>
            <div className="text-[10px]">请稍后刷新或检查网络连接</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamLeaderDashboard;