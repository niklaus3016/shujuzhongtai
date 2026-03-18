import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Edit2, Trash2, Loader2,
  ChevronRight, AlertCircle, Users2, Award, ChevronUp, ChevronDown
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import { AdminUser, UserRole } from '../types';

interface Group {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  createdAt: string;
  memberCount?: number;
  todayActive?: number;
  monthlyActive?: number;
  todayRevenue?: number;
  monthlyRevenue?: number;
  todayAdCount?: number;
  avgEcpm?: number;
  yesterdayRevenue?: number;
  commission?: number;
}

const GroupManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'today' | 'month'>('today');
  
  // Groups data
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 使用 authService 获取当前用户信息
        const user = authService.getCurrentUser();
        setCurrentUser(user);

        // Fetch teams
        const teamsResponse = await request<{ id: string; name: string }[]>('/team/list', {
          method: 'GET'
        });
        setTeams(teamsResponse);

        // Fetch groups - 使用 /admin/employee/group-leaders 接口
        let groupsResponse: Group[] = [];
        
        if (user.role === UserRole.NORMAL_ADMIN) {
          // Team leaders only see their own teams' groups
          try {
            const groupLeadersData = await request<{ data?: any[] } | any[]>(`/admin/employee/group-leaders?teamId=${user.id}`, {
              method: 'GET'
            });
            
            // 转换数据格式
            const dataArray = Array.isArray(groupLeadersData) ? groupLeadersData : (groupLeadersData?.data || []);
            groupsResponse = dataArray.map((g: any) => ({
              id: g._id || g.groupId,
              name: g.groupName,
              teamId: g.teamId,
              teamName: user.teamName,
              createdAt: g.createdAt || new Date().toISOString(),
              memberCount: g.memberCount || 0,
              todayActive: g.todayActive || 0,
              todayRevenue: g.todayRevenue || 0,
              monthlyRevenue: g.monthlyRevenue || 0,
              todayAdCount: g.todayAdCount || 0,
              avgEcpm: g.avgEcpm || 0,
              yesterdayRevenue: g.yesterdayRevenue || 0,
              commission: g.commission || 0.05
            }));
          } catch (apiError) {
            console.error('Error fetching groups:', apiError);
          }
        } else {
          // Super admins - 获取所有团队的组
          // 遍历所有团队获取组列表
          const allGroups: Group[] = [];
          for (const team of teamsResponse) {
            try {
              const groupLeadersData = await request<{ data?: any[] } | any[]>(`/admin/employee/group-leaders?teamId=${team.id}`, {
                method: 'GET'
              });
              const dataArray = Array.isArray(groupLeadersData) ? groupLeadersData : (groupLeadersData?.data || []);
              const teamGroups = dataArray.map((g: any) => ({
                id: g._id || g.groupId,
                name: g.groupName,
                teamId: team.id,
                teamName: team.name,
                createdAt: g.createdAt || new Date().toISOString(),
                memberCount: g.memberCount || 0,
                todayActive: g.todayActive || 0,
                todayRevenue: g.todayRevenue || 0,
                monthlyRevenue: g.monthlyRevenue || 0,
                todayAdCount: g.todayAdCount || 0,
                avgEcpm: g.avgEcpm || 0,
                yesterdayRevenue: g.yesterdayRevenue || 0,
                commission: g.commission || 0.05
              }));
              allGroups.push(...teamGroups);
            } catch (err) {
              console.error(`Error fetching groups for team ${team.name}:`, err);
            }
          }
          groupsResponse = allGroups;
        }
        
        setGroups(groupsResponse);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to mock data on error
        setCurrentUser({
          id: 'A001',
          username: '测试团队长',
          role: UserRole.NORMAL_ADMIN,
          status: 'enabled',
          teamName: '鼎盛战队'
        });
        setTeams([
          { id: 'T001', name: '鼎盛战队' },
          { id: 'T002', name: '精英战队' },
        ]);
        setGroups([
          { id: 'G001', name: '一组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-01', memberCount: 2, todayActive: 1, todayRevenue: 56.42, monthlyRevenue: 711.71, todayAdCount: 467, avgEcpm: 296.73, yesterdayRevenue: 331.45, commission: 0.05 },
          { id: 'G002', name: '二组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-02', memberCount: 11, todayActive: 8, todayRevenue: 25.46, monthlyRevenue: 936.98, todayAdCount: 261, avgEcpm: 239.94, yesterdayRevenue: 456.78, commission: 0.05 },
          { id: 'G003', name: '三组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-03', memberCount: 5, todayActive: 3, todayRevenue: 18.25, monthlyRevenue: 456.32, todayAdCount: 156, avgEcpm: 198.45, yesterdayRevenue: 22.36, commission: 0.05 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 过滤和排序后的组列表
  const filteredGroups = useMemo(() => {
    const filtered = groups.filter(group => 
      (group.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (group.id || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (group.teamName || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
    
    // 排序
    return filtered.sort((a, b) => {
      if (sortBy === 'today') {
        return (b.todayRevenue || 0) - (a.todayRevenue || 0);
      } else {
        return (b.monthlyRevenue || 0) - (a.monthlyRevenue || 0);
      }
    });
  }, [groups, searchTerm, sortBy]);

  // 计算总成员数
  const totalMemberCount = useMemo(() => {
    return filteredGroups.reduce((sum, group) => sum + (group.memberCount || 0), 0);
  }, [filteredGroups]);

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Users2 className="text-[#1E40AF] mr-2" size={24} />
            团队管理
          </h1>
        </div>

        <div className="relative mb-4 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
                <input 
                    type="text"
                    placeholder="输入组名称或团队名称筛选..."
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">总组数</div>
                    <div className="text-2xl font-black">{filteredGroups.length} <span className="text-xs font-normal opacity-70">个</span></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 rounded-2xl text-white shadow-lg shadow-emerald-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">{sortBy === 'today' ? '今日团队总收益' : '本月团队总收益'}</div>
                    <div className="text-2xl font-black">¥{filteredGroups.reduce((sum, group) => sum + (sortBy === 'today' ? (group.todayRevenue || 0) : (group.monthlyRevenue || 0)), 0).toLocaleString()} <span className="text-xs font-normal opacity-70">元</span></div>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                    onClick={() => setSortBy('today')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'today' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按今日团队总收益
                </button>
                <button 
                    onClick={() => setSortBy('month')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'month' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按本月团队总收益
                </button>
            </div>
      </header>

      <div className="px-4 mt-4">
        <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
                <p className="text-xs text-gray-400 font-bold">加载中...</p>
              </div>
            ) : filteredGroups.length > 0 ? (
              filteredGroups.map((group, index) => (
            <div key={group.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-4 transition-colors mb-4">
              <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Award size={20} className="text-gray-600" />
                      </div>
                      <div>
                          <div className="text-sm font-bold text-gray-900">{group.name}</div>
                          <div className="text-xs text-gray-400 font-medium">
                            今日成员活跃率: {Math.round(((group.todayActive || 0) / (group.memberCount || 1)) * 100)}%
                          </div>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">¥{group.todayRevenue?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-gray-400 font-medium">
                        今日小组总收益
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">成员总数</div>
                      <div className="text-sm font-bold text-gray-900">{group.memberCount || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">今日广告次数</div>
                      <div className="text-sm font-bold text-gray-900">{group.todayAdCount || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">平均ECPM</div>
                      <div className="text-sm font-bold text-green-500">{group.avgEcpm?.toFixed(2) || '0.00'}</div>
                  </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                              <ChevronUp size={12} className="text-blue-500" />
                          </div>
                          <div className="text-xs text-gray-600 font-medium">本月小组累计总收益</div>
                      </div>
                      <div className="text-sm font-bold text-blue-600">¥{group.monthlyRevenue?.toFixed(2) || '0.00'}</div>
                  </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center space-x-1">
                      <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                          <ChevronDown size={12} className="text-red-500" />
                      </div>
                      <div className="text-xs text-red-500 font-medium">
                        较昨日业绩{group.yesterdayRevenue ? `下降 ${Math.round(((group.yesterdayRevenue - (group.todayRevenue || 0)) / group.yesterdayRevenue) * 100)}%` : '无数据'}
                      </div>
                  </div>
                  <button
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center space-x-1"
                    onClick={() => {
                      // 查看详情功能
                    }}
                  >
                    查看今日成员详情 <ChevronRight size={14} />
                  </button>
              </div>
            </div>
            ))
            ) : (
              <div className="text-center py-20 text-gray-400">
                <p className="text-sm font-bold">暂无组数据</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default GroupManagement;