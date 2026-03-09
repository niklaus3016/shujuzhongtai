
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Search, X, 
  MoreVertical, Check, AlertCircle, Loader2, User, Phone, MapPin
} from 'lucide-react';
import { AdminUser, UserRole } from '../types';
import { request } from '../services/api';

interface EmployeeManagementProps {
  currentUser: AdminUser;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    region: ''
  });
  
  // Employees data
  const [employees, setEmployees] = useState<AdminUser[]>([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        // Fetch employee list from backend
        const employeeList = await request<AdminUser[]>('/account/employees', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        setEmployees(employeeList);
      } catch (error) {
        console.error('Error fetching employees:', error);
        // Fallback to mock data on error
        setEmployees([
          { id: 'E101', username: '张三', role: UserRole.EMPLOYEE, parentId: '2', coins: 5000, status: 'enabled' },
          { id: 'E102', username: '李四', role: UserRole.EMPLOYEE, parentId: '2', coins: 3200, status: 'enabled' },
          { id: 'E103', username: '王五', role: UserRole.EMPLOYEE, parentId: '2', coins: 1500, status: 'disabled' },
          { id: 'E104', username: '赵六', role: UserRole.EMPLOYEE, parentId: '3', coins: 8000, status: 'enabled' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [currentUser.id]);

  // 过滤后的员工列表
  const filteredEmployees = useMemo(() => {
    let list = employees;
    // Normal admins only see their own employees
    if (currentUser.role === UserRole.NORMAL_ADMIN) {
      list = list.filter(e => e.parentId === currentUser.id);
    }
    return list.filter(e => 
      (e.username || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (e.id || '').toLowerCase().includes((searchTerm || '').toLowerCase())
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
          parentId: currentUser.id
        })
      });
      
      if (result) {
        setEmployees(prev => [result, ...prev]);
      }
      setIsAddModalOpen(false);
      setFormData({ name: '', phone: '', region: '' });
    } catch (error) {
      console.error('Failed to add employee:', error);
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

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">员工账号管理</h2>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
        >
          <UserPlus size={20} />
        </button>
      </div>

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

      <div className="space-y-3">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${employee.status === 'enabled' ? 'bg-blue-50 text-[#1E40AF]' : 'bg-gray-50 text-gray-400'}`}>
                <User size={20} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{employee.id}</div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-xs text-gray-500">{employee.username || '未知'}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${employee.status === 'enabled' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {employee.status === 'enabled' ? '启用中' : '已禁用'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => handleToggleStatus(employee.id)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  employee.status === 'enabled' 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-green-100 text-green-600 hover:bg-green-200'
                }`}
              >
                {employee.status === 'enabled' ? '禁用' : '启用'}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-50">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">添加员工账号</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400"><X size={24} /></button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">姓名</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="请输入员工姓名"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            </div>
            
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-50">
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setFormData({ name: '', phone: '', region: '' });
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={handleAddEmployee}
                  disabled={saving || !formData.name || !formData.phone}
                  className={`flex-1 py-3 font-bold rounded-xl ${saving || !formData.name || !formData.phone ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
                >
                  {saving ? '添加中...' : '确认添加'}
                </button>
              </div>
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
