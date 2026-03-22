import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, UserPlus, Users, Search, ChevronRight,
  Shield, User, Crown, Star, ToggleLeft, ToggleRight, Trash2, Phone, MapPin, Users2, Edit2, ChevronDown
} from 'lucide-react';
import { request } from '../services/api';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface Account {
  _id: string;
  username: string;
  role: string;
  status: string;
  teamName?: string;
  realName?: string;
  phone?: string;
  region?: string;
  parentId?: string;
  groupId?: string;
  groupName?: string;
  teamGroupId?: string;
  employeeId?: string;
  commission?: number;
  createdAt: string;
  parentName?: string;
  superior?: string;
  isGroupLeader?: boolean;
}

interface AccountManagementProps {
  onBack: () => void;
}

const AccountManagement: React.FC<AccountManagementProps> = ({ onBack }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<Account[]>([]);
  const scrollPositionRef = useRef<number>(0);
  const [groups, setGroups] = useState<{ _id: string; groupName: string; teamLeaderId: string; teamName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [addType, setAddType] = useState<'team' | 'employee' | 'group'>('team');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });
  
  const [formData, setFormData] = useState({
    teamName: '',
    realName: '',
    phone: '',
    region: '',
    username: '',
    password: '',
    employeeId: '',
    parentId: '',
    groupId: '',
    groupName: '',
    commissionRate: ''
  });

  // 获取当前登录用户信息
  const fetchCurrentUser = async () => {
    try {
      const userStr = localStorage.getItem('admin_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        return user;
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return null;
  };

  const fetchAccounts = async () => {
    setLoading(true);
    // 保存当前滚动位置
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const startTime = performance.now();
    try {
      // 获取当前用户信息
      const user = await fetchCurrentUser();
      const isTeamLeader = user?.role === 'NORMAL_ADMIN';
      const teamName = user?.teamName;
      
      console.log('当前用户:', user);
      console.log('是否团队长:', isTeamLeader);
      console.log('团队名称:', teamName);
      
      // 并行获取所有数据，提高加载速度
      const [teamResponse, employeeResponse, teamsListResponse] = await Promise.all([
        request<any>('/admin/account/list', { method: 'GET' }).catch(error => {
          console.error('Error fetching team accounts:', error);
          return null;
        }),
        request<any>('/admin/employee/list?pageSize=1000', { method: 'GET' }).catch(error => {
          console.error('Error fetching employee accounts:', error);
          return null;
        }),
        request<any>('/team/list', { method: 'GET' }).catch(error => {
          console.error('Error fetching teams list:', error);
          return null;
        })
      ]);
      
      // 获取所有团队的组长账号
      let apiGroupLeaders: any[] = [];
      if (teamsListResponse) {
        const teams = Array.isArray(teamsListResponse) ? teamsListResponse : (teamsListResponse?.data || []);
        console.log('Teams list:', teams);
        
        // 并行获取所有团队的组长账号
        const groupLeadersPromises = teams.map(async (team: any) => {
          try {
            const teamGroupLeaders = await request<any>(`/admin/employee/group-leaders?teamId=${team.id}`, { method: 'GET' });
            const leaders = Array.isArray(teamGroupLeaders) ? teamGroupLeaders : (teamGroupLeaders?.data || []);
            // 为每个组长添加团队名称
            return leaders.map((leader: any) => ({
              ...leader,
              teamName: team.leader || team.name || team.teamName || '未知团队'
            }));
          } catch (error) {
            console.error(`Error fetching group leaders for team ${team.id}:`, error);
            return [];
          }
        });
        
        const groupLeadersResults = await Promise.all(groupLeadersPromises);
        apiGroupLeaders = groupLeadersResults.flat();
        console.log('All group leaders from API:', apiGroupLeaders);
      }
      
      const apiTime = performance.now() - startTime;
      console.log(`API请求时间: ${apiTime.toFixed(2)}ms`);
      
      // 打印原始API响应
      console.log('团队账号API响应:', teamResponse);
      console.log('员工账号API响应:', employeeResponse);
      console.log('团队列表API响应:', teamsListResponse);
      
      // 处理团队账号数据
      const rawTeamAccounts = teamResponse 
        ? (Array.isArray(teamResponse) ? teamResponse : (teamResponse?.admins || [])) 
        : [];
      
      console.log('原始团队账号数据:', rawTeamAccounts);
      
      // 处理员工账号数据
      const employeeAccounts = employeeResponse 
        ? (Array.isArray(employeeResponse) ? employeeResponse : (employeeResponse?.data || [])) 
        : [];
      
      console.log('原始员工账号数据:', employeeAccounts);
      console.log('员工账号数量:', employeeAccounts.length);
      console.log('员工角色分布:', employeeAccounts.map((e: any) => ({ realName: e.realName, role: e.role, isGroupLeader: e.isGroupLeader })));
      
      // 从员工账号中提取组长（有groupId且是组长的员工）
      const employeeGroupLeaders = employeeAccounts.filter((e: any) => {
        const isLeader = e.isGroupLeader || e.role === 'group_leader' || e.role === 'GROUP_LEADER' || (e.groupId && e.groupId !== '');
        console.log('检查员工:', e.realName, 'isGroupLeader:', e.isGroupLeader, 'role:', e.role, 'groupId:', e.groupId, 'isLeader:', isLeader);
        return isLeader;
      });
      
      // 从团队账号中提取组长（role为GROUP_LEADER的账号）
      const teamGroupLeaders = rawTeamAccounts.filter((a: any) => 
        a.role === 'GROUP_LEADER' || a.role === 'group_leader'
      );
      
      console.log('API组长数据:', apiGroupLeaders);
      console.log('API组长数量:', apiGroupLeaders.length);
      
      // 转换API组长数据为账号格式
      const convertedApiGroupLeaders = apiGroupLeaders.map((leader: any) => ({
        _id: leader.groupLeaderId || leader._id,
        realName: leader.groupLeaderName || leader.realName || '未知组长',
        username: leader.groupLeaderName || leader.username || '未知组长',
        role: 'GROUP_LEADER',
        status: 'active',
        groupName: leader.groupName,
        teamName: leader.teamName,
        parentId: leader.teamLeaderId,
        commission: leader.commission,
        createdAt: leader.createdAt
      }));
      
      // 合并组长账号
      const groupLeaders = [...employeeGroupLeaders, ...teamGroupLeaders, ...convertedApiGroupLeaders];
      const groupLeaderIds = new Set(groupLeaders.map((g: any) => g._id));
      
      console.log('合并后组长账号数:', groupLeaders.length);
      
      console.log('提取的组长:', groupLeaders);
      console.log('组长ID列表:', groupLeaderIds);
      console.log('组长数量:', groupLeaders.length);
      
      // 过滤团队账号：NORMAL_ADMIN角色且不在组长ID列表中
      const teamAccounts = rawTeamAccounts.filter((a: any) => 
        a.role === 'NORMAL_ADMIN' && !groupLeaderIds.has(a._id)
      );
      
      console.log('过滤后的团队账号:', teamAccounts);
      
      // 如果是团队长，只显示自己团队的数据
      let filteredEmployees = employeeAccounts;
      if (isTeamLeader && teamName) {
        filteredEmployees = employeeAccounts.filter((e: any) => {
          const employeeTeam = e.parentName || e.teamName || e.superior || '';
          return employeeTeam === teamName;
        });
        console.log('团队长过滤 - 团队名:', teamName, '过滤后员工数:', filteredEmployees.length);
      }
      
      // 过滤掉 filteredEmployees 中的组长账号，避免重复添加
      const nonLeaderEmployees = filteredEmployees.filter((e: any) => {
        const isLeader = e.isGroupLeader || e.role === 'group_leader' || e.role === 'GROUP_LEADER' || (e.groupId && e.groupId !== '');
        return !isLeader;
      });
      
      // 合并账号数据（团队长 + 组长 + 非组长员工）
      const allAccounts = [...teamAccounts, ...groupLeaders, ...nonLeaderEmployees];
      const processTime = performance.now() - startTime;
      console.log(`数据处理时间: ${(processTime - apiTime).toFixed(2)}ms`);
      console.log('合并后总账号数:', allAccounts.length);
      console.log('合并后组长账号数:', allAccounts.filter((a: any) => 
        a.isGroupLeader || a.role === 'group_leader' || a.role === 'GROUP_LEADER' || (a.groupId && a.groupId !== '')
      ).length);
      console.log('合并后所有账号角色分布:', allAccounts.map((a: any) => ({ 
        realName: a.realName, 
        role: a.role, 
        isGroupLeader: a.isGroupLeader, 
        employeeId: a.employeeId 
      })));
      
      setAccounts(allAccounts);
      setTeamLeaders(teamAccounts);
      
      // 从所有员工数据中提取组信息，而不是只从过滤后的员工数据中提取
      const groupsMap = new Map();
      employeeAccounts.forEach((e: any) => {
        if (e.groupId && e.groupName) {
          if (!groupsMap.has(e.groupId)) {
            groupsMap.set(e.groupId, {
              _id: e.groupId,
              groupName: e.groupName,
              teamLeaderId: e.parentId || '',
              teamName: e.teamName || e.superior || ''
            });
          }
        }
      });
      setGroups(Array.from(groupsMap.values()));
      
      const totalTime = performance.now() - startTime;
      console.log(`总加载时间: ${totalTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('Error in fetchAccounts:', error);
      setAccounts([]);
      setTeamLeaders([]);
      setGroups([]);
    } finally {
      setLoading(false);
      // 恢复滚动位置
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 0);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);



  const handleAddAccount = async () => {
    setError(null);
    
    if (addType === 'team') {
      if (!formData.teamName || !formData.realName || !formData.phone || !formData.region || !formData.username || !formData.password) {
        setError('请填写所有必填字段');
        return;
      }
    } else if (addType === 'group') {
      if (!formData.parentId || !formData.realName || !formData.phone || !formData.region || !formData.username || !formData.password || !formData.groupName) {
        setError('请填写所有必填字段');
        return;
      }
    } else {
      if (!formData.parentId || !formData.realName || !formData.phone || !formData.region) {
        setError('请填写所有必填字段');
        return;
      }
    }

    setSaving(true);
    try {
      if (addType === 'team') {
        await request<any>('/admin/account/create', {
          method: 'POST',
          body: JSON.stringify({
            teamName: formData.teamName,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            username: formData.username,
            password: formData.password,
            role: 'NORMAL_ADMIN'
          })
        });
      } else if (addType === 'group') {
        // 获取选中的团队信息
        const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
        
        // 获取分成比例，默认为10%
        const commissionRate = formData.commissionRate ? parseFloat(formData.commissionRate) / 100 : 0.1;
        
        // 1. 先创建管理员账号
        const adminResult = await request<any>('/admin/account/create', {
          method: 'POST',
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
            role: 'GROUP_LEADER',
            parentId: formData.parentId,
            teamName: selectedTeam?.teamName || '',
            groupName: formData.groupName,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region
          })
        });
        
        if (!adminResult) {
          setError('创建管理员账号失败');
          return;
        }
        
        // 2. 再将该管理员设置为组长
        await request<any>('/admin/employee/group-leader/add', {
          method: 'POST',
          body: JSON.stringify({
            teamLeaderId: formData.parentId,
            teamName: selectedTeam?.teamName || '',
            groupName: formData.groupName,
            commission: commissionRate,
            groupLeaderId: adminResult.id,
            groupLeaderName: formData.username
          })
        });
      } else {
        // 获取选中的组信息
        const selectedGroup = groups.find(g => g._id === formData.parentId);
        const selectedTeam = teamLeaders.find(t => t._id === selectedGroup?.teamLeaderId);
        
        await request<any>('/admin/account/add-employee', {
          method: 'POST',
          body: JSON.stringify({
            username: formData.realName,
            password: '123456', // 默认密码
            parentId: selectedGroup?.teamLeaderId || formData.parentId,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            groupId: formData.parentId,
            groupName: selectedGroup?.groupName,
            teamName: selectedTeam?.teamName
          })
        });
      }
      
      setShowAddModal(false);
      setFormData({
        teamName: '',
        realName: '',
        phone: '',
        region: '',
        username: '',
        password: '',
        employeeId: '',
        parentId: '',
        groupId: '',
        groupName: '',
        commissionRate: ''
      });
      fetchAccounts();
    } catch (error: any) {
      console.error('Error adding account:', error);
      setError(error.message || '添加账号失败');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAccount = async () => {
    if (!editingAccount) return;
    
    setError(null);
    
    if (editingAccount.role === 'employee' || editingAccount.employeeId) {
      if (!formData.realName || !formData.phone || !formData.region) {
        setError('请填写所有必填字段');
        return;
      }
    } else {
      if (!formData.teamName || !formData.realName) {
        setError('请填写所有必填字段');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingAccount.role === 'employee' || editingAccount.employeeId) {
        // 获取选中的团队和组信息
        const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
        const selectedGroup = groups.find(g => g._id === formData.groupId);
        
        await request<any>(`/admin/employee/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            employeeId: formData.employeeId,
            parentId: formData.parentId || editingAccount.parentId,
            groupId: formData.groupId || editingAccount.groupId,
            groupName: selectedGroup?.groupName || editingAccount.groupName,
            teamName: selectedTeam?.teamName || editingAccount.teamName,
            superior: selectedTeam?.teamName || editingAccount.teamName
          })
        });
      } else {
        const updateData: any = {
          realName: formData.realName,
          phone: formData.phone,
          region: formData.region
        };
        
        // 根据账号类型设置不同的字段
        if (editingAccount.role === 'NORMAL_ADMIN') {
          updateData.teamName = formData.teamName;
        } else if (editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader') {
          updateData.groupName = formData.groupName;
        }
        
        // 只有当用户名和密码不为空时才更新
        if (formData.username) {
          updateData.username = formData.username;
        }
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        await request<any>(`/admin/account/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });
      }
      
      setShowEditModal(false);
      setEditingAccount(null);
      setFormData({
        teamName: '',
        realName: '',
        phone: '',
        region: '',
        username: '',
        password: '',
        employeeId: '',
        parentId: '',
        groupId: '',
        groupName: '',
        commissionRate: ''
      });
      fetchAccounts();
    } catch (error: any) {
      console.error('Error updating account:', error);
      setError(error.message || '更新账号失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    console.log('开始删除账号');
    if (!deletingAccount) {
      console.log('deletingAccount为空');
      return;
    }

    console.log('删除账号信息:', deletingAccount);
    setSaving(true);
    try {
      // 对于组长账号，无论是否有employeeId，都使用管理员删除API
      const isGroupLeader = deletingAccount.isGroupLeader || deletingAccount.role === 'GROUP_LEADER' || deletingAccount.role === 'group_leader';
      console.log('是否为组长:', isGroupLeader);
      
      let apiUrl = '';
      if (deletingAccount.role === 'employee' && !isGroupLeader) {
        apiUrl = `/admin/employee/${deletingAccount._id}`;
      } else {
        apiUrl = `/admin/account/${deletingAccount._id}`;
      }
      
      console.log('删除API URL:', apiUrl);
      
      const response = await request<any>(apiUrl, {
        method: 'DELETE'
      });
      
      console.log('删除API响应:', response);
      
      setShowDeleteModal(false);
      setDeletingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setError(error.message || '删除账号失败');
      // 即使出错也要关闭弹窗
      setShowDeleteModal(false);
      setDeletingAccount(null);
    } finally {
      setSaving(false);
      console.log('删除操作完成');
    }
  };

  const handleToggleStatus = async (account: Account, event?: React.MouseEvent) => {
    // 阻止默认行为和事件冒泡
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 移除焦点，防止浏览器自动滚动
    if (event?.currentTarget) {
      (event.currentTarget as HTMLElement).blur();
    }
    
    try {
      const newStatus = account.status === 'active' ? 'inactive' : 'active';
      
      // 保存当前滚动位置到ref
      scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
      console.log('保存滚动位置:', scrollPositionRef.current);
      
      if (account.role === 'employee' || account.employeeId) {
        await request<any>(`/admin/employee/${account._id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      } else {
        await request<any>(`/admin/account/${account._id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      }
      
      // 更新本地状态，不重新获取所有数据
       setAccounts(prevAccounts => {
         const newAccounts = prevAccounts.map(a => 
           a._id === account._id ? { ...a, status: newStatus } : a
         );
         console.log('状态已更新，准备恢复滚动位置:', scrollPositionRef.current);
         return newAccounts;
       });
       
       // 使用多个setTimeout确保在DOM更新后恢复滚动位置
       [0, 50, 100, 200, 300, 500].forEach(delay => {
         setTimeout(() => {
           if (scrollPositionRef.current > 0) {
             window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
             console.log(`已恢复滚动位置(${delay}ms):`, scrollPositionRef.current);
             if (delay === 500) {
               scrollPositionRef.current = 0;
             }
           }
         }, delay);
       });
    } catch (error: any) {
      console.error('Error toggling status:', error);
      alert(error.message || '切换状态失败');
    }
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      teamName: account.teamName || '',
      realName: account.realName || '',
      phone: account.phone || '',
      region: account.region || '',
      username: account.username || '',
      password: '',
      employeeId: account.employeeId || '',
      parentId: account.parentId || '',
      groupId: account.groupId || '',
      groupName: account.groupName || '',
      commissionRate: account.commission ? (account.commission * 100).toString() : ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (account: Account) => {
    setDeletingAccount(account);
    setShowDeleteModal(true);
  };

  const [activeTab, setActiveTab] = useState<'team-leader' | 'group-leader' | 'employee'>('team-leader');

  // 过滤账号列表
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    
    // 根据当前标签页过滤
    if (activeTab === 'team-leader') {
      filtered = accounts.filter(a => 
        !a.employeeId && a.role === 'NORMAL_ADMIN'
      );
    } else if (activeTab === 'group-leader') {
      // 过滤组长账号
      filtered = accounts.filter(a => 
        a.role === 'GROUP_LEADER' || a.role === 'group_leader' || a.isGroupLeader || (a.groupId && a.groupId !== '')
      );
    } else {
        // 过滤非组长员工
        filtered = accounts.filter(a => 
          a.employeeId && !(a.role === 'GROUP_LEADER' || a.role === 'group_leader' || a.isGroupLeader || (a.groupId && a.groupId !== ''))
        );
      }
    
    // 根据搜索关键词过滤
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(a => 
        (a.realName && a.realName.toLowerCase().includes(keyword)) ||
        (a.username && a.username.toLowerCase().includes(keyword)) ||
        (a.phone && a.phone.includes(keyword)) ||
        (a.employeeId && a.employeeId.includes(keyword))
      );
    }
    
    console.log('过滤后的账号列表:', filtered);
    return filtered;
  }, [accounts, activeTab, searchKeyword]);

  // 计算团队长账号数量
  const teamLeaderCount = useMemo(() => {
    return accounts.filter(a => 
      !a.employeeId && a.role === 'NORMAL_ADMIN'
    ).length;
  }, [accounts]);

  // 计算组长账号数量
  const groupLeaderCount = useMemo(() => {
    return accounts.filter(a => 
      a.role === 'GROUP_LEADER' || a.role === 'group_leader' || a.isGroupLeader || (a.groupId && a.groupId !== '')
    ).length;
  }, [accounts]);

  // 计算员工账号数量
  const employeeCount = useMemo(() => {
    return accounts.filter(a => a.employeeId).length;
  }, [accounts]);

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB]">
      {/* 头部 */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-gray-400 active:text-gray-900 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <User className="text-[#1E40AF] mr-2" size={24} />
              帐号管理
            </h1>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
          >
            <UserPlus size={20} />
          </button>
        </div>
        
        {/* 搜索框 */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="搜索姓名、手机号、工号..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
      </header>

      {/* 标签页 */}
      <div className="px-4 py-3 bg-white border-b flex space-x-2">
        <button
          onClick={() => setActiveTab('team-leader')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'team-leader'
              ? 'bg-[#1E40AF] text-white'
              : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          团队长账号 ({teamLeaderCount})
        </button>
        <button
          onClick={() => setActiveTab('group-leader')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'group-leader'
              ? 'bg-[#1E40AF] text-white'
              : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          组长账号 ({groupLeaderCount})
        </button>
        <button
          onClick={() => setActiveTab('employee')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'employee'
              ? 'bg-[#1E40AF] text-white'
              : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          员工账号 ({employeeCount})
        </button>
      </div>

      {/* 账号列表 */}
      <div className="p-4">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
            <p className="text-xs text-gray-400 font-bold">加载中...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-20 text-center">
            <User className="mx-auto text-gray-200 mb-2" size={48} />
            <p className="text-xs text-gray-400 font-bold">
              {activeTab === 'team-leader' ? '暂无团队长账号' : activeTab === 'group-leader' ? '暂无组长账号' : '暂无员工账号'}
            </p>
          </div>
        ) : (
          <div className="space-y-3" style={{ overflowAnchor: 'none' }}>
            {filteredAccounts.map((account) => (
              <div key={account._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      account.role === 'NORMAL_ADMIN' 
                        ? 'bg-purple-100 text-purple-600'
                        : account.role === 'GROUP_LEADER' || account.role === 'group_leader'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}>
                      {account.role === 'NORMAL_ADMIN' ? (
                        <Crown size={20} />
                      ) : account.role === 'GROUP_LEADER' || account.role === 'group_leader' ? (
                        <Star size={20} />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* 组长账号的显示逻辑 */}
                      {account.role === 'GROUP_LEADER' || account.role === 'group_leader' || account.isGroupLeader ? (
                        <>
                          {account.teamName && (
                            <p className="text-base text-[#1E40AF] font-bold">
                              {account.teamName}
                            </p>
                          )}
                          <p className="text-sm text-gray-900 flex items-center">
                            组别：{account.groupName || '无'}
                          </p>
                          <h3 className="text-sm text-gray-900">
                            组长：{account.realName || account.username}
                          </h3>
                          {account.commission !== undefined && (
                            <p className="text-sm font-bold text-gray-900 flex items-center">
                              分成：{(account.commission * 100).toFixed(0)}%
                            </p>
                          )}
                        </>
                      ) : (
                        /* 团队长和员工账号的显示逻辑（恢复原样） */
                        <>
                          {account.teamName && (
                            <p className="text-sm text-[#1E40AF] font-bold">
                              {account.teamName}
                            </p>
                          )}
                          <h3 className="text-sm font-bold text-gray-900">
                            {account.realName || account.username}
                            {account.employeeId && !(account.role === 'GROUP_LEADER' || account.role === 'group_leader' || account.isGroupLeader) && <span className="ml-2 text-[#1E40AF]">({account.employeeId})</span>}
                          </h3>
                          <div className="space-y-0.5">
                            {account.username && !account.employeeId && account.role !== 'NORMAL_ADMIN' && (
                              <p className="text-xs text-gray-500">
                                用户名：{account.username}
                              </p>
                            )}
                            {account.phone && (
                              <p className="text-xs text-gray-500 flex items-center">
                                <Phone size={10} className="mr-1 flex-shrink-0" />
                                {account.phone}
                              </p>
                            )}

                            {account.region && (
                              <p className="text-xs text-gray-500 flex items-center">
                                <MapPin size={10} className="mr-1 flex-shrink-0" />
                                {account.region}
                              </p>
                            )}
                            {account.employeeId && (
                              <p className="text-xs text-[#1E40AF] flex items-center">
                                团队：{account.parentName || account.teamName || account.superior || '无'}
                              </p>
                            )}
                            {account.employeeId && (
                              <p className="text-xs text-orange-500 flex items-center">
                                组别：{account.groupName || '无'}
                              </p>
                            )}
                          </div>
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
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? '启用' : '禁用'}
                      </span>
                      <button
                        onClick={(e) => handleToggleStatus(account, e)}
                        className={`w-10 h-6 rounded-full p-0.5 transition-all ${(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加账号弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">添加账号</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError(null);
                  setFormData({
                    teamName: '',
                    realName: '',
                    phone: '',
                    region: '',
                    username: '',
                    password: '',
                    employeeId: '',
                    parentId: '',
                    groupId: '',
                    groupName: '',
                    commissionRate: ''
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 账号类型选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  账号类型
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setAddType('team')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      addType === 'team'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    团队长
                  </button>
                  <button
                    onClick={() => setAddType('group')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      addType === 'group'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    组长
                  </button>
                  <button
                    onClick={() => setAddType('employee')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      addType === 'employee'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    员工
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* 表单字段 */}
              <div className="space-y-4">
                {addType === 'group' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属团队 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">请选择团队</option>
                        {teamLeaders.map(team => (
                          <option key={team._id} value={team._id}>
                            {team.teamName || team.realName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        分成比例 (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder=""
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({...formData, commissionRate: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                  </>
                )}

                {addType === 'employee' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属团队 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => {
                          setFormData({...formData, parentId: e.target.value, groupId: ''});
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">请选择团队</option>
                        {teamLeaders.map(team => (
                          <option key={team._id} value={team._id}>
                            {team.teamName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属组
                      </label>
                      <select
                        value={formData.groupId}
                        onChange={(e) => setFormData({...formData, groupId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">无</option>
                        {groups.filter(group => {
                          if (!formData.parentId) return true;
                          // 首先尝试通过 teamLeaderId 匹配
                          if (group.teamLeaderId === formData.parentId) return true;
                          // 然后尝试通过团队名称匹配
                          const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
                          return selectedTeam && group.teamName === selectedTeam.teamName;
                        }).map(group => (
                          <option key={group._id} value={group._id}>
                            {group.groupName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {addType === 'team' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      团队名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="请输入团队名称"
                      value={formData.teamName}
                      onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                    />
                  </div>
                )}
                {addType === 'group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      组名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="请输入组名"
                      value={formData.groupName}
                      onChange={(e) => setFormData({...formData, groupName: e.target.value})}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="请输入姓名"
                    value={formData.realName}
                    onChange={(e) => setFormData({...formData, realName: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>

                {(addType === 'team' || addType === 'employee' || addType === 'group') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        手机号 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                    <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    所属地区 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="请输入所属地区"
                    value={formData.region}
                    onChange={(e) => setFormData({...formData, region: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>
                
                {addType === 'employee' && (
                  <p className="text-xs text-blue-600 mt-1">
                    *员工号添加后，由系统自动生成4位随机数字
                  </p>
                )}
                  </>
                )}

                {(addType === 'team' || addType === 'group') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        登录账号 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="请输入登录账号"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        密码 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="请输入密码"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleAddAccount}
                disabled={saving}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑账号弹窗 */}
      {showEditModal && editingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">编辑账号</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAccount(null);
                  setError(null);
                  setFormData({
                    teamName: '',
                    realName: '',
                    phone: '',
                    region: '',
                    username: '',
                    password: '',
                    employeeId: '',
                    parentId: '',
                    groupId: '',
                    groupName: '',
                    commissionRate: ''
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {(editingAccount.role === 'employee' || editingAccount.employeeId) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属团队
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => {
                          setFormData({...formData, parentId: e.target.value, groupId: ''});
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">请选择团队</option>
                        {teamLeaders.map(team => (
                          <option key={team._id} value={team._id}>
                            {team.teamName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属组
                      </label>
                      <select
                        value={formData.groupId}
                        onChange={(e) => setFormData({...formData, groupId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">无</option>
                        {groups.filter(group => {
                          if (!formData.parentId) return true;
                          // 首先尝试通过 teamLeaderId 匹配
                          if (group.teamLeaderId === formData.parentId) return true;
                          // 然后尝试通过团队名称匹配
                          const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
                          return selectedTeam && group.teamName === selectedTeam.teamName;
                        }).map(group => (
                          <option key={group._id} value={group._id}>
                            {group.groupName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {(editingAccount.role === 'NORMAL_ADMIN') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      团队名称
                    </label>
                    <input
                      type="text"
                      value={formData.teamName}
                      onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                    />
                  </div>
                )}

                {(editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      组名
                    </label>
                    <input
                      type="text"
                      value={formData.groupName}
                      onChange={(e) => setFormData({...formData, groupName: e.target.value})}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.realName}
                    onChange={(e) => setFormData({...formData, realName: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    手机号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    所属地区 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.region}
                    onChange={(e) => setFormData({...formData, region: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>
                
                {(editingAccount.role === 'employee' || (editingAccount.employeeId && !(editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader' || editingAccount.isGroupLeader))) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      工号
                    </label>
                    <input
                      type="text"
                      value={formData.employeeId}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {!(editingAccount.role === 'employee' || (editingAccount.employeeId && !(editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader' || editingAccount.isGroupLeader))) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        账号
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        密码 (留空则不修改)
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleEditAccount}
                disabled={saving}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && deletingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
              <p className="text-gray-500 mb-6">
                确定要删除账号 "{deletingAccount.realName || deletingAccount.username}" 吗？此操作不可恢复。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingAccount(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
