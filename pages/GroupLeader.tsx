import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Coins, Eye, Zap, Users, BarChart3, 
  TrendingUp, TrendingDown, Clock, UserPlus, RefreshCw
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { UserRole, TimeRange } from '../types';
import EmployeeManagement from '../components/EmployeeManagement';

interface GroupLeaderProps {
  timeRange: string;
  onRefresh: () => void;
}

const GroupLeader: React.FC<GroupLeaderProps> = ({ timeRange, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // 使用 useMemo 缓存 currentUser，避免每次渲染都返回新对象
  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  
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
      
      const { teamName, groupName, groupId } = getUserGroupInfo();
      
      // 使用传入的 timeRange
      const formattedTimeRange = timeRange;
      console.log('处理后的时间范围:', formattedTimeRange);
      
      // 使用正确的 API 路径 - KPI 接口
      const apiUrl = `/admin/dashboard/kpi?range=${formattedTimeRange}&team=${encodeURIComponent(teamName)}`;
      
      try {
        const result = await request<any>(apiUrl, {
          method: 'GET'
        });
        responseData = result;
        console.log('KPI API返回数据:', responseData);
      } catch (error) {
        console.error('获取KPI数据失败:', error);
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
      const timePrefix = timePrefixMap[timeRange];
      // 只在今日显示增长率，其他时间范围不显示
      showGrowth = timeRange === 'today';

      // 计算团队分成（用户分成的20%）
      userShare = Number(responseData?.coins || 0) / 1000;
      
      // 计算单条平均金币 = (团队用户收益 * 1000) / 广告总曝光
      averageCoins = responseData?.impressions > 0 ? (userShare * 1000) / Number(responseData?.impressions) : 0;

      // 并行获取所有需要的数据，提高加载速度
      try {
        // 并行执行API请求
        const [userResult, employeeResult] = await Promise.all([
          request<any[]>(`/admin/dashboard/users?range=${formattedTimeRange}&team=${encodeURIComponent(teamName)}&limit=100`).catch(error => {
            console.error('获取用户列表失败:', error);
            return [];
          }),
          request<any>('/admin/employee/list?pageSize=100', { method: 'GET' }).catch(error => {
            console.error('获取员工账号列表失败:', error);
            return { data: [] };
          })
        ]);

        // 处理用户数据，计算活跃用户数
        const users = Array.isArray(userResult) ? userResult : [];
        console.log('团队名称:', teamName);
        console.log('组名称:', groupName);
        console.log('用户列表总数:', users.length);
        
        // 组长只计算自己组的用户
        const filteredUsers = users.filter((user: any) => {
          const userTeam = user.teamName || user.superior || '系统直属';
          const userGroup = user.groupName || user.teamGroup || '';
          return userTeam === teamName && userGroup === groupName;
        });
        console.log('过滤后用户数:', filteredUsers.length);
        
        // 计算活跃用户数：有收益或观看次数的用户（只计算本组的用户）
        activeUsersCount = filteredUsers.filter((user: any) => (user.watched > 0 || user.earnings > 0)).length;
        console.log('活跃用户数:', activeUsersCount);

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
        console.log('账号管理中的员工账号数量（已启用）:', totalUsersCount);

        // 调用后端API获取组长收益（根据提成比例变更历史准确计算）
        if (groupId) {
          const commissionUrl = `/admin/group-leader-commission/${groupId}?range=${formattedTimeRange}`;
          console.log(`请求组 ${groupName} 的提成数据，URL:`, commissionUrl);
          
          try {
            const commissionData = await request<any>(commissionUrl, {
              method: 'GET'
            });
            console.log(`组 ${groupName} API返回数据:`, commissionData);
            groupLeaderEarnings = commissionData?.totalCommission || 0;
            console.log(`组 ${groupName}: 组长提成=${groupLeaderEarnings}`);
          } catch (err) {
            console.error(`组 ${groupName} API请求异常:`, err);
            groupLeaderEarnings = 0;
          }
        }

        console.log('组长收益总计（从后端API获取）:', groupLeaderEarnings);
      } catch (error) {
        console.error('获取数据失败:', error);
      }

      // 转换KPI数据为前端格式
      const transformedKpis = [
        {
          title: '组提成收益',
          value: `¥${groupLeaderEarnings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
          subValue: userShare > 0 ? `${((groupLeaderEarnings / userShare) * 100).toFixed(2)}%` : '0%',
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
            title: '今日活跃用户',
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
      setRefreshing(false);
    }
  }, [timeRange, currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData, timeRange]);

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
      </header>

      <div className="px-4 mt-4 space-y-4">
        {/* KPI数据卡片 */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md mb-6">
          <div className="grid grid-cols-2 gap-3">
            {loading ? (
              // 加载状态
              Array(5).fill(0).map((_, idx) => (
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

        {/* 员工管理 */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">员工管理</h2>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
            >
              <UserPlus size={20} />
            </button>
          </div>
          {currentUser && (
            <EmployeeManagement 
              currentUser={currentUser} 
              isAddModalOpen={isAddModalOpen}
              setIsAddModalOpen={setIsAddModalOpen}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupLeader;