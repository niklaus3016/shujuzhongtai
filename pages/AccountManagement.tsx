import React, { useState, useEffect, useMemo } from 'react';
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
}

interface AccountManagementProps {
  onBack: () => void;
}

const AccountManagement: React.FC<AccountManagementProps> = ({ onBack }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<Account[]>([]);
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
      const [teamResponse, employeeResponse] = await Promise.all([
        request<any>('/account/list', { method: 'GET' }).catch(error => {
          console.error('Error fetching team accounts:', error);
          return null;
        }),
        request<any>('/employee/list?pageSize=100', { method: 'GET' }).catch(error => {
          console.error('Error fetching employee accounts:', error);
          return null;
        })
      ]);
      
      const apiTime = performance.now() - startTime;
      console.log(`API请求时间: ${apiTime.toFixed(2)}ms`);
      
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
      
      // 从员工账号中提取组长（有groupId且是组长的员工）
      const groupLeaders = employeeAccounts.filter((e: any) => e.isGroupLeader || e.role === 'group_leader');
      const groupLeaderIds = new Set(groupLeaders.map((g: any) => g._id));
      
      console.log('提取的组长:', groupLeaders);
      console.log('组长ID列表:', groupLeaderIds);
      
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
      
      // 合并账号数据（团队长 + 组长 + 员工）
      const allAccounts = [...teamAccounts, ...groupLeaders, ...filteredEmployees];
      const processTime = performance.now() - startTime;
      console.log(`数据处理时间: ${(processTime - apiTime).toFixed(2)}ms`);
      
      setAccounts(allAccounts);
      setTeamLeaders(teamAccounts);
      
      // 从员工数据中提取组信息
      const groupsMap = new Map();
      filteredEmployees.forEach((e: any) => {
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
      if (!formData.parentId || !formData.teamName || !formData.realName || !formData.username || !formData.password) {
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
        await request<any>('/account/create', {
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
        
        // 第一步：先创建组
        const groupResult = await request<any>('/admin/team-group/add', {
          method: 'POST',
          body: JSON.stringify({
            groupName: formData.teamName,
            teamLeaderId: formData.parentId,
            teamName: selectedTeam?.teamName || '',
            commission: commissionRate
          })
        });
        
        // 第二步：创建组长账号
        await request<any>('/account/create', {
          method: 'POST',
          body: JSON.stringify({
            teamName: formData.teamName,
            realName: formData.realName,
            phone: '',
            region: '',
            username: formData.username,
            password: formData.password,
            role: 'GROUP_LEADER',
            parentId: formData.parentId,
            groupId: groupResult?.data?._id || groupResult?._id,
            commission: commissionRate
          })
        });
      } else {
        // 获取选中的组信息
        const selectedGroup = groups.find(g => g._id === formData.parentId);
        const selectedTeam = teamLeaders.find(t => t._id === selectedGroup?.teamLeaderId);
        
        await request<any>('/employee/add', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: formData.employeeId,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            parentId: selectedGroup?.teamLeaderId,
            groupId: formData.parentId,
            groupName: selectedGroup?.groupName,
            teamName: selectedTeam?.teamName,
            superior: selectedTeam?.teamName
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
        // 获取选中的组信息
        const selectedGroup = groups.find(g => g._id === formData.groupId);
        const selectedTeam = teamLeaders.find(t => t._id === selectedGroup?.teamLeaderId);
        
        await request<any>(`/employee/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            groupId: formData.groupId || editingAccount.groupId,
            groupName: selectedGroup?.groupName || editingAccount.groupName,
            teamName: selectedTeam?.teamName || editingAccount.teamName,
            superior: selectedTeam?.teamName || editingAccount.teamName
          })
        });
      } else {
        await request<any>(`/account/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            teamName: formData.teamName,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region
          })
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
    if (!deletingAccount) return;

    setSaving(true);
    try {
      if (deletingAccount.role === 'employee' || deletingAccount.employeeId) {
        await request<any>(`/employee/${deletingAccount._id}`, {
          method: 'DELETE'
        });
      } else {
        await request<any>(`/account/${deletingAccount._id}`, {
          method: 'DELETE'
        });
      }
      
      setShowDeleteModal(false);
      setDeletingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setError(error.message || '删除账号失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (account: Account) => {
    try {
      const newStatus = account.status === 'active' ? 'inactive' : 'active';
      
      if (account.role === 'employee' || account.employeeId) {
        await request<any>(`/employee/${account._id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      } else {
        await request<any>(`/account/${account._id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      }
      
      fetchAccounts();
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
      commissionRate: account.commission ? (account.commission * 100).toString() : ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (account: Account) => {
    setDeletingAccount(account);
    setShowDeleteModal(true);
  };

  const [activeTab, setActiveTab] = useState<'team' | 'employee'>('team');

  // 过滤账号列表
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    
    // 根据当前标签页过滤
    if (activeTab === 'team') {
      filtered = accounts.filter(a => 
        !a.employeeId && (a.role === 'NORMAL_ADMIN' || a.role === 'GROUP_LEADER' || a.role === 'group_leader')
      );
    } else {
      filtered = accounts.filter(a => a.employeeId);
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
    
    return filtered;
  }, [accounts, activeTab, searchKeyword]);

  // 计算组长账号数量（包括团队长和组长）
  const teamLeaderCount = useMemo(() => {
    return accounts.filter(a => 
      !a.employeeId && (a.role === 'NORMAL_ADMIN' || a.role === 'GROUP_LEADER' || a.role === 'group_leader')
    ).length;
  }, [accounts]);

  // 计算员工账号数量
  const employeeCount = useMemo(() => {
    return accounts.filter(a => a.employeeId).length;
  }, [accounts]);

  return (
    <div ref={swipeRef} className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">帐号管理</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      {/* 搜索栏 */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索姓名、手机号、工号..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 标签页 */}
      <div className="px-4 py-3 bg-white border-b flex gap-3">
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'team'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          组长账号 ({teamLeaderCount})
        </button>
        <button
          onClick={() => setActiveTab('employee')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'employee'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          员工账号 ({employeeCount})
        </button>
      </div>

      {/* 账号列表 */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeTab === 'team' ? '暂无组长账号' : '暂无员工账号'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((account) => (
              <div
                key={account._id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      account.role === 'NORMAL_ADMIN' 
                        ? 'bg-purple-100 text-purple-600'
                        : account.role === 'GROUP_LEADER' || account.role === 'group_leader'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {account.role === 'NORMAL_ADMIN' ? (
                        <Crown className="w-6 h-6" />
                      ) : account.role === 'GROUP_LEADER' || account.role === 'group_leader' ? (
                        <Star className="w-6 h-6" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {account.realName || account.username}
                        </h3>
                        {account.role === 'NORMAL_ADMIN' && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                            团队长
                          </span>
                        )}
                        {(account.role === 'GROUP_LEADER' || account.role === 'group_leader') && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            组长
                          </span>
                        )}
                        {account.employeeId && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            员工
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {account.employeeId && (
                          <p className="text-sm text-gray-500">工号: {account.employeeId}</p>
                        )}
                        {account.username && !account.employeeId && (
                          <p className="text-sm text-gray-500">账号: {account.username}</p>
                        )}
                        {account.phone && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {account.phone}
                          </p>
                        )}
                        {account.teamName && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Users2 className="w-3 h-3" />
                            {account.teamName}
                          </p>
                        )}
                        {account.groupName && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {account.groupName}
                          </p>
                        )}
                        {account.region && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {account.region}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(account)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(account)}
                      className={`p-2 rounded-lg transition-colors ${
                        account.status === 'active'
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {account.status === 'active' ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                    <button
                      onClick={() => openDeleteModal(account)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        placeholder="默认 10%"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({...formData, commissionRate: e.target.value})}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {addType === 'employee' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属组 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">请选择组</option>
                        {groups.map(group => (
                          <option key={group._id} value={group._id}>
                            {group.groupName} ({group.teamName})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        工号 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="请输入工号"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {(addType === 'team' || addType === 'group') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      组名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="请输入组名"
                      value={formData.teamName}
                      onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {(addType === 'team' || addType === 'employee') && (
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
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
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
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      所属组
                    </label>
                    <select
                      value={formData.groupId}
                      onChange={(e) => setFormData({...formData, groupId: e.target.value})}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">请选择组</option>
                      {groups.map(group => (
                        <option key={group._id} value={group._id}>
                          {group.groupName} ({group.teamName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(editingAccount.role === 'NORMAL_ADMIN' || editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      组名
                    </label>
                    <input
                      type="text"
                      value={formData.teamName}
                      onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
