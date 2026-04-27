
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TimeRange, KPIStats, User, UserRole, AdminUser } from '../types';
import { 
  TrendingUp, TrendingDown, Eye, MousePointer2, Coins, 
  Wallet, BarChart3, Percent, ChevronRight, Globe, Smartphone, Zap, Users,
  Trophy, Medal, Crown, RefreshCw, Search
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import { cacheManager } from '../services/cacheManager';
import TeamLeaderDashboard from '../components/TeamLeaderDashboard';
import GroupLeader from './GroupLeader';

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

interface NewUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  watched: number;
  earnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  regDays: number;
  superior?: string;
  isOnline?: boolean;
  groupName?: string;
  groupLeaderName?: string;
  lastActiveTime?: string;
  loginDays?: number;
}

interface DashboardProps {
  onSelectUser?: (user: any) => void;
  onViewAllUsers?: () => void;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  currentUser?: AdminUser | null;
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

const Dashboard: React.FC<DashboardProps> = ({ onSelectUser, onViewAllUsers, timeRange: propTimeRange, onTimeRangeChange, currentUser: propCurrentUser }) => {
  // 使用传入的currentUser或内部状态
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(propCurrentUser || null);
  
  // 状态变量定义
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc'>('earnings');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [userData, setUserData] = useState<DashboardUser[]>([]);
  
  // 使用传入的timeRange或默认值
  const timeRange = useMemo(() => {
    if (propTimeRange) {
      // 将字符串转换为TimeRange类型
      switch (propTimeRange) {
        case 'today': return TimeRange.TODAY;
        case 'yesterday': return TimeRange.YESTERDAY;
        case 'week': return TimeRange.THIS_WEEK;
        case 'month': return TimeRange.THIS_MONTH;
        default: return TimeRange.TODAY;
      }
    }
    return TimeRange.TODAY;
  }, [propTimeRange]);
  
  // 添加昨日KPI数据，用于计算增长率
  const [yesterdayKpiData, setYesterdayKpiData] = useState<any>(null);
  
  // 添加昨日用户数据，用于计算次数对比
  const [yesterdayUserData, setYesterdayUserData] = useState<Record<string, number>>({});
  
  // 添加昨日用户收益数据，用于计算收益对比
  const [yesterdayEarningsData, setYesterdayEarningsData] = useState<Record<string, number>>({});
  
  // 使用ref存储昨日数据，避免闭包问题
  const yesterdayUserDataRef = React.useRef<Record<string, number>>({});
  
  // 添加滚动位置保存
  const scrollPositionRef = React.useRef<number>(0);
  
  // 当propCurrentUser变化时，更新内部状态
  useEffect(() => {
    if (propCurrentUser) {
      setCurrentUser(propCurrentUser);
    }
  }, [propCurrentUser]);
  
  // 恢复滚动位置
  useEffect(() => {
    // 恢复滚动位置
    const savedPosition = sessionStorage.getItem('dashboard_scroll_position');
    if (savedPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
        // 清除保存的位置
        sessionStorage.removeItem('dashboard_scroll_position');
      }, 100);
    }
  }, []);

  // 当currentUser变化时，恢复昨日数据
  useEffect(() => {
    if (currentUser) {
      const todayCacheKey = `today_${currentUser.id}`;
      const cachedData = cacheManager.get(todayCacheKey, 300000);
      if (cachedData && cachedData.yesterdayUserData && cachedData.yesterdayEarningsData) {
        console.log('[Dashboard] 从缓存恢复昨日数据，键:', todayCacheKey, '数据:', cachedData.yesterdayEarningsData);
        setYesterdayUserData(cachedData.yesterdayUserData);
        setYesterdayEarningsData(cachedData.yesterdayEarningsData);
        yesterdayUserDataRef.current = cachedData.yesterdayUserData;
      }
    }
  }, [currentUser]);
  
  // 当timeRange变化时，重新加载数据
  useEffect(() => {
    if (currentUser) {
      // 延迟调用，确保fetchData已经定义
      setTimeout(() => {
        fetchData();
      }, 0);
    }
  }, [timeRange, currentUser]);
  
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  const isGroupLeader = currentUser?.role === UserRole.GROUP_LEADER;
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  // 只要不是团队长，就显示数据看板（包括超级管理员、普通管理员和组长）
  const showKPIDashboard = !isTeamLeader;
  
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
    // 对于团队长，默认返回其username作为团队名称
    if (isTeamLeader && currentUser?.username) {
      return currentUser.username;
    }
    return '团队';
  };
  
  // 获取缓存数据
  const getCachedData = (key: string) => {
    // 为不同时间范围设置不同的缓存时间
    const cacheTime = key.includes('today') ? 300000 : 600000; // 今日数据5分钟，其他10分钟
    return cacheManager.get(key, cacheTime);
  };
  
  // 设置缓存数据
  const setCachedData = (key: string, data: any, cacheTime?: number) => {
    console.log('[Dashboard] 设置缓存，键:', key, '数据:', data ? `存在(${data.users?.length || data.teams?.length || 'unknown'}条)` : '空', '缓存时间:', cacheTime ? `${cacheTime}ms` : '默认');
    cacheManager.set(key, data, cacheTime);
  };

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
      // 刷新时清除缓存
      cacheManager.clear();
    } else {
      // 无论是否为团队长，都需要设置loading为true
      // 因为Dashboard组件需要显示整体加载状态
      setLoading(true);
    }
    // 不清空之前的数据，避免闪屏
    try {
      // 检查currentUser是否存在
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const rangeParam = timeRangeMap[timeRange];
      const cacheKey = `${rangeParam}_${currentUser.id}`;
      
      // 声明昨日数据映射变量
      let yesterdayUserMap: Record<string, number> = {};
      let yesterdayEarningsMap: Record<string, number> = {};
      
      // 检查缓存
      const cachedData = getCachedData(cacheKey);
      if (cachedData && !isRefresh) {
        const { kpiData: cachedKpiData, userData: cachedUserData, yesterdayUserData: cachedYesterdayUserData, yesterdayEarningsData: cachedYesterdayEarningsData } = cachedData;
        setKpiData(cachedKpiData);
        setUserData(Array.isArray(cachedUserData) ? cachedUserData : []);
        // 同时设置昨日数据
        if (cachedYesterdayUserData && cachedYesterdayEarningsData) {
          setYesterdayUserData(cachedYesterdayUserData);
          setYesterdayEarningsData(cachedYesterdayEarningsData);
          yesterdayUserDataRef.current = cachedYesterdayUserData;
        }
        // 无论是否有昨日数据，都使用缓存的今日数据
        setLoading(false);
        setRefreshing(false);
        
        // 标记数据已加载，避免GroupLeader组件重复加载
        (window as any).dashboardDataLoaded = true;
        
        // 后台预加载其他时间范围的数据（不阻塞主流程）
        setTimeout(() => {
          preloadOtherTimeRanges();
        }, 100);
        return;
      }

      // 1. 先获取当前时间范围的数据（主要请求）
      let kpiResponse: any = null;
      let yesterdayKpiResponse: any = null;
      let userResponse: any = null;
      let transformedKpis: any[] = [];
      
      try {
        console.log('[Dashboard] 开始获取当前时间范围数据', { timeRange, showKPIDashboard, isTeamLeader, isGroupLeader, isSuperAdmin });
        const startTime = Date.now();
        
        // 构建主要API请求
        const primaryRequests: Promise<any>[] = [];
        
        // KPI数据请求
        if (showKPIDashboard) {
          let kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}`;
          if (isGroupLeader) {
            const teamGroupId = currentUser.teamGroupId;
            kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
          }
          console.log('[Dashboard] 添加KPI请求:', kpiUrl);
          primaryRequests.push(request<any>(kpiUrl, { method: 'GET' }));
        } else {
          primaryRequests.push(Promise.resolve(null));
        }
        
        // 如果是今日数据，同时添加昨日KPI数据请求（用于超管计算增长率）
        if (showKPIDashboard && timeRange === TimeRange.TODAY) {
          let yesterdayKpiUrl = `/admin/dashboard/kpi?range=yesterday`;
          if (isGroupLeader) {
            const teamGroupId = currentUser.teamGroupId;
            yesterdayKpiUrl = `/admin/dashboard/kpi?range=yesterday&group=${encodeURIComponent(teamGroupId || '')}`;
          }
          console.log('[Dashboard] 添加昨日KPI请求:', yesterdayKpiUrl);
          primaryRequests.push(request<any>(yesterdayKpiUrl, { method: 'GET' }));
        } else {
          primaryRequests.push(Promise.resolve(null));
        }
        
        // 用户数据请求
        let userUrl = `/admin/dashboard/users?range=${rangeParam}`;
        if (isGroupLeader) {
          const teamGroupId = currentUser.teamGroupId;
          userUrl = `/admin/dashboard/users?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
        } else if (isTeamLeader) {
          const teamName = getUserTeamName();
          userUrl = `/admin/dashboard/users?range=${rangeParam}&team=${encodeURIComponent(teamName)}`;
        }
        console.log('[Dashboard] 添加用户请求:', userUrl);
        primaryRequests.push(request<any[]>(userUrl, { method: 'GET' }));
        
        console.log(`[Dashboard] 共有 ${primaryRequests.length} 个主要请求需要执行`);
        
        // 执行主要请求（当前时间范围的数据）
        const primaryResponses = await Promise.all(primaryRequests);
        
        console.log(`[Dashboard] 主要请求完成，耗时: ${Date.now() - startTime}ms`);
        
        // 处理主要响应结果
        let responseIndex = 0;
        if (showKPIDashboard) {
          kpiResponse = primaryResponses[responseIndex++];
        } else {
          responseIndex += 1;
        }
        
        // 获取昨日KPI数据（用于超管计算增长率）
        if (showKPIDashboard && timeRange === TimeRange.TODAY) {
          yesterdayKpiResponse = primaryResponses[responseIndex++];
          setYesterdayKpiData(yesterdayKpiResponse);
        } else {
          responseIndex += 1;
        }
        
        userResponse = primaryResponses[responseIndex++];
        console.log('[Dashboard] 用户数据响应:', userResponse);
        
        // 2. 处理KPI数据
        if (kpiResponse) {
          // Time prefix for dynamic titles
          const timePrefixMap: Record<string, string> = {
            [TimeRange.TODAY]: '今日',
            [TimeRange.YESTERDAY]: '昨日',
            [TimeRange.THIS_WEEK]: '本周',
            [TimeRange.THIS_MONTH]: '本月'
          };
          const timePrefix = timePrefixMap[timeRange];
          const showGrowth = timeRange === TimeRange.TODAY || timeRange === TimeRange.THIS_MONTH;

          // Transform KPI data to match frontend format
          const userShare = Number(kpiResponse.coins || 0) / 1000;
          const platformCost = userShare * 0.2;

          // 计算今日利润
          const todayProfit = Number(kpiResponse.revenue || 0) - userShare - platformCost;
          
          // 计算利润率
          const todayProfitMargin = kpiResponse.revenue > 0 ? ((todayProfit) / Number(kpiResponse.revenue) * 100) : 0;

          // 计算利润率增长率（今日 - 昨日）
          let profitMarginGrowth = 0;
          // 计算利润增长率（今日 - 昨日）
          let profitGrowth = 0;
          
          // 超管使用昨日数据计算增长率，团队长和组长保持不变
          if (isSuperAdmin && timeRange === TimeRange.TODAY && yesterdayKpiResponse) {
            const yesterdayUserShare = Number(yesterdayKpiResponse.coins || 0) / 1000;
            const yesterdayPlatformCost = yesterdayUserShare * 0.2;
            const yesterdayProfit = Number(yesterdayKpiResponse.revenue || 0) - yesterdayUserShare - yesterdayPlatformCost;
            const yesterdayProfitMargin = yesterdayKpiResponse.revenue > 0 ? ((yesterdayProfit) / Number(yesterdayKpiResponse.revenue) * 100) : 0;
            
            // 计算利润增长率
            if (yesterdayProfit !== 0) {
              profitGrowth = ((todayProfit - yesterdayProfit) / Math.abs(yesterdayProfit)) * 100;
            }
            
            // 计算利润率增长率
            profitMarginGrowth = todayProfitMargin - yesterdayProfitMargin;
          } else if (kpiResponse) {
            // 团队长和组长从API响应中获取增长率数据
            profitMarginGrowth = kpiResponse.profitMarginGrowth || 0;
            profitGrowth = kpiResponse.profitGrowth || 0;
          }

          // 计算活跃用户增长率（今日 - 昨日）
          let activeUsersGrowth = 0;
          // 从API响应中获取增长率数据
          if (kpiResponse) {
            activeUsersGrowth = kpiResponse.activeUsersGrowth || 0;
          }

          // 为组长显示特定的组数据结构
          if (isGroupLeader) {
            // 计算组提成收益（使用提成比例计算）
            const commissionRate = currentUser?.commission || 0.12; // 默认12%
            const groupLeaderEarnings = userShare * commissionRate;
            
            // 计算单条平均金币
            const averageCoins = kpiResponse?.impressions > 0 ? (userShare * 1000) / Number(kpiResponse?.impressions) : 0;
            
            transformedKpis = [
              {
                title: '组提成收益',
                value: `¥${groupLeaderEarnings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                subValue: userShare > 0 ? `${((groupLeaderEarnings / userShare) * 100).toFixed(2)}%` : '0%',
                growth: showGrowth ? `${kpiResponse?.coinsGrowth > 0 ? '+' : ''}${kpiResponse?.coinsGrowth || 0}%` : '',
                isUp: kpiResponse?.coinsGrowth > 0,
                icon: Users,
                color: 'text-purple-600',
                bg: 'bg-purple-50'
              },
              {
                title: '团队用户收益',
                value: `¥${userShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                growth: showGrowth ? `${kpiResponse?.coinsGrowth > 0 ? '+' : ''}${kpiResponse?.coinsGrowth || 0}%` : '',
                isUp: kpiResponse?.coinsGrowth > 0,
                icon: Coins,
                color: 'text-orange-600',
                bg: 'bg-orange-50'
              },
              {
                title: '今日活跃用户',
                value: kpiResponse?.activeUsers?.toLocaleString() || '0',
                subValue: '0', // 暂时显示0，后续可以从API获取
                icon: TrendingUp,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50'
              },
              {
                title: '广告总曝光',
                value: kpiResponse?.impressions?.toLocaleString() || '0',
                growth: showGrowth ? `${kpiResponse?.impressionsGrowth > 0 ? '+' : ''}${kpiResponse?.impressionsGrowth || 0}%` : '',
                isUp: kpiResponse?.impressionsGrowth > 0,
                icon: Eye,
                color: 'text-blue-600',
                bg: 'bg-blue-50'
              },
              {
                title: '单条平均金币',
                value: `${averageCoins.toFixed(2)}`,
                growth: showGrowth ? `${kpiResponse?.ecpmGrowth > 0 ? '+' : ''}${kpiResponse?.ecpmGrowth || 0}%` : '',
                isUp: kpiResponse?.ecpmGrowth > 0,
                icon: Zap,
                color: 'text-yellow-600',
                bg: 'bg-yellow-50'
              }
            ];
          } else {
            // 为其他角色显示通用的KPI数据结构
            transformedKpis = [
              { title: `${timePrefix}利润`, value: `¥${todayProfit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${profitGrowth > 0 ? '+' : ''}${profitGrowth.toFixed(2)}%` : '', isUp: profitGrowth > 0, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { title: `${timePrefix}利润率`, value: `${todayProfitMargin.toFixed(2)}%`, growth: showGrowth ? `${profitMarginGrowth > 0 ? '+' : ''}${profitMarginGrowth.toFixed(2)}%` : '', isUp: profitMarginGrowth > 0, icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50' },
              { title: '业务总收入', value: `¥${Number(kpiResponse.revenue || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
              { title: '用户分成金额', value: `¥${(Number(kpiResponse.coins || 0) / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, subValue: `${kpiResponse.revenue > 0 ? ((Number(kpiResponse.coins || 0) / 1000 / Number(kpiResponse.revenue)) * 100).toFixed(2) : '0.00'}%`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
              { title: '广告总曝光', value: kpiResponse.impressions?.toLocaleString() || '0', growth: showGrowth ? `${kpiResponse.impressionsGrowth > 0 ? '+' : ''}${kpiResponse.impressionsGrowth || 0}%` : '', isUp: kpiResponse.impressionsGrowth > 0, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
              { title: '团队分成', value: `¥${(Number(kpiResponse.coins || 0) / 1000 * 0.2).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
              { title: `${timePrefix}平均 eCPM`, value: `${kpiResponse.ecpm || 0}`, growth: showGrowth ? `${kpiResponse.ecpmGrowth > 0 ? '+' : ''}${kpiResponse.ecpmGrowth || 0}%` : '', isUp: kpiResponse.ecpmGrowth > 0, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { title: `${timePrefix}活跃用户`, value: kpiResponse.activeUsers?.toLocaleString() || '0', growth: showGrowth ? `${activeUsersGrowth > 0 ? '+' : ''}${activeUsersGrowth.toFixed(2)}%` : '', isUp: activeUsersGrowth > 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
            ];
          }

          // 立即更新KPI数据，让用户看到初步结果
          setKpiData(transformedKpis);
        }
        
        // 3. 处理用户数据
        if (userResponse) {
          // Transform user data to match frontend format
          const userArray = typeof userResponse === 'object' && userResponse !== null && 'data' in userResponse && Array.isArray(userResponse.data) ? userResponse.data : Array.isArray(userResponse) ? userResponse : [];
          const transformedUsers: DashboardUser[] = userArray.map((user: any) => ({
            id: user.employeeId || user.userId || '',
            userId: user.userId || user.employeeId || '',
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


          // 团队长只显示自己团队的成员数据
          let filteredUsers = transformedUsers;
          
          if (isTeamLeader) {
            // 团队长只显示自己团队的成员数据
            const teamName = getUserTeamName();
            filteredUsers = transformedUsers.filter(user => {
              const userTeam = user.teamName || user.superior || '系统直属';
              return userTeam === teamName;
            });
          }
          
          // 显示所有用户，不限制数量
          setUserData(filteredUsers);
          
          // 5. 缓存数据
          const cacheTime = timeRange === TimeRange.TODAY ? 300000 : 600000; // 今日数据缓存5分钟，其他10分钟
          setCachedData(cacheKey, { kpiData: showKPIDashboard && kpiResponse ? transformedKpis : kpiData, userData: filteredUsers }, cacheTime);
        }
      } catch (error) {
        console.error('Error in parallel data fetching:', error);
        // 并行请求失败时，回退到串行请求
        // 1. 获取KPI数据
        let kpiResponse: any = null;
        let yesterdayKpiResponse: any = null;
        let userResponse: any = null;
        let yesterdayUserResponse: any = null;
        if (showKPIDashboard) {
          let kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}`;
          if (isGroupLeader) {
            const teamGroupId = currentUser.teamGroupId;
            kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
          }
          kpiResponse = await request<any>(kpiUrl, { method: 'GET' });

          // 如果是今日数据，同时获取昨日数据用于计算增长率
          if (timeRange === TimeRange.TODAY) {
            let yesterdayKpiUrl = `/admin/dashboard/kpi?range=yesterday`;
            if (isGroupLeader) {
              const teamGroupId = currentUser.teamGroupId;
              yesterdayKpiUrl = `/admin/dashboard/kpi?range=yesterday&group=${encodeURIComponent(teamGroupId || '')}`;
            }
            yesterdayKpiResponse = await request<any>(yesterdayKpiUrl, { method: 'GET' });
            setYesterdayKpiData(yesterdayKpiResponse);
          }

          // 处理KPI数据
          if (kpiResponse) {
            // Time prefix for dynamic titles
            const timePrefixMap: Record<string, string> = {
              [TimeRange.TODAY]: '今日',
              [TimeRange.YESTERDAY]: '昨日',
              [TimeRange.THIS_WEEK]: '本周',
              [TimeRange.THIS_MONTH]: '本月'
            };
            const timePrefix = timePrefixMap[timeRange];
            const showGrowth = timeRange === TimeRange.TODAY || timeRange === TimeRange.THIS_MONTH;

            // Transform KPI data to match frontend format
            const userShare = Number(kpiResponse.coins || 0) / 1000;
            const platformCost = userShare * 0.2;

            // 计算今日利润
            const todayProfit = Number(kpiResponse.revenue || 0) - userShare - platformCost;
            
            // 计算利润率
            const todayProfitMargin = kpiResponse.revenue > 0 ? ((todayProfit) / Number(kpiResponse.revenue) * 100) : 0;

            // 计算利润率增长率（今日 - 昨日）
            let profitMarginGrowth = 0;
            // 计算利润增长率（今日 - 昨日）
            let profitGrowth = 0;
            
            // 超管使用昨日数据计算增长率，团队长和组长保持不变
            if (isSuperAdmin && timeRange === TimeRange.TODAY && yesterdayKpiResponse) {
              const yesterdayUserShare = Number(yesterdayKpiResponse.coins || 0) / 1000;
              const yesterdayPlatformCost = yesterdayUserShare * 0.2;
              const yesterdayProfit = Number(yesterdayKpiResponse.revenue || 0) - yesterdayUserShare - yesterdayPlatformCost;
              const yesterdayProfitMargin = yesterdayKpiResponse.revenue > 0 ? ((yesterdayProfit) / Number(yesterdayKpiResponse.revenue) * 100) : 0;
              
              // 计算利润增长率
              if (yesterdayProfit !== 0) {
                profitGrowth = ((todayProfit - yesterdayProfit) / Math.abs(yesterdayProfit)) * 100;
              }
              
              // 计算利润率增长率
              profitMarginGrowth = todayProfitMargin - yesterdayProfitMargin;
            } else if (kpiResponse) {
              // 团队长和组长从API响应中获取增长率数据
              profitMarginGrowth = kpiResponse.profitMarginGrowth || 0;
              profitGrowth = kpiResponse.profitGrowth || 0;
            }

            // 计算活跃用户增长率（今日 - 昨日）
            let activeUsersGrowth = 0;
            // 从API响应中获取增长率数据
            if (kpiResponse) {
              activeUsersGrowth = kpiResponse.activeUsersGrowth || 0;
            }

            // 为组长显示特定的组数据结构
            if (isGroupLeader) {
              // 计算组提成收益（使用提成比例计算）
              const commissionRate = currentUser?.commission || 0.12; // 默认12%
              const groupLeaderEarnings = userShare * commissionRate;
              
              // 计算单条平均金币
              const averageCoins = kpiResponse?.impressions > 0 ? (userShare * 1000) / Number(kpiResponse?.impressions) : 0;
              
              transformedKpis = [
                {
                  title: '组提成收益',
                  value: `¥${groupLeaderEarnings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                  subValue: userShare > 0 ? `${((groupLeaderEarnings / userShare) * 100).toFixed(2)}%` : '0%',
                  growth: showGrowth ? `${kpiResponse?.coinsGrowth > 0 ? '+' : ''}${kpiResponse?.coinsGrowth || 0}%` : '',
                  isUp: kpiResponse?.coinsGrowth > 0,
                  icon: Users,
                  color: 'text-purple-600',
                  bg: 'bg-purple-50'
                },
                {
                  title: '团队用户收益',
                  value: `¥${userShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                  growth: showGrowth ? `${kpiResponse?.coinsGrowth > 0 ? '+' : ''}${kpiResponse?.coinsGrowth || 0}%` : '',
                  isUp: kpiResponse?.coinsGrowth > 0,
                  icon: Coins,
                  color: 'text-orange-600',
                  bg: 'bg-orange-50'
                },
                {
                  title: '今日活跃用户',
                  value: kpiResponse?.activeUsers?.toLocaleString() || '0',
                  subValue: '0', // 暂时显示0，后续可以从API获取
                  icon: TrendingUp,
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50'
                },
                {
                  title: '广告总曝光',
                  value: kpiResponse?.impressions?.toLocaleString() || '0',
                  growth: showGrowth ? `${kpiResponse?.impressionsGrowth > 0 ? '+' : ''}${kpiResponse?.impressionsGrowth || 0}%` : '',
                  isUp: kpiResponse?.impressionsGrowth > 0,
                  icon: Eye,
                  color: 'text-blue-600',
                  bg: 'bg-blue-50'
                },
                {
                  title: '单条平均金币',
                  value: `${averageCoins.toFixed(2)}`,
                  growth: showGrowth ? `${kpiResponse?.ecpmGrowth > 0 ? '+' : ''}${kpiResponse?.ecpmGrowth || 0}%` : '',
                  isUp: kpiResponse?.ecpmGrowth > 0,
                  icon: Zap,
                  color: 'text-yellow-600',
                  bg: 'bg-yellow-50'
                }
              ];
            } else {
              // 为其他角色显示通用的KPI数据结构
              transformedKpis = [
                { title: `${timePrefix}利润`, value: `¥${todayProfit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${profitGrowth > 0 ? '+' : ''}${profitGrowth.toFixed(2)}%` : '', isUp: profitGrowth > 0, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { title: `${timePrefix}利润率`, value: `${todayProfitMargin.toFixed(2)}%`, growth: showGrowth ? `${profitMarginGrowth > 0 ? '+' : ''}${profitMarginGrowth.toFixed(2)}%` : '', isUp: profitMarginGrowth > 0, icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50' },
                { title: '业务总收入', value: `¥${Number(kpiResponse.revenue || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
                { title: '用户分成金额', value: `¥${(Number(kpiResponse.coins || 0) / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, subValue: `${kpiResponse.revenue > 0 ? ((Number(kpiResponse.coins || 0) / 1000 / Number(kpiResponse.revenue)) * 100).toFixed(2) : '0.00'}%`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
                { title: '广告总曝光', value: kpiResponse.impressions?.toLocaleString() || '0', growth: showGrowth ? `${kpiResponse.impressionsGrowth > 0 ? '+' : ''}${kpiResponse.impressionsGrowth || 0}%` : '', isUp: kpiResponse.impressionsGrowth > 0, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
                { title: '团队分成', value: `¥${(Number(kpiResponse.coins || 0) / 1000 * 0.2).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                { title: `${timePrefix}平均 eCPM`, value: `${kpiResponse.ecpm || 0}`, growth: showGrowth ? `${kpiResponse.ecpmGrowth > 0 ? '+' : ''}${kpiResponse.ecpmGrowth || 0}%` : '', isUp: kpiResponse.ecpmGrowth > 0, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                { title: `${timePrefix}活跃用户`, value: kpiResponse.activeUsers?.toLocaleString() || '0', growth: showGrowth ? `${activeUsersGrowth > 0 ? '+' : ''}${activeUsersGrowth.toFixed(2)}%` : '', isUp: activeUsersGrowth > 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
              ];
            }

            setKpiData(transformedKpis);
          }
        }

        // 2. 获取用户数据
        let userUrl = `/admin/dashboard/users?range=${rangeParam}`;
        if (isGroupLeader) {
          const teamGroupId = currentUser.teamGroupId;
          userUrl = `/admin/dashboard/users?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
        } else if (isTeamLeader) {
          const teamName = getUserTeamName();
          userUrl = `/admin/dashboard/users?range=${rangeParam}&team=${encodeURIComponent(teamName)}`;
        }
        userResponse = await request<any[]>(userUrl, { method: 'GET' });

        // 如果是今日数据，同时获取昨日用户数据用于计算次数对比
        if (timeRange === TimeRange.TODAY) {
          let yesterdayUserUrl = `/admin/dashboard/users?range=yesterday`;
          if (isGroupLeader) {
            const teamGroupId = currentUser.teamGroupId;
            yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&group=${encodeURIComponent(teamGroupId || '')}`;
          } else if (isTeamLeader) {
            const teamName = getUserTeamName();
            yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}`;
          }
          yesterdayUserResponse = await request<any[]>(yesterdayUserUrl, { method: 'GET' });
          
          // 构建昨日用户数据映射
          const yesterdayUserMap: Record<string, number> = {};
          const yesterdayEarningsMap: Record<string, number> = {};

          if (yesterdayUserResponse?.data && Array.isArray(yesterdayUserResponse.data)) {
            yesterdayUserResponse.data.forEach((user: any) => {
              const userId = user.employeeId || user.userId || '';
              yesterdayUserMap[userId] = user.watched || 0;
              yesterdayEarningsMap[userId] = (user.earnings || 0) / 1000;
            });
          } else if (Array.isArray(yesterdayUserResponse)) {
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

        // 3. 处理用户数据
        if (userResponse) {
          console.log('[Dashboard] 获取到用户数据:', userResponse);
          // Transform user data to match frontend format
          const userArray = typeof userResponse === 'object' && userResponse !== null && 'data' in userResponse && Array.isArray(userResponse.data) ? userResponse.data : Array.isArray(userResponse) ? userResponse : [];
          console.log('[Dashboard] 转换后的用户数组:', userArray);
          const transformedUsers: DashboardUser[] = userArray.map((user: any) => ({
            id: user.employeeId || user.userId || '',
            userId: user.userId || user.employeeId || '',
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
          console.log('[Dashboard] 转换后的用户数据:', transformedUsers);


          // 团队长只显示自己团队的成员数据
          let filteredUsers = transformedUsers;
          
          if (isTeamLeader) {
            // 团队长只显示自己团队的成员数据
            const teamName = getUserTeamName();
            console.log('[Dashboard] 团队长过滤，teamName:', teamName);
            filteredUsers = transformedUsers.filter(user => {
              const userTeam = user.teamName || user.superior || '系统直属';
              console.log('[Dashboard] 检查用户团队:', user.name, userTeam);
              return userTeam === teamName;
            });
          }
          console.log('[Dashboard] 过滤后的用户数据:', filteredUsers);
          
          // 显示所有用户，不限制数量
          console.log('[Dashboard] 最终用户数据:', filteredUsers);
          setUserData(filteredUsers);
          
          // 4. 缓存数据
          const cacheTime = timeRange === TimeRange.TODAY ? 300000 : 600000; // 今日数据缓存5分钟，其他10分钟
          setCachedData(cacheKey, { 
            kpiData: showKPIDashboard && kpiResponse ? transformedKpis : kpiData, 
            userData: filteredUsers,
            // 缓存昨日数据
            yesterdayUserData: yesterdayUserMap,
            yesterdayEarningsData: yesterdayEarningsMap
          }, cacheTime);
          
          // 标记数据已加载，避免GroupLeader组件重复加载
          (window as any).dashboardDataLoaded = true;
        }
      }
      
      // 后台预加载其他时间范围的数据（不阻塞主流程）
      setTimeout(() => {
        preloadOtherTimeRanges();
      }, 100);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // 数据获取失败，保持数据为空，不显示模拟数据
      setKpiData([]);
      setUserData([]);
    } finally {
      // 无论是否为团队长，都需要设置loading为false
      // 因为团队长的loading状态也需要被重置
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
  }, [timeRange, currentUser, isTeamLeader, isGroupLeader, showKPIDashboard]);

  // 后台预加载其他时间范围的数据
  const preloadOtherTimeRanges = useCallback(async () => {
    if (!currentUser || !currentUser.token) return;
    
    // 所有时间范围
    const allTimeRanges = Object.values(TimeRange);
    // 排除当前时间范围
    const otherTimeRanges = allTimeRanges.filter(range => range !== timeRange);
    
    // 并行预加载所有其他时间范围的数据
    await Promise.all(
      otherTimeRanges.map(async (range) => {
        const rangeParam = timeRangeMap[range];
        const cacheKey = `${rangeParam}_${currentUser.id}`;
        
        // 检查是否已经有缓存
        if (getCachedData(cacheKey)) {
          return; // 已有缓存，跳过预加载
        }
        
        try {
          // 预加载KPI数据
          let kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}`;
          if (isGroupLeader) {
            const teamGroupId = currentUser.teamGroupId;
            kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
          }
          const kpiResponse = await request<any>(kpiUrl, { method: 'GET' });
          
          // 预加载用户数据
          let userUrl = `/admin/dashboard/users?range=${rangeParam}`;
          if (isGroupLeader) {
            const teamGroupId = currentUser.teamGroupId;
            userUrl = `/admin/dashboard/users?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
          } else if (isTeamLeader) {
            const teamName = getUserTeamName();
            userUrl = `/admin/dashboard/users?range=${rangeParam}&team=${encodeURIComponent(teamName)}`;
          }
          const userResponse = await request<any[]>(userUrl, { method: 'GET' });
          
          // 处理数据并缓存
          if (kpiResponse && userResponse) {
            // 转换KPI数据
            let transformedKpis: any[] = [];
            if (showKPIDashboard) {
              const timePrefixMap: Record<string, string> = {
                [TimeRange.TODAY]: '今日',
                [TimeRange.YESTERDAY]: '昨日',
                [TimeRange.THIS_WEEK]: '本周',
                [TimeRange.THIS_MONTH]: '本月'
              };
              const timePrefix = timePrefixMap[range];
              const showGrowth = range === TimeRange.TODAY || range === TimeRange.THIS_MONTH;

              const userShare = Number(kpiResponse.coins || 0) / 1000;
              const platformCost = userShare * 0.2;
              const todayProfit = Number(kpiResponse.revenue || 0) - userShare - platformCost;
              const todayProfitMargin = kpiResponse.revenue > 0 ? ((todayProfit) / Number(kpiResponse.revenue) * 100) : 0;

              if (isGroupLeader) {
                const commissionRate = currentUser?.commission || 0.12;
                const groupLeaderEarnings = userShare * commissionRate;
                const averageCoins = kpiResponse?.impressions > 0 ? (userShare * 1000) / Number(kpiResponse?.impressions) : 0;
                
                transformedKpis = [
                  {
                    title: '组提成收益',
                    value: `¥${groupLeaderEarnings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                    subValue: userShare > 0 ? `${((groupLeaderEarnings / userShare) * 100).toFixed(2)}%` : '0%',
                    growth: showGrowth ? `${kpiResponse?.coinsGrowth > 0 ? '+' : ''}${kpiResponse?.coinsGrowth || 0}%` : '',
                    isUp: kpiResponse?.coinsGrowth > 0,
                    icon: Users,
                    color: 'text-purple-600',
                    bg: 'bg-purple-50'
                  },
                  {
                    title: '团队用户收益',
                    value: `¥${userShare.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                    growth: showGrowth ? `${kpiResponse?.coinsGrowth > 0 ? '+' : ''}${kpiResponse?.coinsGrowth || 0}%` : '',
                    isUp: kpiResponse?.coinsGrowth > 0,
                    icon: Coins,
                    color: 'text-orange-600',
                    bg: 'bg-orange-50'
                  },
                  {
                    title: '今日活跃用户',
                    value: kpiResponse?.activeUsers?.toLocaleString() || '0',
                    subValue: '0',
                    icon: TrendingUp,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50'
                  },
                  {
                    title: '广告总曝光',
                    value: kpiResponse?.impressions?.toLocaleString() || '0',
                    growth: showGrowth ? `${kpiResponse?.impressionsGrowth > 0 ? '+' : ''}${kpiResponse?.impressionsGrowth || 0}%` : '',
                    isUp: kpiResponse?.impressionsGrowth > 0,
                    icon: Eye,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50'
                  },
                  {
                    title: '单条平均金币',
                    value: `${averageCoins.toFixed(2)}`,
                    growth: showGrowth ? `${kpiResponse?.ecpmGrowth > 0 ? '+' : ''}${kpiResponse?.ecpmGrowth || 0}%` : '',
                    isUp: kpiResponse?.ecpmGrowth > 0,
                    icon: Zap,
                    color: 'text-yellow-600',
                    bg: 'bg-yellow-50'
                  }
                ];
              } else {
                transformedKpis = [
                  { title: `${timePrefix}利润`, value: `¥${todayProfit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { title: `${timePrefix}利润率`, value: `${todayProfitMargin.toFixed(2)}%`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50' },
                  { title: '业务总收入', value: `¥${Number(kpiResponse.revenue || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
                  { title: '用户分成金额', value: `¥${(Number(kpiResponse.coins || 0) / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, subValue: `${kpiResponse.revenue > 0 ? ((Number(kpiResponse.coins || 0) / 1000 / Number(kpiResponse.revenue)) * 100).toFixed(2) : '0.00'}%`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { title: '广告总曝光', value: kpiResponse.impressions?.toLocaleString() || '0', growth: showGrowth ? `${kpiResponse.impressionsGrowth > 0 ? '+' : ''}${kpiResponse.impressionsGrowth || 0}%` : '', isUp: kpiResponse.impressionsGrowth > 0, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { title: '团队分成', value: `¥${(Number(kpiResponse.coins || 0) / 1000 * 0.2).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { title: `${timePrefix}平均 eCPM`, value: `${kpiResponse.ecpm || 0}`, growth: showGrowth ? `${kpiResponse.ecpmGrowth > 0 ? '+' : ''}${kpiResponse.ecpmGrowth || 0}%` : '', isUp: kpiResponse.ecpmGrowth > 0, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                  { title: `${timePrefix}活跃用户`, value: kpiResponse.activeUsers?.toLocaleString() || '0', growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
                ];
              }
            }
            
            // 转换用户数据
            const userArray = typeof userResponse === 'object' && userResponse !== null && 'data' in userResponse && Array.isArray(userResponse.data) ? userResponse.data : Array.isArray(userResponse) ? userResponse : [];
            const transformedUsers: DashboardUser[] = userArray.map((user: any) => ({
              id: user.employeeId || user.userId || '',
              userId: user.employeeId || user.userId || '',
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

            // 过滤用户数据
            let filteredUsers = transformedUsers;
            if (isGroupLeader) {
              const teamGroupId = currentUser?.teamGroupId;
              if (teamGroupId) {
                filteredUsers = transformedUsers.filter(user => user.teamGroupId === teamGroupId);
              } else {
                filteredUsers = [];
              }
            } else if (isTeamLeader) {
              const teamName = getUserTeamName();
              filteredUsers = transformedUsers.filter(user => {
                const userTeam = user.teamName || user.superior || '系统直属';
                return userTeam === teamName;
              });
            }
            
            const finalUsers = filteredUsers.slice(0, 30);
            
            // 如果是今日数据，同时预加载昨日数据
            if (range === TimeRange.TODAY) {
              try {
                // 预加载昨日KPI数据
                let yesterdayKpiUrl = `/admin/dashboard/kpi?range=yesterday`;
                if (isGroupLeader) {
                  const teamGroupId = currentUser.teamGroupId;
                  yesterdayKpiUrl = `/admin/dashboard/kpi?range=yesterday&group=${encodeURIComponent(teamGroupId || '')}`;
                }
                const yesterdayKpiResponse = await request<any>(yesterdayKpiUrl, { method: 'GET' });
                
                // 预加载昨日用户数据
                let yesterdayUserUrl = `/admin/dashboard/users?range=yesterday`;
                if (isGroupLeader) {
                  const teamGroupId = currentUser.teamGroupId;
                  yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&group=${encodeURIComponent(teamGroupId || '')}`;
                } else if (isTeamLeader) {
                  const teamName = getUserTeamName();
                  yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}`;
                }
                const yesterdayUserResponse = await request<any>(yesterdayUserUrl, { method: 'GET' });
                
                // 构建昨日用户数据映射
                let yesterdayUserMap: Record<string, number> = {};
                let yesterdayEarningsMap: Record<string, number> = {};
                
                if (yesterdayUserResponse && !Array.isArray(yesterdayUserResponse) && yesterdayUserResponse.data && Array.isArray(yesterdayUserResponse.data)) {
                  yesterdayUserResponse.data.forEach((user: any) => {
                    const userId = user.userId || user.employeeId || '';
                    yesterdayUserMap[userId] = user.watched || 0;
                    yesterdayEarningsMap[userId] = (user.earnings || 0) / 1000;
                  });
                } else if (Array.isArray(yesterdayUserResponse)) {
                  yesterdayUserResponse.forEach((user: any) => {
                    const userId = user.userId || user.employeeId || '';
                    yesterdayUserMap[userId] = user.watched || 0;
                    yesterdayEarningsMap[userId] = (user.earnings || 0) / 1000;
                  });
                }
                
                // 缓存数据，包含昨日数据
                const cacheTime = 300000; // 今日数据缓存5分钟
                setCachedData(cacheKey, { 
                  kpiData: transformedKpis, 
                  userData: finalUsers,
                  yesterdayUserData: yesterdayUserMap,
                  yesterdayEarningsData: yesterdayEarningsMap
                }, cacheTime);
                
                // 如果当前时间范围就是今日，更新组件的昨日数据状态
                if (timeRange === TimeRange.TODAY) {
                  setYesterdayUserData(yesterdayUserMap);
                  setYesterdayEarningsData(yesterdayEarningsMap);
                  yesterdayUserDataRef.current = yesterdayUserMap;
                }
              } catch (error) {
                console.error('Error preloading yesterday data:', error);
                // 即使预加载昨日数据失败，也缓存今日数据
                const cacheTime = 300000; // 今日数据缓存5分钟
                setCachedData(cacheKey, { kpiData: transformedKpis, userData: finalUsers }, cacheTime);
              }
            } else {
              // 非今日数据，直接缓存
              const cacheTime = 600000; // 其他时间范围数据缓存10分钟
              setCachedData(cacheKey, { kpiData: transformedKpis, userData: finalUsers }, cacheTime);
            }
          }
        } catch (error) {
          console.error(`Error preloading ${range} data:`, error);
        }
      })
    );
    
    // 预加载完整用户列表数据（用于查看全部用户功能）
    try {
      const userListCacheKey = `user_list_today_${currentUser.id}`;
      
      // 检查是否已经有缓存
      if (getCachedData(userListCacheKey)) {
        return; // 已有缓存，跳过预加载
      }
      
      // 构建完整用户列表API路径
      let userListUrl = `/admin/dashboard/users?range=today&limit=1000`;
      if (isTeamLeader) {
        const teamName = getUserTeamName();
        userListUrl = `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&limit=1000`;
      } else if (isGroupLeader) {
        const teamGroupId = currentUser.teamGroupId;
        const teamName = currentUser.teamName || '团队';
        userListUrl = `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&group=${encodeURIComponent(teamGroupId || '')}&limit=1000`;
      }
      
      // 获取完整用户数据
      const userListResponse = await request<any[]>(userListUrl).catch(error => {
        console.error('获取完整用户列表失败:', error);
        return [];
      });
      
      // 处理用户数据
      const users = Array.isArray(userListResponse) ? userListResponse : [];
      
      // 过滤用户数据
      let filteredUsers = users;
      if (isTeamLeader) {
        const teamName = getUserTeamName();
        filteredUsers = users.filter((user: any) => {
          const userTeam = user.teamName || user.superior || '系统直属';
          return userTeam === teamName;
        });
      } else if (isGroupLeader) {
        const teamGroupId = currentUser?.teamGroupId;
        if (teamGroupId) {
          filteredUsers = users.filter((user: any) => {
            const userTeamGroupId = user.teamGroupId || user.groupId || '';
            return userTeamGroupId === teamGroupId;
          });
        } else {
          filteredUsers = [];
        }
      }
      
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
        let yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&limit=1000`;
        if (isTeamLeader) {
          const teamName = getUserTeamName();
          yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&limit=1000`;
        } else if (isGroupLeader) {
          const teamGroupId = currentUser.teamGroupId;
          const teamName = currentUser.teamName || '团队';
          yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&group=${encodeURIComponent(teamGroupId || '')}&limit=1000`;
        }
        
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
          yesterdayEarningsData[userId] = user.earnings || 0;
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
    
    // 预加载"我的"页面数据
    try {
      const myCacheKey = `my_data_${currentUser.id}`;
      
      // 检查是否已经有缓存
      if (getCachedData(myCacheKey)) {
        // 已有缓存，跳过预加载
      } else {
        console.log('[Dashboard] 开始预加载"我的"页面数据');
        
        // 构建"我的"页面数据API路径
        const myDataUrl = `/admin/account/profile`;
        
        // 获取"我的"页面数据
        const myDataResponse = await request<any>(myDataUrl, {
          method: 'GET'
        }).catch(() => null);
        
        // 缓存"我的"页面数据
        setCachedData(myCacheKey, {
          profile: myDataResponse || {}
        });
        
        // 同时缓存到全局缓存管理服务
        cacheManager.set(myCacheKey, {
          profile: myDataResponse || {}
        });
        
        console.log('[Dashboard] "我的"页面数据已缓存');
      }
    } catch (error) {
      console.error('[Dashboard] 预加载"我的"页面数据失败:', error);
    }
    
    // 预加载新人页面数据
    try {
      const newUsersCacheKey = `new_users_${currentUser.id}`;
      
      // 检查是否已经有缓存
      const existingCache = getCachedData(newUsersCacheKey);
      console.log('[Dashboard] 检查新人缓存，键:', newUsersCacheKey, '已有缓存:', !!existingCache);
      
      if (existingCache) {
        console.log('[Dashboard] 新人缓存已存在，跳过预加载');
        // 已有缓存，跳过预加载
      } else {
        console.log('[Dashboard] 开始预加载新人数据');
        const teamName = currentUser?.teamName || '';
        const teamId = currentUser?.id || '';
        
        let newUsersUrl = '/user/new-users?days=15';
        
        // 团队长添加团队筛选参数
        if (isTeamLeader) {
          if (teamId) {
            newUsersUrl += `&teamId=${encodeURIComponent(teamId)}`;
          } else if (teamName) {
            newUsersUrl += `&team=${encodeURIComponent(teamName)}`;
          }
        }
        
        // 构建今日详细数据API URL
        const todayDataUrl = isTeamLeader
          ? `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&limit=1000`
          : '/admin/dashboard/users?range=today&limit=1000';
        
        // 构建昨日详细数据API URL
        const yesterdayDataUrl = isTeamLeader
          ? `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&limit=1000`
          : '/admin/dashboard/users?range=yesterday&limit=1000';
        
        // 并行请求新人数据和今日、昨日数据
        const [newUsersResponse, todayDataResponse, yesterdayDataResponse] = await Promise.all([
          request<any>(newUsersUrl, { method: 'GET' }).catch(() => []),
          request<any>(todayDataUrl, { method: 'GET' }).catch(() => []),
          request<any>(yesterdayDataUrl, { method: 'GET' }).catch(() => [])
        ]);
        
        // 构建今日详细数据映射
        const todayDataMap: Record<string, any> = {};
        if (Array.isArray(todayDataResponse)) {
          todayDataResponse.forEach((user: any) => {
            const userId = user.userId || user.employeeId || '';
            if (userId) {
              todayDataMap[userId] = user;
            }
          });
        }
        
        // 处理昨日数据
        const yesterdayUserDataMap: Record<string, number> = {};
        const yesterdayEarningsDataMap: Record<string, number> = {};
        if (Array.isArray(yesterdayDataResponse)) {
          yesterdayDataResponse.forEach((user: any) => {
            const userId = user.userId || user.employeeId || '';
            if (userId) {
              yesterdayUserDataMap[userId] = user.watched || 0;
              yesterdayEarningsDataMap[userId] = user.earnings || 0;
            }
          });
        }
        
        // 转换用户数据
        const list = Array.isArray(newUsersResponse) ? newUsersResponse : [];
        const now = new Date();
        const currentTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
        const transformedUsers: NewUser[] = list.map((user: any) => {
          const userId = user.employeeId || user.userId || '';
          const todayData = todayDataMap[userId] || {};
          // 确保使用UTC时间计算注册时间戳
          const registerTime = user.registerTime ? new Date(user.registerTime).getTime() : currentTime;
          const regDays = Math.ceil((currentTime - registerTime) / (1000 * 60 * 60 * 24)) || 1;
          
          return {
            id: userId,
            userId: user.employeeId || user.userId || '',
            name: user.realName || user.realname || user.name || user.username || user.userName || userId,
            avatar: '',
            watched: todayData.watched || 0,
            earnings: (todayData.earnings || 0) / 1000,
            ipCount: todayData.ipCount || 1,
            deviceCount: todayData.deviceCount || 1,
            ecpm: todayData.ecpm || 0,
            regDays: regDays,
            superior: user.superior || user.teamName || '系统直属',
            groupName: user.groupName || user.teamGroup || '',
            groupLeaderName: user.groupLeaderName || '',
            isOnline: (todayData.watched || 0) > 0
          };
        });
        
        // 缓存新人数据到本地缓存
        setCachedData(newUsersCacheKey, {
          users: transformedUsers,
          yesterdayUserData: yesterdayUserDataMap,
          yesterdayEarningsData: yesterdayEarningsDataMap
        });
        
        // 同时缓存到全局缓存管理服务
        cacheManager.set(newUsersCacheKey, {
          users: transformedUsers,
          yesterdayUserData: yesterdayUserDataMap,
          yesterdayEarningsData: yesterdayEarningsDataMap
        }); // 全局缓存默认5分钟
        console.log('[Dashboard] 新人数据已缓存，用户数:', transformedUsers.length);
      }
    } catch (error) {
      console.error('[Dashboard] 预加载新人数据失败:', error);
    }
    
    // 预加载团队页面数据
    try {
      const teamsCacheKey = `teams_${currentUser.id}`;
      
      // 检查是否已经有缓存
      if (getCachedData(teamsCacheKey)) {
        // 已有缓存，跳过预加载
      } else {
        // 获取团队数据
        const teamsData = await request<any[]>('/admin/dashboard/team-leader/teams', {
          method: 'GET'
        }).catch(() => []);
        
        // 缓存团队数据到本地缓存
        setCachedData(teamsCacheKey, {
          teams: teamsData || []
        });
        
        // 同时缓存到全局缓存管理服务
        cacheManager.set(teamsCacheKey, {
          teams: teamsData || []
        });
      }
    } catch (error) {
      console.error('Error preloading teams data:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, currentUser, isTeamLeader, isGroupLeader, showKPIDashboard]);

  useEffect(() => {
    // 只有当currentUser存在时才加载数据
    if (currentUser) {
      // 标记Dashboard组件已设置自动刷新
      (window as any).dashboardAutoRefresh = true;
      
      // 初始加载数据，强制刷新，不使用缓存
      fetchData(true);
      
      // 设置自动刷新定时器，每60秒刷新一次，使用静默刷新模式
      const interval = setInterval(() => {
        // 静默刷新：不显示刷新动画，只更新缓存
        fetchData(true);
      }, 60000);
      
      // 清理函数
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, currentUser, fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const kpis = kpiData;

  // 使用useMemo缓存排序结果，避免每次渲染都重新排序
  const sortedUsers = useMemo(() => {
    // 先过滤用户数据
    let filteredUsers = userData;
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filteredUsers = userData.filter(user => {
        // 按用户ID或昵称过滤
        return user.id.toLowerCase().includes(keyword) || 
               user.name.toLowerCase().includes(keyword);
      });
    }
    
    // 然后排序
    const sorted = [...filteredUsers].sort((a, b) => {
      if (sortBy === 'agc') {
        const agcA = a.watched > 0 ? (a.earnings * 1000) / a.watched : 0;
        const agcB = b.watched > 0 ? (b.earnings * 1000) / b.watched : 0;
        return agcB - agcA;
      }
      return b[sortBy] - a[sortBy];
    });
    
    // 超管和团队长只显示TOP30，组长显示所有
    if (!isGroupLeader) {
      return sorted.slice(0, 30);
    }
    return sorted;
  }, [userData, sortBy, searchKeyword, isGroupLeader]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFB]">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* 显示头部标题和时间切换栏 */}
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{isTeamLeader ? '团队数据' : isGroupLeader ? '团队数据' : '数据总览'}</h1>
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
              onClick={() => {
                // 将TimeRange枚举值转换为对应的字符串
                const rangeMap: Record<string, string> = {
                  '今日': 'today',
                  '昨日': 'yesterday',
                  '本周': 'week',
                  '本月': 'month'
                };
                const newTimeRange = rangeMap[range] || 'today';
                // 调用传入的onTimeRangeChange函数
                onTimeRangeChange?.(newTimeRange);
              }}
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
        {/* 团队长显示专用数据看板，组长显示团队模块的数据看板，超级管理员显示完整数据看板 */}
        {isTeamLeader ? (
          <TeamLeaderDashboard 
            timeRange={timeRange} 
            onRefresh={handleRefresh} 
            onDataLoaded={() => setLoading(false)}
          />
        ) : isGroupLeader ? (
          <GroupLeader 
            timeRange={timeRange} 
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
            {isGroupLeader && (
                <div className="p-4">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="按用户 ID 或昵称快速查找..." 
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                            <Search size={16} />
                        </div>
                    </div>
                </div>
            )}
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-sm font-bold text-gray-900 flex items-center">
                    <Users size={16} className="mr-2 text-[#1E40AF]" />
                    {isTeamLeader ? '成员实时表现' : '用户实时表现'}
                    {!isGroupLeader && <span className="ml-2 px-2 py-0.5 bg-[#1E40AF] text-white text-[9px] rounded-full shadow-sm">Top 30</span>}
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
                      onClick={() => {
                        // 保存当前滚动位置
                        sessionStorage.setItem('dashboard_scroll_position', String(window.scrollY));
                        onSelectUser?.(user);
                      }}
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
                                                <span className={`text-[11px] font-black ${isGroupLeader ? (user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900') : user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${isGroupLeader ? (user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900') : user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                        </>
                                    ) : sortBy === 'watched' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
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
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
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
            
            {!isGroupLeader && (
              <button 
                onClick={() => {
                  // 保存当前滚动位置
                  sessionStorage.setItem('dashboard_scroll_position', String(window.scrollY));
                  onViewAllUsers?.();
                }}
                className="w-full py-3 bg-gray-50 text-[11px] font-bold text-gray-500 hover:text-[#1E40AF] border-t border-gray-50 transition-colors"
              >
                  查看全部用户
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
