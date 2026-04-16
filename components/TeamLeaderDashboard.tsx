import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Coins, Eye, Zap, Users, BarChart3, 
  TrendingUp, TrendingDown, Clock
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
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
  
  // 团队名称映射表
  const teamNameMap: Record<string, string> = {
    'cuiding': '鼎盛战队',
    'cuijie': '花好月圆战队',
    'huangzhenhui': '四季发财战队'
    // 可以根据需要添加更多映射
  };
  
  // 获取用户对应的团队名称
  const getUserTeamName = () => {
    if (currentUser?.teamName) {
      return currentUser.teamName;
    }
    if (currentUser?.username && teamNameMap[currentUser.username]) {
      return teamNameMap[currentUser.username];
    }
    return '团队';
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    let responseData: any = null;
    let showGrowth = false;
    let userShare = 0;
    let averageCoins = 0;
    let teamLeaderEarnings = 0;
    let activeUsersCount = 0;
    let totalUsersCount = 0;

    try {
      if (!currentUser) {
        throw new Error('用户未登录');
      }

      const formattedTimeRange = timeRange === 'this_week' ? 'week' : timeRange === 'this_month' ? 'month' : timeRange;

      try {
        const result = await request<any>('/admin/dashboard/team-leader', {
          method: 'GET'
        });
        responseData = result;
      } catch (error) {
        console.error('获取团队长数据失败:', error);
        responseData = {};
      }

      showGrowth = timeRange === 'today';

      userShare = Number(responseData?.kpi?.coins || 0) / 1000;
      averageCoins = responseData?.kpi?.impressions > 0 ? (userShare * 1000) / Number(responseData?.kpi?.impressions) : 0;
      teamLeaderEarnings = Number(responseData?.totalCommission || 0) / 1000;

      const users = Array.isArray(responseData?.users) ? responseData.users : [];
      activeUsersCount = users.filter((user: any) => (user.watched > 0 || user.earnings > 0)).length;

      const employees = Array.isArray(responseData?.employees) ? responseData.employees : [];
      totalUsersCount = employees.length;

      // 计算团队提成收益 = 用户分成的20% - 团队组长收益
      const teamShare = userShare * 0.2 - teamLeaderEarnings;

      // 转换KPI数据为前端格式
      const transformedKpis = [
        {
          title: '团队提成收益',
          value: `¥${teamShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          subValue: userShare > 0 ? `${((teamShare / userShare) * 100).toFixed(2)}%` : '0%',
          growth: showGrowth ? `${responseData?.kpi?.coinsGrowth > 0 ? '+' : ''}${responseData?.kpi?.coinsGrowth || 0}%` : '',
          isUp: responseData?.kpi?.coinsGrowth > 0,
          icon: Users,
          color: 'text-purple-600',
          bg: 'bg-purple-50'
        },
        {
          title: '团队用户收益',
          value: `¥${userShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          growth: showGrowth ? `${responseData?.kpi?.coinsGrowth > 0 ? '+' : ''}${responseData?.kpi?.coinsGrowth || 0}%` : '',
          isUp: responseData?.kpi?.coinsGrowth > 0,
          icon: Coins,
          color: 'text-orange-600',
          bg: 'bg-orange-50'
        },
        {
            title: '团队组长收益',
            value: `¥${teamLeaderEarnings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
            subValue: userShare > 0 ? `${((teamLeaderEarnings / userShare) * 100).toFixed(2)}%` : '0%',
            icon: BarChart3,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50'
          },
          {
            title: '今日活跃用户',
            value: activeUsersCount.toLocaleString(),
            subValue: totalUsersCount.toString(),
            icon: TrendingUp,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
          },
        {
          title: '广告总曝光',
          value: responseData?.kpi?.impressions?.toLocaleString() || '0',
          growth: showGrowth ? `${responseData?.kpi?.impressionsGrowth > 0 ? '+' : ''}${responseData?.kpi?.impressionsGrowth || 0}%` : '',
          isUp: responseData?.kpi?.impressionsGrowth > 0,
          icon: Eye,
          color: 'text-blue-600',
          bg: 'bg-blue-50'
        },
        {
          title: '单条平均金币',
          value: `${averageCoins.toFixed(2)}`,
          growth: showGrowth ? `${responseData?.kpi?.ecpmGrowth > 0 ? '+' : ''}${responseData?.kpi?.ecpmGrowth || 0}%` : '',
          isUp: responseData?.kpi?.ecpmGrowth > 0,
          icon: Zap,
          color: 'text-yellow-600',
          bg: 'bg-yellow-50'
        }
      ];

      setKpiData(transformedKpis);
    } catch (error) {
      console.error('获取数据失败:', error);
      // 保持数据为空，不显示模拟数据
      setKpiData([]);
    } finally {
      setLoading(false);
    }
  }, [timeRange, currentUser]);

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
