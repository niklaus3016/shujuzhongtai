
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TimeRange, KPIStats, User, UserRole } from '../types';
import { 
  TrendingUp, TrendingDown, Eye, MousePointer2, Coins, 
  Wallet, BarChart3, Percent, ChevronRight, Globe, Smartphone, Zap, Users,
  Trophy, Medal, Crown, RefreshCw
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import TeamLeaderDashboard from '../components/TeamLeaderDashboard';

interface DashboardUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  watched: number;
  earnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  trend: 'up' | 'down' | 'stable';
  superior?: string;
  teamName?: string;
  teamGroupId?: string;
  groupName?: string;
  regDays: number;
}

interface DashboardProps {
  onSelectUser?: (user: any) => void;
  onViewAllUsers?: () => void;
}

const mockDashboardUsers: DashboardUser[] = [
  { id: '8901', userId: 'user001', name: '王*亮', avatar: 'https://picsum.photos/seed/u1/100/100', watched: 1240, earnings: 186.5, ipCount: 1, deviceCount: 1, ecpm: 150.4, trend: 'up', superior: '张管理', regDays: 45 },
  { id: '8902', userId: 'user002', name: '李*华', avatar: 'https://picsum.photos/seed/u2/100/100', watched: 980, earnings: 245.2, ipCount: 2, deviceCount: 1, ecpm: 250.2, trend: 'up', superior: '李管理', regDays: 32 },
  { id: '8903', userId: 'user003', name: '张*强', avatar: 'https://picsum.photos/seed/u3/100/100', watched: 1100, earnings: 165.0, ipCount: 1, deviceCount: 2, ecpm: 85.0, trend: 'down', superior: '王主管', regDays: 12 },
  { id: '8904', userId: 'user004', name: '赵*敏', avatar: 'https://picsum.photos/seed/u4/100/100', watched: 850, earnings: 210.8, ipCount: 1, deviceCount: 1, ecpm: 248.0, trend: 'stable', superior: '张管理', regDays: 5 },
  { id: '8905', userId: 'user005', name: '陈*平', avatar: 'https://picsum.photos/seed/u5/100/100', watched: 1320, earnings: 198.0, ipCount: 3, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '李管理', regDays: 60 },
  { id: '8906', userId: 'user006', name: '刘*洋', avatar: 'https://picsum.photos/seed/u6/100/100', watched: 750, earnings: 112.5, ipCount: 1, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '系统直属', regDays: 3 },
  { id: '8907', userId: 'user007', name: '孙*超', avatar: 'https://picsum.photos/seed/u7/100/100', watched: 1420, earnings: 213.0, ipCount: 1, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '王主管', regDays: 120 },
  { id: '8908', userId: 'user008', name: '周*杰', avatar: 'https://picsum.photos/seed/u8/100/100', watched: 640, earnings: 96.0, ipCount: 4, deviceCount: 2, ecpm: 75.0, trend: 'down', superior: '张管理', regDays: 8 },
  { id: '8909', userId: 'user009', name: '吴*凡', avatar: 'https://picsum.photos/seed/u9/100/100', watched: 1050, earnings: 157.5, ipCount: 1, deviceCount: 1, ecpm: 150.0, trend: 'stable', superior: '系统直属', regDays: 200 },
  { id: '8910', userId: 'user010', name: '郑*爽', avatar: 'https://picsum.photos/seed/u10/100/100', watched: 1180, earnings: 177.0, ipCount: 2, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '李管理', regDays: 2 },
];

const Dashboard: React.FC<DashboardProps> = ({ onSelectUser, onViewAllUsers }) => {
  // 使用 useMemo 缓存 currentUser，避免每次渲染都返回新对象
  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  const isGroupLeader = currentUser?.role === UserRole.GROUP_LEADER;
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  // 只要不是团队长和组长，就显示数据看板（包括超级管理员和普通管理员）
  const showKPIDashboard = !isTeamLeader && !isGroupLeader;
  
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
  
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.TODAY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc'>('earnings');
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [userData, setUserData] = useState<DashboardUser[]>([]);
  
  // 添加滚动位置保存
  const scrollPositionRef = React.useRef<number>(0);
  
  // 添加昨日KPI数据，用于计算增长率
  const [yesterdayKpiData, setYesterdayKpiData] = useState<any>(null);
  
  // 添加昨日用户数据，用于计算次数对比
  const [yesterdayUserData, setYesterdayUserData] = useState<Record<string, number>>({});
  
  // 添加昨日用户收益数据，用于计算收益对比
  const [yesterdayEarningsData, setYesterdayEarningsData] = useState<Record<string, number>>({});
  
  // 使用ref存储昨日数据，避免闭包问题
  const yesterdayUserDataRef = React.useRef<Record<string, number>>({});

  // Time range mapping
  const timeRangeMap: Record<string, string> = {
    [TimeRange.TODAY]: 'today',
    [TimeRange.YESTERDAY]: 'yesterday',
    [TimeRange.THIS_WEEK]: 'week',
    [TimeRange.THIS_MONTH]: 'month'
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    // 保存当前滚动位置
    if (isRefresh) {
      scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    // 不清空之前的数据，避免闪屏
    try {
      console.log('开始获取数据，currentUser:', currentUser);
      console.log('isTeamLeader:', isTeamLeader);
      console.log('isGroupLeader:', isGroupLeader);
      console.log('showKPIDashboard:', showKPIDashboard);
      console.log('timeRange:', timeRange);
      
      const rangeParam = timeRangeMap[timeRange];
      console.log('rangeParam:', rangeParam);

      // 并行获取KPI数据和用户数据，提高加载速度
      const promises: Promise<any>[] = [];

      // 只要不是团队长和组长，就获取KPI数据
      if (showKPIDashboard) {
        const kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}`;
        console.log('KPI API URL:', kpiUrl);
        promises.push(request<any>(kpiUrl, { method: 'GET' }));

        // 如果是今日数据，同时获取昨日数据用于计算增长率
        if (timeRange === TimeRange.TODAY) {
          const yesterdayKpiUrl = `/admin/dashboard/kpi?range=yesterday`;
          console.log('昨日KPI API URL:', yesterdayKpiUrl);
          promises.push(request<any>(yesterdayKpiUrl, { method: 'GET' }));
        }
      }
      console.log('添加到promises的请求数量:', promises.length);

      // 构建用户数据URL
      let userUrl = `/admin/dashboard/users?range=${rangeParam}&limit=30`;
      if (isTeamLeader) {
        const teamName = getUserTeamName();
        userUrl = `/admin/dashboard/users?range=${rangeParam}&team=${encodeURIComponent(teamName)}&limit=30`;
      } else if (isGroupLeader) {
        const teamGroupId = currentUser?.teamGroupId;
        userUrl = `/admin/dashboard/users?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}&limit=30`;
      }
      console.log('用户API URL:', userUrl);
      promises.push(request<any[]>(userUrl, { method: 'GET' }));

      // 如果是今日数据，同时获取昨日用户数据用于计算次数对比
      if (timeRange === TimeRange.TODAY) {
        let yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&limit=30`;
        if (isTeamLeader) {
          const teamName = getUserTeamName();
          yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&limit=30`;
        } else if (isGroupLeader) {
          const teamGroupId = currentUser?.teamGroupId;
          yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&group=${encodeURIComponent(teamGroupId || '')}&limit=30`;
        }
        console.log('昨日用户API URL:', yesterdayUserUrl);
        promises.push(request<any[]>(yesterdayUserUrl, { method: 'GET' }));
      }

      // 并行执行所有请求
      console.log('开始执行API请求:', promises.length);
      const results = await Promise.all(promises);
      console.log('API请求完成，结果数量:', results.length);
      console.log('API请求结果:', results);

      // 处理KPI数据
      if (showKPIDashboard) {
        console.log('处理KPI数据开始，results长度:', results.length);
        console.log('results内容:', results);
        const kpiResponse = results[0];
        console.log('KPI响应数据:', kpiResponse);

        // 如果是今日数据，获取昨日数据
        let yesterdayKpiResponse = null;
        if (timeRange === TimeRange.TODAY && results.length > 1) {
          yesterdayKpiResponse = results[1];
          console.log('昨日KPI响应数据:', yesterdayKpiResponse);
          setYesterdayKpiData(yesterdayKpiResponse);
        } else if (timeRange === TimeRange.TODAY) {
          console.log('时间范围是今日，但results长度不足，无法获取昨日数据');
        }

        // Time prefix for dynamic titles
        const timePrefixMap: Record<string, string> = {
          [TimeRange.TODAY]: '今日',
          [TimeRange.YESTERDAY]: '昨日',
          [TimeRange.THIS_WEEK]: '本周',
          [TimeRange.THIS_MONTH]: '本月'
        };
        const timePrefix = timePrefixMap[timeRange];
        const showGrowth = timeRange === TimeRange.TODAY || timeRange === TimeRange.THIS_MONTH;
        console.log('showGrowth:', showGrowth);

        // Transform KPI data to match frontend format
        const userShare = Number(kpiResponse.coins || 0) / 1000;
        const platformCost = userShare * 0.2;

        // 计算利润率
        const todayProfitMargin = kpiResponse.revenue > 0 ? ((Number(kpiResponse.revenue || 0) - userShare - platformCost) / Number(kpiResponse.revenue) * 100) : 0;

        // 计算利润率增长率（今日 - 昨日）
        let profitMarginGrowth = 0;
        if (timeRange === TimeRange.TODAY && yesterdayKpiResponse) {
          const yesterdayUserShare = Number(yesterdayKpiResponse.coins || 0) / 1000;
          const yesterdayPlatformCost = yesterdayUserShare * 0.2;
          const yesterdayProfitMargin = yesterdayKpiResponse.revenue > 0 ? ((Number(yesterdayKpiResponse.revenue || 0) - yesterdayUserShare - yesterdayPlatformCost) / Number(yesterdayKpiResponse.revenue) * 100) : 0;
          profitMarginGrowth = todayProfitMargin - yesterdayProfitMargin;
        }

        // 计算活跃用户增长率（今日 - 昨日）
        let activeUsersGrowth = 0;
        console.log('计算活跃用户增长率开始:');
        console.log('timeRange:', timeRange);
        console.log('yesterdayKpiResponse:', yesterdayKpiResponse);
        console.log('kpiResponse.activeUsers:', kpiResponse.activeUsers);
        if (timeRange === TimeRange.TODAY && yesterdayKpiResponse) {
          const todayActiveUsers = Number(kpiResponse.activeUsers || 0);
          const yesterdayActiveUsers = Number(yesterdayKpiResponse.activeUsers || 0);
          console.log('今日活跃用户:', todayActiveUsers);
          console.log('昨日活跃用户:', yesterdayActiveUsers);
          if (yesterdayActiveUsers > 0) {
            activeUsersGrowth = ((todayActiveUsers - yesterdayActiveUsers) / yesterdayActiveUsers) * 100;
            console.log('计算的增长率:', activeUsersGrowth);
          } else if (todayActiveUsers > 0) {
            activeUsersGrowth = 100; // 昨日为0，今日有数据，增长率100%
            console.log('昨日为0，今日有数据，增长率设为100%');
          }
        } else {
          console.log('不计算增长率的原因:', { timeRange, hasYesterdayData: !!yesterdayKpiResponse });
        }
        console.log('最终活跃用户增长率:', activeUsersGrowth);

        const transformedKpis = [
          { title: `${timePrefix}利润`, value: `¥${(Number(kpiResponse.revenue || 0) - userShare - platformCost).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { title: `${timePrefix}利润率`, value: `${todayProfitMargin.toFixed(2)}%`, growth: showGrowth ? `${profitMarginGrowth > 0 ? '+' : ''}${profitMarginGrowth.toFixed(2)}%` : '', isUp: profitMarginGrowth > 0, icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50' },
          { title: '业务总收入', value: `¥${Number(kpiResponse.revenue || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
          { title: '用户分成金额', value: `¥${(Number(kpiResponse.coins || 0) / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, subValue: `${kpiResponse.revenue > 0 ? ((Number(kpiResponse.coins || 0) / 1000 / Number(kpiResponse.revenue)) * 100).toFixed(2) : '0.00'}%`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
          { title: '广告总曝光', value: kpiResponse.impressions?.toLocaleString() || '0', growth: showGrowth ? `${kpiResponse.impressionsGrowth > 0 ? '+' : ''}${kpiResponse.impressionsGrowth || 0}%` : '', isUp: kpiResponse.impressionsGrowth > 0, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
          { title: '团队分成', value: `¥${(Number(kpiResponse.coins || 0) / 1000 * 0.25).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
          { title: `${timePrefix}平均 eCPM`, value: `${kpiResponse.ecpm || 0}`, growth: showGrowth ? `${kpiResponse.ecpmGrowth > 0 ? '+' : ''}${kpiResponse.ecpmGrowth || 0}%` : '', isUp: kpiResponse.ecpmGrowth > 0, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { title: `${timePrefix}活跃用户`, value: kpiResponse.activeUsers?.toLocaleString() || '0', growth: showGrowth ? `${activeUsersGrowth > 0 ? '+' : ''}${activeUsersGrowth.toFixed(2)}%` : '', isUp: activeUsersGrowth > 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
        ];

        console.log('转换后的KPI数据:', transformedKpis);
        setKpiData(transformedKpis);
      }

      // 处理用户数据
      const userResponseIndex = showKPIDashboard ? (timeRange === TimeRange.TODAY ? 2 : 1) : 0;
      const userResponse = results[userResponseIndex];
      console.log('用户响应数据:', userResponse);

      // 如果是今日数据，获取昨日用户数据
      if (timeRange === TimeRange.TODAY) {
        const yesterdayUserResponseIndex = showKPIDashboard ? 3 : 1;
        const yesterdayUserResponse = results[yesterdayUserResponseIndex];
        console.log('昨日用户响应数据:', yesterdayUserResponse);
        // 构建用户ID到次数和收益的映射
        const yesterdayUserMap: Record<string, number> = {};
        const yesterdayEarningsMap: Record<string, number> = {};
        if (Array.isArray(yesterdayUserResponse)) {
          yesterdayUserResponse.forEach((user: any) => {
            const userId = user.employeeId || user.userId || '';
            yesterdayUserMap[userId] = user.watched || 0;
            yesterdayEarningsMap[userId] = (user.earnings || 0) / 1000;
          });
        }
        yesterdayUserDataRef.current = yesterdayUserMap;
        setYesterdayUserData(yesterdayUserMap);
        setYesterdayEarningsData(yesterdayEarningsMap);
      }

      // Transform user data to match frontend format
      const userArray = Array.isArray(userResponse) ? userResponse : [];
      console.log('用户数组:', userArray);
      const transformedUsers: DashboardUser[] = userArray.map((user: any) => ({
        id: user.employeeId || user.userId || '',
        userId: user.userId || '',
        name: user.realName || user.realname || user.name || user.username || user.userName || user.employeeId || user.userId || '',
        avatar: '',
        watched: user.watched || 0,
        earnings: (user.earnings || 0) / 1000,
        ipCount: user.ipCount || 1,
        deviceCount: user.deviceCount || 1,
        ecpm: user.ecpm || 0,
        trend: 'up' as const,
        superior: user.superior || user.teamName || '系统直属',
        teamName: user.teamName || user.superior || '系统直属',
        teamGroupId: user.teamGroupId || user.groupId || '',
        groupName: user.groupName || '',
        regDays: user.regDays || 1
      }));

      console.log('转换后的用户数据:', transformedUsers);

      // 团队长只显示自己团队的成员数据，组长只显示自己组的成员数据
      let filteredUsers = transformedUsers;
      
      if (isTeamLeader) {
        const teamName = getUserTeamName();
        console.log('团队名称:', teamName);
        filteredUsers = transformedUsers.filter(user => {
          const userTeam = user.teamName || user.superior || '系统直属';
          return userTeam === teamName;
        });
        console.log('过滤后的用户数据:', filteredUsers);
      } else if (isGroupLeader) {
        const teamGroupId = currentUser?.teamGroupId;
        console.log('组ID:', teamGroupId);
        filteredUsers = transformedUsers.filter(user => {
          return user.teamGroupId === teamGroupId;
        });
        console.log('过滤后的用户数据:', filteredUsers);
      }
      
      console.log('最终用户数据:', filteredUsers);
      setUserData(filteredUsers);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // 数据获取失败，保持数据为空，不显示模拟数据
      setKpiData([]);
      setUserData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      // 切换时间范围时滚动到顶部
      if (!isRefresh) {
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 50);
      } else if (scrollPositionRef.current > 0) {
        // 刷新时恢复滚动位置
        setTimeout(() => {
          window.scrollTo(0, scrollPositionRef.current);
        }, 50);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, isTeamLeader, isGroupLeader, showKPIDashboard]);

  useEffect(() => {
    // 初始加载数据
    fetchData();
    
    // 设置自动刷新定时器，每60秒刷新一次，使用刷新模式
    const interval = setInterval(() => {
      fetchData(true);
    }, 60000);
    
    // 清理函数
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const kpis = kpiData;

  const sortedUsers = [...userData].sort((a, b) => {
    if (sortBy === 'agc') {
      const agcA = a.watched > 0 ? (a.earnings * 1000) / a.watched : 0;
      const agcB = b.watched > 0 ? (b.earnings * 1000) / b.watched : 0;
      return agcB - agcA;
    }
    return b[sortBy] - a[sortBy];
  });

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-full w-3/4"></div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{isTeamLeader ? '团队数据' : '数据总览'}</h1>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 bg-blue-50 rounded-lg text-[#1E40AF] hover:bg-blue-100 transition-all disabled:opacity-50 animate-in hover:scale-105"
              title="刷新数据"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="p-1.5 bg-green-50 rounded-full flex items-center px-3 text-green-600 text-[10px] font-bold shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1.5"></div>
            实时更新中
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
          {Object.values(TimeRange).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                timeRange === range ? 'bg-white text-[#1E40AF] shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4 space-y-4">
        {/* 团队长显示专用数据看板，超级管理员显示完整数据看板 */}
        {isTeamLeader ? (
          <TeamLeaderDashboard 
            timeRange={timeRangeMap[timeRange]} 
            onRefresh={handleRefresh} 
          />
        ) : (
          showKPIDashboard && (
            <div className="grid grid-cols-2 gap-3">
              {kpis.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
                  <div className="text-sm mb-2">暂无数据</div>
                  <div className="text-[10px]">请稍后刷新或检查网络连接</div>
                </div>
              ) : kpis.map((kpi: any, idx) => {
                const Icon = kpi.icon;
                const rawValue = kpi.title.includes('eCPM') ? parseFloat(kpi.value) : 0;
                
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
                    <div className={`text-lg font-bold leading-none ${
                        kpi.title.includes('eCPM') 
                            ? (rawValue >= 150 ? 'text-[#10B981]' : 'text-[#EF4444]') 
                            : 'text-gray-900'
                    }`}>
                        {kpi.value}
                        {kpi.subValue && (
                          <span className={`ml-1.5 text-[10px] font-bold ${
                            kpi.title === '广告总点击' 
                              ? (parseFloat(kpi.subValue) >= 70 ? 'text-[#10B981]' : 'text-[#EF4444]')
                              : kpi.title === '用户分成金额'
                                ? (parseFloat(kpi.subValue) <= 60 ? 'text-[#10B981]' : 'text-[#EF4444]')
                                : (parseFloat(kpi.subValue) > 50 ? 'text-[#EF4444]' : 'text-[#10B981]')
                          }`}>
                            ({kpi.subValue})
                          </span>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden animate-in fade-in duration-500">
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-sm font-bold text-gray-900 flex items-center">
                    <Users size={16} className="mr-2 text-[#1E40AF]" />
                    {isTeamLeader ? '成员实时表现' : '用户实时表现'}
                    <span className="ml-2 px-2 py-0.5 bg-[#1E40AF] text-white text-[9px] rounded-full shadow-sm">Top 30</span>
                </h3>
                <div className="flex bg-white p-1 rounded-lg shadow-sm">
                    <button 
                        onClick={() => setSortBy('agc')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${sortBy === 'agc' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                        平均金币
                    </button>
                    <button 
                        onClick={() => setSortBy('watched')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${sortBy === 'watched' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                        次数
                    </button>
                    <button 
                        onClick={() => setSortBy('earnings')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${sortBy === 'earnings' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                        收益
                    </button>
                </div>
            </div>
            
            <div className="divide-y divide-gray-100">
                {sortedUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-sm mb-2">暂无用户数据</div>
                    <div className="text-[10px]">请稍后刷新或检查网络连接</div>
                  </div>
                ) : sortedUsers.map((user, idx) => (
                    <div 
                      key={`${user.id}-${idx}`}
                      className="p-4 space-y-3 active:bg-gray-50 transition-all duration-200 cursor-pointer hover:bg-gray-50/50 animate-in fade-in duration-300"
                      onClick={() => onSelectUser?.(user)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="relative flex-shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center text-gray-900 text-xs font-bold shadow-sm border border-gray-100">
                                        {user.id}
                                    </div>
                                    
                                    {idx === 0 && (
                                        <div className="absolute -top-3 -left-2.5 text-yellow-500 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.2)] transform -rotate-12 animate-pulse">
                                            <Crown size={18} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    {idx === 1 && (
                                        <div className="absolute -top-3 -left-2.5 text-slate-400 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] transform -rotate-12">
                                            <Crown size={18} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    {idx === 2 && (
                                        <div className="absolute -top-3 -left-2.5 text-amber-700 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] transform -rotate-12">
                                            <Crown size={18} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}

                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white ${
                                        idx === 0 ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-400'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-bold text-gray-900 truncate">{user.name}</h4>
                                        {user.regDays <= 15 && (
                                            <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-full border border-emerald-200 uppercase leading-tight flex-shrink-0 shadow-sm">新人</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium tracking-tight flex flex-col space-y-0.5 overflow-hidden mt-1">
                                        <div className="flex items-center space-x-1.5">
                                            <span className="text-[#1E40AF] font-bold truncate">团队: {user.superior || '无'}</span>
                                            <span className="text-gray-300">•</span>
                                            <span className="text-gray-400">注册{user.regDays}天</span>
                                        </div>
                                        <span className="text-orange-500 font-medium truncate">组别: {user.groupName || user.teamGroupId || '无'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 flex-shrink-0">
                                <div className="text-right flex flex-col space-y-0.5">
                                    {sortBy === 'earnings' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${timeRange === TimeRange.TODAY && yesterdayEarningsData[user.id] !== undefined ? (user.earnings > yesterdayEarningsData[user.id] ? 'text-green-600' : user.earnings < yesterdayEarningsData[user.id] ? 'text-red-500' : 'text-gray-900') : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${timeRange === TimeRange.TODAY && yesterdayUserData[user.id] !== undefined ? (user.watched > yesterdayUserData[user.id] ? 'text-green-600' : user.watched < yesterdayUserData[user.id] ? 'text-red-500' : 'text-gray-900') : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                        </>
                                    ) : sortBy === 'watched' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${timeRange === TimeRange.TODAY && yesterdayUserData[user.id] !== undefined ? (user.watched > yesterdayUserData[user.id] ? 'text-green-600' : user.watched < yesterdayUserData[user.id] ? 'text-red-500' : 'text-gray-900') : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${timeRange === TimeRange.TODAY && yesterdayEarningsData[user.id] !== undefined ? (user.earnings > yesterdayEarningsData[user.id] ? 'text-green-600' : user.earnings < yesterdayEarningsData[user.id] ? 'text-red-500' : 'text-gray-500') : 'text-gray-500'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${(user.watched > 0 ? ((user.earnings * 1000) / user.watched) >= 100 : false) ? 'text-green-600' : 'text-red-500'}`}>
                                                    {(user.watched > 0 ? ((user.earnings * 1000) / user.watched) : 0).toFixed(2)}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">平均金币</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${timeRange === TimeRange.TODAY && yesterdayEarningsData[user.id] !== undefined ? (user.earnings > yesterdayEarningsData[user.id] ? 'text-green-600' : user.earnings < yesterdayEarningsData[user.id] ? 'text-red-500' : 'text-gray-500') : 'text-gray-500'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <ChevronRight size={16} className="text-gray-400 hover:text-[#1E40AF] transition-colors" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 pt-1">
                            <div className="flex items-center space-x-1.5 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <Globe size={12} className="text-blue-500" />
                                <span className="text-[9px] text-gray-400 font-medium">IP:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.ipCount}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <Smartphone size={12} className="text-purple-500" />
                                <span className="text-[9px] text-gray-400 font-medium">设备:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.deviceCount}</span>
                            </div>
                            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ml-auto ${sortBy === 'agc' ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-blue-50 border-blue-200 shadow-sm'}`}>
                                <Zap size={12} className={sortBy === 'agc' ? 'text-white' : 'text-orange-500'} />
                                <span className={`text-[9px] font-medium uppercase tracking-tighter ${sortBy === 'agc' ? 'text-white/80' : 'text-gray-400'}`}>平均金币:</span>
                                <span className={`text-[10px] font-black ${sortBy === 'agc' ? 'text-white' : (user.watched > 0 ? ((user.earnings * 1000) / user.watched) >= 100 : false) ? 'text-green-600' : 'text-red-500'}`}>
                                    {(user.watched > 0 ? ((user.earnings * 1000) / user.watched) : 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <button 
              onClick={onViewAllUsers}
              className="w-full py-3 bg-gray-50 text-[11px] font-bold text-gray-500 hover:text-[#1E40AF] border-t border-gray-50 transition-colors"
            >
                查看全部用户
            </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
