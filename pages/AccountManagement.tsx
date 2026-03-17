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

  const fetchAccounts = async () => {
    setLoading(true);
    // 保存当前滚动位置
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const startTime = performance.now();
    try {
      // 并行获取所有数据，提高加载速度
      const [teamResponse, employeeResponse, groupsResponse, groupLeadersResponse] = await Promise.all([
        request<any>('/account/list', { method: 'GET' }).catch(error => {
          console.error('Error fetching team accounts:', error);
          return null;
        }),
        request<any>('/employee/list?pageSize=100', { method: 'GET' }).catch(error => {
          console.error('Error fetching employee accounts:', error);
          return null;
        }),
        request<any>('/admin/team-group/list', { method: 'GET' }).catch(error => {
          console.error('Error fetching groups:', error);
          return null;
        }),
        request<any>('/admin/group-leader/list', { method: 'GET' }).catch(error => {
          console.error('Error fetching group leaders:', error);
          return null;
        })
      ]);
      
      const apiTime = performance.now() - startTime;
      console.log(`API请求时间: ${apiTime.toFixed(2)}ms`);
      
      // 处理团队账号数据（只保留真正的团队长，排除组长）
      const rawTeamAccounts = teamResponse 
        ? (Array.isArray(teamResponse) ? teamResponse : (teamResponse?.admins || [])) 
        : [];
      
      // 处理组长数据，获取组长ID列表
      let groupLeaders: any[] = [];
      if (groupLeadersResponse) {
        if (Array.isArray(groupLeadersResponse)) {
          groupLeaders = groupLeadersResponse;
        } else if (groupLeadersResponse.data && Array.isArray(groupLeadersResponse.data)) {
          groupLeaders = groupLeadersResponse.data;
        }
      }
      const groupLeaderIds = new Set(groupLeaders.map((g: any) => g._id));
      
      // 过滤团队账号：NORMAL_ADMIN角色且不在组长ID列表中
      const teamAccounts = rawTeamAccounts.filter((a: any) => 
        a.role === 'NORMAL_ADMIN' && !groupLeaderIds.has(a._id)
      );
      
      // 处理员工账号数据
      const employeeAccounts = employeeResponse 
        ? (Array.isArray(employeeResponse) ? employeeResponse : (employeeResponse?.data || [])) 
        : [];
      
      // 合并账号数据（团队长 + 组长 + 员工）
      const allAccounts = [...teamAccounts, ...groupLeaders, ...employeeAccounts];
      const processTime = performance.now() - startTime;
      console.log(`数据处理时间: ${(processTime - apiTime).toFixed(2)}ms`);
      
      setAccounts(allAccounts);
      // teamAccounts已经过滤过，只包含真正的团队长
      setTeamLeaders(teamAccounts);
      
      // 处理组数据
      let groupsData: any[] = [];
      if (groupsResponse) {
        if (Array.isArray(groupsResponse)) {
          groupsData = groupsResponse;
        } else if (groupsResponse.data && Array.isArray(groupsResponse.data)) {
          groupsData = groupsResponse.data;
        }
      }
      setGroups(groupsData);
      
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
            teamLeaderId: formData.parentId,
            teamName: selectedTeam?.teamName || '',
            groupName: formData.teamName, // 使用teamName字段作为组名
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
            teamName: selectedTeam?.teamName || '',
            teamGroupId: groupResult._id, // 使用创建的组ID
            groupName: formData.teamName,
            commission: commissionRate
          })
        });
      } else {
        await request<any>('/employee/create', {
          method: 'POST',
          body: JSON.stringify({
            parentId: formData.parentId,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            groupId: formData.groupId
          })
        });
      }
      setShowAddModal(false);
      setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '', groupId: '', commissionRate: '' });
      fetchAccounts();
    } catch (error: any) {
      console.error('Error adding account:', error);
      setError(error.message || '添加失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAccount = async () => {
    if (!editingAccount) return;
    setError(null);

    const isGroupLeader = editingAccount.role === 'GROUP_LEADER' || (editingAccount.role === 'NORMAL_ADMIN' && (editingAccount.teamGroupId || editingAccount.groupName));

    if (isGroupLeader) {
      if (!formData.teamName || !formData.realName || !formData.username || !formData.parentId) {
        setError('请填写所有必填字段');
        return;
      }
    } else {
      if (!formData.teamName || !formData.realName || !formData.phone || !formData.region || !formData.username) {
        setError('请填写所有必填字段');
        return;
      }
    }

    setSaving(true);
    try {
      if (isGroupLeader) {
        // 获取分成比例
        const commissionRate = formData.commissionRate ? parseFloat(formData.commissionRate) / 100 : undefined;
        
        // 更新组长账号信息（会自动同步更新TeamGroup表）
        await request<any>(`/admin/group-leader/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            username: formData.username,
            password: formData.password || undefined,
            teamGroupId: formData.parentId,
            groupName: formData.teamName,
            ...(commissionRate !== undefined && { commission: commissionRate })
          })
        });
      } else {
        await request<any>(`/account/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            teamName: formData.teamName,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            username: formData.username,
            password: formData.password || undefined
          })
        });
      }
      setShowEditModal(false);
      setEditingAccount(null);
      setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '', groupId: '', commissionRate: '' });
      fetchAccounts();
    } catch (error: any) {
      console.error('Error updating account:', error);
      setError(error.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEmployee = async () => {
    if (!editingAccount) return;
    setError(null);

    if (!formData.parentId || !formData.realName || !formData.phone || !formData.region) {
      setError('请填写所有必填字段');
      return;
    }

    if (!formData.employeeId || formData.employeeId.length !== 4) {
      setError('员工号必须为4位数字');
      return;
    }

    setSaving(true);
    try {
      await request<any>(`/employee/${editingAccount._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          parentId: formData.parentId,
          realName: formData.realName,
          phone: formData.phone,
          region: formData.region,
          employeeId: formData.employeeId,
          groupId: formData.groupId
        })
      });
      setShowEditModal(false);
      setEditingAccount(null);
      setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '', groupId: '', commissionRate: '' });
      fetchAccounts();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      setError(error.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    
    setSaving(true);
    try {
      if (deletingAccount.role === 'EMPLOYEE') {
        await request<any>(`/employee/${deletingAccount._id}`, {
          method: 'DELETE'
        });
      } else if (deletingAccount.role === 'GROUP_LEADER' || deletingAccount.teamGroupId || deletingAccount.groupName) {
        await request<any>(`/admin/group-leader/${deletingAccount._id}`, {
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
      setError(error.message || '删除失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (account: Account) => {
    setDeletingAccount(account);
    setShowDeleteModal(true);
  };

  const openEditModal = async (account: Account) => {
    // 先设置editingAccount
    setEditingAccount(account);
    
    // 直接设置formData，确保数据正确
    if (account.role === 'EMPLOYEE') {
      setFormData({
        parentId: account.parentId || '',
        realName: account.realName || '',
        phone: account.phone || '',
        region: account.region || '',
        teamName: '',
        username: '',
        password: '',
        employeeId: account.employeeId || '',
        groupId: account.groupId || '',
        commissionRate: ''
      });
    } else {
      // 判断是否为组长（有teamGroupId或groupName）
      const isGroupLeader = account.teamGroupId || account.groupName;
      
      // 对于组长，需要获取团队长ID
      let teamLeaderId = '';
      
      if (isGroupLeader) {
        // 如果teamLeaders为空，先获取团队列表
        if (teamLeaders.length === 0) {
          try {
            const response = await request<any>('/account/list', { method: 'GET' });
            const admins = response && Array.isArray(response) ? response : (response?.admins || []);
            const teams = admins.filter((a: any) => a.role === 'NORMAL_ADMIN');
            setTeamLeaders(teams);
            
            // 从获取的团队中查找
            if (account.teamName) {
              const teamLeader = teams.find((t: any) => t.teamName === account.teamName);
              if (teamLeader) {
                teamLeaderId = teamLeader._id;
              }
            }
          } catch (error) {
            console.error('Error fetching team leaders:', error);
          }
        } else {
          // 使用已有的teamLeaders
          if (account.teamName) {
            const teamLeader = teamLeaders.find((t: any) => t.teamName === account.teamName);
            if (teamLeader) {
              teamLeaderId = teamLeader._id;
            }
          }
        }
      }
      
      // 如果没找到，使用account的parentId
      if (!teamLeaderId && account.parentId) {
        teamLeaderId = account.parentId;
      }
      
      // 先设置基本数据，打开模态框
      setFormData({
        teamName: isGroupLeader ? (account.groupName || '') : (account.teamName || ''),
        realName: account.realName || '',
        phone: account.phone || '',
        region: account.region || '',
        username: account.username || '',
        password: '',
        employeeId: '',
        parentId: teamLeaderId,
        groupId: '',
        commissionRate: isGroupLeader && account.commission ? String(Math.round(account.commission * 100)) : ''
      });
    }
    
    // 打开编辑模态框
    setShowEditModal(true);
  };

  // 当groups或teamLeaders数据加载完成时，更新组长账号的parentId
  useEffect(() => {
    if (showEditModal && editingAccount && (editingAccount.teamGroupId || editingAccount.groupName)) {
      // 如果是组长，尝试从groups或teamLeaders中获取正确的parentId
      if (groups.length > 0 || teamLeaders.length > 0) {
        let teamLeaderId = '';
        
        // 从groups中查找
        if (editingAccount.teamGroupId && groups.length > 0) {
          const group = groups.find((g: any) => g._id === editingAccount.teamGroupId);
          if (group && group.teamLeaderId) {
            teamLeaderId = group.teamLeaderId;
          }
        }
        
        // 从teamLeaders中查找
        if (!teamLeaderId && editingAccount.teamName && teamLeaders.length > 0) {
          const teamLeader = teamLeaders.find((t: any) => t.teamName === editingAccount.teamName);
          if (teamLeader && teamLeader._id) {
            teamLeaderId = teamLeader._id;
          }
        }
        
        // 如果找到了teamLeaderId且与当前不同，更新它
        if (teamLeaderId && teamLeaderId !== formData.parentId) {
          setFormData(prev => ({ ...prev, parentId: teamLeaderId }));
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditModal, editingAccount, groups, teamLeaders]);

  const toggleAccountStatus = async (account: Account) => {
    try {
      const currentEnabled = account.status === 'enabled' || account.status === '1';
      const newStatus = currentEnabled ? 'disabled' : 'enabled';
      
      if (account.role === 'EMPLOYEE') {
        await request<any>(`/employee/${account._id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      } else if (account.role === 'GROUP_LEADER' || account.teamGroupId || account.groupName) {
        await request<any>(`/admin/group-leader/${account._id}`, {
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
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return '超级管理员';
      case 'NORMAL_ADMIN': return '团队长';
      case 'GROUP_LEADER': return '组长';
      case 'EMPLOYEE': return '员工';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-50 text-purple-600';
      case 'NORMAL_ADMIN': return 'bg-blue-50 text-blue-600';
      case 'GROUP_LEADER': return 'bg-green-50 text-green-600';
      case 'EMPLOYEE': return 'bg-yellow-50 text-yellow-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  // 缓存账号数量计算，避免每次渲染都重新计算
  const accountCounts = useMemo(() => {
    return {
      team: accounts.filter(a => a.role === 'NORMAL_ADMIN' && !a.teamGroupId && !a.groupName).length,
      group: accounts.filter(a => a.role === 'GROUP_LEADER' || (a.role === 'NORMAL_ADMIN' && (a.teamGroupId || a.groupName))).length,
      employee: accounts.filter(a => a.role === 'EMPLOYEE').length
    };
  }, [accounts]);

  // 缓存团队名称查找，避免每次渲染都计算
  const getParentTeamName = useMemo(() => {
    return (parentId: string) => {
      const parent = teamLeaders.find(t => t._id === parentId);
      return parent?.teamName || '未知团队';
    };
  }, [teamLeaders]);

  // 缓存过滤后的账号列表，避免每次渲染都重新过滤
  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (addType === 'team') {
        // 团队长：NORMAL_ADMIN角色且没有teamGroupId和groupName
        return a.role === 'NORMAL_ADMIN' && !a.teamGroupId && !a.groupName;
      } else if (addType === 'group') {
        // 组长：GROUP_LEADER角色，或NORMAL_ADMIN角色但有teamGroupId或groupName
        return a.role === 'GROUP_LEADER' || (a.role === 'NORMAL_ADMIN' && (a.teamGroupId || a.groupName));
      } else {
        if (a.role !== 'EMPLOYEE') return false;
        if (searchKeyword) {
          const keyword = searchKeyword.toLowerCase();
          return (a.employeeId?.toLowerCase().includes(keyword) || 
                  a.phone?.includes(keyword) ||
                  a.realName?.toLowerCase().includes(keyword));
        }
        return true;
      }
    });
  }, [accounts, addType, searchKeyword]);

  // 优化渲染性能，使用React.memo包装账号项组件
  const AccountItem = React.memo(({ account }: { account: Account }) => {
    return (
      <div key={account._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
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
            <div>
              {account.role === 'EMPLOYEE' ? (
                <>
                  <h3 className="text-sm font-bold text-gray-900">
                    {account.realName}
                    {account.employeeId && <span className="ml-2 text-[#1E40AF]">({account.employeeId})</span>}
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    {account.phone && <span>{account.phone}</span>}
                  </p>
                  {/* 团队信息 */}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    团队：{getParentTeamName(account.parentId || '')}
                  </p>
                  {/* 组别信息 */}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    组别：{account.groupName || '无'}
                  </p>
                  {/* 地区信息 */}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    地区：{account.region || '无'}
                  </p>
                </>
              ) : (
                <>
                  {/* 第一行：团队名称 */}
                  <h3 className="text-sm font-bold text-gray-900">{account.teamName || account.username}</h3>
                  {/* 第二行：组名称（如果有） */}
                  {account.groupName && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      组别：{account.groupName}
                    </p>
                  )}
                  {/* 第三行：团队长/组长名称 */}
                  {account.realName && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {account.teamGroupId || account.groupName ? '组长' : '团队长'}：{account.realName}
                    </p>
                  )}
                  {/* 第四行：分成比例（组长显示） */}
                  {(account.teamGroupId || account.groupName) && account.commission !== undefined && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      分成：{Math.round(account.commission * 100)}%
                    </p>
                  )}
                  {/* 第五行：地区（团队长显示） */}
                  {account.region && !account.teamGroupId && !account.groupName && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      地区：{account.region}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {/* 创建时间 */}
            {account.createdAt && (
              <span className="text-[10px] text-gray-400">
                {new Date(account.createdAt).toLocaleDateString()}
              </span>
            )}
            <div className="flex items-center space-x-2">
              {account.role !== 'SUPER_ADMIN' && (
                <button
                  onClick={() => openEditModal(account)}
                  className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {account.role !== 'SUPER_ADMIN' && (
                <button
                  onClick={() => openDeleteModal(account)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
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
    );
  });

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">账号管理</h1>
        <button 
          onClick={() => setShowAddModal(true)}
          className="p-2 text-[#1E40AF]"
        >
          <UserPlus size={22} />
        </button>
      </header>

      <div className="p-4">
        <div className="flex space-x-2 mb-4">
          <button 
            onClick={() => setAddType('team')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${addType === 'team' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            团队长账号 ({accountCounts.team})
          </button>
          <button 
            onClick={() => setAddType('group')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${addType === 'group' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            组长账号 ({accountCounts.group})
          </button>
          <button 
            onClick={() => setAddType('employee')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${addType === 'employee' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            员工账号 ({accountCounts.employee})
          </button>
        </div>

        {addType === 'employee' && (
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索员工ID或手机号"
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
              <AccountItem key={account._id} account={account} />
            ))}
            {filteredAccounts.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Users size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">暂无账号</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                添加{addType === 'team' ? '团队长' : addType === 'group' ? '组长' : '员工'}账号
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {addType === 'team' ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">团队名称</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入团队名称"
                        value={formData.teamName}
                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">团队长姓名</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入团队长姓名"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">手机号 <span className="text-gray-300 font-normal">(可选)</span></label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">地区 <span className="text-gray-300 font-normal">(可选)</span></label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入地区"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">用户名</label>
                    <input
                      type="text"
                      placeholder="请输入用户名"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">密码</label>
                    <input
                      type="password"
                      placeholder="请输入密码"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </>
              ) : addType === 'group' ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">所属团队</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                      >
                        <option value="">请选择所属团队</option>
                        {teamLeaders.map((leader) => (
                          <option key={leader._id} value={leader._id}>
                            {leader.teamName}
                          </option>
                        ))}
                        {/* 如果formData.parentId不在teamLeaders中，添加一个临时选项 */}
                        {formData.parentId && !teamLeaders.find(l => l._id === formData.parentId) && editingAccount?.teamName && (
                          <option value={formData.parentId}>
                            {editingAccount.teamName}
                          </option>
                        )}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">组名称</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入组名称"
                        value={formData.teamName}
                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">组长姓名</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入组长姓名"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">手机号 <span className="text-gray-300 font-normal">(可选)</span></label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">地区 <span className="text-gray-300 font-normal">(可选)</span></label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入地区"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">用户名</label>
                    <input
                      type="text"
                      placeholder="请输入用户名"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">密码</label>
                    <input
                      type="password"
                      placeholder="请输入密码"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">分成比例 (%)</label>
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
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">组长分成比例，默认5%，最高不超过20%</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">所属团队</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value, groupId: '' })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                      >
                        <option value="">请选择所属团队</option>
                        {teamLeaders.map((leader) => (
                          <option key={leader._id} value={leader._id}>
                            {leader.teamName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  {formData.parentId && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block">所属小组 <span className="text-gray-300 font-normal">(可选)</span></label>
                      <div className="relative">
                        <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          value={formData.groupId}
                          onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                        >
                          <option value="">无（直接归属于团队长）</option>
                          {groups.filter(g => g.teamLeaderId === formData.parentId).map((group) => (
                            <option key={group._id} value={group._id}>
                              {group.groupName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">不选择则直接归属于团队长</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">姓名</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入员工姓名"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">手机号</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">地区</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入地区"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
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
            
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-50">
              {error && (
                <div className="mb-3 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                  {error}
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '', groupId: '', commissionRate: '' });
                    setError(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={handleAddAccount}
                  disabled={saving}
                  className={`flex-1 py-3 font-bold rounded-xl ${saving ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
                >
                  {saving ? '添加中...' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                编辑{editingAccount?.role === 'EMPLOYEE' ? '员工' : editingAccount?.role === 'GROUP_LEADER' || (editingAccount?.role === 'NORMAL_ADMIN' && (editingAccount?.teamGroupId || editingAccount?.groupName)) ? '组长' : '团队长'}账号
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {editingAccount?.role === 'EMPLOYEE' ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">所属团队</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value, groupId: '' })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                      >
                        <option value="">请选择所属团队</option>
                        {teamLeaders.map((leader) => (
                          <option key={leader._id} value={leader._id}>
                            {leader.teamName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  {formData.parentId && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block">所属小组</label>
                      <div className="relative">
                        <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          value={formData.groupId}
                          onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                        >
                          <option value="">请选择所属小组</option>
                          {groups.filter(g => g.teamLeaderId === formData.parentId).map((group) => (
                            <option key={group._id} value={group._id}>
                              {group.groupName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">姓名</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入员工姓名"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">手机号</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">地区</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入地区"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">员工号</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入员工号（4位数字）"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        maxLength={4}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">员工号必须为4位数字，不可重复</p>
                  </div>
                </>
              ) : editingAccount?.role === 'GROUP_LEADER' || (editingAccount?.role === 'NORMAL_ADMIN' && (editingAccount?.teamGroupId || editingAccount?.groupName)) ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">所属团队</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                      >
                        <option value="">请选择所属团队</option>
                        {teamLeaders.map((leader) => (
                          <option key={leader._id} value={leader._id}>
                            {leader.teamName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">组名称</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入组名称"
                        value={formData.teamName}
                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">组长姓名</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入组长姓名"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">手机号</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">地区</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入地区"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">用户名</label>
                    <input
                      type="text"
                      placeholder="请输入用户名"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">密码 <span className="text-gray-300 font-normal">(留空则不修改)</span></label>
                    <input
                      type="password"
                      placeholder="请输入新密码"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">分成比例 (%)</label>
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
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">组长分成比例，默认5%，最高不超过20%</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">团队名称</label>
                    <div className="relative">
                      <Users2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入团队名称"
                        value={formData.teamName}
                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">团队长姓名</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入团队长姓名"
                        value={formData.realName}
                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">手机号</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">地区</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="请输入地区"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">用户名</label>
                    <input
                      type="text"
                      placeholder="请输入用户名"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">密码 <span className="text-gray-300 font-normal">(留空则不修改)</span></label>
                    <input
                      type="password"
                      placeholder="请输入新密码"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-50">
              {error && (
                <div className="mb-3 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                  {error}
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAccount(null);
                    setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '', groupId: '', commissionRate: '' });
                    setError(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={editingAccount?.role === 'EMPLOYEE' ? handleEditEmployee : handleEditAccount}
                  disabled={saving}
                  className={`flex-1 py-3 font-bold rounded-xl ${saving ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
                >
                  {saving ? '保存中...' : '保存修改'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deletingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="text-lg font-bold text-gray-900">删除账号</h2>
            </div>
            
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    确定要删除 <span className="font-bold text-gray-900">
                      {deletingAccount.role === 'EMPLOYEE' ? deletingAccount.realName : deletingAccount.teamName || deletingAccount.username}
                    </span> 账号吗？
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    此操作不可撤销，删除后将无法恢复。
                  </p>
                </div>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                  {error}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-50">
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingAccount(null);
                    setError(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className={`flex-1 py-3 font-bold rounded-xl ${saving ? 'bg-gray-300 text-gray-500' : 'bg-red-500 text-white'}`}
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
