
import React, { useState, useEffect, useCallback } from 'react';
import { TimeRange, KPIStats, User } from '../types';
import { 
  TrendingUp, TrendingDown, Eye, MousePointer2, Coins, 
  Wallet, BarChart3, Percent, ChevronRight, Globe, Smartphone, Zap, Users,
  Trophy, Medal, Crown, RefreshCw
} from 'lucide-react';
import { request } from '../services/api';

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
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.TODAY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'ecpm'>('earnings');
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [userData, setUserData] = useState<DashboardUser[]>([]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const timeRangeMap: Record<string, string> = {
        [TimeRange.TODAY]: 'today',
        [TimeRange.YESTERDAY]: 'yesterday',
        [TimeRange.THIS_WEEK]: 'week',
        [TimeRange.THIS_MONTH]: 'month'
      };
      const rangeParam = timeRangeMap[timeRange];

      // Fetch KPI data
      const kpiResponse = await request<any>(`/dashboard/kpi?range=${rangeParam}`, {
        method: 'GET',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });

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
      const transformedKpis = [
        { title: `${timePrefix}利润`, value: `¥${(Number(kpiResponse.revenue || 0) - Number(kpiResponse.coins || 0) / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { title: `${timePrefix}利润率`, value: `${kpiResponse.revenue > 0 ? ((Number(kpiResponse.revenue || 0) - Number(kpiResponse.coins || 0) / 1000) / Number(kpiResponse.revenue) * 100).toFixed(2) : '0.00'}%`, growth: showGrowth ? `${kpiResponse.profitMarginGrowth > 0 ? '+' : ''}${kpiResponse.profitMarginGrowth || 0}%` : '', isUp: kpiResponse.profitMarginGrowth > 0, icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50' },
        { title: '业务总收入', value: `¥${Number(kpiResponse.revenue || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, growth: showGrowth ? `${kpiResponse.revenueGrowth > 0 ? '+' : ''}${kpiResponse.revenueGrowth || 0}%` : '', isUp: kpiResponse.revenueGrowth > 0, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
          { title: '用户分成金额', value: `¥${(Number(kpiResponse.coins || 0) / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, subValue: `${kpiResponse.revenue > 0 ? ((Number(kpiResponse.coins || 0) / 1000 / Number(kpiResponse.revenue)) * 100).toFixed(2) : '0.00'}%`, growth: showGrowth ? `${kpiResponse.coinsGrowth > 0 ? '+' : ''}${kpiResponse.coinsGrowth || 0}%` : '', isUp: kpiResponse.coinsGrowth > 0, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
        { title: '广告总曝光', value: kpiResponse.impressions?.toLocaleString() || '0', growth: showGrowth ? `${kpiResponse.impressionsGrowth > 0 ? '+' : ''}${kpiResponse.impressionsGrowth || 0}%` : '', isUp: kpiResponse.impressionsGrowth > 0, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
        { title: '广告总点击', value: kpiResponse.clicks?.toLocaleString() || '0', subValue: kpiResponse.impressions > 0 ? `${((kpiResponse.clicks || 0) / kpiResponse.impressions * 100).toFixed(2)}%` : '0.00%', growth: showGrowth ? `${kpiResponse.clicksGrowth > 0 ? '+' : ''}${kpiResponse.clicksGrowth || 0}%` : '', isUp: kpiResponse.clicksGrowth > 0, icon: MousePointer2, color: 'text-purple-600', bg: 'bg-purple-50' },
        { title: `${timePrefix}平均 eCPM`, value: `${kpiResponse.ecpm || 0}`, growth: showGrowth ? `${kpiResponse.ecpmGrowth > 0 ? '+' : ''}${kpiResponse.ecpmGrowth || 0}%` : '', isUp: kpiResponse.ecpmGrowth > 0, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { title: `${timePrefix}活跃用户`, value: kpiResponse.activeUsers?.toLocaleString() || '0', growth: showGrowth ? `${kpiResponse.activeUsersGrowth > 0 ? '+' : ''}${kpiResponse.activeUsersGrowth || 0}%` : '', isUp: kpiResponse.activeUsersGrowth > 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
      ];

      setKpiData(transformedKpis);

      // Fetch user data
      const userResponse = await request<any[]>(`/dashboard/users?range=${rangeParam}`, {
        method: 'GET',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });

      // Transform user data to match frontend format
      const transformedUsers: DashboardUser[] = userResponse.map((user: any) => ({
        id: user.employeeId || user.userId || '',
        userId: user.userId || '',
        name: user.userId || user.employeeId || '',
        avatar: '',
        watched: user.watched || 0,
        earnings: (user.earnings || 0) / 1000,
        ipCount: user.ipCount || 1,
        deviceCount: user.deviceCount || 1,
        ecpm: user.ecpm || 0,
        trend: 'up' as const,
        superior: user.superior || '系统直属',
        regDays: user.regDays || 1
      }));

      setUserData(transformedUsers);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to mock data on error
      setKpiData([
        { title: '今日利润', value: '¥32,651', growth: '+5.4%', isUp: true, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { title: '今日利润率', value: '67.6%', growth: '+1.2%', isUp: true, icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50' },
        { title: '业务总收入', value: '¥48,291', growth: '+8.1%', isUp: true, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
        { title: '用户分成金额', value: '¥15,640', growth: '+18.2%', isUp: true, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
        { title: '广告总曝光', value: '1,284,092', growth: '+12.5%', isUp: true, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
        { title: '广告总点击', value: '84,321', growth: '-2.4%', isUp: false, icon: MousePointer2, color: 'text-purple-600', bg: 'bg-purple-50' },
        { title: '今日平均 eCPM', value: '142.5', growth: '+4.2%', isUp: true, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { title: '今日活跃用户', value: '4,892', growth: '+2.1%', isUp: true, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
      ]);
      setUserData(mockDashboardUsers);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const kpis = kpiData;

  const sortedUsers = [...(userData.length > 0 ? userData : mockDashboardUsers)].sort((a, b) => b[sortBy] - a[sortBy]);

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
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">数据总览</h1>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-2 p-1.5 bg-blue-50 rounded-lg text-[#1E40AF] hover:bg-blue-100 transition-colors disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="p-1 bg-green-50 rounded-full flex items-center px-2 text-green-600 text-[10px] font-bold">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
            实时更新中
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {Object.values(TimeRange).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                timeRange === range ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((kpi: any, idx) => {
            const Icon = kpi.icon;
            const rawValue = kpi.title.includes('eCPM') ? parseFloat(kpi.value) : 0;
            
            return (
              <div key={idx} className="bg-white p-4 rounded-xl border border-gray-50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon size={18} className={kpi.color} />
                  </div>
                  {kpi.growth && (
                    <div className={`text-[9px] font-bold flex items-center ${kpi.isUp ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {kpi.isUp ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />}
                      {kpi.growth}
                    </div>
                  )}
                </div>
                <div className="text-gray-500 text-[10px] font-medium mb-1 uppercase tracking-wider">{kpi.title}</div>
                <div className={`text-base font-bold leading-none ${
                    kpi.title.includes('eCPM') 
                        ? (rawValue >= 150 ? 'text-[#10B981]' : 'text-[#EF4444]') 
                        : 'text-gray-900'
                }`}>
                    {kpi.value}
                    {kpi.subValue && (
                      <span className={`ml-1.5 text-[10px] font-bold ${
                        kpi.title === '广告总点击' 
                          ? (parseFloat(kpi.subValue) >= 70 ? 'text-[#10B981]' : 'text-[#EF4444]')
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

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center">
                    用户实时表现 
                    <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-[#1E40AF] text-[9px] rounded-full">Top 10</span>
                </h3>
                <div className="flex bg-gray-50 p-1 rounded-lg">
                    <button 
                        onClick={() => setSortBy('ecpm')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortBy === 'ecpm' ? 'bg-[#1E40AF] text-white' : 'text-gray-400'}`}
                    >
                        按eCPM
                    </button>
                    <button 
                        onClick={() => setSortBy('watched')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortBy === 'watched' ? 'bg-[#1E40AF] text-white' : 'text-gray-400'}`}
                    >
                        按次数
                    </button>
                    <button 
                        onClick={() => setSortBy('earnings')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortBy === 'earnings' ? 'bg-[#1E40AF] text-white' : 'text-gray-400'}`}
                    >
                        按收益
                    </button>
                </div>
            </div>
            
            <div className="divide-y divide-gray-50">
                {sortedUsers.map((user, idx) => (
                    <div 
                      key={user.id} 
                      className="p-4 space-y-3 active:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onSelectUser?.(user)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 flex items-center justify-center text-gray-900 text-xs font-bold">
                                        {user.id}
                                    </div>
                                    
                                    {idx === 0 && (
                                        <div className="absolute -top-3 -left-2.5 text-yellow-500 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.2)] transform -rotate-12">
                                            <Crown size={16} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    {idx === 1 && (
                                        <div className="absolute -top-3 -left-2.5 text-slate-400 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] transform -rotate-12">
                                            <Crown size={16} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    {idx === 2 && (
                                        <div className="absolute -top-3 -left-2.5 text-amber-700 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] transform -rotate-12">
                                            <Crown size={16} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}

                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white ${
                                        idx === 0 ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-200'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center space-x-2">
                                        {user.regDays <= 15 && (
                                            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1 rounded border border-emerald-100 uppercase leading-tight flex-shrink-0">新人</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium tracking-tight flex items-center space-x-1.5 overflow-hidden">
                                        <span className="text-[#1E40AF] font-bold truncate">团队: {user.superior || '无'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 flex-shrink-0">
                                <div className="text-right flex flex-col space-y-0.5">
                                    {sortBy === 'earnings' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-[#1E40AF]">¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-gray-900">{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                        </>
                                    ) : sortBy === 'watched' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-[#1E40AF]">{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-gray-500">¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.ecpm >= 100 ? 'text-green-600' : 'text-red-500'}`}>{user.ecpm.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">eCPM</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-gray-500">¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <ChevronRight size={14} className="text-gray-300" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-1">
                            <div className="flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100/50">
                                <Globe size={10} className="text-blue-500" />
                                <span className="text-[9px] text-gray-400 font-medium">IP:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.ipCount}</span>
                            </div>
                            <div className="flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100/50">
                                <Smartphone size={10} className="text-purple-500" />
                                <span className="text-[9px] text-gray-400 font-medium">设备:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.deviceCount}</span>
                            </div>
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border ml-auto ${sortBy === 'ecpm' ? 'bg-blue-600 border-blue-600' : 'bg-blue-50/30 border-blue-100/30'}`}>
                                <Zap size={10} className={sortBy === 'ecpm' ? 'text-white' : 'text-orange-500'} />
                                <span className={`text-[9px] font-medium uppercase tracking-tighter ${sortBy === 'ecpm' ? 'text-white/80' : 'text-gray-400'}`}>eCPM:</span>
                                <span className={`text-[10px] font-black ${sortBy === 'ecpm' ? 'text-white' : (user.ecpm >= 100 ? 'text-green-600' : 'text-red-500')}`}>{user.ecpm.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <button 
              onClick={onViewAllUsers}
              className="w-full py-3 bg-gray-50 text-[11px] font-bold text-gray-500 hover:text-[#1E40AF] border-t border-gray-50 transition-colors"
            >
                查看全部活跃用户
            </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
