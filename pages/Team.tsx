
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Users2, TrendingUp, ChevronRight, Filter, Award, 
  PlayCircle, ChevronLeft, Search, Zap, Globe, Smartphone, TrendingDown, X, UserPlus, User, Edit2, Trash2, Star, Crown, Phone, MapPin, ChevronDown, RefreshCw
} from 'lucide-react';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import EmployeeManagement from '../components/EmployeeManagement';
import TeamLeaderDashboard from '../components/TeamLeaderDashboard';
import { request } from '../services/api';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { cacheManager } from '../services/cacheManager';

interface TeamItem {
  id?: string; // 可选字段，API返回中可能没有
  teamName: string;
  leaderId: string;
  leader?: string;
  memberCount: number;
  totalAds: number;
  totalRevenue: number;
  avgGold: number;
  growthRate: number;
  level?: '荣耀' | '王牌' | '精英' | '新锐';
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
        {sortedAndFilteredMembers.map((member) => (
          <div key={member.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
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
    console.log('=== 开始获取团队数据 ===');
    const currentUser = authService.getCurrentUser();
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
      console.log('API URL:', `/admin/team-performance?range=${range}`);
      // 注意：api.ts中的request函数会自动返回result.data
      const teamsData = await request<any[]>(`/admin/team-performance?range=${range}`, {
        method: 'GET'
      });
      console.log('Teams API response:', teamsData);

      if (Array.isArray(teamsData)) {
        console.log('Teams data is an array, length:', teamsData.length);
        const validTeams = teamsData.filter(team => {
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
    fetchTeams();
    // 预加载本月数据到缓存
    setTimeout(() => {
      const currentUser = authService.getCurrentUser();
      const monthCacheKey = `teams_${currentUser?.id || 'unknown'}_month`;
      const monthCachedData = cacheManager.get(monthCacheKey, 300000);
      if (!monthCachedData) {
        console.log('预加载本月团队数据...');
        request<any[]>('/admin/team-performance?range=month', {
          method: 'GET'
        }).then(monthData => {
          if (Array.isArray(monthData)) {
            cacheManager.set(monthCacheKey, { teams: monthData });
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
    const refreshInterval = setInterval(() => {
      fetchTeams();
    }, 60000); // 60秒

    return () => clearInterval(refreshInterval);
  }, [fetchTeams]);

  const totalMembers = useMemo(() => {
    return teams.reduce((sum, team) => sum + team.memberCount, 0);
  }, [teams]);

  const filteredAndSortedTeams = useMemo(() => {
    return [...teams]
      .filter(team =>
        team.teamName.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
        team.leaderId.toLowerCase().includes(teamSearchTerm.toLowerCase())
      )
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
  if (currentUser.role === UserRole.NORMAL_ADMIN) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [accountType, setAccountType] = useState<'group' | 'employee'>('group');
    const [filter, setFilter] = useState<string>('all');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState<any>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addType, setAddType] = useState<'group' | 'employee'>('group');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groups, setGroups] = useState<any[]>([]);
    const [formData, setFormData] = useState({
      teamName: '',
      realName: '',
      phone: '',
      region: '',
      employeeId: '',
      groupId: '',
      groupName: '',
      commissionRate: ''
    });
    
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        const teamId = currentUser.id;
        
        // 并行调用两个接口
        const [groupLeaders, employees] = await Promise.all([
          request<any[]>('/admin/employee/group-leaders-simple?teamId=' + teamId, { method: 'GET' }),
          request<any[]>('/admin/employee/employees-simple?teamId=' + teamId, { method: 'GET' })
        ]);
        
        // 直接使用后端返回的数据，不需要任何转换
        setGroups(groupLeaders || []);
        setAccounts([...(groupLeaders || []), ...(employees || [])]);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
      fetchAccounts();
    }, []);
    
    const accountCounts = {
      group: accounts.filter(a => !a.employeeId && a.groupName).length,
      employee: accounts.filter(a => a.employeeId).length
    };
    
    const filterCounts = {
      all: accounts.filter(a => a.employeeId).length,
      normal: accounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) < 3).length,
      '3-7': accounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) >= 3 && (a.zeroEarningsDays || 0) <= 7).length,
      '7-15': accounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) > 7 && (a.zeroEarningsDays || 0) <= 15).length,
      '15+': accounts.filter(a => a.employeeId && (a.zeroEarningsDays || 0) > 15).length
    };
    
    const filteredAccounts = accounts.filter(a => {
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
          commissionRate: ''
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
          commissionRate: account.commission ? String(Math.round(account.commission * 100)) : ''
        });
      }
      
      setShowEditModal(true);
    };
    
    const openDeleteModal = (account: any) => {
      setDeletingAccount(account);
      setShowDeleteModal(true);
    };
    
    const handleEditAccount = async () => {
      if (!editingAccount) return;
      
      try {
        if (editingAccount.role === 'EMPLOYEE') {
          // 查找选中的组信息
          const selectedGroup = groups.find(g => g._id === formData.groupId);
          await request<any>(`/admin/employee/${editingAccount._id}`, {
            method: 'PUT',
            body: JSON.stringify({
              parentId: currentUser.id,
              realName: formData.realName,
              phone: formData.phone,
              region: formData.region,
              employeeId: formData.employeeId,
              groupId: formData.groupId,
              groupName: selectedGroup?.groupName || ''
            })
          });
        } else {
          const commissionRate = formData.commissionRate !== undefined && formData.commissionRate !== '' ? parseFloat(formData.commissionRate) / 100 : undefined;
          const groupId = editingAccount.teamGroupId || editingAccount._id;
          
          // 更新组长信息
          const updateData = {
            groupName: formData.groupName,
            groupLeaderName: formData.realName,
            ...(commissionRate !== undefined && { commission: commissionRate }),
            ...(formData.phone && { phone: formData.phone })
          };
          
          await request<any>(`/admin/employee/group-leader/${groupId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
          });
          
          console.log('更新组长信息成功');
        }
        setShowEditModal(false);
        setEditingAccount(null);
        fetchAccounts();
      } catch (error: any) {
        console.error('Error updating account:', error);
        alert(error.message || '更新失败，请重试');
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
        fetchAccounts();
      } catch (error: any) {
        console.error('Error deleting account:', error);
        alert(error.message || '删除失败，请重试');
      }
    };
    
    const handleAddAccount = async () => {
      setError(null);
      
      if (addType === 'group') {
        if (!formData.groupName || !formData.realName) {
          setError('请填写所有必填字段');
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
          // 创建组长账号
          const commissionRate = formData.commissionRate ? parseFloat(formData.commissionRate) / 100 : 0.05;
          
          // 创建组长账号
          const groupLeaderResult = await request<any>('/admin/employee/group-leader/add', {
            method: 'POST',
            body: JSON.stringify({
              teamLeaderId: currentUser.id,
              teamName: currentUser.teamName || '鼎盛战队',
              groupName: formData.groupName,
              commission: commissionRate,
              groupLeaderName: formData.realName,
              realName: formData.realName,
              phone: formData.phone
            })
          });
          
          console.log('创建组长账号结果:', groupLeaderResult);
          
          // 显示提交成功提示
          alert('组长信息已提交，请等待超管开通账号');
          
          // 刷新账号列表
          fetchAccounts();
        } else {
          await request<any>('/admin/employee/create', {
            method: 'POST',
            body: JSON.stringify({
              parentId: currentUser.id,
              realName: formData.realName,
              phone: formData.phone,
              region: formData.region,
              groupId: formData.groupId,
              employeeId: formData.employeeId
            })
          });
        }
        setShowAddModal(false);
        setAddType('group');
        setFormData({ teamName: '', realName: '', phone: '', region: '', employeeId: '', groupId: '', groupName: '', commissionRate: '' });
        fetchAccounts();
      } catch (error: any) {
        console.error('Error adding account:', error);
        setError(error.message || '添加失败，请重试');
      } finally {
        setSaving(false);
      }
    };
    
    return (
      loading ? (
        <TeamSkeleton />
      ) : (
        <div className="p-4 pb-24">
          <header className="mb-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <User className="text-[#1E40AF] mr-2" size={24} />
                帐号管理
              </h1>
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
            员工账号 ({accountCounts.employee})
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
            {filteredAccounts.map((account) => (
              <div key={account._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      account.role === 'EMPLOYEE' 
                        ? 'bg-blue-100 text-blue-600' 
                        : account.teamGroupId || account.groupName 
                          ? 'bg-orange-100 text-orange-600' 
                          : 'bg-purple-100 text-purple-600'
                    }`}>
                      {account.role === 'EMPLOYEE' ? (
                        <User size={20} />
                      ) : account.teamGroupId || account.groupName ? (
                        <Star size={20} />
                      ) : (
                        <Crown size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {account.role === 'EMPLOYEE' ? (
                        <>
                          <h3 className="text-sm font-bold text-gray-900">
                            {account.realName}
                            {account.employeeId && <span className="ml-2 text-[#1E40AF]">({account.employeeId})</span>}
                          </h3>
                          <p className="text-[10px] text-gray-400">
                            {account.phone && <span>{account.phone}</span>}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            地区：{account.region || '无'}
                          </p>
                          <p className="text-[10px] text-orange-600 mt-0.5">
                            组别：{account.groupName || '无'}
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-sm font-bold text-gray-900">{account.groupName || account.username}</h3>
                          {account.realName && (
                            <p className="text-[10px] text-blue-600 mt-0.5">
                              组长：{account.realName}
                            </p>
                          )}
                          {account.commission !== undefined && (
                            <p className="text-[10px] text-blue-600 mt-0.5">
                              分成：{Math.round(account.commission * 100)}%
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {account.role === 'EMPLOYEE' && (
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const days = account.zeroEarningsDays || 0;
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
                        {account.createdAt && (
                          <span className="text-[10px] text-[#1E40AF]">
                            {new Date(account.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                    {account.role !== 'EMPLOYEE' && account.createdAt && (
                      <span className="text-[10px] text-[#1E40AF]">
                        {new Date(account.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(account)}
                        className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(account)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${(account.status === 'enabled' || account.status === '1' || !account.status) ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {(account.status === 'enabled' || account.status === '1' || !account.status) ? '启用' : '禁用'}
                      </span>
                      <button
                        onClick={() => toggleAccountStatus(account)}
                        className={`w-10 h-6 rounded-full p-0.5 transition-all ${(account.status === 'enabled' || account.status === '1' || !account.status) ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${(account.status === 'enabled' || account.status === '1' || !account.status) ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                    {/* 显示开通状态（只有组长账号才显示） */}
                    {(account.role !== 'EMPLOYEE' && account.groupName && (
                      <div className="mt-2 space-y-1">
                        {!(account.teamGroupId || account.groupName) ? (
                          <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            待开通
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            已开通
                          </span>
                        )}
                      </div>
                    ))}

                  </div>
                </div>
              </div>
            ))}
            {filteredAccounts.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                暂无{accountType === 'group' ? '组长' : '员工'}账号
              </div>
            )}
          </div>
        )}
        
        {/* 编辑模态框 */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">
                编辑{accountType === 'group' ? '组长' : '员工'}账号
              </h2>
              <div className="space-y-4">
                {accountType === 'group' ? (
                  <>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">组名</label>
                      <input
                        type="text"
                        value={formData.groupName}
                        onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">组长姓名</label>
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
                      <label className="text-xs font-bold text-gray-700 block mb-1">分成比例(%)</label>
                      <input
                        type="number"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                          {groups.map((group: any) => (
                            <option key={group._id} value={group._id}>
                              {group.groupName}
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
                确定要删除这个{accountType === 'group' ? '组长' : '员工'}账号吗？
              </p>
              <div className="flex space-x-3">
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
                新建{addType === 'group' ? '组长' : '员工'}账号
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
                  员工账号
                </button>
              </div>
              
              <div className="space-y-4">
                {addType === 'group' ? (
                  <>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-700">
                        请如实填下以下组长信息，提交后等待总管理员进行帐号配置（一般1小时之内），配置完成后，组长进入系统的用户名默认为下面填写的姓名全拼，如组长姓名张三，默认用户名就是：zhangsan，初始密码默认为：11112222
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">组名称 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.groupName}
                        onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">组长姓名 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">手机号</label>
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
                      <label className="text-xs font-bold text-gray-700 block mb-1">分成比例 (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        placeholder="默认5%，最高不超过20%"
                        value={formData.commissionRate}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (e.target.value === '' || (value >= 0 && value <= 20)) {
                            setFormData({ ...formData, commissionRate: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="text-[10px] text-blue-600 mt-1 mb-3">组长分成比例，默认5%，最高不超过20%</p>
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
                          {groups.map((group) => (
                            <option key={group._id} value={group._id}>
                              {group.groupName}
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
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddType('group');
                    setFormData({ teamName: '', realName: '', phone: '', region: '', employeeId: '', groupId: '', groupName: '', commissionRate: '' });
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
              filteredAndSortedTeams.map((team, index) => (
            <div key={team.leaderId} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-4 transition-colors">
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
          ))
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
