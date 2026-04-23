import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, X, Edit2, Trash2, Loader2, 
  ChevronRight, ChevronLeft, AlertCircle, Users2, Award, ChevronUp, ChevronDown, RefreshCw
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
  yesterdayAdCount?: number;
  avgEcpm?: number;
  yesterdayRevenue?: number;
  commission?: number;
  groupLeaderId?: string;
  groupLeaderName?: string;
  growthRate?: number;
}

interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  todayWatched: number;
  todayEarnings: number;
  status: '在线' | '离线';
}

const GroupMemberDetail: React.FC<{ 
  group: Group; 
  timeRange: 'today' | 'month'; 
  membersCache: { [groupId: string]: { [timeRange: string]: GroupMember[] } };
  setMembersCache: React.Dispatch<React.SetStateAction<{ [groupId: string]: { [timeRange: string]: GroupMember[] } }>>;
  onBack: () => void; 
}> = ({ group, timeRange, membersCache, setMembersCache, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings'>('earnings');
  const [memberRefreshTrigger, setMemberRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchMembers = async () => {
      // 如果是刷新请求，先清空缓存
      if (memberRefreshTrigger > 0) {
        setMembersCache(prev => ({
          ...prev,
          [group.id]: {
            ...prev[group.id],
            [timeRange]: undefined
          }
        }));
      }
      
      // 检查缓存中是否已有数据
      if (membersCache[group.id]?.[timeRange] && memberRefreshTrigger === 0) {
        console.log('Using cached data for group:', group.id, 'timeRange:', timeRange);
        setMembers(membersCache[group.id][timeRange]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        console.log('Group ID:', group.id);
        console.log('Group name:', group.name);
        const token = localStorage.getItem('admin_token');
        console.log('Token exists:', !!token);
        
        // 尝试使用用户列表API，然后过滤出属于该组的成员
        console.log('Trying users API...');
        const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/users?range=${timeRange}&limit=100`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('Users API Response Status:', response.status);
        const result = await response.json();
        console.log('Users API Response:', result);
        
        if (result.success) {
          const users = result.data || result || [];
          console.log('All users:', users.length);
          
          // 过滤出属于该组的成员
          // 只匹配真正属于该组的用户
          const groupMembers = users.filter((user: any) => {
            // 尝试多种可能的字段匹配
            const matchesGroupName = user.groupName === group.name;
            const matchesGroupId = user.teamGroupId === group.id;
            const matchesEmployeeId = user.employeeId === group.groupLeaderId;
            
            console.log('User:', user.employeeId || user.id, 'groupName:', user.groupName, 'teamGroupId:', user.teamGroupId, 'employeeId:', user.employeeId);
            console.log('Matches:', { matchesGroupName, matchesGroupId, matchesEmployeeId });
            
            // 只返回真正匹配的用户
            return matchesGroupName || matchesGroupId || matchesEmployeeId;
          });
          
          console.log('Filtered group members:', groupMembers.length);
          console.log('Group members details:', groupMembers);
          
          // 转换用户数据为GroupMember格式
          const formattedMembers = groupMembers.map((user: any) => ({
            id: user.employeeId || user.id || user.userId,
            name: user.realName || user.realname || user.name || user.username || user.userName || user.userId || user.employeeId || '',
            avatar: user.avatar || '',
            todayWatched: user.watched || 0,
            todayEarnings: (user.earnings || 0) / 1000,
            status: (user.watched || 0) > 0 ? '在线' : '离线'
          }));
          
          console.log('Formatted members with correct earnings:', formattedMembers);
          
          console.log('Formatted members:', formattedMembers);
          
          // 保存到缓存
          setMembersCache(prev => ({
            ...prev,
            [group.id]: {
              ...prev[group.id],
              [timeRange]: formattedMembers
            }
          }));
          
          setMembers(formattedMembers);
        } else {
          throw new Error(result.message || '获取用户列表失败');
        }
      } catch (error) {
        console.error('Error fetching members:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [group.id, group.name, group.teamName, timeRange, membersCache, setMembersCache, memberRefreshTrigger]);

  // Sort by selected criteria and filter by search term
  const sortedAndFilteredMembers = useMemo(() => {
    return members
      .filter(m => m.name.includes(searchTerm) || m.id.includes(searchTerm))
      .sort((a, b) => {
        if (sortBy === 'watched') {
          return b.todayWatched - a.todayWatched; // High to Low
        } else { // earnings
          return b.todayEarnings - a.todayEarnings; // High to Low
        }
      });
  }, [members, searchTerm, sortBy]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-50 px-4 py-4 border-b border-gray-100 shadow-sm">
        <div className="flex items-center mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 ml-2">
            <h1 className="text-lg font-bold text-gray-900">{group.name} 小组成员</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
              共 {group.memberCount} 位成员
            </p>
          </div>
          <button
            onClick={() => setMemberRefreshTrigger(prev => prev + 1)}
            className="p-2 text-gray-500 hover:text-[#1E40AF] hover:bg-gray-100 rounded-xl transition-colors"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="搜索成员姓名或 ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl mt-3">
          <button
            onClick={() => setSortBy('earnings')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'earnings' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
          >
            按收益
          </button>
          <button
            onClick={() => setSortBy('watched')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'watched' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
          >
            按次数
          </button>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {sortedAndFilteredMembers.map((member, index) => (
          <div key={`${group.id}-${member.id}-${index}`} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600`}>
                    {member.id}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${member.status === '在线' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{member.name}</div>
                </div>
              </div>
              <div className="text-right">
                {sortBy === 'earnings' ? (
                  <>
                    <div className="text-xs font-black text-[#1E40AF]">
                      ¥ {Number(member.todayEarnings).toFixed(2)}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                      {timeRange === 'today' ? '今日' : '本月'}预计收益
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-black text-[#1E40AF]">
                      {member.todayWatched.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                      {timeRange === 'today' ? '今日' : '本月'}观看次数
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  观看次数
                </div>
                <div className="text-[11px] font-black text-gray-700">
                  {member.todayWatched.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  个人平均金币
                </div>
                <div className={`text-[11px] font-black ${(member.todayEarnings * 1000 / (member.todayWatched || 1)) >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                  {(member.todayEarnings * 1000 / (member.todayWatched || 1)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
            <p className="text-xs text-gray-400 font-bold">加载中...</p>
          </div>
        )}

        {!loading && sortedAndFilteredMembers.length === 0 && (
          <div className="py-20 text-center">
            <Search className="mx-auto text-gray-200 mb-2" size={48} />
            <p className="text-xs text-gray-400 font-bold">未找到符合条件的成员</p>
          </div>
        )}
      </div>
    </div>
  );
};

const GroupManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'today' | 'month'>('today');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  
  // 成员详情缓存
  const [membersCache, setMembersCache] = useState<{ [groupId: string]: { [timeRange: string]: GroupMember[] } }>({});
  
  // 刷新计数器
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Groups data
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  const fetchGroupData = useCallback(async () => {
    setLoading(true);
    try {
      const user = authService.getCurrentUser();
      setCurrentUser(user);

      let groupsResponse: Group[] = [];
      
      if (user.role === UserRole.NORMAL_ADMIN) {
        try {
          console.log('Calling team-leader/groups with teamId:', user.id, 'range:', sortBy);
          const groupLeadersData = await request<any>(`/admin/employee/team-leader/groups?teamId=${user.id}&range=${sortBy}`, {
            method: 'GET'
          });
          console.log('Raw groupLeadersData:', groupLeadersData);
          
          // 直接使用groupLeadersData，因为api.ts的request函数已经返回了result.data
          let dataArray: any[] = [];
          if (Array.isArray(groupLeadersData)) {
            dataArray = groupLeadersData;
          } else {
            console.warn('Unexpected data format:', groupLeadersData);
            dataArray = [];
          }
          console.log('dataArray:', dataArray);
          
          groupsResponse = dataArray.map((g: any) => ({
            id: g.groupId,
            name: g.groupName,
            teamId: user.id,
            teamName: user.teamName,
            createdAt: g.createdAt || new Date().toISOString(),
            memberCount: g.memberCount || 0,
            todayActive: g.memberCount || 0,
            todayRevenue: g.totalRevenue || 0,
            monthlyRevenue: g.totalRevenue || 0,
            todayAdCount: g.totalAds || 0,
            avgEcpm: g.avgGold || 0,
            yesterdayRevenue: g.totalRevenue || 0,
            commission: g.commission || 0.05,
            groupLeaderName: g.groupLeaderName,
            growthRate: g.growthRate
          }));
          console.log('groupsResponse:', groupsResponse);
        } catch (apiError) {
          console.error('Error fetching groups:', apiError);
        }
      } else {
        const teamsResponse = await request<{ id: string; name: string }[]>('/team/list', {
          method: 'GET'
        });
        console.log('Teams API response:', teamsResponse);
        setTeams(teamsResponse);
        
        const teamPromises = teamsResponse.map(async (team: any) => {
          try {
            const groupLeadersData = await request<{ data?: any[] } | any[]>(`/admin/employee/group-leaders?teamId=${team.id}&includeStats=true`, {
              method: 'GET'
            });
            const dataArray = Array.isArray(groupLeadersData) ? groupLeadersData : (groupLeadersData?.data || []);
            
            if (dataArray.length > 0) {
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
              
              const validGroups = teamGroups.filter(group => group.memberCount > 0);
              return validGroups;
            } else {
              return [];
            }
          } catch (err) {
            console.error(`Error fetching groups for team ${team.name}:`, err);
            return [];
          }
        });
        
        const allGroupsArrays = await Promise.all(teamPromises);
        groupsResponse = allGroupsArrays.flat();
      }
      
      setGroups(groupsResponse);
    } catch (error) {
      console.error('Error fetching data:', error);
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
  }, [sortBy]);

  // 预加载所有组的成员数据
  const preloadAllGroups = useCallback(async (groupsToPreload: Group[]) => {
    if (groupsToPreload.length === 0) return;
    
    console.log('Starting preloading for', groupsToPreload.length, 'groups');
    
    for (const group of groupsToPreload) {
      for (const timeRange of ['today', 'month'] as const) {
        // 检查是否已经有缓存了，避免重复加载
        if (membersCache[group.id]?.[timeRange]) continue;
        
        try {
          console.log(`Preloading ${timeRange} data for group:`, group.name);
          const token = localStorage.getItem('admin_token');
          
          const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/users?range=${timeRange}&limit=100`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          const result = await response.json();
          
          if (result.success) {
            const users = result.data || result || [];
            
            // 过滤出属于该组的成员
            const groupMembers = users.filter((user: any) => {
              const matchesGroupName = user.groupName === group.name;
              const matchesGroupId = user.teamGroupId === group.id;
              const matchesEmployeeId = user.employeeId === group.groupLeaderId;
              return matchesGroupName || matchesGroupId || matchesEmployeeId;
            });
            
            // 转换用户数据为GroupMember格式
            const formattedMembers = groupMembers.map((user: any) => ({
              id: user.employeeId || user.id || user.userId,
              name: user.realName || user.realname || user.name || user.username || user.userName || user.userId || user.employeeId || '',
              avatar: user.avatar || '',
              todayWatched: user.watched || 0,
              todayEarnings: (user.earnings || 0) / 1000,
              status: (user.watched || 0) > 0 ? '在线' : '离线'
            }));
            
            // 保存到缓存
            setMembersCache(prev => ({
              ...prev,
              [group.id]: {
                ...prev[group.id],
                [timeRange]: formattedMembers
              }
            }));
            
            console.log(`Successfully preloaded ${timeRange} data for group:`, group.name, 'count:', formattedMembers.length);
          }
        } catch (error) {
          console.error(`Error preloading ${timeRange} data for group ${group.name}:`, error);
        }
        
        // 每次请求之间稍微延迟一下，避免并发过多
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log('Preloading completed!');
  }, [membersCache, setMembersCache]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData, refreshTrigger]);

  // 组列表加载完成后，延迟预加载成员数据
  useEffect(() => {
    if (groups.length > 0 && !loading) {
      // 延迟2秒开始预加载，给用户先看页面
      const timer = setTimeout(() => {
        preloadAllGroups(groups);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [groups, loading, preloadAllGroups]);

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

  if (selectedGroup) {
    return (
      <GroupMemberDetail 
        group={selectedGroup} 
        timeRange={sortBy}
        membersCache={membersCache}
        setMembersCache={setMembersCache}
        onBack={() => setSelectedGroup(null)} 
      />
    );
  }

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Users2 className="text-[#1E40AF] mr-2" size={24} />
            团队管理
          </h1>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="p-2 text-gray-500 hover:text-[#1E40AF] hover:bg-gray-100 rounded-xl transition-colors"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
          </button>
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
                    <div className="text-2xl font-black">¥{filteredGroups.reduce((sum, group) => sum + (sortBy === 'today' ? (group.todayRevenue || 0) : (group.monthlyRevenue || 0)), 0).toFixed(2)} <span className="text-xs font-normal opacity-70">元</span></div>
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
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-300 text-gray-800' :
                          index === 2 ? 'bg-orange-600 text-white' : 'bg-green-400 text-white'
                      }`}>
                          {index < 3 ? (
                              <span className="text-xl font-black">{index + 1}</span>
                          ) : (
                              <Award size={24} />
                          )}
                      </div>
                      <div>
                          <div className="text-sm font-bold text-gray-900">{group.name}</div>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className={`text-sm font-bold ${group.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{(sortBy === 'today' ? group.todayRevenue : group.monthlyRevenue)?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-gray-400 font-medium">
                        {sortBy === 'today' ? '今日小组总收益' : '本月小组总收益'}
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">成员总数</div>
                      <div className="text-sm font-bold text-gray-900">{group.memberCount || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">广告总次数</div>
                      <div className={`text-sm font-bold ${group.growthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>{group.todayAdCount || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">平均金币</div>
                      <div className={`text-sm font-bold ${(((sortBy === 'today' ? group.todayRevenue : group.monthlyRevenue) || 0) * 1000) / (group.todayAdCount || 1) >= 100 ? 'text-green-600' : 'text-red-500'}`}>{((((sortBy === 'today' ? group.todayRevenue : group.monthlyRevenue) || 0) * 1000) / (group.todayAdCount || 1)).toFixed(2)}</div>
                  </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center space-x-1">
                      {group.growthRate >= 0 ? (
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                          <ChevronUp size={12} className="text-green-600" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                          <ChevronDown size={12} className="text-red-500" />
                        </div>
                      )}
                      <div className={`text-xs font-medium ${group.growthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        较{sortBy === 'today' ? '昨日' : '上月'}业绩{group.growthRate >= 0 ? `增长 ` : `下降 `}{Math.abs(group.growthRate).toFixed(2)}%
                      </div>
                  </div>
                  <button
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors flex items-center space-x-1"
                    onClick={() => {
                      setSelectedGroup(group);
                    }}
                  >
                    查看{sortBy === 'today' ? '今日' : '本月'}成员详情 <ChevronRight size={14} />
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