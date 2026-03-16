
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Search, X, 
  MoreVertical, Check, AlertCircle, Loader2, User, Phone, MapPin, Smartphone,
  ChevronLeft, Edit2, Trash2, Users2, ChevronDown, Shield, ShieldOff
} from 'lucide-react';
import { AdminUser, UserRole } from '../types';
import { request } from '../services/api';

interface EmployeeManagementProps {
  currentUser: AdminUser;
  isAddModalOpen?: boolean;
  setIsAddModalOpen?: (open: boolean) => void;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ currentUser, isAddModalOpen: externalIsAddModalOpen, setIsAddModalOpen: externalSetIsAddModalOpen }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalIsAddModalOpen, setInternalIsAddModalOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isAddModalOpen = externalIsAddModalOpen !== undefined ? externalIsAddModalOpen : internalIsAddModalOpen;
  const setIsAddModalOpen = externalSetIsAddModalOpen || setInternalIsAddModalOpen;
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<AdminUser | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    region: '',
    phoneCount: ''
  });
  
  // Employees data
  const [employees, setEmployees] = useState<AdminUser[]>([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        // Fetch employee list from backend
        const employeeList = await request<AdminUser[]>('/employee/list?pageSize=100', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        console.log('Employee data from backend:', employeeList);
        // 打印每个员工的完整信息
        employeeList.forEach((employee: any, index: number) => {
          console.log(`Employee ${index}:`, employee);
          console.log(`Employee ${index} - All fields:`, Object.keys(employee));
          console.log(`Employee ${index} - phoneCount:`, employee.phoneCount);
          console.log(`Employee ${index} - 'phoneCount' in employee:`, 'phoneCount' in employee);
        });
        setEmployees(employeeList);
      } catch (error) {
        console.error('Error fetching employees:', error);
        // Fallback to mock data on error
        setEmployees([
          { id: 'E101', username: '张三', role: UserRole.EMPLOYEE, parentId: '2', coins: 5000, status: 'enabled', phoneCount: 2 },
          { id: 'E102', username: '李四', role: UserRole.EMPLOYEE, parentId: '2', coins: 3200, status: 'enabled', phoneCount: 1 },
          { id: 'E103', username: '王五', role: UserRole.EMPLOYEE, parentId: '2', coins: 1500, status: 'disabled', phoneCount: 0 },
          { id: 'E104', username: '赵六', role: UserRole.EMPLOYEE, parentId: '3', coins: 8000, status: 'enabled', phoneCount: 3 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [currentUser.id]); // 只依赖 currentUser.id，避免整个对象变化

  // 过滤后的员工列表
  const filteredEmployees = useMemo(() => {
    let list = employees;
    // Normal admins only see their own employees
    if (currentUser.role === UserRole.NORMAL_ADMIN) {
      list = list.filter(e => e.parentId === currentUser.id);
    } else if (currentUser.role === UserRole.GROUP_LEADER) {
      // Group leaders only see their own group employees
      list = list.filter(e => e.teamGroupId === currentUser.teamGroupId);
    }
    return list.filter(e => 
      (e.username || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (e.id || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      ((e as any).employeeId || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  }, [employees, searchTerm, currentUser]);

  const handleToggleStatus = (id: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, status: e.status === 'enabled' ? 'disabled' : 'enabled' };
      }
      return e;
    }));
  };

  const handleAddEmployee = async () => {
    if (!formData.name || !formData.phone) {
      return;
    }
    
    setSaving(true);
    try {
      const result = await request<AdminUser>('/employee/create', {
        method: 'POST',
        body: JSON.stringify({
          realName: formData.name,
          phone: formData.phone,
          region: formData.region,
          phoneCount: parseInt(formData.phoneCount) || 0,
          parentId: currentUser.id
        })
      });
      
      if (result) {
        setEmployees(prev => [result, ...prev]);
      }
      setIsAddModalOpen(false);
      setFormData({ name: '', phone: '', region: '', phoneCount: '' });
      setError(null);
    } catch (error: any) {
      console.error('Failed to add employee:', error);
      setError(error.message || '添加失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEmployee = async () => {
    if (!selectedEmployee) return;
    setError(null);

    if (!formData.name || !formData.phone || !formData.region) {
      setError('请填写所有必填字段');
      return;
    }

    setSaving(true);
    try {
      await request<AdminUser>(`/employee/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          realName: formData.name,
          phone: formData.phone,
          region: formData.region,
          phoneCount: parseInt(formData.phoneCount) || 0,
          parentId: currentUser.id
        })
      });
      
      setIsEditModalOpen(false);
      setSelectedEmployee(null);
      setFormData({ name: '', phone: '', region: '', phoneCount: '' });
      // 重新获取员工列表
      const employeeList = await request<AdminUser[]>('/employee/list?pageSize=100', {
        method: 'GET',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });
      setEmployees(employeeList);
      setError(null);
    } catch (error: any) {
      console.error('Error updating employee:', error);
      setError(error.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    
    setSaving(true);
    try {
      await request<any>(`/employee/${deletingEmployee.id}`, {
        method: 'DELETE',
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
      
      setIsDeleteModalOpen(false);
      setDeletingEmployee(null);
      // 重新获取员工列表
      const employeeList = await request<AdminUser[]>('/employee/list?pageSize=100', {
        method: 'GET',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });
      setEmployees(employeeList);
      setError(null);
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      setError(error.message || '删除失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // In real app, call API
    setIsPasswordModalOpen(false);
    setSelectedEmployee(null);
  };

  const openEditModal = (employee: AdminUser) => {
    setSelectedEmployee(employee);
    setFormData({
      name: employee.username || '',
      phone: employee.phone || '',
      region: employee.region || '',
      phoneCount: employee.phoneCount?.toString() || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (employee: AdminUser) => {
    setDeletingEmployee(employee);
    setIsDeleteModalOpen(true);
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN: return 'bg-purple-50 text-purple-600';
      case UserRole.NORMAL_ADMIN: return 'bg-blue-50 text-blue-600';
      case UserRole.EMPLOYEE: return 'bg-green-50 text-green-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 employee-management">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
        <input 
          type="text"
          placeholder="搜索员工姓名或 ID..."
          className="w-full pl-9 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 团队数据看板 */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-xs font-medium opacity-80">团队总人数</div>
          <div className="text-xl font-bold mt-1">{filteredEmployees.length} <span className="text-xs">人</span></div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-xs font-medium opacity-80">总领取手机数</div>
          <div className="text-xl font-bold mt-1">{filteredEmployees.reduce((total, employee) => total + (employee.phoneCount || 0), 0)} <span className="text-xs">部</span></div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredEmployees.map((employee, index) => (
          <div key={employee.id || employee.phone || employee.username || index} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(employee.status === 'enabled' || employee.status === '1') ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                <User size={20} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-gray-900">
                    {employee.username || (employee as any).realName || (employee as any).name || '未知用户'}
                    {(employee as any).employeeId && <span className="ml-2 text-[#1E40AF]">({(employee as any).employeeId})</span>}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium">
                  {employee.phone && `手机号: ${employee.phone}`}
                </div>
                {employee.region && (
                  <div className="text-[10px] text-gray-400 font-medium">
                    地区: {employee.region}
                  </div>
                )}
                <div className="text-[10px] text-gray-400 font-medium">
                  领取手机数: {employee.phoneCount || 0}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => openEditModal(employee)}
                className="p-1.5 text-gray-400 hover:text-[#1E40AF] transition-colors"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => openDeleteModal(employee)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${(employee.status === 'enabled' || employee.status === '1') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {(employee.status === 'enabled' || employee.status === '1') ? '启用' : '禁用'}
              </span>
              <button
                onClick={() => handleToggleStatus(employee.id)}
                className={`w-10 h-6 rounded-full p-0.5 transition-all ${(employee.status === 'enabled' || employee.status === '1') ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${(employee.status === 'enabled' || employee.status === '1') ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <User size={40} className="mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400 font-bold">暂无员工数据</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">添加新员工</h3>
              <button onClick={() => {
                setIsAddModalOpen(false);
                setFormData({ name: '', phone: '', region: '', phoneCount: '' });
                setError(null);
              }} className="text-gray-400"><X size={24} /></button>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                {error}
              </div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault();
              handleAddEmployee();
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">姓名</label>
                <input 
                  name="name"
                  type="text" 
                  required
                  placeholder="请输入姓名"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">手机号</label>
                <input 
                  name="phone"
                  type="tel" 
                  required
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">地区</label>
                <input 
                  name="region"
                  type="text" 
                  placeholder="请输入地区"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">领取手机数</label>
                <input 
                  name="phoneCount"
                  type="number" 
                  placeholder="请输入领取手机数"
                  value={formData.phoneCount}
                  onChange={(e) => setFormData({ ...formData, phoneCount: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  min="0"
                />
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600">
                  💡 员工号将由系统自动生成4位数字编号
                </p>
              </div>
              <button 
                type="submit"
                disabled={saving || !formData.name || !formData.phone}
                className={`w-full py-4 font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2 ${saving || !formData.name || !formData.phone ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
              >
                {saving ? '添加中...' : '确认添加'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">编辑员工账号</h3>
              <button onClick={() => {
                setIsEditModalOpen(false);
                setSelectedEmployee(null);
                setFormData({ name: '', phone: '', region: '', phoneCount: '' });
                setError(null);
              }} className="text-gray-400"><X size={24} /></button>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                {error}
              </div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault();
              handleEditEmployee();
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">姓名</label>
                <input 
                  name="name"
                  type="text" 
                  required
                  placeholder="请输入姓名"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">手机号</label>
                <input 
                  name="phone"
                  type="tel" 
                  required
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">地区</label>
                <input 
                  name="region"
                  type="text" 
                  placeholder="请输入地区"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">领取手机数</label>
                <input 
                  name="phoneCount"
                  type="number" 
                  placeholder="请输入领取手机数"
                  value={formData.phoneCount}
                  onChange={(e) => setFormData({ ...formData, phoneCount: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  min="0"
                />
              </div>
              <button 
                type="submit"
                disabled={saving || !formData.name || !formData.phone}
                className={`w-full py-4 font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2 ${saving || !formData.name || !formData.phone ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Employee Modal */}
      {isDeleteModalOpen && deletingEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">删除账号</h3>
              <button onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingEmployee(null);
                setError(null);
              }} className="text-gray-400"><X size={24} /></button>
            </div>
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    确定要删除 <span className="font-bold text-gray-900">
                      {deletingEmployee.username}
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
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingEmployee(null);
                  setError(null);
                }}
                className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl"
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={handleDeleteEmployee}
                disabled={saving}
                className={`flex-1 py-4 font-black rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all ${saving ? 'bg-gray-300 text-gray-500' : 'bg-red-500 text-white'}`}
              >
                {saving ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">修改密码</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 font-medium">正在为员工 <span className="text-[#1E40AF] font-bold">{selectedEmployee.username}</span> 修改登录密码</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">新密码</label>
                <input 
                  type="password" 
                  required
                  placeholder="请输入新密码"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-[#1E40AF] text-white font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2"
              >
                保存修改
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
