import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  Coins, Eye, Zap, Users, BarChart3, 
  TrendingUp, TrendingDown, Clock, RefreshCw
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { cacheManager } from '../services/cacheManager';
import { UserRole, TimeRange } from '../types';

interface GroupLeaderProps {
  timeRange: string;
  onRefresh: () => void;
}

const GroupLeader: React.FC<GroupLeaderProps> = ({ timeRange, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiData, setKpiData] = useState<any[]>([]);
  // 时间范围映射
  const timeRangeMap: Record<string, string> = {
    '今日': 'today',
    '昨日': 'yesterday',
    '本周': 'week',
    '本月': 'month'
  };
  
  // 使用映射后的时间范围
  const [localTimeRange, setLocalTimeRange] = useState<string>(timeRangeMap[timeRange] || 'today');
  
  // 使用 useMemo 缓存 currentUser，避免每次渲染都返回新对象
  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  
  // 获取缓存数据
  const getCachedData = useCallback((key: string) => {
    // 为不同时间范围设置不同的缓存时间
    const cacheTime = key.includes('today') ? 300000 : 600000; // 今日数据5分钟，其他10分钟
    return cacheManager.get(key, cacheTime);
  }, []);
  
  // 设置缓存数据
  const setCachedData = useCallback((key: string, data: any) => {
    cacheManager.set(key, data);
  }, []);
  
  // 监听timeRange变化
  useEffect(() => {
    setLocalTimeRange(timeRangeMap[timeRange] || 'today');
  }, [timeRange]);
  
  // 监听localTimeRange变化，重新加载数据
  useEffect(() => {
    // 延迟调用，确保fetchData已经定义
    setTimeout(() => {
      fetchData();
    }, 0);
  }, [localTimeRange]);
  
  // 获取用户对应的团队和组信息
  const getUserGroupInfo = () => {
    return {
      teamName: currentUser?.teamName || '团队',
      groupName: currentUser?.groupName || '组',
      groupId: currentUser?.teamGroupId || ''
    };
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      const cacheKey = `${localTimeRange}_${currentUser?.id || 'unknown'}`;
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setKpiData(cachedData);
        setLoading(false);
        // 后台预加载其他时间范围的数据（不阻塞主流程）
        setTimeout(() => {
          preloadOtherTimeRanges();
        }, 100);
        return;
      }
      setLoading(true);
    }

    try {
      if (!currentUser) {
        throw new Error('用户未登录');
      }

      const apiUrl = `/group-leader/stats?range=${localTimeRange}`;
      console.log('正在请求组长数据:', apiUrl);
      const data = await request<any>(apiUrl, { method: 'GET' });
      console.log('组长数据API返回:', data);

      if (data) {
        const transformedKpis = [
          {
            title: '组提成收益',
            value: `¥${(data.totalCommission || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
            icon: Users,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            ...(localTimeRange === 'today' && {
              growth: data.commissionGrowthRate ? `${data.commissionGrowthRate.toFixed(2)}%` : undefined,
              isUp: data.commissionGrowthRate > 0
            })
          },
          {
            title: '本组业绩金额',
            value: `¥${(data.totalEarnings || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
            icon: Coins,
            color: 'text-green-600',
            bg: 'bg-green-50',
            ...(localTimeRange === 'today' && {
              growth: data.earningsGrowthRate ? `${data.earningsGrowthRate.toFixed(2)}%` : undefined,
              isUp: data.earningsGrowthRate > 0
            })
          },
          {
            title: '本组用户总数',
            value: `${data.memberCount || 0}`,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
          },
          {
            title: '广告总曝光',
            value: `${data.totalAdExposure || 0}`,
            icon: Zap,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
            ...(localTimeRange === 'today' && {
              growth: data.adExposureGrowthRate ? `${data.adExposureGrowthRate.toFixed(2)}%` : undefined,
              isUp: data.adExposureGrowthRate > 0
            })
          }
        ];

        const cacheKey = `${localTimeRange}_${currentUser?.id || 'unknown'}`;
        setCachedData(cacheKey, transformedKpis);
        setKpiData(transformedKpis);
      } else {
        setKpiData([]);
      }

      // 后台预加载其他时间范围的数据（不阻塞主流程）
      setTimeout(() => {
        preloadOtherTimeRanges();
      }, 100);
    } catch (error) {
      console.error('获取组长数据失败:', error);
      console.error('错误详情:', error instanceof Error ? error.message : error);
      console.error('当前用户:', currentUser);
      setKpiData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [localTimeRange, currentUser, getCachedData, setCachedData]);

  // 带重试机制的请求函数
  const requestWithRetry = useCallback(async (url: string, options: RequestInit = {}, retries = 2) => {
    let lastError: Error;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await request<any>(url, options);
      } catch (error) {
        lastError = error as Error;
        // 只对503错误进行重试
        if (!(lastError.message.includes('503'))) {
          throw error;
        }
        // 指数退避策略
        if (i < retries) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError!;
  }, []);

  // 后台预加载其他时间范围的数据
  const preloadOtherTimeRanges = useCallback(async () => {
    if (!currentUser || !currentUser.token) return;
    
    // 所有时间范围
    const allTimeRanges = ['today', 'yesterday', 'week', 'month'];
    // 排除当前时间范围
    const otherTimeRanges = allTimeRanges.filter(range => range !== localTimeRange);
    
    // 只预加载KPI数据，不预加载用户列表数据，提高加载速度
    // 使用Promise.allSettled而不是Promise.all，避免一个请求失败影响其他请求
    await Promise.allSettled(
      otherTimeRanges.map(async (range) => {
        const cacheKey = `${range}_${currentUser?.id || 'unknown'}`;
        
        if (getCachedData(cacheKey)) {
          return;
        }
        
        try {
          const apiUrl = `/group-leader/stats?range=${range}`;
          const data = await requestWithRetry(apiUrl, { method: 'GET' });
          
          if (data) {
            const transformedKpis = [
              {
                title: '组提成收益',
                value: `¥${(data.totalCommission || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                icon: Users,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                ...(range === 'today' && {
                  growth: data.commissionGrowthRate ? `${data.commissionGrowthRate.toFixed(2)}%` : undefined,
                  isUp: data.commissionGrowthRate > 0
                })
              },
              {
                title: '本组业绩金额',
                value: `¥${(data.totalEarnings || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                icon: Coins,
                color: 'text-green-600',
                bg: 'bg-green-50',
                ...(range === 'today' && {
                  growth: data.earningsGrowthRate ? `${data.earningsGrowthRate.toFixed(2)}%` : undefined,
                  isUp: data.earningsGrowthRate > 0
                })
              },
              {
                title: '本组用户总数',
                value: `${data.memberCount || 0}`,
                icon: Users,
                color: 'text-blue-600',
                bg: 'bg-blue-50'
              },
              {
                title: '广告总曝光',
                value: `${data.totalAdExposure || 0}`,
                icon: Zap,
                color: 'text-yellow-600',
                bg: 'bg-yellow-50',
                ...(range === 'today' && {
                  growth: data.adExposureGrowthRate ? `${data.adExposureGrowthRate.toFixed(2)}%` : undefined,
                  isUp: data.adExposureGrowthRate > 0
                })
              }
            ];
            
            setCachedData(cacheKey, transformedKpis);
          }
        } catch (error) {
          // 只在控制台记录错误，不影响用户界面
          console.debug(`预加载 ${range} 数据失败:`, error);
        }
      })
    );
  }, [localTimeRange, currentUser, getCachedData, setCachedData, requestWithRetry]);

  // 当timeRange属性变化时，更新localTimeRange状态
  useEffect(() => {
    setLocalTimeRange(timeRangeMap[timeRange] || 'today');
  }, [timeRange]);

  // 当localTimeRange变化时，刷新数据
  useEffect(() => {
    // 只有当currentUser存在时才加载数据
    // 避免未登录状态下请求API
    if (currentUser) {
      // 组件挂载时强制刷新数据，不使用缓存
      // 避免使用缓存中的旧数据导致显示"暂无数据"
      fetchData(true);
    }
  }, [fetchData, localTimeRange, currentUser]);

  // 自动刷新机制 - 只在用户主动刷新后启用
  useEffect(() => {
    if (currentUser) {
      // 检查Dashboard组件是否已经有自动刷新
      // 如果有，就不再设置自动刷新，避免重复的API请求
      if (!(window as any).dashboardAutoRefresh) {
        // 设置自动刷新定时器，每5分钟刷新一次，使用静默刷新模式
        const interval = setInterval(() => {
          // 静默刷新：不显示刷新动画，只更新缓存
          fetchData(false);
        }, 300000); // 5分钟
        
        // 清理函数
        return () => clearInterval(interval);
      }
    }
  }, [currentUser, fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
    onRefresh();
  }, [fetchData, onRefresh]);

  return (
    <div className="pb-6">
      <div className="mt-4 space-y-2">
        {/* KPI数据卡片 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md">
          <div className="px-4 py-4 grid grid-cols-2 gap-3">
            {loading ? (
              // 加载状态
              <div className="col-span-2 flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600">加载中...</p>
              </div>
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
      </div>
    </div>
  );
};

export default GroupLeader;
