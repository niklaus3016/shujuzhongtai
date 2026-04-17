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
  onDataLoaded?: () => void;
}

type TimeRange = 'today' | 'yesterday' | 'this_week' | 'this_month';

const TeamLeaderDashboard: React.FC<TeamLeaderDashboardProps> = ({ timeRange, onRefresh, onDataLoaded }) => {
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
      
      // 即使没有 teamName 也继续获取数据
      // if (!currentUser?.teamName) {
      //   throw new Error('团队名称不存在');
      // }

      // 处理时间范围 - 将中文时间范围映射到英文
      const timeRangeMap: Record<string, string> = {
        '今日': 'today',
        '昨日': 'yesterday',
        '本周': 'week',
        '本月': 'month'
      };
      const formattedTimeRange = timeRangeMap[timeRange] || 'today';
      console.log('处理后的时间范围:', formattedTimeRange);
      
      // 使用正确的 API 路径 - 团队长KPI接口
      const teamName = getUserTeamName();
      const apiUrl = `/admin/dashboard/team-leader?range=${formattedTimeRange}`;
      
      try {
        const result = await request<any>(apiUrl, {
          method: 'GET'
        });
        // 检查返回的数据结构
        if (result?.kpi) {
          // 格式: { kpi: {...} }
          responseData = result.kpi;
          console.log('使用格式: result.kpi');
        } else {
          // 格式: 直接返回kpi数据
          responseData = result;
          console.log('使用格式: result');
        }
        console.log('KPI API返回数据:', responseData);
      } catch (error) {
        console.error('获取KPI数据失败:', error);
        // 即使KPI数据获取失败，也继续获取其他数据
        responseData = {};
      }

      // 时间前缀
      const timePrefixMap: Record<string, string> = {
        '今日': '今日',
        '昨日': '昨日',
        '本周': '本周',
        '本月': '本月'
      };
      const timePrefix = timePrefixMap[timeRange] || '今日';
      // 只在今日显示增长率，其他时间范围不显示
      showGrowth = timeRange === '今日';

      // 直接使用后端返回的KPI数据
      userShare = Number(responseData?.teamUserRevenue || 0);
      teamLeaderEarnings = Number(responseData?.groupLeadersCommission || 0);
      activeUsersCount = Number(responseData?.activeUsers || 0);
      let totalUsersCount = 0; // 初始设为0
      
      // 获取员工账号总数
      try {
        const employeeResult = await request<any>('/admin/employee/list?pageSize=100', { method: 'GET' });
        const employees = Array.isArray(employeeResult) ? employeeResult : (employeeResult?.data || []);
        
        // 过滤出本团队的员工且状态为active
        const teamName = getUserTeamName();
        const teamEmployees = employees.filter((emp: any) => {
          const empTeam = emp.parentName || emp.teamName || emp.superior || '';
          const isActive = emp.status === 'active' || emp.status === 'enabled' || !emp.status;
          return empTeam === teamName && isActive;
        });
        
        totalUsersCount = teamEmployees.length;
        console.log('账号管理中的员工账号数量（已启用）:', totalUsersCount);
      } catch (error) {
        console.error('获取员工账号列表失败:', error);
      }
      
      console.log('从后端获取的KPI数据:');
      console.log('团队用户收益:', userShare);
      console.log('团队组长收益:', teamLeaderEarnings);
      console.log('今日活跃用户:', activeUsersCount);
      console.log('广告总曝光:', responseData?.impressions);
      console.log('单条平均金币:', responseData?.avgGoldPerAd);

      // 计算团队提成收益 = 团队长提成收益
      const teamShare = Number(responseData?.teamLeadCommission || 0);

      // 转换KPI数据为前端格式
      const transformedKpis = [
        {
          title: '团队提成收益',
          value: `¥${teamShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          subValue: userShare > 0 ? `${((teamShare / userShare) * 100).toFixed(2)}%` : '0%',
          growth: showGrowth ? `${responseData?.revenueGrowth > 0 ? '+' : ''}${responseData?.revenueGrowth || 0}%` : '',
          isUp: responseData?.revenueGrowth > 0,
          icon: Users,
          color: 'text-purple-600',
          bg: 'bg-purple-50'
        },
        {
          title: '团队用户收益',
          value: `¥${userShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          growth: showGrowth ? `${responseData?.revenueGrowth > 0 ? '+' : ''}${responseData?.revenueGrowth || 0}%` : '',
          isUp: responseData?.revenueGrowth > 0,
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
            title: `${timePrefix}活跃用户`,
            value: activeUsersCount.toLocaleString(),
            subValue: totalUsersCount.toString(),
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
          value: `${(responseData?.avgGoldPerAd || 0).toFixed(2)}`,
          growth: showGrowth ? `${responseData?.avgGoldPerAdGrowth > 0 ? '+' : ''}${responseData?.avgGoldPerAdGrowth || 0}%` : '',
          isUp: responseData?.avgGoldPerAdGrowth > 0,
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
      // 调用数据加载完成回调
      onDataLoaded?.();
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
