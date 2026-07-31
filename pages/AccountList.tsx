import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, RefreshCw, Phone, MapPin, ChevronLeft, Edit2, Trash2, User } from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';

interface EmployeeAccount {
  _id: string;
  realName?: string;
  employeeId?: string;
  phone?: string;
  region?: string;
  parentId?: string;
  parentName?: string;
  teamName?: string;
  superior?: string;
  groupName?: string;
  groupId?: string;
  status?: string;
  csjDeviceLimit?: number;
  createdAt?: string;
  username?: string;
  passwordPlain?: string;
}

const AccountList: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [editingAccount, setEditingAccount] = useState<EmployeeAccount | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<EmployeeAccount | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    realName: '',
    phone: '',
    region: '',
    csjDeviceLimit: 1
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser?.token) {
        setLoading(false);
        return;
      }

      // 并行请求：
      // 1. /admin/dashboard/users - 获取高管管理范围内的用户（后端自动根据 managedTeamIds 过滤）
      // 2. /admin/employee/list - 获取完整员工信息（包含 phone、region 等字段）
      const [dashboardRes, employeeRes]: [any, any] = await Promise.all([
        request<any>(`/admin/dashboard/users?range=today&limit=1000`, { method: 'GET' }),
        request<any>('/admin/employee/list?pageSize=1000', { method: 'GET' })
      ]);

      // 解析 dashboard 数据（确定高管管理范围内的用户ID集合）
      const dashboardUsers = Array.isArray(dashboardRes) ? dashboardRes : (dashboardRes?.data || []);
      const allowedUserIds = new Set<string>();
      dashboardUsers.forEach((user: any) => {
        const id = user.employeeId || user.userId || user._id || '';
        if (id) allowedUserIds.add(id);
      });

      // 解析员工完整信息
      const employeeArray = Array.isArray(employeeRes) ? employeeRes : (employeeRes?.data || []);
      
      // 过滤：1. 在高管管理范围内  2. 不是组长
      const employeeList = employeeArray
        .filter((user: any) => {
          // 必须在 dashboard 返回的用户范围内
          const userId = user.employeeId || user._id || '';
          if (!userId || !allowedUserIds.has(userId)) return false;
          
          // 过滤掉组长（避免重复）
          const isGroupLeader = user.isGroupLeader || 
            user.role === 'group_leader' || 
            user.role === 'GROUP_LEADER' || 
            (user.groupId && user.groupId !== '');
          return !isGroupLeader;
        })
        .map((user: any) => ({
          _id: user._id || user.id || '',
          realName: user.realName || user.realname || user.name || '',
          employeeId: user.employeeId || user.userId || '',
          phone: user.phone || '',
          region: user.region || '',
          parentId: user.parentId || '',
          parentName: user.parentName || user.supervisorRealName || user.superior || '',
          teamName: user.teamName || user.superior || '',
          superior: user.superior || '',
          groupName: user.groupName || '',
          groupId: user.groupId || user.teamGroupId || '',
          status: user.status || 'enabled',
          csjDeviceLimit: user.csjDeviceLimit || 1,
          createdAt: user.createdAt || user.registerTime || '',
          username: user.username || '',
          passwordPlain: user.passwordPlain || '',
        }));

      setEmployees(employeeList);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleRefresh = () => {
    fetchEmployees();
  };

  // 排序：启用的放前面，禁用的放最后
  const sortEmployees = (list: EmployeeAccount[]) => {
    return [...list].sort((a, b) => {
      const isDisabled = (s?: string) => s === 'inactive' || s === 'disabled';
      return Number(isDisabled(a.status)) - Number(isDisabled(b.status));
    });
  };

  const filteredEmployees = sortEmployees(employees.filter(employee => {
    if (!searchKeyword) return true;
    const keyword = searchKeyword.toLowerCase();
    return (
      employee.realName?.toLowerCase().includes(keyword) ||
      employee.employeeId?.toLowerCase().includes(keyword) ||
      employee.phone?.toLowerCase().includes(keyword)
    );
  }));

  const handleToggleStatus = async (account: EmployeeAccount) => {
    const newStatus = account.status === 'enabled' ? 'disabled' : 'enabled';
    try {
      await request<any>(`/admin/employee/${account._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      // 更新本地状态
      setEmployees(prev => prev.map(emp => 
        emp._id === account._id ? { ...emp, status: newStatus } : emp
      ));
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('状态切换失败');
    }
  };

  const openEditModal = (account: EmployeeAccount) => {
    setEditingAccount(account);
    setFormData({
      realName: account.realName || '',
      phone: account.phone || '',
      region: account.region || '',
      csjDeviceLimit: account.csjDeviceLimit || 1
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAccount) return;
    try {
      const body: any = {
        realName: formData.realName,
        phone: formData.phone,
        region: formData.region,
        csjDeviceLimit: formData.csjDeviceLimit
      };
      await request<any>(`/admin/employee/${editingAccount._id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      setShowEditModal(false);
      setEditingAccount(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('保存失败');
    }
  };

  const openDeleteModal = (account: EmployeeAccount) => {
    setDeletingAccount(account);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    try {
      await request<any>(`/admin/employee/${deletingAccount._id}`, {
        method: 'DELETE'
      });
      setShowDeleteModal(false);
      setDeletingAccount(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('删除失败');
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Users className="text-[#1E40AF]" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">员工账号</h1>
            {lastRefresh && (
              <p className="text-xs text-gray-400">
                共 {filteredEmployees.length} 个账号 · {lastRefresh.toLocaleTimeString()} 更新
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="搜索姓名、工号、手机号..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Employee List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-500">加载中...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="text-gray-200 mb-2" size={48} />
          <p className="text-sm text-gray-400">暂无员工账号</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmployees.map((employee) => (
            <div 
              key={employee._id} 
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* Avatar - 与超管一致：蓝色背景 + User图标 */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600">
                    <User size={20} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* 姓名 + 工号 */}
                    <h3 className="text-sm font-bold text-gray-900">
                      {employee.realName || '无'}
                      {employee.employeeId && <span className="ml-2 text-[#1E40AF]">({employee.employeeId})</span>}
                    </h3>
                    <div className="space-y-0.5">
                      {/* 用户名 */}
                      {employee.username && (
                        <p className="text-xs text-gray-500">
                          用户名：{employee.username}
                        </p>
                      )}
                      {/* 手机号 */}
                      {employee.phone && (
                        <p className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                          <Phone size={10} className="mr-1 flex-shrink-0" />
                          {employee.phone}
                        </p>
                      )}
                      {/* 地区 */}
                      {employee.region && (
                        <p className="text-xs text-gray-500 flex items-center">
                          <MapPin size={10} className="mr-1 flex-shrink-0" />
                          {employee.region}
                        </p>
                      )}
                      {/* 团队（蓝色） */}
                      <p className="text-xs text-[#1E40AF] flex items-center">
                        团队：{employee.parentName || employee.teamName || employee.superior || '无'}
                      </p>
                      {/* 组别（橙色） */}
                      <p className="text-xs text-orange-500 flex items-center">
                        组别：{employee.groupName || '无'}
                      </p>
                      {/* CSJ设备数（绿色） */}
                      <p className="text-xs text-green-600 flex items-center">
                        CSJ设备数：{employee.csjDeviceLimit || 1}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Right side - 与超管一致 */}
                <div className="flex flex-col items-end space-y-2">
                  {employee.createdAt && (
                    <span className="text-[10px] text-gray-400">
                      {new Date(employee.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  <div className="flex items-center space-x-2">
                    {/* 编辑按钮 */}
                    <button
                      onClick={() => openEditModal(employee)}
                      className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    {/* 删除按钮 */}
                    <button
                      onClick={() => openDeleteModal(employee)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    {/* 状态标签 */}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                      employee.status === 'enabled' || employee.status === 'active'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-red-50 text-red-500'
                    }`}>
                      {employee.status === 'enabled' || employee.status === 'active' ? '启用' : '禁用'}
                    </span>
                    {/* 状态切换开关 */}
                    <button
                      onClick={() => handleToggleStatus(employee)}
                      className={`w-10 h-6 rounded-full p-0.5 transition-all ${
                        employee.status === 'enabled' || employee.status === 'active'
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                        employee.status === 'enabled' || employee.status === 'active'
                          ? 'translate-x-4'
                          : 'translate-x-0'
                      }`}></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {showEditModal && editingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">编辑员工</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAccount(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 姓名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  姓名
                </label>
                <input
                  type="text"
                  value={formData.realName}
                  onChange={(e) => setFormData({...formData, realName: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 手机号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  手机号
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 地区 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  地区
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* CSJ设备数限制 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSJ 每日设备数限制
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.csjDeviceLimit}
                  onChange={(e) => setFormData({...formData, csjDeviceLimit: Math.max(1, Math.min(20, parseInt(e.target.value) || 1))})}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">该员工每日在 CSJ 系统可登录的最大设备数（默认1）</p>
              </div>
            </div>

            <div className="p-4 border-t flex space-x-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAccount(null);
                }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 bg-[#1E40AF] text-white rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && deletingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-2">确认删除</h3>
            <p className="text-sm text-gray-500 mb-4">
              确定要删除员工「{deletingAccount.realName}」的账号吗？此操作不可恢复。
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingAccount(null);
                }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountList;
