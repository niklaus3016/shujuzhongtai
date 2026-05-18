import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  Coins, Eye, Zap, Users, BarChart3, 
  TrendingUp, TrendingDown, Clock
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { cacheManager } from '../services/cacheManager';
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
  
  // 获取缓存数据
  const getCachedData = (key: string) => {
    // 为不同时间范围设置不同的缓存时间
    const cacheTime = key.includes('today') ? 300000 : 600000; // 今日数据5分钟，其他10分钟
    return cacheManager.get(key, cacheTime);
  };
  
  // 设置缓存数据
  const setCachedData = (key: string, data: any) => {
    cacheManager.set(key, data);
  };
  
  // 获取用户对应的团队名称
  const getUserTeamName = () => {
    if (currentUser?.teamName) {
      return currentUser.teamName;
    }
    if (currentUser?.username && teamNameMap[currentUser.username]) {
      return teamNameMap[currentUser.username];
    }
    // 对于团队长，默认返回其username作为团队名称
    if (currentUser?.username) {
      return currentUser.username;
    }
    return '团队';
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      // 检查缓存
      const cacheKey = `${timeRange}_${currentUser?.id || 'unknown'}`;
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setKpiData(cachedData);
        setLoading(false);
        onDataLoaded?.();
        // 后台预加载其他时间范围的数据
        preloadOtherTimeRanges();
        return;
      }
    }
    
    // 只有非刷新操作才显示加载状态
    if (!isRefresh) {
      setLoading(true);
    }

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
        } else {
          // 格式: 直接返回kpi数据
          responseData = result;
        }
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
        const employeeResult = await request<any>('/admin/employee/list?pageSize=1000', { method: 'GET' });
        const employees = Array.isArray(employeeResult) ? employeeResult : (employeeResult?.data || []);
        
        // 过滤出本团队的员工（不考虑状态，过滤掉组长）
        const teamName = getUserTeamName();
        const teamEmployees = employees.filter((emp: any) => {
          const empTeam = emp.parentName || emp.teamName || emp.superior || '';
          const isLeader = emp.isGroupLeader || emp.role === 'group_leader' || emp.role === 'GROUP_LEADER' || (emp.groupId && emp.groupId !== '');
          return empTeam === teamName && !isLeader;
        });
        
        totalUsersCount = teamEmployees.length;
      } catch (error) {
        console.error('获取员工账号列表失败:', error);
      }

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
            value: `${activeUsersCount}`,
            subValue: timeRange === '今日' && totalUsersCount > 0 
              ? `/${totalUsersCount}=` 
              : undefined,
            subValueSuffix: timeRange === '今日' && totalUsersCount > 0 
              ? `${((activeUsersCount / totalUsersCount) * 100).toFixed(2)}%` 
              : undefined,
            subValueSuffixColor: timeRange === '今日' && totalUsersCount > 0 && ((activeUsersCount / totalUsersCount) * 100) < 70 
              ? 'text-red-600' 
              : 'text-green-600',
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

      // 缓存数据
      const cacheKey = `${timeRange}_${currentUser?.id || 'unknown'}`;
      setCachedData(cacheKey, transformedKpis);
      
      setKpiData(transformedKpis);
      
      // 后台预加载其他时间范围的数据
      preloadOtherTimeRanges();
    } catch (error) {
      console.error('获取数据失败:', error);
      // 保持数据为空，不显示模拟数据
      setKpiData([]);
    } finally {
      // 只有非刷新操作才设置 loading 为 false
      if (!isRefresh) {
        setLoading(false);
        // 调用数据加载完成回调
        onDataLoaded?.();
      }
    }
  }, [timeRange, currentUser, onDataLoaded]);

  // 后台预加载其他时间范围的数据
  const preloadOtherTimeRanges = useCallback(async () => {
    if (!currentUser) return;
    
    // 所有时间范围
    const allTimeRanges = ['今日', '昨日', '本周', '本月'];
    // 排除当前时间范围
    const otherTimeRanges = allTimeRanges.filter(range => range !== timeRange);
    const timeRangeMap: Record<string, string> = {
      '今日': 'today',
      '昨日': 'yesterday',
      '本周': 'week',
      '本月': 'month'
    };
    
    // 并行预加载所有其他时间范围的数据
    await Promise.all(
      otherTimeRanges.map(async (range) => {
        const formattedTimeRange = timeRangeMap[range];
        const cacheKey = `${range}_${currentUser?.id || 'unknown'}`;
        
        // 检查是否已经有缓存
        if (getCachedData(cacheKey)) {
          return; // 已有缓存，跳过预加载
        }
        
        try {
          const teamName = getUserTeamName();
          const apiUrl = `/admin/dashboard/team-leader?range=${formattedTimeRange}`;
          
          const result = await request<any>(apiUrl, { method: 'GET' });
          const responseData = result?.kpi || result;
          
          // 时间前缀
          const timePrefixMap: Record<string, string> = {
            '今日': '今日',
            '昨日': '昨日',
            '本周': '本周',
            '本月': '本月'
          };
          const timePrefix = timePrefixMap[range];
          const showGrowth = range === '今日';
          
          const userShare = Number(responseData?.teamUserRevenue || 0);
          const teamLeaderEarnings = Number(responseData?.groupLeadersCommission || 0);
          const activeUsersCount = Number(responseData?.activeUsers || 0);
          const teamShare = Number(responseData?.teamLeadCommission || 0);
          
          // 转换KPI数据
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
            subValue: undefined,
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
          
          // 缓存数据
          setCachedData(cacheKey, transformedKpis);
        } catch (error) {
          console.error(`预加载 ${range} 数据失败:`, error);
        }
      })
    );
    
    // 预加载完整用户列表数据（用于查看全部用户功能）
    try {
      const userListCacheKey = `user_list_today_${currentUser?.id || 'unknown'}`;
      
      // 检查是否已经有缓存
      if (getCachedData(userListCacheKey)) {
        return; // 已有缓存，跳过预加载
      }
      
      // 构建完整用户列表API路径
      const teamName = getUserTeamName();
      const userListUrl = `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&limit=1000`;
      
      // 获取完整用户数据
      const userListResponse = await request<any[]>(userListUrl).catch(error => {
        console.error('获取完整用户列表失败:', error);
        return [];
      });
      
      // 处理用户数据
      const users = Array.isArray(userListResponse) ? userListResponse : [];
      
      // 过滤用户数据
      const filteredUsers = users.filter((user: any) => {
        const userTeam = user.teamName || user.superior || '系统直属';
        return userTeam === teamName;
      });
      
      // 转换用户数据
      const transformedUsers = filteredUsers.map((user: any) => ({
        id: user.employeeId || user.userId || '',
        userId: user.userId || user.employeeId || '',
        name: user.realName || user.realname || user.name || user.username || user.userName || user.userId || user.employeeId || '',
        avatar: '',
        watched: user.watched || 0,
        earnings: (user.earnings || 0) / 1000,
        ipCount: user.ipCount || 1,
        deviceCount: user.deviceCount || 1,
        ecpm: user.ecpm || 0,
        superior: user.superior || user.teamName || '系统直属',
        teamName: user.teamName || user.superior || '系统直属',
        groupName: user.groupName || user.teamGroup || ''
      }));
      
      // 去重
      const uniqueUsers = Array.from(new Map(transformedUsers.map(user => [user.id, user])).values());
      
      // 同时获取昨日用户数据用于计算对比
      let yesterdayUserData: Record<string, number> = {};
      let yesterdayEarningsData: Record<string, number> = {};
      
      try {
        // 构建昨日用户数据API路径
        const yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&limit=1000`;
        
        // 获取昨日用户数据
        const yesterdayUserResponse = await request<any>(yesterdayUserUrl, {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        
        // 处理昨日用户数据
        const yesterdayUsers = Array.isArray(yesterdayUserResponse) ? yesterdayUserResponse : [];
        yesterdayUsers.forEach((user: any) => {
          const userId = user.employeeId || user.userId || '';
          yesterdayUserData[userId] = user.watched || 0;
          yesterdayEarningsData[userId] = (user.earnings || 0) / 1000;
        });
      } catch (error) {
        console.error('Error fetching yesterday user data for user list:', error);
      }
      
      // 缓存完整用户列表数据
      setCachedData(userListCacheKey, {
        users: uniqueUsers,
        yesterdayUserData,
        yesterdayEarningsData
      });
    } catch (error) {
      console.error('Error preloading user list data:', error);
    }
  }, [timeRange, currentUser]);

  useEffect(() => {
    // 只有当currentUser存在时才加载数据
    if (currentUser) {
      fetchData();
    }
  }, [fetchData, currentUser]);

  // 自动刷新机制
  useEffect(() => {
    if (currentUser) {
      // 设置自动刷新定时器，每60秒刷新一次，使用静默刷新模式
      const interval = setInterval(() => {
        // 静默刷新：不显示刷新动画，只更新缓存
        fetchData(true);
      }, 60000);
      
      // 清理函数
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchData]);

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
                  {kpi.subValue && kpi.subValue !== '0' && (
                    <span className="ml-1.5 text-[10px] font-bold text-gray-600">
                      ({kpi.subValue}<span className={kpi.subValueSuffixColor || 'text-gray-600'}>{kpi.subValueSuffix || ''}</span>)
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
