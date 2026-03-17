import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Zap, Globe, Smartphone, ChevronRight, UserPlus, 
  Search, Filter, Calendar, Users
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import { UserRole } from '../types';

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

interface NewUsersProps {
  onSelectUser?: (user: any) => void;
}

const NewUsers: React.FC<NewUsersProps> = ({ onSelectUser }) => {
  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc' | 'regDays'>('regDays');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('全部');
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [users, setUsers] = useState<NewUser[]>([]);
  const [todayNewUsers, setTodayNewUsers] = useState(0);
  
  // 组件挂载时重置滚动位置到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Derive unique teams for filtering
  const teams = useMemo(() => {
    const uniqueTeams = Array.from(new Set(users.map(u => u.superior).filter(Boolean)));
    return ['全部', ...uniqueTeams];
  }, [users]);

  // 使用useCallback缓存数据获取函数
  const fetchNewUsers = useCallback(async () => {
    setLoading(true);
    const startTime = performance.now();
    
    try {
      // 构建请求URL
      const teamName = currentUser?.teamName || '';
      let url = '/user/new-users?days=15';
      
      // 团队长添加团队筛选参数
      if (isTeamLeader && teamName) {
        url += `&team=${encodeURIComponent(teamName)}`;
      }
      
      const response = await request<any>(url, { method: 'GET' });
      
      const apiTime = performance.now() - startTime;
      console.log(`新人API请求时间: ${apiTime.toFixed(2)}ms`);
      
      const list = response?.data || response || [];
      
      // 使用更高效的数据转换
      const now = Date.now();
      const transformedUsers: NewUser[] = list.map((user: any) => {
        const registerTime = user.registerTime ? new Date(user.registerTime).getTime() : now;
        return {
          id: user.employeeId || user.userId || '',
          userId: user.userId || '',
          name: user.employeeId || user.userId || '',
          avatar: '',
          watched: user.activityCount || 0,
          earnings: (user.currentMonthGold || 0) / 1000,
          ipCount: 1,
          deviceCount: 1,
          ecpm: 0,
          regDays: Math.ceil((now - registerTime) / (1000 * 60 * 60 * 24)) || 1,
          superior: user.teamName || user.teamLeaderName || '系统直属',
          isOnline: user.isOnline,
          groupName: user.groupName,
          groupLeaderName: user.groupLeaderName,
          lastActiveTime: user.lastActiveTime,
          loginDays: user.loginDays
        };
      });
      
      setUsers(transformedUsers);
      
      // 计算今日新增
      const todayCount = transformedUsers.filter(u => u.regDays <= 1).length;
      setTodayNewUsers(todayCount);
      
      const totalTime = performance.now() - startTime;
      console.log(`新人数据总加载时间: ${totalTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('新API失败，回退到旧API:', error);
      
      // 回退到旧API
      try {
        const teamName = currentUser?.teamName || '';
        const fallbackUrl = isTeamLeader && teamName
          ? `/dashboard/users?range=today&team=${encodeURIComponent(teamName)}`
          : '/dashboard/users?range=today';
        
        const fallbackResponse = await request<any>(fallbackUrl, { method: 'GET' });
        
        const list = fallbackResponse || [];
        const transformedUsers: NewUser[] = list.map((user: any) => ({
          id: user.employeeId || user.userId || '',
          userId: user.userId || '',
          name: user.employeeId || user.userId || '',
          avatar: '',
          watched: user.watched || 0,
          earnings: (user.earnings || 0) / 1000,
          ipCount: user.ipCount || 1,
          deviceCount: user.deviceCount || 1,
          ecpm: user.ecpm || 0,
          regDays: user.regDays || 1,
          superior: user.superior || '系统直属'
        }));
        
        setUsers(transformedUsers);
        
        const todayCount = transformedUsers.filter(u => u.regDays <= 1).length;
        setTodayNewUsers(todayCount);
        
        console.log('旧API加载成功');
      } catch (fallbackError) {
        console.error('旧API也失败:', fallbackError);
        setUsers([]);
        setTodayNewUsers(0);
      }
    } finally {
      setLoading(false);
    }
  }, [isTeamLeader, currentUser?.teamName]);

  useEffect(() => {
    fetchNewUsers();
  }, [fetchNewUsers]);

  const sortedUsers = useMemo(() => {
    const teamName = currentUser?.teamName || '';
    return [...users]
      .filter(u => {
        // 只显示注册15天以内的新人
        const isNewUser = u.regDays <= 15;
        const matchesSearch = u.id.includes(searchTerm) || u.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTeam = selectedTeam === '全部' || u.superior === selectedTeam;
        // 团队长只显示自己团队的用户
        const matchesTeamLeader = !isTeamLeader || (teamName && u.superior === teamName);
        // 上线状态筛选
        const matchesOnlineFilter = 
          onlineFilter === 'all' || 
          (onlineFilter === 'online' && u.isOnline) || 
          (onlineFilter === 'offline' && !u.isOnline);
        return isNewUser && matchesSearch && matchesTeam && matchesTeamLeader && matchesOnlineFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'regDays') {
          return a.regDays - b.regDays; // Low to High as requested
        }
        if (sortBy === 'agc') {
          const agcA = a.watched > 0 ? (a.earnings * 1000) / a.watched : 0;
          const agcB = b.watched > 0 ? (b.earnings * 1000) / b.watched : 0;
          return agcB - agcA;
        }
        return b[sortBy as 'watched' | 'earnings'] - a[sortBy as 'watched' | 'earnings'];
      });
  }, [users, sortBy, searchTerm, selectedTeam, onlineFilter, isTeamLeader, currentUser?.teamName]);

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-12 bg-gray-200 rounded-2xl w-full"></div>
        <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <UserPlus className="text-[#1E40AF] mr-2" size={24} />
            新人监控
            <span className="ml-2 px-2 py-0.5 bg-blue-50 text-[#1E40AF] text-[10px] rounded-lg font-bold">近15天</span>
          </h1>
          <div className="bg-green-50 px-2 py-1 rounded-full text-green-600 text-[10px] font-black border border-green-100">
             今日新增: {todayNewUsers}
          </div>
        </div>

        <div className="relative mb-3 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF]" size={16} />
            <input 
                type="text"
                placeholder="搜索新人 ID / 昵称..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Team Filter Pills - 只有超级管理员显示团队筛选 */}
        {isSuperAdmin && (
          <div className="flex items-center space-x-2 overflow-x-auto hide-scrollbar pb-3">
            <div className="flex-shrink-0 p-1.5 bg-gray-50 rounded-lg text-gray-400">
              <Users size={14} />
            </div>
            {teams.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border ${
                  selectedTeam === team 
                    ? 'bg-[#1E40AF] text-white border-[#1E40AF] shadow-sm' 
                    : 'bg-white text-gray-500 border-gray-100 active:bg-gray-50'
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        )}

        {/* 上线状态筛选 */}
        <div className="flex items-center space-x-2 overflow-x-auto hide-scrollbar pb-3">
            <div className="flex-shrink-0 p-1.5 bg-gray-50 rounded-lg text-gray-400">
              <Zap size={14} />
            </div>
            <button
                onClick={() => setOnlineFilter('all')}
                className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border ${
                    onlineFilter === 'all' 
                        ? 'bg-[#1E40AF] text-white border-[#1E40AF] shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-100 active:bg-gray-50'
                }`}
            >
                全部
            </button>
            <button
                onClick={() => setOnlineFilter('online')}
                className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border ${
                    onlineFilter === 'online' 
                        ? 'bg-green-500 text-white border-green-500 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-100 active:bg-gray-50'
                }`}
            >
                已上线
            </button>
            <button
                onClick={() => setOnlineFilter('offline')}
                className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border ${
                    onlineFilter === 'offline' 
                        ? 'bg-gray-500 text-white border-gray-500 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-100 active:bg-gray-50'
                }`}
            >
                未上线
            </button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
                onClick={() => setSortBy('regDays')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'regDays' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
            >
                注册天数↑
            </button>
            <button 
                onClick={() => setSortBy('agc')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'agc' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
            >
                按平均金币
            </button>
            <button 
                onClick={() => setSortBy('watched')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'watched' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
            >
                按次数
            </button>
            <button 
                onClick={() => setSortBy('earnings')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'earnings' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
            >
                按收益
            </button>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {sortedUsers.length > 0 ? (
            <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                {sortedUsers.map((user, idx) => (
                    <div 
                      key={user.id} 
                      className="p-4 space-y-3 active:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onSelectUser?.(user)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 flex items-center justify-center text-gray-900 text-xs font-bold">
                                      {user.id}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white ${
                                        idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-gray-200'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-col mt-0.5">
                                        <div className="flex items-center space-x-2 mb-0.5">
                                            {user.regDays <= 15 && (
                                                <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1 rounded border border-emerald-100 uppercase leading-tight">新人</span>
                                            )}
                                            {/* 显示是否上线状态 */}
                                            {user.isOnline !== undefined && (
                                                <span className={`text-[8px] font-black px-1 rounded border uppercase leading-tight ${
                                                    user.isOnline 
                                                        ? 'bg-green-50 text-green-600 border-green-100' 
                                                        : 'bg-gray-50 text-gray-400 border-gray-100'
                                                }`}>
                                                    {user.isOnline ? '已上线' : '未上线'}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-400 font-medium tracking-tight">团队: {user.superior || '无'}</span>
                                        </div>
                                        {/* 显示组别信息 */}
                                        {user.groupName && (
                                            <div className="text-[9px] text-gray-500 mt-0.5">
                                                组别: {user.groupName}
                                            </div>
                                        )}
                                        <div className="flex items-center text-[9px] font-bold text-indigo-500 mt-0.5">
                                            <Calendar size={10} className="mr-0.5" />
                                            注册 {user.regDays} 天
                                            {user.loginDays !== undefined && user.loginDays > 0 && (
                                                <span className="ml-2 text-gray-400 font-normal">
                                                    登录 {user.loginDays} 天
                                                </span>
                                            )}
                                        </div>
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
                                    ) : sortBy === 'regDays' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-indigo-600">{user.regDays}天</span>
                                                <span className="text-[9px] text-gray-400 font-medium">注册</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-gray-900">¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">收益</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${(user.watched > 0 ? ((user.earnings * 1000) / user.watched) >= 100 : false) ? 'text-green-600' : 'text-red-500'}`}>{(user.watched > 0 ? ((user.earnings * 1000) / user.watched) : 0).toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">平均金币</span>
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
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border ml-auto ${sortBy === 'agc' ? 'bg-[#1E40AF] border-[#1E40AF]' : 'bg-blue-50/30 border-blue-100/30'}`}>
                                <Zap size={10} className={sortBy === 'agc' ? 'text-white' : 'text-orange-500'} />
                                <span className={`text-[9px] font-medium uppercase tracking-tighter ${sortBy === 'agc' ? 'text-white/80' : 'text-gray-400'}`}>平均金币:</span>
                                <span className={`text-[10px] font-black ${sortBy === 'agc' ? 'text-white' : (user.watched > 0 ? ((user.earnings * 1000) / user.watched) >= 100 : false) ? 'text-green-600' : 'text-red-500'}`}>{(user.watched > 0 ? ((user.earnings * 1000) / user.watched) : 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-[28px] border border-dashed border-gray-200">
                <Search size={48} className="opacity-10 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">未找到符合条件的新人</p>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedTeam('全部');
                  }}
                  className="mt-4 text-[10px] text-[#1E40AF] font-black underline uppercase"
                >
                  清除所有筛选项
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default NewUsers;
