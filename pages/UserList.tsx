import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ChevronLeft, Globe, Smartphone, Zap, 
  ChevronRight
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { cacheManager } from '../services/cacheManager';
import { transformUsers } from '../utils/transformUser';

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
  teamGroupId?: string;
  groupName?: string;
  regDays: number;
  /** 上级账号（username，稳定推荐人，优先取） */
  supervisorUsername?: string;
  /** 上级真实姓名（优先显示） */
  supervisorRealName?: string;
  /** 兼容字段：上级账号名 */
  supervisorName?: string;
  /** 是否当前查看者的直推用户。TL/GL 视角返回；超管视角不返回该字段 → badge 自动隐藏 */
  isDirect?: boolean;
  /**
   * 来源细分，hover 作为 tooltip 展示：
   * - directD: TL 的直属D（直推）
   * - subGroupG: TL 下属组长的组内G（间推）
   * - subTlDirectD: TL 下属TL的直属D（间推）
   * - glGroupG: 组长组内的G（组长视角全员直推）
   */
  sourceKind?: 'directD' | 'subGroupG' | 'subTlDirectD' | 'glGroupG' | string;
}

interface UserListProps {
  onBack?: () => void;
  onSelectUser?: (user: any) => void;
  timeRange?: string;
}

const UserList: React.FC<UserListProps> = ({ onBack, onSelectUser, timeRange = 'today' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc'>('earnings');
  const [memberFilter, setMemberFilter] = useState<'all' | 'direct' | 'indirect'>('all');
  const [showSupervisor, setShowSupervisor] = useState(true);
  const [users, setUsers] = useState<ListUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack: onBack || (() => {}) });
  
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
        
        // 检查是否有缓存数据（加 v3 后缀强制老缓存失效）
        const userListCacheKey = `user_list_${timeRange}_${updatedUser?.id}_v3`;
        const cachedData = cacheManager.get(userListCacheKey, 300000); // 5分钟缓存
        
        if (cachedData && Array.isArray(cachedData.users) && cachedData.users.length > 0) {
          // 使用缓存数据
          console.log('[UserList] 使用缓存的用户列表数据，条数:', cachedData.users.length);
          setUsers(cachedData.users);
          setLoading(false);
          return;
        }
        
        // 构建API路径（严格对齐 Dashboard.tsx 的 URL，不要加多余参数避免后端过滤）
        let userUrl = `/admin/dashboard/users?range=${timeRange}`;
        if (isTeamLeader) {
          userUrl = `/admin/dashboard/users?range=${timeRange}&team=${encodeURIComponent(teamName)}`;
        } else if (isGroupLeader) {
          userUrl = `/admin/dashboard/users?range=${timeRange}&group=${encodeURIComponent(groupId || '')}`;
        }
        
        console.log('用户数据 API 路径:', userUrl);
        
        // 获取用户数据（与Dashboard.tsx完全一致）
        const userResult = await request<any>(userUrl).catch(error => {
          console.error('获取用户列表失败:', error);
          return null;
        });

        // 处理用户数据：对齐 Dashboard L687 的三层解包逻辑
        // - 第1优先级：响应本身是数组（request已解一层data）
        // - 第2优先级：响应是对象，再取 response.data 数组
        // - 第3优先级：再取 response.list 数组（后端list命名兜底）
        const users = Array.isArray(userResult)
          ? userResult
          : (typeof userResult === 'object' && userResult !== null)
            ? (Array.isArray(userResult.data) ? userResult.data
               : Array.isArray(userResult.list) ? userResult.list
               : [])
            : [];
        console.log('用户列表总数:', users.length);
        console.log('用户数据:', users.slice(0, 3));

        // ✅ 不再做前端二次过滤：之前用 user.teamName === TL.teamName 过滤，但后端现在 user.superior 已改成上级账号名（fanjie/cuiding），永远不等于团队名，导致被过滤成0条

        // 转换用户数据为ListUser格式
        const transformedUsers: ListUser[] = users.map((user: any) => ({
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
          teamGroupId: user.teamGroupId || user.groupId || '',
          groupName: user.groupName || user.teamGroup || '',
          regDays: user.regDays || 1,
          supervisorUsername: user.supervisorUsername || undefined,
          supervisorRealName: user.supervisorRealName || undefined,
          supervisorName: user.supervisorName || undefined,
          isDirect: typeof user.isDirect === 'boolean' ? user.isDirect : undefined,
          sourceKind: user.sourceKind || undefined,
        }));

        console.log('转换后的用户数据:', transformedUsers);
        
        // 去重：根据id去重
        const uniqueUsers = Array.from(new Map(transformedUsers.map(user => [user.id, user])).values());
        console.log('去重后的用户数:', uniqueUsers.length);
        console.log('去重后的用户列表:', uniqueUsers.map(u => u.id));
        
        setUsers(uniqueUsers);
        
        // 缓存数据
        if (updatedUser?.id) {
          cacheManager.set(userListCacheKey, {
            users: uniqueUsers
          });
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
    // Step 1: searchKeyword 过滤（按用户id或姓名，与Dashboard一致）
    let filteredList = users.filter(user => {
      if (searchTerm === '') return true;
      const keyword = searchTerm.toLowerCase();
      return user.id.toLowerCase().includes(keyword) ||
             user.userId.toLowerCase().includes(keyword) ||
             user.name.toLowerCase().includes(keyword);
    });

    // Step 2: memberFilter 直推/间推过滤（超管和高管不生效）
    const currentUser = authService.getCurrentUser();
    const roleUpper = String(currentUser?.role || '').toUpperCase().replace(/_/g, '');
    const isSuperOrManager =
      roleUpper === String(UserRole.SUPER_ADMIN).toUpperCase().replace(/_/g, '') ||
      roleUpper === String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '') ||
      roleUpper === 'SUPERADMIN';
    if (!isSuperOrManager) {
      const hasDirectTag = filteredList.some(u => typeof u.isDirect === 'boolean');
      if (hasDirectTag) {
        if (memberFilter === 'direct') {
          filteredList = filteredList.filter(u => u.isDirect === true);
        } else if (memberFilter === 'indirect') {
          filteredList = filteredList.filter(u => u.isDirect === false);
        }
      }
    }

    // Step 3: 排序
    return filteredList.sort((a, b) => {
      if (sortBy === 'agc') {
        const agcA = a.watched > 0 ? (a.earnings * 1000) / a.watched : 0;
        const agcB = b.watched > 0 ? (b.earnings * 1000) / b.watched : 0;
        return agcB - agcA;
      }
      return b[sortBy] - a[sortBy];
    });
  }, [searchTerm, sortBy, users, memberFilter]);

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

      {/* 筛选栏：左=匹配结果+显隐上级按钮，右=全部/直推/间推pill（有isDirect字段才显示） */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap flex-shrink-0">匹配结果: <span className="text-[#1E40AF] font-black text-[11px]">{filteredAndSortedUsers.length}</span> 位用户</span>
              <button
                onClick={() => setShowSupervisor(!showSupervisor)}
                className={`flex-shrink-0 px-2.5 py-0.5 text-[9px] font-bold rounded-full transition-all border shadow-sm ${showSupervisor ? 'bg-[#1E40AF] text-white border-[#1E40AF]' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {showSupervisor ? '隐藏上级' : '显示上级'}
              </button>
          </div>
          {(() => {
            const currentUser = authService.getCurrentUser();
            const roleUpper = String(currentUser?.role || '').toUpperCase().replace(/_/g, '');
            const isSuperOrManager =
              roleUpper === String(UserRole.SUPER_ADMIN).toUpperCase().replace(/_/g, '') ||
              roleUpper === String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '') ||
              roleUpper === 'SUPERADMIN';
            if (isSuperOrManager) return null;
            const hasDirectTag = users.some(u => typeof u.isDirect === 'boolean');
            if (!hasDirectTag) return null;
            return (
              <div className="flex bg-gray-50 p-0.5 rounded-md border border-gray-200 shadow-sm flex-shrink-0">
                <button
                  onClick={() => setMemberFilter('all')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-[5px] transition-all duration-200 ${memberFilter === 'all' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  全部
                </button>
                <button
                  onClick={() => setMemberFilter('direct')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-[5px] transition-all duration-200 ${memberFilter === 'direct' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  直推
                </button>
                <button
                  onClick={() => setMemberFilter('indirect')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-[5px] transition-all duration-200 ${memberFilter === 'indirect' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  间推
                </button>
              </div>
            );
          })()}
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
            <p className="text-xs text-gray-400 font-bold">加载中...</p>
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
                                    {/* 姓名 + 直推/间推徽章（只有有isDirect字段才显示） */}
                                    <div className="flex items-center space-x-1.5 overflow-hidden">
                                        <div className="text-sm font-bold text-gray-900 truncate flex-shrink-0">{user.name}</div>
                                        {(() => {
                                            const currentUser = authService.getCurrentUser();
                                            const roleUpper = String(currentUser?.role || '').toUpperCase().replace(/_/g, '');
                                            const isSuperOrManager =
                                              roleUpper === String(UserRole.SUPER_ADMIN).toUpperCase().replace(/_/g, '') ||
                                              roleUpper === String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '') ||
                                              roleUpper === 'SUPERADMIN';
                                            if (isSuperOrManager) return null;
                                            if (typeof user.isDirect !== 'boolean') return null;
                                            return (
                                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full leading-tight flex-shrink-0 shadow-sm border text-white ${
                                                user.isDirect
                                                  ? 'bg-blue-600 border-blue-700'
                                                  : 'bg-orange-500 border-orange-600'
                                              }`}>
                                                {user.isDirect ? '直推' : '间推'}
                                              </span>
                                            );
                                          })()}
                                    </div>
                                    {showSupervisor ? (
                                      <div className="text-[10px] text-gray-400 font-medium tracking-tight flex items-center overflow-hidden mt-1 space-x-1.5">
                                          <span className="text-gray-600 font-semibold flex-shrink-0">上级:</span>
                                          <span className="text-[#1E40AF] font-bold min-w-0 whitespace-nowrap">
                                            {(() => {
                                              // ✅ 严格只认「上级真实姓名」，其他字段（superior / teamName / supervisorUsername / ...）一律忽略
                                              // —— 这些字段后端可能写成"李想代理群"（组名）或"lixiang"（账号），不符合"显示范洁就可以"的要求
                                              const realName = (user.supervisorRealName || '').trim();
                                              return realName || '系统直属';
                                            })()}
                                          </span>
                                          <span className="text-gray-300 flex-shrink-0">•</span>
                                          <span className="text-gray-400 flex-shrink-0">注册{user.regDays}天</span>
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-gray-400 font-medium tracking-tight mt-1">
                                          注册{user.regDays}天
                                      </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 flex-shrink-0">
                                <div className="text-right flex flex-col space-y-0.5">
                                    {sortBy === 'earnings' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                        </>
                                    ) : sortBy === 'watched' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-500'}`}>¥{user.earnings.toFixed(2)}</span>
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
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-500'}`}>¥{user.earnings.toFixed(2)}</span>
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
