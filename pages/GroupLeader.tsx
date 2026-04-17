import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Coins, Eye, Zap, Users, BarChart3, 
  TrendingUp, TrendingDown, Clock, RefreshCw
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
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
  
  // 监听timeRange变化
  useEffect(() => {
    setLocalTimeRange(timeRangeMap[timeRange] || 'today');
  }, [timeRange]);
  
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
      setLoading(true);
    }

    let responseData: any = null;
    let showGrowth = false;
    let userShare = 0;
    let averageCoins = 0;
    let groupLeaderEarnings = 0;
    let activeUsersCount = 0;
    let totalUsersCount = 0;

    try {
      if (!currentUser) {
        throw new Error('用户未登录');
      }
      
      // 重新获取最新的用户信息，确保teamGroupId是最新的
      const updatedUser = authService.getCurrentUser();
      const { teamName, groupName, groupId } = {
        teamName: updatedUser?.teamName || '团队',
        groupName: updatedUser?.groupName || '组',
        groupId: updatedUser?.teamGroupId || ''
      };
      
      // 使用本地时间范围
      const formattedTimeRange = localTimeRange;
      
      // 使用正确的 API 路径 - KPI 接口
      const apiUrl = `/admin/dashboard/kpi?range=${formattedTimeRange}&team=${encodeURIComponent(teamName)}&group=${encodeURIComponent(groupId || '')}`;
      
      try {
        const result = await request<any>(apiUrl, {
          method: 'GET'
        });
        responseData = result;
      } catch (error) {
        // 即使KPI数据获取失败，也继续获取其他数据
        responseData = {};
      }

      // 时间前缀
      const timePrefixMap: Record<string, string> = {
        today: '今日',
        yesterday: '昨日',
        week: '本周',
        month: '本月'
      };
      const timePrefix = timePrefixMap[localTimeRange];
      // 只在今日显示增长率，其他时间范围不显示
      showGrowth = localTimeRange === 'today';

      // 计算团队分成（用户分成的20%）
      userShare = Number(responseData?.coins || 0) / 1000;
      
      // 计算单条平均金币 = (团队用户收益 * 1000) / 广告总曝光
      averageCoins = responseData?.impressions > 0 ? (userShare * 1000) / Number(responseData?.impressions) : 0;

      // 并行获取所有需要的数据，提高加载速度
      try {
        // 并行执行API请求，添加超时处理
        const [userResult, employeeResult] = await Promise.all([
          // 为用户列表请求添加超时处理
          Promise.race([
            request<any[]>(`/admin/dashboard/users?range=${formattedTimeRange}&team=${encodeURIComponent(teamName)}&group=${encodeURIComponent(groupId || '')}&limit=100`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('用户列表请求超时')), 5000))
          ]).catch(() => []),
          // 为员工账号列表请求添加超时处理
          Promise.race([
            request<any>('/admin/employee/list?pageSize=100', { method: 'GET' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('员工账号列表请求超时')), 5000))
          ]).catch(() => ({ data: [] }))
        ]);

        // 处理用户数据，计算活跃用户数
        const users = Array.isArray(userResult) ? userResult : [];
        
        // 组长只计算自己组的用户
        const filteredUsers = users.filter((user: any) => {
          const userTeam = user.teamName || user.superior || '系统直属';
          const userGroup = user.groupName || user.teamGroup || '';
          return userTeam === teamName && userGroup === groupName;
        });
        
        // 计算活跃用户数：有收益或观看次数的用户（只计算本组的用户）
        activeUsersCount = filteredUsers.filter((user: any) => (user.watched > 0 || user.earnings > 0)).length;

        // 处理员工账号数据，计算已启用的员工账号数量
        const employees = Array.isArray(employeeResult) ? employeeResult : (employeeResult?.data || []);
        
        // 过滤出本组的员工且状态为active
        const groupEmployees = employees.filter((emp: any) => {
          const empTeam = emp.parentName || emp.teamName || emp.superior || '';
          const empGroup = emp.groupName || emp.teamGroup || '';
          const isActive = emp.status === 'active' || emp.status === 'enabled' || !emp.status;
          return empTeam === teamName && empGroup === groupName && isActive;
        });
        
        totalUsersCount = groupEmployees.length;

        // 调用后端API获取组长收益（根据提成比例变更历史准确计算）
        if (groupId) {
          const commissionUrl = `/admin/group-leader-commission/${groupId}?range=${formattedTimeRange}`;
          
          try {
            const commissionData = await request<any>(commissionUrl, {
              method: 'GET'
            });
            groupLeaderEarnings = commissionData?.totalCommission || 0;
          } catch (err) {
            groupLeaderEarnings = 0;
          }
        }
      } catch (error) {
        // 静默处理错误，不影响其他数据的显示
      }

      // 转换KPI数据为前端格式
      const transformedKpis = [
        {
          title: '组提成收益',
          value: `¥${groupLeaderEarnings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          growth: showGrowth ? `${responseData?.coinsGrowth > 0 ? '+' : ''}${responseData?.coinsGrowth || 0}%` : '',
          isUp: responseData?.coinsGrowth > 0,
          icon: Users,
          color: 'text-purple-600',
          bg: 'bg-purple-50'
        },
        {
          title: '单条平均金币（总盘）',
          value: `${averageCoins.toFixed(2)}`,
          icon: Zap,
          color: 'text-yellow-600',
          bg: 'bg-yellow-50'
        }
      ];

      setKpiData(transformedKpis);
    } catch (error) {
      // 保持数据为空，不显示模拟数据
      setKpiData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [localTimeRange, currentUser]);

  // 当timeRange属性变化时，更新localTimeRange状态
  useEffect(() => {
    setLocalTimeRange(timeRangeMap[timeRange] || 'today');
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData, localTimeRange]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
    onRefresh();
  }, [fetchData, onRefresh]);

  return (
    <div className="pb-6">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">团队数据</h1>
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
          {['今日', '昨日', '本周', '本月'].map((range) => {
            const rangeMap: Record<string, string> = {
              '今日': 'today',
              '昨日': 'yesterday',
              '本周': 'week',
              '本月': 'month'
            };
            const rangeValue = rangeMap[range];
            return (
              <button
                key={range}
                onClick={() => setLocalTimeRange(rangeValue)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  localTimeRange === rangeValue ? 'bg-white text-[#1E40AF] shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>
      </header>

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