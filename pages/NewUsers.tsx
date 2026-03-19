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
  console.log('currentUser:', currentUser);
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  console.log('isTeamLeader:', isTeamLeader);
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc' | 'regDays'>('regDays');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('全部');
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [users, setUsers] = useState<NewUser[]>([]);
  // 添加昨日用户数据，用于计算次数对比
  const [yesterdayUserData, setYesterdayUserData] = useState<Record<string, number>>({});
  // 添加昨日用户收益数据，用于计算收益对比
  const [yesterdayEarningsData, setYesterdayEarningsData] = useState<Record<string, number>>({});
  // 计算今日新增用户数（注册天数为1的用户）
  const todayNewUsers = useMemo(() => {
    const teamNameMap: Record<string, string> = {
      'cuiding': '鼎盛战队',
      'cuijie': '花好月圆战队',
      'huangzhenhui': '四季发财战队'
    };
    const teamNameToMatch = currentUser?.teamName || teamNameMap[currentUser?.username || ''] || '';
    
    return users.filter(u => {
      const isTodayNew = u.regDays <= 1;
      const matchesTeamLeader = !isTeamLeader || (teamNameToMatch && u.superior === teamNameToMatch);
      return isTodayNew && matchesTeamLeader;
    }).length;
  }, [users, isTeamLeader, currentUser?.teamName, currentUser?.username]);
  
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
      // 同时请求新人列表和今日详细数据
      const teamName = currentUser?.teamName || '';
      const teamId = currentUser?.id || '';
      console.log('currentUser:', currentUser);
      console.log('teamName:', teamName);
      console.log('teamId:', teamId);
      console.log('isTeamLeader:', isTeamLeader);
      
      let newUsersUrl = '/user/new-users?days=15';
      
      // 团队长添加团队筛选参数
      if (isTeamLeader) {
        if (teamId) {
          newUsersUrl += `&teamId=${encodeURIComponent(teamId)}`;
        } else if (teamName) {
          newUsersUrl += `&team=${encodeURIComponent(teamName)}`;
        }
      }
      
      // 构建今日详细数据API URL（与首页全部用户一致）
      const teamNameMap: Record<string, string> = {
        'cuiding': '鼎盛战队',
        'cuijie': '花好月圆战队',
        'huangzhenhui': '四季发财战队'
      };
      const teamNameToMatch = currentUser?.teamName || teamNameMap[currentUser?.username || ''] || '';
      let todayDataUrl = isTeamLeader 
        ? `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamNameToMatch)}&limit=1000`
        : '/admin/dashboard/users?range=today&limit=1000';
      
      console.log('新人API请求URL:', newUsersUrl);
      console.log('今日数据API请求URL:', todayDataUrl);
      
      // 构建昨日详细数据API URL（与首页全部用户一致）
      const yesterdayDataUrl = isTeamLeader 
        ? `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamNameToMatch)}&limit=1000`
        : '/admin/dashboard/users?range=yesterday&limit=1000';
      
      // 并行请求API
      const [newUsersResponse, todayDataResponse, yesterdayDataResponse] = await Promise.all([
        request<any>(newUsersUrl, { method: 'GET' }),
        request<any>(todayDataUrl, { method: 'GET' }).catch(() => []),
        request<any>(yesterdayDataUrl, { method: 'GET' }).catch(() => [])
      ]);
      
      const apiTime = performance.now() - startTime;
      console.log(`API请求时间: ${apiTime.toFixed(2)}ms`);
      console.log('新人API响应:', newUsersResponse);
      console.log('今日数据API响应:', todayDataResponse);
      console.log('今日数据API响应长度:', todayDataResponse.length);
      
      // 构建今日详细数据映射（用于匹配）
      const todayDataMap: Record<string, any> = {};
      if (Array.isArray(todayDataResponse)) {
        todayDataResponse.forEach((user: any) => {
          const userId = user.employeeId || user.userId || '';
          if (userId) {
            todayDataMap[userId] = user;
          }
        });
      }
      console.log('今日数据映射:', todayDataMap);
      console.log('今日数据映射长度:', Object.keys(todayDataMap).length);
      
      // 检查今日数据中的字段
      if (Array.isArray(todayDataResponse) && todayDataResponse.length > 0) {
        console.log('今日数据第一个用户的字段:', Object.keys(todayDataResponse[0]));
        console.log('今日数据第一个用户:', todayDataResponse[0]);
      }
      
      // 处理昨日数据响应，构建昨日用户数据映射
      const yesterdayUserDataMap: Record<string, number> = {};
      const yesterdayEarningsDataMap: Record<string, number> = {};
      if (Array.isArray(yesterdayDataResponse)) {
        console.log('昨日数据API响应长度:', yesterdayDataResponse.length);
        if (yesterdayDataResponse.length > 0) {
          console.log('昨日数据第一个用户的字段:', Object.keys(yesterdayDataResponse[0]));
          console.log('昨日数据第一个用户:', yesterdayDataResponse[0]);
        }
        yesterdayDataResponse.forEach((user: any) => {
          const userId = user.employeeId || user.userId || '';
          if (userId) {
            yesterdayUserDataMap[userId] = user.watched || 0;
            yesterdayEarningsDataMap[userId] = (user.earnings || 0) / 1000;
          }
        });
      }
      console.log('昨日用户数据映射:', yesterdayUserDataMap);
      console.log('昨日用户收益数据映射:', yesterdayEarningsDataMap);
      
      // 更新昨日用户数据状态
      setYesterdayUserData(yesterdayUserDataMap);
      setYesterdayEarningsData(yesterdayEarningsDataMap);
      
      // request函数会直接返回data字段的内容，所以response已经是用户数组
      const list = Array.isArray(newUsersResponse) ? newUsersResponse : [];
      console.log('list长度:', list.length);
      
      // 打印前5个用户，看看是否有5555用户
      console.log('前5个用户:', list.slice(0, 5));
      
      // 检查5555用户是否在列表中
      const user5555 = list.find(u => u.employeeId === '5555');
      console.log('5555用户:', user5555);
      
      // 使用更高效的数据转换，并从今日详细数据中获取IP、设备、收益、次数
      const currentTime = Date.now();
      const transformedUsers: NewUser[] = list.map((user: any) => {
        const registerTime = user.registerTime ? new Date(user.registerTime).getTime() : currentTime;
        const regDays = Math.ceil((currentTime - registerTime) / (1000 * 60 * 60 * 24)) || 1;
        const userId = user.employeeId || user.userId || '';
        
        // 从今日详细数据中获取IP、设备、收益、次数（与首页全部用户一致）
        const todayData = todayDataMap[userId];
        
        return {
          id: userId,
          userId: user.userId || '',
          name: user.name || user.nickname || user.realName || user.employeeId || user.userId || '',
          avatar: '',
          watched: todayData?.watched || 0,
          earnings: todayData ? (todayData.earnings || 0) / 1000 : 0,
          ipCount: todayData?.ipCount || 1,
          deviceCount: todayData?.deviceCount || 1,
          ecpm: todayData?.ecpm || 0,
          regDays: regDays,
          superior: user.teamName || user.teamLeaderName || '系统直属',
          isOnline: (todayData?.watched || 0) > 0,
          groupName: user.groupName,
          groupLeaderName: user.groupLeaderName,
          lastActiveTime: user.lastActiveTime,
          loginDays: user.loginDays
        };
      });
      
      // 检查5555用户的regDays
      const user5555Transformed = transformedUsers.find(u => u.id === '5555');
      if (user5555Transformed) {
        console.log('5555用户的regDays:', user5555Transformed.regDays);
      }
      
      // 去重：根据employeeId去重，避免重复的8202用户
      const uniqueUsers = Array.from(new Map(transformedUsers.map(user => [user.id, user])).values());
      console.log('去重后的用户数:', uniqueUsers.length);
      console.log('去重后的用户列表:', uniqueUsers.map(u => u.id));
      console.log('用户上线状态:', uniqueUsers.map(u => ({ id: u.id, isOnline: u.isOnline })));
      
      console.log('转换后的用户数:', transformedUsers.length);
      console.log('第一个用户:', transformedUsers[0]);
      
      setUsers(uniqueUsers);
      
      const totalTime = performance.now() - startTime;
      console.log(`新人数据总加载时间: ${totalTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('新API失败，回退到旧API:', error);
      
      // 回退到旧API
      try {
        const teamName = currentUser?.teamName || '';
        const teamId = currentUser?.id || '';
        let fallbackUrl = '/dashboard/users?range=today';
        
        if (isTeamLeader) {
          if (teamName) {
            fallbackUrl += `&team=${encodeURIComponent(teamName)}`;
          } else if (teamId) {
            fallbackUrl += `&teamId=${encodeURIComponent(teamId)}`;
          }
        }
        
        const fallbackResponse = await request<any>(fallbackUrl, { method: 'GET' });
        
        const list = fallbackResponse || [];
        const transformedUsers: NewUser[] = list.map((user: any) => ({
          id: user.employeeId || user.userId || '',
          userId: user.userId || '',
          name: user.name || user.nickname || user.realName || user.employeeId || user.userId || '',
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
        
        console.log('旧API加载成功');
      } catch (fallbackError) {
        console.error('旧API也失败:', fallbackError);
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isTeamLeader, currentUser?.teamName, currentUser?.id]);

  useEffect(() => {
    fetchNewUsers();
  }, [fetchNewUsers]);

  // 计算全部、已上线和未上线用户的数量
  const userCounts = useMemo(() => {
    const teamNameMap: Record<string, string> = {
      'cuiding': '鼎盛战队',
      'cuijie': '花好月圆战队',
      'huangzhenhui': '四季发财战队'
    };
    const teamNameToMatch = currentUser?.teamName || teamNameMap[currentUser?.username || ''] || '';
    
    const baseFiltered = users.filter(u => {
      const isNewUser = u.regDays <= 15;
      const matchesSearch = u.id.includes(searchTerm) || u.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeam = selectedTeam === '全部' || u.superior === selectedTeam;
      const matchesTeamLeader = !isTeamLeader || (teamNameToMatch && u.superior === teamNameToMatch);
      return isNewUser && matchesSearch && matchesTeam && matchesTeamLeader;
    });
    
    const all = baseFiltered.length;
    const online = baseFiltered.filter(u => u.isOnline).length;
    const offline = baseFiltered.filter(u => !u.isOnline || u.isOnline === undefined).length;
    
    return { all, online, offline };
  }, [users, searchTerm, selectedTeam, isTeamLeader, currentUser?.teamName, currentUser?.username]);

  const sortedUsers = useMemo(() => {
    // 检查users数组
    console.log('users数组长度:', users.length);
    console.log('users数组内容:', users.map(u => ({ id: u.id, regDays: u.regDays, superior: u.superior })));
    
    const filtered = [...users]
      .filter(u => {
        // 只显示注册15天以内的新人
        const isNewUser = u.regDays <= 15;
        const matchesSearch = u.id.includes(searchTerm) || u.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTeam = selectedTeam === '全部' || u.superior === selectedTeam;
        // 上线状态筛选
        const matchesOnlineFilter = 
          onlineFilter === 'all' || 
          (onlineFilter === 'online' && u.isOnline) || 
          (onlineFilter === 'offline' && (u.isOnline === false || u.isOnline === undefined));
        // 团队长只能看到自己团队的用户
        // 直接通过superior字段过滤
        // 当currentUserTeamName为空时，根据团队长username判断团队
        console.log('团队长过滤信息:', { isTeamLeader, currentUserTeamName: currentUser?.teamName, userSuperior: u.superior, userId: u.id, currentUsername: currentUser?.username });
        // 团队长username到团队名称的映射
        const teamNameMap: Record<string, string> = {
          'cuiding': '鼎盛战队',
          'cuijie': '花好月圆战队',
          'huangzhenhui': '四季发财战队'
        };
        const teamNameToMatch = currentUser?.teamName || teamNameMap[currentUser?.username || ''] || '';
        const matchesTeamLeader = !isTeamLeader || (teamNameToMatch && u.superior === teamNameToMatch);
        
        // 检查5555和9527用户的过滤条件
        if (u.id === '5555' || u.id === '9527') {
          console.log(`${u.id}用户的过滤条件:`, { isNewUser, matchesSearch, matchesTeam, matchesOnlineFilter, matchesTeamLeader, superior: u.superior, userTeamName: currentUser?.teamName });
        }
        
        return isNewUser && matchesSearch && matchesTeam && matchesOnlineFilter && matchesTeamLeader;
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
    
    return filtered;
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
                全部 ({userCounts.all})
            </button>
            <button
                onClick={() => setOnlineFilter('online')}
                className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border ${
                    onlineFilter === 'online' 
                        ? 'bg-green-500 text-white border-green-500 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-100 active:bg-gray-50'
                }`}
            >
                已上线 ({userCounts.online})
            </button>
            <button
                onClick={() => setOnlineFilter('offline')}
                className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border ${
                    onlineFilter === 'offline' 
                        ? 'bg-gray-500 text-white border-gray-500 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-100 active:bg-gray-50'
                }`}
            >
                未上线 ({userCounts.offline})
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
                      onClick={() => {
                        // 不传递name字段，让UserDetail不显示姓名
                        const { name, ...userWithoutName } = user;
                        onSelectUser?.(userWithoutName);
                      }}
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
                                        </div>
                                        {/* 显示组别信息 */}
                                        <div className="text-[9px] text-gray-500 mt-0.5">
                                            组别: {user.groupName || '无'}
                                        </div>
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
                                                <span className={`text-[11px] font-black ${yesterdayEarningsData[user.id] !== undefined ? (user.earnings > yesterdayEarningsData[user.id] ? 'text-green-600' : user.earnings < yesterdayEarningsData[user.id] ? 'text-red-500' : 'text-gray-900') : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${yesterdayUserData[user.id] !== undefined ? (user.watched > yesterdayUserData[user.id] ? 'text-green-600' : user.watched < yesterdayUserData[user.id] ? 'text-red-500' : 'text-gray-900') : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                        </>
                                    ) : sortBy === 'watched' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${yesterdayUserData[user.id] !== undefined ? (user.watched > yesterdayUserData[user.id] ? 'text-green-600' : user.watched < yesterdayUserData[user.id] ? 'text-red-500' : 'text-gray-900') : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${yesterdayEarningsData[user.id] !== undefined ? (user.earnings > yesterdayEarningsData[user.id] ? 'text-green-600' : user.earnings < yesterdayEarningsData[user.id] ? 'text-red-500' : 'text-gray-500') : 'text-gray-500'}`}>¥{user.earnings.toFixed(2)}</span>
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
                                                <span className={`text-[11px] font-black ${yesterdayEarningsData[user.id] !== undefined ? (user.earnings > yesterdayEarningsData[user.id] ? 'text-green-600' : user.earnings < yesterdayEarningsData[user.id] ? 'text-red-500' : 'text-gray-900') : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
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
                                                <span className={`text-[11px] font-black ${yesterdayEarningsData[user.id] !== undefined ? (user.earnings > yesterdayEarningsData[user.id] ? 'text-green-600' : user.earnings < yesterdayEarningsData[user.id] ? 'text-red-500' : 'text-gray-500') : 'text-gray-500'}`}>¥{user.earnings.toFixed(2)}</span>
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
