import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ChevronLeft, Globe, Smartphone, Zap, 
  ChevronRight
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface ListUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  watched: number;
  earnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  superior?: string;
  teamName?: string;
  groupName?: string;
}

interface UserListProps {
  onBack?: () => void;
  onSelectUser?: (user: any) => void;
}

const UserList: React.FC<UserListProps> = ({ onBack, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc'>('earnings');
  const [users, setUsers] = useState<ListUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(true);
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack: onBack || (() => {}) });
  
  // 添加昨日用户数据，用于计算次数对比
  const [yesterdayUserData, setYesterdayUserData] = useState<Record<string, number>>({});
  
  // 添加昨日用户收益数据，用于计算收益对比
  const [yesterdayEarningsData, setYesterdayEarningsData] = useState<Record<string, number>>({});
  
  // 获取用户对应的团队名称（与GroupLeader.tsx完全一致）
  const getUserTeamName = (user: any) => {
    return user?.teamName || '团队';
  };

  // 组件挂载时重置滚动位置到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // 重新获取最新的用户信息，确保teamGroupId是最新的（与GroupLeader.tsx完全一致）
        const updatedUser = authService.getCurrentUser();
        const isTeamLeader = updatedUser?.role === UserRole.NORMAL_ADMIN;
        const isGroupLeader = updatedUser?.role === UserRole.GROUP_LEADER;
        const teamName = updatedUser?.teamName || '团队';
        const groupName = updatedUser?.groupName || '组';
        const groupId = updatedUser?.teamGroupId || '';
        
        console.log('最新的用户信息:', {
          teamName,
          groupName,
          groupId
        });
        console.log('用户角色:', { isTeamLeader, isGroupLeader });
        console.log('团队和组信息:', { teamName, groupName, groupId });
        
        // 构建API路径（与GroupLeader.tsx完全一致）
        let userUrl = `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&group=${encodeURIComponent(groupId || '')}&limit=1000`;
        if (isTeamLeader) {
          userUrl = `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&limit=1000`;
        } else if (!isGroupLeader) {
          userUrl = `/admin/dashboard/users?range=today&limit=1000`;
        }
        
        console.log('用户数据 API 路径:', userUrl);
        
        // 获取用户数据（与GroupLeader.tsx完全一致）
        const userResult = await request<any[]>(userUrl).catch(error => {
          console.error('获取用户列表失败:', error);
          return [];
        });

        // 处理用户数据（与GroupLeader.tsx完全一致）
        const users = Array.isArray(userResult) ? userResult : [];
        console.log('用户列表总数:', users.length);
        console.log('用户数据:', users);

        // 过滤用户数据（与Dashboard.tsx完全一致）
        let filteredUsers = users;
        if (isTeamLeader) {
          console.log('团队长团队名称:', teamName);
          console.log('过滤前用户数:', users.length);
          filteredUsers = users.filter((user: any) => {
            const userTeam = user.teamName || user.superior || '系统直属';
            console.log('用户团队:', userTeam, '目标团队:', teamName, '是否匹配:', userTeam === teamName);
            return userTeam === teamName;
          });
          console.log('过滤后用户数:', filteredUsers.length);
          console.log('过滤后用户数据:', filteredUsers);
        } else if (isGroupLeader) {
          const teamGroupId = updatedUser?.teamGroupId;
          console.log('组ID:', teamGroupId);
          
          // 确保teamGroupId存在（与Dashboard.tsx完全一致）
          if (teamGroupId) {
            filteredUsers = users.filter((user: any) => {
              // 检查用户的组ID是否与组长的组ID匹配
              const userTeamGroupId = user.teamGroupId || user.groupId || '';
              console.log('用户组ID:', userTeamGroupId, '目标组ID:', teamGroupId, '是否匹配:', userTeamGroupId === teamGroupId);
              return userTeamGroupId === teamGroupId;
            });
          } else {
            // 如果组长没有组ID，不显示任何用户数据
            filteredUsers = [];
          }
          console.log('过滤后用户数据:', filteredUsers);
        }

        // 转换用户数据为ListUser格式
        const transformedUsers: ListUser[] = filteredUsers.map((user: any) => ({
          id: user.employeeId || user.userId || '',
          userId: user.userId || '',
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

        console.log('转换后的用户数据:', transformedUsers);
        setUsers(transformedUsers);
        
        // 同时获取昨日用户数据用于计算次数对比
        try {
          // 构建昨日用户数据API路径（与GroupLeader.tsx保持一致）
          let yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&limit=1000`;
          if (isTeamLeader) {
            yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&limit=1000`;
          } else if (isGroupLeader && groupId) {
            yesterdayUserUrl = `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&group=${encodeURIComponent(groupId)}&limit=1000`;
          }
          
          console.log('昨日用户数据 API 路径:', yesterdayUserUrl);
          
          // 获取昨日活跃用户数据
          const yesterdayUserResponse = await request<any>(yesterdayUserUrl, {
            method: 'GET',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          });
          
          // 检查API返回类型，确保是数组
          const yesterdayUserData = Array.isArray(yesterdayUserResponse) ? yesterdayUserResponse : [];
          console.log('昨日用户数据长度:', yesterdayUserData.length);
          console.log('昨日用户数据:', yesterdayUserData);
          
          // 构建用户ID到次数和收益的映射
          const yesterdayUserMap: Record<string, number> = {};
          const yesterdayEarningsMap: Record<string, number> = {};
          yesterdayUserData.forEach((user: any) => {
            const userId = user.employeeId || user.userId || '';
            yesterdayUserMap[userId] = user.watched || 0;
            yesterdayEarningsMap[userId] = (user.earnings || 0) / 1000;
          });
          
          setYesterdayUserData(yesterdayUserMap);
          setYesterdayEarningsData(yesterdayEarningsMap);
        } catch (error) {
          console.error('Error fetching yesterday user data:', error);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredAndSortedUsers = useMemo(() => {
    return users
      .filter(user => 
        user.id.includes(searchTerm) || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'agc') {
          const agcA = a.watched > 0 ? (a.earnings * 1000) / a.watched : 0;
          const agcB = b.watched > 0 ? (b.earnings * 1000) / b.watched : 0;
          return agcB - agcA;
        }
        return b[sortBy] - a[sortBy];
      });
  }, [searchTerm, sortBy, users]);

  return (
    <div ref={swipeRef} className="pb-6 animate-in slide-in-from-right duration-300 min-h-screen bg-[#F9FAFB]">
      <header className="sticky top-0 bg-white z-50 border-b border-gray-100">
        <div className="px-4 py-4 flex items-center">
            {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
                <ChevronLeft size={24} />
            </button>
            )}
            <h1 className={`flex-1 font-bold text-gray-900 ${onBack ? 'text-center mr-8' : ''}`}>
                全部用户
            </h1>
        </div>

        <div className="px-4 pb-3">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={18} />
                <input 
                    type="text"
                    placeholder="按用户 ID 或昵称快速查找..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="px-4 pb-4 flex items-center justify-between">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full">
                <button 
                    onClick={() => setSortBy('agc')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'agc' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-400'}`}
                >
                    按平均金币
                </button>
                <button 
                    onClick={() => setSortBy('watched')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'watched' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-400'}`}
                >
                    按次数
                </button>
                <button 
                    onClick={() => setSortBy('earnings')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'earnings' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-400'}`}
                >
                    按收益
                </button>
            </div>
        </div>
      </header>

      <div className="px-4 py-3 flex items-center justify-between text-gray-400">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">匹配结果: <span className="text-[#1E40AF] font-black text-[11px]">{filteredAndSortedUsers.length}</span> 位用户</span>
          <button 
            onClick={() => setShowGroupInfo(!showGroupInfo)}
            className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${showGroupInfo ? 'bg-[#1E40AF] text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}
          >
            {showGroupInfo ? '隐藏组别' : '显示组别'}
          </button>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            加载中...
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {filteredAndSortedUsers.length > 0 ? (
                filteredAndSortedUsers.map((user, idx) => (
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
                                    {searchTerm === '' && (
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white ${
                                            idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-gray-200'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    {showGroupInfo && (
                                      <div className="text-sm font-bold text-gray-900 truncate">组别: {user.groupName || '无'}</div>
                                    )}
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
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border ml-auto ${sortBy === 'agc' ? 'bg-blue-600 border-blue-600' : 'bg-blue-50/30 border-blue-100/30'}`}>
                                <Zap size={10} className={sortBy === 'agc' ? 'text-white' : 'text-orange-500'} />
                                <span className={`text-[9px] font-medium uppercase tracking-tighter ${sortBy === 'agc' ? 'text-white/80' : 'text-gray-400'}`}>平均金币:</span>
                                <span className={`text-[10px] font-black ${sortBy === 'agc' ? 'text-white' : (user.watched > 0 ? ((user.earnings * 1000) / user.watched) >= 100 : false) ? 'text-green-600' : 'text-red-500'}`}>{(user.watched > 0 ? ((user.earnings * 1000) / user.watched) : 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                    <Search size={48} className="opacity-10 mb-4" />
                    <p className="text-xs font-bold">未找到匹配 ID 的用户</p>
                    <button 
                        onClick={() => setSearchTerm('')}
                        className="mt-4 text-[10px] text-[#1E40AF] font-black uppercase underline"
                    >
                        清除所有筛选
                    </button>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;
