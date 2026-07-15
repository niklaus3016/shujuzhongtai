
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Users2, TrendingUp, ChevronRight, Filter, Award, 
  PlayCircle, ChevronLeft, Search, Zap, Globe, Smartphone, TrendingDown, X, UserPlus, User, Edit2, Trash2, Star, Crown, Phone, MapPin, ChevronDown, RefreshCw, Check
} from 'lucide-react';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import EmployeeManagement from '../components/EmployeeManagement';
import TeamLeaderDashboard from '../components/TeamLeaderDashboard';
import GroupManagement from './GroupManagement';
import { request } from '../services/api';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { cacheManager } from '../services/cacheManager';

interface TeamItem {
  id?: string; // 可选字段，API返回中可能没有
  teamId?: string; // 同 id，接口可能有别名
  name?: string; // 同 teamName，接口可能有别名
  teamName: string;
  leaderId: string;
  leader?: string;
  memberCount: number;
  totalAds: number;
  totalRevenue: number;
  avgGold: number;
  growthRate: number;
}

interface TeamApiResponse {
  success: boolean;
  data: TeamItem[];
  totalTeams: number;
  totalMembers: number;
}

interface MemberInfo {
  id: string;
  name: string;
  avatar: string;
  todayWatched: number;
  monthlyWatched: number;
  todayEarnings: number;
  monthlyEarnings: number;
  todayAgc: number;
  monthlyAgc: number;
  status: '在线' | '离线';
}

const TeamMemberDetail: React.FC<{ team: TeamItem; mode: 'today' | 'month'; onBack: () => void }> = ({ team, mode, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc'>('earnings');
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        // 使用后端直接计算好的团队成员数据
        const membersData = await request<any[]>(`/admin/dashboard/team-leader/teams/${team.leaderId}/members?mode=${mode}`, {
          method: 'GET'
        });
        
        // 后端已处理好数据，直接使用
        console.log('Team members API response:', membersData);
        setMembers(membersData || []);
      } catch (error: any) {
        console.error('Error fetching members:', error);
        setError(error.message || '获取成员列表失败');
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [team.leaderId, mode]);

  // 直接使用后端返回的平均金币值
  const membersWithAgc = useMemo(() => {
    return members.map(member => ({
      ...member,
      agc: mode === 'today' ? member.todayAgc : member.monthlyAgc
    }));
  }, [members, mode]);

  // Sort by selected criteria and filter by search term
  const sortedAndFilteredMembers = useMemo(() => {
    return membersWithAgc
      .filter(m => m.name.includes(searchTerm) || m.id.includes(searchTerm))
      .sort((a, b) => {
        if (sortBy === 'watched') {
          const valA = mode === 'today' ? a.todayWatched : a.monthlyWatched;
          const valB = mode === 'today' ? b.todayWatched : b.monthlyWatched;
          return valB - valA; // High to Low
        } else if (sortBy === 'earnings') {
          const valA = mode === 'today' ? a.todayEarnings : a.monthlyEarnings;
          const valB = mode === 'today' ? b.todayEarnings : b.monthlyEarnings;
          return valB - valA; // High to Low
        } else { // agc - Average Gold Coin
          return b.agc - a.agc; // High to Low
        }
      });
  }, [membersWithAgc, searchTerm, mode, sortBy]);

  // 计算实际的成员数量和活跃率
  const actualMemberCount = members.length;
  const activeMembers = members.filter(m => m.status === '在线').length;
  const actualActiveRate = actualMemberCount > 0 ? `${Math.round((activeMembers / actualMemberCount) * 100)}%` : '0%';

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-50 px-4 py-4 border-b border-gray-100 shadow-sm">
        <div className="flex items-center mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 ml-2">
            <h1 className="text-lg font-bold text-gray-900">{team.leader} 团队成员</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
              共 {actualMemberCount} 位成员 • {mode === 'today' ? '今日' : '本月'}活跃率 {actualActiveRate}
            </p>
          </div>
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
          <button
            onClick={() => setSortBy('agc')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'agc' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
          >
            按平均金币
          </button>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {sortedAndFilteredMembers.map((member, idx) => (
          <div key={`${member.id || idx}-${idx}`} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500`}>
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
                      ¥ {Number(mode === 'today' ? member.todayEarnings : member.monthlyEarnings).toFixed(2)}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                      {mode === 'today' ? '今日预计收益' : '本月累计收益'}
                    </div>
                  </>
                ) : sortBy === 'watched' ? (
                  <>
                    <div className="text-xs font-black text-[#1E40AF]">
                      {(mode === 'today' ? member.todayWatched : member.monthlyWatched).toLocaleString()}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                      {mode === 'today' ? '今日观看次数' : '本月观看次数'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`text-xs font-black ${member.agc >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                      {member.agc.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                      {mode === 'today' ? '个人平均金币' : '月均平均金币'}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  {mode === 'today' ? '观看次数' : '本月次数'}
                </div>
                <div className="text-[11px] font-black text-gray-700">
                  {(mode === 'today' ? member.todayWatched : member.monthlyWatched).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  {mode === 'today' ? '个人平均金币' : '月均平均金币'}
                </div>
                <div className={`text-[11px] font-black ${member.agc >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                  {member.agc.toFixed(2)}
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

        {error && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <X size={32} className="text-red-400" />
            </div>
            <p className="text-xs text-red-500 font-bold mb-2">获取成员列表失败</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                setLoading(true);
                const token = localStorage.getItem('admin_token');
                console.log('Current token:', token);
                fetch(`/api/admin/team/members?teamId=${team.leaderId}&mode=${mode}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  }
                }).then(response => response.json()).then(result => {
                  console.log('API response:', result);
                  setMembers(result.data?.members || result.members || result || []);
                }).catch(err => {
                  console.error('Error:', err);
                  setError(err.message || '获取成员列表失败');
                }).finally(() => {
                  setLoading(false);
                });
              }}
              className="mt-4 px-4 py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && sortedAndFilteredMembers.length === 0 && (
          <div className="py-20 text-center">
            <Search className="mx-auto text-gray-200 mb-2" size={48} />
            <p className="text-xs text-gray-400 font-bold">未找到符合条件的成员</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Team: React.FC = () => {
  const [sortBy, setSortBy] = useState<'today' | 'month'>('today');
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('today');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  // 使用 useMemo 缓存 currentUser，避免每次渲染都返回新对象
  const currentUser = useMemo(() => authService.getCurrentUser(), []);

  // 提取fetchTeams为useCallback，避免重复定义
  const fetchTeams = useCallback(async (range: 'today' | 'month' = 'today') => {
    const currentUser = authService.getCurrentUser();
    // 团队长角色不执行任何团队管理相关的请求，因为团队管理在第三个按钮对应的GroupManagement.tsx中
    if (currentUser?.role === UserRole.NORMAL_ADMIN) {
      return;
    }
    
    console.log('=== 开始获取团队数据 ===');
    console.log('Current user:', currentUser);
    const token = localStorage.getItem('admin_token');
    console.log('Current token:', token);
    const globalCacheKey = `teams_${currentUser?.id || 'unknown'}_${range}`;
    console.log('Global cache key:', globalCacheKey);

    // 先检查缓存
    const globalCachedData = cacheManager.get(globalCacheKey, 300000);
    console.log('Global cached data:', globalCachedData);
    if (globalCachedData) {
      console.log('使用全局缓存的团队数据');
      setTeams(globalCachedData.teams || []);
      setLoading(false);
      console.log('=== 获取团队数据完成 (使用缓存) ===');
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching teams data from API...');
      
      // 超管使用原来的接口
      console.log('API URL:', `/admin/team-performance?range=${range}`);
      const teamsData = await request<any[]>(`/admin/team-performance?range=${range}`, {
        method: 'GET'
      });
      console.log('Teams API response:', teamsData);

      if (Array.isArray(teamsData)) {
        console.log('Teams data is an array, length:', teamsData.length);
        const validTeams = teamsData.filter((team: any) => {
          const isValid = team && typeof team === 'object' && team.teamName && team.leaderId;
          console.log('Team validity check:', { teamName: team?.teamName, leaderId: team?.leaderId, isValid });
          return isValid;
        });

        console.log('Valid teams count:', validTeams.length);
        if (validTeams.length > 0) {
          console.log('Valid teams data:', validTeams);
          setTeams(validTeams);

          cacheManager.set(globalCacheKey, {
            teams: validTeams
          });
          console.log('Teams data cached to global cache');
        } else {
          console.log('No valid teams data, showing empty state');
          setTeams([]);
        }
      } else {
        console.log('Invalid API response format, showing empty state');
        setTeams([]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
      console.log('=== 获取团队数据完成 ===');
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchTeams();
  }, [fetchTeams]);

  // 组件挂载时加载今日数据，同时预加载本月数据
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    // 团队长角色不执行任何团队管理相关的请求
    if (currentUser?.role === UserRole.NORMAL_ADMIN) {
      return;
    }
    
    fetchTeams();
    // 预加载本月数据到缓存
    setTimeout(() => {
      const monthCacheKey = `teams_${currentUser?.id || 'unknown'}_month`;
      const monthCachedData = cacheManager.get(monthCacheKey, 300000);
      if (!monthCachedData) {
        console.log('预加载本月团队数据...');
        // 超管使用原来的接口
        request<any[]>(`/admin/team-performance?range=month`, {
          method: 'GET'
        }).then(monthData => {
          if (Array.isArray(monthData)) {
            const validTeams = monthData.filter((team: any) => {
              return team && typeof team === 'object' && team.teamName && team.leaderId;
            });
            cacheManager.set(monthCacheKey, { teams: validTeams });
            console.log('本月团队数据预加载完成');
          }
        }).catch(err => {
          console.error('预加载本月团队数据失败:', err);
        });
      }
    }, 1000); // 延迟1秒预加载，避免与主数据请求冲突
  }, [fetchTeams]);

  // 自动刷新机制：每60秒刷新一次数据
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    // 团队长角色不执行任何团队管理相关的自动刷新
    if (currentUser?.role === UserRole.NORMAL_ADMIN) {
      return;
    }
    
    const refreshInterval = setInterval(() => {
      fetchTeams();
    }, 60000); // 60秒

    return () => clearInterval(refreshInterval);
  }, [fetchTeams]);

  const totalMembers = useMemo(() => {
    return teams.reduce((sum, team) => sum + team.memberCount, 0);
  }, [teams]);

  const filteredAndSortedTeams = useMemo(() => {
    // ===== 先去重：同 leaderId 只保留第一条（避免接口重复记录导致 React key 重复）=====
    const seenLeader = new Set<string>();
    const deduped: any[] = [];
    for (const t of teams) {
      const lid = String(t.leaderId || t.id || t.teamId || '__nolead__').trim();
      const key = `${lid}__${String(t.teamName || t.name || '').trim()}`;
      if (seenLeader.has(key)) continue;
      seenLeader.add(key);
      deduped.push(t);
    }
    return deduped
      .filter(team => {
        const n = (x: any) => String(x || '').toLowerCase();
        return n(team.teamName).includes(teamSearchTerm.toLowerCase()) ||
               n(team.leaderId).includes(teamSearchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const revenueA = Number(a.totalRevenue || 0);
        const revenueB = Number(b.totalRevenue || 0);
        return revenueB - revenueA;
      });
  }, [teams, teamSearchTerm, sortBy]);

  // 骨架屏组件
  const TeamSkeleton = () => (
    <div className="p-4 pb-24">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <User className="text-[#1E40AF] mr-2" size={24} />
            帐号管理
          </h1>
          <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse"></div>
        </div>
      </header>
      
      <div className="flex space-x-2 mb-4">
        <div className="flex-1 h-10 bg-gray-100 rounded-xl animate-pulse"></div>
        <div className="flex-1 h-10 bg-gray-100 rounded-xl animate-pulse"></div>
      </div>
      
      <div className="relative mb-4">
        <div className="w-full h-12 bg-gray-100 rounded-xl animate-pulse"></div>
      </div>
      
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-gray-100"></div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-gray-100 rounded-lg mb-1"></div>
                  <div className="h-3 bg-gray-100 rounded-lg mb-1"></div>
                  <div className="h-3 bg-gray-100 rounded-lg"></div>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className="w-20 h-3 bg-gray-100 rounded-lg"></div>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gray-100 rounded"></div>
                  <div className="w-6 h-6 bg-gray-100 rounded"></div>
                  <div className="w-20 h-6 bg-gray-100 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 团队管理骨架屏
  const TeamManagementSkeleton = () => (
    <div className="pb-6 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Users2 className="text-[#1E40AF] mr-2" size={24} />
            团队管理
          </h1>
        </div>

        <div className="relative mb-4 group">
          <div className="w-full h-12 bg-gray-100 rounded-2xl animate-pulse"></div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-2xl animate-pulse">
            <div className="h-4 bg-white/20 rounded-lg mb-2"></div>
            <div className="h-8 bg-white/20 rounded-lg"></div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 rounded-2xl animate-pulse">
            <div className="h-4 bg-white/20 rounded-lg mb-2"></div>
            <div className="h-8 bg-white/20 rounded-lg"></div>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
          <div className="flex-1 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="flex-1 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </header>

      <div className="px-4 mt-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-200"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded-lg w-32 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded-lg w-40"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-200 rounded-lg w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded-lg w-32"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                    <div className="h-3 bg-gray-200 rounded-lg mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded-lg"></div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                    <div className="h-3 bg-gray-200 rounded-lg mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded-lg"></div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                    <div className="h-3 bg-gray-200 rounded-lg mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded-lg"></div>
                  </div>
                </div>
                <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/30">
                  <div className="h-3 bg-blue-200/50 rounded-lg w-60"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Normal Admin (Team Leader) view

  // Super Admin / Admin Manager view —— 与团队长底栏「团队」结构 100% 一致，直接渲染 GroupManagement
  // 团队长/组长分支原结构一字不动（NORMAL_ADMIN / GROUP_LEADER 两个 if 继续走原分支）
  {
    // ⚠️ 统一把下划线+大小写都归一化后再比：
    // UserRole.SUPER_ADMIN = 'superadmin'(枚举全小写无下划线)，实际 token 解出来有 'superadmin'/'SUPER_ADMIN'/'SUPERADMIN' 多种写法
    const roleRaw = (typeof currentUser?.role === 'string' ? currentUser.role : '').trim();
    const roleUp = roleRaw.toUpperCase().replace(/_/g, '');
    const enumSuperUp = String(UserRole.SUPER_ADMIN).toUpperCase().replace(/_/g, '');
    const enumAdminManagerUp = String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '');
    if (roleUp === enumSuperUp || roleUp === 'SUPERADMIN' || roleUp === 'SUPERADMINISTRATOR' || roleUp === enumAdminManagerUp) {
      return <GroupManagement />;
    }
  }

  if (currentUser.role === UserRole.NORMAL_ADMIN) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [accountType, setAccountType] = useState<'group' | 'employee'>('employee');
    const [filter, setFilter] = useState<string>('all');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState<any>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addType, setAddType] = useState<'group' | 'employee'>('employee');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groups, setGroups] = useState<any[]>([]);
    const [teamGroups, setTeamGroups] = useState<any[]>([]);
    // 新建组长【快速开通】成功后，显示账号信息 + 初始明文密码的弹窗
    const [showQuickCreateSuccess, setShowQuickCreateSuccess] = useState(false);
    const [quickCreateResult, setQuickCreateResult] = useState<any>(null);
    // 编辑保存成功后，页面顶部短暂显示「保存成功 ✓」提示（非阻塞，替代同步 alert 避免卡死）
    const [saveToast, setSaveToast] = useState<string | null>(null);
    
    // ================== 类型安全兜底：防御 MongoDB 对象包装导致 React #185 ==================
    const safePrimitive = (v: any): any => {
      if (v === null || v === undefined) return v;
      const t = typeof v;
      if (t === 'string' || t === 'number' || t === 'boolean') return v;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object') {
        const vAny = v as any;
        if ('$oid' in vAny && typeof vAny.$oid === 'string') return vAny.$oid;
        if ('$date' in vAny) {
          const d = vAny.$date;
          if (typeof d === 'number') return new Date(d).toISOString();
          if (typeof d === 'string') return d;
          return String(d);
        }
        if ('$numberLong' in vAny && typeof vAny.$numberLong === 'string') return vAny.$numberLong;
        // 数组：拼成字符串（避免直接当子节点）
        if (Array.isArray(vAny)) return vAny.map(x => safePrimitive(x)).filter(Boolean).join(',');
        // plain object → 置空（永远不直接作为 React child 渲染）
        if (Object.prototype.toString.call(vAny) === '[object Object]') return '';
        return String(v);
      }
      return '';
    };
    const safeStr = (v: any): string => {
      if (v === null || v === undefined) return '';
      const p = safePrimitive(v);
      if (p === null || p === undefined || p === '') return '';
      return typeof p === 'string' ? p : String(p);
    };
    const safeNum = (v: any, fallback = 0): number => {
      if (v === null || v === undefined || v === '') return fallback;
      const p = safePrimitive(v);
      if (p === null || p === undefined || p === '') return fallback;
      const n = Number(p);
      return Number.isFinite(n) ? n : fallback;
    };
    const safeBool = (v: any, fallback = false): boolean => {
      if (v === true) return true;
      if (v === false) return false;
      if (v === null || v === undefined) return fallback;
      const s = safeStr(v).toLowerCase();
      if (s === 'true' || s === '1' || s === 'enabled' || s === 'on' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'disabled' || s === 'off' || s === 'no') return false;
      return fallback;
    };
    const sanitizeAccount = (raw: any): any => {
      if (!raw) return {} as any;
      const base: any = {};
      // 先对每个字段做 safePrimitive，确保不会有任何未处理的对象残留
      for (const [k, v] of Object.entries(raw)) {
        if (v === null || v === undefined) { base[k] = ''; continue; }
        const t = typeof v;
        if (t === 'string' || t === 'number' || t === 'boolean') { base[k] = v; continue; }
        base[k] = safePrimitive(v);
      }
      // 所有在 JSX 中会被读取的字段全部显式强转（优先级最高，覆盖上面的结果）
      base._id = safeStr(raw._id);
      base.userId = safeStr(raw.userId);
      base.parentId = safeStr(raw.parentId);
      base.username = safeStr(raw.username);
      base.realName = safeStr(raw.realName);
      base.groupLeaderName = safeStr(raw.groupLeaderName);
      base.role = safeStr(raw.role || raw.userRole || (raw as any).role);
      base.status = safeStr(raw.status);
      base.phone = safeStr(raw.phone);
      base.region = safeStr(raw.region);
      base.employeeId = safeStr(raw.employeeId);
      base.teamGroupId = safeStr(raw.teamGroupId);
      base.groupId = safeStr(raw.groupId);
      base.groupName = safeStr(raw.groupName);
      base.teamName = safeStr(raw.teamName);
      base.commissionRate = safeStr(raw.commissionRate);
      base.supervisorUsername = safeStr(raw.supervisorUsername);
      base.supervisorName = safeStr(raw.supervisorName);
      base.supervisorRealName = safeStr(raw.supervisorRealName);
      base.superior = safeStr(raw.superior);
      base.teamLeaderId = safeStr(raw.teamLeaderId);
      base.teamLeaderName = safeStr(raw.teamLeaderName);
      // 数字字段
      base.zeroEarningsDays = safeNum(raw.zeroEarningsDays, 0);
      base.commission = safeNum(raw.commission, 0);
      // 日期字段：统一存 ISO 字符串，后续直接 new Date() 即可
      if (raw.createdAt) {
        const cv = safePrimitive(raw.createdAt);
        base.createdAt = (typeof cv === 'string' && cv.length > 0) ? cv : '';
      } else {
        base.createdAt = '';
      }
      if (raw.updatedAt) {
        const uv = safePrimitive(raw.updatedAt);
        base.updatedAt = (typeof uv === 'string' && uv.length > 0) ? uv : '';
      } else {
        base.updatedAt = '';
      }
      // 布尔字段
      base.isStar = safeBool(raw.isStar, false);
      base.enabled = safeBool(raw.enabled, true);
      return base;
    };
    const sanitizeGroup = (raw: any): any => {
      if (!raw) return {} as any;
      return {
        ...raw,
        _id: safeStr(raw?._id),
        id: safeStr(raw?.id),
        groupName: safeStr(raw?.groupName),
        teamId: safeStr(raw?.teamId),
        teamGroupId: safeStr(raw?.teamGroupId),
        groupId: safeStr(raw?.groupId || raw?._id),
        teamName: safeStr(raw?.teamName),
        commission: safeNum(raw?.commission, 0),
        createdAt: safeStr(raw?.createdAt),
      };
    };
    // 真正的 TeamGroup 对象（来自 /admin/employee/team-leader/groups）
    // 用于「所属小组」下拉数据源：
    //   value = groupId || _id（正确 TeamGroup._id，而不是组长 Admin._id）
    //   label = groupName
    //   parentId（保存员工时用）= groupLeaderId（组长本人 Admin._id）
    const sanitizeTeamGroup = (raw: any): any => {
      if (!raw) return {} as any;
      return {
        ...raw,
        _id: safeStr(raw?._id),
        id: safeStr(raw?.id),
        groupId: safeStr(raw?.groupId || raw?._id),   // 作为 dropdown.value 的主键（真正 TeamGroup._id）
        groupName: safeStr(raw?.groupName),
        teamId: safeStr(raw?.teamId),
        teamName: safeStr(raw?.teamName),
        groupLeaderId: safeStr(raw?.groupLeaderId || raw?.teamLeaderId || raw?.leaderId || raw?.adminId),
        groupLeaderName: safeStr(raw?.groupLeaderName || raw?.leaderName || raw?.leaderRealName || raw?.realName),
        commission: safeNum(raw?.commission ?? raw?.commissionRate, 0),
        createdAt: safeStr(raw?.createdAt),
      };
    };
    const sanitizedAccounts = useMemo(() => (Array.isArray(accounts) ? accounts : []).map(sanitizeAccount), [accounts]);
    const sanitizedGroups = useMemo(() => (Array.isArray(groups) ? groups : []).map(sanitizeGroup), [groups]);
    const sanitizedTeamGroups = useMemo(() => (Array.isArray(teamGroups) ? teamGroups : []).map(sanitizeTeamGroup), [teamGroups]);
    // 终极渲染兜底：任何可能作为 React child 直接渲染的值，一律转成安全的 string/number/null/undefined
    // 只要对象或数组传进来，强制 toString()（变成 "[object Object]"），永远不会 #185
    const renderVal = (v: any): any => {
      if (v === null || v === undefined || v === false || v === true) return null; // 不渲染
      const t = typeof v;
      if (t === 'string') return v;
      if (t === 'number' || t === 'bigint') return String(v);
      if (t === 'symbol') return String(v);
      if (Array.isArray(v)) return v.map((item, i) => <React.Fragment key={i}>{renderVal(item)}</React.Fragment>);
      // ReactElement（有 $$typeof）直接返回
      if (typeof v === 'object' && v.$$typeof) return v;
      // 其他对象：强制 toString 兜底
      return String(v);
    };
    // ============================================================================================
    const [formData, setFormData] = useState({
      teamName: '',
      realName: '',
      phone: '',
      region: '',
      employeeId: '',
      groupId: '',
      groupName: '',
      commissionRate: '',
      username: ''   // 组长开通必填：登录用户名（全局唯一）
    });
    
    // 将currentUser保存到状态，确保引用稳定
    const [user, setUser] = useState(() => authService.getCurrentUser());
    
    // 提取fetchAccounts为useCallback，避免重复定义
    const fetchAccounts = useCallback(async () => {
      console.log('=== 开始获取账号数据 ===');
      const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
      
      // 先检查缓存
      const cachedData = cacheManager.get(cacheKey, 300000); // 5分钟缓存
      if (cachedData) {
        console.log('使用缓存的账号数据');
        setGroups(cachedData.groups || []);
        setTeamGroups(cachedData.teamGroups || []);
        setAccounts(cachedData.accounts || []);
        setLoading(false);
        console.log('=== 获取账号数据完成 (使用缓存) ===');
        return;
      }
      
      setLoading(true);
      try {
        const teamId = user.id;
        
        // 并行调用三个接口：
        // 1) groupLeaders-simple → 组长 Admin 列表（给「组长账号」Tab 展示用，含组长本人姓名）
        // 2) employees-simple → 员工列表
        // 3) team-leader/groups → 真正的 TeamGroup 列表（给「所属小组」下拉当数据源，
        //    _id/groupId=真正TeamGroup._id，groupLeaderId=组长本人Admin._id，避免前端传错 ID 类型）
        const [groupLeaders, employees, realGroupList] = await Promise.all([
          request<any[]>('/admin/employee/group-leaders-simple?teamId=' + teamId, { method: 'GET' }),
          request<any[]>('/admin/employee/employees-simple?teamId=' + teamId, { method: 'GET' }),
          request<any[]>(`/admin/employee/team-leader/groups?teamId=${encodeURIComponent(teamId)}`, { method: 'GET' })
            .then(res => (Array.isArray(res) ? res : []))
            .catch(err => { console.warn('获取 TeamGroup 列表失败（下拉可能为空），继续：', err); return []; })
        ]);
        
        // 直接使用后端返回的数据，不需要任何转换
        const allGroups = groupLeaders || [];
        const rawTeamGroups = realGroupList || [];

        // 🛡️ 双重保险：如果 TeamGroup 接口没返回 groupLeaderId（组长本人 Admin._id），
        // 就从 groupLeaders-simple（组长 Admin 列表）按 groupName 关联回填，
        // 保证员工保存时 parentId 永远不会 fallback 到 TL.id 造成 parentId/teamGroupId 错配。
        const teamGroupLeaderMap = new Map<string, string>(); // 组长 Admin 列表：key=groupName, value=组长Admin._id
        for (const gl of allGroups) {
          const gn = safeStr((gl as any).groupName);
          if (!gn) continue;
          const gid = safeStr((gl as any)._id) || safeStr((gl as any).id) || safeStr((gl as any).userId);
          if (gid) teamGroupLeaderMap.set(gn, gid);
        }
        const allTeamGroups = rawTeamGroups.map((tg: any) => {
          const gn = safeStr((tg as any).groupName);
          const existingLeader = safeStr(
            (tg as any).groupLeaderId || (tg as any).teamLeaderId || (tg as any).leaderId || (tg as any).adminId
          );
          if (existingLeader || !gn || !teamGroupLeaderMap.has(gn)) return tg;
          return { ...tg, groupLeaderId: teamGroupLeaderMap.get(gn)! };
        });

        const allAccounts = [...(groupLeaders || []), ...(employees || [])];

        setGroups(allGroups);
        setTeamGroups(allTeamGroups);
        setAccounts(allAccounts);
        
        // 缓存数据（包含 teamGroups）
        cacheManager.set(cacheKey, {
          groups: allGroups,
          teamGroups: allTeamGroups,
          accounts: allAccounts
        });
        console.log('账号数据缓存完成');
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
        setGroups([]);
        setTeamGroups([]);
      } finally {
        setLoading(false);
        console.log('=== 获取账号数据完成 ===');
      }
    }, [user]);
    
    // 组件挂载时加载账号数据
    useEffect(() => {
      fetchAccounts();
    }, [fetchAccounts]);
    
    // 自动刷新机制：每60秒刷新一次数据
    useEffect(() => {
      const refreshInterval = setInterval(() => {
        fetchAccounts();
      }, 60000); // 60秒

      return () => clearInterval(refreshInterval);
    }, [fetchAccounts]);
    
    const accountCounts = {
      group: sanitizedAccounts.filter(a => !a.employeeId && a.groupName).length,
      employee: sanitizedAccounts.filter(a => a.employeeId).length
    };
    
    const filterCounts = {
      all: sanitizedAccounts.filter(a => a.employeeId).length,
      normal: sanitizedAccounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) < 3).length,
      '3-7': sanitizedAccounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) >= 3 && (a.zeroEarningsDays || 0) <= 7).length,
      '7-15': sanitizedAccounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) > 7 && (a.zeroEarningsDays || 0) <= 15).length,
      '15+': sanitizedAccounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) > 15).length
    };
    
    const filteredAccounts = sanitizedAccounts.filter(a => {
      if (accountType === 'group') {
        // 组长账号：没有employeeId且有groupName
        return !a.employeeId && a.groupName && 
               (a.groupLeaderName?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
                a.groupName?.toLowerCase().includes(searchKeyword.toLowerCase()));
      } else {
        // 员工账号：有employeeId
        return a.employeeId && 
               (a.realName?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                a.employeeId?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                a.phone?.toLowerCase().includes(searchKeyword.toLowerCase()));
      }
    }).filter(a => {
      // 员工账号根据zeroEarningsDays进行筛选
      if (accountType === 'employee') {
        const days = a.zeroEarningsDays || 0;
        if (filter === 'all') {
          return true; // 显示所有账号
        } else if (filter === 'normal') {
          return days < 3; // 3天内有收益
        } else if (filter === '3-7') {
          return days >= 3 && days <= 7;
        } else if (filter === '7-15') {
          return days > 7 && days <= 15;
        } else if (filter === '15+') {
          return days > 15;
        }
      }
      return true;
    }).sort((a, b) => {
      // 员工账号按注册时间从最新的往早的排序
      if (accountType === 'employee') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA; // 降序，最新的在前
      }
      return 0;
    });
    
    const toggleAccountStatus = async (account: any) => {
      try {
        const currentEnabled = account.status === 'enabled' || account.status === '1' || !account.status; // 没有status字段时默认为启用
        const newStatus = currentEnabled ? 'disabled' : 'enabled';
        
        if (account.role === 'EMPLOYEE') {
          await request<any>(`/admin/employee/${account._id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
        } else {
          await request<any>(`/admin/employee/group-leader/${account._id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
        }
        // 清除缓存并重新加载数据
        const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
        cacheManager.delete(cacheKey);
        fetchAccounts();
      } catch (error) {
        console.error('Error toggling status:', error);
      }
    };
    
    const openEditModal = (account: any) => {
      setEditingAccount(account);
      
      if (account.role === 'EMPLOYEE') {
        setFormData({
          teamName: '',
          realName: account.realName || '',
          phone: account.phone || '',
          region: account.region || '',
          employeeId: account.employeeId || '',
          groupId: account.teamGroupId || '',
          groupName: account.groupName || '',
          commissionRate: '',
          username: ''
        });
      } else {
        setFormData({
          teamName: account.teamName || '',
          realName: account.realName || '',
          phone: account.phone || '',
          region: account.region || '',
          employeeId: '',
          groupId: account.teamGroupId || '',
          groupName: account.groupName || '',
          commissionRate: account.commission ? String(Math.round(account.commission * 100)) : '',
          username: ''
        });
      }
      
      setShowEditModal(true);
    };
    
    const openDeleteModal = (account: any) => {
      setDeletingAccount(account);
      setShowDeleteModal(true);
    };
    
    const handleEditAccount = async () => {
      console.log('=== handleEditAccount 开始 ===');
      if (!editingAccount) {
        console.log('editingAccount为空，直接返回');
        alert('数据异常，请刷新页面后重试');
        return;
      }
      // 账号 ID 必须有效，否则接口路径会变成 /admin/employee/ 导致 404/无响应
      const editId = safeStr(editingAccount._id);
      if (!editId) {
        alert('账号 ID 无效，请刷新页面后重试');
        return;
      }
      // 用被编辑对象自身 role 判分支，而不是当前 Tab 的 accountType！
      const role = safeStr(editingAccount.role);
      const isEmployee = (role === 'EMPLOYEE') || (safeStr(editingAccount.employeeId).length > 0);

      console.log('editingAccount:', editingAccount, 'role:', role, 'isEmployee:', isEmployee);
      console.log('user:', user);

      try {
        if (isEmployee) {
          // ========== 编辑员工 ==========
          // ⚠️ 关键：「所属小组」下拉现在用「TeamGroup 列表」当数据源，value = 真正 TeamGroup._id
          // 保存时必须根据选中情况设置正确的 parentId：
          //   - 选中了某个小组：teamGroupId = TeamGroup._id，parentId = 该小组的 groupLeaderId（组长本人 Admin._id）
          //   - 选了「无」（直属团队长）：teamGroupId = ''，parentId = 当前 TL.id（user.id）
          const selGroupId   = safeStr(formData.groupId);
          const selectedTeamGroup = selGroupId
            ? sanitizedTeamGroups.find(g => safeStr(g.groupId) === selGroupId || safeStr(g._id) === selGroupId)
            : undefined;
          const selGroupName  = selectedTeamGroup ? safeStr(selectedTeamGroup.groupName) : '';
          const finalTeamGroupId = selectedTeamGroup ? (safeStr(selectedTeamGroup.groupId) || safeStr(selectedTeamGroup._id)) : '';
          const finalParentId   = selectedTeamGroup && safeStr(selectedTeamGroup.groupLeaderId)
            ? safeStr(selectedTeamGroup.groupLeaderId)
            : safeStr(user.id);

          const realName    = safeStr(formData.realName);
          const phone       = safeStr(formData.phone);
          const region      = safeStr(formData.region);
          const employeeId  = safeStr(formData.employeeId);

          console.log('Form data → EMPLOYEE PUT payload (修正ID类型):',
            { realName, phone, region, employeeId,
              teamGroupId: finalTeamGroupId, groupName: selGroupName, parentId: finalParentId });

          // 必填字段至少要有 realName / phone（和创建员工一致的校验强度）
          if (!realName || !phone) {
            alert('员工姓名和手机号不能为空');
            return;
          }

          const response = await request<any>(`/admin/employee/${editId}`, {
            method: 'PUT',
            body: JSON.stringify({
              parentId: finalParentId,
              realName, phone, region, employeeId,
              teamGroupId: finalTeamGroupId,
              groupName:   selGroupName,
            })
          });
          console.log('API response (edit employee):', response);

          // ✅ 修复核心 BUG：**不要再用「response.teamGroupId/groupName 都为空」来判失败！**
          //    员工选了「无」（直属 TL，不进组）时，这两个字段本就是空串。
          //    request() 没抛异常就是成功，一律按返回值合并本地状态。
          const resp = (response && typeof response === 'object') ? response : {};

          const updatedData = {
            ...editingAccount,
            realName:   safeStr(resp.realName)   || realName,
            phone:      safeStr(resp.phone)      || phone,
            region:     safeStr(resp.region)     || region,
            employeeId: safeStr(resp.employeeId) || employeeId,
            teamGroupId: safeStr(resp.teamGroupId ?? selGroupId),
            groupName:  safeStr(resp.groupName   ?? selGroupName),
          };
          console.log('Updated employee (local):', updatedData);

        // ✅ 修复：不再本地 setAccounts（会被缓存 useEffect 回滚）！
          //    统一走「删缓存 + 重新拉接口」（和删除账号 / 切换启用 / 新建组长流程完全一致）
          //    注意：fetchAccounts 不要 await，避免阻塞 + 批处理冲突导致 TRAE 死锁卡死
          const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
          cacheManager.delete(cacheKey);
          fetchAccounts();

        } else {
          // ========== 编辑组长 ==========
          console.log('=== 开始编辑组长 ===');

          const commissionRate =
            (safeStr(formData.commissionRate).length > 0)
              ? (safeNum(formData.commissionRate, 0) / 100)
              : undefined;

          // 组 ID 解析：先查后端组列表匹配 groupName → 兜底 teamGroupId → 再兜底 _id
          let correctGroupId = safeStr(editingAccount.teamGroupId) || editId;
          try {
            const groupList = await request<any[]>(`/admin/employee/team-leader/groups?teamId=${encodeURIComponent(safeStr(user.id))}`, { method: 'GET' });
            console.log('获取到的组列表 (组长编辑):', groupList);
            const fn = safeStr(formData.groupName) || safeStr(editingAccount.groupName);
            if (fn && Array.isArray(groupList)) {
              const realGroup = groupList.find(g => safeStr(g.groupName) === fn);
              const gid = realGroup ? (safeStr(realGroup.groupId) || safeStr(realGroup._id)) : '';
              if (gid) { correctGroupId = gid; console.log('找到正确的组ID:', correctGroupId); }
            }
          } catch (e) {
            console.warn('获取组列表失败，继续用默认ID:', e);
          }
          if (!correctGroupId) throw new Error('无法确定所属小组 ID，请刷新页面后重试');

          const updateData: any = {};
          if (safeStr(formData.groupName)) updateData.groupName = safeStr(formData.groupName);
          if (commissionRate !== undefined) updateData.commission = commissionRate;
          if (safeStr(editingAccount.userId)) updateData.groupLeaderId = safeStr(editingAccount.userId);
          console.log('组长更新 payload:', updateData, 'correctGroupId:', correctGroupId);

          const response = await request<any>(`/admin/employee/group-leader/${correctGroupId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
          });
          console.log('更新组长信息成功，响应:', response);

          const resp = (response && typeof response === 'object') ? response : {};
          const newGroupName   = safeStr(resp.groupName) || safeStr(formData.groupName) || safeStr(editingAccount.groupName);
          const newCommission  = typeof resp.commission === 'number'
            ? resp.commission
            : (commissionRate !== undefined ? commissionRate : safeNum(editingAccount.commission));
          console.log('组长编辑 → 新 groupName:', newGroupName, '新 commission:', newCommission);

          // ✅ 修复：不再本地 setAccounts（会被缓存 useEffect 回滚）！
          //    统一走「删缓存 + 重新拉接口」（和删除账号 / 切换启用 / 新建组长流程完全一致）
          //    注意：fetchAccounts 不要 await，避免阻塞 + 批处理冲突导致 TRAE 死锁卡死
          const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
          cacheManager.delete(cacheKey);
          fetchAccounts();
        }

        // ✅ 成功 → 先关弹窗清状态（让 React 立即 re-render，不批处理到后面）
        setShowEditModal(false);
        setEditingAccount(null);
        setFormData({ teamName: '', realName: '', phone: '', region: '', employeeId: '', groupId: '', groupName: '', commissionRate: '', username: '' });
        console.log('✅ 编辑保存成功');
        // 非阻塞提示：替代同步 alert，避免浏览器主事件循环被挂起导致 TRAE 卡死
        setSaveToast('保存成功 ✓');
        setTimeout(() => setSaveToast(null), 1500);

      } catch (error: any) {
        // ✅ 失败 → 阻塞 alert，明确告诉用户哪错了
        console.error('❌ 更新账号失败:', error);
        alert(safeStr(error?.message) || '更新失败，请重试');
      }
    };
    
    const handleDeleteAccount = async () => {
      if (!deletingAccount) return;
      
      try {
        if (deletingAccount.role === 'EMPLOYEE') {
          await request<any>(`/admin/employee/${deletingAccount._id}`, {
            method: 'DELETE'
          });
        } else {
          const groupId = deletingAccount.teamGroupId || deletingAccount._id;
          await request<any>(`/admin/employee/group-leader/${groupId}`, {
            method: 'DELETE'
          });
        }
        setShowDeleteModal(false);
        setDeletingAccount(null);
        // 清除缓存并重新加载数据
        const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
        cacheManager.delete(cacheKey);
        fetchAccounts();
      } catch (error: any) {
        console.error('Error deleting account:', error);
        alert(error.message || '删除失败，请重试');
      }
    };
    
    const handleAddAccount = async () => {
      setError(null);
      
      if (addType === 'group') {
        // 组长开通：realName / phone / username 三项必填
        const realName = (formData.realName || '').trim();
        const phone    = (formData.phone    || '').trim();
        const username = (formData.username || '').trim();
        if (!realName || !phone || !username) {
          setError('请填写组长姓名、手机号和登录用户名（3 项必填）');
          return;
        }
      } else {
        if (!formData.realName || !formData.phone || !formData.region) {
          setError('请填写所有必填字段');
          return;
        }
      }

      setSaving(true);
      try {
        if (addType === 'group') {
          // 【新接口 2026-07-11】快速开通组长：1 个接口完成建 Admin + 建 TeamGroup + 绑定 + 自动 P1 提成
          // 前端只传 3 个字段，其他后端自动生成（teamLeaderId/teamName/groupName/commission/password/role/status）
          const realName = (formData.realName || '').trim();
          const phone    = (formData.phone    || '').trim();
          const username = (formData.username || '').trim();

          const groupLeaderResult = await request<any>('/admin/account/group-leader/quick-create', {
            method: 'POST',
            body: JSON.stringify({ realName, phone, username })
          });
          
          console.log('【快速开通】创建组长账号结果:', groupLeaderResult);
          
          // 存成功数据给「账号密码信息」弹窗显示
          const resultData = (groupLeaderResult && typeof groupLeaderResult === 'object' && 'data' in groupLeaderResult)
            ? groupLeaderResult.data
            : groupLeaderResult;
          setQuickCreateResult(resultData || null);
          
          // 清除缓存并刷新列表（新组长 status=enabled 直接出现在列表里，不会进待开通）
          const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
          cacheManager.delete(cacheKey);
          fetchAccounts();

          // 关闭「新建账号」弹窗 → 打开「成功 + 账号密码」弹窗
          setShowAddModal(false);
          setAddType('group');
          setFormData({ teamName: '', realName: '', phone: '', region: '', employeeId: '', groupId: '', groupName: '', commissionRate: '', username: '' });
          setShowQuickCreateSuccess(true);
        } else {
          // ========== 新建员工 ==========
          // ⚠️ 关键：下拉使用 TeamGroup 数据源，选中组时 parentId 必须=该组的 groupLeaderId（组长 Admin._id）
          //   teamGroupId = TeamGroup._id（不是组长 Admin._id）
          const selGroupId = safeStr(formData.groupId);
          const selectedTeamGroup = selGroupId
            ? sanitizedTeamGroups.find(g => safeStr(g.groupId) === selGroupId || safeStr(g._id) === selGroupId)
            : undefined;
          const finalTeamGroupId = selectedTeamGroup ? (safeStr(selectedTeamGroup.groupId) || safeStr(selectedTeamGroup._id)) : '';
          const finalGroupName   = selectedTeamGroup ? safeStr(selectedTeamGroup.groupName) : '';
          const finalParentId   = selectedTeamGroup && safeStr(selectedTeamGroup.groupLeaderId)
            ? safeStr(selectedTeamGroup.groupLeaderId)
            : safeStr(user.id);

          await request<any>('/admin/employee/create', {
            method: 'POST',
            body: JSON.stringify({
              parentId: finalParentId,
              realName: formData.realName,
              phone: formData.phone,
              region: formData.region,
              groupId: finalTeamGroupId,
              teamGroupId: finalTeamGroupId,
              groupName: finalGroupName,
              employeeId: formData.employeeId
            })
          });
          
          // 清除缓存并重新加载数据
          const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
          cacheManager.delete(cacheKey);
          fetchAccounts();
          setShowAddModal(false);
          setAddType('group');
          setFormData({ teamName: '', realName: '', phone: '', region: '', employeeId: '', groupId: '', groupName: '', commissionRate: '', username: '' });
        }
      } catch (error: any) {
        console.error('Error adding account:', error);
        const msg = error?.message || '添加失败，请重试';
        setError(msg);
        // 后端返回的业务错误 400 里，通常 message 有明确说明
        // —— 用户名已存在 / 同名校已存在 等，直接显示给用户
      } finally {
        setSaving(false);
      }
    };
    
    return (
      loading ? (
        <TeamSkeleton />
      ) : (
        <div className="p-4 pb-24">
          {/* 【非阻塞 Toast】保存成功 / 其他操作成功时的短暂提示，替代 alert 避免 TRAE 卡死 */}
          {saveToast && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none
                            bg-green-500 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-lg shadow-green-200
                            animate-[fadeInDown_.25s_ease-out_both]">
              {saveToast}
            </div>
          )}
          <header className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-gray-900 flex items-center">
                  <User className="text-[#1E40AF] mr-2" size={24} />
                  帐号管理
                </h1>
                <button 
                  onClick={() => {
                    const cacheKey = `accounts_team_${user?.id || 'unknown'}`;
                    cacheManager.delete(cacheKey);
                    fetchAccounts();
                  }}
                  className="bg-white text-[#1E40AF] p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all border border-gray-100"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
              >
                <UserPlus size={20} />
              </button>
            </div>
          </header>
        
        <div className="flex space-x-2 mb-4">
          <button 
            onClick={() => setAccountType('group')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${accountType === 'group' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            组长账号 ({accountCounts.group})
          </button>
          <button 
            onClick={() => setAccountType('employee')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${accountType === 'employee' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            直属员工账号 ({accountCounts.employee})
          </button>
        </div>
        
        {accountType === 'employee' && (
          <>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索员工姓名、员工号或手机号"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-blue-600'}`}
              >
                全部 ({filterCounts.all})
              </button>
              <button
                onClick={() => setFilter('normal')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'normal' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-green-700'}`}
              >
                正常 ({filterCounts.normal})
              </button>
              <button
                onClick={() => setFilter('3-7')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === '3-7' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-yellow-700'}`}
                style={{ minWidth: '60px', textAlign: 'center' }}
              >
                3～7天<br />预警 ({filterCounts['3-7']})
              </button>
              <button
                onClick={() => setFilter('7-15')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === '7-15' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-orange-700'}`}
                style={{ minWidth: '60px', textAlign: 'center' }}
              >
                7～15天<br />封禁 ({filterCounts['7-15']})
              </button>
              <button
                onClick={() => setFilter('15+')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === '15+' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-red-700'}`}
                style={{ minWidth: '60px', textAlign: 'center' }}
              >
                &gt;15天<br />删除 ({filterCounts['15+']})
              </button>
            </div>
          </>
        )}
        
        {loading ? (
          <TeamSkeleton />
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((rawAccount, idx) => {
              // 在渲染层再做一次「终极解包」：不管任何字段，只要可能是子节点渲染，就用 safeXxx 强转
              // 即使 sanitizeAccount 漏处理某个字段，这里也绝对不会把对象当子节点
              const a = rawAccount || {};
              const _id           = safeStr(a._id);
              const role          = safeStr(a.role);
              const status        = safeStr(a.status);
              const username      = safeStr(a.username);
              const realName      = safeStr(a.realName);
              const groupLeaderName = safeStr(a.groupLeaderName);
              const phone         = safeStr(a.phone);
              const region        = safeStr(a.region);
              const employeeId    = safeStr(a.employeeId);
              const groupName     = safeStr(a.groupName);
              const teamGroupId   = safeStr(a.teamGroupId);
              const createdAtRaw  = safeStr(a.createdAt);
              const zeroDays      = safeNum(a.zeroEarningsDays, 0);
              const isEmployee    = (role === 'EMPLOYEE') || (employeeId.length > 0);
              const isGroupLeader = !isEmployee;
              const enabled = (status.length === 0) || status === 'enabled' || status === '1' || status === 'true';
              const cardKey = `${_id || `${realName}-${username}-${phone}` || `acct-${idx}`}-${idx}`;
              const dateStr = (() => {
                if (!createdAtRaw) return '';
                try {
                  const d = new Date(createdAtRaw);
                  if (Number.isNaN(d.getTime())) return '';
                  return d.toLocaleDateString();
                } catch {
                  return '';
                }
              })();
              return (
              <div key={cardKey} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isEmployee
                        ? 'bg-blue-100 text-blue-600'
                        : (teamGroupId.length > 0 || groupName.length > 0)
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-purple-100 text-purple-600'
                    }`}>
                      {isEmployee ? (
                        <User size={20} />
                      ) : (teamGroupId.length > 0 || groupName.length > 0) ? (
                        <Star size={20} />
                      ) : (
                        <Crown size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEmployee ? (
                        <>
                          <h3 className="text-sm font-bold text-gray-900">
                            {renderVal(realName)}
                            {employeeId.length > 0 && <span className="ml-2 text-[#1E40AF]">({renderVal(employeeId)})</span>}
                          </h3>
                          {phone.length > 0 && (
                            <p className="text-[10px] text-gray-400">{renderVal(phone)}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            地区：{renderVal(region) || '无'}
                          </p>
                        </>
                      ) : (
                        <>
                          {/* 组长卡片：去掉组名称（groupName代理群名）和分成字段，直接显示组长真实姓名作为大标题 */}
                          <h3 className="text-sm font-bold text-gray-900">
                            组长：{renderVal(realName) || renderVal(groupLeaderName) || renderVal(username)}
                          </h3>
                          {username.length > 0 && enabled && (
                            <p className="text-xs font-semibold text-[#1E40AF] mt-0.5">
                              用户名：{renderVal(username)}
                            </p>
                          )}
                          {phone.length > 0 && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              📱 {renderVal(phone)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {isEmployee && (
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const days = zeroDays;
                          if (days < 3) {
                            return (
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 rounded-full">
                                收益正常
                              </span>
                            );
                          } else if (days >= 3 && days <= 7) {
                            return (
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-700 rounded-full">
                                3～7天0收益
                              </span>
                            );
                          } else if (days > 7 && days <= 15) {
                            return (
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-700 rounded-full">
                                7～15天0收益
                              </span>
                            );
                          } else if (days > 15) {
                            return (
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded-full">
                                &gt;15天0收益
                              </span>
                            );
                          }
                          return null;
                        })()}
                        {dateStr.length > 0 && (
                          <span className="text-[10px] text-[#1E40AF]">
                            {renderVal(dateStr)}
                          </span>
                        )}
                      </div>
                    )}
                    {isGroupLeader && dateStr.length > 0 && (
                      <span className="text-[10px] text-[#1E40AF]">
                        {renderVal(dateStr)}
                      </span>
                    )}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(rawAccount)}
                        className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(rawAccount)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      {/* ========= 禁用/启用 文字徽章 + 开关按钮 =========
                          严格规则（仅按用户要求的范围处理）：
                          ① isGroupLeader（组长账号卡片）：
                              - 团队长(NORMAL_ADMIN)视角 → 隐藏（只有超管能改状态）
                              - 超管(SUPER_ADMIN)视角   → 正常显示
                          ② 员工账号卡片（isEmployee，非组长）：
                              - 完全不动，保留原来的禁用/启用显示（用户没让处理员工）
                      */}
                      {(() => {
                        // 员工账号 → 永远显示（用户明确说只处理组长，员工不变）
                        if (!isGroupLeader) {
                          return (
                            <>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${enabled ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                {enabled ? '启用' : '禁用'}
                              </span>
                              <button
                                onClick={() => toggleAccountStatus(rawAccount)}
                                className={`w-10 h-6 rounded-full p-0.5 transition-all ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                              >
                                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                              </button>
                            </>
                          );
                        }
                        // 组长账号 → 只有超管(SUPER_ADMIN)显示，团队长(NORMAL_ADMIN)直接隐藏
                        const role = (typeof user?.role === 'string' ? user.role : '').toUpperCase();
                        const isSuper = role === UserRole.SUPER_ADMIN || role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
                        if (!isSuper) return null;
                        return (
                          <>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${enabled ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                              {enabled ? '启用' : '禁用'}
                            </span>
                            <button
                              onClick={() => toggleAccountStatus(rawAccount)}
                              className={`w-10 h-6 rounded-full p-0.5 transition-all ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    {/* 显示开通状态（只有组长账号才显示） */}
                    {isGroupLeader && groupName.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {!enabled || username.length === 0 ? (
                          <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            待开通
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            已开通
                          </span>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
              );
            })}
            {filteredAccounts.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                暂无{accountType === 'group' ? '组长' : '直属员工'}账号
              </div>
            )}
          </div>
        )}
        
        {/* 编辑模态框 */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">
                编辑{accountType === 'group' ? '组长' : '直属员工'}账号
              </h2>
              <div className="space-y-4">
                {accountType === 'group' ? (
                  <>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">组长姓名 <span className="font-normal text-red-500">（姓名必须与后期提现打款姓名一致！）</span></label>
                      <input
                        type="text"
                        value={formData.realName}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 bg-gray-100 cursor-not-allowed"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">员工姓名</label>
                      <input
                        type="text"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">手机号</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">地区</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">所属小组 <span className="text-gray-400">(可选)</span></label>
                      <div className="relative">
                        <select
                          value={formData.groupId}
                          onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                        >
                          <option value="">无</option>
                          {sanitizedTeamGroups.map((group: any, i: number) => (
                            <option key={`${group.groupId || group._id || 'g'}-${i}`} value={group.groupId || group._id || ''}>
                              {group.groupName || ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleEditAccount}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-[#1E40AF] rounded-xl"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 删除确认模态框 */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <h2 className="text-lg font-bold mb-2">确认删除</h2>
              <p className="text-sm text-gray-600 mb-6">
                确定要删除这个{accountType === 'group' ? '组长' : '直属员工'}账号吗？
              </p>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 新建账号模态框 */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">
                新建{addType === 'group' ? '组长' : '直属员工'}账号
              </h2>
              
              <div className="flex space-x-2 mb-4">
                <button 
                  onClick={() => setAddType('group')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${addType === 'group' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
                >
                  组长账号
                </button>
                <button 
                  onClick={() => setAddType('employee')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${addType === 'employee' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
                >
                  直属员工账号
                </button>
              </div>
              
              <div className="space-y-4">
                {addType === 'group' ? (
                  <>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-700 leading-relaxed">
                        【快速开通】提交后<span className="font-bold">系统立即创建组长账号</span>（<span className="font-bold">不需要等待超管审核</span>），初始密码固定 <span className="font-bold">11112222</span>，开通成功后请务必截图保存账号密码并转发给组长本人，提醒其登录后第一时间自行修改密码。
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">组长姓名 <span className="text-red-500">*</span> <span className="font-normal text-red-500">（姓名必须与后期提现打款姓名一致！）</span></label>
                      <input
                        type="text"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="请输入组长真实姓名"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">登录用户名 <span className="text-red-500">*</span> <span className="text-[10px] text-gray-400 font-normal">（全局唯一，建议使用姓名全拼，不可修改）</span></label>
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="例：zhangwei（组长登录系统用）"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        支持字母/数字，不能用中文；如果提示「用户名已存在」，请在后加数字（例：zhangwei2026）
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">手机号 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          placeholder="请输入手机号"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">所属小组 <span className="text-gray-400">(可选)</span></label>
                      <div className="relative">
                        <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          value={formData.groupId}
                          onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                        >
                          <option value="">无（直接归属于团队长）</option>
                          {sanitizedTeamGroups.map((group, i: number) => (
                            <option key={`${group.groupId || group._id || 'g'}-${i}`} value={group.groupId || group._id || ''}>
                              {group.groupName || ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">不选择则直接归属于团队长</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">姓名 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="请输入员工姓名"
                          value={formData.realName}
                          onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">手机号 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          placeholder="请输入手机号"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">地区 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="请输入地区"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-blue-600">
                        💡 员工号将由系统自动生成4位数字编号
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {error && (
                <div className="mb-3 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                  {error}
                </div>
              )}
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddType('group');
                    setFormData({ teamName: '', realName: '', phone: '', region: '', employeeId: '', groupId: '', groupName: '', commissionRate: '', username: '' });
                    setError(null);
                  }}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={handleAddAccount}
                  disabled={saving}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl ${saving ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
                >
                  {saving ? '添加中...' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
         * 【快速开通成功】：显示账号 + 明文密码弹窗，TL 截图/复制发给组长本人
         * ===================================================================== */}
        {showQuickCreateSuccess && (() => {
          const data = quickCreateResult || {};
          const realName    = safeStr(data.realName);
          const username    = safeStr(data.username);
          const password    = safeStr(data.password) || '11112222';
          const phone       = safeStr(data.phone);
          const groupName   = safeStr(data.groupName);
          const teamName    = safeStr(data.teamName);
          const level       = safeStr(data.level) || 'P1';
          const commission  = (() => {
            const v = data.commission;
            const n = typeof v === 'number' ? v : safeNum(v, 0.06);
            return `${(n * 100).toFixed(0)}%`;
          })();
          const copyText = [
            '【组长账号开通通知】',
            realName ? `组长姓名：${realName}` : null,
            username ? `登录用户名：${username}` : null,
            `初始密码：${password}`,
            `当前职级：${level}（提成 ${commission}）`,
            '',
            '⚠️ 初始密码固定，请登录后第一时间在「我的 → 修改密码」页面修改，避免账号盗用。'
          ].filter(Boolean).join('\n');
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3">
              <div className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden shadow-2xl">
                {/* 顶部绿色成功 Banner */}
                <div className="relative p-4 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 text-white">
                  <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
                  <div className="absolute -right-8 bottom-0 w-16 h-16 rounded-full bg-white/10" />
                  <div className="relative flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-inner">
                      <Check size={22} strokeWidth={3.5} />
                    </div>
                    <div>
                      <div className="text-[15px] font-black leading-tight">组长账号开通成功 ✅</div>
                      <div className="text-[10px] text-green-50 mt-0.5">系统已自动生成账号密码，请立即转发给组长本人</div>
                    </div>
                  </div>
                </div>

                {/* 主体信息 */}
                <div className="p-4 space-y-3">
                  {/* 账号密码卡片 */}
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2.5">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold text-gray-400">组长姓名</div>
                      <div className="text-[14px] font-black text-gray-900 leading-tight">
                        {renderVal(realName) || '—'}
                      </div>
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-[10px] font-bold text-gray-400">登录用户名</div>
                        <div className="text-[12.5px] font-black text-[#1E40AF] break-all select-all leading-tight">
                          {renderVal(username)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { try { (navigator as any)?.clipboard?.writeText?.(username); } catch { /* noop */ } }}
                        className="shrink-0 px-2 py-1 rounded-lg bg-blue-50 text-[10px] font-extrabold text-[#1E40AF] active:scale-95 transition-transform"
                      >
                        复制
                      </button>
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-[10px] font-bold text-gray-400">初始登录密码</div>
                        <div className="text-[14px] font-black text-red-600 break-all select-all leading-none tracking-wider">
                          {renderVal(password)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { try { (navigator as any)?.clipboard?.writeText?.(password); } catch { /* noop */ } }}
                        className="shrink-0 px-2 py-1 rounded-lg bg-red-50 text-[10px] font-extrabold text-red-600 active:scale-95 transition-transform"
                      >
                        复制
                      </button>
                    </div>
                  </div>

                  {/* 附属信息 */}
                  <div className="rounded-xl bg-white border border-gray-100 p-3 space-y-2 text-[11px]">
                    {phone && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">📱 手机号</span>
                        <span className="font-semibold text-gray-800">{renderVal(phone)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">📈 职级 / 提成</span>
                      <span className="font-bold text-[#1E40AF]">{renderVal(level)} · {renderVal(commission)}</span>
                    </div>
                  </div>

                  {/* 重要提醒（橙底） */}
                  <div className="bg-orange-50 rounded-xl border border-orange-100 p-2.5">
                    <div className="flex items-start space-x-2">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-black leading-none">!</span>
                      </div>
                      <p className="text-[10.5px] leading-relaxed text-orange-800">
                        <span className="font-black">重要提醒：</span>
                        初始密码固定为 <span className="font-black text-red-600">{renderVal(password)}</span>，
                        <span className="font-black">系统不会强制首次登录修改密码</span>。
                        请务必在转发后提醒组长本人，<span className="font-black">登录后第一时间进入「我的 → 修改密码」页面自行修改</span>，避免账号被盗用。
                      </p>
                    </div>
                  </div>

                  {/* 底部按钮 */}
                  <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        try { (navigator as any)?.clipboard?.writeText?.(copyText); } catch { /* noop */ }
                        setShowQuickCreateSuccess(false);
                        setQuickCreateResult(null);
                      }}
                      className="py-2.5 rounded-xl text-[12px] font-black text-[#1E40AF] bg-blue-50 active:scale-95 transition-transform"
                    >
                      📋 复制全部信息
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickCreateSuccess(false);
                        setQuickCreateResult(null);
                      }}
                      className="py-2.5 rounded-xl text-[12px] font-black text-white bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] active:scale-95 transition-transform shadow-md shadow-blue-200"
                    >
                      ✓ 我已保存，关闭
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        </div>
      )
    );
  }

  // Group Leader view
  if (currentUser.role === UserRole.GROUP_LEADER) {
    return (
      <div className="p-4 pb-24">
        <header className="mb-6">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <Users2 className="text-[#1E40AF] mr-2" size={24} />
              我的组员
            </h1>
          </div>
        </header>
        <EmployeeManagement currentUser={currentUser} isAddModalOpen={false} setIsAddModalOpen={() => {}} />
      </div>
    );
  }

  if (selectedTeam) {
    return (
      <TeamMemberDetail
        team={selectedTeam}
        mode={sortBy}
        onBack={() => setSelectedTeam(null)}
      />
    );
  }

  return (
    <div className="pb-6 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Users2 className="text-[#1E40AF] mr-2" size={24} />
            团队管理
          </h1>
          <button
            onClick={handleRefresh}
            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            title="刷新数据"
          >
            <RefreshCw size={20} className="text-[#1E40AF]" />
          </button>
        </div>

        <div className="relative mb-4 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
                <input 
                    type="text"
                    placeholder="输入团队名称或领队姓名筛选..."
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                    value={teamSearchTerm}
                    onChange={(e) => setTeamSearchTerm(e.target.value)}
                />
                {teamSearchTerm && (
                  <button 
                    onClick={() => setTeamSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">总团队数</div>
                    <div className="text-2xl font-black">{teams.length} <span className="text-xs font-normal opacity-70">个</span></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 rounded-2xl text-white shadow-lg shadow-emerald-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">团队总人数</div>
                    <div className="text-2xl font-black">{totalMembers.toLocaleString()} <span className="text-xs font-normal opacity-70">人</span></div>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                    onClick={() => {
                      setSortBy('today');
                      fetchTeams('today');
                    }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'today' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按今日团队总收益
                </button>
                <button
                    onClick={() => {
                      setSortBy('month');
                      fetchTeams('month');
                    }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'month' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按本月团队总收益
                </button>
            </div>
      </header>

      <div className="px-4 mt-4">
        <div className="space-y-3">
            {loading ? (
              <TeamManagementSkeleton />
            ) : filteredAndSortedTeams.length > 0 ? (
              filteredAndSortedTeams.map((team, index) => {
                const kId = String(team.leaderId || team.teamId || team.teamName || `t-${index}`).trim();
                return (
            <div key={`${kId}-${index}`} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-4 transition-colors">
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
                              <Users2 size={24} />
                          )}
                      </div>
                      <div>
                          <div className="flex items-center space-x-2">
                              <span className="text-sm font-black text-gray-900">{team.teamName}</span>
                          </div>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className={`text-xs font-black ${team.growthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>¥ {Number(team.totalRevenue || 0).toFixed(2)}</div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                        {sortBy === 'today' ? '今日团队总收益' : '本月团队总收益'}
                      </div>
                  </div>
              </div>

              <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">成员总数</div>
                          <div className="text-xs font-black text-gray-700">{team.memberCount}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                            {sortBy === 'today' ? '今日广告次数' : '本月广告次数'}
                          </div>
                          <div className={`text-xs font-black ${team.growthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {team.totalAds.toLocaleString()}
                          </div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">平均金币</div>
                          <div className={`text-xs font-black ${team.avgGold >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                              {team.avgGold.toFixed(2)}
                          </div>
                      </div>
                  </div>
              </div>

              <button
                onClick={() => setSelectedTeam(team)}
                className="w-full flex items-center justify-between pt-2 border-t border-gray-50 active:bg-gray-50 rounded-b-xl -m-1 p-1 transition-colors"
              >
                  <div className="flex items-center space-x-1 pl-2">
                      { team.growthRate >= 0 ? (
                        <TrendingUp size={10} className="text-green-600" />
                      ) : (
                        <TrendingDown size={10} className="text-red-500" />
                      )}
                      <span className="text-[9px] font-bold">
                        较{team.growthRate >= 0 ? '上期' : '上期'}
                        <span className={ team.growthRate >= 0 ? 'text-green-600' : 'text-red-500' }>
                          { team.growthRate >= 0 ? '上涨' : '下降' } {Math.abs(team.growthRate)}%
                        </span>
                      </span>
                  </div>
                  <div className="flex items-center text-[9px] font-black text-[#1E40AF] pr-2">
                      {sortBy === 'today' ? '查看今日成员详情' : '查看本月成员详情'}
                      <ChevronRight size={14} className="text-[#1E40AF] ml-0.5" />
                  </div>
              </button>
            </div>
          ); })
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
            <Search size={48} className="opacity-10 mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">未搜索到相关团队</p>
            <button 
              onClick={() => setTeamSearchTerm('')}
              className="mt-4 text-[10px] text-[#1E40AF] font-black underline uppercase"
            >
              显示所有团队
            </button>
          </div>
        )}
        {filteredAndSortedTeams.length > 0 && (
          <div className="py-6 text-center">
              <p className="text-[10px] text-gray-300 font-medium">仅展示活跃排名前 20 的团队</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Team;
