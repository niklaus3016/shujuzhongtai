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

      // 处理时间范围
      const formattedTimeRange = timeRange === 'this_week' ? 'week' : timeRange === 'this_month' ? 'month' : timeRange;
      console.log('处理后的时间范围:', formattedTimeRange);
      
      // 使用正确的 API 路径 - KPI 接口
      const teamName = currentUser?.teamName || '鼎盛战队';
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
        month: '本月',
        this_week: '本周',
        this_month: '本月'
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
        const [teamsResult, userResult, employeeResult] = await Promise.all([
          request<{ id: string; leader: string }[]>('/team/list', { method: 'GET' }).catch(error => {
            console.error('获取团队列表失败:', error);
            return [];
          }),
          request<any[]>(`/admin/dashboard/users?range=${formattedTimeRange}&team=${encodeURIComponent(teamName)}&limit=100`).catch(error => {
            console.error('获取用户列表失败:', error);
            return [];
          }),
          request<any>('/admin/employee/list?pageSize=100', { method: 'GET' }).catch(error => {
            console.error('获取员工账号列表失败:', error);
            return { data: [] };
          })
        ]);

        // 处理团队和组数据
        let groupsData: any[] = [];
        const teams = Array.isArray(teamsResult) ? teamsResult : [];
        console.log('团队列表API返回:', teams);
        const team = teams.find(t => t.leader === teamName);
        if (team) {
          console.log('找到团队:', team);
          try {
            const groups = await request<any[]>(`/group/list?teamId=${team.id}`, {
              method: 'GET'
            });
            console.log('组列表API返回:', groups);
            groupsData = groups || [];
            console.log('从API获取的组数据:', groupsData);
          } catch (error) {
            console.error('获取组列表失败:', error);
            // API错误时使用默认组数据
            groupsData = [
              {
                _id: '69b983ac05e593e7e7e4b431',
                groupName: '我是测试'
              }
            ];
            console.log('使用默认组数据:', groupsData);
          }
        } else {
          console.log('找不到团队:', teamName);
          // 如果找不到团队，使用默认组数据
          groupsData = [
            {
              _id: '69b983ac05e593e7e7e4b431',
              groupName: '我是测试'
            }
          ];
        }

        // 处理用户数据，计算活跃用户数
        const users = Array.isArray(userResult) ? userResult : [];
        console.log('团队名称:', teamName);
        console.log('用户列表总数:', users.length);
        
        // 团队长只计算自己团队的用户
        const filteredUsers = users.filter((user: any) => {
          const userTeam = user.teamName || user.superior || '系统直属';
          return userTeam === teamName;
        });
        console.log('过滤后用户数:', filteredUsers.length);
        
        // 计算活跃用户数：有收益或观看次数的用户（只计算本团队的用户）
        activeUsersCount = filteredUsers.filter((user: any) => (user.watched > 0 || user.earnings > 0)).length;
        console.log('活跃用户数:', activeUsersCount);

        // 处理员工账号数据，计算已启用的员工账号数量
        const employees = Array.isArray(employeeResult) ? employeeResult : (employeeResult?.data || []);
        
        // 过滤出本团队的员工且状态为active
        const teamEmployees = employees.filter((emp: any) => {
          const empTeam = emp.parentName || emp.teamName || emp.superior || '';
          const isActive = emp.status === 'active' || emp.status === 'enabled' || !emp.status;
          return empTeam === teamName && isActive;
        });
        
        totalUsersCount = teamEmployees.length;
        console.log('账号管理中的员工账号数量（已启用）:', totalUsersCount);

        // 调用后端API获取团队组长收益（根据提成比例变更历史准确计算）
        // 并行获取所有组的提成数据，提高加载速度
        console.log('开始获取团队组长收益，组列表:', groupsData);

        // 创建所有组的提成API请求
        const commissionPromises = groupsData.map(async (group) => {
          if (group._id || group.id) {
            const groupId = group._id || group.id;
            const groupName = group.groupName || group.name || '未知组';
            const commissionUrl = `/admin/group-leader-commission/${groupId}?range=${formattedTimeRange}`;
            console.log(`请求组 ${groupName} 的提成数据，URL:`, commissionUrl);
            
            try {
              const commissionData = await request<any>(commissionUrl, {
                method: 'GET'
              });
              console.log(`组 ${groupName} API返回数据:`, commissionData);
              // 返回每个组的提成数据，request函数已经处理了data字段的提取
              const totalCommission = commissionData?.totalCommission || 0;
              console.log(`组 ${groupName}: 组长提成=${totalCommission}`);
              return totalCommission;
            } catch (err) {
              console.error(`组 ${groupName} API请求异常:`, err);
              return 0;
            }
          } else {
            console.log('组没有ID:', group);
            return 0;
          }
        });

        // 并行执行所有请求
        const commissionResults = await Promise.all(commissionPromises);

        // 累加所有组的总提成
        teamLeaderEarnings = commissionResults.reduce((total, commission) => total + commission, 0);
        console.log('团队组长总收益:', teamLeaderEarnings);

        console.log('团队组长收益总计（从后端API获取）:', teamLeaderEarnings);
      } catch (error) {
        console.error('获取数据失败:', error);
      }

      // 计算团队提成收益 = 用户分成的25% - 团队组长收益
      const teamShare = userShare * 0.25 - teamLeaderEarnings;

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
