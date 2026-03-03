import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, UserPlus, Users, Search, ChevronRight,
  Shield, User, ToggleLeft, ToggleRight, Trash2, Phone, MapPin, Users2, Edit2, ChevronDown
} from 'lucide-react';
import { request } from '../services/api';

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
  employeeId?: string;
  createdAt: string;
}

interface AccountManagementProps {
  onBack: () => void;
}

const AccountManagement: React.FC<AccountManagementProps> = ({ onBack }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [addType, setAddType] = useState<'team' | 'employee'>('team');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [formData, setFormData] = useState({
    teamName: '',
    realName: '',
    phone: '',
    region: '',
    username: '',
    password: '',
    employeeId: '',
    parentId: ''
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const [teamResponse, employeeResponse] = await Promise.all([
        request<any>('/account/list', {
          method: 'GET',
          headers: new Headers({ 'Content-Type': 'application/json' })
        }),
        request<any>('/employee/list?pageSize=100', {
          method: 'GET',
          headers: new Headers({ 'Content-Type': 'application/json' })
        })
      ]);
      
      const teamAccounts = teamResponse.admins || teamResponse || [];
      const employeeAccounts = employeeResponse.data || employeeResponse || [];
      
      const allAccounts = [...teamAccounts, ...employeeAccounts];
      setAccounts(allAccounts);
      setTeamLeaders(teamAccounts.filter((a: Account) => a.role === 'NORMAL_ADMIN'));
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
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
          headers: new Headers({ 'Content-Type': 'application/json' }),
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
      } else {
        await request<any>('/employee/create', {
          method: 'POST',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            parentId: formData.parentId,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region
          })
        });
      }
      setShowAddModal(false);
      setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '' });
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

    if (!formData.teamName || !formData.realName || !formData.phone || !formData.region || !formData.username) {
      setError('请填写所有必填字段');
      return;
    }

    setSaving(true);
    try {
      await request<any>(`/account/${editingAccount._id}`, {
        method: 'PUT',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          teamName: formData.teamName,
          realName: formData.realName,
          phone: formData.phone,
          region: formData.region,
          username: formData.username,
          password: formData.password || undefined
        })
      });
      setShowEditModal(false);
      setEditingAccount(null);
      setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '' });
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
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          parentId: formData.parentId,
          realName: formData.realName,
          phone: formData.phone,
          region: formData.region,
          employeeId: formData.employeeId
        })
      });
      setShowEditModal(false);
      setEditingAccount(null);
      setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '' });
      fetchAccounts();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      setError(error.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    if (account.role === 'EMPLOYEE') {
      setFormData({
        parentId: account.parentId || '',
        realName: account.realName || '',
        phone: account.phone || '',
        region: account.region || '',
        teamName: '',
        username: '',
        password: '',
        employeeId: account.employeeId || ''
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
        parentId: account.parentId || ''
      });
    }
    setShowEditModal(true);
  };

  const toggleAccountStatus = async (account: Account) => {
    try {
      const currentEnabled = account.status === 'enabled' || account.status === '1';
      const newStatus = currentEnabled ? 'disabled' : 'enabled';
      
      if (account.role === 'EMPLOYEE') {
        await request<any>(`/employee/${account._id}/status`, {
          method: 'PUT',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: newStatus })
        });
      } else {
        await request<any>(`/account/${account._id}/status`, {
          method: 'PUT',
          headers: new Headers({ 'Content-Type': 'application/json' }),
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
      case 'EMPLOYEE': return '员工';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-50 text-purple-600';
      case 'NORMAL_ADMIN': return 'bg-blue-50 text-blue-600';
      case 'EMPLOYEE': return 'bg-green-50 text-green-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getParentTeamName = (parentId: string) => {
    const parent = teamLeaders.find(t => t._id === parentId);
    return parent?.teamName || '未知团队';
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
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
            团队长账号 ({accounts.filter(a => a.role !== 'EMPLOYEE').length})
          </button>
          <button 
            onClick={() => setAddType('employee')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${addType === 'employee' ? 'bg-[#1E40AF] text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            员工账号 ({accounts.filter(a => a.role === 'EMPLOYEE').length})
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
            {accounts.filter(a => {
              if (addType === 'team') {
                return a.role !== 'EMPLOYEE';
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
            }).map((account) => (
              <div key={account._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getRoleColor(account.role)}`}>
                      {account.role === 'EMPLOYEE' ? <User size={20} /> : <Shield size={20} />}
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
                          <p className="text-[10px] text-gray-400 flex items-center mt-0.5">
                            <Users2 size={10} className="mr-0.5" />
                            {getParentTeamName(account.parentId || '')}
                            {account.region && <span className="mx-1">·</span>}
                            {account.region}
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-sm font-bold text-gray-900">{account.teamName || account.username}</h3>
                          <p className="text-[10px] text-gray-400">
                            {account.realName && <span>{account.realName}</span>}
                            {account.phone && <span className="ml-2">{account.phone}</span>}
                            {!account.realName && !account.phone && getRoleLabel(account.role)}
                          </p>
                          {account.region && (
                            <p className="text-[10px] text-gray-400 flex items-center mt-0.5">
                              <MapPin size={10} className="mr-0.5" />
                              {account.region}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {account.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={() => openEditModal(account)}
                        className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                      >
                        <Edit2 size={16} />
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
            ))}
            {accounts.filter(a => addType === 'team' ? a.role !== 'EMPLOYEE' : a.role === 'EMPLOYEE').length === 0 && (
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
                添加{addType === 'team' ? '团队长' : '员工'}账号
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
              ) : (
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
                            {leader.teamName} ({leader.realName})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  
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
                    setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '' });
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

      {showEditModal && editingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                编辑{editingAccount.role === 'EMPLOYEE' ? '员工' : '团队长'}账号
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {editingAccount.role === 'EMPLOYEE' ? (
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
                            {leader.teamName} ({leader.realName})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  
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
                    setFormData({ teamName: '', realName: '', phone: '', region: '', username: '', password: '', employeeId: '', parentId: '' });
                    setError(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={editingAccount.role === 'EMPLOYEE' ? handleEditEmployee : handleEditAccount}
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
    </div>
  );
};

export default AccountManagement;
