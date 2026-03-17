
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Users2, TrendingUp, ChevronRight, Filter, Award, 
  PlayCircle, ChevronLeft, Search, Zap, Globe, Smartphone, TrendingDown, X, UserPlus, User, Edit2, Trash2, Star, Crown, Phone, MapPin, ChevronDown
} from 'lucide-react';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import EmployeeManagement from '../components/EmployeeManagement';
import TeamLeaderDashboard from '../components/TeamLeaderDashboard';
import { request } from '../services/api';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface TeamItem {
  id: string;
  leader: string;
  memberCount: number;
  todayAds: number;
  monthlyAds: number;
  totalAds: number;
  todayRevenue: number;
  todayEarnings?: number;
  earnings?: number;
  totalRevenue: number;
  totalEarnings?: number;
  todayGrowth: number;
  monthGrowth: number;
  ecpm: number;
  todayActiveRate: string;
  monthlyActiveRate: string;
  level: '荣耀' | '王牌' | '精英' | '新锐';
}

interface MemberInfo {
  id: string;
  name: string;
  avatar: string;
  todayWatched: number;
  monthlyWatched: number;
  todayEarnings: number;
  monthlyEarnings: number;
  todayEcpm: number;
  monthlyEcpm: number;
  status: '在线' | '离线';
}

const mockTeams: TeamItem[] = [
  { id: 'T001', leader: '张管理', memberCount: 1240, todayAds: 1240, monthlyAds: 45800, totalAds: 45800, todayRevenue: 3420.5, totalRevenue: 128400, todayGrowth: 12.5, monthGrowth: 8.4, ecpm: 154.2, todayActiveRate: '82%', monthlyActiveRate: '94%', level: '荣耀' },
  { id: 'T002', leader: '李管理', memberCount: 840, todayAds: 840, monthlyAds: 28400, totalAds: 28400, todayRevenue: 2150.8, totalRevenue: 94200, todayGrowth: -2.1, monthGrowth: 15.2, ecpm: 142.1, todayActiveRate: '75%', monthlyActiveRate: '88%', level: '王牌' },
  { id: 'T003', leader: '王主管', memberCount: 420, todayAds: 420, monthlyAds: 15200, totalAds: 15200, todayRevenue: 1280.0, totalRevenue: 48200, todayGrowth: 5.4, monthGrowth: -1.2, ecpm: 138.5, todayActiveRate: '68%', monthlyActiveRate: '72%', level: '精英' },
  { id: 'T004', leader: '陈队长', memberCount: 150, todayAds: 150, monthlyAds: 8900, totalAds: 8900, todayRevenue: 450.2, totalRevenue: 12500, todayGrowth: 22.1, monthGrowth: 42.5, ecpm: 162.0, todayActiveRate: '91%', monthlyActiveRate: '98%', level: '精英' },
  { id: 'T005', leader: '赵领队', memberCount: 85, todayAds: 85, monthlyAds: 2100, totalAds: 2100, todayRevenue: 120.5, totalRevenue: 3200, todayGrowth: -8.4, monthGrowth: -15.0, ecpm: 98.4, todayActiveRate: '42%', monthlyActiveRate: '55%', level: '新锐' },
];

const TeamMemberDetail: React.FC<{ team: TeamItem; activeRate: string; mode: 'today' | 'month'; onBack: () => void }> = ({ team, activeRate, mode, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc'>('earnings');
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/team/${team.id}/members?range=${mode}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const result = await response.json();
        if (result.success) {
          console.log('Team members API response:', result.members);
          setMembers(result.members || []);
        } else {
          throw new Error(result.message || '获取成员列表失败');
        }
      } catch (error) {
        console.error('Error fetching members:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [team.id, mode]);

  // Sort by selected criteria and filter by search term
  const sortedAndFilteredMembers = useMemo(() => {
    return members
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
          const agcA = mode === 'today' 
            ? (a.todayEarnings * 1000) / (a.todayWatched || 1)
            : (a.monthlyEarnings * 1000) / (a.monthlyWatched || 1);
          const agcB = mode === 'today'
            ? (b.todayEarnings * 1000) / (b.todayWatched || 1)
            : (b.monthlyEarnings * 1000) / (b.monthlyWatched || 1);
          return agcB - agcA; // High to Low
        }
      });
  }, [members, searchTerm, mode, sortBy]);

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
              共 {team.memberCount} 位成员 • {mode === 'today' ? '今日' : '本月'}活跃率 {activeRate}
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
                    <div className={`text-xs font-black ${(mode === 'today' ? (member.todayEarnings * 1000 / (member.todayWatched || 1)) : (member.monthlyEarnings * 1000 / (member.monthlyWatched || 1))) >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                      {(mode === 'today' ? (member.todayEarnings * 1000 / (member.todayWatched || 1)) : (member.monthlyEarnings * 1000 / (member.monthlyWatched || 1))).toFixed(2)}
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
                <div className={`text-[11px] font-black ${(mode === 'today' ? (member.todayEarnings * 1000 / (member.todayWatched || 1)) : (member.monthlyEarnings * 1000 / (member.monthlyWatched || 1))) >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                  {(mode === 'today' ? (member.todayEarnings * 1000 / (member.todayWatched || 1)) : (member.monthlyEarnings * 1000 / (member.monthlyWatched || 1))).toFixed(2)}
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
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/team/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      const teamsData = result.data || [];
      
      // 获取所有用户列表来计算实际用户数（排除禁用的用户）
      try {
        const token = localStorage.getItem('admin_token');
        const userResponse = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/dashboard/users?range=today', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (userResponse.ok) {
          const userResult = await userResponse.json();
          const users = userResult.data || userResult || [];
          console.log('Team.tsx - 所有用户列表:', users);
          console.log('Team.tsx - 用户总数:', users.length);
          console.log('Team.tsx - 用户状态示例:', users.slice(0, 5).map((u: any) => ({ id: u.userId || u.employeeId, status: u.status, parentName: u.parentName })));
          
          // 过滤掉禁用的用户
          const enabledUsers = users.filter((user: any) => user.status !== 'disabled' && user.status !== '禁用');
          setAllUsers(enabledUsers);
          console.log('Team.tsx - 启用的用户数:', enabledUsers.length);
          
          // 更新每个团队的memberCount
          const updatedTeams = teamsData.map((team: TeamItem) => {
            const teamUsers = enabledUsers.filter((user: any) => {
              const userTeam = user.parentName || user.teamName || user.superior || '系统直属';
              return userTeam === team.leader;
            });
            console.log(`Team.tsx - 团队 ${team.leader}: 用户数=${teamUsers.length}`);
            return { ...team, memberCount: teamUsers.length };
          });
          setTeams(updatedTeams);
        } else {
          setTeams(teamsData);
        }
      } catch (error) {
        console.error('获取用户列表失败:', error);
        setTeams(teamsData);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams(mockTeams);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const totalMembers = useMemo(() => {
    return teams.reduce((sum, team) => sum + team.memberCount, 0);
  }, [teams]);

  const filteredAndSortedTeams = useMemo(() => {
    return [...teams]
      .filter(team => 
        team.leader.toLowerCase().includes(teamSearchTerm.toLowerCase()) || 
        team.id.toLowerCase().includes(teamSearchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const revenueA = sortBy === 'today' ? Number(a.todayRevenue || 0) : Number(a.totalRevenue || 0);
        const revenueB = sortBy === 'today' ? Number(b.todayRevenue || 0) : Number(b.totalRevenue || 0);
        return revenueB - revenueA;
      });
  }, [teams, teamSearchTerm, sortBy]);

  if (!currentUser) return null;

  // Normal Admin (Team Leader) view
  if (currentUser.role === UserRole.NORMAL_ADMIN) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [accountType, setAccountType] = useState<'group' | 'employee'>('group');
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
      username: '',
      password: '',
      employeeId: '',
      groupId: '',
      groupName: '',
      commissionRate: ''
    });
    
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        console.log('Team.tsx - 当前用户:', currentUser);
        console.log('Team.tsx - 团队名称:', currentUser.teamName);
        
        // 获取组长账号
        const groupAccounts = await request<any[]>('/admin/group-leader/list', { method: 'GET' });
        console.log('Team.tsx - 所有组长账号:', groupAccounts);
        
        // 获取员工账号
        const employeeAccounts = await request<any[]>('/employee/list?pageSize=100', { method: 'GET' });
        console.log('Team.tsx - 所有员工账号:', employeeAccounts);
        
        // 获取组列表
        const groupsData = await request<any[]>('/admin/team-group/list', { method: 'GET' });
        const filteredGroups = groupsData.filter((g: any) => g.teamName === currentUser.teamName);
        setGroups(filteredGroups);
        console.log('Team.tsx - 组列表:', filteredGroups);
        
        // 过滤出本团队的账号
        const teamName = currentUser.teamName || '';
        const filteredGroupsAccounts = groupAccounts.filter((acc: any) => acc.teamName === teamName);
        const filteredEmployees = employeeAccounts.filter((acc: any) => acc.parentName === teamName);
        
        console.log('Team.tsx - 过滤后的组长账号:', filteredGroupsAccounts);
        console.log('Team.tsx - 过滤后的员工账号:', filteredEmployees);
        
        setAccounts([...filteredGroupsAccounts, ...filteredEmployees]);
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
      group: accounts.filter(a => a.role === 'GROUP_LEADER' || (a.teamGroupId || a.groupName)).length,
      employee: accounts.filter(a => a.role === 'EMPLOYEE').length
    };
    
    const filteredAccounts = accounts.filter(a => {
      if (accountType === 'group') {
        return (a.role === 'GROUP_LEADER' || (a.teamGroupId || a.groupName)) && 
               (a.realName?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
                a.groupName?.toLowerCase().includes(searchKeyword.toLowerCase()));
      } else {
        return a.role === 'EMPLOYEE' && 
               (a.realName?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
                a.employeeId?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                a.phone?.toLowerCase().includes(searchKeyword.toLowerCase()));
      }
    });
    
    const toggleAccountStatus = async (account: any) => {
      try {
        const currentEnabled = account.status === 'enabled' || account.status === '1';
        const newStatus = currentEnabled ? 'disabled' : 'enabled';
        
        if (account.role === 'EMPLOYEE') {
          await request<any>(`/employee/${account._id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
        } else {
          await request<any>(`/admin/group-leader/${account._id}`, {
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
          username: '',
          password: '',
          employeeId: account.employeeId || '',
          groupId: account.groupId || '',
          groupName: account.groupName || '',
          commissionRate: ''
        });
      } else {
        setFormData({
          teamName: account.teamName || '',
          realName: account.realName || '',
          phone: account.phone || '',
          region: account.region || '',
          username: account.username || '',
          password: '',
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
          await request<any>(`/employee/${editingAccount._id}`, {
            method: 'PUT',
            body: JSON.stringify({
              parentId: currentUser.id,
              realName: formData.realName,
              phone: formData.phone,
              region: formData.region,
              employeeId: formData.employeeId,
              groupId: formData.groupId
            })
          });
        } else {
          const commissionRate = formData.commissionRate ? parseFloat(formData.commissionRate) / 100 : undefined;
          await request<any>(`/admin/group-leader/${editingAccount._id}`, {
            method: 'PUT',
            body: JSON.stringify({
              realName: formData.realName,
              phone: formData.phone,
              region: formData.region,
              username: formData.username,
              password: formData.password || undefined,
              teamGroupId: formData.groupId,
              groupName: formData.groupName,
              ...(commissionRate !== undefined && { commission: commissionRate })
            })
          });
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
          await request<any>(`/employee/${deletingAccount._id}`, {
            method: 'DELETE'
          });
        } else {
          await request<any>(`/admin/group-leader/${deletingAccount._id}`, {
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
        if (!formData.groupName || !formData.realName || !formData.username || !formData.password) {
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
          const commissionRate = formData.commissionRate ? parseFloat(formData.commissionRate) / 100 : 0.05;
          
          // 第一步：先创建组
          const groupResult = await request<any>('/admin/team-group/add', {
            method: 'POST',
            body: JSON.stringify({
              teamLeaderId: currentUser.id,
              teamName: currentUser.teamName,
              groupName: formData.groupName,
              commission: commissionRate
            })
          });
          
          // 第二步：创建组长，使用刚创建的组ID
          await request<any>('/admin/group-leader/add', {
            method: 'POST',
            body: JSON.stringify({
              username: formData.username,
              password: formData.password,
              realName: formData.realName,
              teamName: currentUser.teamName,
              teamGroupId: groupResult._id,
              groupName: formData.groupName,
              commission: commissionRate
            })
          });
        } else {
          await request<any>('/employee/create', {
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
        setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', groupId: '', groupName: '', commissionRate: '' });
        fetchAccounts();
      } catch (error: any) {
        console.error('Error adding account:', error);
        setError(error.message || '添加失败，请重试');
      } finally {
        setSaving(false);
      }
    };
    
    return (
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
        )}
        
        {loading ? (
          <div className="text-center py-10 text-gray-400">加载中...</div>
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
                            组别：{account.groupName || '无'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            地区：{account.region || '无'}
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
                    {account.createdAt && (
                      <span className="text-[10px] text-gray-400">
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
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${(account.status === 'enabled' || account.status === '1') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {(account.status === 'enabled' || account.status === '1') ? '启用' : '禁用'}
                      </span>
                      <button
                        onClick={() => toggleAccountStatus(account)}
                        className={`w-10 h-6 rounded-full p-0.5 transition-all ${(account.status === 'enabled' || account.status === '1') ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${(account.status === 'enabled' || account.status === '1') ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
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
                      <label className="text-xs font-bold text-gray-700 block mb-1">员工号</label>
                      <input
                        type="text"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
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
                      <label className="text-xs font-bold text-gray-700 block mb-1">用户名 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder="请输入用户名"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">密码 <span className="text-red-500">*</span></label>
                      <input
                        type="password"
                        placeholder="请输入密码"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
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
                      <p className="text-[10px] text-gray-400 mt-1">组长分成比例，默认5%，最高不超过20%</p>
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
                    setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', groupId: '', groupName: '', commissionRate: '' });
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
        activeRate={sortBy === 'today' ? selectedTeam.todayActiveRate : selectedTeam.monthlyActiveRate} 
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
            ) : filteredAndSortedTeams.length > 0 ? (
              filteredAndSortedTeams.map((team, index) => (
            <div key={team.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm ${
                          index === 0 ? 'bg-yellow-500 text-white' : // 第1名 - 金色
                          index === 1 ? 'bg-gray-300 text-gray-800' : // 第2名 - 银色
                          index === 2 ? 'bg-orange-600 text-white' : 'bg-green-400 text-white' // 第3名 - 铜色，其他 - 绿色
                      }`}>
                          <Award size={24} />
                      </div>
                      <div>
                          <div className="flex items-center space-x-2">
                              <span className="text-sm font-black text-gray-900">{team.leader}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                            {sortBy === 'today' ? '今日成员活跃率' : '本月成员活跃率'}: {sortBy === 'today' ? team.todayActiveRate : team.monthlyActiveRate}
                          </div>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className={`text-xs font-black ${sortBy === 'today' ? (team.todayGrowth >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-900'}`}>¥ {Number(sortBy === 'today' ? team.todayRevenue || 0 : team.totalRevenue || 0).toFixed(2)}</div>
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
                          <div className={`text-xs font-black ${sortBy === 'today' ? (team.todayGrowth >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-700'}`}>
                            {(sortBy === 'today' ? team.todayAds : team.monthlyAds).toLocaleString()}
                          </div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">平均金币</div>
                          <div className={`text-xs font-black ${(Number(team.todayRevenue || 0) * 1000 / (Number(team.todayAds || 0) || 1)) >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                              {(Number(team.todayRevenue || 0) * 1000 / (Number(team.todayAds || 0) || 1)).toFixed(2)}
                          </div>
                      </div>
                  </div>
                  <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/30 flex items-center justify-between">
                      <div className="text-[9px] text-gray-500 font-black uppercase tracking-wider flex items-center">
                          <TrendingUp size={12} className="text-[#1E40AF] mr-1.5" />
                          本月团队累计总收益
                      </div>
                      <div className="text-sm font-black text-[#1E40AF]">
                          ¥ {Number(team.totalRevenue).toFixed(2)}
                      </div>
                  </div>
              </div>

              <button 
                onClick={() => setSelectedTeam(team)}
                className="w-full flex items-center justify-between pt-2 border-t border-gray-50 active:bg-gray-50 rounded-b-xl -m-1 p-1 transition-colors"
              >
                  <div className="flex items-center space-x-1 pl-2">
                      { (sortBy === 'today' ? team.todayGrowth : team.monthGrowth) >= 0 ? (
                        <TrendingUp size={10} className="text-green-600" />
                      ) : (
                        <TrendingDown size={10} className="text-red-500" />
                      )}
                      <span className="text-[9px] font-bold">
                        较{sortBy === 'today' ? '昨日' : '上月'}业绩
                        <span className={ (sortBy === 'today' ? team.todayGrowth : team.monthGrowth) >= 0 ? 'text-green-600' : 'text-red-500' }>
                          { (sortBy === 'today' ? team.todayGrowth : team.monthGrowth) >= 0 ? '上涨' : '下降' } {Math.abs(sortBy === 'today' ? team.todayGrowth : team.monthGrowth)}%
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
